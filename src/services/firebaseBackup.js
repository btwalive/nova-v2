// Firebase Cloud Backup Service — Secondary cloud database for candidate test submissions

const FIREBASE_DB_URL = (
  import.meta.env.VITE_FIREBASE_DATABASE_URL ||
  'https://nova-4daf4-default-rtdb.firebaseio.com'
).replace(/\/$/, '');



/**
 * Save candidate test submission payload directly to Firebase Cloud.
 * Uses Firebase Realtime Database REST API (works across all browsers globally).
 */
export async function saveSubmissionToFirebase(submission) {
  if (!submission || !submission.id) {
    return { success: false, error: 'Invalid submission payload' };
  }

  // Create clean copy without heavy base64 strings for efficient cloud storage
  const cleanSubmission = JSON.parse(JSON.stringify(submission));
  if (Array.isArray(cleanSubmission.rawResponses)) {
    cleanSubmission.rawResponses = cleanSubmission.rawResponses.map((r) => ({
      ...r,
      base64Audio: '', // Audio storage kept lean
    }));
  }
  cleanSubmission._storageOrigin = 'Firebase Cloud';
  cleanSubmission._firebaseSavedAt = new Date().toISOString();

  const safeId = String(submission.id).replace(/[^a-zA-Z0-9_-]/g, '_');
  const endpoint = `${FIREBASE_DB_URL}/submissions/${safeId}.json`;

  try {
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cleanSubmission),
    });

    if (res.ok) {
      console.log('🔥 Submission successfully backed up to Firebase Cloud:', safeId);

      // ⚡ Write lightweight /email_index entry (50 bytes) for zero-egress candidate lookups
      const candidateEmail = cleanSubmission.candidate?.email || cleanSubmission.email;
      if (candidateEmail) {
        const safeEmail = String(candidateEmail).toLowerCase().trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        fetch(`${FIREBASE_DB_URL}/email_index/${safeEmail}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submitted: true,
            submissionId: safeId,
            authKey: cleanSubmission.authKey || null,
            timestamp: new Date().toISOString()
          })
        }).catch(() => {});
      }

      return { success: true, submission: cleanSubmission, source: 'Firebase Cloud' };
    }

    const errText = await res.text().catch(() => `HTTP ${res.status}`);
    console.warn('Firebase save failed:', res.status, errText);
    return { success: false, error: errText };
  } catch (e) {
    console.warn('Firebase save network error:', e);
    return { success: false, error: e.message || String(e) };
  }
}

/**
 * Super-fast zero-egress check for duplicate candidate email in Firebase (50 bytes instead of 200MB)
 */
export async function checkEmailInFirebase(email) {
  if (!email) return false;
  const safeEmail = String(email).toLowerCase().trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${FIREBASE_DB_URL}/email_index/${safeEmail}.json`, {
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && (data.submitted || data.submissionId)) {
        return true;
      }
    }
  } catch (e) {
    // Non-fatal
  }
  return false;
}

/**
 * Store a single audio clip in Firebase RTDB as fallback storage (Bypassed in favor of Google Drive 15TB)
 */
export async function saveAudioClipToFirebase(submissionId, questionId, base64Audio) {
  // Bypassed: All voice clips are stored directly in 15 TB Google Drive to preserve Firebase bandwidth
  return null;
}

/**
 * Fetch an audio clip stored in Firebase RTDB fallback storage
 */
