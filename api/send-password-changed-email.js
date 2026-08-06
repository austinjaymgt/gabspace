import { createClient } from '@supabase/supabase-js';
import { escapeHtml, emailShell, sendEmail } from './_lib/email.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Identify the caller from their own access token rather than trusting a
  // client-supplied email — otherwise anyone could get this endpoint to
  // email arbitrary addresses through our Resend account.
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user?.email) return res.status(401).json({ error: 'Invalid or expired session' });

  const firstName = escapeHtml(user.user_metadata?.full_name?.split(' ')[0] || 'there');
  const body = `<p style="font-size:15px;color:#6B7280;line-height:1.75;margin:0;">Hi ${firstName} — this confirms your gabspace password was just changed. If this wasn't you, reply to this email right away.</p>`;
  const html = emailShell('Security', '#c0507a', 'Your password was reset', body, process.env.APP_URL, 'Open gabspace', '#c0507a');

  try {
    await sendEmail({ to: user.email, subject: 'Your gabspace password was reset', html });
  } catch (err) {
    // Non-critical — don't fail the password change over an email hiccup.
    console.error('Password-changed email failed:', err);
  }

  res.status(200).json({ sent: true });
}
