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

function emailShell(eyebrow: string, eyebrowColor: string, heading: string, bodyHtml: string, ctaHref: string, ctaLabel: string, ctaColor: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>${heading}</title></head>
<body style="margin:0;padding:0;background:#F7F5F0;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F0;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;border:1px solid rgba(26,26,46,0.08);max-width:560px;width:100%;">
        <tr><td style="background:#1A1A2E;padding:32px 40px 28px;border-radius:16px 16px 0 0;">
          <span style="font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.5px;">gabspace</span>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:${eyebrowColor};margin:0 0 12px;font-weight:600;">${eyebrow}</p>
          <h1 style="font-size:26px;color:#1A1A2E;margin:0 0 16px;letter-spacing:-0.5px;">${heading}</h1>
          ${bodyHtml}
          <table cellpadding="0" cellspacing="0" style="margin:28px 0 4px;">
            <tr><td style="border-radius:10px;background:${ctaColor};">
              <a href="${ctaHref}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">${ctaLabel}</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid rgba(26,26,46,0.06);">
          <p style="font-size:12px;color:#8585A0;margin:0;">© 2026 Gabspace · <a href="https://gabspace.io" style="color:#8585A0;text-decoration:none;">gabspace.io</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function newUserInviteEmail(businessName: string, role: string, actionLink: string): string {
  const body = `<p style="font-size:15px;color:#3D3D5C;line-height:1.75;margin:0;">You've been invited to join <strong>${businessName}</strong> on Gabspace as ${role === 'admin' ? 'an' : 'a'} <strong>${roleLabel(role)}</strong>. Accept the invite below to set up your account and get started.</p>`
  return emailShell('You\'re invited', '#7C5CBF', `Join ${businessName} on Gabspace`, body, actionLink, 'Accept invite', '#7C5CBF')
}

function addedToBusinessEmail(businessName: string, role: string): string {
  const body = `<p style="font-size:15px;color:#3D3D5C;line-height:1.75;margin:0;">You've been added to <strong>${businessName}</strong> on Gabspace as ${role === 'admin' ? 'an' : 'a'} <strong>${roleLabel(role)}</strong>. It's now available from the business switcher in your top bar.</p>`
  return emailShell('Added to a business', '#6B8F71', `You're in on ${businessName}`, body, APP_URL, 'Open Gabspace', '#6B8F71')
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
    const body = await req.text()
    console.log('body received:', body)

    if (!body) {
      return new Response(JSON.stringify({ error: 'Empty request body' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { email, role, businessSpaceId, invitedBy } = JSON.parse(body)
    console.log('parsed:', { email, role, businessSpaceId, invitedBy })

    if (!email || !role || !businessSpaceId || !invitedBy) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: business } = await adminClient
      .from('business_spaces')
      .select('name')
      .eq('id', businessSpaceId)
      .single()
    const businessName = business?.name || 'a Gabspace business'

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
