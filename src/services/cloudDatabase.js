import { saveSubmissionToFirebase, fetchSubmissionsFromFirebase, saveAudioClipToFirebase, checkEmailInFirebase } from './firebaseBackup';
import { uploadAudioToDrive } from './googleDriveStorage';
import { saveSubmissionToMongo, fetchSubmissionsFromMongo, updateSubmissionInMongo } from './mongoBackup';
import {
  savePendingAudioClip,
  removePendingAudioClip,
  listPendingAudioClips,
} from './pendingAudioStore';
import {
  getAllCachedSubmissions,
  saveSubmissionsToCache,
  getCacheSyncMeta,
  clearSubmissionsCache,
} from './candidateCacheStore';
import { dispatchCandidateToExternalWebhook } from './externalIntegrationService';

// ═══════════════════════════════════════════════════════════════════════════
// PRIMARY SUPABASE — Active Production Database
// ═══════════════════════════════════════════════════════════════════════════
const SUPABASE_URL = (
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL ||
  'https://jiqfgacbkkoofgokgqrg.supabase.co'
).replace(/\/$/, '');

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppcWZnYWNia2tvb2Znb2tncXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTE5NzYsImV4cCI6MjEwMzA4Nzk3Nn0.xQjOMclG5i0zyuJtZBHtTWFAV9UOivAXGl7ePy0bmX4';

const BACKEND_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const AUDIO_BUCKET = 'assessment-audio';
const LOCAL_KEY = 'hirewave_recruiter_submissions';
const PENDING_AUDIO_META_KEY = 'hirewave_pending_audio_meta';

function restHeaders(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  };
}

function publicAudioUrl(objectPath) {
  return `${SUPABASE_URL}/storage/v1/object/public/${AUDIO_BUCKET}/${objectPath}`;
}

function isDurableAudioUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return (
    url.startsWith('http') ||
    url.startsWith('gdrive://') ||
    url.startsWith('firebase://')
  );
}

function isDataAudio(url) {
  return typeof url === 'string' && url.startsWith('data:');
}

/** Convert data-URL or raw base64 into binary for Storage upload */
function base64ToBytes(base64Audio) {
  if (!base64Audio || typeof base64Audio !== 'string') return null;

  let mime = 'audio/webm';
  let b64 = base64Audio;

  if (base64Audio.startsWith('data:')) {
    const comma = base64Audio.indexOf(',');
    if (comma === -1) return null;
    const header = base64Audio.slice(0, comma);
    b64 = base64Audio.slice(comma + 1);
    const mimeMatch = header.match(/data:([^;]+)/);
    if (mimeMatch) mime = mimeMatch[1];
  }

  // Reject tiny / empty payloads (silent placeholders)
  if (b64.length < 400) return null;

  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const ext = mime.includes('wav') ? 'wav' : mime.includes('mpeg') || mime.includes('mp3') ? 'mp3' : 'webm';
    return { bytes, mime, ext };
  } catch (e) {
    console.warn('base64 decode failed:', e);
    return null;
  }
}

function rememberPendingAudioMeta(submissionId) {
  try {
    const list = JSON.parse(localStorage.getItem(PENDING_AUDIO_META_KEY) || '[]');
    const next = [String(submissionId), ...list.filter((id) => id !== String(submissionId))].slice(0, 100);
    localStorage.setItem(PENDING_AUDIO_META_KEY, JSON.stringify(next));
  } catch (e) { }
}

function forgetPendingAudioMeta(submissionId) {
  try {
    const list = JSON.parse(localStorage.getItem(PENDING_AUDIO_META_KEY) || '[]');
    localStorage.setItem(
      PENDING_AUDIO_META_KEY,
      JSON.stringify(list.filter((id) => id !== String(submissionId)))
    );
  } catch (e) { }
}

/**
 * Upload one audio recording to Supabase Storage.
 * Returns public URL or null on failure.
 */
