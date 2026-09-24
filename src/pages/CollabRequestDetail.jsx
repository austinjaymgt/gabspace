import { useState, useEffect } from 'react'
import { theme as t } from '../theme'
import { Icon } from '../components/Icon'
import { fetchRequest, fetchListing, fetchMyCommunityBusinesses, fetchMyResponses, createResponse, deleteResponse, friendlyError } from '../utils/community'
import { categoryLabel, NOTE_MAX } from '../utils/communityTaxonomy'
import { PageHeader, Avatar, Chip, TagList, EmptyState, Loading, ErrorText, UpgradePrompt } from '../components/community/CommunityUI'
import { pageStyle, inputStyle, textareaStyle, labelStyle, cardStyle, primaryButtonStyle, secondaryButtonStyle, formatDate, isExpired } from '../components/community/communityStyles'

const RESPONSE_TONES = { pending: 'default', accepted: 'success', declined: 'danger' }

export default function CollabRequestDetail({ targetId: requestId, userRole, onOpen, onNavigate }) {
  const [request, setRequest] = useState(null)
  const [posterListed, setPosterListed] = useState(false)
  const [myBusinesses, setMyBusinesses] = useState([])
  const [myResponses, setMyResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [composing, setComposing] = useState(false)
  const [note, setNote] = useState('')
  const [responderId, setResponderId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)

  async function load() {
    try {
      const [req, biz] = await Promise.all([fetchRequest(requestId), fetchMyCommunityBusinesses()])
      setRequest(req)
      setMyBusinesses(biz)
      if (req) {
        const [listing, responses] = await Promise.all([
          fetchListing(req.business_space_id),
          fetchMyResponses(req.id, biz.map(b => b.business_space_id)),
        ])
        setPosterListed(!!listing)
        setMyResponses(responses)
      }
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (requestId) load() }, [requestId])

  const back = () => onNavigate('community-board')

  if (loading) return <div style={pageStyle}><Loading /></div>
  if (!request) {
    return (
      <div style={pageStyle}>
        <PageHeader onBack={back} backLabel="The Board" />
        <ErrorText>{error}</ErrorText>
        <EmptyState icon="post">This request is no longer available.</EmptyState>
      </div>
    )
  }

  const isMine = myBusinesses.some(b => b.business_space_id === request.business_space_id)
  const expired = isExpired(request)
  const closed = request.status === 'closed' || expired
  const respondedIds = new Set(myResponses.map(r => r.responder_business_space_id))
  // Businesses that can still respond: paid up, not the poster, not already responded.
  const eligible = myBusinesses.filter(b => b.can_post && b.business_space_id !== request.business_space_id && !respondedIds.has(b.business_space_id))
  const isMember = myBusinesses.some(b => b.can_post)

  function startInterest() {
    if (!isMember) { setShowUpgrade(true); return }
    setResponderId(eligible[0]?.business_space_id || '')
    setComposing(true)
  }

  async function submitInterest(e) {
    e.preventDefault()
    if (!responderId) return
    setSubmitting(true)
    setError('')
    try {
      await createResponse({ requestId: request.id, businessSpaceId: responderId, note })
      setComposing(false)
      setNote('')
      await load()
    } catch (err) {
      setError(friendlyError(err))
    }
    setSubmitting(false)
  }

  async function withdraw(id) {
    if (!window.confirm('Withdraw your response? The poster will no longer see it.')) return
    try {
      await deleteResponse(id)
      await load()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const bizName = id => myBusinesses.find(b => b.business_space_id === id)?.name || 'Your business'

  return (
    <div style={{ ...pageStyle, maxWidth: '760px' }}>
      <PageHeader onBack={back} backLabel="The Board" />

      <div className="gs-cm-card" style={{ ...cardStyle, padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <Chip>{categoryLabel(request.category)}</Chip>
          {request.status === 'closed' && <Chip tone="danger">Closed</Chip>}
          {request.status === 'open' && expired && <Chip tone="warning">Expired</Chip>}
          {isMine && <Chip tone="warning">Your request</Chip>}
        </div>
        <h2 style={{ fontFamily: t.fonts.heading, fontSize: '26px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, color: t.colors.textPrimary, margin: 0 }}>{request.title}</h2>
        <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Avatar name={request.poster_display_name} id={request.business_space_id} size={32} />
          <span>
          Posted by{' '}
          {posterListed ? (
            <button onClick={() => onOpen('community-listing', request.business_space_id)} style={{ background: 'none', border: 'none', padding: 0, color: t.colors.primary, fontWeight: 600, fontFamily: t.fonts.sans, fontSize: 'inherit', cursor: 'pointer' }}>
              {request.poster_display_name || 'a business'}
            </button>
          ) : (
            <span style={{ color: t.colors.textSecondary, fontWeight: 600 }}>{request.poster_display_name || 'a business'}</span>
          )}
          {' '}on {formatDate(request.created_at)}
          </span>
        </div>

        {request.description && (
          <p style={{ fontSize: t.fontSizes.md, color: t.colors.textSecondary, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{request.description}</p>
        )}

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>
          {request.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Icon name="location" size="sm" /> {request.location}</span>}
          {request.remote_ok && <Chip tone="success">Remote OK</Chip>}
          {request.needed_by && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Icon name="deadline" size="sm" /> Needed by {formatDate(request.needed_by)}</span>}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: t.colors.textTertiary }}><Icon name="time" size="sm" /> {expired ? 'Expired' : 'Open until'} {formatDate(request.expires_at)}</span>
        </div>

        <TagList tags={request.tags} />
      </div>

      <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {myResponses.map(r => (
          <div className="gs-cm-card" key={r.id} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: t.fontSizes.sm, fontWeight: 600, color: t.colors.textPrimary }}>{bizName(r.responder_business_space_id)} responded</span>
              <Chip tone={RESPONSE_TONES[r.status]}>{r.status[0].toUpperCase() + r.status.slice(1)}</Chip>
            </div>
            {r.note && <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary, whiteSpace: 'pre-wrap' }}>{r.note}</div>}
            {r.status === 'accepted' && (
              <button className="gs-cm-button" onClick={() => onOpen('community-messages', r.id)} style={{ ...primaryButtonStyle(), alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="message" size="sm" /> Message {request.poster_display_name || 'the poster'}
              </button>
            )}
            {r.status === 'pending' && (
              <button onClick={() => withdraw(r.id)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, color: t.colors.textTertiary, fontSize: t.fontSizes.xs, fontFamily: t.fonts.sans, cursor: 'pointer', textDecoration: 'underline' }}>
                Withdraw
              </button>
            )}
          </div>
        ))}

        {isMine ? (
          <button onClick={() => onOpen('community-my-requests', request.id)} style={{ ...secondaryButtonStyle, alignSelf: 'flex-start' }}>
            View responses in My Collabs
          </button>
        ) : closed ? (
          <p style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, margin: 0 }}>This request isn't accepting responses anymore.</p>
        ) : composing ? (
          <form className="gs-cm-card" onSubmit={submitInterest} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {eligible.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>Respond as</label>
                <select value={responderId} onChange={e => setResponderId(e.target.value)} style={inputStyle}>
                  {eligible.map(b => <option key={b.business_space_id} value={b.business_space_id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={labelStyle}>A short note for the poster</label>
              <textarea autoFocus style={textareaStyle} maxLength={NOTE_MAX} placeholder="Why you're a fit, availability, a link to your work…" value={note} onChange={e => setNote(e.target.value)} />
            </div>
            <ErrorText>{error}</ErrorText>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setComposing(false)} style={secondaryButtonStyle}>Cancel</button>
              <button className="gs-cm-button" type="submit" disabled={submitting || !responderId} style={primaryButtonStyle(submitting || !responderId)}>{submitting ? 'Sending…' : 'Send'}</button>
            </div>
          </form>
        ) : isMember && eligible.length === 0 ? (
          myResponses.length === 0 && <p style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, margin: 0 }}>None of your businesses can respond to this request.</p>
        ) : (
          <button className="gs-cm-button" onClick={startInterest} style={{ ...primaryButtonStyle(), alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Icon name="thumbs-up" size="sm" /> I'm interested
          </button>
        )}

        {!composing && <ErrorText>{error}</ErrorText>}
      </div>

      <UpgradePrompt isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} onNavigate={onNavigate} userRole={userRole} />
    </div>
  )
}
