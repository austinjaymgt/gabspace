import { useState, useEffect, useRef } from 'react'
import { theme as t } from '../theme'
import Orb from './Orb'
import { fetchOrbiItems } from '../utils/orbiItems'
import { getOrbiBrief } from '../lib/orbi'

// Wraps the corner Orb with Orbi: on click, it looks at the current
// business space's overdue/upcoming tasks, invoices, events, and projects
// and shows a short friendly rundown. Fetched once per business space and
// cached until the user asks to refresh or switches business spaces.
export default function OrbiWidget({ businessSpaceId, isMobile, onNavigate }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState(null)
  // This widget stays mounted across business-space switches (it's part of
  // the persistent app shell), so a stale in-flight fetch from the previous
  // business space could otherwise land after a newer one and clobber it.
  const requestIdRef = useRef(0)

  async function loadBrief() {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError('')
    try {
      const orbiItems = await fetchOrbiItems(businessSpaceId)
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

  // Switching business spaces invalidates whatever Orbi last fetched —
  // otherwise it'd keep narrating the previous business's items, and its
  // action buttons would navigate you to a page scoped to the *new*
  // business space while describing a record that belongs to the old one.
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

  function handleAction(action) {
    setOpen(false)
    onNavigate?.(action.handler)
  }

  return (
    <div style={{ position: 'relative' }}>
      {open && (
        <div style={s.panel}>
          <div style={s.header}>Orbi</div>

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
                <div key={i} style={s.row}>
                  <div style={s.phrase}>{item.phrase}</div>
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
      <Orb size={isMobile ? 52 : 80} urgent={items?.length > 0} onClick={handleToggle} />
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
  header: {
    fontSize: t.fontSizes.sm,
    fontWeight: 600,
    color: t.colors.textPrimary,
    marginBottom: '8px',
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
    padding: '8px 0',
    borderTop: `1px solid ${t.colors.borderLight}`,
  },
  phrase: {
    fontSize: t.fontSizes.sm,
    color: t.colors.textPrimary,
    lineHeight: 1.4,
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
