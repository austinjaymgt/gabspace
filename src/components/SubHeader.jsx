import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import { Icon } from './Icon'
import { useIsNotDesktop, useIsMobile } from '../hooks/useMediaQuery'

const allPages = [
  // Core
  { path: 'dashboard',         label: 'Dashboard',         icon: 'dashboard' },
  { path: 'allclients',        label: 'Clients',           icon: 'clients' },
  { path: 'projects',          label: 'Projects',          icon: 'projects' },
  { path: 'tasks',             label: 'Tasks',             icon: 'task-done' },
  { path: 'client-portal-manager', label: 'Portals',       icon: 'portal' },

// Toolkit — Packages & Briefs hidden for now (kept for backup). Spark now lives under Creative Collective.
  // { path: 'packages',          label: 'Packages',          icon: 'book' },
  // { path: 'briefs',            label: 'Briefs',            icon: 'brief' },
  { path: 'resources',         label: 'Resources',         icon: 'resources' },  
 
  // Money
  { path: 'income',            label: 'Income',            icon: 'finance' },
  { path: 'expenses',          label: 'Expenses',          icon: 'finance' },
  { path: 'snapshot',          label: 'Snapshot',          icon: 'finance' },

  // Operations
  { path: 'vendors',           label: 'Vendors',           icon: 'vendors' },

  // Creative Collective
  { path: 'creative-strategy', label: 'Creative Strategy', icon: 'creative' },
  { path: 'campaign-tracking', label: 'Content Calendar',  icon: 'date' },
  { path: 'assets',            label: 'Creative Assets',    icon: 'image' },
  { path: 'spark',             label: 'Spark',             icon: 'sparkles' },

  // Team
  { path: 'team-goals',        label: 'Goals',        icon: 'team-goals' },
  { path: 'pro-dev',           label: 'Pro Dev',           icon: 'star' },
  { path: 'business-events',   label: 'Networking',  icon: 'events' },

]

const validPaths = new Set(allPages.map(p => p.path))

// Mirrors the sidebar's expandable categories — on phone there's no
// expand/collapse affordance, so when you land inside one of these
// sections (e.g. via a bottom-tab or the "More" sheet), show its siblings
// here instead of the favorites row, so the nesting is still visible/reachable.
const CATEGORY_CHILDREN = [
  {
    label: 'Client Management',
    children: [
      { path: 'allclients', label: 'Clients', icon: 'clients' },
      { path: 'projects', label: 'Projects', icon: 'projects' },
      { path: 'tasks', label: 'Tasks', icon: 'task-done' },
    ],
  },
  {
    label: 'Money',
    children: [
      { path: 'income', label: 'Income', icon: 'finance' },
      { path: 'expenses', label: 'Expenses', icon: 'finance' },
      { path: 'snapshot', label: 'Snapshot', icon: 'finance' },
    ],
  },
  {
    label: 'Operations',
    children: [
      { path: 'vendors', label: 'Vendors', icon: 'vendors' },
      { path: 'resources', label: 'Resources', icon: 'resources' },
    ],
  },
  {
    label: 'Creative Collective',
    children: [
      { path: 'spark', label: 'Spark', icon: 'sparkles' },
      { path: 'creative-strategy', label: 'Creative Strategy', icon: 'creative' },
      { path: 'campaign-tracking', label: 'Content Calendar', icon: 'date' },
      { path: 'assets', label: 'Creative Assets', icon: 'image' },
    ],
  },
  {
    label: 'Team',
    children: [
      { path: 'team-goals', label: 'Goals', icon: 'team-goals' },
      { path: 'pro-dev', label: 'Pro Dev', icon: 'star' },
      { path: 'business-events', label: 'Networking', icon: 'events' },
    ],
  },
]

function findCategory(path) {
  return CATEGORY_CHILDREN.find(cat => cat.children.some(c => c.path === path))
}


