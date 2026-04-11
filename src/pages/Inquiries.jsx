import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

const STATUS_CONFIG = {
  new:       { label: 'New',       bg: '#F0EBF9', color: '#7C5CBF', border: '#7C5CBF' },
  converted: { label: 'Converted', bg: '#f0faf6', color: '#1D9E75', border: '#1D9E75' },
  archived:  { label: 'Archived',  bg: '#f5f5f5', color: '#999',    border: '#ddd' },
}

function timeAgo(dateString) {
  if (!dateString) return ''
  const diff = Date.now() - new Date(dateString).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

export default function Inquiries({ session }) {
  const [inquiries, setInquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('new')
  const [selected, setSelected] = useState(null)
  const [converting, setConverting] = useState(null)
  const [converted, setConverted] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => { fetchInquiries() }, [])

  async function fetchInquiries() {
    setLoading(true)
    const { data } = await supabase
      .from('event_inquiries')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setInquiries(data)
    setLoading(false)
  }

  async function convertToEvent(inquiry) {
    setConverting(inquiry.id)

    const { data: { user } } = await supabase.auth.getUser()

    const fullName = `${inquiry.first_name} ${inquiry.last_name}`
    const title = `${inquiry.event_type} — ${fullName}${inquiry.organization ? ` (${inquiry.organization})` : ''}`

    const descParts = []
    if (inquiry.organization) descParts.push(`Organization: ${inquiry.organization}`)
    if (inquiry.phone) descParts.push(`Phone: ${inquiry.phone}`)
    if (inquiry.email) descParts.push(`Email: ${inquiry.email}`)
    if (inquiry.budget_range) descParts.push(`Budget: ${inquiry.budget_range}`)
    if (inquiry.message) descParts.push(`\nNotes: ${inquiry.message}`)

    // Create event in projects table
    const { error } = await supabase.from('projects').insert({
      type: 'event',
      title,
      status: 'planning',
      event_status: 'inquiry',
      event_date: inquiry.event_date || null,
      venue: inquiry.venue || null,
      headcount: inquiry.guest_count || null,
      source: 'Inquiry form',
      description: descParts.join('\n') || null,
      user_id: user.id,
    })

    if (!error) {
      // Update inquiry status to converted
      await supabase
        .from('event_inquiries')
        .update({ status: 'converted' })
        .eq('id', inquiry.id)

      setInquiries(prev => prev.map(i =>
        i.id === inquiry.id ? { ...i, status: 'converted' } : i
      ))
      setConverted(inquiry.id)
      setTimeout(() => setConverted(null), 3000)
      if (selected?.id === inquiry.id) setSelected(prev => ({ ...prev, status: 'converted' }))
    }

    setConverting(null)
  }

  async function archiveInquiry(id) {
    await supabase.from('event_inquiries').update({ status: 'archived' }).eq('id', id)
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: 'archived' } : i))
    if (selected?.id === id) setSelected(null)
  }

  const counts = {
    new:       inquiries.filter(i => i.status === 'new').length,
    converted: inquiries.filter(i => i.status === 'converted').length,
    archived:  inquiries.filter(i => i.status === 'archived').length,
  }

  const filtered = inquiries.filter(i => i.status === filter)

  return (
    <div style={{ padding: '32px', fontFamily: t.fonts.sans }}>

{/* Header */}
<div style={{ marginBottom: '28px' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
    <div>
      <h2 style={{ fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 4px', letterSpacing: '-0.5px' }}>
        Event Inquiries
      </h2>
      <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: 0 }}>
        Incoming event inquiries from your public form.
      </p>
    </div>
    <button
      onClick={() => {
        navigator.clipboard.writeText('https://app.gabspace.io/event-intake.html')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      style={{
        padding: '9px 16px',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
        backgroundColor: copied ? '#f0faf6' : '#fff',
        color: copied ? '#1D9E75' : t.colors.textSecondary,
        fontSize: t.fontSizes.sm,
        fontWeight: '600',
        cursor: 'pointer',
        fontFamily: t.fonts.sans,
        transition: 'all 0.2s',
      }}
    >
      {copied ? '✓ Copied!' : '🔗 Copy intake form link'}
    </button>
  </div>
</div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        {[
          { key: 'new',       label: 'New',       color: '#7C5CBF', bg: '#F0EBF9' },
          { key: 'converted', label: 'Converted', color: '#1D9E75', bg: '#f0faf6' },
          { key: 'archived',  label: 'Archived',  color: '#999',    bg: '#f5f5f5' },
        ].map(({ key, label, color, bg }) => (
          <button
            key={key}
            onClick={() => { setFilter(key); setSelected(null) }}
            style={{
              padding: '8px 16px',
              borderRadius: '100px',
              border: filter === key ? `1.5px solid ${color}` : '1.5px solid transparent',
              backgroundColor: filter === key ? bg : '#f7f7f4',
              color: filter === key ? color : t.colors.textTertiary,
              fontSize: t.fontSizes.sm,
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: t.fonts.sans,
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {label}
            <span style={{
              backgroundColor: filter === key ? color : '#ddd',
              color: '#fff',
              borderRadius: '100px',
              fontSize: '11px',
              fontWeight: '700',
              padding: '1px 7px',
              lineHeight: '18px',
            }}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: t.colors.textTertiary }}>
          Loading inquiries...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #f0f0eb' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
          <div style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, marginBottom: '4px' }}>
            No {filter} inquiries
          </div>
          <div style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary }}>
            {filter === 'new' ? 'New inquiries from your form will appear here' : `No ${filter} inquiries yet`}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: '20px', alignItems: 'start' }}>

          {/* List */}
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #f0f0eb', overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1.8fr 1fr 1fr 0.8fr 0.8fr',
              padding: '11px 20px',
              backgroundColor: '#fafaf8',
              borderBottom: '1px solid #f0f0eb',
              fontSize: '11px',
              fontWeight: '600',
              color: '#999',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              <span>Name</span>
              <span>Email</span>
              <span>Event type</span>
              <span>Event date</span>
              <span>Received</span>
              <span>Status</span>
            </div>

            {filtered.map(inquiry => {
              const sc = STATUS_CONFIG[inquiry.status] || STATUS_CONFIG.new
              const isSelected = selected?.id === inquiry.id
              const justConverted = converted === inquiry.id
              return (
                <div
                  key={inquiry.id}
                  onClick={() => setSelected(isSelected ? null : inquiry)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 1.8fr 1fr 1fr 0.8fr 0.8fr',
                    padding: '14px 20px',
                    borderBottom: '1px solid #f9f9f7',
                    alignItems: 'center',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#fafaf8' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#fafaf8' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <div>
                    <div style={{ fontSize: t.fontSizes.base, fontWeight: '600', color: t.colors.textPrimary }}>
                      {inquiry.first_name} {inquiry.last_name}
                    </div>
                    {inquiry.organization && (
                      <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{inquiry.organization}</div>
                    )}
                  </div>
                  <a href={`mailto:${inquiry.email}`} onClick={e => e.stopPropagation()} style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary, textDecoration: 'none' }}>
                    {inquiry.email}
                  </a>
                  <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>{inquiry.event_type || '—'}</span>
                  <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>
                    {inquiry.event_date ? new Date(inquiry.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </span>
                  <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{timeAgo(inquiry.created_at)}</span>
                  <div style={{
                    display: 'inline-block',
                    padding: '3px 10px',
                    borderRadius: '100px',
                    fontSize: '11px',
                    fontWeight: '600',
                    backgroundColor: justConverted ? '#f0faf6' : sc.bg,
                    color: justConverted ? '#1D9E75' : sc.color,
                  }}>
                    {justConverted ? '✓ Converted' : sc.label}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Detail panel */}
          {selected && (
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              border: '1px solid #f0f0eb',
              overflow: 'hidden',
              position: 'sticky',
              top: '24px',
            }}>
              {/* Panel header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>Inquiry details</span>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: t.colors.textTertiary }}>✕</button>
              </div>

              <div style={{ padding: '20px' }}>
                {/* Name + contact */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: t.colors.textPrimary, marginBottom: '4px' }}>
                    {selected.first_name} {selected.last_name}
                  </div>
                  {selected.organization && (
                    <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, marginBottom: '8px' }}>{selected.organization}</div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <a href={`mailto:${selected.email}`} style={{ fontSize: t.fontSizes.sm, color: t.colors.primary, textDecoration: 'none', fontWeight: '500' }}>
                      {selected.email}
                    </a>
                    {selected.phone && (
                      <a href={`tel:${selected.phone}`} style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary, textDecoration: 'none' }}>
                        {selected.phone}
                      </a>
                    )}
                  </div>
                </div>

                {/* Event details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  {[
                    { label: 'Event type',  value: selected.event_type },
                    { label: 'Event date',  value: selected.event_date ? new Date(selected.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null },
                    { label: 'Venue',       value: selected.venue },
                    { label: 'Guest count', value: selected.guest_count ? selected.guest_count.toLocaleString() : null },
                    { label: 'Budget',      value: selected.budget_range },
                    { label: 'Received',    value: new Date(selected.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) },
                  ].filter(r => r.value).map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: t.colors.bg, borderRadius: t.radius.md }}>
                      <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{row.label}</span>
                      <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textPrimary, fontWeight: '500', textAlign: 'right', maxWidth: '55%' }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                {/* Message */}
                {selected.message && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Message</div>
                    <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary, lineHeight: '1.65', padding: '12px', backgroundColor: t.colors.bg, borderRadius: t.radius.md }}>
                      {selected.message}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selected.status === 'new' && (
                    <button
                      onClick={() => convertToEvent(selected)}
                      disabled={converting === selected.id}
                      style={{
                        width: '100%',
                        padding: '11px',
                        borderRadius: t.radius.md,
                        border: 'none',
                        backgroundColor: t.colors.primary,
                        color: '#fff',
                        fontSize: t.fontSizes.sm,
                        fontWeight: '600',
                        cursor: 'pointer',
                        fontFamily: t.fonts.sans,
                        opacity: converting === selected.id ? 0.6 : 1,
                      }}
                    >
                      {converting === selected.id ? 'Converting...' : '✦ Convert to Event'}
                    </button>
                  )}
                  {selected.status === 'converted' && (
                    <div style={{ padding: '11px', borderRadius: t.radius.md, backgroundColor: '#f0faf6', color: '#1D9E75', fontSize: t.fontSizes.sm, fontWeight: '600', textAlign: 'center' }}>
                      ✓ Converted to event
                    </div>
                  )}
                  {selected.status !== 'archived' && (
                    <button
                      onClick={() => archiveInquiry(selected.id)}
                      style={{
                        width: '100%',
                        padding: '11px',
                        borderRadius: t.radius.md,
                        border: `1px solid ${t.colors.borderLight}`,
                        backgroundColor: '#fff',
                        color: t.colors.textTertiary,
                        fontSize: t.fontSizes.sm,
                        fontWeight: '500',
                        cursor: 'pointer',
                        fontFamily: t.fonts.sans,
                      }}
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