export async function uploadAudioToStorage(base64Audio, { submissionId, questionId, index = 0 } = {}) {
  const parsed = base64ToBytes(base64Audio);
  if (!parsed) return null;

  const safeSub = String(submissionId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeQ = String(questionId || `q${index}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const objectPath = `submissions/${safeSub}/${safeQ}_${Date.now()}.${parsed.ext}`;

  try {
    const controller = new AbortController();
    // 45s — large WAVs on slow mobile networks often exceed the old 2.5s abort
    const timer = setTimeout(() => controller.abort(), 45000);

    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${AUDIO_BUCKET}/${objectPath}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': parsed.mime,
        'x-upsert': 'true',
      },
      body: parsed.bytes,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const publicUrl = publicAudioUrl(objectPath);
      console.log('✅ Audio uploaded directly to Supabase Storage:', publicUrl);
      return publicUrl;
    }
    console.warn('Supabase Storage upload HTTP', res.status, await res.text().catch(() => ''));
  } catch (e) {
    console.warn('Direct Supabase Storage upload error:', e.message);
  }

  return null;
}

/**
 * Replace in-memory base64 / blob URLs with durable public Storage URLs.
 * Never destroys unsynced audio — failed clips stay queued in IndexedDB for retry.
 */
async function hydrateSubmissionAudio(submission, { hardTimeoutMs = 90000 } = {}) {
  const clone = JSON.parse(JSON.stringify(submission));
  const responses = Array.isArray(clone.rawResponses) ? clone.rawResponses : [];

  // Rehydrate any clips that only exist in IndexedDB (e.g. after a reload / failed prior sync)
  try {
    const pendingClips = await listPendingAudioClips(clone.id);
    const byQ = new Map(pendingClips.map((c) => [String(c.questionId), c]));
    for (const resp of responses) {
      const hasSource =
        (resp.base64Audio && resp.base64Audio.length > 400) ||
        isDataAudio(resp.audioUrl) ||
        isDurableAudioUrl(resp.audioUrl);
      if (!hasSource && resp.questionId && byQ.has(String(resp.questionId))) {
        resp.base64Audio = byQ.get(String(resp.questionId)).base64Audio;
      }
    }
  } catch (e) { }

  const audioUploadWork = Promise.all(
    responses.map(async (resp, i) => {
      const source =
        resp.base64Audio ||
        (isDataAudio(resp.audioUrl) ? resp.audioUrl : null);

      if (!source) {
        if (resp.audioUrl && (String(resp.audioUrl).startsWith('blob:') || isDataAudio(resp.audioUrl))) {
          resp.audioUrl = isDurableAudioUrl(resp.audioUrl) ? resp.audioUrl : '';
          resp.base64Audio = '';
          resp.audioStored = false;
        }
        return;
      }

      // Keep durable local copy until upload succeeds
      await savePendingAudioClip({
        submissionId: clone.id,
        questionId: resp.questionId || `q${i}`,
        index: i,
        base64Audio: source,
      });
      rememberPendingAudioMeta(clone.id);

      // ── Tier 0: Google Drive ──────────────────────────────────────────────
      try {
        const driveRef = await uploadAudioToDrive(source, {
          submissionId: clone.id,
          questionId: resp.questionId,
          index: i,
        });

        if (driveRef) {
          resp.audioUrl = driveRef;
          resp.base64Audio = '';
          resp.audioStored = true;
          resp._audioStorage = 'Google Drive';
          await removePendingAudioClip(clone.id, resp.questionId || `q${i}`);
          console.log(`☁️ Audio stored on Google Drive: ${driveRef}`);
          return;
        }
      } catch (driveErr) {
        console.warn(`Google Drive upload failed for clip ${i}:`, driveErr.message);
      }

      // ── Tier 1: Supabase Storage ─────────────────────────────────────────
      try {
        const publicUrl = await uploadAudioToStorage(source, {
          submissionId: clone.id,
          questionId: resp.questionId,
          index: i,
        });

        if (publicUrl) {
          resp.audioUrl = publicUrl;
          resp.base64Audio = '';
          resp.audioStored = true;
          resp._audioStorage = 'Supabase Storage';
          await removePendingAudioClip(clone.id, resp.questionId || `q${i}`);
          return;
        }
      } catch (storageErr) {
        console.warn(`Supabase Storage upload failed for clip ${i}:`, storageErr.message);
      }

      // ── Tier 2: Firebase RTDB fallback ───────────────────────────────────
      try {
        const firebaseSaved = await saveAudioClipToFirebase(clone.id, resp.questionId, source);
        if (firebaseSaved) {
          resp.audioUrl = `firebase://${clone.id}/${resp.questionId}`;
          resp.audioStored = true;
          resp._audioStorage = 'Firebase RTDB';
          resp.base64Audio = '';
          await removePendingAudioClip(clone.id, resp.questionId || `q${i}`);
          console.log(`🔥 Audio clip saved to Firebase fallback: ${resp.audioUrl}`);
          return;
        }
      } catch (e) {
        console.warn(`Firebase audio fallback failed for clip ${i}:`, e?.message || e);
      }

      // Keep base64 in memory for a later retry — do NOT wipe unsynced audio.
      resp.audioUrl = isDurableAudioUrl(resp.audioUrl) ? resp.audioUrl : '';
      resp.base64Audio = source;
      resp.audioStored = false;
      resp._audioStorage = 'pending-local';
    })
  );

  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      console.warn(`⚠️ Audio hydration timed out after ${hardTimeoutMs}ms — metadata save continues; unsynced clips kept in IndexedDB`);
      resolve('TIMEOUT');
    }, hardTimeoutMs);
  });

  const result = await Promise.race([audioUploadWork, timeoutPromise]);

  if (result === 'TIMEOUT') {
    // On timeout: do NOT destroy pending base64 — IndexedDB holds the durable copy.
    responses.forEach((resp) => {
      if (!isDurableAudioUrl(resp.audioUrl) && (resp.base64Audio || isDataAudio(resp.audioUrl))) {
        resp.audioStored = false;
        resp._audioStorage = 'pending-local';
      }
    });
  }

  if (clone.evaluation?.evaluatedQuestions) {
    clone.evaluation.evaluatedQuestions = clone.evaluation.evaluatedQuestions.map((q, i) => ({
      ...q,
      audioUrl: isDurableAudioUrl(responses[i]?.audioUrl)
        ? responses[i].audioUrl
        : (isDurableAudioUrl(q.audioUrl) ? q.audioUrl : ''),
    }));
  }

  const pendingLeft = responses.some(
    (r) => !isDurableAudioUrl(r.audioUrl) && (r.base64Audio || r._audioStorage === 'pending-local' || r.audioStored === false)
  );
  // If every response already has a durable URL, pending is cleared even if base64 was stripped for DB payload
  const allDurable =
    responses.length > 0 &&
    responses.every((r) => isDurableAudioUrl(r.audioUrl));
  if (!pendingLeft || allDurable) forgetPendingAudioMeta(clone.id);

  clone.rawResponses = responses.map((r) => ({
    ...r,
    // Never put multi-MB base64 into Supabase JSON rows
    base64Audio: '',
    audioUrl: isDurableAudioUrl(r.audioUrl) ? r.audioUrl : '',
    audioStored: isDurableAudioUrl(r.audioUrl),
  }));
  clone._audioPending = allDurable ? false : pendingLeft;
  return clone;
}


