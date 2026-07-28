import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = 'hello@gabspace.io'
const FROM_NAME = 'Gabspace'
const APP_URL = 'https://app.gabspace.io'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

// business_spaces.name is set by whoever owns that business, so it's
// attacker-influenceable content by the time it lands in someone else's
// inbox - escape before interpolating into the HTML email templates below.
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function emailShell(eyebrow: string, eyebrowColor: string, heading: string, bodyHtml: string, ctaHref: string, ctaLabel: string, ctaColor: string): string {
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
</html>`
}

function newUserInviteEmail(businessName: string, role: string, actionLink: string): string {
  const body = `<p style="font-size:15px;color:#6B7280;line-height:1.75;margin:0;">You've been invited to join <strong>${businessName}</strong> on Gabspace as ${role === 'employee' ? 'an' : 'a'} <strong>${roleLabel(role)}</strong>. Accept the invite below to set up your account and get started.</p>`
  return emailShell('You\'re invited', '#6a3f7a', `Join ${businessName} on Gabspace`, body, actionLink, 'Accept invite', '#6a3f7a')
}

function addedToBusinessEmail(businessName: string, role: string): string {
  const body = `<p style="font-size:15px;color:#6B7280;line-height:1.75;margin:0;">You've been added to <strong>${businessName}</strong> on Gabspace as ${role === 'employee' ? 'an' : 'a'} <strong>${roleLabel(role)}</strong>. It's now available from the business switcher in your top bar.</p>`
  return emailShell('Added to a business', '#1f9c8f', `You're in on ${businessName}`, body, APP_URL, 'Open Gabspace', '#1f9c8f')
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to: [to], subject, html }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('Resend error:', err)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    // 1. Verify the caller's identity from their JWT — never trust an
    // `invitedBy` field from the request body, since anyone with the
    // public anon key could set it to any user id.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      console.log('auth error:', userError?.message)
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.text()
    console.log('body received:', body)

    if (!body) {
      return new Response(JSON.stringify({ error: 'Empty request body' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { email, role, businessSpaceId } = JSON.parse(body)
    console.log('parsed:', { email, role, businessSpaceId })

    if (!email || !role || !businessSpaceId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const ALLOWED_ROLES = ['co-owner', 'employee']
    if (!ALLOWED_ROLES.includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Hardcoded caps, not yet tied to a pricing plan: co-owner max 1,
    // employee max 3 per business. Counts accepted members plus pending
    // invites for this role so two simultaneous invites can't both land
    // once accepted.
    const ROLE_CAPS: Record<string, number> = { 'co-owner': 1, employee: 3 }

    const invitedBy = user.id

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 2. Authorize: the caller must actually be an owner/co-owner of the
    // business they're trying to invite someone into. Without this,
    // verify_jwt=true only proves *some* valid Supabase JWT was sent
    // (the anon key itself qualifies) — it says nothing about who the
    // caller is or what they're allowed to do.
    const { data: callerMembership, error: callerError } = await adminClient
      .from('business_space_members')
      .select('role')
      .eq('business_space_id', businessSpaceId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (callerError) {
      return new Response(JSON.stringify({ error: callerError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!callerMembership || !['owner', 'co-owner'].includes(callerMembership.role)) {
      return new Response(JSON.stringify({ error: 'Not authorized to invite members to this business' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const roleCap = ROLE_CAPS[role]
    if (roleCap !== undefined) {
      const [{ count: memberCount }, { count: inviteCount }] = await Promise.all([
        adminClient
          .from('business_space_members')
          .select('id', { count: 'exact', head: true })
          .eq('business_space_id', businessSpaceId)
          .eq('role', role),
        adminClient
          .from('invites')
          .select('id', { count: 'exact', head: true })
          .eq('business_space_id', businessSpaceId)
          .eq('role', role)
          .eq('accepted', false),
      ])
      if ((memberCount ?? 0) + (inviteCount ?? 0) >= roleCap) {
        return new Response(JSON.stringify({ error: `${roleLabel(role)} limit reached (${roleCap} max on your current plan)` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    const { data: business } = await adminClient
      .from('business_spaces')
      .select('name')
      .eq('id', businessSpaceId)
      .single()
    const businessName = escapeHtml(business?.name || 'a Gabspace business')

    const { data: insertedInvite, error: insertError } = await adminClient
      .from('invites')
      .insert({ business_space_id: businessSpaceId, email, role, invited_by: invitedBy })
      .select('id')
      .single()

    console.log('insert error:', insertError)

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: existingUserId, error: lookupError } = await adminClient
      .rpc('find_user_id_by_email', { lookup_email: email })
    console.log('existing user lookup:', existingUserId, lookupError)

    if (lookupError) {
      return new Response(JSON.stringify({ error: lookupError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (existingUserId) {
      // Already has an account elsewhere in Gabspace - add them to this
      // business directly rather than sending a signup invite (which
      // would fail since they're already registered).
      const { error: memberError } = await adminClient
        .from('business_space_members')
        .upsert(
          { business_space_id: businessSpaceId, user_id: existingUserId, role },
          { onConflict: 'business_space_id,user_id' }
        )
      console.log('member upsert error:', memberError)

      if (memberError) {
        return new Response(JSON.stringify({ error: memberError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      await adminClient.from('invites').update({ accepted: true }).eq('id', insertedInvite.id)

      await sendEmail(email, `You've been added to ${businessName} on Gabspace`, addedToBusinessEmail(businessName, role))

      return new Response(JSON.stringify({ success: true, alreadyMember: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // generateLink creates the auth user (same effect as inviteUserByEmail)
    // but returns the link instead of sending Supabase's own built-in
    // email, so we can send our own branded one via Resend instead.
    const { data: linkData, error: inviteError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email,
    })
    console.log('invite error:', inviteError)

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    await sendEmail(email, `You're invited to join ${businessName} on Gabspace`, newUserInviteEmail(businessName, role, linkData.properties.action_link))

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.log('catch error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
