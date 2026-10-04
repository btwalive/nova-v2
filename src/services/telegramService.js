/**
 * telegramService.js
 * Client-side integration service to dispatch candidate assessment cards
 * and audio to Telegram recruiters/admins via the serverless /api/telegram-notify endpoint
 * with direct Telegram Bot API fallback.
 */

const API_BASE = (typeof window !== 'undefined' && window.location.hostname.includes('localhost'))
  ? ''
  : (typeof window !== 'undefined' && window.location.origin.includes('vercel.app'))
    ? ''
    : 'https://nova-career-match.vercel.app';

const API_ENDPOINT = `${API_BASE}/api/telegram-notify`;
const DEFAULT_BOT_TOKEN = '8606050984:AAER-JLBUu1AlSzNO-tKQ3IlG9UxDuUyW9g';
const DEFAULT_CHAT_ID = '8472857268';

function sanitizeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Direct Telegram Bot API fallback if /api/telegram-notify is unreachable.
 */
async function directTelegramFallback(submission, options = {}) {
  const botToken = options.botToken || DEFAULT_BOT_TOKEN;
  const chatId = options.chatId || DEFAULT_CHAT_ID;

  const candidate = submission.candidate || {};
  const testInfo = submission.test || {};
  const rawResponses = Array.isArray(submission.rawResponses) ? submission.rawResponses : [];

  const rawName = candidate.fullName || candidate.name || submission.fullName || submission.name || '';
  const email = (candidate.email || submission.email || '').trim();
  const fallbackName = email ? email.split('@')[0].replace(/[._-]/g, ' ') : 'Candidate';
  const fullName = rawName.trim() || fallbackName;
  const phone = (candidate.phone || candidate.phoneNumber || submission.phone || '').trim();
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  const location = candidate.currentLocation || candidate.location || candidate.city || 'Delhi NCR';
  const targetRole = testInfo.targetRole || testInfo.title || submission.targetRole || 'Customer Experience Specialist (Voice)';

  const rawAudioResponses = rawResponses.filter((r) => r.audioUrl || r.base64Audio || r.audioRecordingUrl);
  const audioCount = rawAudioResponses.length || (submission.audioUrl ? 1 : 0);
  const totalAudios = audioCount || (rawResponses.length > 0 ? rawResponses.length : 11);
  const submissionId = String(submission.submissionId || submission.id || submission._dbId || `cand_${Date.now()}`);

  const cardLines = [
    `🎯 <b>NOVA ASSESSMENT — CANDIDATE COMPLETED</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 <b>Candidate:</b> <b>${sanitizeHtml(fullName)}</b>`,
    `💼 <b>Role:</b> ${sanitizeHtml(targetRole)}`,
    phone ? `📱 <b>Phone:</b> ${sanitizeHtml(phone)}` : `📱 <b>Phone:</b> <i>Not provided</i>`,
    `📧 <b>Email:</b> <code>${sanitizeHtml(email || 'Not provided')}</code>`,
    `📍 <b>Location:</b> ${sanitizeHtml(location)}`,
    `🎙️ <b>Assessment Audio:</b> ${totalAudios} recordings completed`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👇 <i>Tap below to stream audios in-bot:</i>`,
  ].filter(Boolean);

  const baseUrl = 'https://nova-career-match.vercel.app';
  const audioIds = rawResponses
    .map((r) => {
      const u = r.audioUrl || r.audioRecordingUrl || '';
      if (u.startsWith('gdrive://')) return u.replace('gdrive://', '');
      const m = u.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (m && m[1]) return m[1];
      return u.startsWith('http') ? u : '';
    })
    .filter(Boolean);
  const audioParam = audioIds.length > 0 ? `&a=${encodeURIComponent(audioIds.join(','))}` : '';
  const playerUrl = `${baseUrl}/audio-player.html?id=${encodeURIComponent(submissionId)}&name=${encodeURIComponent(fullName)}&role=${encodeURIComponent(targetRole)}&phone=${encodeURIComponent(cleanPhone)}&email=${encodeURIComponent(email)}${audioParam}`;

  const inlineKeyboard = [
    [
      {
        text: totalAudios > 0 ? `🎧 Stream Audios (1 to ${totalAudios})` : '🎧 Open Audio Player',
        web_app: {
          url: playerUrl,
        },
      },
    ],
  ];

  if (cleanPhone) {
    inlineKeyboard.push([
      {
        text: '💬 WhatsApp Candidate',
        url: `https://wa.me/${cleanPhone}`,
      },
    ]);
  }

  const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: cardLines.join('\n'),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: inlineKeyboard },
    }),
  });

  const tgData = await tgRes.json().catch(() => ({}));
  if (tgData.ok) {
    console.log('✈️ [Telegram Bot] Candidate card delivered via direct fallback (Msg ID:', tgData.result?.message_id, ')');
    return { success: true, direct: true, messageId: tgData.result?.message_id };
  }
  throw new Error(tgData.description || 'Direct Telegram dispatch failed');
}

/**
 * Dispatches candidate completion event, scorecard, and audio to Telegram.
 * Non-blocking and guaranteed via direct fallback.
 */
export async function dispatchCandidateToTelegram(submission, options = {}) {
  if (!submission) return { success: false, reason: 'no_submission' };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const payload = {
      submission,
      botToken: options.botToken || undefined,
      chatId: options.chatId || undefined,
    };

    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      console.log('✈️ [Telegram Service] Candidate card delivered via serverless endpoint:', data);
      return { success: true, data };
    }

    console.warn(`[Telegram Service] API returned status ${res.status}. Switching to direct Telegram API fallback...`);
    return await directTelegramFallback(submission, options);
  } catch (err) {
    console.warn('[Telegram Service] API failed or timed out. Executing direct Telegram Bot API fallback...', err.message);
    try {
      return await directTelegramFallback(submission, options);
    } catch (fallbackErr) {
      console.error('[Telegram Service] Both API and Direct Telegram Bot fallback failed:', fallbackErr);
      return { success: false, error: fallbackErr.message };
    }
  }
}
