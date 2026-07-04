import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import { Icon } from './Icon'

// Each entry describes one searchable source: table, workspace scoping,
// which columns to match against, how to render a result, and where
// clicking it should navigate to.
const SOURCES = [
  {
    table: 'clients',
    icon: 'clients',
    label: 'Client',
    page: 'allclients',
    columns: ['name', 'company'],
    title: r => r.name,
    subtitle: r => r.company || '',
  },
  {
    table: 'projects',
    icon: 'projects',
    label: 'Project',
    page: 'projects',
    filter: q => q.neq('type', 'event'),
    columns: ['title'],
    title: r => r.title,
    subtitle: r => r.clients?.name || '',
    select: '*, clients(name)',
  },
  {
    table: 'projects',
    icon: 'events',
    label: 'Event',
    page: 'my-events',
    filter: q => q.eq('type', 'event'),
    columns: ['title'],
    title: r => r.title,
    subtitle: r => r.clients?.name || '',
    select: '*, clients(name)',
  },
  {
    table: 'business_events',
    icon: 'events',
    label: 'Business Event',
    page: 'business-events',
    columns: ['name'],
    title: r => r.name,
    subtitle: r => r.event_type || '',
  },
  {
    table: 'tasks',
    icon: 'task',
    label: 'Task',
    page: 'tasks',
    columns: ['title'],
    title: r => r.title,
    subtitle: r => r.status || '',
  },
  {
    table: 'invoices',
    icon: 'invoice',
    label: 'Invoice',
    page: 'invoices',
    columns: ['invoice_number'],
    title: r => r.invoice_number || 'Invoice',
    subtitle: r => r.clients?.name || '',
    select: '*, clients(name)',
  },
  {
    table: 'vendors',
    icon: 'vendors',
    label: 'Vendor',
    page: 'vendors',
    columns: ['name'],
    title: r => r.name,
    subtitle: r => r.category || '',
  },
  {
    table: 'campaigns',
    icon: 'campaigns',
    label: 'Campaign',
    page: 'campaigns',
    columns: ['name'],
    title: r => r.name,
    subtitle: () => '',
  },
  {
    table: 'event_packages',
    icon: 'events',
    label: 'Package',
    page: 'packages',
    columns: ['name'],
    title: r => r.name,
    subtitle: () => '',
  },
  {
    table: 'resources',
    icon: 'resources',
    label: 'Resource',
    page: 'resources',
    columns: ['title'],
    title: r => r.title,
    subtitle: () => '',
  },
  {
    table: 'team_goals',
    icon: 'team-goals',
    label: 'Team Goal',
    page: 'team-goals',
    columns: ['title'],
    title: r => r.title,
    subtitle: () => '',
  },
]

