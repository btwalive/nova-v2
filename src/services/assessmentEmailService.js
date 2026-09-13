// In-memory send lock to prevent duplicate email triggers on rapid clicks (8-second throttle per candidate)
const activeSendLocks = new Map();

/**
 * Sends assessment feedback email to the candidate
 * @param {Object} params
 * @param {string} params.candidateEmail - Recipient email
 * @param {string} [params.candidateName] - Recipient name
 * @param {number} params.ratingStars - 1, 2, or 3 stars
 * @param {number} [params.customScore] - Optional override score (e.g. 62)
 * @param {string} [params.customFeedback] - Optional custom feedback notes
 * @returns {Promise<{success: boolean, messageId?: string, evalData?: Object, error?: string}>}
 */
export async function sendAssessmentFeedbackEmail({
  candidateEmail,
  candidateName = '',
  ratingStars = 2,
  customScore = null,
  customFeedback = ''
}) {
  if (!candidateEmail) {
    return { success: false, error: 'Candidate email is required.' };
  }

  const cleanEmail = candidateEmail.trim().toLowerCase();
  const now = Date.now();
  const lastSent = activeSendLocks.get(cleanEmail);

  // Prevent sending duplicate emails within 8 seconds
  if (lastSent && (now - lastSent) < 8000) {
    console.warn(`[assessmentEmailService] Throttled duplicate email request to ${cleanEmail}`);
    return { success: true, throttled: true, messageId: 'throttled' };
  }

  activeSendLocks.set(cleanEmail, now);

  try {
    const response = await fetch('/api/send-assessment-feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        candidateEmail,
        candidateName,
        ratingStars: Number(ratingStars),
        customScore: customScore ? Number(customScore) : undefined,
        customFeedback: customFeedback || undefined,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to dispatch email.');
    }

    return {
      success: true,
      messageId: data.messageId,
      evalData: data.evalData,
    };
  } catch (error) {
    console.error('[assessmentEmailService] Error:', error);
    return {
      success: false,
      error: error.message || 'Network error while sending feedback email.',
    };
  }
}