export { getCacheSyncMeta, clearSubmissionsCache };

export async function loadAllCachedSubmissionsAsync() {
  const idbList = await getAllCachedSubmissions();
  if (Array.isArray(idbList) && idbList.length > 0) {
    return idbList;
  }
  return readLocalCache();
}

function cacheLocally(list) {
  if (!Array.isArray(list) || list.length === 0) return;
  // 1. Save all candidates to IndexedDB (no 5MB limit, scales to thousands)
  saveSubmissionsToCache(list).catch(() => {});

  // 2. Synchronously save top 300 to localStorage for immediate UI render on first frame
  try {
    const slim = list.slice(0, 300).map((s) => ({
      ...s,
      candidate: s.candidate ? {
        fullName: s.candidate.fullName || s.candidate.name || '',
        email: s.candidate.email || '',
        phone: s.candidate.phone || s.candidate.phoneNumber || '',
        currentLocation: s.candidate.currentLocation || s.candidate.location || '',
        experienceLevel: s.candidate.experienceLevel || '',
        resumeFileName: s.candidate.resumeFileName || '',
      } : s.candidate,
      rawResponses: (s.rawResponses || []).map((r) => ({
        questionId: r.questionId,
        audioUrl: (r.audioUrl && String(r.audioUrl).startsWith('data:')) ? '' : r.audioUrl,
        audioStored: r.audioStored,
      })),
    }));
    localStorage.setItem(LOCAL_KEY, JSON.stringify(slim));
  } catch (e) {
    console.warn('localStorage sync fallback skipped:', e?.message || e);
  }
}