export default function GlobalSearch({ workspaceId, onNavigate, isMobile = false }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    const timeout = setTimeout(async () => {
      const orClause = (source) =>
        source.columns.map(col => `${col}.ilike.%${term}%`).join(',')

      const queries = SOURCES.map(source => {
        let q = supabase
          .from(source.table)
          .select(source.select || '*')
          .or(orClause(source))
          .limit(5)
        if (source.filter) q = source.filter(q)
        return q.then(({ data, error }) => ({ source, data: error ? [] : (data || []) }))
      })

      const settled = await Promise.all(queries)
      const grouped = settled
        .filter(r => r.data.length)
        .map(r => ({ source: r.source, items: r.data }))

      setResults(grouped)
      setLoading(false)
    }, 300)

    return () => clearTimeout(timeout)
  }, [query, workspaceId])

  function handleSelect(page) {
    onNavigate(page)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const totalCount = results.reduce((sum, g) => sum + g.items.length, 0)

  if (isMobile) {
    return (
      <div ref={containerRef} style={{ position: 'static' }}>
        <button
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0) }}
          aria-label="Search"
          style={{
            background: 'none',
            border: `1px solid ${t.colors.borderLight}`,
            borderRadius: t.radius.full,
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: t.colors.textSecondary,
            flexShrink: 0,
          }}
        >
          <Icon name="search" size="sm" />
        </button>

        {open && (
          <div style={{
            position: 'fixed',
            top: '68px',
            left: '12px',
            right: '12px',
            maxHeight: 'calc(100dvh - 92px)',
            overflowY: 'auto',
            backgroundColor: t.colors.bgCard,
            borderRadius: t.radius.lg,
            border: `1px solid ${t.colors.borderLight}`,
            boxShadow: t.shadows.lg,
            zIndex: 100,
            fontFamily: t.fonts.sans,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderBottom: `1px solid ${t.colors.borderLight}`,
            }}>
              <span style={{ display: 'flex', alignItems: 'center', color: t.colors.textTertiary }}>
                <Icon name="search" size="sm" />
              </span>
              <input
                ref={inputRef}
                style={{
                  border: 'none',
                  background: 'none',
                  outline: 'none',
                  fontSize: t.fontSizes.base,
                  color: t.colors.textSecondary,
                  width: '100%',
                  fontFamily: t.fonts.sans,
                }}
                placeholder="Search..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>

            {query.trim().length >= 2 && (
              <>
                {loading && (
                  <div style={{ padding: '16px', fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>
                    Searching…
                  </div>
                )}

                {!loading && totalCount === 0 && (
                  <div style={{ padding: '16px', fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>
                    No results for "{query}"
                  </div>
                )}

                {!loading && results.map(({ source, items }) => (
                  <div key={source.table + source.label}>
                    <div style={{
                      padding: '8px 14px 4px',
                      fontSize: t.fontSizes.xs,
                      fontWeight: '700',
                      color: t.colors.textTertiary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}>
                      {source.label}s
                    </div>
                    {items.map(item => (
                      <div
                        key={item.id}
                        onClick={() => handleSelect(source.page)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 14px',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', color: t.colors.textTertiary, flexShrink: 0 }}>
                          <Icon name={source.icon} size="sm" />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: t.fontSizes.sm,
                            color: t.colors.textPrimary,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {source.title(item)}
                          </div>
                          {source.subtitle(item) && (
                            <div style={{
                              fontSize: t.fontSizes.xs,
                              color: t.colors.textTertiary,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {source.subtitle(item)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: t.colors.bg,
        borderRadius: t.radius.xl,
        padding: '8px 14px',
        border: `1px solid ${t.colors.borderLight}`,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', color: t.colors.textTertiary }}>
          <Icon name="search" size="sm" />
        </span>
        <input
          style={{
            border: 'none',
            background: 'none',
            outline: 'none',
            fontSize: t.fontSizes.base,
            color: t.colors.textSecondary,
            width: '200px',
            fontFamily: t.fonts.sans,
          }}
          placeholder="Search..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
      </div>

      {open && query.trim().length >= 2 && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: '320px',
          maxHeight: '420px',
          overflowY: 'auto',
          backgroundColor: t.colors.bgCard,
          borderRadius: t.radius.lg,
          border: `1px solid ${t.colors.borderLight}`,
          boxShadow: t.shadows.lg,
          zIndex: 100,
          fontFamily: t.fonts.sans,
        }}>
          {loading && (
            <div style={{ padding: '16px', fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>
              Searching…
            </div>
          )}

          {!loading && totalCount === 0 && (
            <div style={{ padding: '16px', fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>
              No results for "{query}"
            </div>
          )}

          {!loading && results.map(({ source, items }) => (
            <div key={source.table + source.label}>
              <div style={{
                padding: '8px 14px 4px',
                fontSize: t.fontSizes.xs,
                fontWeight: '700',
                color: t.colors.textTertiary,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                {source.label}s
              </div>
              {items.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleSelect(source.page)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 14px',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = t.colors.bg}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span style={{ display: 'flex', alignItems: 'center', color: t.colors.textTertiary, flexShrink: 0 }}>
                    <Icon name={source.icon} size="sm" />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: t.fontSizes.sm,
                      color: t.colors.textPrimary,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {source.title(item)}
                    </div>
                    {source.subtitle(item) && (
                      <div style={{
                        fontSize: t.fontSizes.xs,
                        color: t.colors.textTertiary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {source.subtitle(item)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
