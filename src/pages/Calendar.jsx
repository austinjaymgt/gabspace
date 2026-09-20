import { useEffect, useMemo, useState } from 'react'
import { theme as t } from '../theme'
import { Icon } from '../components/Icon'
import { useIsMobile } from '../hooks/useMediaQuery'
import { CALENDAR_TYPE_META, fetchCalendarItems } from '../lib/calendarItems'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toDateStr(d) {
  return d.toISOString().slice(0, 10)
}

// The 6x7 grid of days shown for a given month, including leading/trailing
// days from the adjacent months so every week row is full.
function buildMonthGrid(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay())

  const days = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    days.push(d)
  }
  return days
}

export default function CalendarPage({ businessSpaceId, onNavigate }) {
  const isMobile = useIsMobile()
  const [monthDate, setMonthDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTypes, setActiveTypes] = useState(() => new Set(Object.keys(CALENDAR_TYPE_META)))
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))
  const [detailOpen, setDetailOpen] = useState(false)

  const days = useMemo(() => buildMonthGrid(monthDate), [monthDate])
  const todayStr = toDateStr(new Date())

  useEffect(() => {
    if (!businessSpaceId) return
    queueMicrotask(async () => {
      setLoading(true)
      const start = toDateStr(days[0])
      const end = toDateStr(days[days.length - 1])
      const data = await fetchCalendarItems(businessSpaceId, start, end)
      setItems(data)
      setLoading(false)
    })
  }, [businessSpaceId, days])

  const itemsByDate = useMemo(() => {
    const map = {}
    for (const item of items) {
      if (!activeTypes.has(item.type)) continue
      if (!map[item.date]) map[item.date] = []
      map[item.date].push(item)
    }
    return map
  }, [items, activeTypes])

  function toggleType(type) {
    setActiveTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  function goToMonth(offset) {
    setMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1))
  }

  function goToToday() {
    setMonthDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
    setSelectedDate(todayStr)
  }

  function selectDay(dateStr) {
    setSelectedDate(dateStr)
    setDetailOpen(true)
  }

  const selectedItems = itemsByDate[selectedDate] || []
  const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div style={{ padding: isMobile ? '20px 16px' : '32px 40px', fontFamily: t.fonts.sans, maxWidth: '1200px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: t.fontSizes.xs, fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.primary, marginBottom: '6px' }}>
            Business
          </div>
          <h1 style={{ fontFamily: t.fonts.heading, fontSize: '28px', fontWeight: '800', color: t.colors.textPrimary, letterSpacing: '-0.02em', margin: 0 }}>
            Calendar
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => goToMonth(-1)} aria-label="Previous month" style={navButtonStyle(t)}>
            <Icon name="back" size="sm" />
          </button>
          <div style={{ fontSize: t.fontSizes.md, fontWeight: '700', color: t.colors.textPrimary, minWidth: '150px', textAlign: 'center', fontFamily: t.fonts.heading }}>
            {monthLabel}
          </div>
          <button onClick={() => goToMonth(1)} aria-label="Next month" style={{ ...navButtonStyle(t), transform: 'scaleX(-1)' }}>
            <Icon name="back" size="sm" />
          </button>
          <button onClick={goToToday} style={todayButtonStyle(t)}>
            Today
          </button>
        </div>
      </div>

      {/* Type filter legend */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {Object.entries(CALENDAR_TYPE_META).map(([type, meta]) => {
          const active = activeTypes.has(type)
          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                fontSize: t.fontSizes.xs, fontWeight: '600', padding: '5px 12px',
                borderRadius: t.radius.full, cursor: 'pointer', fontFamily: t.fonts.sans,
                border: `1px solid ${active ? 'transparent' : t.colors.borderLight}`,
                backgroundColor: active ? meta.bg : 'transparent',
                color: active ? meta.color : t.colors.textTertiary,
                opacity: active ? 1 : 0.6,
              }}
            >
              <Icon name={meta.icon} size="sm" />
              {meta.label}
            </button>
          )
        })}
      </div>

      {/* Month grid */}
      <div style={{ backgroundColor: t.colors.bgCard, border: `1px solid ${t.colors.borderLight}`, borderRadius: t.radius.lg, overflow: 'hidden', opacity: loading ? 0.6 : 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: `1px solid ${t.colors.borderLight}` }}>
            {WEEKDAY_LABELS.map(w => (
              <div key={w} style={{ padding: '10px 0', textAlign: 'center', fontSize: t.fontSizes.xs, fontWeight: '700', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {w}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            {days.map((d, i) => {
              const dateStr = toDateStr(d)
              const inMonth = d.getMonth() === monthDate.getMonth()
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              const dayItems = itemsByDate[dateStr] || []
              const visibleItems = dayItems.slice(0, 3)
              const overflow = dayItems.length - visibleItems.length

              return (
                <button
                  key={i}
                  onClick={() => selectDay(dateStr)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'stretch',
                    minWidth: 0, minHeight: '92px', padding: '6px', gap: '3px',
                    boxSizing: 'border-box', overflow: 'hidden',
                    border: 'none', borderRight: (i + 1) % 7 !== 0 ? `1px solid ${t.colors.borderLight}` : 'none',
                    borderBottom: i < 35 ? `1px solid ${t.colors.borderLight}` : 'none',
                    backgroundColor: isSelected ? t.colors.bg : 'transparent',
                    cursor: 'pointer', fontFamily: t.fonts.sans, textAlign: 'left',
                  }}
                >
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '22px', height: '22px', borderRadius: t.radius.full, flexShrink: 0,
                    fontSize: t.fontSizes.xs, fontWeight: isToday ? '700' : '500',
                    color: isToday ? t.colors.textInverse : (inMonth ? t.colors.textPrimary : t.colors.textTertiary),
                    backgroundColor: isToday ? t.colors.primary : 'transparent',
                  }}>
                    {d.getDate()}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                    {visibleItems.map(item => {
                      const meta = CALENDAR_TYPE_META[item.type]
                      return (
                        <span key={item.id} style={{
                          fontSize: '10px', fontWeight: '600', padding: '2px 6px', borderRadius: t.radius.sm,
                          backgroundColor: meta.bg, color: meta.color, minWidth: 0, boxSizing: 'border-box',
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          overflow: 'hidden', wordBreak: 'break-word', lineHeight: 1.3,
                          opacity: item.done ? 0.5 : 1, textDecoration: item.done ? 'line-through' : 'none',
                        }}>
                          {item.title}
                        </span>
                      )
                    })}
                    {overflow > 0 && (
                      <span style={{ fontSize: '10px', fontWeight: '600', color: t.colors.textTertiary, padding: '0 6px' }}>
                        +{overflow} more
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
      </div>

      {/* Day detail is always an on-demand drawer, never a persistent panel — desktop included */}
      {detailOpen && (
        <div
          onClick={() => setDetailOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: t.colors.bgCard, padding: '18px', maxHeight: '70vh', overflowY: 'auto', boxSizing: 'border-box',
              width: isMobile ? '100%' : '440px',
              borderRadius: isMobile ? '20px 20px 0 0' : t.radius.lg,
              marginBottom: isMobile ? 0 : '32px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ width: '24px' }} />
              <div style={{ width: '36px', height: '4px', borderRadius: t.radius.full, backgroundColor: t.colors.borderLight }} />
              <button onClick={() => setDetailOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.colors.textTertiary, display: 'flex', padding: '2px' }}>
                <Icon name="close" size="sm" />
              </button>
            </div>
            <DayDetail selectedDate={selectedDate} selectedItems={selectedItems} onNavigate={onNavigate} />
          </div>
        </div>
      )}
    </div>
  )
}

function DayDetail({ selectedDate, selectedItems, onNavigate }) {
  return (
    <>
      <div style={{ fontSize: t.fontSizes.sm, fontWeight: '700', color: t.colors.textPrimary, marginBottom: '12px', fontFamily: t.fonts.heading }}>
        {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      </div>
      {selectedItems.length === 0 ? (
        <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>Nothing scheduled.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {selectedItems.map(item => {
            const meta = CALENDAR_TYPE_META[item.type]
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(meta.page)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 6px', borderRadius: t.radius.md,
                  background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'left', fontFamily: t.fonts.sans,
                  width: '100%', minWidth: 0, boxSizing: 'border-box',
                }}
              >
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '26px', height: '26px', borderRadius: t.radius.full,
                  backgroundColor: meta.bg, color: meta.color, flexShrink: 0,
                }}>
                  <Icon name={meta.icon} size="sm" />
                </span>
                <span style={{
                  flex: 1, minWidth: 0, fontSize: t.fontSizes.sm,
                  color: item.done ? t.colors.textTertiary : t.colors.textPrimary,
                  textDecoration: item.done ? 'line-through' : 'none',
                  wordBreak: 'break-word', lineHeight: 1.4,
                }}>
                  {item.title}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

function navButtonStyle(t) {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '32px', height: '32px', borderRadius: t.radius.full,
    border: `1px solid ${t.colors.borderLight}`, backgroundColor: 'transparent',
    color: t.colors.textSecondary, cursor: 'pointer',
  }
}

function todayButtonStyle(t) {
  return {
    padding: '7px 14px', borderRadius: t.radius.full,
    border: `1px solid ${t.colors.borderLight}`, backgroundColor: 'transparent',
    color: t.colors.textSecondary, fontSize: t.fontSizes.sm, fontWeight: '600',
    cursor: 'pointer', fontFamily: t.fonts.sans,
  }
}
