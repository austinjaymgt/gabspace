import { useState, useEffect, useRef } from 'react'
import { theme as t } from '../theme'
import { Icon } from '../components/Icon'
import CollabMessages from '../components/community/CollabMessages'
import { fetchMyCommunityBusinesses, fetchRequestsPostedBy, fetchResponsesSentBy, fetchThreads, setRequestStatus, setResponseStatus, deleteResponse, friendlyError } from '../utils/community'
import { categoryLabel } from '../utils/communityTaxonomy'
import { CommunityHero, Avatar, Chip, EmptyState, Loading, ErrorText } from '../components/community/CommunityUI'
import { pageStyle, cardStyle, primaryButtonStyle, secondaryButtonStyle, formatDate, isExpired } from '../components/community/communityStyles'

const RESPONSE_TONES = { pending: 'default', accepted: 'success', declined: 'danger' }
const statusLabel = s => s[0].toUpperCase() + s.slice(1)

// The user's side of the Board, in three tabs:
//   Posted     requests their businesses posted + incoming responses
//   Responded  responses their businesses sent + where each stands
//   Messages   threads for every accepted response, from either side
// `targetId` (from a notification) highlights a posted request, or — with
// initialTab 'messages' — opens that response's thread.
export default function MyCollabRequests({ targetId, initialTab = 'posted', onOpen, onNavigate }) {
  const [tab, setTab] = useState(initialTab)
  const [threadId, setThreadId] = useState(initialTab === 'messages' ? targetId : null)
  const [businessIds, setBusinessIds] = useState([])
  const [posted, setPosted] = useState([])
  const [sent, setSent] = useState([])
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const targetRef = useRef(null)

  function load() {
    return fetchMyCommunityBusinesses()
      .then(async biz => {
        const ids = biz.map(b => b.business_space_id)
        const [p, s, th] = await Promise.all([fetchRequestsPostedBy(ids), fetchResponsesSentBy(ids), fetchThreads(ids)])
        setBusinessIds(ids)
        setPosted(p)
        setSent(s)
        setThreads(th)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!loading && targetRef.current) targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [loading])

  const reloadThreads = () => fetchThreads(businessIds).then(setThreads).catch(() => {})

  async function run(id, fn) {
    setBusyId(id)
    setError('')
    let ok = false
    try {
      await fn()
      await load()
      ok = true
    } catch (err) {
      setError(friendlyError(err))
    }
    setBusyId(null)
    return ok
  }

  function openThread(responseId) {
    setThreadId(responseId)
    setTab('messages')
  }

  const unread = threads.reduce((sum, th) => sum + th.unread, 0)
  const tabs = [
    { key: 'posted', label: 'Posted', count: posted.length },
    { key: 'responded', label: 'Responded', count: sent.length },
    { key: 'messages', label: 'Messages', badge: unread },
  ]

  return (
    <div style={{ ...pageStyle, maxWidth: tab === 'messages' ? '1000px' : '860px' }}>
      <CommunityHero
        title="My Collabs"
        subtitle="Your posts, your pitches, and the conversations that turn into collabs."
        action={<button onClick={() => onNavigate('community-board')} style={{ ...secondaryButtonStyle, background: 'var(--color-bg-card)' }}>Browse The Board</button>}
      />

      <div style={{ display: 'inline-flex', gap: '4px', background: t.colors.bgCard, borderRadius: t.radius.full, padding: '4px', border: `0.5px solid ${t.colors.border}`, marginBottom: '20px' }}>
        {tabs.map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: t.fontSizes.sm, fontWeight: '500', padding: '7px 14px', borderRadius: t.radius.full, cursor: 'pointer', border: 'none', background: tab === tb.key ? t.colors.nav : 'transparent', color: tab === tb.key ? '#fff' : t.colors.textTertiary, fontFamily: t.fonts.sans, whiteSpace: 'nowrap' }}
          >
            {tb.label}
            {!loading && tb.count > 0 && <span style={{ opacity: 0.7 }}>{tb.count}</span>}
            {tb.badge > 0 && (
              <span style={{ background: t.colors.primary, color: '#fff', fontSize: '10px', fontWeight: 700, borderRadius: t.radius.full, minWidth: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{tb.badge}</span>
            )}
          </button>
        ))}
      </div>

      <ErrorText>{error}</ErrorText>

      {loading ? <Loading /> : !businessIds.length ? (
        <EmptyState icon="post">Only business owners and co-owners can post or respond on The Board.</EmptyState>
      ) : tab === 'messages' ? (
        <CollabMessages threads={threads} selectedId={threadId} onSelect={setThreadId} onThreadsChanged={reloadThreads} onOpen={onOpen} />
      ) : tab === 'responded' ? (
        <RespondedTab responses={sent} busyId={busyId} onOpen={onOpen} onOpenThread={openThread} onWithdraw={id => {
          if (window.confirm('Withdraw your response? The poster will no longer see it.')) run(id, () => deleteResponse(id))
        }} />
      ) : posted.length === 0 ? (
        <EmptyState icon="post">You haven't posted any requests yet.</EmptyState>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {posted.map(r => {
            const expired = isExpired(r)
            const responses = [...(r.collab_responses || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            const pending = responses.filter(x => x.status === 'pending').length
            const highlighted = tab === initialTab && r.id === targetId
            return (
              <div
                key={r.id}
                ref={highlighted ? targetRef : null}
                className="gs-cm-card"
                style={{ ...cardStyle, padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', borderColor: highlighted ? t.colors.primary : t.colors.borderLight }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <button onClick={() => onOpen('community-request', r.id)} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', fontSize: t.fontSizes.md, fontWeight: 600, color: t.colors.textPrimary, fontFamily: t.fonts.sans, cursor: 'pointer' }}>
                      {r.title}
                    </button>
                    <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '4px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span>{r.poster_display_name}</span>·<span>{categoryLabel(r.category)}</span>·
                      <span>{expired ? 'Expired' : 'Open until'} {formatDate(r.expires_at)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {r.status === 'closed' ? <Chip tone="danger">Closed</Chip> : expired ? <Chip tone="warning">Expired</Chip> : <Chip tone="success">Open</Chip>}
                    {r.status === 'open' ? (
                      <button disabled={busyId === r.id} onClick={() => run(r.id, () => setRequestStatus(r.id, 'closed'))} style={secondaryButtonStyle}>Close request</button>
                    ) : !expired && (
                      <button disabled={busyId === r.id} onClick={() => run(r.id, () => setRequestStatus(r.id, 'open'))} style={secondaryButtonStyle}>Reopen</button>
                    )}
                  </div>
                </div>

                <div style={{ borderTop: `1px solid ${t.colors.borderLight}`, paddingTop: '12px' }}>
                  <div style={{ fontSize: t.fontSizes.xs, fontWeight: 700, color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                    Responses ({responses.length}{pending ? `, ${pending} pending` : ''})
                  </div>
                  {responses.length === 0 ? (
                    <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>No responses yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {responses.map(resp => (
                        <div key={resp.id} style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', padding: '10px 12px', borderRadius: t.radius.md, backgroundColor: t.colors.bg }}>
                          <div style={{ minWidth: 0, flex: '1 1 260px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <Avatar name={resp.responder_display_name} id={resp.responder_business_space_id} size={36} />
                            <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontSize: t.fontSizes.sm, fontWeight: 600, color: t.colors.textPrimary }}>{resp.responder_display_name || 'A business'}</span>
                              <Chip tone={RESPONSE_TONES[resp.status]}>{statusLabel(resp.status)}</Chip>
                            </div>
                            {resp.note && <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary, marginTop: '4px', whiteSpace: 'pre-wrap' }}>{resp.note}</div>}
                            <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '4px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {formatDate(resp.created_at)}
                              <button onClick={() => onOpen('community-listing', resp.responder_business_space_id)} style={{ background: 'none', border: 'none', padding: 0, color: t.colors.primary, fontSize: 'inherit', fontFamily: t.fonts.sans, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                View listing <Icon name="external" size="sm" />
                              </button>
                            </div>
                            </div>
                          </div>
                          {resp.status === 'pending' && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button disabled={busyId === resp.id} onClick={() => run(resp.id, () => setResponseStatus(resp.id, 'declined'))} style={secondaryButtonStyle}>Decline</button>
                              <button className="gs-cm-button" disabled={busyId === resp.id} onClick={() => run(resp.id, () => setResponseStatus(resp.id, 'accepted')).then(ok => ok && openThread(resp.id))} style={primaryButtonStyle(busyId === resp.id)}>Accept</button>
                            </div>
                          )}
                          {resp.status === 'accepted' && (
                            <button className="gs-cm-button" onClick={() => openThread(resp.id)} style={{ ...primaryButtonStyle(), display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <Icon name="message" size="sm" /> Message
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RespondedTab({ responses, busyId, onOpen, onOpenThread, onWithdraw }) {
  if (!responses.length) {
    return <EmptyState icon="post">You haven't responded to any requests yet. Find one on The Board.</EmptyState>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {responses.map(resp => {
        const req = resp.collab_requests
        return (
          <div className="gs-cm-card" key={resp.id} style={{ ...cardStyle, display: 'flex', gap: '12px', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: '1 1 320px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              {req && <Avatar name={req.poster_display_name} id={req.business_space_id} size={40} />}
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {req ? (
                <button onClick={() => onOpen('community-request', req.id)} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', fontSize: t.fontSizes.md, fontWeight: 600, color: t.colors.textPrimary, fontFamily: t.fonts.sans, cursor: 'pointer' }}>
                  {req.title}
                </button>
              ) : (
                <span style={{ fontSize: t.fontSizes.md, fontWeight: 600, color: t.colors.textTertiary }}>Request no longer available</span>
              )}
              <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
                {req?.poster_display_name || 'A business'} · you responded {formatDate(resp.created_at)}
              </div>
              {resp.note && <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary, whiteSpace: 'pre-wrap' }}>{resp.note}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Chip tone={RESPONSE_TONES[resp.status]}>{statusLabel(resp.status)}</Chip>
              {resp.status === 'accepted' && (
                <button className="gs-cm-button" onClick={() => onOpenThread(resp.id)} style={{ ...primaryButtonStyle(), display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Icon name="message" size="sm" /> Message
                </button>
              )}
              {resp.status === 'pending' && (
                <button disabled={busyId === resp.id} onClick={() => onWithdraw(resp.id)} style={secondaryButtonStyle}>Withdraw</button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
