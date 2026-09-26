import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import gabspaceLockup from '../assets/gabspace-lockup-dark-bg.svg'

// OAuth consent screen for the Supabase Auth OAuth 2.1 server — where an
// MCP client like Claude lands (/oauth/consent?authorization_id=...) after
// asking to connect. App only renders this once the user is signed in, so
// the login screen in front of it keeps the URL (and authorization_id)
// intact through sign-in.

const STAFF_ROLES = ['owner', 'co-owner', 'employee']

// What the connector's tools can read today (supabase/functions/_shared/
// gabspace-tools). Keep in sync when tools are added.
const ACCESS_ITEMS = [
  'Your businesses and your role in each',
  'Clients, projects, milestones and tasks',
  'Invoices and money summaries (owners and co-owners only)',
  'Content calendar and networking events',
  'Open requests on The Board',
]

export default function OAuthConsent({ session }) {
  const authorizationId = new URLSearchParams(window.location.search).get('authorization_id')
  const [details, setDetails] = useState(null)
  const [isStaff, setIsStaff] = useState(true)
  const [loading, setLoading] = useState(true)
  const [deciding, setDeciding] = useState(null) // 'approve' | 'deny' | null
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!authorizationId) {
      setError('This link is missing its authorization request. Start connecting again from the app you came from.')
      setLoading(false)
      return
    }
    let cancelled = false
    Promise.all([
      supabase.auth.oauth.getAuthorizationDetails(authorizationId),
      supabase.from('business_space_members').select('role').eq('user_id', session.user.id),
    ]).then(([{ data, error: detailsError }, { data: memberships }]) => {
      if (cancelled) return
      if (detailsError) {
        setError(detailsError.message || 'This authorization request has expired. Start connecting again from the app you came from.')
      } else if (!('authorization_id' in data)) {
        // Already approved before — Supabase hands back the redirect directly.
        window.location.href = data.redirect_url
        return
      } else {
        setDetails(data)
        setIsStaff((memberships || []).some(m => STAFF_ROLES.includes(m.role)))
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [authorizationId, session.user.id])

  async function decide(approve) {
    setDeciding(approve ? 'approve' : 'deny')
    setError(null)
    const decideFn = approve ? supabase.auth.oauth.approveAuthorization : supabase.auth.oauth.denyAuthorization
    const { data, error: decideError } = await decideFn(authorizationId, { skipBrowserRedirect: true })
    if (decideError || !data?.redirect_url) {
      setDeciding(null)
      setError(decideError?.message || 'Something went wrong — try again.')
      return
    }
    window.location.href = data.redirect_url
  }

  const clientName = details?.client?.name || 'This app'
  let redirectHost = null
  try { redirectHost = details?.redirect_uri ? new URL(details.redirect_uri).host : null } catch { /* leave null */ }

  return (
    <div className="force-light-theme" style={s.page}>
      <img src={gabspaceLockup} alt="gabspace" style={{ height: '44px', width: 'auto' }} />
      <div style={s.card}>
        {loading ? (
          <p style={s.muted}>Loading…</p>
        ) : !details ? (
          <>
            <h1 style={s.title}>Can't connect right now</h1>
            <div style={s.error}>{error}</div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              {details.client?.logo_uri && (
                <img src={details.client.logo_uri} alt="" style={{ width: '40px', height: '40px', borderRadius: t.radius.md, objectFit: 'cover' }} />
              )}
              <h1 style={{ ...s.title, margin: 0 }}>Connect {clientName} to gabspace?</h1>
            </div>

            {isStaff ? (
              <>
                <p style={s.body}>
                  {clientName} will be able to <strong>read</strong> this from the business you have active in gabspace. It can't change anything yet.
                </p>
                <ul style={s.list}>
                  {ACCESS_ITEMS.map(item => <li key={item} style={{ marginBottom: '6px' }}>{item}</li>)}
                </ul>
                <p style={s.fine}>
                  Signed in as {details.user?.email}.{redirectHost && <> You'll be sent back to <strong>{redirectHost}</strong>.</>} You can disconnect any time in Settings → Connected apps.
                </p>
              </>
            ) : (
              <div style={s.error}>
                The gabspace connector is for business owners, co-owners and employees. Your account only has client access, so there's nothing it could read.
              </div>
            )}

            {error && <div style={{ ...s.error, marginTop: '16px' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => decide(false)} disabled={!!deciding} style={s.secondary}>
                {deciding === 'deny' ? 'Cancelling…' : 'Cancel'}
              </button>
              {isStaff && (
                <button onClick={() => decide(true)} disabled={!!deciding} style={s.primary}>
                  {deciding === 'approve' ? 'Connecting…' : `Allow ${clientName}`}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '28px', backgroundImage: 'var(--gradient-bg)', fontFamily: t.fonts.sans, padding: '24px 0' },
  card: { backgroundColor: t.colors.bgCard, borderRadius: t.radius.card, padding: '40px', width: '100%', maxWidth: '460px', boxShadow: t.shadows.lg, margin: '0 16px', boxSizing: 'border-box' },
  title: { fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 16px' },
  body: { fontSize: t.fontSizes.md, color: t.colors.textSecondary, margin: '0 0 12px', lineHeight: 1.5 },
  list: { fontSize: t.fontSizes.base, color: t.colors.textSecondary, margin: '0 0 16px', paddingLeft: '20px', lineHeight: 1.5 },
  fine: { fontSize: t.fontSizes.sm, color: t.colors.textTertiary, margin: 0, lineHeight: 1.5 },
  muted: { fontSize: t.fontSizes.md, color: t.colors.textTertiary, margin: 0, fontStyle: 'italic' },
  error: { padding: '10px 14px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.base },
  primary: { flex: 1, padding: '12px', borderRadius: t.radius.full, border: 'none', backgroundColor: t.colors.primary, color: '#FFFFFF', fontSize: t.fontSizes.md, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans },
  secondary: { flex: 1, padding: '12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textPrimary, fontSize: t.fontSizes.md, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans },
}
