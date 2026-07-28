import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "hello@gabspace.io";
const FROM_NAME = "Gabspace";
const DB_WEBHOOK_SECRET = Deno.env.get("DB_WEBHOOK_SECRET")!;

// beta_requests.name is submitted by anonymous public visitors - escape
// before interpolating into the HTML email template below.
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Invoked by a Supabase Database Webhook, not a browser - without this,
  // anyone with the public anon key could forge a {record: {email, name}}
  // body and get Gabspace's Resend account to email arbitrary addresses.
  // The webhook config must send this same secret as `x-webhook-secret`.
  if (req.headers.get("x-webhook-secret") !== DB_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const payload = await req.json();
    const record = payload?.record ?? payload;

    if (!record?.email) {
      console.error("No email found in payload:", JSON.stringify(payload));
      return new Response("Missing record data", { status: 400 });
    }

    const { name, email } = record;
    const greeting = escapeHtml(name?.trim() || "there");

    const emailBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>You're on the list</title>
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
          <p style="font-size:13px;text-transform:uppercase;letter-spacing:0.1em;color:#6a3f7a;margin:0 0 12px;font-weight:600;">Early access confirmed</p>
<h1 style="font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-size:26px;color:#2b1a2a;margin:0 0 16px;letter-spacing:-0.02em;">You're on the list, ${greeting}.</h1>          <p style="font-size:15px;color:#6B7280;line-height:1.75;margin:0 0 20px;">Thanks for applying to the Gabspace beta. We review every application personally and will be in touch soon.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#EDE5F4;border-radius:12px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#6a3f7a;margin:0 0 12px;font-weight:600;">What happens next</p>
              <p style="font-size:14px;color:#6B7280;margin:5px 0;"><span style="color:#6a3f7a;margin-right:8px;font-weight:700;">01</span>We review your application</p>
              <p style="font-size:14px;color:#6B7280;margin:5px 0;"><span style="color:#6a3f7a;margin-right:8px;font-weight:700;">02</span>You get an access link via email</p>
              <p style="font-size:14px;color:#6B7280;margin:5px 0;"><span style="color:#6a3f7a;margin-right:8px;font-weight:700;">03</span>Use Gabspace free for 4-6 weeks</p>
              <p style="font-size:14px;color:#6B7280;margin:5px 0;"><span style="color:#6a3f7a;margin-right:8px;font-weight:700;">04</span>Quick 20-min feedback call</p>
            </td></tr>
          </table>
          <p style="font-size:14px;color:#9CA3AF;">Questions? Just reply to this email.</p>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #E2E2E4;">
          <p style="font-size:12px;color:#9CA3AF;margin:0;">© 2026 Gabspace. You applied for early access.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [email],
subject: `You're on the Gabspace beta list, ${greeting}!`,
        html: emailBody,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return new Response(`Email send failed: ${err}`, { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Edge function error:", err);
    return new Response("Internal error", { status: 500 });
  }
});