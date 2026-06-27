import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SLACK_WEBHOOK_URL         = Deno.env.get('SLACK_WEBHOOK_URL')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

serve(async (req) => {
  try {
    const url    = new URL(req.url)
    const id     = url.searchParams.get('id')
    const action = url.searchParams.get('action') // 'approve' | 'deny'

    if (!id || !action) {
      return new Response('Missing id or action', { status: 400 })
    }

    // Fetch the beta request row
    const { data: betaRequest, error: fetchError } = await supabase
      .from('beta_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !betaRequest) {
      return htmlResponse('❌ Request not found.', 'Something went wrong — request not found.')
    }

    // Guard: already processed
if (betaRequest.status === 'approved') {
  return htmlResponse('Already approved', `${betaRequest.email} was already approved.`)
}
if (betaRequest.status === 'denied') {
  return htmlResponse('Already denied', `${betaRequest.email} was already denied.`)
}

if (action === 'deny') {
  await supabase
    .from('beta_requests')
    .update({ status: 'denied' })
    .eq('id', id)

  await notifySlack(`❌ *${betaRequest.name || betaRequest.email}* was denied.`)
  return htmlResponse('Denied', `${betaRequest.email} has been denied.`)
}

if (action === 'approve') {
  const { error: updateError } = await supabase
    .from('beta_requests')
    .update({ status: 'approved' })
    .eq('id', id)

      if (updateError) {
        console.error('Update error:', updateError)
        return htmlResponse('Error', 'Failed to update approval status.')
      }

      // 2. Send Supabase invite email (magic link)
      const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
        betaRequest.email,
        {
          data: {
  full_name:      betaRequest.name || '',
  workspace_name: betaRequest.name ? `${betaRequest.name}'s Workspace` : 'My Workspace',
},
          redirectTo: 'https://app.gabspace.io',
        }
      )

      if (inviteError) {
        console.error('Invite error:', inviteError)
        // Still approved in DB — just notify Slack the invite failed
        await notifySlack(`⚠️ *${betaRequest.email}* approved but invite email failed: ${inviteError.message}`)
        return htmlResponse('Approved (invite failed)', `${betaRequest.email} approved but invite email failed. Check Supabase.`)
      }

      // 3. Confirm back to Slack
      await notifySlack(`✅ *${betaRequest.full_name || betaRequest.email}* approved — invite sent to ${betaRequest.email}`)

      return htmlResponse('✅ Approved!', `Invite sent to ${betaRequest.email}. They'll receive a magic link to join Gabspace.`)
    }

    return new Response('Unknown action', { status: 400 })

  } catch (err) {
    console.error('approve-beta-request error:', err)
    return new Response('Internal error', { status: 500 })
  }
})

// ── Helpers ──────────────────────────────────────────────────────────────────

async function notifySlack(text: string) {
  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
    })
  } catch (e) {
    console.error('Slack notify error:', e)
  }
}

function htmlResponse(title: string, message: string) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Gabspace</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #F7F5F0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 48px 40px;
      text-align: center;
      max-width: 400px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    h1 { font-size: 24px; color: #1A1A2E; margin: 0 0 12px; }
    p  { font-size: 15px; color: #8585A0; margin: 0; line-height: 1.6; }
    .logo {
      width: 48px; height: 48px;
      background: linear-gradient(135deg, #7C5CBF, #6B8F71);
      border-radius: 12px;
      margin: 0 auto 24px;
      display: flex; align-items: center; justify-content: center;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
        <rect x="3" y="3" width="9" height="9" rx="2.5" fill="white" opacity="0.9"/>
        <rect x="16" y="3" width="9" height="9" rx="2.5" fill="white" opacity="0.55"/>
        <rect x="3" y="16" width="9" height="9" rx="2.5" fill="white" opacity="0.55"/>
        <rect x="16" y="16" width="9" height="9" rx="2.5" fill="white" opacity="0.9"/>
      </svg>
    </div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`

  return new Response(html, {
  status:  200,
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
})
}
