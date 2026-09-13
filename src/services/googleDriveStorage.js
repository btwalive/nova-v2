/**
 * Google Drive Audio Storage — Browser-Side Direct Upload
 *
 * Uses the Web Crypto API (same approach as the project's existing oauth.js)
 * to sign a JWT with the Service Account private key, exchange it for an
 * access token, then upload audio files directly to Google Drive.
 *
 * ✅ Works in local `npm run dev` — no serverless function / Vercel CLI needed
 * ✅ Works in production Vercel deployment
 * ✅ Files stored as "anyoneWithLink" → play in <audio> with zero extra setup
 *
 * Storage reference format stored in DB: "gdrive://FILE_ID"
 * Resolved to streaming URL: "https://drive.google.com/uc?id=FILE_ID&export=download"
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ENV VARS (set in .env + .env.local):
 *
 *   VITE_GOOGLE_DRIVE_ENABLED=true
 *   VITE_GOOGLE_DRIVE_FOLDER_ID=<optional folder ID>
 *
 * .env.local (gitignored — never commit!):
 *   VITE_GOOGLE_SERVICE_ACCOUNT_JSON=<full service account JSON on one line>
 *
 * Production (Vercel Dashboard → Environment Variables):
 *   VITE_GOOGLE_SERVICE_ACCOUNT_JSON=<same value>
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Config ──────────────────────────────────────────────────────────────────

const DRIVE_ENABLED =
  import.meta.env.VITE_GOOGLE_DRIVE_ENABLED !== 'false' &&
  import.meta.env.VITE_GOOGLE_DRIVE_ENABLED !== '0';

const FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || '';

// Parse service account once at module load
let _serviceAccount = null;
try {
  const raw = import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw) _serviceAccount = JSON.parse(raw);
} catch (e) {
  console.warn('[GoogleDrive] Could not parse VITE_GOOGLE_SERVICE_ACCOUNT_JSON:', e.message);
}

// ─── Web Crypto JWT Helpers (adapted from project oauth.js pattern) ───────────

/** Base64URL encode a string (browser btoa + URL-safe char replacement) */
function btoaUrl(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Base64URL encode an ArrayBuffer (for the RS256 signature) */
function arrayBufferToBase64url(buffer) {
  return btoaUrl(String.fromCharCode.apply(null, new Uint8Array(buffer)));
}

/**
 * Sign a string with an RSA-SHA256 private key (PEM pkcs8 format).
 * Uses browser Web Crypto API — same as the project's existing oauth.js.
 */
async function signWithPrivateKey(pemKey, data) {
  // Strip PEM header/footer and decode to binary
  const pemContents = pemKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '');

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  // Import the raw PKCS8 key
  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign and return base64url-encoded signature
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(data)
  );

  return arrayBufferToBase64url(signature);
}

/**
 * Build a signed JWT for the Google OAuth2 token endpoint.
 * Scope: drive.file (can only see files this app creates — minimal access)
 */
async function buildJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);

  const header  = btoaUrl(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoaUrl(JSON.stringify({
    iss:  serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud:  serviceAccount.token_uri || 'https://oauth2.googleapis.com/token',
    iat:  now,
    exp:  now + 3600,
  }));

  const unsigned  = `${header}.${payload}`;
  const signature = await signWithPrivateKey(serviceAccount.private_key, unsigned);
  return `${unsigned}.${signature}`;
}

// ─── Token Cache (avoid re-authenticating on every clip) ─────────────────────

let _cachedToken  = null;
let _tokenExpires = 0; // Unix timestamp (seconds)

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (_cachedToken && now < _tokenExpires - 120) {
    return _cachedToken; // Reuse token if >2 minutes remaining
  }

  // Option 1: User OAuth Refresh Token (bypasses 0 MB Service Account quota on 15 TB Drive)
  const userClientId     = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
  const userClientSecret = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_SECRET;
  const userRefreshToken = import.meta.env.VITE_GOOGLE_OAUTH_REFRESH_TOKEN;

  if (userClientId && userClientSecret && userRefreshToken) {
    console.log('[GoogleDrive] Refreshing Access Token using User OAuth Refresh Token...');
    const params = new URLSearchParams({
      client_id: userClientId,
      client_secret: userClientSecret,
      refresh_token: userRefreshToken,
      grant_type: 'refresh_token',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.access_token) {
        _cachedToken  = data.access_token;
        _tokenExpires = now + (data.expires_in || 3600);
        console.log('[GoogleDrive] ✅ User OAuth token refreshed successfully');
        return _cachedToken;
      }
    } else {
      console.warn('[GoogleDrive] User OAuth token refresh failed, falling back to Service Account...');
    }
  }

  // Option 2: Fallback to Service Account JWT
  const jwt = await buildJwt(_serviceAccount);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`[GoogleDrive] OAuth token failed: ${txt}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`[GoogleDrive] No access_token in response: ${JSON.stringify(data)}`);
  }

  _cachedToken  = data.access_token;
  _tokenExpires = now + (data.expires_in || 3600);

  console.log('[GoogleDrive] ✅ Service Account OAuth token obtained successfully');
  return _cachedToken;
}

// ─── Drive Upload ─────────────────────────────────────────────────────────────

/**
 * Upload an audio file to Google Drive using multipart upload.
 * Returns the Drive file object { id, name }.
 */
async function uploadFileToDrive(accessToken, { b64Data, mimeType, fileName, folderId }) {
  const boundary = 'nova_drive_mp_boundary';

  const meta = JSON.stringify({
    name: fileName,
    mimeType,
    ...(folderId ? { parents: [folderId] } : {}),
  });

  // RFC 2046 multipart/related body — metadata part + binary (base64) part
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    meta,
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    'Content-Transfer-Encoding: base64',
    '',
    b64Data,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[GoogleDrive] File upload failed (${res.status}): ${errText}`);
  }

  return await res.json(); // { id, name }
}

