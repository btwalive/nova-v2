// External Integration & Webhook Service
// Connects HireWave / OpenHire voice assessments with external portals, ATS systems, and custom dashboards.

const EXTERNAL_WEBHOOK_URL = import.meta.env.VITE_EXTERNAL_WEBHOOK_URL || '';
const EXTERNAL_WEBHOOK_SECRET = import.meta.env.VITE_EXTERNAL_WEBHOOK_SECRET || '';

/**
 * Format candidate submission into a clean, standardized payload for external systems / ATS
 */
export function formatStandardCandidatePayload(submission) {
  if (!submission) return null;

  const candidate = submission.candidate || {};
  const evalData = submission.evaluation || {};
  const feedback = submission.recruiterFeedback || {};

  return {
    event: 'candidate.test_completed',
    timestamp: submission.submittedAt || submission._createdAt || new Date().toISOString(),
    submissionId: submission.id || submission._dbId,
    authKey: submission.authKey || 'default',
    candidate: {
      fullName: candidate.fullName || candidate.name || '',
      email: candidate.email || submission.email || '',
      phone: candidate.phone || candidate.phoneNumber || '',
      currentLocation: candidate.currentLocation || candidate.location || '',
      experienceLevel: candidate.experienceLevel || '',
      resumeUrl: candidate.resumeUrl || null
    },
    assessment: {
      role: submission.test?.targetRole || 'Voice Assessment',
      testTitle: submission.test?.title || 'Candidate Evaluation',
      overallScore: evalData.overallScore || 0,
      scores: evalData.scores || {},
      recommendation: evalData.recommendation || '',
      strengths: evalData.strengths || [],
      areasForImprovement: evalData.areasForImprovement || [],
      totalAudioClips: submission.rawResponses?.length || 0,
      responses: (submission.rawResponses || []).map((r, idx) => ({
        questionIndex: idx + 1,
        questionId: r.questionId || `q${idx + 1}`,
        questionText: r.questionText || '',
        transcript: r.transcript || '',
        audioUrl: r.audioUrl || '',
        score: r.score || null
      }))
    },
    recruiterFeedback: {
      hiringDecision: feedback.hiringDecision || 'pending',
      rating: feedback.rating || null,
      notes: feedback.notes || '',
      reviewedAt: feedback.updatedAt || null
    }
  };
}

/**
 * Dispatch candidate test completion event to external webhook endpoint (if configured)
 */
export async function dispatchCandidateToExternalWebhook(submission) {
  if (!submission || !submission.id) return { success: false, reason: 'invalid_submission' };

  const webhookUrl = EXTERNAL_WEBHOOK_URL;
  if (!webhookUrl) {
    // No external webhook configured — non-fatal
    return { success: true, bypassed: true };
  }

  const payload = formatStandardCandidatePayload(submission);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(EXTERNAL_WEBHOOK_SECRET ? { 'x-webhook-secret': EXTERNAL_WEBHOOK_SECRET } : {})
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      console.log('📡 Candidate data successfully dispatched to external webhook:', webhookUrl);
      return { success: true, status: res.status };
    } else {
      console.warn('⚠️ External webhook responded with HTTP', res.status);
      return { success: false, status: res.status };
    }
  } catch (err) {
    console.warn('⚠️ Failed to dispatch external webhook:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Emit a browser window postMessage event if running inside an external iframe parent
 */
export function emitParentMessage(type, data) {
  if (typeof window === 'undefined') return;
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        source: 'hirewave_voice_assessment',
        type,
        data,
        timestamp: new Date().toISOString()
      }, '*');
    }
  } catch (e) {
    console.warn('Could not postMessage to parent window:', e);
  }
}
