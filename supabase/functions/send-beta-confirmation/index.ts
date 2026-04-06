import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "onboarding@resend.dev";
const FROM_NAME = "Gabspace";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    const record = payload?.record ?? payload;

    if (!record?.email) {
      console.error("No email found in payload:", JSON.stringify(payload));
      return new Response("Missing record data", { status: 400 });
    }

    const { name, email } = record;
    const firstName = name?.split(" ")[0] ?? "there";

    const emailBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>You're on the list</title></head>
<body style="margin:0;padding:0;background:#F7F5F0;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F0;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;border:1px solid rgba(26,26,46,0.08);max-width:560px;width:100%;">
        <tr><td style="background:#1A1A2E;padding:32px 40px 28px;border-radius:16px 16px 0 0;">
          <span style="font-size:22px;font-weight:700;color:#FFFFFF;">gabspace</span>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="font-size:13px;text-transform:uppercase;letter-spacing:0.1em;color:#7C5CBF;margin:0 0 12px;">Early access confirmed</p>
          <h1 style="font-size:26px;color:#1A1A2E;margin:0 0 16px;">You're on the list, ${firstName}.</h1>
          <p style="font-size:15px;color:#3D3D5C;line-height:1.75;margin:0 0 20px;">Thanks for applying to the Gabspace beta. We review every application personally and will be in touch soon.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F0;border-radius:12px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#8585A0;margin:0 0 12px;">What happens next</p>
              <p style="font-size:14px;color:#3D3D5C;margin:5px 0;"><span style="color:#7C5CBF;margin-right:8px;">01</span>We review your application</p>
              <p style="font-size:14px;color:#3D3D5C;margin:5px 0;"><span style="color:#7C5CBF;margin-right:8px;">02</span>You get an access link via email</p>
              <p style="font-size:14px;color:#3D3D5C;margin:5px 0;"><span style="color:#7C5CBF;margin-right:8px;">03</span>Use Gabspace free for 4-6 weeks</p>
              <p style="font-size:14px;color:#3D3D5C;margin:5px 0;"><span style="color:#7C5CBF;margin-right:8px;">04</span>Quick 20-min feedback call</p>
            </td></tr>
          </table>
          <p style="font-size:14px;color:#8585A0;">Questions? Just reply to this email.</p>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid rgba(26,26,46,0.06);">
          <p style="font-size:12px;color:#8585A0;margin:0;">© 2026 Gabspace. You applied for early access.</p>
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
        subject: `You're on the Gabspace beta list, ${firstName}!`,
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