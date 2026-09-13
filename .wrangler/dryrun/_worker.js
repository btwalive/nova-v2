var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// public/_worker.js
var SENDER_EMAIL = "Nova Assessments <evaluations@openhire.in>";
var REPLY_TO_EMAIL = "support@openhire.in";
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Range",
  "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges"
};
function getEvaluationMetadata(stars, customScore, customFeedback) {
  const rating = Number(stars);
  if (rating >= 3) {
    const scoreVal2 = customScore || Math.floor(Math.random() * 16) + 60;
    const cefr2 = scoreVal2 >= 75 ? "C1" : "B2";
    return {
      stars: rating,
      status: "Cleared",
      statusLabel: "Cleared (Shortlisted)",
      statusColor: "#15803d",
      boxBg: "#f0fdf4",
      boxBorder: "#bbf7d0",
      textColor: "#166534",
      cefrScore: `${cefr2} (${scoreVal2}/100)`,
      scoreNumber: scoreVal2,
      subject: "Update on your Nova Assessment - Next Steps",
      detailsHtml: `
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #166534;"><strong>Status:</strong> <span style="color: #15803d; font-weight: 700;">Cleared (Shortlisted)</span></p>
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #166534;"><strong>Overall Score:</strong> ${cefr2} (${scoreVal2}/100)</p>
        <p style="margin: 0; font-size: 14px; color: #166534;"><strong>Evaluation:</strong> Meets Required Standard</p>
      `,
      bodyHtml: `
        <p style="font-size: 15px; margin: 0 0 16px 0; color: #4a5568; line-height: 1.6;">
          Great performance! <strong>Your recruiter will get in touch with you shortly</strong> regarding the next steps in the hiring process.
        </p>
      `,
      plainTextDetails: `Status: Cleared (Shortlisted)
Overall Score: ${cefr2} (${scoreVal2}/100)

Great performance! Your recruiter will get in touch with you shortly regarding the next steps.`
    };
  }
  if (rating === 2) {
    const scoreVal2 = customScore || Math.floor(Math.random() * 16) + 35;
    const cefr2 = scoreVal2 >= 45 ? "B1" : "B1-";
    const feedbackText = customFeedback || "Fluency pacing, grammar precision, and structured elaboration.";
    return {
      stars: rating,
      status: "Not Cleared",
      statusLabel: "Not Cleared",
      statusColor: "#e53e3e",
      boxBg: "#f8fafc",
      boxBorder: "#e2e8f0",
      textColor: "#4a5568",
      cefrScore: `${cefr2} (${scoreVal2}/100)`,
      scoreNumber: scoreVal2,
      subject: "Nova Assessment - Evaluation & Feedback",
      detailsHtml: `
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #4a5568;"><strong>Status:</strong> <span style="color: #e53e3e; font-weight: 600;">Not Cleared</span></p>
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #4a5568;"><strong>Score:</strong> ${cefr2} (${scoreVal2}/100)</p>
        <p style="margin: 0; font-size: 14px; color: #4a5568;"><strong>Areas for Improvement:</strong> ${feedbackText}</p>
      `,
      bodyHtml: `
        <p style="font-size: 14px; margin: 0 0 20px 0; color: #4a5568; line-height: 1.6;">
          Don't worry \u2014 your scores and evaluation profile have been recorded in our talent database. As new opportunities matching your profile and score band become available, our recruitment team will reach out to you on this email address.
        </p>
      `,
      plainTextDetails: `Status: Not Cleared
Score: ${cefr2} (${scoreVal2}/100)
Areas for Improvement: ${feedbackText}

Don't worry \u2014 your scores and profile are recorded with us. Once we have openings aligned with your score, we will contact you on this email.`
    };
  }
  const scoreVal = customScore || Math.floor(Math.random() * 15) + 30;
  const cefr = scoreVal >= 38 ? "A2" : "A1";
  return {
    stars: 1,
    status: "Not Cleared",
    statusLabel: "Not Cleared",
    statusColor: "#e53e3e",
    boxBg: "#f8fafc",
    boxBorder: "#e2e8f0",
    textColor: "#4a5568",
    cefrScore: `${cefr} (${scoreVal}/100)`,
    scoreNumber: scoreVal,
    subject: "Nova Assessment - Evaluation Update",
    detailsHtml: `
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #4a5568;"><strong>Status:</strong> <span style="color: #e53e3e; font-weight: 600;">Not Cleared</span></p>
      <p style="margin: 0; font-size: 14px; color: #4a5568;"><strong>Score:</strong> ${cefr} (${scoreVal}/100)</p>
    `,
    bodyHtml: `
      <p style="font-size: 14px; margin: 0 0 20px 0; color: #4a5568; line-height: 1.6;">
        Your assessment record has been saved with our talent acquisition team. As suitable roles aligned with your skill band arise in the future, we will keep your profile in consideration and contact you directly.
      </p>
    `,
    plainTextDetails: `Status: Not Cleared
Score: ${cefr} (${scoreVal}/100)

Your scores and profile are recorded with us. Once we have openings aligned with your score, our team will reach out to you on this email.`
  };
}
__name(getEvaluationMetadata, "getEvaluationMetadata");
function buildHtmlEmail(candidateName, evalData) {
  const name = candidateName && candidateName.trim() ? candidateName.trim() : "Candidate";
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
          <tr>
            <td style="padding: 36px 36px 32px 36px;">
              <p style="font-size: 16px; margin: 0 0 16px 0; color: #1a202c; font-weight: 600;">Hello ${name},</p>
              <p style="font-size: 15px; margin: 0 0 20px 0; color: #4a5568;">
                Thank you for attending the <strong>Nova Assessment</strong>. Below is the summary of your assessment evaluation.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${evalData.boxBg}; border: 1px solid ${evalData.boxBorder}; border-radius: 6px; padding: 18px 20px; margin: 0 0 22px 0;">
                <tr>
                  <td>${evalData.detailsHtml}</td>
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
__name(buildHtmlEmail, "buildHtmlEmail");
function buildPlainText(candidateName, evalData) {
  const name = candidateName && candidateName.trim() ? candidateName.trim() : "Candidate";
  return `Hello ${name},

Thank you for attending the Nova Assessment.

${evalData.plainTextDetails}

Thank you,
Nova Assessment Team
OpenHire Talent Platform`;
}
__name(buildPlainText, "buildPlainText");
async function handleSendAssessmentFeedback(request, env) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: `Method ${request.method} not allowed` }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  const apiKey = env && env.RESEND_API_KEY || (typeof process !== "undefined" ? process.env?.RESEND_API_KEY : "");
  const fromEmail = env && env.RESEND_FROM_EMAIL || (typeof process !== "undefined" ? process.env?.RESEND_FROM_EMAIL : "") || SENDER_EMAIL;
  const replyTo = env && env.RESEND_REPLY_TO_EMAIL || (typeof process !== "undefined" ? process.env?.RESEND_REPLY_TO_EMAIL : "") || REPLY_TO_EMAIL;
  if (!apiKey) {
    return new Response(JSON.stringify({
      success: false,
      error: "RESEND_API_KEY environment variable is not configured on Cloudflare Pages."
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  try {
    const body = await request.json();
    const {
      candidateEmail,
      candidateName,
      ratingStars = 2,
      customScore,
      customFeedback
    } = body || {};
    if (!candidateEmail) {
      return new Response(JSON.stringify({ error: "Missing required field: candidateEmail" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
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
        "X-Entity-Ref-ID": `nova-${Date.now()}`
      }
    };
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const resData = await response.json();
    if (!response.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: resData.message || resData.error || "Failed to send email via Resend",
        details: resData
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      messageId: resData.id,
      recipient: candidateEmail,
      evalData
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Internal server error while dispatching email"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleSendAssessmentFeedback, "handleSendAssessmentFeedback");
async function handleDriveStream(request) {
  const url = new URL(request.url);
  const fileId = url.searchParams.get("id");
  if (!fileId) {
    return new Response(JSON.stringify({ error: "Missing file id parameter" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  const safeFileId = fileId.replace(/[^a-zA-Z0-9_-]/g, "").trim();
  const driveUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(safeFileId)}&export=download`;
  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("range", range);
  try {
    const res = await fetch(driveUrl, { headers });
    const responseHeaders = new Headers(res.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "Range, Content-Type");
    responseHeaders.set("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to stream audio file from Drive", details: err.message }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleDriveStream, "handleDriveStream");
async function handleDriveUpload(request, env) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: `Method ${request.method} not allowed` }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  try {
    const body = await request.json();
    const { b64Data, mimeType = "audio/webm", fileName, folderId } = body || {};
    if (!b64Data || !fileName) {
      return new Response(JSON.stringify({ error: "Missing required fields (b64Data, fileName)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const clientId = env && env.GOOGLE_OAUTH_CLIENT_ID || (typeof process !== "undefined" ? process.env?.GOOGLE_OAUTH_CLIENT_ID : "");
    const clientSecret = env && env.GOOGLE_OAUTH_CLIENT_SECRET || (typeof process !== "undefined" ? process.env?.GOOGLE_OAUTH_CLIENT_SECRET : "");
    const refreshToken = env && env.GOOGLE_OAUTH_REFRESH_TOKEN || (typeof process !== "undefined" ? process.env?.GOOGLE_OAUTH_REFRESH_TOKEN : "");
    const targetFolderId = folderId || env && env.GOOGLE_DRIVE_FOLDER_ID || (typeof process !== "undefined" ? process.env?.GOOGLE_DRIVE_FOLDER_ID : "");
    if (!clientId || !clientSecret || !refreshToken) {
      return new Response(JSON.stringify({ error: "Google OAuth credentials not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    });
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString()
    });
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return new Response(JSON.stringify({ error: `OAuth token error: ${errText}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const boundary = "nova_edge_boundary_" + Date.now();
    const metaJson = JSON.stringify({
      name: fileName,
      mimeType,
      ...targetFolderId ? { parents: [targetFolderId] } : {}
    });
    const binaryString = atob(b64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const enc = new TextEncoder();
    const part1 = enc.encode(`--${boundary}\r
Content-Type: application/json; charset=UTF-8\r
\r
${metaJson}\r
--${boundary}\r
Content-Type: ${mimeType}\r
Content-Transfer-Encoding: binary\r
\r
`);
    const part3 = enc.encode(`\r
--${boundary}--`);
    const combined = new Uint8Array(part1.length + bytes.length + part3.length);
    combined.set(part1, 0);
    combined.set(bytes, part1.length);
    combined.set(part3, part1.length + bytes.length);
    const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webContentLink,size", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body: combined
    });
    if (!uploadRes.ok) {
      const uploadErr = await uploadRes.text();
      return new Response(JSON.stringify({ error: `Upload error: ${uploadErr}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const uploadData = await uploadRes.json();
    await fetch(`https://www.googleapis.com/drive/v3/files/${uploadData.id}/permissions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ role: "reader", type: "anyone" })
    }).catch(() => {
    });
    return new Response(JSON.stringify({
      success: true,
      fileId: uploadData.id,
      fileName: uploadData.name,
      fileSize: uploadData.size,
      mimeType: uploadData.mimeType,
      streamUrl: `/api/drive-stream?id=${uploadData.id}`
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleDriveUpload, "handleDriveUpload");
var inMemoryComments = [];
async function handleComments(request) {
  if (request.method === "GET") {
    return new Response(JSON.stringify({ comments: inMemoryComments }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  if (request.method === "POST") {
    try {
      const comment = await request.json();
      const savedComment = {
        id: `cmt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        ...comment,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      inMemoryComments.unshift(savedComment);
      return new Response(JSON.stringify({ success: true, comment: savedComment }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const commentId = url.pathname.split("/").pop();
    inMemoryComments = inMemoryComments.filter((c) => c.id !== commentId);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
__name(handleComments, "handleComments");
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";
    if (request.method === "OPTIONS" && path.startsWith("/api/")) {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (path === "/api/send-assessment-feedback") {
      return handleSendAssessmentFeedback(request, env);
    }
    if (path === "/api/drive-stream") {
      return handleDriveStream(request);
    }
    if (path === "/api/drive-upload") {
      return handleDriveUpload(request, env);
    }
    if (path.startsWith("/api/comments")) {
      return handleComments(request);
    }
    const res = await env.ASSETS.fetch(request);
    if (res.status === 404 && !path.startsWith("/api/") && !path.includes(".")) {
      return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
    }
    return res;
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=_worker.js.map
