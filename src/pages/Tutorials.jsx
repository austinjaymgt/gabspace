import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import { Icon } from '../components/Icon'

function formatDuration(seconds) {
  if (!seconds) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function Tutorials() {
  const [tutorials, setTutorials] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [selected, setSelected] = useState(null)

  async function fetchTutorials() {
    setLoading(true)
    const { data } = await supabase
      .from('tutorials')
      .select('*')
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })
    setTutorials(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchTutorials() }, [])

  const categories = useMemo(() => {
    const set = new Set(tutorials.map(v => v.category || 'General'))
    return ['all', ...Array.from(set)]
  }, [tutorials])

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return tutorials.filter(v => {
      const category = v.category || 'General'
      if (activeCategory !== 'all' && category !== activeCategory) return false
      if (!q) return true
      return (
        v.title.toLowerCase().includes(q) ||
        v.description?.toLowerCase().includes(q) ||
        v.tags?.some(tag => tag.toLowerCase().includes(q))
      )
    })
  }, [tutorials, searchQuery, activeCategory])

  const grouped = useMemo(() => {
    const map = new Map()
    visible.forEach(v => {
      const category = v.category || 'General'
      if (!map.has(category)) map.set(category, [])
      map.get(category).push(v)
    })
    return Array.from(map.entries())
  }, [visible])

  return (
    <div style={{ padding: '32px', maxWidth: '1100px', fontFamily: t.fonts.sans }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 4px' }}>Tutorials</h2>
        <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: 0 }}>Short walkthroughs to help you get around gabspace.</p>
      </div>

      {!loading && tutorials.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Search tutorials..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ padding: '9px 14px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, outline: 'none', color: t.colors.textPrimary, fontFamily: t.fonts.sans, minWidth: '220px' }}
          />
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', background: t.colors.bgCard, borderRadius: t.radius.full, padding: '4px', border: `0.5px solid ${t.colors.border}` }}>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                style={{ fontSize: t.fontSizes.sm, fontWeight: '500', padding: '7px 14px', borderRadius: t.radius.full, cursor: 'pointer', border: 'none', background: activeCategory === category ? t.colors.nav : 'transparent', color: activeCategory === category ? '#fff' : t.colors.textTertiary, fontFamily: t.fonts.sans, whiteSpace: 'nowrap' }}
              >
                {category === 'all' ? 'All' : category}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: t.colors.textTertiary, fontSize: t.fontSizes.sm }}>Loading…</div>
      ) : tutorials.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: t.colors.textTertiary }}>
          <Icon name="tutorials" size="xl" />
          <p style={{ fontSize: t.fontSizes.base, marginTop: '12px' }}>No tutorials yet — check back soon.</p>
        </div>
      ) : visible.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: t.colors.textTertiary, fontSize: t.fontSizes.sm }}>No tutorials match your search.</div>
      ) : (
        grouped.map(([category, items]) => (
          <div key={category} style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: t.fontSizes.md, fontWeight: '600', color: t.colors.textSecondary, margin: '0 0 12px' }}>{category}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
              {items.map(v => (
                <div
                  key={v.id}
                  onClick={() => setSelected(v)}
                  style={{ cursor: 'pointer', borderRadius: t.radius.lg, border: `1px solid ${t.colors.borderLight}`, backgroundColor: t.colors.bgCard, overflow: 'hidden' }}
                >
                  <div style={{ position: 'relative', aspectRatio: '16 / 9', backgroundColor: t.colors.bgHover, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {v.thumbnail_url ? (
                      <img src={v.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Icon name="tutorials" size="xl" />
                    )}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.15)' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.colors.nav }}>
                        <Icon name="tutorials" size="md" />
                      </div>
                    </div>
                    {formatDuration(v.duration_seconds) && (
                      <div style={{ position: 'absolute', bottom: '6px', right: '6px', padding: '2px 6px', borderRadius: t.radius.sm, backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: t.fontSizes.xs }}>
                        {formatDuration(v.duration_seconds)}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary, marginBottom: '4px' }}>{v.title}</div>
                    {v.description && (
                      <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {v.description}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5vh 16px', zIndex: 1000 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, width: '100%', maxWidth: '760px', overflow: 'hidden' }}
          >
            <video src={selected.video_url} controls autoPlay style={{ width: '100%', display: 'block', backgroundColor: '#000' }} />
            <div style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: 0 }}>{selected.title}</h3>
                <button
                  onClick={() => setSelected(null)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: t.colors.textTertiary, flexShrink: 0 }}
                >
                  <Icon name="close" size="md" />
                </button>
              </div>
              {selected.description && (
                <p style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, margin: '8px 0 0' }}>{selected.description}</p>
              )}
              {selected.tags?.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
                  {selected.tags.map(tag => (
                    <span key={tag} style={{ fontSize: t.fontSizes.xs, padding: '4px 10px', borderRadius: t.radius.full, backgroundColor: t.colors.bgHover, color: t.colors.textSecondary }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
