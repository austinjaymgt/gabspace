import { useState, useEffect, useMemo } from 'react'
import { theme as t } from '../theme'
import { Icon } from '../components/Icon'
import Toggle from '../components/Toggle'
import CityInput from '../components/community/CityInput'
import { fetchDirectory } from '../utils/community'
import { COMMUNITY_TAGS } from '../utils/communityTaxonomy'
import { cityMatches, citySuggestions } from '../utils/communityHelpers'
import { CommunityHero, TagList, EmptyState, Loading, ErrorText, ListingAvatar } from '../components/community/CommunityUI'
import { pageStyle, inputStyle, cardStyle, secondaryButtonStyle } from '../components/community/communityStyles'

export default function Directory({ userRole, onOpen, onNavigate }) {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState('')
  const [city, setCity] = useState('')
  const [remoteOnly, setRemoteOnly] = useState(false)

  useEffect(() => {
    fetchDirectory()
      .then(setListings)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const cities = useMemo(() => citySuggestions(listings), [listings])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return listings.filter(l => {
      if (tag && !l.tags?.includes(tag)) return false
      if (!cityMatches(l.city, city)) return false
      if (remoteOnly && !l.remote_ok) return false
      if (!q) return true
      return (
        l.display_name.toLowerCase().includes(q) ||
        l.pitch?.toLowerCase().includes(q) ||
        (!!l.city && cityMatches(l.city, q))
      )
    })
  }, [listings, search, tag, city, remoteOnly])

  return (
    <div style={pageStyle}>
      <CommunityHero
        title="Meet the community"
        subtitle="Photographers, planners, makers, and more — creative businesses building alongside you."
        action={['owner', 'co-owner'].includes(userRole) && (
          <button onClick={() => onNavigate('settings')} style={{ ...secondaryButtonStyle, background: 'var(--color-bg-card)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Icon name="add" size="sm" /> List your business
          </button>
        )}
      />

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
        <input type="text" placeholder="Search businesses..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, minWidth: '220px' }} />
        <select value={tag} onChange={e => setTag(e.target.value)} style={inputStyle} aria-label="Filter by tag">
          <option value="">All specialties</option>
          {COMMUNITY_TAGS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        {/* Cities are free-typed on listings, so this is a type-to-search box
            (state names and abbreviations match each other) rather than a
            fixed dropdown. */}
        <CityInput value={city} onChange={setCity} suggestions={cities} placeholder="City or state..." style={{ minWidth: '180px' }} aria-label="Filter by city" />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>
          <Toggle checked={remoteOnly} onChange={() => setRemoteOnly(v => !v)} /> Works remotely
        </label>
      </div>

      <ErrorText>{error}</ErrorText>

      {loading ? <Loading /> : listings.length === 0 ? (
        <EmptyState icon="guests">No one's listed yet. Be the first — turn on "List in directory" in Settings.</EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState icon="search">No one matches those filters yet. Try widening your search.</EmptyState>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
          {visible.map(l => (
            <div key={l.business_space_id} className="gs-cm-card gs-cm-card--link" onClick={() => onOpen('community-listing', l.business_space_id)} style={{ ...cardStyle, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ListingAvatar listing={l} size={48} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: t.fontSizes.md, fontWeight: 600, color: t.colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.display_name}</div>
                  <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {l.city && <><Icon name="location" size="sm" /> {l.city}</>}
                    {l.city && l.remote_ok && ' · '}
                    {l.remote_ok && 'Remote OK'}
                  </div>
                </div>
              </div>
              {l.pitch && (
                <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{l.pitch}</div>
              )}
              <TagList tags={l.tags} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
