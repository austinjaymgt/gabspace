import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

// ── Source config ──────────────────────────────────────────────────────────
const SOURCES = {
  event:    { label: 'Event',         color: '#7C5CBF', bg: '#F0EBF9' },
  project:  { label: 'Project due',   color: '#4466cc', bg: '#f0f4ff' },
  inquiry:  { label: 'Inquiry',       color: '#C06B7A', bg: '#FAF0F2' },
}
const navBtn = {
  width: '28px', height: '28px',
  borderRadius: '6px',
  border: '1px solid #e0e0e0',
  backgroundColor: '#fff',
  color: '#555',
  fontSize: '16px',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'sans-serif',
  lineHeight: 1,
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ── Helpers ────────────────────────────────────────────────────────────────
function toDateKey(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  // Use UTC to avoid timezone shifting
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Main component ─────────────────────────────────────────────────────────
export default function CalendarWidget() {
  const [calView, setCalView] = useState('month') // 'month' | 'week'
  const [cursor, setCursor] = useState(new Date()) // current month/week reference
  const [events, setEvents] = useState([]) // all calendar items
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null) // selected day key
  const [activeFilters, setActiveFilters] = useState(Object.keys(SOURCES))

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [
      { data: projectEvents },
      { data: projectDeadlines },
      // { data: inquiries }, // Hidden pending multi-tenant re-architecture
    ] = await Promise.all([
      supabase.from('projects').select('id, title, event_date, event_status').eq('type', 'event').not('event_date', 'is', null),
      supabase.from('projects').select('id, title, end_date, status').eq('type', 'project').not('end_date', 'is', null),
      // supabase.from('event_inquiries').select(...) — Hidden pending multi-tenant re-architecture
    ])

    const items = [
      ...(projectEvents || []).map(e => ({
        id: `event-${e.id}`, type: 'event',
        title: e.title,
        date: toDateKey(e.event_date),
        meta: e.event_status,
      })),
      ...(projectDeadlines || []).map(p => ({
        id: `project-${p.id}`, type: 'project',
        title: p.title,
        date: toDateKey(p.end_date),
        meta: p.status,
      })),
      // Inquiries mapping hidden pending multi-tenant re-architecture
      // ...(inquiries || []).map(inq => ({
      //   id: `inquiry-${inq.id}`, type: 'inquiry',
      //   title: `${inq.event_type || 'Inquiry'} — ${inq.first_name} ${inq.last_name}`,
      //   date: toDateKey(inq.event_date),
      //   meta: 'inquiry',
      // })),
    ].filter(e => e.date)
    setEvents(items)
    setLoading(false)
  }

  // Group events by date key
  const eventsByDate = useMemo(() => {
    const map = {}
    events.forEach(e => {
      if (!activeFilters.includes(e.type)) return
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    })
    return map
  }, [events, activeFilters])

  // ── Month view grid ──────────────────────────────────────────────────────
  function getMonthDays() {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days = []
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d))
    }
    return days
  }

  // ── Week view days ───────────────────────────────────────────────────────
  function getWeekDays() {
    const d = new Date(cursor)
    const day = d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - day)
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
      return date
    })
  }

  function navigate(dir) {
    setCursor(prev => {
      const d = new Date(prev)
      if (calView === 'month') d.setMonth(d.getMonth() + dir)
      else d.setDate(d.getDate() + dir * 7)
      return d
    })
    setSelected(null)
  }

  function toggleFilter(type) {
    setActiveFilters(prev =>
      prev.includes(type) ? prev.filter(f => f !== type) : [...prev, type]
    )
  }

  const today = todayKey()
  const monthDays = calView === 'month' ? getMonthDays() : null
  const weekDays = calView === 'week' ? getWeekDays() : null

  const selectedEvents = selected ? (eventsByDate[selected] || []) : []

  const headerLabel = calView === 'month'
    ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
    : (() => {
        const days = getWeekDays()
        const start = days[0]
        const end = days[6]
        if (start.getMonth() === end.getMonth()) {
          return `${MONTHS[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`
        }
        return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`
      })()

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: t.radius.lg, border: `1px solid ${t.colors.borderLight}`, overflow: 'hidden', marginBottom: '24px' }}>

      {/* Header */}
      <div style={{ padding: '18px 24px', borderBottom: `1px solid ${t.colors.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Nav arrows */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => navigate(-1)} style={navBtn}>‹</button>
            <button onClick={() => navigate(1)} style={navBtn}>›</button>
          </div>
          <span style={{ fontSize: t.fontSizes.lg, fontWeight: '700', color: t.colors.textPrimary, letterSpacing: '-0.3px' }}>
            {headerLabel}
          </span>
          <button
            onClick={() => { setCursor(new Date()); setSelected(null) }}
            style={{ padding: '4px 10px', borderRadius: '100px', border: `1px solid ${t.colors.borderLight}`, backgroundColor: '#fff', color: t.colors.textTertiary, fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans }}
          >
            Today
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Source filters */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {Object.entries(SOURCES).map(([type, cfg]) => {
              const active = activeFilters.includes(type)
              return (
                <button
                  key={type}
                  onClick={() => toggleFilter(type)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '100px',
                    border: `1.5px solid ${active ? cfg.color : '#e0e0e0'}`,
                    backgroundColor: active ? cfg.bg : '#fff',
                    color: active ? cfg.color : '#bbb',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: t.fonts.sans,
                    transition: 'all 0.15s',
                  }}
                >
                  {cfg.label}
                </button>
              )
            })}
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', backgroundColor: '#f0f0eb', borderRadius: '8px', padding: '3px', gap: '2px' }}>
            {['month', 'week'].map(v => (
              <button
                key={v}
                onClick={() => { setCalView(v); setSelected(null) }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: t.fonts.sans,
                  backgroundColor: calView === v ? '#fff' : 'transparent',
                  color: calView === v ? t.colors.textPrimary : t.colors.textTertiary,
                  boxShadow: calView === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: t.colors.textTertiary, fontSize: t.fontSizes.sm }}>
          Loading calendar...
        </div>
      ) : (
        <div style={{ display: 'flex' }}>
          {/* Calendar grid */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Day labels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${t.colors.borderLight}` }}>
              {DAYS.map(d => (
                <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Month view */}
            {calView === 'month' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {monthDays.map((date, i) => {
                  if (!date) return <div key={`empty-${i}`} style={{ minHeight: '80px', borderRight: `1px solid ${t.colors.borderLight}`, borderBottom: `1px solid ${t.colors.borderLight}`, backgroundColor: '#fafaf8' }} />
                  const key = toDateKey(date.toISOString())
                  const dayEvents = eventsByDate[key] || []
                  const isToday = key === today
                  const isSelected = key === selected
                  return (
                    <div
                      key={key}
                      onClick={() => setSelected(isSelected ? null : key)}
                      style={{
                        minHeight: '80px',
                        padding: '6px',
                        borderRight: `1px solid ${t.colors.borderLight}`,
                        borderBottom: `1px solid ${t.colors.borderLight}`,
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#f5f0fc' : 'transparent',
                        transition: 'background 0.1s',
                        position: 'relative',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#fafaf8' }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <div style={{
                        width: '24px', height: '24px',
                        borderRadius: '50%',
                        backgroundColor: isToday ? '#1A1A2E' : 'transparent',
                        color: isToday ? '#fff' : t.colors.textSecondary,
                        fontSize: '12px',
                        fontWeight: isToday ? '700' : '400',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '4px',
                      }}>
                        {date.getDate()}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {dayEvents.slice(0, 3).map(ev => {
                          const src = SOURCES[ev.type] || SOURCES.event
                          return (
                            <div key={ev.id} style={{
                              fontSize: '10px',
                              fontWeight: '500',
                              color: src.color,
                              backgroundColor: src.bg,
                              borderRadius: '3px',
                              padding: '1px 5px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {ev.title}
                            </div>
                          )
                        })}
                        {dayEvents.length > 3 && (
                          <div style={{ fontSize: '10px', color: t.colors.textTertiary, fontWeight: '500', paddingLeft: '5px' }}>
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Week view */}
            {calView === 'week' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {weekDays.map(date => {
                  const key = toDateKey(date.toISOString())
                  const dayEvents = eventsByDate[key] || []
                  const isToday = key === today
                  const isSelected = key === selected
                  return (
                    <div
                      key={key}
                      onClick={() => setSelected(isSelected ? null : key)}
                      style={{
                        minHeight: '160px',
                        padding: '10px 8px',
                        borderRight: `1px solid ${t.colors.borderLight}`,
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#f5f0fc' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#fafaf8' }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <div style={{
                        width: '28px', height: '28px',
                        borderRadius: '50%',
                        backgroundColor: isToday ? '#1A1A2E' : 'transparent',
                        color: isToday ? '#fff' : t.colors.textSecondary,
                        fontSize: '13px',
                        fontWeight: isToday ? '700' : '500',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '8px',
                      }}>
                        {date.getDate()}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {dayEvents.map(ev => {
                          const src = SOURCES[ev.type] || SOURCES.event
                          return (
                            <div key={ev.id} style={{
                              fontSize: '11px',
                              fontWeight: '500',
                              color: src.color,
                              backgroundColor: src.bg,
                              borderRadius: '4px',
                              padding: '3px 6px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {ev.title}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Selected day panel */}
          {selected && selectedEvents.length > 0 && (
            <div style={{
              width: '240px',
              flexShrink: 0,
              borderLeft: `1px solid ${t.colors.borderLight}`,
              padding: '16px',
              backgroundColor: '#fafaf8',
            }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: t.colors.textPrimary, marginBottom: '12px' }}>
                {new Date(selected + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedEvents.map(ev => {
                  const src = SOURCES[ev.type] || SOURCES.event
                  return (
                    <div key={ev.id} style={{ padding: '8px 10px', backgroundColor: '#fff', borderRadius: t.radius.md, border: `1px solid ${t.colors.borderLight}` }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: src.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>
                        {src.label}
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: '500', color: t.colors.textPrimary, lineHeight: '1.4' }}>
                        {ev.title}
                      </div>
                      {ev.meta && (
                        <div style={{ fontSize: '11px', color: t.colors.textTertiary, marginTop: '3px' }}>
                          {ev.meta.replace('_', ' ')}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

