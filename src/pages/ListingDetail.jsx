import { useState, useEffect } from 'react'
import { theme as t } from '../theme'
import { Icon } from '../components/Icon'
import { fetchListing, fetchOpenRequestsForBusiness } from '../utils/community'
import { categoryLabel } from '../utils/communityTaxonomy'
import { instagramUrl } from '../utils/communityHelpers'
import { PageHeader, TagList, Chip, EmptyState, Loading, ErrorText, ListingAvatar, CoverBanner } from '../components/community/CommunityUI'
import { pageStyle, cardStyle } from '../components/community/communityStyles'

const linkStyle = { display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: t.fontSizes.sm, fontWeight: 600, color: t.colors.primary, textDecoration: 'none' }

export default function ListingDetail({ targetId: listingId, onOpen, onNavigate }) {
  const [listing, setListing] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!listingId) return
    Promise.all([fetchListing(listingId), fetchOpenRequestsForBusiness(listingId)])
      .then(([l, r]) => { setListing(l); setRequests(r) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [listingId])

  const back = () => onNavigate('community-directory')

  if (loading) return <div style={pageStyle}><Loading /></div>
  if (!listing) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Listing" onBack={back} backLabel="Directory" />
        <ErrorText>{error}</ErrorText>
        <EmptyState icon="guests">This business isn't listed in the directory.</EmptyState>
      </div>
    )
  }

  return (
    <div style={{ ...pageStyle, maxWidth: '760px' }}>
      <PageHeader onBack={back} backLabel="Directory" />

      {/* Profile-style card: gradient cover, avatar overlapping it. */}
      <div className="gs-cm-card" style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <CoverBanner id={listing.business_space_id} />
        <div style={{ padding: '0 28px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ marginTop: '-44px', position: 'relative' }}>
          <ListingAvatar listing={listing} size={88} ring />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div>
            <h2 style={{ fontFamily: t.fonts.heading, fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: t.colors.textPrimary, margin: '0 0 6px' }}>{listing.display_name}</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>
              {listing.city && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Icon name="location" size="sm" /> {listing.city}</span>}
              {listing.remote_ok && <Chip tone="success">Remote OK</Chip>}
            </div>
            {(listing.website || listing.instagram) && (
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '6px' }}>
                {listing.website && (
                  <a href={listing.website} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                    <Icon name="link" size="sm" /> {listing.website.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')}
                  </a>
                )}
                {listing.instagram && (
                  <a href={instagramUrl(listing.instagram)} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                    <Icon name="photography" size="sm" /> @{listing.instagram}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
        {listing.pitch && <p style={{ fontSize: t.fontSizes.lg, color: t.colors.textSecondary, lineHeight: 1.6, margin: 0 }}>{listing.pitch}</p>}
        <TagList tags={listing.tags} />
        </div>
      </div>

      <h3 style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes.lg, fontWeight: 600, color: t.colors.textPrimary, margin: '32px 0 12px' }}>Looking for help with</h3>
      {requests.length === 0 ? (
        <p style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, margin: 0 }}>Nothing open on The Board right now.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {requests.map(r => (
            <div key={r.id} className="gs-cm-card gs-cm-card--link" onClick={() => onOpen('community-request', r.id)} style={{ ...cardStyle, cursor: 'pointer' }}>
              <div style={{ fontSize: t.fontSizes.md, fontWeight: 600, color: t.colors.textPrimary, marginBottom: '6px' }}>{r.title}</div>
              <Chip>{categoryLabel(r.category)}</Chip>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
