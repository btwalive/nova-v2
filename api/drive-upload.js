// Vercel Serverless Function: /api/drive-upload
// Uploads candidate voice clips directly to Google Drive (15 TB Storage) via User OAuth.

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

const OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '';
const OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.VITE_GOOGLE_OAUTH_CLIENT_SECRET || '';
const OAUTH_REFRESH_TOKEN = process.env.GOOGLE_OAUTH_REFRESH_TOKEN || process.env.VITE_GOOGLE_OAUTH_REFRESH_TOKEN || '';
const TARGET_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.VITE_GOOGLE_DRIVE_FOLDER_ID || '';

/**
 * Obtain a fresh Google Drive access token using the User OAuth Refresh Token.
 */
async function getAccessToken() {
  const params = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    client_secret: OAUTH_CLIENT_SECRET,
    refresh_token: OAUTH_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OAuth refresh token error (${res.status}): ${err}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('No access_token returned by Google OAuth');
  }

  return data.access_token;
}

/**
 * Upload file to Google Drive using multipart upload.
 */
async function uploadToDrive(accessToken, { b64Data, mimeType, fileName, folderId }) {
  const boundary = 'nova_audio_boundary_3141592653';

  const metaJson = JSON.stringify({
    name: fileName,
    mimeType,
    ...(folderId ? { parents: [folderId] } : {}),
  });

  const bodyParts = [
    `--${boundary}\r\n`,
    `Content-Type: application/json; charset=UTF-8\r\n\r\n`,
    `${metaJson}\r\n`,
    `--${boundary}\r\n`,
    `Content-Type: ${mimeType}\r\n`,
    `Content-Transfer-Encoding: base64\r\n\r\n`,
    `${b64Data}\r\n`,
    `--${boundary}--`,
  ].join('');

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body: bodyParts,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Drive upload failed (${uploadRes.status}): ${errText}`);
  }

  return await uploadRes.json();
}

/**
 * Set public reader permission so audio streams seamlessly.
 */
async function makeFilePublic(accessToken, fileId) {
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
  } catch (e) {
    console.warn('[drive-upload] Could not set public permission:', e.message);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { base64Audio, mimeType = 'audio/wav', fileName, folderId } = req.body || {};

  if (!base64Audio || !fileName) {
    return res.status(400).json({ error: 'Missing required fields: base64Audio, fileName' });
  }

  const b64Data = base64Audio.includes(',') ? base64Audio.split(',')[1] : base64Audio;

  try {
    const accessToken = await getAccessToken();
    const targetFolder = folderId || TARGET_FOLDER_ID;

    const fileData = await uploadToDrive(accessToken, {
      b64Data,
      mimeType,
      fileName,
      folderId: targetFolder,
    });

    await makeFilePublic(accessToken, fileData.id);

    return res.status(200).json({
      success: true,
      fileId: fileData.id,
      gdriveRef: `gdrive://${fileData.id}`,
      fileName: fileData.name,
    });
  } catch (err) {
    console.error('[drive-upload] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
