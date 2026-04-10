import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

const allPages = [
  { path: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { path: 'clients', label: 'Clients', icon: '👥' },
  { path: 'client-portal', label: 'Portals', icon: '🔗' },
  { path: 'projects', label: 'Projects', icon: '📋' },
  { path: 'tasks', label: 'Tasks', icon: '✅' },
  { path: 'vendors', label: 'Vendors', icon: '🏪' },
  { path: 'finance-overview', label: 'Finances', icon: '📊' },
  { path: 'revenue', label: 'Revenue', icon: '💵' },
  { path: 'expenses', label: 'Expenses', icon: '💸' },
  { path: 'campaigns', label: 'Campaigns', icon: '📣' },
  { path: 'campaign-tracking', label: 'Content Calendar', icon: '🗓' },
  { path: 'business-events', label: 'Community Events', icon: '🎯' },
  { path: 'assets', label: 'Company Assets', icon: '🎨' },
]

export default function SubHeader({ currentPage, onNavigate, session }) {
  const [settings, setSettings] = useState(null)
  const [showFavPicker, setShowFavPicker] = useState(false)

  useEffect(() => {
    if (session) fetchSettings()
  }, [session])

  async function fetchSettings() {
    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
    setSettings(data)
  }

  async function toggleFavorite(path) {
    const current = settings?.favorites || ['dashboard', 'clients', 'invoices']
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

  const favorites = settings?.favorites || ['dashboard', 'clients', 'invoices']
  const favoritePages = allPages.filter(p => favorites.includes(p.path))

  return (
    <div style={{
      backgroundColor: '#FAFAF8',
      borderBottom: `1px solid ${t.colors.borderLight}`,
      padding: '0 24px',
      height: '44px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {settings?.logo_url && (
          <img
            src={settings.logo_url}
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
        {settings?.business_name && (
          <span style={{
            fontSize: t.fontSizes.sm,
            fontWeight: '600',
            color: t.colors.textSecondary,
            marginRight: '8px',
          }}>
            {settings.business_name}
          </span>
        )}
        <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
          Quick access:
        </span>
        {favoritePages.map(page => (
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
            <span>{page.icon}</span>
            <span>{page.label}</span>
          </button>
        ))}
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
          }}
        >
          {showFavPicker ? 'Done' : '+ Edit'}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={() => onNavigate('settings')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            color: t.colors.textTertiary,
            padding: '4px',
          }}
          title="Settings"
        >
          ⚙️
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
          gridTemplateColumns: '1fr 1fr',
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
          {allPages.map(page => (
            <button
              key={page.path}
              onClick={() => toggleFavorite(page.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: t.radius.md,
                border: 'none',
                backgroundColor: favorites.includes(page.path) ? t.colors.primaryLight : t.colors.bg,
                color: favorites.includes(page.path) ? t.colors.primary : t.colors.textSecondary,
                fontSize: t.fontSizes.xs,
                fontWeight: favorites.includes(page.path) ? '600' : '400',
                cursor: 'pointer',
                fontFamily: t.fonts.sans,
                textAlign: 'left',
              }}
            >
              <span>{page.icon}</span>
              <span>{page.label}</span>
              {favorites.includes(page.path) && <span style={{ marginLeft: 'auto' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}