export default function SubHeader({ currentPage, onNavigate, session, businessSpaceId }) {
  const [settings, setSettings] = useState(null)
  const [business, setBusiness] = useState(null)
  const [showFavPicker, setShowFavPicker] = useState(false)
  const isMobile = useIsNotDesktop()
  const isPhone = useIsMobile()
  const activeCategory = isPhone ? findCategory(currentPage) : null

  useEffect(() => {
    if (session) fetchSettings()
  }, [session])

  useEffect(() => {
    if (businessSpaceId) fetchBusiness()
  }, [businessSpaceId])

  async function fetchSettings() {
    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
    setSettings(data)
  }

  async function fetchBusiness() {
    const { data } = await supabase
      .from('business_spaces')
      .select('name, logo_url')
      .eq('id', businessSpaceId)
      .single()
    setBusiness(data)
  }

  async function toggleFavorite(path) {
    const current = (settings?.favorites || ['dashboard', 'allclients', 'projects'])
      .filter(p => validPaths.has(p))
    const updated = current.includes(path)
      ? current.filter(p => p !== path)
      : current.length < 5
        ? [...current, path]
        : current

    if (settings) {
      await supabase
        .from('user_settings')
        .update({ favorites: updated })
        .eq('user_id', session.user.id)
    } else {
      await supabase
        .from('user_settings')
        .insert({ user_id: session.user.id, favorites: updated })
    }
    fetchSettings()
  }

const favorites = (settings?.favorites || ['dashboard', 'allclients', 'projects']).filter(p => validPaths.has(p))
const favoritePages = allPages.filter(p => favorites.includes(p.path))
const displayPages = activeCategory ? activeCategory.children : favoritePages
  return (
<div style={{
      backgroundColor: t.colors.bgCard,
      borderBottom: `1px solid ${t.colors.borderLight}`,
      padding: isMobile ? '0 12px' : '0 24px',
      height: '44px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      position: 'sticky',
      top: 60,
      zIndex: 29,
    }}>
      <div
        className="subheader-scroll"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flex: 1,
          minWidth: 0,
          overflowX: isMobile ? 'auto' : 'visible',
          overflowY: 'visible',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >        {business?.logo_url && !isMobile && (
          <img
            src={business.logo_url}
            alt="logo"
            style={{
              width: '24px',
              height: '24px',
              borderRadius: t.radius.sm,
              objectFit: 'cover',
              marginRight: '4px',
            }}
          />
        )}

{business?.name && !isMobile && (
          <span style={{
            fontSize: t.fontSizes.sm,
            fontWeight: '600',
            color: t.colors.textSecondary,
            marginRight: '8px',
          }}>
            {business.name}
          </span>
        )}
        {!isMobile && !activeCategory && (
          <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
            Quick access:
          </span>
        )}
        {activeCategory && (
          <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, flexShrink: 0 }}>
            {activeCategory.label}:
          </span>
        )}
        {displayPages.map(page => (
          <button
            key={page.path}
            onClick={() => onNavigate(page.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 10px',
              borderRadius: t.radius.full,
              border: 'none',
              backgroundColor: currentPage === page.path ? t.colors.primaryLight : 'transparent',
              color: currentPage === page.path ? t.colors.primary : t.colors.textSecondary,
              fontSize: t.fontSizes.xs,
              fontWeight: currentPage === page.path ? '600' : '400',
              cursor: 'pointer',
              fontFamily: t.fonts.sans,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => {
              if (currentPage !== page.path) e.currentTarget.style.backgroundColor = t.colors.bgHover
            }}
            onMouseLeave={e => {
              if (currentPage !== page.path) e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <Icon name={page.icon} size="sm" />
            <span>{page.label}</span>
          </button>
        ))}
        {!isMobile && (
          <button
            onClick={() => setShowFavPicker(!showFavPicker)}
            style={{
              padding: '3px 8px',
              borderRadius: t.radius.full,
              border: `1px dashed ${t.colors.border}`,
              backgroundColor: 'transparent',
              color: t.colors.textTertiary,
              fontSize: t.fontSizes.xs,
              cursor: 'pointer',
              fontFamily: t.fonts.sans,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {showFavPicker ? (
              'Done'
            ) : (
              <>
                <Icon name="add" size="sm" />
                Edit
              </>
            )}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
  onClick={() => onNavigate('settings')}
  style={{
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: t.colors.textTertiary,
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
  }}
  title="Settings"
  aria-label="Settings"
>
  <Icon name="settings" size="sm" />
</button>
      </div>

      {showFavPicker && (
        <div style={{
          position: 'absolute',
          top: '44px',
          left: '24px',
          backgroundColor: t.colors.bgCard,
          borderRadius: t.radius.lg,
          border: `1px solid ${t.colors.borderLight}`,
          boxShadow: t.shadows.md,
          padding: '12px',
          zIndex: 100,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: '4px',
          width: '320px',
        }}>
          <div style={{
            gridColumn: 'span 2',
            fontSize: t.fontSizes.xs,
            color: t.colors.textTertiary,
            marginBottom: '8px',
            fontFamily: t.fonts.sans,
          }}>
            Pick up to 5 favorites
          </div>
          {allPages.map(page => {
            const isFav = favorites.includes(page.path)
            const atCap = !isFav && favorites.length >= 5
            return (
            <button
              key={page.path}
              onClick={() => !atCap && toggleFavorite(page.path)}
              disabled={atCap}
              title={atCap ? 'Remove one favorite first (max 5)' : ''}
              style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 10px',
              borderRadius: t.radius.full,
              border: 'none',
              backgroundColor: currentPage === page.path ? t.colors.primaryLight : 'transparent',
              color: currentPage === page.path ? t.colors.primary : t.colors.textSecondary,
              fontSize: t.fontSizes.xs,
              fontWeight: currentPage === page.path ? '600' : '400',
              cursor: 'pointer',
              fontFamily: t.fonts.sans,
              transition: 'background 0.15s',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
            >
              <Icon name={page.icon} size="sm" />
  <span>{page.label}</span>
  {favorites.includes(page.path) && (
    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
      <Icon name="success" size="sm" />
    </span>
  )}
            </button>
            )
          })}
        </div>
      )}
    </div>
  )
}