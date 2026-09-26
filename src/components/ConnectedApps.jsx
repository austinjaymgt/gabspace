import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

// The gabspace MCP server (supabase/functions/mcp) — what people paste into
// Claude's "Add custom connector".
export const MCP_SERVER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp`

// Apps the user has approved on /oauth/consent (Supabase Auth OAuth grants),
// with a way to disconnect them. Grants are per user, not per business.
export default function ConnectedApps() {
  const [grants, setGrants] = useState(null)
  const [revoking, setRevoking] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    supabase.auth.oauth.listGrants().then(({ data, error: grantsError }) => {
      if (cancelled) return
      if (grantsError) setError("Couldn't load connected apps.")
      setGrants(grantsError ? [] : data || [])
    })
    return () => { cancelled = true }
  }, [])

  async function handleRevoke(clientId) {
    setRevoking(clientId)
    setError(null)
    const { error: revokeError } = await supabase.auth.oauth.revokeGrant({ clientId })
    setRevoking(null)
    if (revokeError) return setError("Couldn't disconnect that app — try again.")
    setGrants(prev => prev.filter(g => g.client.id !== clientId))
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(MCP_SERVER_URL)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked — the URL is still selectable */ }
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary, marginBottom: '4px' }}>Connect Claude</div>
        <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, marginBottom: '10px', maxWidth: '520px' }}>
          In Claude, go to Settings → Connectors → Add custom connector and paste this URL. Claude can then read your active business — clients, projects, tasks, invoices and more — and, when you ask, create tasks, draft invoices and add to your content calendar.
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <code style={{ padding: '8px 12px', borderRadius: t.radius.md, backgroundColor: t.colors.bg, border: `1px solid ${t.colors.borderLight}`, fontSize: t.fontSizes.sm, color: t.colors.textSecondary, wordBreak: 'break-all', userSelect: 'all' }}>
            {MCP_SERVER_URL}
          </code>
          <button onClick={handleCopy} style={buttonStyle}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
      </div>

      <div>
        <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary, marginBottom: '8px' }}>Connected apps</div>
        {grants === null ? (
          <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>Loading…</div>
        ) : grants.length === 0 ? (
          <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>No apps connected yet.</div>
        ) : (
          grants.map(grant => (
            <div key={grant.client.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px 0', borderBottom: `1px solid ${t.colors.borderLight}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                {grant.client.logo_uri && <img src={grant.client.logo_uri} alt="" style={{ width: '28px', height: '28px', borderRadius: t.radius.md, objectFit: 'cover' }} />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>{grant.client.name || 'Unnamed app'}</div>
                  <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
                    Connected {new Date(grant.granted_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <button onClick={() => handleRevoke(grant.client.id)} disabled={revoking === grant.client.id} style={{ ...buttonStyle, color: t.colors.danger }}>
                {revoking === grant.client.id ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          ))
        )}
        {error && <div style={{ marginTop: '10px', fontSize: t.fontSizes.sm, color: t.colors.danger }}>{error}</div>}
      </div>
    </div>
  )
}

const buttonStyle = { padding: '8px 16px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textPrimary, fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans, whiteSpace: 'nowrap' }
