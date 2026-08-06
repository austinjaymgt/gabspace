// Shared with api/stripe-webhook.js and api/send-password-changed-email.js.
// Kept in sync by hand with the Deno version in
// supabase/functions/invite-user/index.ts — different runtime/module system,
// so it can't be imported directly, but every transactional email should
// look like one system.

// Minimal escape for user-supplied strings that get interpolated straight
// into email HTML.
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function emailShell(eyebrow, eyebrowColor, heading, bodyHtml, ctaHref, ctaLabel, ctaColor) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${heading}</title>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background:#F5F5F7;font-family:'Manrope',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F7;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;border:1px solid #E2E2E4;max-width:560px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#2b0f2a,#160814);padding:28px 40px;border-radius:16px 16px 0 0;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#7fd8ff,#4fa8e8 55%,#6a5cd0);"></td>
            <td style="width:10px;"></td>
            <td><span style="font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:#FFFFFF;letter-spacing:-0.02em;">gabspace</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:${eyebrowColor};margin:0 0 12px;font-weight:600;">${eyebrow}</p>
          <h1 style="font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-size:26px;color:#2b1a2a;margin:0 0 16px;letter-spacing:-0.02em;">${heading}</h1>
          ${bodyHtml}
          <table cellpadding="0" cellspacing="0" style="margin:28px 0 4px;">
            <tr><td style="border-radius:10px;background:${ctaColor};">
              <a href="${ctaHref}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">${ctaLabel}</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #E2E2E4;">
          <p style="font-size:12px;color:#9CA3AF;margin:0;">© 2026 Gabspace · <a href="https://gabspace.io" style="color:#9CA3AF;text-decoration:none;">gabspace.io</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendEmail({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    console.error('Resend rejected email:', res.status, await res.text());
  }
  return res;
}
