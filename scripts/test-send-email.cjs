const https = require('https');

const apiKey = process.env.RESEND_API_KEY || process.argv[5] || '';
const fromEmail = process.env.RESEND_FROM_EMAIL || 'Nova Assessments <evaluations@openhire.in>';
const replyTo = process.env.RESEND_REPLY_TO_EMAIL || 'support@openhire.in';

const targetEmail = process.argv[2] || 'hirewave@outlook.com';
const candidateName = process.argv[3] || 'Gourav Pandey';
const stars = parseInt(process.argv[4] || '2', 10);

function getEvaluationData(rating) {
  if (rating >= 3) {
    const scoreVal = Math.floor(Math.random() * 16) + 60; // 60 - 75
    return {
      statusText: "Cleared (Shortlisted)",
      subject: "Update on your Nova Assessment - Next Steps",
      boxBg: "#f0fdf4",
      boxBorder: "#bbf7d0",
      detailsHtml: `
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #166534;"><strong>Status:</strong> <span style="color: #15803d; font-weight: 700;">Cleared (Shortlisted)</span></p>
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #166534;"><strong>Overall Score:</strong> B2 (${scoreVal}/100)</p>
        <p style="margin: 0; font-size: 14px; color: #166534;"><strong>Evaluation Level:</strong> Meets Required Standard</p>
      `,
      bodyHtml: `
        <p style="font-size: 15px; margin: 0 0 16px 0; color: #4a5568;">
          Great performance! <strong>Your recruiter will get in touch with you shortly</strong> regarding the next steps in the hiring process.
        </p>
      `,
      plainText: `Status: Cleared (Shortlisted)\nOverall Score: B2 (${scoreVal}/100)\n\nGreat performance! Your recruiter will get in touch with you shortly.`
    };
  } else if (rating === 2) {
    const scoreVal = Math.floor(Math.random() * 16) + 35; // 35 - 50
    const level = scoreVal >= 45 ? "B1" : "B1-";
    return {
      statusText: "Not Cleared",
      subject: "Nova Assessment - Evaluation & Feedback",
      boxBg: "#f8fafc",
      boxBorder: "#e2e8f0",
      detailsHtml: `
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #4a5568;"><strong>Status:</strong> <span style="color: #e53e3e; font-weight: 600;">Not Cleared</span></p>
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #4a5568;"><strong>Score:</strong> ${level} (${scoreVal}/100)</p>
        <p style="margin: 0; font-size: 14px; color: #4a5568;"><strong>Areas for Improvement:</strong> Fluency pacing, grammar precision, and structured elaboration.</p>
      `,
      bodyHtml: `
        <p style="font-size: 14px; margin: 0 0 20px 0; color: #4a5568;">
          Don't worry — your scores and evaluation profile have been recorded in our talent database. As new opportunities matching your profile and score band become available, our recruitment team will reach out to you on this email address.
        </p>
      `,
      plainText: `Status: Not Cleared\nScore: ${level} (${scoreVal}/100)\nAreas for Improvement: Fluency pacing, grammar precision, and structured elaboration.\n\nDon't worry — your scores and evaluation profile have been recorded in our talent database. As new opportunities matching your profile and score band become available, our recruitment team will reach out to you on this email address.`
    };
  } else {
    const scoreVal = Math.floor(Math.random() * 15) + 30; // 30 - 44
    return {
      statusText: "Not Cleared",
      subject: "Nova Assessment - Evaluation Update",
      boxBg: "#f8fafc",
      boxBorder: "#e2e8f0",
      detailsHtml: `
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #4a5568;"><strong>Status:</strong> <span style="color: #e53e3e; font-weight: 600;">Not Cleared</span></p>
        <p style="margin: 0; font-size: 14px; color: #4a5568;"><strong>Score:</strong> A1-A2 (${scoreVal}/100)</p>
      `,
      bodyHtml: `
        <p style="font-size: 14px; margin: 0 0 20px 0; color: #4a5568;">
          Your assessment record has been saved with our talent acquisition team. As suitable roles aligned with your skill band arise in the future, we will keep your profile in consideration and contact you directly.
        </p>
      `,
      plainText: `Status: Not Cleared\nScore: A1-A2 (${scoreVal}/100)\n\nYour assessment record has been saved with our talent acquisition team. As suitable roles aligned with your skill band arise in the future, we will keep your profile in consideration and contact you directly.`
    };
  }
}

const evalData = getEvaluationData(stars);

const html = `<!DOCTYPE html>
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
              <p style="font-size: 16px; margin: 0 0 16px 0; color: #1a202c; font-weight: 600;">Hello ${candidateName},</p>
              
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

const payload = JSON.stringify({
  from: fromEmail,
  to: [targetEmail],
  reply_to: replyTo,
  subject: evalData.subject,
  html: html,
  text: `Hello ${candidateName},\n\nThank you for attending the Nova Assessment.\n\n${evalData.plainText}\n\nThank you,\nNova Assessment Team\nOpenHire Talent Platform`
});

console.log(`Sending ${stars}-Star email to ${targetEmail} (${candidateName})...`);

const req = https.request({
  hostname: 'api.resend.com',
  path: '/emails',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode);
    console.log('Resend Response:', data);
  });
});

req.on('error', (e) => {
  console.error('Request Error:', e);
});

req.write(payload);
req.end();
