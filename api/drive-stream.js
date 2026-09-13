// Vercel Serverless Function: /api/drive-stream
// Streams Google Drive audio files directly to the browser with inline playback headers and CORS.

import https from 'https';

export const config = {
  api: {
    responseLimit: false,
  },
};

async function getOAuthAccessToken() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.VITE_GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN || process.env.VITE_GOOGLE_OAUTH_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    try {
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (res.ok) {
        const data = await res.json();
        return data.access_token || null;
      }
    } catch (e) {}
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing file id parameter' });
  }

  const safeFileId = id.replace(/[^a-zA-Z0-9_-]/g, '').trim();
  if (!safeFileId) {
    return res.status(400).json({ error: 'Invalid file id' });
  }

  // 1. Direct CDN streaming
  const driveUrls = [
    `https://drive.usercontent.google.com/download?id=${safeFileId}&export=download`,
    `https://docs.google.com/uc?export=download&id=${safeFileId}`,
  ];

  for (const streamUrl of driveUrls) {
    try {
      const driveRes = await new Promise((resolve, reject) => {
        const driveReq = https.get(streamUrl, (r) => {
          if (r.statusCode === 301 || r.statusCode === 302 || r.statusCode === 303 || r.statusCode === 307) {
            const redirectUrl = r.headers.location;
            if (redirectUrl) {
              https.get(redirectUrl, resolve).on('error', reject);
              return;
            }
          }
          resolve(r);
        });
        driveReq.on('error', reject);
      });

      if (driveRes.statusCode === 200) {
        res.setHeader('Content-Type', driveRes.headers['content-type'] || 'audio/wav');
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, immutable');
        if (driveRes.headers['content-length']) {
          res.setHeader('Content-Length', driveRes.headers['content-length']);
        }
        res.setHeader('Accept-Ranges', 'bytes');
        res.status(200);

        driveRes.pipe(res);
        return;
      }
    } catch (e) {
      console.warn(`Drive stream fetch error for ${safeFileId}:`, e.message);
    }
  }

  // 2. Authenticated API stream fallback
  try {
    const token = await getOAuthAccessToken();
    if (token) {
      const authRes = await new Promise((resolve, reject) => {
        const reqAuth = https.get(`https://www.googleapis.com/drive/v3/files/${safeFileId}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` }
        }, resolve);
        reqAuth.on('error', reject);
      });

      if (authRes.statusCode === 200) {
        res.setHeader('Content-Type', authRes.headers['content-type'] || 'audio/wav');
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, immutable');
        if (authRes.headers['content-length']) {
          res.setHeader('Content-Length', authRes.headers['content-length']);
        }
        res.setHeader('Accept-Ranges', 'bytes');
        res.status(200);
        authRes.pipe(res);
        return;
      }
    }
  } catch (e) {
    console.warn(`Authenticated drive stream error for ${safeFileId}:`, e.message);
  }

  return res.status(502).json({ error: 'Could not retrieve audio from Google Drive' });
}