function mergeSubmissionLists(...lists) {
  const mapById = new Map();
  lists.flat().forEach((s) => {
    if (!s || !s.id) return;
    const prev = mapById.get(s.id);
    if (!prev) {
      mapById.set(s.id, s);
      return;
    }
    // Prefer the copy that has more durable audio URLs / newer audio update
    const prevAudio = (prev.rawResponses || []).filter((r) => isDurableAudioUrl(r.audioUrl)).length;
    const nextAudio = (s.rawResponses || []).filter((r) => isDurableAudioUrl(r.audioUrl)).length;
    const prevTime = new Date(prev._audioUpdatedAt || prev.submittedAt || prev._createdAt || 0).getTime();
    const nextTime = new Date(s._audioUpdatedAt || s.submittedAt || s._createdAt || 0).getTime();

    // Always keep the most recent recruiterFeedback between the two copies
    const prevFb = prev.recruiterFeedback;
    const nextFb = s.recruiterFeedback;
    let bestFeedback = prevFb;
    if (nextFb && nextFb.updatedAt) {
      if (!prevFb || !prevFb.updatedAt || new Date(nextFb.updatedAt) >= new Date(prevFb.updatedAt)) {
        bestFeedback = nextFb;
      }
    }

    if (nextAudio > prevAudio || (nextAudio === prevAudio && nextTime >= prevTime)) {
      mapById.set(s.id, {
        ...prev,
        ...s,
        rawResponses: s.rawResponses?.length ? s.rawResponses : prev.rawResponses,
        recruiterFeedback: bestFeedback || prev.recruiterFeedback || s.recruiterFeedback,
      });
    } else {
      // Keep prev but still update feedback if newer
      if (bestFeedback) {
        mapById.set(s.id, { ...prev, recruiterFeedback: bestFeedback });
      }
    }
  });

  return Array.from(mapById.values()).sort((a, b) => {
    const timeA = new Date(a.submittedAt || a._createdAt || 0).getTime();
    const timeB = new Date(b.submittedAt || b._createdAt || 0).getTime();
    return timeB - timeA;
  });
}

export function readLocalCache() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
  } catch {
    return [];
  }
}

/**
 * Helper to fetch from any Supabase project by URL+key.
 * Returns parsed submissions array or [].
 */
