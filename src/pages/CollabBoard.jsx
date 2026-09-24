import { useState, useEffect, useMemo } from 'react'
import { theme as t } from '../theme'
import { Icon } from '../components/Icon'
import Toggle from '../components/Toggle'
import CityInput from '../components/community/CityInput'
import PostRequestModal from '../components/community/PostRequestModal'
import { fetchOpenRequests, fetchMyCommunityBusinesses } from '../utils/community'
import { COLLAB_CATEGORIES, categoryLabel } from '../utils/communityTaxonomy'
import { cityMatches, citySuggestions } from '../utils/communityHelpers'
import { CommunityHero, Avatar, Chip, TagList, EmptyState, Loading, ErrorText, UpgradePrompt } from '../components/community/CommunityUI'
import { pageStyle, inputStyle, cardStyle, primaryButtonStyle, formatDate } from '../components/community/communityStyles'

export default function CollabBoard({ userRole, onOpen, onNavigate }) {
  const [requests, setRequests] = useState([])
  const [myBusinesses, setMyBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [showPost, setShowPost] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)

  useEffect(() => {
    Promise.all([fetchOpenRequests(), fetchMyCommunityBusinesses()])
      .then(([reqs, biz]) => { setRequests(reqs); setMyBusinesses(biz) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const locations = useMemo(() => citySuggestions(requests.map(r => ({ city: r.location }))), [requests])
  const postable = myBusinesses.filter(b => b.can_post)
  const myIds = new Set(myBusinesses.map(b => b.business_space_id))

  const visible = useMemo(() => {
    return requests.filter(r => {
      if (category && r.category !== category) return false
      if (remoteOnly && !r.remote_ok) return false
      if (location.trim() && !cityMatches(r.location, location)) return false
      return true
    })
  }, [requests, category, location, remoteOnly])

  function handlePostClick() {
    if (postable.length) setShowPost(true)
    else setShowUpgrade(true)
  }

  return (
    <div style={pageStyle}>
      <CommunityHero
        title="The Board"
        subtitle="Ask for a hand or offer yours. Find your next collaborator — or become someone's."
        action={
          <button className="gs-cm-button" onClick={handlePostClick} style={{ ...primaryButtonStyle(), display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Icon name="add" size="sm" /> Post a request
          </button>
        }
      />

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
        <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle} aria-label="Filter by category">
          <option value="">All categories</option>
          {COLLAB_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <CityInput value={location} onChange={setLocation} suggestions={locations} placeholder="City or state..." style={{ minWidth: '180px' }} aria-label="Filter by location" />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>
          <Toggle checked={remoteOnly} onChange={() => setRemoteOnly(v => !v)} /> Remote OK
        </label>
      </div>

      <ErrorText>{error}</ErrorText>

      {loading ? <Loading /> : requests.length === 0 ? (
        <EmptyState icon="post">The Board is quiet right now. Post the first request and get things moving.</EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState icon="search">No requests match those filters.</EmptyState>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {visible.map(r => (
            <div key={r.id} className="gs-cm-card gs-cm-card--link" onClick={() => onOpen('community-request', r.id)} style={{ ...cardStyle, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px 12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: '1 1 240px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <Avatar name={r.poster_display_name} id={r.business_space_id} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: t.fontSizes.md, fontWeight: 600, color: t.colors.textPrimary }}>{r.title}</div>
                    <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '2px' }}>
                      <span style={{ color: t.colors.textSecondary, fontWeight: 600 }}>{r.poster_display_name || 'A business'}</span> · posted {formatDate(r.created_at)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {myIds.has(r.business_space_id) && <Chip tone="warning">Yours</Chip>}
                  <Chip>{categoryLabel(r.category)}</Chip>
                </div>
              </div>
              {r.description && (
                <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.description}</div>
              )}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
                {r.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Icon name="location" size="sm" /> {r.location}</span>}
                {r.remote_ok && <Chip tone="success">Remote OK</Chip>}
                {r.needed_by && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Icon name="deadline" size="sm" /> Needed by {formatDate(r.needed_by)}</span>}
              </div>
              <TagList tags={r.tags} />
            </div>
          ))}
        </div>
      )}

      {showPost && (
        <PostRequestModal
          isOpen
          onClose={() => setShowPost(false)}
          businesses={postable}
          onCreated={id => { setShowPost(false); onOpen('community-request', id) }}
        />
      )}
      <UpgradePrompt isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} onNavigate={onNavigate} userRole={userRole} />
    </div>
  )
}
