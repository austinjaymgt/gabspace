// supabase/functions/send-event-inquiry/index.ts
// Triggered by a Supabase database webhook on INSERT to projects
// where type = 'event' and source = 'public'

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record

    // Only handle public event inquiries
    if (record.type !== 'event' || record.source !== 'public') {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 })
    }

    // Parse submitter info from description
    const description = record.description || ''
    const lines = description.split('\n')

    function extractField(label: string): string {
      const line = lines.find(l => l.startsWith(label))
      return line ? line.replace(label, '').trim() : ''
    }

    const submitterEmail = extractField('Submitter email:')
    const submitterName  = extractField('Submitter name:')

    if (!submitterEmail) {
      console.log('No submitter email found, skipping confirmation email')
      return new Response(JSON.stringify({ skipped: true }), { status: 200 })
    }

    // Parse event details from title: "EventType — Full Name (Org)"
    const title = record.title || ''
    const eventTypePart = title.split('—')[0]?.trim() || 'your event'
    const firstName = submitterName.split(' ')[0] || submitterName

    // Format date nicely
    let formattedDate = ''
    if (record.event_date) {
      formattedDate = new Date(record.event_date).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    }

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>We received your inquiry</title>
</head>
<body style="margin:0;padding:0;background:#F7F5F0;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F0;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <div style="width:36px;height:36px;background:linear-gradient(135deg,#7C5CBF,#6B8F71);border-radius:10px;display:flex;align-items:center;justify-content:center;">
                      <table cellpadding="0" cellspacing="0" style="margin:auto;">
                        <tr>
                          <td style="width:8px;height:8px;background:rgba(255,255,255,0.9);border-radius:2px;margin:1px;display:inline-block;"></td>
                          <td style="width:2px;"></td>
                          <td style="width:8px;height:8px;background:rgba(255,255,255,0.5);border-radius:2px;display:inline-block;"></td>
                        </tr>
                        <tr><td colspan="3" style="height:2px;"></td></tr>
                        <tr>
                          <td style="width:8px;height:8px;background:rgba(255,255,255,0.5);border-radius:2px;display:inline-block;"></td>
                          <td style="width:2px;"></td>
                          <td style="width:8px;height:8px;background:rgba(255,255,255,0.9);border-radius:2px;display:inline-block;"></td>
                        </tr>
                      </table>
                    </div>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#1A1A2E;letter-spacing:-0.5px;">gabspace</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero card -->
          <tr>
            <td style="background:#1A1A2E;border-radius:20px;padding:40px;margin-bottom:20px;">
              <p style="font-size:12px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin:0 0 12px;">Event Inquiry Received</p>
              <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:700;color:#FFFFFF;margin:0 0 14px;line-height:1.2;letter-spacing:-0.5px;">
                We've got your inquiry,<br/>${firstName}.
              </h1>
              <p style="font-size:15px;color:rgba(255,255,255,0.6);margin:0;line-height:1.7;font-weight:300;">
                Thank you for reaching out about your ${eventTypePart.toLowerCase()} — we're excited to learn more. We'll be in touch within <strong style="color:rgba(255,255,255,0.85);">48 hours</strong> to chat more about your event and how we can make it unforgettable.
              </p>
            </td>
          </tr>

          <tr><td style="height:16px;"></td></tr>

          <!-- Details card -->
          <tr>
            <td style="background:#FFFFFF;border-radius:16px;padding:28px;border:1px solid rgba(0,0,0,0.06);">
              <p style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#8585A0;margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid #f0f0eb;">
                What we received
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                ${record.event_date ? `
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f9f9f7;vertical-align:top;">
                    <span style="font-size:12px;color:#8585A0;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Date</span>
                  </td>
                  <td style="padding:10px 0 10px 16px;border-bottom:1px solid #f9f9f7;text-align:right;">
                    <span style="font-size:14px;color:#1A1A2E;font-weight:500;">${formattedDate}</span>
                  </td>
                </tr>` : ''}
                ${record.venue ? `
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f9f9f7;vertical-align:top;">
                    <span style="font-size:12px;color:#8585A0;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Venue</span>
                  </td>
                  <td style="padding:10px 0 10px 16px;border-bottom:1px solid #f9f9f7;text-align:right;">
                    <span style="font-size:14px;color:#1A1A2E;font-weight:500;">${record.venue}</span>
                  </td>
                </tr>` : ''}
                ${record.headcount ? `
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f9f9f7;vertical-align:top;">
                    <span style="font-size:12px;color:#8585A0;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Guests</span>
                  </td>
                  <td style="padding:10px 0 10px 16px;border-bottom:1px solid #f9f9f7;text-align:right;">
                    <span style="font-size:14px;color:#1A1A2E;font-weight:500;">${record.headcount} estimated</span>
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="padding:10px 0;vertical-align:top;">
                    <span style="font-size:12px;color:#8585A0;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Status</span>
                  </td>
                  <td style="padding:10px 0 10px 16px;text-align:right;">
                    <span style="font-size:12px;font-weight:600;background:#F0EBF9;color:#7C5CBF;padding:4px 12px;border-radius:20px;">Inquiry received</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td style="height:16px;"></td></tr>

          <!-- What's next -->
          <tr>
            <td style="background:#EAF2EA;border-radius:16px;padding:24px;">
              <p style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#6B8F71;margin:0 0 10px;">What happens next</p>
              <p style="font-size:14px;color:#3D3D5C;margin:0;line-height:1.7;">
                Our team will review your inquiry and reach out within <strong>48 hours</strong> to schedule a conversation. We'll talk through your vision, answer any questions, and explore how we can bring your event to life.
              </p>
            </td>
          </tr>

          <tr><td style="height:32px;"></td></tr>

          <!-- Footer -->
          <tr>
            <td style="text-align:center;padding-top:24px;border-top:1px solid rgba(0,0,0,0.08);">
              <p style="font-size:12px;color:#8585A0;margin:0 0 4px;">gabspace — clarity meets creativity</p>
              <p style="font-size:11px;color:#B0B0C0;margin:0;">You're receiving this because you submitted an event inquiry.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'gabspace <onboarding@resend.dev>', // swap for verified domain later
        to: [submitterEmail],
        subject: `We received your ${eventTypePart} inquiry`,
        html,
      }),
    })

    if (!resendRes.ok) {
      const err = await resendRes.text()
      console.error('Resend error:', err)
      return new Response(JSON.stringify({ error: err }), { status: 500 })
    }

    return new Response(JSON.stringify({ sent: true, to: submitterEmail }), { status: 200 })

  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