async function fetchFromSupabase(url, anonKey, label = 'Supabase', { limit = 1500, sinceTimestamp = null } = {}) {
  // If this is the known dead Supabase project, use a very short 1.2s timeout
  // so it never blocks the fast Firebase load.
  const isDeadProject = url === OLD_SUPABASE_URL;
  const timeoutMs = isDeadProject ? 1200 : 7000;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let queryUrl = `${url}/rest/v1/submissions?select=id,email,data,created_at&order=created_at.desc&limit=${limit}`;
    if (sinceTimestamp) {
      queryUrl += `&created_at=gt.${encodeURIComponent(sinceTimestamp)}`;
    }

    const res = await fetch(queryUrl, {
      method: 'GET',
      headers: restHeaders(anonKey, {
        'Cache-Control': 'no-cache',
        Accept: 'application/json',
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const rows = await res.json();
      return (Array.isArray(rows) ? rows : [])
        .map((row) => {
          if (!row?.data) return null;
          const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          return {
            ...data,
            id: data.id || row.id,
            _dbId: row.id,
            _createdAt: row.created_at || data.submittedAt || data._createdAt,
            _storageOrigin: label,
          };
        })
        .filter(Boolean);
    }
  } catch (e) {
    // Silent fail for dead Supabase
    if (!isDeadProject) {
      console.warn(`${label} fetch error:`, e.message);
    }
  }
  return [];
}

export async function fetchSubmissionsFromCloud({ forceRefresh = false, deltaOnly = false } = {}) {
  const isLocalHost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );

  // Load existing cached records (from IndexedDB or memory/localStorage)
  const cachedFromDb = await loadAllCachedSubmissionsAsync();
  const localCache = (cachedFromDb.length > 0 ? cachedFromDb : readLocalCache()).map((s) => ({
    ...s,
    _storageOrigin: s._storageOrigin || 'Firebase Cloud',
  }));

  // 1. FASTEST: Cloudflare Edge-Cached API (Sub-50ms response)
  try {
    const edgeRes = await fetch('/api/candidates');
    if (edgeRes.ok) {
      const json = await edgeRes.json();
      if (Array.isArray(json.submissions) && json.submissions.length > 0) {
        cacheLocally(json.submissions);
        return json.submissions;
      }
    }
  } catch (e) {
    console.warn('Edge candidates API fallback:', e);
  }

  // 2. PRIMARY FALLBACK: Fetch from Firebase Realtime Database
  try {
    const firebaseSubmissions = await fetchSubmissionsFromFirebase({
      forceFull: forceRefresh,
      cachedSubmissions: localCache,
    });

    if (Array.isArray(firebaseSubmissions) && firebaseSubmissions.length > 0) {
      cacheLocally(firebaseSubmissions);
      return firebaseSubmissions;
    }
  } catch (e) {
    console.warn('Firebase primary fetch failed, falling back:', e);
  }

  // 2. BACKUP FALLBACK: Supabase Cloud
  try {
    const supabaseSubs = await fetchFromSupabase(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      'Supabase Cloud',
      { limit: 100 }
    );
    if (Array.isArray(supabaseSubs) && supabaseSubs.length > 0) {
      const merged = mergeSubmissionLists(localCache, supabaseSubs);
      cacheLocally(merged);
      return merged;
    }
  } catch (e) {}

  return localCache;
}

async function patchSubmissionAudio(saveSource, savedDbId, submissionId, audioPayloadData) {
  try {
    await saveSubmissionToFirebase(audioPayloadData);
    console.log('✅ Phase 2: Audio URLs patched into Firebase Realtime Database');
    return true;
  } catch (e) {
    console.warn('Phase 2 Firebase patch error:', e.message);
  }
  return true;
}

export async function saveSubmissionToCloud(newSubmission) {
  const isLocalHost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );

  // Queue every clip to IndexedDB BEFORE any network call so a closed tab cannot wipe audio.
  if (Array.isArray(newSubmission.rawResponses)) {
    await Promise.all(
      newSubmission.rawResponses.map((r, i) => {
        const source =
          r.base64Audio ||
          (isDataAudio(r.audioUrl) ? r.audioUrl : null);
        if (!source || !r.questionId) return null;
        return savePendingAudioClip({
          submissionId: newSubmission.id,
          questionId: r.questionId,
          index: i,
          base64Audio: source,
        });
      })
    );
    rememberPendingAudioMeta(newSubmission.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: IMMEDIATE METADATA SAVE (guarantees candidate row is NEVER lost)
  // ═══════════════════════════════════════════════════════════════════════════

  const metadataClone = JSON.parse(JSON.stringify(newSubmission));
  if (Array.isArray(metadataClone.rawResponses)) {
    metadataClone.rawResponses = metadataClone.rawResponses.map((r) => ({
      ...r,
      base64Audio: '',
      audioUrl: isDurableAudioUrl(r.audioUrl) ? r.audioUrl : '',
      audioStored: isDurableAudioUrl(r.audioUrl),
      _audioStorage: isDurableAudioUrl(r.audioUrl) ? (r._audioStorage || 'pre-uploaded') : 'pending',
    }));
  }
  if (metadataClone.evaluation?.evaluatedQuestions) {
    metadataClone.evaluation.evaluatedQuestions = metadataClone.evaluation.evaluatedQuestions.map((q) => ({
      ...q,
      audioUrl: isDurableAudioUrl(q.audioUrl) ? q.audioUrl : '',
    }));
  }
  metadataClone._audioPending = true;

  const metadataPayload = {
    email: metadataClone.candidate?.email || null,
    data: metadataClone,
  };

  let success = false;
  let saveSource = 'Firebase Cloud';
  let errorMessage = '';
  let savedDbId = null;

  // Tier 1: Primary Firebase Realtime Database
  try {
    const fbResult = await saveSubmissionToFirebase(metadataClone);
    if (fbResult.success) {
      success = true;
      saveSource = 'Firebase Cloud';
      metadataClone._storageOrigin = 'Firebase Cloud';
      console.log('✅ Phase 1: Candidate metadata saved to Firebase Cloud!');
      // Asynchronously backup to MongoDB and Supabase
      saveSubmissionToMongo(metadataClone).catch(() => { });
      fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
        method: 'POST',
        headers: restHeaders(SUPABASE_ANON_KEY, {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        }),
        body: JSON.stringify(metadataPayload),
      }).catch(() => { });
    }
  } catch (fbErr) {
    console.warn('Firebase metadata save error:', fbErr);
  }

  // Tier 2: Supabase fallback
  if (!success) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
        method: 'POST',
        headers: restHeaders(SUPABASE_ANON_KEY, {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        }),
        body: JSON.stringify(metadataPayload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        success = true;
        saveSource = 'Supabase Cloud';
        metadataClone._storageOrigin = 'Supabase Cloud';
      }
    } catch (e) {
      errorMessage = e.message || String(e);
    }
  }

  // Tier 3: MongoDB Atlas fallback
  if (!success) {
    try {
      console.log('🍃 Attempting fallback metadata save to MongoDB Atlas...');
      const mongoResult = await saveSubmissionToMongo(metadataClone);
      if (mongoResult.success) {
        success = true;
        saveSource = 'MongoDB Atlas';
        metadataClone._storageOrigin = 'MongoDB Atlas';
        console.log('✅ Phase 1: Candidate metadata saved to MongoDB Atlas!');
      }
    } catch (mongoErr) {
      console.warn('MongoDB metadata save error:', mongoErr);
    }
  }

  // Tier 4: Local Backup Server (localhost only)
  if (!success && isLocalHost) {
    try {
      const backupRes = await fetch(`${BACKEND_API_URL}/backup-submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadataPayload),
      });
      if (backupRes.ok) {
        const backupData = await backupRes.json();
        if (backupData.success) {
          success = true;
          saveSource = 'Backup Server';
          metadataClone._storageOrigin = 'Backup Server';
        }
      }
    } catch (backupErr) { }
  }

  // Tier 4: Pending Queue (shell payload; audio lives in IndexedDB)
  if (!success) {
    try {
      const pendingQueue = JSON.parse(localStorage.getItem('hirewave_pending_cloud_sync')) || [];
      const slimForQueue = {
        ...newSubmission,
        rawResponses: (newSubmission.rawResponses || []).map((r) => ({
          ...r,
          base64Audio: '',
        })),
      };
      const updatedQueue = [slimForQueue, ...pendingQueue.filter((p) => p.id !== newSubmission.id)];
      localStorage.setItem('hirewave_pending_cloud_sync', JSON.stringify(updatedQueue));
    } catch (e) { }
  } else {
    try {
      const pendingQueue = JSON.parse(localStorage.getItem('hirewave_pending_cloud_sync')) || [];
      const filtered = pendingQueue.filter((p) => p.id !== newSubmission.id);
      localStorage.setItem('hirewave_pending_cloud_sync', JSON.stringify(filtered));
    } catch (e) { }
  }

  // Always update local cache so this device's dashboard shows the candidate immediately
  try {
    const existing = readLocalCache();
    const filtered = existing.filter((item) => item.id !== metadataClone.id);
    cacheLocally([metadataClone, ...filtered].slice(0, 200));
  } catch (e) { }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: AUDIO UPLOAD — awaited so we don't rely on tab staying open forever
  // ═══════════════════════════════════════════════════════════════════════════

  let audioSynced = false;
  let prepared = metadataClone;

  if (success) {
    try {
      console.log('🎙️ Phase 2: Starting audio upload...');
      prepared = await hydrateSubmissionAudio(newSubmission, { hardTimeoutMs: 90000 });

      const audioPayloadData = {
        ...prepared,
        _storageOrigin: saveSource,
        _audioUpdatedAt: new Date().toISOString(),
        _dbId: savedDbId || metadataClone._dbId,
      };

      audioSynced = !prepared._audioPending;
      await patchSubmissionAudio(saveSource, savedDbId, newSubmission.id, audioPayloadData);
      saveSubmissionToFirebase(audioPayloadData).catch(() => { });

      try {
        const existing = readLocalCache();
        const updatedCache = existing.map((item) =>
          item.id === audioPayloadData.id ? audioPayloadData : item
        );
        cacheLocally(updatedCache);
      } catch (e) { }

      console.log(audioSynced
        ? '✅ Phase 2: All audio clips synced'
        : '⚠️ Phase 2: Some audio still pending — will retry from IndexedDB');
    } catch (audioErr) {
      console.warn('⚠️ Phase 2 audio upload failed (metadata is safe):', audioErr.message);
      rememberPendingAudioMeta(newSubmission.id);
    }
  }

  // Non-blocking real-time webhook dispatch to external platforms & ATS
  if (success && prepared) {
    dispatchCandidateToExternalWebhook(prepared).catch(() => {});
  }

  return {
    success,
    submission: prepared,
    source: saveSource,
    audioSynced,
    error: success ? null : (errorMessage || 'Remote save failed'),
  };
}

/**
 * Retry any clips still sitting in IndexedDB and patch their submissions.
 */
export async function retryPendingAudioUploads() {
  try {
    const metaIds = JSON.parse(localStorage.getItem(PENDING_AUDIO_META_KEY) || '[]');
    const allClips = await listPendingAudioClips();
    const submissionIds = Array.from(
      new Set([
        ...metaIds.map(String),
        ...allClips.map((c) => String(c.submissionId)),
      ])
    );

    if (submissionIds.length === 0) return { retried: 0 };

    let retried = 0;
    const cache = readLocalCache();

    for (const submissionId of submissionIds) {
      const clips = allClips.filter((c) => String(c.submissionId) === String(submissionId));
      if (clips.length === 0) {
        forgetPendingAudioMeta(submissionId);
        continue;
      }

      const cached = cache.find((s) => String(s.id) === String(submissionId));
      // Never invent a metadata-less shell mid-flight — wait until a real submission exists.
      if (!cached || !cached.candidate) {
        continue;
      }

      const byQ = new Map(clips.map((c) => [String(c.questionId), c]));
      const rawResponses = (cached.rawResponses || []).map((r) => {
        const pending = byQ.get(String(r.questionId));
        if (pending && !isDurableAudioUrl(r.audioUrl)) {
          return { ...r, base64Audio: pending.base64Audio };
        }
        return r;
      });

      for (const clip of clips) {
        if (!rawResponses.some((r) => String(r.questionId) === String(clip.questionId))) {
          rawResponses.push({
            questionId: clip.questionId,
            base64Audio: clip.base64Audio,
            audioUrl: '',
            audioStored: false,
          });
        }
      }

      const hydrated = await hydrateSubmissionAudio(
        { ...cached, id: submissionId, rawResponses },
        { hardTimeoutMs: 60000 }
      );

      await patchSubmissionAudio(
        cached._storageOrigin === 'Firebase Cloud' ? 'Firebase Cloud' : 'Supabase Cloud',
        cached._dbId,
        submissionId,
        { ...hydrated, _audioUpdatedAt: new Date().toISOString() }
      );

      const stillPending = await listPendingAudioClips(submissionId);
      if (stillPending.length === 0) forgetPendingAudioMeta(submissionId);
      retried += 1;
    }

    return { retried };
  } catch (e) {
    console.warn('retryPendingAudioUploads failed:', e?.message || e);
    return { retried: 0, error: e?.message || String(e) };
  }
}


export async function retryPendingSubmissions() {
  try {
    const pendingQueue = JSON.parse(localStorage.getItem('hirewave_pending_cloud_sync')) || [];
    if (pendingQueue.length > 0) {
      console.log(`🔄 Retrying ${pendingQueue.length} pending submissions in queue...`);
      for (const item of pendingQueue) {
        const clips = await listPendingAudioClips(item.id);
        if (clips.length && Array.isArray(item.rawResponses)) {
          const byQ = new Map(clips.map((c) => [String(c.questionId), c]));
          item.rawResponses = item.rawResponses.map((r) => {
            const pending = byQ.get(String(r.questionId));
            if (pending && !isDurableAudioUrl(r.audioUrl)) {
              return { ...r, base64Audio: pending.base64Audio };
            }
            return r;
          });
        }
        const res = await saveSubmissionToCloud(item);
        if (res.success) {
          console.log(`✅ Successfully retried and uploaded pending submission ${item.id}`);
        }
      }
    }
  } catch (e) { }

  // Always attempt orphaned audio sync (covers Phase-1-ok / Phase-2-failed cases)
  await retryPendingAudioUploads();
}


export async function checkEmailSubmittedInCloud(email, authKey) {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();

  // 1. Fast zero-network check via localStorage
  try {
    if (localStorage.getItem(`hirewave_completed_submission_${cleanEmail}`) === 'true') {
      return true;
    }
  } catch (e) { }

  // 2. Fast zero-network check via local submissions cache
  try {
    const cached = readLocalCache();
    if (cached.some((sub) => sub.candidate?.email?.toLowerCase().trim() === cleanEmail && (!authKey || sub.authKey === authKey))) {
      return true;
    }
  } catch (e) { }

  // 3. Lightweight Supabase query (< 100 bytes)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/submissions?email=eq.${encodeURIComponent(cleanEmail)}&select=id&limit=1`, {
      headers: restHeaders(SUPABASE_ANON_KEY),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) return true;
    }
  } catch (e) { }

  // 4. Ultra-lightweight Firebase check fallback (50 bytes from /email_index)
  try {
    const inFirebase = await checkEmailInFirebase(cleanEmail);
    if (inFirebase) return true;
  } catch (e) { }

  return false;
}


