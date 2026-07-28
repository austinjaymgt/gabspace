import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "hello@gabspace.io";
const FROM_NAME = "Gabspace";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// name traces back to beta_requests.name, submitted by anonymous public
// visitors - escape before interpolating into the HTML templates below.
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function approvalEmail(firstName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>You're in.</title>
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
<p style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:#1f9c8f;margin:0 0 12px;font-weight:600;">Beta access granted</p>
          <h1 style="font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-size:26px;color:#2b1a2a;margin:0 0 16px;letter-spacing:-0.02em;">You're in, ${firstName}. 🎉</h1>
          <p style="font-size:15px;color:#6B7280;line-height:1.75;margin:0 0 24px;">Your Gabspace beta application has been approved. We're excited to have you on board — you're joining a small group of creatives helping shape the future of the platform.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#E0FBF7;border-radius:12px;border:1px solid #1f9c8f;margin-bottom:28px;">
            <tr><td style="padding:22px 24px;">
<p style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#1f9c8f;margin:0 0 10px;font-weight:600;">Getting started</p>
              <p style="font-size:14px;color:#6B7280;margin:6px 0;"><span style="color:#1f9c8f;margin-right:8px;font-weight:700;">01</span>Head to <a href="https://app.gabspace.io" style="color:#1f9c8f;font-weight:600;text-decoration:none;">app.gabspace.io</a> and create your account</p>
              <p style="font-size:14px;color:#6B7280;margin:6px 0;"><span style="color:#1f9c8f;margin-right:8px;font-weight:700;">02</span>Set up your workspace — clients, projects, whatever fits your workflow</p>
              <p style="font-size:14px;color:#6B7280;margin:6px 0;"><span style="color:#1f9c8f;margin-right:8px;font-weight:700;">03</span>Use it free for 4–6 weeks</p>
              <p style="font-size:14px;color:#6B7280;margin:6px 0;"><span style="color:#1f9c8f;margin-right:8px;font-weight:700;">04</span>We'll reach out for a quick 20-min feedback call</p>
            </td></tr>
          </table>
          <p style="font-size:14px;color:#6B7280;line-height:1.7;margin:0 0 8px;">If you run into anything or have questions along the way, just reply to this email — we're here.</p>
          <p style="font-size:14px;color:#9CA3AF;margin:0;">Welcome to the studio. ✦</p>
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

function rejectionEmail(firstName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Thanks for applying.</title>
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
          <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:#6a3f7a;margin:0 0 12px;font-weight:600;">Beta application update</p>
          <h1 style="font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-size:26px;color:#2b1a2a;margin:0 0 16px;letter-spacing:-0.02em;">Thanks for applying, ${firstName}.</h1>
          <p style="font-size:15px;color:#6B7280;line-height:1.75;margin:0 0 24px;">We really appreciate you taking the time to apply for the Gabspace beta. After reviewing your application, we're not able to offer you a spot in this round — our current cohort is focused on a specific set of creative workflows and capacity is limited.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F7;border-radius:12px;margin-bottom:28px;">
            <tr><td style="padding:22px 24px;">
              <p style="font-size:14px;color:#6B7280;line-height:1.7;margin:0 0 10px;">This isn't the end of the road. We'll be opening up more spots as the beta expands, and we'll keep your application on file.</p>
              <p style="font-size:14px;color:#6B7280;line-height:1.7;margin:0;">In the meantime, follow along at <a href="https://gabspace.io" style="color:#6a3f7a;font-weight:600;text-decoration:none;">gabspace.io</a> — we share updates there as the platform grows.</p>
            </td></tr>
          </table>
          <p style="font-size:14px;color:#9CA3AF;margin:0;">Thank you again — we hope to work with you in a future round.</p>
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Only the platform admin (who reviews the beta waitlist) should be
    // able to trigger these emails - without this, anyone with the anon
    // key could email an arbitrary address a fake "you're approved"
    // notice from Gabspace's verified sending domain.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Missing Authorization header", { status: 401, headers: corsHeaders });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response("Invalid or expired session", { status: 401, headers: corsHeaders });
    }

    const { data: isAdmin, error: adminError } = await userClient.rpc("is_platform_admin");
    if (adminError || !isAdmin) {
      return new Response("Not authorized", { status: 403, headers: corsHeaders });
    }

    const { name, email, status } = await req.json();

    if (!email || !status) {
      return new Response("Missing email or status", { status: 400, headers: corsHeaders });
    }

    if (!["approved", "rejected"].includes(status)) {
      return new Response("Invalid status", { status: 400, headers: corsHeaders });
    }

    const firstName = escapeHtml(name?.split(" ")[0] ?? "there");
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
