import { useState, useRef, useEffect } from 'react'
import { theme as t } from '../theme'
import { supabase } from '../supabaseClient'
import Orb from './Orb'
import { fetchPortalActivity, markProjectViewed } from '../utils/portalActivity'
import { fetchOrbiItems } from '../utils/orbiItems'
import { getOrbiBrief } from '../lib/orbi'
import { fetchNotifications, countUnreadNotifications, markNotificationRead, markAllNotificationsRead } from '../utils/community'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function itemLabel(item) {
  if (item.type === 'reaction') return `${item.authorName || 'A client'} reacted ${item.emoji || ''}`
  if (item.type === 'approval') return `${item.deliverableName || 'A deliverable'} was approved`
  return item.authorName || 'A client'
}

function itemIcon(item) {
  if (item.type === 'reaction') return item.emoji
  if (item.type === 'approval') return '✅'
  return '💬'
}

export default function NotificationsPanel({ businessSpaceId, isMobile = false, onNavigate, portalActivityVersion, onPortalActivityChange, session, onSwitchBusinessSpace, onOpenCommunity }) {
  const [open, setOpen] = useState(false)
  const [portalTotal, setPortalTotal] = useState(0)
  // In-app notifications table (Community layer) — account-wide, unlike
  // portal activity which is scoped to the active business.
  const [communityItems, setCommunityItems] = useState([])
  const [communityUnread, setCommunityUnread] = useState(0)
  const total = portalTotal + communityUnread
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef(null)

  // Orbi's cross-business briefing — absorbed from the old corner widget.
  // Fetched lazily on open and cached until a business-space switch
  // invalidates it, same as the widget it replaced.
  const [orbiItems, setOrbiItems] = useState(null)
  const [orbiLoading, setOrbiLoading] = useState(false)
  const [orbiError, setOrbiError] = useState('')
  const [orbiWindowDays, setOrbiWindowDays] = useState(3)
  const orbiRequestIdRef = useRef(0)

  function closeDropdown() {
    setOpen(false)
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        closeDropdown()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function refresh() {
    if (!businessSpaceId) return
    fetchPortalActivity(businessSpaceId).then(({ total, items }) => {
      setPortalTotal(total)
      setItems(items)
    })
    refreshCommunity()
  }

  function refreshCommunity() {
    fetchNotifications().then(setCommunityItems).catch(() => {})
    countUnreadNotifications().then(setCommunityUnread).catch(() => {})
  }

  // No realtime subscription for notifications yet — poll the unread count
  // so the badge picks up new collab activity without a reload.
  useEffect(() => {
    const id = setInterval(() => countUnreadNotifications().then(setCommunityUnread).catch(() => {}), 60000)
    // Lets other parts of the app (e.g. opening a message thread) ask for an
    // immediate refresh instead of waiting for the next poll.
    window.addEventListener('community-notifications-changed', refreshCommunity)
    return () => {
      clearInterval(id)
      window.removeEventListener('community-notifications-changed', refreshCommunity)
    }
  }, [])

  useEffect(refresh, [businessSpaceId, portalActivityVersion])

  async function loadOrbiBrief(force = false) {
    if (!session?.user?.id || !businessSpaceId) return
    const requestId = ++orbiRequestIdRef.current
    try {
      // Cheap check first: if the look-ahead window hasn't changed since
      // the last fetch, the cached brief is still valid — skip the
      // heavier business/items/brief fetch below.
      const { data: settings } = await supabase.from('user_settings').select('orbi_window_days').eq('user_id', session.user.id).maybeSingle()
      if (requestId !== orbiRequestIdRef.current) return
      const days = settings?.orbi_window_days || 3
      if (!force && orbiItems !== null && days === orbiWindowDays) return
      setOrbiWindowDays(days)
      setOrbiLoading(true)
      setOrbiError('')

      // Every non-archived business the user is staff on. Membership RLS
      // (20260926020000) lets these reads span all of them; money rows only
      // come back for businesses where they're an owner or co-owner.
      const { data: memberships } = await supabase
        .from('business_space_members')
        .select('business_space_id, role, business_spaces(name, archived_at)')
        .eq('user_id', session.user.id)
      if (requestId !== orbiRequestIdRef.current) return
      const businesses = (memberships || [])
        .filter(m => ['owner', 'co-owner', 'employee'].includes(m.role) && m.business_spaces && !m.business_spaces.archived_at)
        .map(m => ({ id: m.business_space_id, name: m.business_spaces.name }))

      const rawItems = await fetchOrbiItems(businesses, days)
      if (requestId !== orbiRequestIdRef.current) return
      if (!rawItems.length) {
        setOrbiItems([])
        setOrbiLoading(false)
        return
      }
      const brief = await getOrbiBrief(rawItems)
      if (requestId !== orbiRequestIdRef.current) return
      setOrbiItems(brief)
    } catch (err) {
      if (requestId !== orbiRequestIdRef.current) return
      setOrbiError(err?.message || "Couldn't check in right now — try again in a bit.")
    }
    if (requestId === orbiRequestIdRef.current) setOrbiLoading(false)
  }

  // The business list Orbi aggregates over can change the moment you
  // switch spaces, and a switch is also the clearest signal the user
  // wants a fresh read — invalidate so the next open (or an
  // already-open panel) refetches instead of showing stale data.
  useEffect(() => {
    setOrbiItems(null)
    setOrbiError('')
    if (open) loadOrbiBrief(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessSpaceId])

  function toggleDropdown() {
    if (!open) {
      setLoading(true)
      refresh()
      setLoading(false)
      // Always re-checks orbi_window_days, even when a brief is already
      // cached, so a change saved in Settings takes effect on next open.
      if (!orbiLoading) loadOrbiBrief()
    }
    setOpen(o => !o)
  }

  async function handleItemClick(item) {
    closeDropdown()
    await markProjectViewed(item.portalProjectId)
    onPortalActivityChange?.()
    onNavigate?.('client-portal-manager')
  }

  async function handleCommunityClick(n) {
    closeDropdown()
    if (!n.read_at) {
      await markNotificationRead(n.id)
      refreshCommunity()
    }
    if (n.target_page) onOpenCommunity?.(n.target_page, n.target_id)
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead()
    refreshCommunity()
  }

  async function handleOrbiAction(action) {
    closeDropdown()
    // An item can belong to a business space other than the one currently
    // active, since Orbi's feed spans every business the user is in —
    // switch into it first so the target page shows the right record.
    if (action.business_space_id) await onSwitchBusinessSpace?.(action.business_space_id)
    onNavigate?.(action.handler)
  }

  const noPortalItems = !loading && items.length === 0
  const noOrbiItems = !orbiLoading && !orbiError && (orbiItems?.length || 0) === 0
  const allEmpty = noPortalItems && noOrbiItems && communityItems.length === 0

  const dropdown = open && (
    <div style={{
      position: isMobile ? 'fixed' : 'absolute',
      top: isMobile ? '68px' : 'calc(100% + 8px)',
      left: isMobile ? '12px' : 'auto',
      right: isMobile ? '12px' : 0,
      width: isMobile ? 'auto' : '340px',
      maxHeight: '480px',
      overflowY: 'auto',
      backgroundColor: t.colors.bgCard,
      borderRadius: t.radius.lg,
      border: `1px solid ${t.colors.borderLight}`,
      boxShadow: t.shadows.lg,
      zIndex: 100,
      fontFamily: t.fonts.sans,
    }}>
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${t.colors.borderLight}`, fontSize: t.fontSizes.sm, fontWeight: 700, color: t.colors.textPrimary }}>
        Notifications
      </div>

      {allEmpty && (
        <div style={{ padding: '20px 14px', fontSize: t.fontSizes.sm, color: t.colors.textTertiary, textAlign: 'center' }}>
          No new activity.
        </div>
      )}

      {!allEmpty && (
        <>
          {communityItems.length > 0 && (
            <>
              <div style={{ ...sectionLabelStyle(t), display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span>Community</span>
                {communityUnread > 0 && (
                  <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', padding: 0, fontSize: t.fontSizes.xs, color: t.colors.primary, fontWeight: 600, fontFamily: t.fonts.sans, cursor: 'pointer', textTransform: 'none', letterSpacing: 0 }}>
                    Mark all read
                  </button>
                )}
              </div>
              {communityItems.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleCommunityClick(n)}
                  style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 14px', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = t.colors.bg}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span style={{ flexShrink: 0, marginTop: 6, width: 6, height: 6, borderRadius: '50%', backgroundColor: n.read_at ? 'transparent' : t.colors.primary }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textPrimary, fontWeight: n.read_at ? 400 : 600 }}>{n.title}</div>
                    {n.body && (
                      <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.body}</div>
                    )}
                    <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: 2 }}>{timeAgo(n.created_at)}</div>
                  </div>
                </div>
              ))}
            </>
          )}

          <div style={sectionLabelStyle(t)}>Portal Activity</div>

          {noPortalItems && (
            <div style={sectionEmptyStyle(t)}>Nothing new.</div>
          )}

          {items.map(item => (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 14px', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = t.colors.bg}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{ flexShrink: 0, marginTop: 2 }}>
                {itemIcon(item)}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textPrimary, fontWeight: 600 }}>
                  {itemLabel(item)}
                </div>
                {item.type === 'comment' && item.body && (
                  <div style={{
                    fontSize: t.fontSizes.sm,
                    color: t.colors.textSecondary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {item.body}
                  </div>
                )}
                <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: 2 }}>
                  {item.projectTitle}{item.deliverableName ? ` · ${item.deliverableName}` : ''} · {timeAgo(item.createdAt)}
                </div>
              </div>
            </div>
          ))}

          {items.length > 0 && (
            <div
              onClick={() => { closeDropdown(); onNavigate?.('client-portal-manager') }}
              style={{ padding: '8px 14px', borderBottom: `1px solid ${t.colors.borderLight}`, textAlign: 'center', fontSize: t.fontSizes.sm, fontWeight: 600, color: t.colors.primary, cursor: 'pointer' }}
            >
              View all portals
            </div>
          )}

          <div style={{ ...sectionLabelStyle(t), display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span>Orbi</span>
            <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: 500 }}>next {orbiWindowDays} {orbiWindowDays === 1 ? 'day' : 'days'}</span>
          </div>

          {orbiLoading && (
            <div style={sectionEmptyStyle(t)}>Catching up on things…</div>
          )}

          {!orbiLoading && orbiError && (
            <div style={{ padding: '4px 14px 12px' }}>
              <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary, marginBottom: '6px' }}>{orbiError}</div>
              <button
                onClick={loadOrbiBrief}
                style={{ padding: '5px 12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textPrimary, fontFamily: t.fonts.sans, fontSize: t.fontSizes.xs, cursor: 'pointer' }}
              >
                Try again
              </button>
            </div>
          )}

          {!orbiLoading && !orbiError && noOrbiItems && (
            <div style={sectionEmptyStyle(t)}>You're all caught up.</div>
          )}

          {!orbiLoading && !orbiError && (orbiItems?.length || 0) > 0 && orbiItems.map((item, i) => (
            <div
              key={i}
              style={{
                padding: '8px 14px',
                borderLeft: item.urgent ? `3px solid ${t.colors.danger}` : '3px solid transparent',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '6px',
              }}
            >
              <div style={{ fontSize: t.fontSizes.sm, color: item.urgent ? t.colors.danger : t.colors.textPrimary, fontWeight: item.urgent ? 600 : 400, lineHeight: 1.4 }}>
                {item.phrase}
              </div>
              {item.action && (
                <button
                  onClick={() => handleOrbiAction(item.action)}
                  style={{ padding: '4px 12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.primary, fontFamily: t.fonts.sans, fontSize: t.fontSizes.xs, fontWeight: 600, cursor: 'pointer' }}
                >
                  {item.action.label}
                </button>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={toggleDropdown}
        title="Notifications"
        aria-label="Notifications"
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          padding: 0,
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Orb size={28} urgent={total > 0} />
        {total > 0 && (
          <span style={{
            position: 'absolute',
            top: -4,
            right: -4,
            background: t.colors.primary,
            color: '#fff',
            fontSize: '10px',
            fontWeight: 700,
            borderRadius: t.radius.full,
            minWidth: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
          }}>
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>
      {dropdown}
    </div>
  )
}

function sectionLabelStyle(t) {
  return {
    padding: '10px 14px 4px',
    fontSize: t.fontSizes.xs,
    fontWeight: 700,
    color: t.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  }
}

function sectionEmptyStyle(t) {
  return {
    padding: '2px 14px 12px',
    fontSize: t.fontSizes.sm,
    color: t.colors.textTertiary,
  }
}
