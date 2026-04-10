import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

const EVENT_STATUSES = [
  { key: 'inquiry',        label: 'Inquiry',       color: '#8585A0', bg: '#F0EBF9' },
  { key: 'proposal_sent', label: 'Proposal Sent',  color: '#D4874E', bg: '#FBF0E6' },
  { key: 'contracted',    label: 'Contracted',     color: '#6B8F71', bg: '#EAF2EA' },
  { key: 'in_planning',   label: 'In Planning',    color: '#7C5CBF', bg: '#F0EBF9' },
  { key: 'day_of',        label: 'Day Of',         color: '#1A1A2E', bg: '#E8E8F0' },
  { key: 'post_event',    label: 'Post-Event',     color: '#5B9BBF', bg: '#EAF4F9' },
  { key: 'closed',        label: 'Closed',         color: '#1D9E75', bg: '#f0faf6' },
]

const STAFF_STATUSES = {
  confirmed:  { label: 'Confirmed',  color: '#1D9E75', bg: '#f0faf6' },
  tentative:  { label: 'Tentative',  color: '#D4874E', bg: '#FBF0E6' },
  needed:     { label: 'Needed',     color: '#8585A0', bg: '#F0EBF9' },
}

function getEventStatus(key) {
  return EVENT_STATUSES.find(s => s.key === key) || EVENT_STATUSES[0]
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateLong(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatDateInput(dateStr) {
  if (!dateStr) return ''
  return dateStr.split('T')[0]
}

function formatTime(timeStr) {
  if (!timeStr) return '—'
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${m} ${ampm}`
}

// ── EMPTY STATE ───────────────────────────────────────────────────────────────
function EmptyState({ onAdd }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #f0f0eb' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #7C5CBF, #6B8F71)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', marginBottom: '20px' }}>🎪</div>
      <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1A1A2E', margin: '0 0 8px', fontFamily: 'Syne, sans-serif' }}>No events yet</h3>
      <p style={{ fontSize: '14px', color: '#8585A0', margin: '0 0 24px', textAlign: 'center', maxWidth: '280px' }}>Add your first event — from inquiry to post-event, everything lives here.</p>
      <button onClick={onAdd} style={btnStyles.primary}>+ Add Event</button>
    </div>
  )
}

// ── EVENT CARD ────────────────────────────────────────────────────────────────
function EventCard({ event, onClick }) {
  const es = getEventStatus(event.event_status)
  const isUpcoming = event.event_date && new Date(event.event_date) > new Date()
  const daysUntil = event.event_date ? Math.ceil((new Date(event.event_date) - new Date()) / (1000 * 60 * 60 * 24)) : null

  return (
    <div onClick={onClick} style={{ backgroundColor: '#fff', borderRadius: '14px', border: '1px solid #f0f0eb', padding: '22px 24px', cursor: 'pointer', transition: 'all 0.15s', position: 'relative', overflow: 'hidden' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#7C5CBF'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,92,191,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#f0f0eb'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundColor: es.color, borderRadius: '14px 14px 0 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ flex: 1, marginRight: '12px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1A1A2E', margin: '0 0 3px', fontFamily: 'Syne, sans-serif', lineHeight: 1.2 }}>{event.title}</h3>
          {event.clients?.name && <p style={{ fontSize: '12px', color: '#8585A0', margin: 0 }}>{event.clients.name}{event.clients.company ? ` · ${event.clients.company}` : ''}</p>}
        </div>
        <div style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: es.bg, color: es.color, whiteSpace: 'nowrap', flexShrink: 0 }}>{es.label}</div>
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {event.event_date && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '12px' }}>📅</span>
            <span style={{ fontSize: '12px', color: '#3D3D5C', fontWeight: '500' }}>{formatDate(event.event_date)}</span>
            {daysUntil !== null && isUpcoming && daysUntil <= 30 && (
              <span style={{ fontSize: '11px', color: '#fff', backgroundColor: daysUntil <= 7 ? '#C06B7A' : '#D4874E', borderRadius: '10px', padding: '1px 7px', fontWeight: '600' }}>
                {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d`}
              </span>
            )}
          </div>
        )}
        {event.venue && <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ fontSize: '12px' }}>📍</span><span style={{ fontSize: '12px', color: '#3D3D5C' }}>{event.venue}</span></div>}
        {event.headcount && <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ fontSize: '12px' }}>👥</span><span style={{ fontSize: '12px', color: '#3D3D5C' }}>{event.headcount} guests</span></div>}
        {event.budget && <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ fontSize: '12px' }}>💰</span><span style={{ fontSize: '12px', color: '#3D3D5C' }}>${parseFloat(event.budget).toLocaleString()}</span></div>}
      </div>
    </div>
  )
}

