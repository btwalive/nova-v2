// Vercel Serverless Function: /api/send-assessment-feedback
// Sends candidate assessment evaluation & feedback emails using Resend API on openhire.in domain

/**
 * Generates evaluation metadata and score bands based on star rating
 */
function getEvaluationMetadata(stars, customScore, customFeedback) {
  const rating = Number(stars);

  if (rating >= 3) {
    const scoreVal = customScore || Math.floor(Math.random() * 16) + 60; // 60 - 75
    const cefr = scoreVal >= 75 ? 'C1' : 'B2';
    return {
      stars: rating,
      status: 'Cleared',
      statusLabel: 'Cleared (Shortlisted)',
      statusColor: '#15803d',
      boxBg: '#f0fdf4',
      boxBorder: '#bbf7d0',
      textColor: '#166534',
      cefrScore: `${cefr} (${scoreVal}/100)`,
      scoreNumber: scoreVal,
      subject: 'Update on your Nova Assessment - Next Steps',
      detailsHtml: `
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #166534;"><strong>Status:</strong> <span style="color: #15803d; font-weight: 700;">Cleared (Shortlisted)</span></p>
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #166534;"><strong>Overall Score:</strong> ${cefr} (${scoreVal}/100)</p>
        <p style="margin: 0; font-size: 14px; color: #166534;"><strong>Evaluation:</strong> Meets Required Standard</p>
      `,
      bodyHtml: `
        <p style="font-size: 15px; margin: 0 0 16px 0; color: #4a5568; line-height: 1.6;">
          Great performance! <strong>Your recruiter will get in touch with you shortly</strong> regarding the next steps in the hiring process.
        </p>
      `,
      plainTextDetails: `Status: Cleared (Shortlisted)\nOverall Score: ${cefr} (${scoreVal}/100)\n\nGreat performance! Your recruiter will get in touch with you shortly regarding the next steps.`
    };
  }

  if (rating === 2) {
    const scoreVal = customScore || Math.floor(Math.random() * 16) + 35; // 35 - 50
    const cefr = scoreVal >= 45 ? 'B1' : 'B1-';
    const feedbackText = customFeedback || 'Fluency pacing, grammar precision, and structured elaboration.';
    return {
      stars: rating,
      status: 'Not Cleared',
      statusLabel: 'Not Cleared',
      statusColor: '#e53e3e',
      boxBg: '#f8fafc',
      boxBorder: '#e2e8f0',
      textColor: '#4a5568',
      cefrScore: `${cefr} (${scoreVal}/100)`,
      scoreNumber: scoreVal,
      subject: 'Nova Assessment - Evaluation & Feedback',
      detailsHtml: `
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #4a5568;"><strong>Status:</strong> <span style="color: #e53e3e; font-weight: 600;">Not Cleared</span></p>
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #4a5568;"><strong>Score:</strong> ${cefr} (${scoreVal}/100)</p>
        <p style="margin: 0; font-size: 14px; color: #4a5568;"><strong>Areas for Improvement:</strong> ${feedbackText}</p>
      `,
      bodyHtml: `
        <p style="font-size: 14px; margin: 0 0 20px 0; color: #4a5568; line-height: 1.6;">
          Don't worry — your scores and evaluation profile have been recorded in our talent database. As new opportunities matching your profile and score band become available, our recruitment team will reach out to you on this email address.
        </p>
      `,
      plainTextDetails: `Status: Not Cleared\nScore: ${cefr} (${scoreVal}/100)\nAreas for Improvement: ${feedbackText}\n\nDon't worry — your scores and profile are recorded with us. Once we have openings aligned with your score, we will contact you on this email.`
    };
  }

  // 1 Star
  const scoreVal = customScore || Math.floor(Math.random() * 15) + 30; // 30 - 44
  const cefr = scoreVal >= 38 ? 'A2' : 'A1';
  return {
    stars: 1,
    status: 'Not Cleared',
    statusLabel: 'Not Cleared',
    statusColor: '#e53e3e',
    boxBg: '#f8fafc',
    boxBorder: '#e2e8f0',
    textColor: '#4a5568',
    cefrScore: `${cefr} (${scoreVal}/100)`,
    scoreNumber: scoreVal,
    subject: 'Nova Assessment - Evaluation Update',
    detailsHtml: `
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #4a5568;"><strong>Status:</strong> <span style="color: #e53e3e; font-weight: 600;">Not Cleared</span></p>
      <p style="margin: 0; font-size: 14px; color: #4a5568;"><strong>Score:</strong> ${cefr} (${scoreVal}/100)</p>
    `,
    bodyHtml: `
      <p style="font-size: 14px; margin: 0 0 20px 0; color: #4a5568; line-height: 1.6;">
        Your assessment record has been saved with our talent acquisition team. As suitable roles aligned with your skill band arise in the future, we will keep your profile in consideration and contact you directly.
      </p>
    `,
    plainTextDetails: `Status: Not Cleared\nScore: ${cefr} (${scoreVal}/100)\n\nYour scores and profile are recorded with us. Once we have openings aligned with your score, our team will reach out to you on this email.`
  };
}

