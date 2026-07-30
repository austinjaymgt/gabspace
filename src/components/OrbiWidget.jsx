import { useState, useEffect, useRef } from 'react'
import { theme as t } from '../theme'
import { supabase } from '../supabaseClient'
import Orb from './Orb'
import { fetchOrbiItems } from '../utils/orbiItems'
import { getOrbiBrief } from '../lib/orbi'

// Wraps the corner Orb with Orbi: on click, it looks across every business
// space the user belongs to for overdue/upcoming tasks, invoices, events,
// and projects and shows a short friendly rundown. This is deliberately
// cross-business (like Home.jsx's feed) rather than scoped to whichever
// space is currently active — the active space's own items are already
// visible on its Dashboard, so repeating just that one space here would
// add nothing. Fetched once per session and cached until the user asks
// to refresh.
export default function OrbiWidget({ session, businessSpaceId, onSwitchBusinessSpace, isMobile, onNavigate }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState(null)
  const [windowDays, setWindowDays] = useState(3)
  const requestIdRef = useRef(0)

  async function loadBrief() {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError('')
    try {
      const [{ data }, { data: settings }] = await Promise.all([
        supabase
          .from('business_space_members')
          .select('business_space_id, business_spaces(id, name, archived_at)')
          .eq('user_id', session.user.id),
        supabase.from('user_settings').select('orbi_window_days').eq('user_id', session.user.id).maybeSingle(),
      ])
      const businesses = (data || [])
        .filter(r => r.business_spaces && !r.business_spaces.archived_at)
        .map(r => ({ id: r.business_spaces.id, name: r.business_spaces.name }))
      const days = settings?.orbi_window_days || 3
      if (requestId !== requestIdRef.current) return
      setWindowDays(days)

      const orbiItems = await fetchOrbiItems(businesses, days)
      if (requestId !== requestIdRef.current) return
      if (!orbiItems.length) {
        setItems([])
        setLoading(false)
        return
      }
      const brief = await getOrbiBrief(orbiItems)
      if (requestId !== requestIdRef.current) return
      setItems(brief)
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      setError(err?.message || "Couldn't check in right now — try again in a bit.")
    }
    if (requestId === requestIdRef.current) setLoading(false)
  }

  // Orbi's own item set is cross-business and doesn't strictly depend on
  // which space is active, but the business list it aggregates over can
  // change the moment you switch (e.g. you just joined or created one) —
  // and a switch is also the clearest signal the user wants a fresh read.
  // Invalidate the cache so the next open (or an already-open panel)
  // refetches instead of showing whatever was cached from before.
  useEffect(() => {
    setItems(null)
    setError('')
    if (open) loadBrief()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessSpaceId])

  function handleToggle() {
    const next = !open
    setOpen(next)
    if (next && items === null && !loading) loadBrief()
  }

  async function handleAction(action) {
    setOpen(false)
    // An item can belong to a business space other than the one currently
    // active, since Orbi's feed spans every business the user is in —
    // switch into it first so the target page shows the right record.
    if (action.business_space_id) await onSwitchBusinessSpace?.(action.business_space_id)
    onNavigate?.(action.handler)
  }

  return (
    <div style={{ position: 'relative' }}>
      {open && (
        <div style={s.panel}>
          <div style={s.headerRow}>
            <div style={s.header}>Orbi</div>
            <div style={s.windowLabel}>next {windowDays} {windowDays === 1 ? 'day' : 'days'}</div>
          </div>

          {loading && <div style={s.status}>Catching up on things…</div>}

          {!loading && error && (
            <div style={s.errorBlock}>
              <div style={s.status}>{error}</div>
              <button style={s.retryBtn} onClick={loadBrief}>Try again</button>
            </div>
          )}

          {!loading && !error && items?.length === 0 && (
            <div style={s.status}>You're all caught up — nothing from me right now.</div>
          )}

          {!loading && !error && items?.length > 0 && (
            <div style={s.list}>
              {items.map((item, i) => (
                <div key={i} style={{ ...s.row, ...(item.urgent ? s.rowUrgent : null) }}>
                  <div style={{ ...s.phrase, ...(item.urgent ? s.phraseUrgent : null) }}>{item.phrase}</div>
                  {item.action && (
                    <button style={s.actionBtn} onClick={() => handleAction(item.action)}>
                      {item.action.label}
                    </button>
                  )}
                </div>
              ))}
              <button style={s.refreshBtn} onClick={loadBrief}>Refresh</button>
            </div>
          )}
        </div>
      )}
      <Orb size={isMobile ? 52 : 80} urgent={items?.some(item => item.urgent) || false} onClick={handleToggle} />
    </div>
  )
}

const s = {
  panel: {
    position: 'absolute',
    bottom: 'calc(100% + 14px)',
    right: 0,
    width: '300px',
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: '360px',
    overflowY: 'auto',
    boxSizing: 'border-box',
    backgroundColor: t.colors.bgCard,
    borderRadius: t.radius.lg,
    border: `1px solid ${t.colors.borderLight}`,
    boxShadow: t.shadows.lg,
    fontFamily: t.fonts.sans,
    padding: '14px 16px',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '8px',
  },
  header: {
    fontSize: t.fontSizes.sm,
    fontWeight: 600,
    color: t.colors.textPrimary,
  },
  windowLabel: {
    fontSize: t.fontSizes.xs,
    color: t.colors.textTertiary,
  },
  status: {
    fontSize: t.fontSizes.sm,
    color: t.colors.textSecondary,
    lineHeight: 1.4,
  },
  errorBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  retryBtn: {
    alignSelf: 'flex-start',
    padding: '6px 14px',
    borderRadius: t.radius.full,
    border: `1px solid ${t.colors.border}`,
    backgroundColor: 'transparent',
    color: t.colors.textPrimary,
    fontFamily: t.fonts.sans,
    fontSize: t.fontSizes.sm,
    cursor: 'pointer',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '6px',
    padding: '8px 0 8px 10px',
    borderTop: `1px solid ${t.colors.borderLight}`,
    borderLeft: '3px solid transparent',
  },
  rowUrgent: {
    borderLeft: `3px solid ${t.colors.danger}`,
  },
  phrase: {
    fontSize: t.fontSizes.sm,
    color: t.colors.textPrimary,
    lineHeight: 1.4,
  },
  phraseUrgent: {
    fontWeight: 600,
    color: t.colors.danger,
  },
  actionBtn: {
    padding: '4px 12px',
    borderRadius: t.radius.full,
    border: `1px solid ${t.colors.border}`,
    backgroundColor: 'transparent',
    color: t.colors.primary,
    fontFamily: t.fonts.sans,
    fontSize: t.fontSizes.xs,
    fontWeight: 600,
    cursor: 'pointer',
  },
  refreshBtn: {
    alignSelf: 'center',
    marginTop: '4px',
    padding: '4px 10px',
    border: 'none',
    background: 'none',
    color: t.colors.textTertiary,
    fontFamily: t.fonts.sans,
    fontSize: t.fontSizes.xs,
    cursor: 'pointer',
  },
}
