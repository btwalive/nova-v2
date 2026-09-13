// MongoDB Atlas Data API — Tertiary cloud database backup for candidate submissions
// Uses the Atlas Data API (REST) so it works directly from the browser with no server.
// Docs: https://www.mongodb.com/docs/atlas/app-services/data-api/

const MONGO_APP_ID =
  import.meta.env.VITE_MONGO_APP_ID || '';

const MONGO_API_KEY =
  import.meta.env.VITE_MONGO_API_KEY || '';

const MONGO_DATA_SOURCE =
  import.meta.env.VITE_MONGO_DATA_SOURCE || 'Cluster0';

const MONGO_DATABASE =
  import.meta.env.VITE_MONGO_DATABASE || 'openhire';

const MONGO_COLLECTION = 'submissions';

function getBaseUrl() {
  if (!MONGO_APP_ID) return null;
  return `https://data.mongodb-api.com/app/${MONGO_APP_ID}/endpoint/data/v1`;
}

function isEnabled() {
  return !!(MONGO_APP_ID && MONGO_API_KEY);
}

function mongoHeaders() {
  return {
    'Content-Type': 'application/json',
    'api-key': MONGO_API_KEY,
  };
}

/**
 * Save or upsert a candidate submission document in MongoDB Atlas.
 * Uses upsert to avoid duplicates — if a doc with the same submission ID exists, it's replaced.
 */
export async function saveSubmissionToMongo(submission) {
  if (!isEnabled()) return { success: false, error: 'MongoDB not configured', skipped: true };
  if (!submission || !submission.id) return { success: false, error: 'Invalid submission' };

  const baseUrl = getBaseUrl();

  // Create a clean copy without large base64 audio
  const cleanSubmission = JSON.parse(JSON.stringify(submission));
  if (Array.isArray(cleanSubmission.rawResponses)) {
    cleanSubmission.rawResponses = cleanSubmission.rawResponses.map((r) => ({
      ...r,
      base64Audio: '',
      audioUrl: (r.audioUrl && String(r.audioUrl).startsWith('data:')) ? '' : (r.audioUrl || ''),
    }));
  }
  if (cleanSubmission.candidate?.resumeDataUrl && cleanSubmission.candidate.resumeDataUrl.length > 500000) {
    cleanSubmission.candidate.resumeDataUrl = '';
  }
  cleanSubmission._storageOrigin = 'MongoDB Atlas';
  cleanSubmission._mongoSavedAt = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${baseUrl}/action/replaceOne`, {
      method: 'POST',
      headers: mongoHeaders(),
      body: JSON.stringify({
        dataSource: MONGO_DATA_SOURCE,
        database: MONGO_DATABASE,
        collection: MONGO_COLLECTION,
        filter: { id: submission.id },
        replacement: cleanSubmission,
        upsert: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      console.log('🍃 Submission saved to MongoDB Atlas:', submission.id);
      return { success: true, submission: cleanSubmission, source: 'MongoDB Atlas' };
    }

    const errText = await res.text().catch(() => `HTTP ${res.status}`);
    console.warn('MongoDB Atlas save failed:', res.status, errText);
    return { success: false, error: errText };
  } catch (e) {
    console.warn('MongoDB Atlas save error:', e.message || e);
    return { success: false, error: e.message || String(e) };
  }
}

/**
 * Fetch all candidate submissions from MongoDB Atlas.
 */
export async function fetchSubmissionsFromMongo() {
  if (!isEnabled()) return [];

  const baseUrl = getBaseUrl();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${baseUrl}/action/find`, {
      method: 'POST',
      headers: mongoHeaders(),
      body: JSON.stringify({
        dataSource: MONGO_DATA_SOURCE,
        database: MONGO_DATABASE,
        collection: MONGO_COLLECTION,
        filter: {},
        sort: { submittedAt: -1 },
        limit: 500,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const documents = data?.documents || [];
      const list = documents.map((doc) => ({
        ...doc,
        _storageOrigin: 'MongoDB Atlas',
      }));
      if (list.length > 0) {
        console.log(`🍃 Loaded ${list.length} submissions from MongoDB Atlas`);
      }
      return list;
    }

    console.warn('MongoDB Atlas fetch failed:', res.status);
  } catch (e) {
    console.warn('MongoDB Atlas fetch error:', e.message || e);
  }

  return [];
}

/**
 * Update a submission in MongoDB Atlas (e.g., recruiter feedback).
 */
export async function updateSubmissionInMongo(submissionId, updatedData) {
  if (!isEnabled()) return false;
  if (!submissionId) return false;

  const baseUrl = getBaseUrl();

  // Clean the data
  const cleanData = JSON.parse(JSON.stringify(updatedData));
  if (Array.isArray(cleanData.rawResponses)) {
    cleanData.rawResponses = cleanData.rawResponses.map((r) => ({
      ...r,
      base64Audio: '',
      audioUrl: (r.audioUrl && String(r.audioUrl).startsWith('data:')) ? '' : (r.audioUrl || ''),
    }));
  }
  cleanData._mongoUpdatedAt = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${baseUrl}/action/updateOne`, {
      method: 'POST',
      headers: mongoHeaders(),
      body: JSON.stringify({
        dataSource: MONGO_DATA_SOURCE,
        database: MONGO_DATABASE,
        collection: MONGO_COLLECTION,
        filter: { id: submissionId },
        update: { $set: cleanData },
        upsert: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const result = await res.json();
      if (result?.matchedCount > 0 || result?.upsertedId) {
        console.log('🍃 Updated submission in MongoDB Atlas:', submissionId);
        return true;
      }
    }
  } catch (e) {
    console.warn('MongoDB Atlas update error:', e.message || e);
  }

  return false;
}

export function isMongoEnabled() {
  return isEnabled();
}
