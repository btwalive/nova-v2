const fs = require('fs');
const path = require('path');

const previewDir = path.join(__dirname, '..', 'scratch');
if (!fs.existsSync(previewDir)) {
  fs.mkdirSync(previewDir, { recursive: true });
}

function generateHtml(candidateName, statusText, statusColor, boxBg, boxBorder, detailsHtml, bodyHtml, subject) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); text-align: left;">
          
          <!-- Top Multi-color Accent Bar -->
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

              <!-- Details Container -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${boxBg}; border: 1px solid ${boxBorder}; border-radius: 6px; padding: 18px 20px; margin: 0 0 22px 0;">
                <tr>
                  <td>
                    ${detailsHtml}
                  </td>
                </tr>
              </table>

              ${bodyHtml}

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

// 3 Star
const html3 = generateHtml(
  'Gourav Pandey',
  'Cleared (Shortlisted)',
  '#15803d',
  '#f0fdf4',
  '#bbf7d0',
  `<p style="margin: 0 0 8px 0; font-size: 14px; color: #166534;"><strong>Status:</strong> <span style="color: #15803d; font-weight: 700;">Cleared (Shortlisted)</span></p>
   <p style="margin: 0 0 8px 0; font-size: 14px; color: #166534;"><strong>Overall Score:</strong> B2 (68/100)</p>
   <p style="margin: 0; font-size: 14px; color: #166534;"><strong>Evaluation Level:</strong> Meets Required Standard</p>`,
  `<p style="font-size: 15px; margin: 0 0 16px 0; color: #4a5568;">Great performance! <strong>Your recruiter will get in touch with you shortly</strong> regarding the next steps in the hiring process.</p>`,
  'Update on your Nova Assessment - Next Steps'
);

// 2 Star
const html2 = generateHtml(
  'Gourav Pandey',
  'Not Cleared',
  '#e53e3e',
  '#f8fafc',
  '#e2e8f0',
  `<p style="margin: 0 0 8px 0; font-size: 14px; color: #4a5568;"><strong>Status:</strong> <span style="color: #e53e3e; font-weight: 600;">Not Cleared</span></p>
   <p style="margin: 0 0 8px 0; font-size: 14px; color: #4a5568;"><strong>Score:</strong> B1 (42/100)</p>
   <p style="margin: 0; font-size: 14px; color: #4a5568;"><strong>Areas for Improvement:</strong> Fluency pacing, grammar precision, and structured elaboration.</p>`,
  `<p style="font-size: 14px; margin: 0 0 20px 0; color: #4a5568;">Don't worry — your scores and evaluation profile have been recorded in our talent database. As new opportunities matching your profile and score band become available, our recruitment team will reach out to you on this email address.</p>`,
  'Nova Assessment - Evaluation & Feedback'
);

// 1 Star
const html1 = generateHtml(
  'Gourav Pandey',
  'Not Cleared',
  '#e53e3e',
  '#f8fafc',
  '#e2e8f0',
  `<p style="margin: 0 0 8px 0; font-size: 14px; color: #4a5568;"><strong>Status:</strong> <span style="color: #e53e3e; font-weight: 600;">Not Cleared</span></p>
   <p style="margin: 0; font-size: 14px; color: #4a5568;"><strong>Score:</strong> A1-A2 (34/100)</p>`,
  `<p style="font-size: 14px; margin: 0 0 20px 0; color: #4a5568;">Your assessment record has been saved with our talent acquisition team. As suitable roles aligned with your skill band arise in the future, we will keep your profile in consideration and contact you directly.</p>`,
  'Nova Assessment - Evaluation Update'
);

fs.writeFileSync(path.join(previewDir, 'preview_3_star.html'), html3);
fs.writeFileSync(path.join(previewDir, 'preview_2_star.html'), html2);
fs.writeFileSync(path.join(previewDir, 'preview_1_star.html'), html1);

console.log('✅ Generated preview files in scratch/:');
console.log(' - scratch/preview_3_star.html');
console.log(' - scratch/preview_2_star.html');
console.log(' - scratch/preview_1_star.html');
