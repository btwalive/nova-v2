/**
 * IndexedDB store for pending audio clips that must not be lost if
 * cloud upload fails, times out, or the tab closes mid-sync.
 */

const DB_NAME = 'hirewave_pending_audio';
const DB_VERSION = 1;
const STORE = 'clips';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('submissionId', 'submissionId', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

function clipKey(submissionId, questionId) {
  return `${String(submissionId || 'unknown')}::${String(questionId || 'unknown')}`;
}

export async function savePendingAudioClip({ submissionId, questionId, index = 0, base64Audio }) {
  if (!submissionId || !questionId || !base64Audio) return false;
  // Never persist obviously empty / silent placeholders
  if (typeof base64Audio === 'string' && base64Audio.length < 200) return false;

  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).put({
        key: clipKey(submissionId, questionId),
        submissionId: String(submissionId),
        questionId: String(questionId),
        index,
        base64Audio,
        updatedAt: new Date().toISOString(),
      });
    });
    db.close();
    return true;
  } catch (e) {
    console.warn('pendingAudioStore save failed:', e?.message || e);
    return false;
  }
}

export async function removePendingAudioClip(submissionId, questionId) {
  if (!submissionId || !questionId) return;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).delete(clipKey(submissionId, questionId));
    });
    db.close();
  } catch (e) {
    console.warn('pendingAudioStore remove failed:', e?.message || e);
  }
}

export async function listPendingAudioClips(submissionId = null) {
  try {
    const db = await openDb();
    const clips = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = submissionId
        ? store.index('submissionId').getAll(String(submissionId))
        : store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return clips;
  } catch (e) {
    console.warn('pendingAudioStore list failed:', e?.message || e);
    return [];
  }
}

export async function clearPendingAudioForSubmission(submissionId) {
  const clips = await listPendingAudioClips(submissionId);
  await Promise.all(clips.map((c) => removePendingAudioClip(c.submissionId, c.questionId)));
}