export function clearCloudSubmissions() {
  localStorage.removeItem(LOCAL_KEY);
}

/**
 * Update an existing submission row in Supabase REST database & local cache.
 * Falls back to Firebase if Supabase PATCH fails or matches 0 rows.
 */
export async function updateSubmissionInCloud(submissionId, updatedData) {
  if (!submissionId) return false;

  // Strip large base64 audio from the update payload to avoid quota issues
  const cleanData = JSON.parse(JSON.stringify(updatedData));
  if (Array.isArray(cleanData.rawResponses)) {
    cleanData.rawResponses = cleanData.rawResponses.map((r) => ({
      ...r,
      base64Audio: '',
      audioUrl: (r.audioUrl && String(r.audioUrl).startsWith('data:')) ? '' : (r.audioUrl || ''),
    }));
  }

  // Always update local cache immediately
  try {
    const existing = readLocalCache();
    const updatedCache = existing.map((item) => (item.id === submissionId || item._dbId === submissionId ? cleanData : item));
    cacheLocally(updatedCache);
  } catch (e) { }

  const dbId = cleanData._dbId;
  const email = cleanData.candidate?.email || cleanData.email;

  const urlsToTry = [];
  if (dbId) urlsToTry.push(`${SUPABASE_URL}/rest/v1/submissions?id=eq.${dbId}`);
  urlsToTry.push(`${SUPABASE_URL}/rest/v1/submissions?data->>id=eq.${submissionId}`);
  if (email) urlsToTry.push(`${SUPABASE_URL}/rest/v1/submissions?email=eq.${encodeURIComponent(email)}`);

  const payload = JSON.stringify({ data: cleanData });
  let supabaseSaved = false;

  for (const targetUrl of urlsToTry) {
    if (supabaseSaved) break;
    try {
      const res = await fetch(targetUrl, {
        method: 'PATCH',
        headers: restHeaders(SUPABASE_ANON_KEY, {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        }),
        body: payload,
      });

      if (res.ok) {
        // Supabase returns 200 even when 0 rows matched — check response body
        try {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0) {
            console.log('✅ Updated submission in Supabase cloud:', submissionId);
            supabaseSaved = true;
          } else {
            console.warn('⚠️ Supabase PATCH returned 0 rows for:', targetUrl);
          }
        } catch (parseErr) {
          // If we can't parse, assume it worked (some configs don't return body)
          supabaseSaved = true;
        }
      }
    } catch (e) {
      console.warn('Failed updating submission in Supabase:', e);
    }
  }

  // Always save feedback to Firebase + MongoDB as backup (even if Supabase succeeded)
  const backupSaves = [
    saveSubmissionToFirebase(cleanData).then(() => {
      if (!supabaseSaved) console.log('🔥 Feedback saved to Firebase as fallback for:', submissionId);
      return true;
    }).catch((fbErr) => {
      console.warn('Firebase feedback fallback failed:', fbErr?.message || fbErr);
      return false;
    }),
    updateSubmissionInMongo(submissionId, cleanData).then((ok) => {
      if (ok && !supabaseSaved) console.log('🍃 Feedback saved to MongoDB as fallback for:', submissionId);
      return ok;
    }).catch(() => false),
  ];

  const [fbOk, mongoOk] = await Promise.all(backupSaves);

  return supabaseSaved || fbOk || mongoOk;
}

export function getSupabaseConfig() {
  return {
    url: SUPABASE_URL,
    bucket: AUDIO_BUCKET,
  };
}