// ── EVENT FORM ────────────────────────────────────────────────────────────────
function EventForm({ clients, onSave, onCancel, saving, error, initial }) {
  const [form, setForm] = useState(initial || { title: '', client_id: '', status: 'planning', event_status: 'inquiry', event_date: '', venue: '', headcount: '', budget: '', description: '' })
  function f(key, val) { setForm(prev => ({ ...prev, [key]: val })) }

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '14px', padding: '28px', border: '1px solid #f0f0eb', marginBottom: '24px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1A1A2E', margin: '0 0 22px', fontFamily: 'Syne, sans-serif' }}>{initial ? 'Edit Event' : 'New Event'}</h3>
      {error && <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#fff0f0', color: '#cc3333', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div style={{ ...fStyles.field, gridColumn: 'span 2' }}>
          <label style={fStyles.label}>Event name *</label>
          <input style={fStyles.input} placeholder="e.g. Johnson & Smith Wedding" value={form.title} onChange={e => f('title', e.target.value)} />
        </div>
        <div style={fStyles.field}>
          <label style={fStyles.label}>Client</label>
          <select style={fStyles.input} value={form.client_id} onChange={e => f('client_id', e.target.value)}>
            <option value="">No client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
          </select>
        </div>
        <div style={fStyles.field}>
          <label style={fStyles.label}>Pipeline stage</label>
          <select style={fStyles.input} value={form.event_status} onChange={e => f('event_status', e.target.value)}>
            {EVENT_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div style={fStyles.field}>
          <label style={fStyles.label}>Event date</label>
          <input style={fStyles.input} type="date" value={form.event_date} onChange={e => f('event_date', e.target.value)} />
        </div>
        <div style={fStyles.field}>
          <label style={fStyles.label}>Venue</label>
          <input style={fStyles.input} placeholder="Venue name or address" value={form.venue} onChange={e => f('venue', e.target.value)} />
        </div>
        <div style={fStyles.field}>
          <label style={fStyles.label}>Guest count</label>
          <input style={fStyles.input} type="number" placeholder="0" value={form.headcount} onChange={e => f('headcount', e.target.value)} />
        </div>
        <div style={fStyles.field}>
          <label style={fStyles.label}>Budget ($)</label>
          <input style={fStyles.input} type="number" placeholder="0.00" value={form.budget} onChange={e => f('budget', e.target.value)} />
        </div>
        <div style={{ ...fStyles.field, gridColumn: 'span 2' }}>
          <label style={fStyles.label}>Description / notes</label>
          <textarea style={{ ...fStyles.input, resize: 'vertical', fontFamily: 'DM Sans, sans-serif' }} rows={3} placeholder="Event brief, special requirements..." value={form.description} onChange={e => f('description', e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={btnStyles.cancel}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.title} style={btnStyles.primary}>{saving ? 'Saving...' : initial ? 'Save changes' : 'Add Event'}</button>
      </div>
    </div>
  )
}

// ── PIPELINE STEPPER ──────────────────────────────────────────────────────────
function PipelineStepper({ current, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {EVENT_STATUSES.map(s => {
        const isActive = current === s.key
        return (
          <button key={s.key} onClick={() => onChange(s.key)} style={{ padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: isActive ? '700' : '400', border: `1px solid ${isActive ? s.color : '#f0f0eb'}`, backgroundColor: isActive ? s.bg : '#fafaf8', color: isActive ? s.color : '#8585A0', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s' }}>
            {s.label}
          </button>
        )
      })}
    </div>
  )
}

// ── RUN OF SHOW ───────────────────────────────────────────────────────────────
function RunOfShow({ eventId, eventTitle, eventDate, venue }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', start_time: '', end_time: '', role_label: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase.from('run_of_show').select('*').eq('project_id', eventId).order('start_time', { ascending: true })
    setItems(data || [])
    setLoading(false)
  }

  async function addItem() {
    if (!form.title || !form.start_time || !form.end_time) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('run_of_show').insert({
      project_id: eventId, user_id: user.id,
      title: form.title, start_time: form.start_time, end_time: form.end_time,
      role_label: form.role_label || null, notes: form.notes || null,
    }).select().single()
    if (data) setItems(prev => [...prev, data].sort((a, b) => a.start_time.localeCompare(b.start_time)))
    setForm({ title: '', start_time: '', end_time: '', role_label: '', notes: '' })
    setShowForm(false)
    setSaving(false)
  }

  async function deleteItem(id) {
    if (!confirm('Remove this item?')) return
    await supabase.from('run_of_show').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function handlePrint() {
    const printWindow = window.open('', '_blank')
    const rows = items.map(item => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f0f0eb;white-space:nowrap;font-weight:600;color:#7C5CBF;">${formatTime(item.start_time)} → ${formatTime(item.end_time)}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #f0f0eb;font-weight:600;color:#1A1A2E;">${item.title}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #f0f0eb;">${item.role_label ? `<span style="background:#F0EBF9;color:#7C5CBF;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">${item.role_label}</span>` : ''}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #f0f0eb;color:#8585A0;font-size:13px;">${item.notes || ''}</td>
      </tr>`).join('')
    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>Run of Show — ${eventTitle}</title>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
      <style>* { box-sizing:border-box; margin:0; padding:0; } body { font-family:'DM Sans',sans-serif; color:#1A1A2E; background:#fff; padding:48px; } @media print { body { padding:24px; } }</style>
    </head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #1A1A2E;">
        <div>
          <div style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#8585A0;margin-bottom:6px;">Run of Show</div>
          <h1 style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:#1A1A2E;letter-spacing:-0.5px;margin-bottom:4px;">${eventTitle}</h1>
          <div style="font-size:14px;color:#8585A0;">${eventDate ? formatDate(eventDate) : ''}${venue ? ` · ${venue}` : ''}</div>
        </div>
        <div style="background:linear-gradient(135deg,#7C5CBF,#6B8F71);padding:8px 16px;border-radius:10px;color:white;font-family:'Syne',sans-serif;font-weight:800;font-size:16px;">gabspace</div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#fafaf8;">
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#8585A0;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #f0f0eb;">Time</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#8585A0;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #f0f0eb;">Item</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#8585A0;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #f0f0eb;">Owner</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#8585A0;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #f0f0eb;">Notes</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #f0f0eb;font-size:11px;color:#8585A0;text-align:center;">Generated by gabspace · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      <script>window.onload = () => window.print()<\/script>
    </body></html>`)
    printWindow.document.close()
  }

  function handleShare() {
    const shareUrl = `${window.location.origin}/run-of-show.html?event=${eventId}`
    navigator.clipboard.writeText(shareUrl).then(() => alert('Share link copied!\n\nDeploy run-of-show.html to your public folder to activate.'))
  }

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '14px', padding: '24px', border: '1px solid #f0f0eb', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1A1A2E', margin: 0, fontFamily: 'Syne, sans-serif' }}>Run of Show</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {items.length > 0 && <>
            <button onClick={handlePrint} style={btnStyles.secondary}>🖨 Print</button>
            <button onClick={handleShare} style={btnStyles.secondary}>🔗 Share</button>
          </>}
          <button onClick={() => setShowForm(true)} style={btnStyles.secondary}>+ Add item</button>
        </div>
      </div>

      {showForm && (
        <div style={{ backgroundColor: '#fafaf8', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div style={{ ...fStyles.field, gridColumn: 'span 2' }}>
              <label style={fStyles.label}>Item title *</label>
              <input style={fStyles.input} placeholder="e.g. Guest Arrival, Dinner Service, Speeches" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div style={fStyles.field}>
              <label style={fStyles.label}>Start time *</label>
              <input style={fStyles.input} type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div style={fStyles.field}>
              <label style={fStyles.label}>End time *</label>
              <input style={fStyles.input} type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
            </div>
            <div style={fStyles.field}>
              <label style={fStyles.label}>Owner / Role</label>
              <input style={fStyles.input} placeholder="e.g. AV Team, Catering, Director" value={form.role_label} onChange={e => setForm({ ...form, role_label: e.target.value })} />
            </div>
            <div style={fStyles.field}>
              <label style={fStyles.label}>Notes</label>
              <input style={fStyles.input} placeholder="Any details or reminders" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={btnStyles.cancel}>Cancel</button>
            <button onClick={addItem} disabled={saving || !form.title || !form.start_time || !form.end_time} style={btnStyles.primary}>{saving ? 'Adding...' : 'Add item'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: '13px', color: '#8585A0', textAlign: 'center', padding: '20px 0' }}>Loading...</p>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>🕐</div>
          <p style={{ fontSize: '13px', color: '#8585A0', margin: 0 }}>No items yet — add your first timeline entry</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map((item, index) => (
            <div key={item.id} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: '14px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#7C5CBF', flexShrink: 0 }} />
                {index < items.length - 1 && <div style={{ width: '2px', flex: 1, minHeight: '24px', backgroundColor: '#f0f0eb', margin: '4px 0' }} />}
              </div>
              <div style={{ flex: 1, paddingBottom: index < items.length - 1 ? '8px' : '0', paddingTop: '8px' }}>
                <div style={{ backgroundColor: '#fafaf8', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: item.notes ? '4px' : '0' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#7C5CBF', whiteSpace: 'nowrap' }}>{formatTime(item.start_time)} → {formatTime(item.end_time)}</span>
                      {item.role_label && <span style={{ fontSize: '11px', fontWeight: '600', backgroundColor: '#F0EBF9', color: '#7C5CBF', padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap' }}>{item.role_label}</span>}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1A2E' }}>{item.title}</div>
                    {item.notes && <div style={{ fontSize: '12px', color: '#8585A0', marginTop: '3px' }}>{item.notes}</div>}
                  </div>
                  <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#8585A0', flexShrink: 0 }}>✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── STAFFING ──────────────────────────────────────────────────────────────────
function Staffing({ eventId }) {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ role: '', person_name: '', status: 'needed', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchStaff() }, [])

  async function fetchStaff() {
    setLoading(true)
    const { data } = await supabase.from('event_staffing').select('*').eq('project_id', eventId).order('created_at', { ascending: true })
    setStaff(data || [])
    setLoading(false)
  }

  async function addStaff() {
    if (!form.role) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('event_staffing').insert({
      project_id: eventId, user_id: user.id,
      role: form.role, person_name: form.person_name || null,
      status: form.status, notes: form.notes || null,
    }).select().single()
    if (data) setStaff(prev => [...prev, data])
    setForm({ role: '', person_name: '', status: 'needed', notes: '' })
    setShowForm(false)
    setSaving(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('event_staffing').update({ status }).eq('id', id)
    setStaff(prev => prev.map(s => s.id === id ? { ...s, status } : s))
  }

  async function deleteStaff(id) {
    if (!confirm('Remove this staff slot?')) return
    await supabase.from('event_staffing').delete().eq('id', id)
    setStaff(prev => prev.filter(s => s.id !== id))
  }

  const confirmed = staff.filter(s => s.status === 'confirmed').length
  const tentative = staff.filter(s => s.status === 'tentative').length
  const needed = staff.filter(s => s.status === 'needed').length

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '14px', padding: '24px', border: '1px solid #f0f0eb', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: staff.length > 0 ? '10px' : '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1A1A2E', margin: 0, fontFamily: 'Syne, sans-serif' }}>Staffing</h3>
        <button onClick={() => setShowForm(true)} style={btnStyles.secondary}>+ Add staff</button>
      </div>

      {/* Summary pills */}
      {staff.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {[
            { label: `${confirmed} confirmed`, color: '#1D9E75', bg: '#f0faf6' },
            { label: `${tentative} tentative`, color: '#D4874E', bg: '#FBF0E6' },
            { label: `${needed} needed`, color: '#8585A0', bg: '#F0EBF9' },
          ].map(p => (
            <span key={p.label} style={{ fontSize: '11px', fontWeight: '600', color: p.color, backgroundColor: p.bg, padding: '3px 10px', borderRadius: '20px' }}>{p.label}</span>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ backgroundColor: '#fafaf8', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div style={fStyles.field}>
              <label style={fStyles.label}>Role *</label>
              <input style={fStyles.input} placeholder="e.g. Event Coordinator, AV Tech, Greeter" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} />
            </div>
            <div style={fStyles.field}>
              <label style={fStyles.label}>Person's name</label>
              <input style={fStyles.input} placeholder="Name (optional if TBD)" value={form.person_name} onChange={e => setForm({ ...form, person_name: e.target.value })} />
            </div>
            <div style={fStyles.field}>
              <label style={fStyles.label}>Status</label>
              <select style={fStyles.input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="needed">Needed</option>
                <option value="tentative">Tentative</option>
                <option value="confirmed">Confirmed</option>
              </select>
            </div>
            <div style={fStyles.field}>
              <label style={fStyles.label}>Notes</label>
              <input style={fStyles.input} placeholder="Any details" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={btnStyles.cancel}>Cancel</button>
            <button onClick={addStaff} disabled={saving || !form.role} style={btnStyles.primary}>{saving ? 'Adding...' : 'Add'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: '13px', color: '#8585A0', textAlign: 'center', padding: '20px 0' }}>Loading...</p>
      ) : staff.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>👥</div>
          <p style={{ fontSize: '13px', color: '#8585A0', margin: 0 }}>No staff added yet — build your event roster</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 0.3fr', gap: '8px', padding: '6px 12px' }}>
            {['Role', 'Person', 'Status', ''].map(h => (
              <span key={h} style={{ fontSize: '11px', fontWeight: '600', color: '#8585A0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</span>
            ))}
          </div>
          {staff.map(s => {
            const st = STAFF_STATUSES[s.status]
            return (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 0.3fr', gap: '8px', padding: '10px 12px', backgroundColor: '#fafaf8', borderRadius: '8px', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1A2E' }}>{s.role}</div>
                  {s.notes && <div style={{ fontSize: '11px', color: '#8585A0' }}>{s.notes}</div>}
                </div>
                <span style={{ fontSize: '13px', color: s.person_name ? '#3D3D5C' : '#B0B0C0', fontStyle: s.person_name ? 'normal' : 'italic' }}>
                  {s.person_name || 'TBD'}
                </span>
                <select
                  value={s.status}
                  onChange={e => updateStatus(s.id, e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: '20px', border: 'none', fontSize: '11px', fontWeight: '600', backgroundColor: st.bg, color: st.color, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                >
                  <option value="needed">Needed</option>
                  <option value="tentative">Tentative</option>
                  <option value="confirmed">Confirmed</option>
                </select>
                <button onClick={() => deleteStaff(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#8585A0' }}>✕</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── PROPOSAL GENERATOR ────────────────────────────────────────────────────────
function ProposalGenerator({ event, onClose }) {
  const [senderName, setSenderName] = useState('')
  const [senderTitle, setSenderTitle] = useState('')
  const [coverMessage, setCoverMessage] = useState('')
  const [scopeOfServices, setScopeOfServices] = useState('')
  const [milestones, setMilestones] = useState([{ label: '', date: '' }])
  const [investment, setInvestment] = useState(event.budget ? `$${parseFloat(event.budget).toLocaleString()}` : '')
  const [investmentNotes, setInvestmentNotes] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('user_settings').select('display_name, job_title').eq('user_id', user.id).maybeSingle().then(({ data }) => {
          setSenderName(data?.display_name || user.email)
          setSenderTitle(data?.job_title || '')
        })
      }
    })
  }, [])

  function addMilestone() { setMilestones(prev => [...prev, { label: '', date: '' }]) }
  function updateMilestone(i, key, val) { setMilestones(prev => prev.map((m, idx) => idx === i ? { ...m, [key]: val } : m)) }
  function removeMilestone(i) { setMilestones(prev => prev.filter((_, idx) => idx !== i)) }

  function generateHTML() {
    const milestonesHTML = milestones.filter(m => m.label).map(m => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0eb;font-weight:500;color:#1A1A2E;">${m.label}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0eb;color:#8585A0;text-align:right;">${m.date ? formatDateLong(m.date) : '—'}</td>
      </tr>`).join('')

    return `<!DOCTYPE html><html><head>
      <title>Proposal — ${event.title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap" rel="stylesheet"/>
      <style>
        * { box-sizing:border-box; margin:0; padding:0; }
        body { font-family:'DM Sans',sans-serif; color:#1A1A2E; background:#F7F5F0; padding:48px 24px; }
        .page { max-width:680px; margin:0 auto; }
        @media print { body { background:#fff; padding:24px; } }
      </style>
    </head><body><div class="page">

      <!-- Header -->
      <div style="background:#1A1A2E;border-radius:20px;padding:40px;margin-bottom:24px;position:relative;overflow:hidden;">
        <div style="position:absolute;width:300px;height:300px;border-radius:50%;background:#7C5CBF;opacity:0.1;top:-80px;right:-80px;"></div>
        <div style="position:relative;z-index:1;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;">
            <div style="background:linear-gradient(135deg,#7C5CBF,#6B8F71);padding:8px 18px;border-radius:10px;color:white;font-family:'Syne',sans-serif;font-weight:800;font-size:18px;">gabspace</div>
            <div style="text-align:right;">
              <div style="font-size:14px;font-weight:600;color:#fff;">${senderName}</div>
              ${senderTitle ? `<div style="font-size:12px;color:rgba(255,255,255,0.5);">${senderTitle}</div>` : ''}
            </div>
          </div>
          <div style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:8px;">Event Proposal</div>
          <h1 style="font-family:'Syne',sans-serif;font-size:32px;font-weight:800;color:#fff;letter-spacing:-0.5px;margin-bottom:6px;">${event.title}</h1>
          <div style="font-size:14px;color:rgba(255,255,255,0.5);">Prepared for ${event.clients?.name || 'Client'} · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
        </div>
      </div>

      <!-- Event Overview -->
      <div style="background:#fff;border-radius:16px;padding:28px;margin-bottom:20px;border:1px solid rgba(0,0,0,0.06);">
        <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#8585A0;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid #f0f0eb;">Event Overview</div>
        <table style="width:100%;border-collapse:collapse;">
          ${event.event_date ? `<tr><td style="padding:8px 0;font-size:12px;color:#8585A0;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;width:140px;">Date</td><td style="padding:8px 0;font-size:14px;font-weight:500;color:#1A1A2E;">${formatDateLong(event.event_date)}</td></tr>` : ''}
          ${event.venue ? `<tr><td style="padding:8px 0;font-size:12px;color:#8585A0;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Venue</td><td style="padding:8px 0;font-size:14px;font-weight:500;color:#1A1A2E;">${event.venue}</td></tr>` : ''}
          ${event.headcount ? `<tr><td style="padding:8px 0;font-size:12px;color:#8585A0;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Guest Count</td><td style="padding:8px 0;font-size:14px;font-weight:500;color:#1A1A2E;">${event.headcount} estimated</td></tr>` : ''}
          ${event.clients?.name ? `<tr><td style="padding:8px 0;font-size:12px;color:#8585A0;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Client</td><td style="padding:8px 0;font-size:14px;font-weight:500;color:#1A1A2E;">${event.clients.name}${event.clients.company ? ` · ${event.clients.company}` : ''}</td></tr>` : ''}
        </table>
      </div>

      ${coverMessage ? `
      <!-- Cover Message -->
      <div style="background:#fff;border-radius:16px;padding:28px;margin-bottom:20px;border:1px solid rgba(0,0,0,0.06);">
        <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#8585A0;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid #f0f0eb;">A Note</div>
        <p style="font-size:15px;color:#3D3D5C;line-height:1.75;font-weight:300;">${coverMessage.replace(/\n/g, '<br/>')}</p>
      </div>` : ''}

      ${scopeOfServices ? `
      <!-- Scope -->
      <div style="background:#fff;border-radius:16px;padding:28px;margin-bottom:20px;border:1px solid rgba(0,0,0,0.06);">
        <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#8585A0;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid #f0f0eb;">Scope of Services</div>
        <p style="font-size:14px;color:#3D3D5C;line-height:1.75;">${scopeOfServices.replace(/\n/g, '<br/>')}</p>
      </div>` : ''}

      ${milestones.filter(m => m.label).length > 0 ? `
      <!-- Timeline -->
      <div style="background:#fff;border-radius:16px;padding:28px;margin-bottom:20px;border:1px solid rgba(0,0,0,0.06);">
        <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#8585A0;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid #f0f0eb;">Key Milestones</div>
        <table style="width:100%;border-collapse:collapse;">${milestonesHTML}</table>
      </div>` : ''}

      ${investment ? `
      <!-- Investment -->
      <div style="background:#1A1A2E;border-radius:16px;padding:28px;margin-bottom:20px;">
        <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.1);">Investment</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:14px;color:rgba(255,255,255,0.6);">Total investment</div>
          <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:#fff;">${investment}</div>
        </div>
        ${investmentNotes ? `<p style="font-size:13px;color:rgba(255,255,255,0.4);margin-top:12px;line-height:1.6;">${investmentNotes}</p>` : ''}
      </div>` : ''}

      <!-- Footer -->
      <div style="text-align:center;padding-top:24px;border-top:1px solid rgba(0,0,0,0.08);margin-top:8px;">
        <div style="font-size:12px;color:#8585A0;">Prepared by ${senderName}${senderTitle ? ` · ${senderTitle}` : ''}</div>
        <div style="font-size:11px;color:#B0B0C0;margin-top:4px;">Generated with gabspace · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      </div>

    </div><script>window.onload = () => window.print()<\/script></body></html>`
  }

  async function handleGenerate(mode) {
    setGenerating(true)
    const html = generateHTML()

    if (mode === 'print') {
      const w = window.open('', '_blank')
      w.document.write(html)
      w.document.close()
    }

    if (mode === 'share') {
      const blob = new Blob([html], { type: 'text/html' })
      const file = new File([blob], `proposal-${event.id}.html`, { type: 'text/html' })
      const fileName = `${event.id}/proposal-${Date.now()}.html`
      const { error: uploadError } = await supabase.storage.from('project-files').upload(fileName, file)
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(fileName)
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('project_documents').insert({
          project_id: event.id, user_id: user.id,
          name: `Proposal — ${event.title}.html`,
          file_url: urlData.publicUrl, file_type: 'text/html',
        })
        navigator.clipboard.writeText(urlData.publicUrl).then(() => {
          alert('Proposal saved and share link copied to clipboard!')
        })
      }
    }

    setGenerating(false)
    if (mode !== 'share') onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '600px', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1A1A2E', margin: 0, fontFamily: 'Syne, sans-serif' }}>Generate Proposal</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#8585A0' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Sender */}
          <div style={{ backgroundColor: '#fafaf8', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#8585A0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Sender (you)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={fStyles.field}>
                <label style={fStyles.label}>Your name</label>
                <input style={fStyles.input} value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Your full name" />
              </div>
              <div style={fStyles.field}>
                <label style={fStyles.label}>Your title</label>
                <input style={fStyles.input} value={senderTitle} onChange={e => setSenderTitle(e.target.value)} placeholder="e.g. Director of Events" />
              </div>
            </div>
            <p style={{ fontSize: '11px', color: '#B0B0C0', marginTop: '8px' }}>Save your name and title in Settings to auto-fill next time.</p>
          </div>

          {/* Cover message */}
          <div style={fStyles.field}>
            <label style={fStyles.label}>Cover message / personal note</label>
            <textarea style={{ ...fStyles.input, resize: 'vertical', fontFamily: 'DM Sans, sans-serif' }} rows={4} placeholder="Thank you for the opportunity to work on your event. We're excited to bring your vision to life..." value={coverMessage} onChange={e => setCoverMessage(e.target.value)} />
          </div>

          {/* Scope */}
          <div style={fStyles.field}>
            <label style={fStyles.label}>Scope of services</label>
            <textarea style={{ ...fStyles.input, resize: 'vertical', fontFamily: 'DM Sans, sans-serif' }} rows={4} placeholder="Full event coordination and management including vendor relations, day-of execution, timeline management..." value={scopeOfServices} onChange={e => setScopeOfServices(e.target.value)} />
          </div>

          {/* Milestones */}
          <div>
            <label style={{ ...fStyles.label, display: 'block', marginBottom: '8px' }}>Key milestones</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
              {milestones.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input style={{ ...fStyles.input, flex: 2 }} placeholder="e.g. Contract signed, Final walkthrough" value={m.label} onChange={e => updateMilestone(i, 'label', e.target.value)} />
                  <input style={{ ...fStyles.input, flex: 1 }} type="date" value={m.date} onChange={e => updateMilestone(i, 'date', e.target.value)} />
                  {milestones.length > 1 && <button onClick={() => removeMilestone(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8585A0', fontSize: '14px' }}>✕</button>}
                </div>
              ))}
            </div>
            <button onClick={addMilestone} style={{ fontSize: '12px', color: '#7C5CBF', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ Add milestone</button>
          </div>

          {/* Investment */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
            <div style={fStyles.field}>
              <label style={fStyles.label}>Investment total</label>
              <input style={fStyles.input} placeholder="e.g. $12,500" value={investment} onChange={e => setInvestment(e.target.value)} />
            </div>
            <div style={fStyles.field}>
              <label style={fStyles.label}>Investment notes</label>
              <input style={fStyles.input} placeholder="e.g. Deposit due upon signing, balance 30 days prior" value={investmentNotes} onChange={e => setInvestmentNotes(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f0f0eb' }}>
          <button onClick={onClose} style={btnStyles.cancel}>Cancel</button>
          <button onClick={() => handleGenerate('share')} disabled={generating} style={btnStyles.secondary}>
            {generating ? 'Saving...' : '🔗 Save & share link'}
          </button>
          <button onClick={() => handleGenerate('print')} disabled={generating} style={btnStyles.primary}>
            {generating ? 'Generating...' : '🖨 Download / Print'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── EVENT DETAIL ──────────────────────────────────────────────────────────────
function EventDetail({ event, onBack, onDelete, clients, onRefresh }) {
  const [data, setData] = useState(event)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [tasks, setTasks] = useState([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [notes, setNotes] = useState(event.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [budgetItems, setBudgetItems] = useState([])
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [budgetForm, setBudgetForm] = useState({ category: '', projected_amount: '', actual_amount: '', notes: '' })
  const [showProposal, setShowProposal] = useState(false)
  const [activeTab, setActiveTab] = useState('details')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: tasksData }, { data: docsData }, { data: budgetData }] = await Promise.all([
      supabase.from('tasks').select('*').eq('project_id', event.id).order('created_at', { ascending: true }),
      supabase.from('project_documents').select('*').eq('project_id', event.id).order('created_at', { ascending: false }),
      supabase.from('project_budget_items').select('*').eq('project_id', event.id).order('created_at', { ascending: true }),
    ])
    setTasks(tasksData || [])
    setDocuments(docsData || [])
    setBudgetItems(budgetData || [])
  }

  async function handleEditSave(form) {
    setSaving(true); setError(null)
    const { error } = await supabase.from('projects').update({
      title: form.title, client_id: form.client_id || null, event_status: form.event_status,
      event_date: form.event_date || null, venue: form.venue || null,
      headcount: form.headcount ? parseInt(form.headcount) : null,
      budget: form.budget ? parseFloat(form.budget) : null, description: form.description || null,
    }).eq('id', event.id)
    if (error) { setError(error.message); setSaving(false); return }
    setData(prev => ({ ...prev, ...form })); setEditMode(false); setSaving(false); onRefresh()
  }

  async function updateStage(event_status) {
    await supabase.from('projects').update({ event_status }).eq('id', event.id)
    setData(prev => ({ ...prev, event_status })); onRefresh()
  }

  async function saveNotes() {
    setSavingNotes(true)
    await supabase.from('projects').update({ notes }).eq('id', event.id)
    setSavingNotes(false); setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  async function toggleTask(task) {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id)
    setTasks(prev => prev.map(tk => tk.id === task.id ? { ...tk, status: newStatus } : tk))
  }

  async function addTask() {
    if (!newTaskTitle.trim()) return
    setAddingTask(true)
    const { data } = await supabase.from('tasks').insert({ title: newTaskTitle, project_id: event.id, status: 'todo' }).select().single()
    if (data) setTasks(prev => [...prev, data])
    setNewTaskTitle(''); setAddingTask(false)
  }

  async function deleteTask(id) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(tk => tk.id !== id))
  }

  async function addBudgetItem() {
    const { data } = await supabase.from('project_budget_items').insert({
      project_id: event.id, category: budgetForm.category,
      projected_amount: budgetForm.projected_amount ? parseFloat(budgetForm.projected_amount) : null,
      actual_amount: budgetForm.actual_amount ? parseFloat(budgetForm.actual_amount) : null,
      notes: budgetForm.notes || null,
    }).select().single()
    if (data) setBudgetItems(prev => [...prev, data])
    setBudgetForm({ category: '', projected_amount: '', actual_amount: '', notes: '' }); setShowBudgetForm(false)
  }

  async function deleteBudgetItem(id) {
    if (!confirm('Delete this budget item?')) return
    await supabase.from('project_budget_items').delete().eq('id', id)
    setBudgetItems(prev => prev.filter(i => i.id !== id))
  }

  async function uploadDocument(e) {
    const file = e.target.files[0]; if (!file) return
    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const fileName = `${event.id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('project-files').upload(fileName, file)
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(fileName)
      await supabase.from('project_documents').insert({ project_id: event.id, user_id: user.id, name: file.name, file_url: urlData.publicUrl, file_type: file.type })
      fetchAll()
    }
    setUploading(false)
  }

  async function deleteDocument(id) {
    if (!confirm('Delete this document?')) return
    await supabase.from('project_documents').delete().eq('id', id)
    setDocuments(prev => prev.filter(d => d.id !== id))
  }

  const es = getEventStatus(data.event_status)
  const doneTasks = tasks.filter(tk => tk.status === 'done').length
  const totalProjected = budgetItems.reduce((s, i) => s + (parseFloat(i.projected_amount) || 0), 0)
  const totalActual = budgetItems.reduce((s, i) => s + (parseFloat(i.actual_amount) || 0), 0)
  const overallBudget = parseFloat(data.budget) || 0

  if (editMode) {
    return (
      <div style={{ padding: '32px', fontFamily: 'DM Sans, sans-serif' }}>
        <button onClick={() => setEditMode(false)} style={btnStyles.back}>← Back to event</button>
        <div style={{ marginTop: '20px' }}>
          <EventForm clients={clients} onSave={handleEditSave} onCancel={() => setEditMode(false)} saving={saving} error={error}
            initial={{ title: data.title, client_id: data.client_id || '', event_status: data.event_status || 'inquiry', event_date: formatDateInput(data.event_date), venue: data.venue || '', headcount: data.headcount || '', budget: data.budget || '', description: data.description || '' }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px', fontFamily: 'DM Sans, sans-serif' }}>
      {showProposal && <ProposalGenerator event={data} onClose={() => { setShowProposal(false); fetchAll() }} />}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={onBack} style={btnStyles.back}>← Back to events</button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowProposal(true)} style={{ ...btnStyles.secondary, color: '#7C5CBF', borderColor: '#C9B9E8' }}>📄 Proposal</button>
          <button onClick={() => setEditMode(true)} style={btnStyles.edit}>Edit</button>
          <button onClick={() => onDelete(event.id)} style={btnStyles.delete}>Delete</button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ backgroundColor: '#1A1A2E', borderRadius: '16px', padding: '32px', marginBottom: '20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: '240px', height: '240px', borderRadius: '50%', background: es.color, opacity: 0.1, top: '-60px', right: '-60px' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', margin: '0 0 6px', fontFamily: 'Syne, sans-serif', letterSpacing: '-0.3px' }}>{data.title}</h1>
              {data.clients?.name && <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>{data.clients.name}{data.clients.company ? ` · ${data.clients.company}` : ''}</p>}
            </div>
            <div style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', backgroundColor: es.bg, color: es.color }}>{es.label}</div>
          </div>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {[
              data.event_date && { icon: '📅', label: 'Date', value: formatDate(data.event_date) },
              data.venue && { icon: '📍', label: 'Venue', value: data.venue },
              data.headcount && { icon: '👥', label: 'Guests', value: `${data.headcount}` },
              data.budget && { icon: '💰', label: 'Budget', value: `$${parseFloat(data.budget).toLocaleString()}` },
            ].filter(Boolean).map(item => (
              <div key={item.label} style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: '10px', padding: '10px 16px' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>{item.icon} {item.label}</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline */}
      <div style={{ backgroundColor: '#fff', borderRadius: '14px', padding: '20px 24px', border: '1px solid #f0f0eb', marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#8585A0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Pipeline stage</div>
        <PipelineStepper current={data.event_status} onChange={updateStage} />
      </div>
      
{/* Tab bar — only show if concept_data exists */}
      {data.concept_data && (
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', backgroundColor: '#fff', borderRadius: '10px', padding: '6px', border: '1px solid #f0f0eb' }}>
          {[
            { key: 'details', label: 'Planning' },
            { key: 'concept', label: '💡 Concept' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              flex: 1, padding: '8px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: activeTab === tab.key ? '700' : '400',
              backgroundColor: activeTab === tab.key ? '#1A1A2E' : 'transparent',
              color: activeTab === tab.key ? '#fff' : '#8585A0',
              fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
            }}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Concept tab */}
      {activeTab === 'concept' && data.concept_data && (() => {
        const c = data.concept_data
        const brief = c.brief || {}
        const sectionLabel = { fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7C5CBF', marginBottom: '10px' }
        const bodyText = { fontSize: '14px', color: '#3D3D5C', lineHeight: '1.65', margin: 0 }
        const card = { backgroundColor: '#fff', borderRadius: '14px', padding: '22px 24px', border: '1px solid #f0f0eb', marginBottom: '16px' }
        const divider = { border: 'none', borderTop: '1px solid #f0f0eb', margin: '16px 0' }
        const tagViolet = { background: '#F0EBF9', color: '#7C5CBF' }
        const tagSage = { background: '#EAF2EA', color: '#6B8F71' }
        const tagAmber = { background: '#FBF0E6', color: '#D4874E' }
        const tagRose = { background: '#FAF0F2', color: '#C06B7A' }
        const tagStyles = [tagViolet, tagSage, tagAmber, tagRose]
        const tag = { fontSize: '12px', padding: '4px 11px', borderRadius: '100px', fontWeight: '500' }
        return (
          <>
            <div style={card}>
              <div style={sectionLabel}>The Big Idea</div>
              <p style={bodyText}>{c.coreConcept}</p>
              <hr style={divider} />
              <div style={sectionLabel}>Why It Works</div>
              <p style={bodyText}>{c.why}</p>
            </div>

            {c.experienceDesign?.length > 0 && (
              <div style={card}>
                <div style={sectionLabel}>Experience Design — Key Moments</div>
                {c.experienceDesign.map((m, i) => (
                  <div key={i} style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1A2E', marginBottom: '2px' }}>{m.moment}</div>
                    <div style={{ fontSize: '13px', color: '#8585A0', lineHeight: '1.55' }}>{m.description}</div>
                  </div>
                ))}
              </div>
            )}

            {c.runOfShow?.length > 0 && (
              <div style={card}>
                <div style={sectionLabel}>Run of Show (Concept)</div>
                {c.runOfShow.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#7C5CBF', minWidth: '80px', paddingTop: '2px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{r.time}</span>
                    <span style={{ fontSize: '13px', color: '#3D3D5C', lineHeight: '1.55', flex: 1 }}>{r.beat}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={card}>
              {c.venueConsiderations && <>
                <div style={sectionLabel}>Venue & Space</div>
                <p style={{ ...bodyText, marginBottom: '16px' }}>{c.venueConsiderations}</p>
                <hr style={divider} />
              </>}
              {c.productionNotes && <>
                <div style={sectionLabel}>Production Notes</div>
                <p style={{ ...bodyText, marginBottom: '16px' }}>{c.productionNotes}</p>
                <hr style={divider} />
              </>}
              {c.pressAndContent && <>
                <div style={sectionLabel}>Press & Content Strategy</div>
                <p style={bodyText}>{c.pressAndContent}</p>
              </>}
            </div>

            {c.successMetrics?.length > 0 && (
              <div style={card}>
                <div style={sectionLabel}>Success Metrics</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {c.successMetrics.map((m, i) => (
                    <div key={i} style={{ background: '#F7F5F0', borderRadius: '8px', padding: '12px 14px' }}>
                      <div style={{ fontSize: '11px', color: '#8585A0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{m.label}</div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1A2E' }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={card}>
              {c.vendorCategories?.length > 0 && <>
                <div style={sectionLabel}>Vendor Categories</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                  {c.vendorCategories.map((v, i) => <span key={i} style={{ ...tag, ...tagStyles[i % tagStyles.length] }}>{v}</span>)}
                </div>
                <hr style={divider} />
              </>}
              {c.aestheticKeywords?.length > 0 && <>
                <div style={sectionLabel}>Aesthetic Keywords</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                  {c.aestheticKeywords.map((k, i) => <span key={i} style={{ ...tag, ...tagViolet }}>{k}</span>)}
                </div>
                <hr style={divider} />
              </>}
              {c.budgetAllocation?.length > 0 && <>
                <div style={sectionLabel}>Budget Allocation</div>
                {c.budgetAllocation.map((b, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                    <span style={{ color: '#3D3D5C' }}>{b.line}</span>
                    <span style={{ fontWeight: '600', color: '#7C5CBF' }}>{b.pct}</span>
                  </div>
                ))}
              </>}
            </div>
          </>
        )
      })()}

      {/* Planning tab (default) */}
      {(!data.concept_data || activeTab === 'details') && <>
        <RunOfShow eventId={event.id} eventTitle={data.title} eventDate={data.event_date} venue={data.venue} />
        <Staffing eventId={event.id} />
        {data.description && (
          <div style={{ backgroundColor: '#fff', borderRadius: '14px', padding: '20px 24px', border: '1px solid #f0f0eb', marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#8585A0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Brief</div>
            <p style={{ fontSize: '14px', color: '#3D3D5C', lineHeight: '1.65', margin: 0 }}>{data.description}</p>
          </div>
        )}
        <div style={{ backgroundColor: '#fff', borderRadius: '14px', padding: '24px', border: '1px solid #f0f0eb', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1A1A2E', margin: 0, fontFamily: 'Syne, sans-serif' }}>Budget</h3>
            <button onClick={() => setShowBudgetForm(true)} style={btnStyles.secondary}>+ Add category</button>
          </div>
          {showBudgetForm && (
            <div style={{ backgroundColor: '#fafaf8', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                {[{ label: 'Category *', key: 'category', placeholder: 'e.g. Catering, Venue' }, { label: 'Projected ($)', key: 'projected_amount', placeholder: '0.00', type: 'number' }, { label: 'Actual ($)', key: 'actual_amount', placeholder: '0.00', type: 'number' }, { label: 'Notes', key: 'notes', placeholder: 'Optional' }].map(({ label, key, placeholder, type }) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '500', color: '#8585A0' }}>{label}</label>
                    <input style={fStyles.input} type={type || 'text'} placeholder={placeholder} value={budgetForm[key]} onChange={e => setBudgetForm({ ...budgetForm, [key]: e.target.value })} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowBudgetForm(false)} style={btnStyles.cancel}>Cancel</button>
                <button onClick={addBudgetItem} disabled={!budgetForm.category} style={btnStyles.primary}>Add</button>
              </div>
            </div>
          )}
          {budgetItems.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#8585A0', textAlign: 'center', padding: '24px 0' }}>No budget categories yet</p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.4fr', gap: '8px', padding: '8px 12px', backgroundColor: '#fafaf8', borderRadius: '8px', marginBottom: '6px' }}>
                {['Category', 'Projected', 'Actual', 'Difference', ''].map(h => <span key={h} style={{ fontSize: '11px', fontWeight: '600', color: '#8585A0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</span>)}
              </div>
              {budgetItems.map(item => {
                const proj = parseFloat(item.projected_amount) || 0
                const actual = parseFloat(item.actual_amount) || 0
                const diff = proj - actual
                return (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.4fr', gap: '8px', padding: '10px 12px', backgroundColor: '#fafaf8', borderRadius: '8px', alignItems: 'center', marginBottom: '4px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#1A1A2E' }}>{item.category}</div>
                      {item.notes && <div style={{ fontSize: '11px', color: '#8585A0' }}>{item.notes}</div>}
                    </div>
                    <span style={{ fontSize: '13px', color: '#3D3D5C' }}>{proj > 0 ? `$${proj.toLocaleString()}` : '—'}</span>
                    <span style={{ fontSize: '13px', color: '#3D3D5C' }}>{actual > 0 ? `$${actual.toLocaleString()}` : '—'}</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: proj === 0 ? '#8585A0' : diff >= 0 ? '#1D9E75' : '#cc3333' }}>{proj === 0 ? '—' : diff >= 0 ? `+$${diff.toLocaleString()}` : `-$${Math.abs(diff).toLocaleString()}`}</span>
                    <button onClick={() => deleteBudgetItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#8585A0' }}>✕</button>
                  </div>
                )
              })}
              <div style={{ borderTop: '1px solid #f0f0eb', paddingTop: '12px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { label: 'Total projected', value: totalProjected, color: '#1A1A2E' },
                  { label: 'Total actual', value: totalActual, color: '#cc3333' },
                  overallBudget > 0 && { label: 'Remaining', value: overallBudget - totalActual, color: (overallBudget - totalActual) >= 0 ? '#1D9E75' : '#cc3333' },
                ].filter(Boolean).map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#fafaf8', borderRadius: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#8585A0' }}>{row.label}</span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: row.color }}>${row.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div style={{ backgroundColor: '#fff', borderRadius: '14px', padding: '24px', border: '1px solid #f0f0eb', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1A1A2E', margin: 0, fontFamily: 'Syne, sans-serif' }}>Tasks</h3>
            <span style={{ fontSize: '12px', color: '#8585A0' }}>{doneTasks}/{tasks.length} done</span>
          </div>
          {tasks.length > 0 && <div style={{ height: '4px', backgroundColor: '#f0f0eb', borderRadius: '2px', overflow: 'hidden', marginBottom: '14px' }}><div style={{ height: '100%', width: `${(doneTasks / tasks.length) * 100}%`, backgroundColor: '#7C5CBF', borderRadius: '2px', transition: 'width 0.3s' }} /></div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
            {tasks.map(task => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', backgroundColor: '#fafaf8', borderRadius: '8px' }}>
                <button onClick={() => toggleTask(task)} style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, cursor: 'pointer', border: `2px solid ${task.status === 'done' ? '#7C5CBF' : '#e0e0e0'}`, backgroundColor: task.status === 'done' ? '#7C5CBF' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {task.status === 'done' && <span style={{ color: '#fff', fontSize: '10px', fontWeight: '700' }}>✓</span>}
                </button>
                <span style={{ flex: 1, fontSize: '13px', color: task.status === 'done' ? '#8585A0' : '#1A1A2E', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</span>
                <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', color: '#8585A0', cursor: 'pointer', fontSize: '12px' }}>✕</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input style={{ ...fStyles.input, flex: 1 }} placeholder="Add a task..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} />
            <button onClick={addTask} disabled={addingTask || !newTaskTitle.trim()} style={btnStyles.primary}>Add</button>
          </div>
        </div>
        <div style={{ backgroundColor: '#fff', borderRadius: '14px', padding: '24px', border: '1px solid #f0f0eb', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1A1A2E', margin: 0, fontFamily: 'Syne, sans-serif' }}>Notes</h3>
            <button onClick={saveNotes} disabled={savingNotes} style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', backgroundColor: notesSaved ? '#1D9E75' : '#7C5CBF', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s' }}>
              {notesSaved ? '✓ Saved' : savingNotes ? 'Saving...' : 'Save notes'}
            </button>
          </div>
          <textarea style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #f0f0eb', fontSize: '13px', color: '#1A1A2E', outline: 'none', resize: 'vertical', fontFamily: 'DM Sans, sans-serif', lineHeight: '1.6', boxSizing: 'border-box', backgroundColor: '#fafaf8' }} rows={5} placeholder="Internal notes, client preferences, special requirements..." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div style={{ backgroundColor: '#fff', borderRadius: '14px', padding: '24px', border: '1px solid #f0f0eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1A1A2E', margin: 0, fontFamily: 'Syne, sans-serif' }}>Documents</h3>
            <label style={{ ...btnStyles.primary, display: 'inline-block', cursor: 'pointer' }}>
              {uploading ? 'Uploading...' : '+ Upload file'}
              <input type="file" onChange={uploadDocument} style={{ display: 'none' }} />
            </label>
          </div>
          {documents.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#8585A0' }}>No documents yet — upload contracts, floor plans, proposals, or any event files</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {documents.map(doc => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', backgroundColor: '#fafaf8', borderRadius: '8px' }}>
                  <span style={{ fontSize: '18px' }}>{doc.file_type?.includes('image') ? '🖼️' : doc.file_type?.includes('pdf') ? '📄' : '📁'}</span>
                  <span style={{ flex: 1, fontSize: '13px', color: '#1A1A2E', fontWeight: '500' }}>{doc.name}</span>
                  <span style={{ fontSize: '11px', color: '#8585A0' }}>{new Date(doc.created_at).toLocaleDateString()}</span>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#7C5CBF', fontWeight: '600', textDecoration: 'none' }}>Open</a>
                  <button onClick={() => deleteDocument(doc.id)} style={{ background: 'none', border: 'none', color: '#8585A0', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </>}
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function MyEvents() {
  const [events, setEvents] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => { fetchEvents(); fetchClients() }, [])

  async function fetchEvents() {
    setLoading(true)
    const { data } = await supabase.from('projects').select('*, clients(name, company)').eq('type', 'event').neq('event_status', 'concept').order('event_date', { ascending: true })
    if (data) setEvents(data)
    setLoading(false)
  }

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('id, name, company')
    if (data) setClients(data)
  }

  async function handleSave(form) {
    setSaving(true); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('projects').insert({
      type: 'event', title: form.title, client_id: form.client_id || null,
      status: 'planning', event_status: form.event_status || 'inquiry',
      event_date: form.event_date || null, venue: form.venue || null,
      headcount: form.headcount ? parseInt(form.headcount) : null,
      budget: form.budget ? parseFloat(form.budget) : null,
      description: form.description || null, source: 'internal', user_id: user.id,
    })
    if (error) { setError(error.message); setSaving(false); return }
    setShowForm(false); setSaving(false); fetchEvents()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this event? This cannot be undone.')) return
    await supabase.from('projects').delete().eq('id', id)
    fetchEvents(); setSelectedEvent(null)
  }

  const filtered = filterStatus === 'all' ? events : events.filter(e => e.event_status === filterStatus)
  const now = new Date()
  const upcoming = filtered.filter(e => !e.event_date || new Date(e.event_date) >= now)
  const past = filtered.filter(e => e.event_date && new Date(e.event_date) < now)

  if (selectedEvent) {
    return <EventDetail event={selectedEvent} onBack={() => setSelectedEvent(null)} onDelete={handleDelete} clients={clients} onRefresh={fetchEvents} />
  }

  return (
    <div style={{ padding: '32px', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#1A1A2E', margin: '0 0 4px', fontFamily: 'Syne, sans-serif' }}>My Events</h2>
          <p style={{ fontSize: '13px', color: '#8585A0', margin: 0 }}>{events.length} total · {upcoming.length} upcoming</p>
        </div>
        <button onClick={() => setShowForm(true)} style={btnStyles.primary}>+ Add Event</button>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <button onClick={() => setFilterStatus('all')} style={{ padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: filterStatus === 'all' ? '700' : '400', border: `1px solid ${filterStatus === 'all' ? '#1A1A2E' : '#f0f0eb'}`, backgroundColor: filterStatus === 'all' ? '#1A1A2E' : '#fff', color: filterStatus === 'all' ? '#fff' : '#8585A0' }}>All</button>
        {EVENT_STATUSES.map(s => (
          <button key={s.key} onClick={() => setFilterStatus(filterStatus === s.key ? 'all' : s.key)} style={{ padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: filterStatus === s.key ? '700' : '400', border: `1px solid ${filterStatus === s.key ? s.color : '#f0f0eb'}`, backgroundColor: filterStatus === s.key ? s.bg : '#fff', color: filterStatus === s.key ? s.color : '#8585A0' }}>
            {s.label}{events.filter(e => e.event_status === s.key).length > 0 && <span style={{ marginLeft: '5px', opacity: 0.7 }}>{events.filter(e => e.event_status === s.key).length}</span>}
          </button>
        ))}
      </div>

      {showForm && <EventForm clients={clients} onSave={handleSave} onCancel={() => { setShowForm(false); setError(null) }} saving={saving} error={error} />}

      {loading ? (
        <div style={{ fontSize: '13px', color: '#8585A0', padding: '40px', textAlign: 'center' }}>Loading events...</div>
      ) : events.length === 0 ? (
        <EmptyState onAdd={() => setShowForm(true)} />
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#8585A0', textAlign: 'center', padding: '40px' }}>No events with this status.</div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#8585A0', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>Upcoming · {upcoming.length}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
                {upcoming.map(event => <EventCard key={event.id} event={event} onClick={() => setSelectedEvent(event)} />)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#8585A0', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>Past · {past.length}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px', opacity: 0.7 }}>
                {past.map(event => <EventCard key={event.id} event={event} onClick={() => setSelectedEvent(event)} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── SHARED STYLES ─────────────────────────────────────────────────────────────
const btnStyles = {
  primary:   { padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#7C5CBF', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' },
  secondary: { padding: '7px 14px', borderRadius: '8px', border: '1px solid #f0f0eb', backgroundColor: '#fff', color: '#3D3D5C', fontSize: '13px', fontWeight: '500', cursor: 'pointer' },
  cancel:    { padding: '9px 16px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff', color: '#666', fontSize: '13px', cursor: 'pointer' },
  back:      { padding: '8px 14px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff', color: '#555', fontSize: '13px', cursor: 'pointer' },
  edit:      { padding: '8px 14px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff', color: '#555', fontSize: '13px', cursor: 'pointer' },
  delete:    { padding: '8px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#fff0f0', color: '#cc3333', fontSize: '13px', cursor: 'pointer' },
}

const fStyles = {
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '500', color: '#666' },
  input: { padding: '9px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '13px', color: '#1A1A2E', outline: 'none', backgroundColor: '#fff' },
}