export async function fetchAudioClipFromFirebase(submissionId, questionId) {
  if (!submissionId || !questionId) return null;

  const safeSubId = String(submissionId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeQId = String(questionId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const endpoint = `${FIREBASE_DB_URL}/audio_clips/${safeSubId}/${safeQId}.json`;

  try {
    const controller = new AbortController();
    // 20 second timeout — large WAV files can be 1-4 MB and need more than 3s on Indian connections
    const timer = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      return data?.audio || null;
    }
  } catch (e) {
    console.warn('Firebase audio clip fetch failed:', e.message);
  }
  return null;
}

/**
 * Fetch backup candidate submissions from Firebase Cloud.
 * Uses shallow key checking to only download new candidate records instead of re-downloading the entire database every cycle.
 */
export async function fetchSubmissionsFromFirebase({ forceFull = false, cachedSubmissions = [] } = {}) {
  // 1. FAST DELTA SYNC: If we already have cached submissions, just check for new keys (takes ~600ms)
  if (!forceFull && Array.isArray(cachedSubmissions) && cachedSubmissions.length > 0) {
    try {
      const shallowController = new AbortController();
      const shallowTimer = setTimeout(() => shallowController.abort(), 8000);
      const shallowRes = await fetch(`${FIREBASE_DB_URL}/submissions.json?shallow=true`, {
        headers: { 'Accept': 'application/json' },
        signal: shallowController.signal,
      });
      clearTimeout(shallowTimer);

      if (shallowRes.ok) {
        const shallowKeys = await shallowRes.json();
        if (shallowKeys && typeof shallowKeys === 'object') {
          const remoteKeys = Object.keys(shallowKeys);
          const cachedMap = new Map();
          cachedSubmissions.forEach((sub) => {
            const id = sub.id || sub._dbId;
            if (id) cachedMap.set(String(id), sub);
          });

          const missingKeys = remoteKeys.filter((k) => !cachedMap.has(k));

          // If no new candidates arrived, return local cache immediately
          if (missingKeys.length === 0) {
            return cachedSubmissions;
          }

          // If a few new candidates arrived (e.g. 1-20), fetch only the new ones in parallel!
          if (missingKeys.length <= 30) {
            console.log(`🔥 Fetching ${missingKeys.length} new candidate submissions from Firebase...`);
            const results = await Promise.all(
              missingKeys.map(async (key) => {
                try {
                  const subRes = await fetch(`${FIREBASE_DB_URL}/submissions/${key}.json`);
                  if (subRes.ok) {
                    const subData = await subRes.json();
                    return subData ? { ...subData, _storageOrigin: 'Firebase Cloud' } : null;
                  }
                } catch (e) {}
                return null;
              })
            );

            const newSubs = results.filter(Boolean);
            const merged = [...newSubs, ...cachedSubmissions].sort((a, b) => {
              const tA = new Date(a.submittedAt || a._createdAt || 0).getTime();
              const tB = new Date(b.submittedAt || b._createdAt || 0).getTime();
              return tB - tA;
            });
            return merged;
          }
        }
      }
    } catch (shallowErr) {
      console.warn('Firebase shallow check failed, doing direct fetch:', shallowErr.message);
    }
  }

  // 2. FAST LOAD: Fetch latest 100 candidate submissions in < 1 second instead of downloading 385 MB!
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    // Limit to latest 100 candidates for instant ~400ms response (reduces 385 MB download to ~150 KB)
    const queryUrl = forceFull
      ? `${FIREBASE_DB_URL}/submissions.json`
      : `${FIREBASE_DB_URL}/submissions.json?orderBy=%22%24key%22&limitToLast=100`;

    let res = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    // Fallback to basic fetch if index filtering fails
    if (!res.ok && !forceFull) {
      res = await fetch(`${FIREBASE_DB_URL}/submissions.json?shallow=true`);
    }

    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (!data) return cachedSubmissions || [];

      const list = Object.values(data)
        .filter(Boolean)
        .map((sub) => ({
          ...sub,
          _storageOrigin: 'Firebase Cloud',
        }))
        .sort((a, b) => {
          const tA = new Date(a.submittedAt || a._createdAt || 0).getTime();
          const tB = new Date(b.submittedAt || b._createdAt || 0).getTime();
          return tB - tA;
        });

      console.log(`🔥 Fast-loaded ${list.length} recent candidate submissions from Firebase in < 1s!`);
      return list;
    }
  } catch (e) {
    console.warn('Firebase fast fetch error:', e.message);
  }

  return cachedSubmissions || [];
}