/**
 * Set a Drive file's permission to "anyoneWithLink → reader".
 * This is required for the <audio> element to stream without auth.
 */
async function makeFilePublic(accessToken, fileId) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    }
  );

  if (!res.ok) {
    // Non-fatal — file uploaded; recruiter may need to be signed in to play it
    console.warn(`[GoogleDrive] Could not make file public: ${await res.text()}`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Upload a single audio clip to Google Drive.
 *
 * @param {string} base64Audio - data-URL (data:audio/wav;base64,...) or raw base64
 * @param {{ submissionId: string, questionId: string, index?: number }} meta
 * @returns {Promise<string|null>} "gdrive://FILE_ID" reference, or null on failure
 */
export async function uploadAudioToDrive(base64Audio, { submissionId, questionId, index = 0 } = {}) {
  if (!DRIVE_ENABLED) return null;
  if (!base64Audio) return null;

  // Build clean filename
  const safeSub = String(submissionId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeQ   = String(questionId   || `q${index}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const ts      = Date.now();

  // Detect MIME type from data-URL header
  let mimeType = 'audio/wav';
  let ext = 'wav';
  if (base64Audio.startsWith('data:')) {
    const match = base64Audio.match(/^data:([^;]+)/);
    if (match) {
      mimeType = match[1];
      if      (mimeType.includes('webm')) ext = 'webm';
      else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) ext = 'mp3';
      else if (mimeType.includes('ogg')) ext = 'ogg';
    }
  }

  const fileName = `nova_${safeSub}_${safeQ}_${ts}.${ext}`;

  // 1. Primary: Upload via same-origin /api/drive-upload (Zero CORS restrictions in browser)
  try {
    const apiRes = await fetch('/api/drive-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64Audio,
        fileName,
        mimeType,
        folderId: FOLDER_ID || undefined,
      }),
    });

    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data.fileId) {
        console.log(`✅ [Google Drive API] ${fileName} → gdrive://${data.fileId}`);
        return `gdrive://${data.fileId}`;
      }
    }
  } catch (apiErr) {
    console.warn('[GoogleDrive] /api/drive-upload error, trying direct upload:', apiErr.message);
  }

  // 2. Direct Fallback
  try {
    const accessToken = await getAccessToken();
    const b64Data = base64Audio.includes(',') ? base64Audio.split(',')[1] : base64Audio;
    const fileData = await uploadFileToDrive(accessToken, {
      b64Data,
      mimeType,
      fileName,
      folderId: FOLDER_ID || undefined,
    });

    await makeFilePublic(accessToken, fileData.id);
    console.log(`✅ [Google Drive Direct] ${fileData.name} → gdrive://${fileData.id}`);
    return `gdrive://${fileData.id}`;
  } catch (err) {
    console.warn('[GoogleDrive] Upload error (falling back to Supabase/Firebase):', err.message);
    return null;
  }
}

// ─── URL Resolution ───────────────────────────────────────────────────────────

/**
 * Convert a stored "gdrive://FILE_ID" marker to a browser-playable streaming URL.
 */
export async function resolveGDriveUrlAsync(ref) {
  if (!ref || typeof ref !== 'string') return null;
  if (ref.startsWith('gdrive://')) {
    const fileId = ref.replace('gdrive://', '').trim();
    if (!fileId) return null;
    return `/api/drive-stream?id=${fileId}`;
  }
  return ref;
}

export function resolveGDriveUrl(ref) {
  if (!ref || typeof ref !== 'string') return null;
  if (ref.startsWith('gdrive://')) {
    const fileId = ref.replace('gdrive://', '').trim();
    if (!fileId) return null;
    return `/api/drive-stream?id=${fileId}`;
  }
  return ref; // Already a full URL — pass through
}


/** Check if a value is a Google Drive reference marker */
export function isGDriveRef(url) {
  return typeof url === 'string' && url.startsWith('gdrive://');
}

/** Check if Google Drive is configured and enabled */
export function isGDriveEnabled() {
  const hasUserOAuth = !!(import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID && import.meta.env.VITE_GOOGLE_OAUTH_REFRESH_TOKEN);
  const hasServiceAccount = !!(_serviceAccount?.private_key && _serviceAccount?.client_email);
  return DRIVE_ENABLED && (hasUserOAuth || hasServiceAccount);
}
