import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const SLACK_WEBHOOK_URL = Deno.env.get('SLACK_WEBHOOK_URL')!
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!

serve(async (req) => {
  try {
    const payload = await req.json()

    // Supabase DB webhook sends the new row under payload.record
    const record = payload.record
    if (!record) {
      return new Response('No record', { status: 400 })
    }

    const {
  id,
  email,
  name,
  creative_type,
  social_link,
  how_heard,
  created_at,
} = record

    // Build the approve/deny URLs — these hit our second Edge Function
    const baseUrl = `${SUPABASE_URL}/functions/v1/approve-beta-request`
    const approveUrl = `${baseUrl}?id=${id}&action=approve`
    const denyUrl    = `${baseUrl}?id=${id}&action=deny`

    const formattedDate = new Date(created_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })

    const slackBody = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '✨ New Beta Request',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
  { type: 'mrkdwn', text: `*Name*\n${name || '—'}` },
  { type: 'mrkdwn', text: `*Email*\n${email}` },
  { type: 'mrkdwn', text: `*Creative type*\n${creative_type || '—'}` },
  { type: 'mrkdwn', text: `*Submitted*\n${formattedDate}` },
],
        },
        ...(social_link ? [{
  type: 'section',
  fields: [
    { type: 'mrkdwn', text: `*Social / Website*\n${social_link}` },
  ],
}] : []),
...(how_heard ? [{
  type: 'section',
  text: { type: 'mrkdwn', text: `*How they heard about Gabspace*\n${how_heard}` },
}] : []),
        { type: 'divider' },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '✅ Approve', emoji: true },
              style: 'primary',
              url: approveUrl,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '❌ Deny', emoji: true },
              style: 'danger',
              url: denyUrl,
            },
          ],
        },
      ],
    }

    const slackRes = await fetch(SLACK_WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(slackBody),
    })

    if (!slackRes.ok) {
      const text = await slackRes.text()
      console.error('Slack error:', text)
      return new Response('Slack error', { status: 500 })
    }

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('notify-beta-request error:', err)
    return new Response('Internal error', { status: 500 })
  }
})
