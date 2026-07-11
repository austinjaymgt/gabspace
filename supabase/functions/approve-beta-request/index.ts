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

// Supabase's Edge Runtime sandboxes HTML served directly from *.supabase.co
// (forces Content-Type: text/plain + a CSP that blocks rendering), so instead
// of inlining a confirmation page here, redirect to one on our own domain.
function htmlResponse(title: string, message: string) {
  const url = new URL('https://app.gabspace.io/')
  url.searchParams.set('beta-status', '1')
  url.searchParams.set('title', title)
  url.searchParams.set('message', message)
  return Response.redirect(url.toString(), 302)
}
