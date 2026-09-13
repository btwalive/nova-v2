/**
 * IndexedDB persistent store for Candidate Submissions.
 * Eliminates localStorage's 5 MB limit, allowing thousands of candidates
 * to be cached locally and rendered in < 50ms without server strain.
 */

const DB_NAME = 'hirewave_submissions_cache_v2';
const DB_VERSION = 1;
const STORE_NAME = 'submissions';
const META_STORE = 'metadata';

function openSubmissionsDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable in this environment'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('submittedAt', 'submittedAt', { unique: false });
        store.createIndex('_createdAt', '_createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open submissions IndexedDB'));
  });
}

/**
 * Get all cached candidate submissions from IndexedDB.
 */
export async function getAllCachedSubmissions() {
  try {
    const db = await openSubmissionsDb();
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();

    // Sort descending by submission time
    return records.sort((a, b) => {
      const timeA = new Date(a.submittedAt || a._createdAt || 0).getTime();
      const timeB = new Date(b.submittedAt || b._createdAt || 0).getTime();
      return timeB - timeA;
    });
  } catch (e) {
    console.warn('getAllCachedSubmissions failed, fallback to empty:', e?.message || e);
    return [];
  }
}

/**
 * Save or bulk update submissions into IndexedDB.
 * Strips heavy temporary data (like raw base64 data URLs) to keep IndexedDB lean.
 */
export async function saveSubmissionsToCache(submissionsList) {
  if (!Array.isArray(submissionsList) || submissionsList.length === 0) return false;

  try {
    const db = await openSubmissionsDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const metaStore = tx.objectStore(META_STORE);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);

      for (const s of submissionsList) {
        const id = String(s.id || s._dbId || '');
        if (!id) continue;

        const slimItem = {
          ...s,
          id,
          candidate: s.candidate ? {
            ...s.candidate,
            // Keep resume links/names, strip massive data URLs if any
            resumeDataUrl: s.candidate.resumeDataUrl && String(s.candidate.resumeDataUrl).length > 5000 ? '' : s.candidate.resumeDataUrl,
          } : s.candidate,
          rawResponses: (s.rawResponses || []).map((r) => ({
            ...r,
            base64Audio: '',
            audioUrl: (r.audioUrl && String(r.audioUrl).startsWith('data:')) ? '' : r.audioUrl,
          })),
        };

        store.put(slimItem);
      }

      metaStore.put({
        key: 'last_sync',
        timestamp: new Date().toISOString(),
        totalCount: submissionsList.length,
      });
    });

    db.close();
    return true;
  } catch (e) {
    console.warn('saveSubmissionsToCache error:', e?.message || e);
    return false;
  }
}

/**
 * Get sync metadata (last sync timestamp and cached count).
 */
export async function getCacheSyncMeta() {
  try {
    const db = await openSubmissionsDb();
    const meta = await new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readonly');
      const store = tx.objectStore(META_STORE);
      const req = store.get('last_sync');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return meta;
  } catch {
    return null;
  }
}

/**
 * Clear the entire IndexedDB cache (used for force full refresh).
 */
export async function clearSubmissionsCache() {
  try {
    const db = await openSubmissionsDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.objectStore(META_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch (e) {
    console.warn('clearSubmissionsCache error:', e);
    return false;
  }
}