/**
 * Builds responsive, clean HTML email matching Zoho/Modern Card aesthetic
 */
function buildHtmlEmail(candidateName, evalData) {
  const name = candidateName && candidateName.trim() ? candidateName.trim() : 'Candidate';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${evalData.subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); text-align: left;">
          
          <!-- Top Multi-color Accent Bar (Red / Green / Blue / Yellow) -->
          <tr>
            <td style="padding: 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="height: 5px; width: 100%;">
                <tr>
                  <td width="25%" style="background-color: #e53e3e; height: 5px;"></td>
                  <td width="25%" style="background-color: #38a169; height: 5px;"></td>
                  <td width="25%" style="background-color: #3182ce; height: 5px;"></td>
                  <td width="25%" style="background-color: #ecc94b; height: 5px;"></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Email Main Body -->
          <tr>
            <td style="padding: 36px 36px 32px 36px;">
              <p style="font-size: 16px; margin: 0 0 16px 0; color: #1a202c; font-weight: 600;">Hello ${name},</p>
              
              <p style="font-size: 15px; margin: 0 0 20px 0; color: #4a5568;">
                Thank you for attending the <strong>Nova Assessment</strong>. Below is the summary of your assessment evaluation.
              </p>

              <!-- Score Details Container -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${evalData.boxBg}; border: 1px solid ${evalData.boxBorder}; border-radius: 6px; padding: 18px 20px; margin: 0 0 22px 0;">
                <tr>
                  <td>
                    ${evalData.detailsHtml}
                  </td>
                </tr>
              </table>

              ${evalData.bodyHtml}

              <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #edf2f7;">
                <p style="font-size: 14px; margin: 0; color: #718096; line-height: 1.5;">
                  Thank you,<br>
                  <strong style="color: #2d3748;">Nova Assessment Team</strong><br>
                  <span style="font-size: 12px; color: #a0aec0;">OpenHire Talent Platform</span>
                </p>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Builds plain text alternative for high anti-spam deliverability
 */
function buildPlainText(candidateName, evalData) {
  const name = candidateName && candidateName.trim() ? candidateName.trim() : 'Candidate';
  return `Hello ${name},\n\nThank you for attending the Nova Assessment.\n\n${evalData.plainTextDetails}\n\nThank you,\nNova Assessment Team\nOpenHire Talent Platform`;
}

// ─── Main API Handler ─────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Nova Assessments <evaluations@openhire.in>';
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL || 'support@openhire.in';

  if (!apiKey) {
    return res.status(500).json({ error: 'RESEND_API_KEY is not configured in environment.' });
  }

  const {
    candidateEmail,
    candidateName,
    ratingStars = 2,
    customScore,
    customFeedback,
  } = req.body || {};

  if (!candidateEmail) {
    return res.status(400).json({ error: 'Missing required field: candidateEmail' });
  }

  try {
    const evalData = getEvaluationMetadata(ratingStars, customScore, customFeedback);
    const htmlContent = buildHtmlEmail(candidateName, evalData);
    const textContent = buildPlainText(candidateName, evalData);

    const payload = {
      from: fromEmail,
      to: [candidateEmail],
      reply_to: replyTo,
      subject: evalData.subject,
      html: htmlContent,
      text: textContent,
      headers: {
        'X-Entity-Ref-ID': `nova-${Date.now()}`,
      },
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const resData = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: resData.message || resData.error || 'Failed to send email via Resend',
        details: resData,
      });
    }

    return res.status(200).json({
      success: true,
      messageId: resData.id,
      recipient: candidateEmail,
      evalData,
    });
  } catch (error) {
    console.error('Error sending assessment email:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while dispatching email',
    });
  }
}
