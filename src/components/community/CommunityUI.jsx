import { theme as t } from '../../theme'
import { Icon } from '../Icon'
import Modal from '../Modal'
import { tagLabel } from '../../utils/communityTaxonomy'
import { pickIndex } from '../../utils/communityHelpers'
import { primaryButtonStyle, secondaryButtonStyle } from './communityStyles'
import './community.css'

// Small shared components for the Community pages. The warm Community look
// lives in community.css, scoped to .gs-community (App.jsx wraps every
// Community page in it).

// Hero banner at the top of the main Community pages.
export function CommunityHero({ eyebrow = 'Community', title, subtitle, action }) {
  return (
    <div className="gs-cm-hero">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, maxWidth: '620px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: t.fontSizes.xs, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--cm-hero-sub)', marginBottom: '8px' }}>
            <Icon name="guests" size="sm" /> {eyebrow}
          </div>
          <h2 style={{ fontFamily: t.fonts.heading, fontSize: '30px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15, color: 'var(--cm-hero-ink)', margin: '0 0 6px' }}>{title}</h2>
          {subtitle && <p style={{ fontSize: t.fontSizes.md, lineHeight: 1.5, color: 'var(--cm-hero-sub)', margin: 0 }}>{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  )
}

// Soft gradients for avatars and listing covers — each business always
// gets the same one. Light enough that dark ink reads on them in both themes.
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #ffc9a8 0%, #f59ab5 100%)',
  'linear-gradient(135deg, #bfe3fb 0%, #a9b8ff 100%)',
  'linear-gradient(135deg, #b8f0e6 0%, #7fd9cc 100%)',
  'linear-gradient(135deg, #f7cdea 0%, #c3b1f0 100%)',
  'linear-gradient(135deg, #ffe39e 0%, #f7b58a 100%)',
  'linear-gradient(135deg, #d2f3c9 0%, #8fd6b0 100%)',
]

// Round, colorful initial avatar for a business (or its logo, if set).
export function Avatar({ name, id, logoUrl, size = 40, ring = false }) {
  const ringStyle = ring ? { boxShadow: '0 0 0 4px var(--color-bg-card)' } : {}
  if (logoUrl) {
    return <img src={logoUrl} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, ...ringStyle }} />
  }
  return (
    <div aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', background: AVATAR_GRADIENTS[pickIndex(id || name, AVATAR_GRADIENTS.length)], color: '#2b1a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: t.fonts.heading, fontWeight: 700, fontSize: Math.round(size * 0.42), flexShrink: 0, ...ringStyle }}>
      {name?.trim()?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

// Profile-style cover strip for a listing — the gradient after its avatar's,
// so the avatar stands out against it.
export function CoverBanner({ id, height = 110 }) {
  const i = (pickIndex(id, AVATAR_GRADIENTS.length) + 1) % AVATAR_GRADIENTS.length
  return <div aria-hidden="true" style={{ height, background: AVATAR_GRADIENTS[i] }} />
}

export function PageHeader({ title, subtitle, action, onBack, backLabel = 'Back' }) {
  return (
    <div style={{ marginBottom: title ? '24px' : '8px' }}>
      {onBack && (
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', padding: 0, marginBottom: '12px', color: t.colors.textTertiary, fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, cursor: 'pointer' }}>
          <Icon name="back" size="sm" /> {backLabel}
        </button>
      )}
      {title && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 4px' }}>{title}</h2>
            {subtitle && <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: 0 }}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
    </div>
  )
}

export function Chip({ children, tone = 'default', className }) {
  const tones = {
    default: { bg: t.colors.bgHover, color: t.colors.textSecondary },
    primary: { bg: t.colors.primaryLight, color: t.colors.primary },
    success: { bg: t.colors.successLight, color: t.colors.success },
    warning: { bg: t.colors.warningLight, color: t.colors.warning },
    danger: { bg: t.colors.dangerLight, color: t.colors.danger },
  }
  const c = tones[tone] || tones.default
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: t.radius.full, backgroundColor: c.bg, color: c.color, fontSize: t.fontSizes.xs, fontWeight: 500, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

export function TagList({ tags }) {
  if (!tags?.length) return null
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {tags.map(tag => <Chip key={tag} className={`gs-cm-tag-${pickIndex(tag, 6)}`}>{tagLabel(tag)}</Chip>)}
    </div>
  )
}

// Toggle-chip picker over a fixed option list (tags/categories).
export function OptionPicker({ options, value = [], onChange, max }) {
  const atMax = max && value.length >= max
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {options.map(opt => {
        const selected = value.includes(opt.key)
        const disabled = !selected && atMax
        return (
          <button
            key={opt.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(selected ? value.filter(v => v !== opt.key) : [...value, opt.key])}
            style={{
              padding: '5px 12px',
              borderRadius: t.radius.full,
              border: `1px solid ${selected ? t.colors.primary : t.colors.border}`,
              backgroundColor: selected ? t.colors.primaryLight : 'transparent',
              color: selected ? t.colors.primary : t.colors.textSecondary,
              fontSize: t.fontSizes.xs,
              fontWeight: 500,
              fontFamily: t.fonts.sans,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function ListingAvatar({ listing, size = 40, ring = false }) {
  return <Avatar name={listing.display_name} id={listing.business_space_id} logoUrl={listing.logo_url} size={size} ring={ring} />
}

export function EmptyState({ icon = 'empty', children }) {
  return (
    <div style={{ padding: '48px 16px', textAlign: 'center', color: t.colors.textTertiary }}>
      <div style={{ width: 56, height: 56, margin: '0 auto', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.colors.primaryLight, color: t.colors.primary }}>
        <Icon name={icon} size="lg" />
      </div>
      <p style={{ fontSize: t.fontSizes.md, marginTop: '14px', maxWidth: '420px', marginInline: 'auto', lineHeight: 1.5 }}>{children}</p>
    </div>
  )
}

export function Loading() {
  return <div style={{ padding: '48px 0', textAlign: 'center', color: t.colors.textTertiary, fontSize: t.fontSizes.sm }}>Loading…</div>
}

export function ErrorText({ children }) {
  if (!children) return null
  return <div style={{ fontSize: t.fontSizes.sm, color: t.colors.danger }}>{children}</div>
}

// Shown to signed-in non-members who try to post or respond. Only owners/
// co-owners can reach Pricing, so everyone else is pointed at their owner.
export function UpgradePrompt({ isOpen, onClose, onNavigate, userRole }) {
  const canUpgrade = ['owner', 'co-owner'].includes(userRole)
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Members only" size="sm">
      <p style={{ fontSize: t.fontSizes.md, color: t.colors.textSecondary, margin: 0, lineHeight: 1.5 }}>
        Anyone can browse the board, but posting requests and responding to them is part of an active gabspace membership.
      </p>
      {canUpgrade ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onClose} style={secondaryButtonStyle}>Not now</button>
          <button className="gs-cm-button" onClick={() => { onClose(); onNavigate?.('pricing') }} style={primaryButtonStyle()}>View plans</button>
        </div>
      ) : (
        <p style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, margin: 0 }}>
          Ask the owner of your business about membership.
        </p>
      )}
    </Modal>
  )
}
