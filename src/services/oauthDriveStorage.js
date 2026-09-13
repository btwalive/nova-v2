/**
 * Google Drive OAuth 2.0 User Token Helper
 * Exchanges Refresh Token for Access Token & uploads directly to user's 15 TB Drive
 */

const FOLDER_ID = '1WkOdrNQYq8IrxAxMykjyHGmsko9T81q3';

export async function getAccessTokenFromRefreshToken(clientId, clientSecret, refreshToken) {
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

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OAuth token refresh failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.access_token;
}

export async function uploadAudioWithUserOAuth({ accessToken, b64Data, mimeType, fileName }) {
  const boundary = 'nova_oauth_boundary';
  const meta = JSON.stringify({
    name: fileName,
    mimeType,
    parents: [FOLDER_ID],
  });

  const body = [
    `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', meta,
    `--${boundary}`, `Content-Type: ${mimeType}`, 'Content-Transfer-Encoding: base64', '', b64Data,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary="${boundary}"` },
      body,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Drive upload failed (${res.status}): ${errText}`);
  }

  const file = await res.json();

  // Make public so <audio> element in Recruiter Dashboard can stream directly
  await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  return {
    fileId: file.id,
    name: file.name,
    url: `https://drive.google.com/uc?id=${file.id}&export=download`,
    ref: `gdrive://${file.id}`,
  };
}
