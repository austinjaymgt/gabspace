import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "hello@gabspace.io";
const FROM_NAME = "Gabspace";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function approvalEmail(firstName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>You're in.</title></head>
<body style="margin:0;padding:0;background:#F7F5F0;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F0;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;border:1px solid rgba(26,26,46,0.08);max-width:560px;width:100%;">
        <tr><td style="background:#1A1A2E;padding:32px 40px 28px;border-radius:16px 16px 0 0;">
          <span style="font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.5px;">gabspace</span>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:#1D9E75;margin:0 0 12px;font-weight:600;">Beta access granted</p>
          <h1 style="font-size:26px;color:#1A1A2E;margin:0 0 16px;letter-spacing:-0.5px;">You're in, ${firstName}. 🎉</h1>
          <p style="font-size:15px;color:#3D3D5C;line-height:1.75;margin:0 0 24px;">Your Gabspace beta application has been approved. We're excited to have you on board — you're joining a small group of creatives helping shape the future of the platform.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0faf6;border-radius:12px;border:1px solid #1D9E75;margin-bottom:28px;">
            <tr><td style="padding:22px 24px;">
              <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#1D9E75;margin:0 0 10px;font-weight:600;">Getting started</p>
              <p style="font-size:14px;color:#3D3D5C;margin:6px 0;"><span style="color:#1D9E75;margin-right:8px;font-weight:700;">01</span>Head to <a href="https://app.gabspace.io" style="color:#1D9E75;font-weight:600;text-decoration:none;">app.gabspace.io</a> and create your account</p>
              <p style="font-size:14px;color:#3D3D5C;margin:6px 0;"><span style="color:#1D9E75;margin-right:8px;font-weight:700;">02</span>Set up your workspace — clients, projects, whatever fits your workflow</p>
              <p style="font-size:14px;color:#3D3D5C;margin:6px 0;"><span style="color:#1D9E75;margin-right:8px;font-weight:700;">03</span>Use it free for 4–6 weeks</p>
              <p style="font-size:14px;color:#3D3D5C;margin:6px 0;"><span style="color:#1D9E75;margin-right:8px;font-weight:700;">04</span>We'll reach out for a quick 20-min feedback call</p>
            </td></tr>
          </table>
          <p style="font-size:14px;color:#3D3D5C;line-height:1.7;margin:0 0 8px;">If you run into anything or have questions along the way, just reply to this email — we're here.</p>
          <p style="font-size:14px;color:#8585A0;margin:0;">Welcome to the studio. ✦</p>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid rgba(26,26,46,0.06);">
          <p style="font-size:12px;color:#8585A0;margin:0;">© 2026 Gabspace · <a href="https://gabspace.io" style="color:#8585A0;text-decoration:none;">gabspace.io</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function rejectionEmail(firstName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Thanks for applying.</title></head>
<body style="margin:0;padding:0;background:#F7F5F0;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F0;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;border:1px solid rgba(26,26,46,0.08);max-width:560px;width:100%;">
        <tr><td style="background:#1A1A2E;padding:32px 40px 28px;border-radius:16px 16px 0 0;">
          <span style="font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.5px;">gabspace</span>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:#7C5CBF;margin:0 0 12px;font-weight:600;">Beta application update</p>
          <h1 style="font-size:26px;color:#1A1A2E;margin:0 0 16px;letter-spacing:-0.5px;">Thanks for applying, ${firstName}.</h1>
          <p style="font-size:15px;color:#3D3D5C;line-height:1.75;margin:0 0 24px;">We really appreciate you taking the time to apply for the Gabspace beta. After reviewing your application, we're not able to offer you a spot in this round — our current cohort is focused on a specific set of creative workflows and capacity is limited.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F0;border-radius:12px;margin-bottom:28px;">
            <tr><td style="padding:22px 24px;">
              <p style="font-size:14px;color:#3D3D5C;line-height:1.7;margin:0 0 10px;">This isn't the end of the road. We'll be opening up more spots as the beta expands, and we'll keep your application on file.</p>
              <p style="font-size:14px;color:#3D3D5C;line-height:1.7;margin:0;">In the meantime, follow along at <a href="https://gabspace.io" style="color:#7C5CBF;font-weight:600;text-decoration:none;">gabspace.io</a> — we share updates there as the platform grows.</p>
            </td></tr>
          </table>
          <p style="font-size:14px;color:#8585A0;margin:0;">Thank you again — we hope to work with you in a future round.</p>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid rgba(26,26,46,0.06);">
          <p style="font-size:12px;color:#8585A0;margin:0;">© 2026 Gabspace · <a href="https://gabspace.io" style="color:#8585A0;text-decoration:none;">gabspace.io</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { name, email, status } = await req.json();

    if (!email || !status) {
      return new Response("Missing email or status", { status: 400, headers: corsHeaders });
    }

    if (!["approved", "rejected"].includes(status)) {
      return new Response("Invalid status", { status: 400, headers: corsHeaders });
    }

    const firstName = name?.split(" ")[0] ?? "there";
    const isApproved = status === "approved";

    const subject = isApproved
      ? `You're in — welcome to the Gabspace beta, ${firstName}!`
      : `Your Gabspace beta application`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [email],
        subject,
        html: isApproved ? approvalEmail(firstName) : rejectionEmail(firstName),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return new Response(`Email send failed: ${err}`, { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Edge function error:", err);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
