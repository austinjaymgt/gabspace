// src/components/events/EventHero.jsx
// Dark hero header for event-type projects.
// Reusable: pass in the event data + status color info.

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function EventHero({ data, statusColor }) {
  const es = statusColor || { bg: '#F0EBF9', color: '#7C5CBF', label: data.event_status }

  return (
    <div style={{ backgroundColor: '#1A1A2E', borderRadius: '16px', padding: '32px', marginBottom: '20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: '240px', height: '240px', borderRadius: '50%', background: es.color, opacity: 0.1, top: '-60px', right: '-60px' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', margin: '0 0 6px', fontFamily: 'Syne, sans-serif', letterSpacing: '-0.3px' }}>{data.title}</h1>
            {data.clients?.name && (
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                {data.clients.name}{data.clients.company ? ` · ${data.clients.company}` : ''}
              </p>
            )}
          </div>
          <div style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', backgroundColor: es.bg, color: es.color, textTransform: 'capitalize' }}>
            {(es.label || data.event_status || '').replace(/_/g, ' ')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {[
            data.event_date && { icon: '📅', label: 'Date', value: formatDate(data.event_date) },
            data.venue && { icon: '📍', label: 'Venue', value: data.venue },
            data.headcount && { icon: '👥', label: 'Guests', value: `${data.headcount}` },
            data.budget && { icon: '💰', label: 'Budget', value: `$${parseFloat(data.budget).toLocaleString()}` },
          ].filter(Boolean).map(item => (
            <div key={item.label} style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: '10px', padding: '10px 16px' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>
                {item.icon} {item.label}
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}