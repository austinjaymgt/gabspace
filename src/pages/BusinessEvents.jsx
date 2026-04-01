import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

const eventTypes = [
  'Networking mixer', 'Trade show', 'Pop-up', 'Workshop',
  'Speaking gig', 'Styled shoot', 'Vendor fair', 'Conference', 'Other'
]

const statusColors = {
  upcoming: { bg: '#f0f4ff', color: '#4466cc' },
  attending: { bg: '#FEF3C7', color: '#92400E' },
  completed: { bg: '#f0faf6', color: '#1D9E75' },
  cancelled: { bg: '#fff0f0', color: '#cc3333' },
}

export default function BusinessEvents() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [form, setForm] = useState({
    name: '', type: '', event_type: 'attending', date: '',
    location: '', cost: '', status: 'upcoming',
    goal_connections: '', goal_leads: '', goal_revenue: '', goal_notes: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { fetchEvents() }, [])

  async function fetchEvents() {
    setLoading(true)
    const { data } = await supabase
      .from('business_events')
      .select('*')
      .order('date', { ascending: false })
    if (data) setEvents(data)
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('business_events').insert({
      name: form.name,
      type: form.type || 'Other',
      event_type: form.event_type,
      date: form.date || null,
      location: form.location || null,
      cost: form.cost ? parseFloat(form.cost) : null,
      status: form.status,
      goal_connections: form.goal_connections ? parseInt(form.goal_connections) : null,
      goal_leads: form.goal_leads ? parseInt(form.goal_leads) : null,
      goal_revenue: form.goal_revenue ? parseFloat(form.goal_revenue) : null,
      goal_notes: form.goal_notes || null,
      notes: form.notes || null,
      prep_checklist: [],
      user_id: user.id,
    })
    if (error) setError(error.message)
    else {
      setShowForm(false)
      setForm({
        name: '', type: '', event_type: 'attending', date: '',
        location: '', cost: '', status: 'upcoming',
        goal_connections: '', goal_leads: '', goal_revenue: '', goal_notes: '',
        notes: '',
      })
      fetchEvents()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this event?')) return
    await supabase.from('business_events').delete().eq('id', id)
    fetchEvents()
    setSelectedEvent(null)
  }

  const filteredEvents = events
    .filter(e => filterStatus === 'all' || e.status === filterStatus)
    .filter(e => filterType === 'all' || e.event_type === filterType)

  const totalCost = events.reduce((sum, e) => sum + (parseFloat(e.cost) || 0), 0)
  const totalLeads = events.reduce((sum, e) => sum + (parseInt(e.actual_leads) || 0), 0)
  const totalRevenue = events.reduce((sum, e) => sum + (parseFloat(e.actual_revenue) || 0), 0)
  const completedEvents = events.filter(e => e.status === 'completed').length

  if (selectedEvent) {
    return (
      <EventDetail
        event={selectedEvent}
        onBack={() => { setSelectedEvent(null); fetchEvents() }}
        onDelete={handleDelete}
        onUpdate={fetchEvents}
      />
    )
  }

  return (
    <div style={{ padding: '32px', fontFamily: t.fonts.sans }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: 0 }}>
            Business Events
          </h2>
          <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '4px 0 0' }}>
            Track events you attend and host to grow your business
          </p>
        </div>
        <button onClick={() => setShowForm(true)} style={styles.addBtn}>
          + Add Event
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Events attended', value: completedEvents, icon: '🎯', color: t.colors.primary },
          { label: 'Total cost', value: `$${totalCost.toLocaleString()}`, icon: '💸', color: '#cc3333' },
          { label: 'Leads generated', value: totalLeads, icon: '🤝', color: '#4466cc' },
          { label: 'Revenue attributed', value: `$${totalRevenue.toLocaleString()}`, icon: '💵', color: '#10B981' },
        ].map(card => (
          <div key={card.label} style={{
            backgroundColor: t.colors.bgCard,
            borderRadius: t.radius.lg,
            padding: '20px',
            border: `1px solid ${t.colors.borderLight}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>{card.label}</span>
              <span style={{ fontSize: '18px' }}>{card.icon}</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: card.color, letterSpacing: '-0.5px' }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {['all', 'upcoming', 'attending', 'completed', 'cancelled'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              style={{
                padding: '6px 14px',
                borderRadius: t.radius.full,
                border: `1px solid ${filterStatus === status ? t.colors.primary : t.colors.borderLight}`,
                backgroundColor: filterStatus === status ? t.colors.primaryLight : '#fff',
                color: filterStatus === status ? t.colors.primary : t.colors.textSecondary,
                fontSize: t.fontSizes.sm,
                fontWeight: filterStatus === status ? '600' : '400',
                cursor: 'pointer',
                fontFamily: t.fonts.sans,
              }}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '6px', marginLeft: '8px' }}>
          {['all', 'attending', 'hosting'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              style={{
                padding: '6px 14px',
                borderRadius: t.radius.full,
                border: `1px solid ${filterType === type ? '#8B5CF6' : t.colors.borderLight}`,
                backgroundColor: filterType === type ? '#F5F3FF' : '#fff',
                color: filterType === type ? '#8B5CF6' : t.colors.textSecondary,
                fontSize: t.fontSizes.sm,
                fontWeight: filterType === type ? '600' : '400',
                cursor: 'pointer',
                fontFamily: t.fonts.sans,
              }}
            >
              {type === 'all' ? 'All types' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>New Business Event</h3>
          {error && <div style={styles.error}>{error}</div>}

          <div style={{ ...styles.formGrid, marginBottom: '16px' }}>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Event name *</label>
              <input style={styles.input} placeholder="e.g. Atlanta Wedding Summit 2026" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Event type</label>
              <select style={styles.input} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="">Select type</option>
                {eventTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>I am</label>
              <select style={styles.input} value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })}>
                <option value="attending">Attending</option>
                <option value="hosting">Hosting</option>
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Date</label>
              <input style={styles.input} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Location</label>
              <input style={styles.input} placeholder="City or venue" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Cost ($)</label>
              <input style={styles.input} type="number" placeholder="0.00" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Status</label>
              <select style={styles.input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="upcoming">Upcoming</option>
                <option value="attending">Attending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${t.colors.borderLight}`, paddingTop: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textSecondary, marginBottom: '12px' }}>
              🎯 Goals going in
            </div>
            <div style={styles.formGrid}>
              <div style={styles.field}>
                <label style={styles.label}>Target connections</label>
                <input style={styles.input} type="number" placeholder="e.g. 10" value={form.goal_connections} onChange={e => setForm({ ...form, goal_connections: e.target.value })} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Target leads</label>
                <input style={styles.input} type="number" placeholder="e.g. 3" value={form.goal_leads} onChange={e => setForm({ ...form, goal_leads: e.target.value })} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Revenue goal ($)</label>
                <input style={styles.input} type="number" placeholder="0.00" value={form.goal_revenue} onChange={e => setForm({ ...form, goal_revenue: e.target.value })} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Goal notes</label>
                <input style={styles.input} placeholder="What do you want to accomplish?" value={form.goal_notes} onChange={e => setForm({ ...form, goal_notes: e.target.value })} />
              </div>
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${t.colors.borderLight}`, paddingTop: '16px', marginBottom: '20px' }}>
            <div style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textSecondary, marginBottom: '12px' }}>
              📝 Notes & prep
            </div>
            <textarea
              style={{ ...styles.input, width: '100%', resize: 'vertical', fontFamily: t.fonts.sans, boxSizing: 'border-box' }}
              rows={3}
              placeholder="What to bring, dress code, people to look for..."
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div style={styles.formActions}>
            <button onClick={() => { setShowForm(false); setError(null) }} style={styles.cancelBtn}>Cancel</button>
            <button onClick={handleSave} style={styles.saveBtn} disabled={saving || !form.name}>
              {saving ? 'Saving...' : 'Save Event'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.empty}>Loading events...</div>
      ) : filteredEvents.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🎯</div>
          <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px' }}>
            No events yet
          </h3>
          <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '0 0 24px' }}>
            Start tracking the events you attend and host to grow your business
          </p>
          <button onClick={() => setShowForm(true)} style={styles.addBtn}>+ Add Event</button>
        </div>
      ) : (
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span>Event</span>
            <span>Type</span>
            <span>Date</span>
            <span>Location</span>
            <span>Cost</span>
            <span>Goals</span>
            <span>Status</span>
            <span></span>
          </div>
          {filteredEvents.map(event => {
            const sc = statusColors[event.status] || statusColors.upcoming
            return (
              <div key={event.id} style={styles.tableRow} onClick={() => setSelectedEvent(event)}>
                <span style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>
                  <div>{event.name}</div>
                  <div style={{ fontSize: t.fontSizes.xs, color: '#8B5CF6', fontWeight: '500', marginTop: '2px' }}>
                    {event.event_type === 'hosting' ? '🎤 Hosting' : '🎟 Attending'}
                  </div>
                </span>
                <span style={styles.tableCell}>{event.type || '—'}</span>
                <span style={styles.tableCell}>
                  {event.date ? new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </span>
                <span style={styles.tableCell}>{event.location || '—'}</span>
                <span style={styles.tableCell}>
                  {event.cost ? `$${parseFloat(event.cost).toLocaleString()}` : '—'}
                </span>
                <span style={styles.tableCell}>
                  {event.goal_leads ? `${event.goal_leads} leads` : event.goal_connections ? `${event.goal_connections} connections` : '—'}
                </span>
                <span>
                  <div style={{ display: 'inline-block', padding: '3px 10px', borderRadius: t.radius.full, fontSize: t.fontSizes.xs, fontWeight: '500', backgroundColor: sc.bg, color: sc.color }}>
                    {event.status}
                  </div>
                </span>
                <span style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary }}>→</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EventDetail({ event, onBack, onDelete, onUpdate }) {
  const [data, setData] = useState(event)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ ...event })
  const [notes, setNotes] = useState(event.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [prepItems, setPrepItems] = useState(event.prep_checklist || [])
  const [newPrepItem, setNewPrepItem] = useState('')
  const [outcomes, setOutcomes] = useState({
    actual_connections: event.actual_connections || '',
    actual_leads: event.actual_leads || '',
    actual_revenue: event.actual_revenue || '',
    outcome_notes: event.outcome_notes || '',
  })
  const [savingOutcomes, setSavingOutcomes] = useState(false)
  const [outcomesSaved, setOutcomesSaved] = useState(false)

  const sc = statusColors[data.status] || statusColors.upcoming

  async function handleEditSave() {
    const { error } = await supabase.from('business_events').update({
      name: editForm.name,
      type: editForm.type || null,
      event_type: editForm.event_type,
      date: editForm.date || null,
      location: editForm.location || null,
      cost: editForm.cost ? parseFloat(editForm.cost) : null,
      status: editForm.status,
      goal_connections: editForm.goal_connections ? parseInt(editForm.goal_connections) : null,
      goal_leads: editForm.goal_leads ? parseInt(editForm.goal_leads) : null,
      goal_revenue: editForm.goal_revenue ? parseFloat(editForm.goal_revenue) : null,
      goal_notes: editForm.goal_notes || null,
    }).eq('id', event.id)
    if (!error) {
      setData(prev => ({ ...prev, ...editForm }))
      setEditMode(false)
      onUpdate()
    }
  }

  async function saveNotes() {
    setSavingNotes(true)
    await supabase.from('business_events').update({ notes, prep_checklist: prepItems }).eq('id', event.id)
    setSavingNotes(false)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  async function saveOutcomes() {
    setSavingOutcomes(true)
    await supabase.from('business_events').update({
      actual_connections: outcomes.actual_connections ? parseInt(outcomes.actual_connections) : null,
      actual_leads: outcomes.actual_leads ? parseInt(outcomes.actual_leads) : null,
      actual_revenue: outcomes.actual_revenue ? parseFloat(outcomes.actual_revenue) : null,
      outcome_notes: outcomes.outcome_notes || null,
    }).eq('id', event.id)
    setData(prev => ({ ...prev, ...outcomes }))
    setSavingOutcomes(false)
    setOutcomesSaved(true)
    setTimeout(() => setOutcomesSaved(false), 2000)
    onUpdate()
  }

  async function togglePrepItem(index) {
    const updated = prepItems.map((item, i) =>
      i === index ? { ...item, done: !item.done } : item
    )
    setPrepItems(updated)
    await supabase.from('business_events').update({ prep_checklist: updated }).eq('id', event.id)
  }

  async function addPrepItem() {
    if (!newPrepItem.trim()) return
    const updated = [...prepItems, { text: newPrepItem, done: false }]
    setPrepItems(updated)
    setNewPrepItem('')
    await supabase.from('business_events').update({ prep_checklist: updated }).eq('id', event.id)
  }

  async function deletePrepItem(index) {
    const updated = prepItems.filter((_, i) => i !== index)
    setPrepItems(updated)
    await supabase.from('business_events').update({ prep_checklist: updated }).eq('id', event.id)
  }

  async function updateStatus(status) {
    await supabase.from('business_events').update({ status }).eq('id', event.id)
    setData(prev => ({ ...prev, status }))
    onUpdate()
  }

  const goalConnections = parseInt(data.goal_connections) || 0
  const goalLeads = parseInt(data.goal_leads) || 0
  const goalRevenue = parseFloat(data.goal_revenue) || 0
  const actualConnections = parseInt(outcomes.actual_connections) || 0
  const actualLeads = parseInt(outcomes.actual_leads) || 0
  const actualRevenue = parseFloat(outcomes.actual_revenue) || 0
  const donePrepItems = prepItems.filter(i => i.done).length

  return (
    <div style={{ padding: '32px', fontFamily: t.fonts.sans }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={onBack} style={styles.backBtn}>← Back to events</button>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!editMode && <button onClick={() => setEditMode(true)} style={styles.editBtn}>Edit</button>}
          <button onClick={() => onDelete(event.id)} style={styles.deleteBtn}>Delete</button>
        </div>
      </div>

      {editMode ? (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>Edit Event</h3>
          <div style={styles.formGrid}>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Event name *</label>
              <input style={styles.input} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Type</label>
              <select style={styles.input} value={editForm.type || ''} onChange={e => setEditForm({ ...editForm, type: e.target.value })}>
                <option value="">Select type</option>
                {eventTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>I am</label>
              <select style={styles.input} value={editForm.event_type} onChange={e => setEditForm({ ...editForm, event_type: e.target.value })}>
                <option value="attending">Attending</option>
                <option value="hosting">Hosting</option>
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Date</label>
              <input style={styles.input} type="date" value={editForm.date || ''} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Location</label>
              <input style={styles.input} value={editForm.location || ''} onChange={e => setEditForm({ ...editForm, location: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Cost ($)</label>
              <input style={styles.input} type="number" value={editForm.cost || ''} onChange={e => setEditForm({ ...editForm, cost: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Status</label>
              <select style={styles.input} value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                <option value="upcoming">Upcoming</option>
                <option value="attending">Attending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Target connections</label>
              <input style={styles.input} type="number" value={editForm.goal_connections || ''} onChange={e => setEditForm({ ...editForm, goal_connections: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Target leads</label>
              <input style={styles.input} type="number" value={editForm.goal_leads || ''} onChange={e => setEditForm({ ...editForm, goal_leads: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Revenue goal ($)</label>
              <input style={styles.input} type="number" value={editForm.goal_revenue || ''} onChange={e => setEditForm({ ...editForm, goal_revenue: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Goal notes</label>
              <input style={styles.input} value={editForm.goal_notes || ''} onChange={e => setEditForm({ ...editForm, goal_notes: e.target.value })} />
            </div>
          </div>
          <div style={styles.formActions}>
            <button onClick={() => setEditMode(false)} style={styles.cancelBtn}>Cancel</button>
            <button onClick={handleEditSave} style={styles.saveBtn}>Save changes</button>
          </div>
        </div>
      ) : (
        <>
          {/* Header card */}
          <div style={{ backgroundColor: '#fff', borderRadius: t.radius.lg, padding: '28px', border: `1px solid ${t.colors.borderLight}`, marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 4px', letterSpacing: '-0.3px' }}>
                  {data.name}
                </h1>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {data.type && <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>{data.type}</span>}
                  <span style={{ fontSize: t.fontSizes.sm, color: '#8B5CF6', fontWeight: '500' }}>
                    {data.event_type === 'hosting' ? '🎤 Hosting' : '🎟 Attending'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: t.radius.full, fontSize: t.fontSizes.sm, fontWeight: '600', backgroundColor: sc.bg, color: sc.color }}>
                {data.status}
              </div>
            </div>

            {/* Status buttons */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Update status
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['upcoming', 'attending', 'completed', 'cancelled'].map(status => {
                  const ssc = statusColors[status]
                  const isActive = data.status === status
                  return (
                    <button
                      key={status}
                      onClick={() => updateStatus(status)}
                      style={{
                        flex: 1, padding: '7px 4px', borderRadius: t.radius.md,
                        border: `1px solid ${isActive ? ssc.color : t.colors.borderLight}`,
                        backgroundColor: isActive ? ssc.bg : '#fff',
                        color: isActive ? ssc.color : t.colors.textTertiary,
                        fontSize: t.fontSizes.xs, fontWeight: isActive ? '700' : '400',
                        cursor: 'pointer', fontFamily: t.fonts.sans,
                      }}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Date, location, cost */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {data.date && (
                <div style={{ backgroundColor: t.colors.bg, borderRadius: t.radius.md, padding: '10px 14px' }}>
                  <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', marginBottom: '2px' }}>Date</div>
                  <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>
                    {new Date(data.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              )}
              {data.location && (
                <div style={{ backgroundColor: t.colors.bg, borderRadius: t.radius.md, padding: '10px 14px' }}>
                  <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', marginBottom: '2px' }}>Location</div>
                  <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>📍 {data.location}</div>
                </div>
              )}
              {data.cost && (
                <div style={{ backgroundColor: t.colors.bg, borderRadius: t.radius.md, padding: '10px 14px' }}>
                  <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', marginBottom: '2px' }}>Cost</div>
                  <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: '#cc3333' }}>${parseFloat(data.cost).toLocaleString()}</div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

            {/* Goals vs Outcomes */}
            <div style={{ backgroundColor: '#fff', borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.borderLight}` }}>
              <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 16px' }}>
                Goals vs Outcomes
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                {[
                  { label: 'Connections', goal: goalConnections, field: 'actual_connections', unit: '' },
                  { label: 'Leads', goal: goalLeads, field: 'actual_leads', unit: '' },
                  { label: 'Revenue', goal: goalRevenue, field: 'actual_revenue', unit: '$' },
                ].map(row => (
                  <div key={row.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary, fontWeight: '500' }}>{row.label}</span>
                      <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
                        Goal: {row.unit}{row.goal || '—'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        style={{ ...styles.input, flex: 1, padding: '6px 10px' }}
                        type="number"
                        placeholder="Actual"
                        value={outcomes[row.field]}
                        onChange={e => setOutcomes({ ...outcomes, [row.field]: e.target.value })}
                      />
                      {row.goal > 0 && outcomes[row.field] && (
                        <span style={{
                          fontSize: t.fontSizes.xs,
                          fontWeight: '700',
                          color: parseFloat(outcomes[row.field]) >= row.goal ? '#10B981' : '#cc3333',
                        }}>
                          {parseFloat(outcomes[row.field]) >= row.goal ? '✓' : `${Math.round((parseFloat(outcomes[row.field]) / row.goal) * 100)}%`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div style={styles.field}>
                  <label style={styles.label}>Outcome notes</label>
                  <textarea
                    style={{ ...styles.input, resize: 'vertical', fontFamily: t.fonts.sans }}
                    rows={2}
                    placeholder="How did it go?"
                    value={outcomes.outcome_notes}
                    onChange={e => setOutcomes({ ...outcomes, outcome_notes: e.target.value })}
                  />
                </div>
              </div>
              {data.goal_notes && (
                <div style={{ padding: '10px 12px', backgroundColor: '#f0f4ff', borderRadius: t.radius.md, marginBottom: '12px' }}>
                  <div style={{ fontSize: t.fontSizes.xs, color: '#4466cc', fontWeight: '600', marginBottom: '2px' }}>Original goal</div>
                  <div style={{ fontSize: t.fontSizes.sm, color: '#4466cc' }}>{data.goal_notes}</div>
                </div>
              )}
              <button
                onClick={saveOutcomes}
                style={{
                  width: '100%', padding: '9px', borderRadius: t.radius.md, border: 'none',
                  backgroundColor: outcomesSaved ? '#10B981' : t.colors.primary,
                  color: '#fff', fontSize: t.fontSizes.sm, fontWeight: '600',
                  cursor: 'pointer', fontFamily: t.fonts.sans, transition: 'background 0.2s',
                }}
              >
                {outcomesSaved ? '✓ Saved!' : savingOutcomes ? 'Saving...' : 'Save outcomes'}
              </button>
            </div>

            {/* Prep checklist */}
            <div style={{ backgroundColor: '#fff', borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.borderLight}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: 0 }}>
                  Prep Checklist
                </h3>
                <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>
                  {donePrepItems}/{prepItems.length} done
                </span>
              </div>

              {prepItems.length > 0 && (
                <div style={{ height: '4px', backgroundColor: t.colors.borderLight, borderRadius: '2px', overflow: 'hidden', marginBottom: '12px' }}>
                  <div style={{ height: '100%', width: `${prepItems.length > 0 ? (donePrepItems / prepItems.length) * 100 : 0}%`, backgroundColor: t.colors.primary, borderRadius: '2px', transition: 'width 0.3s' }} />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                {prepItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', backgroundColor: t.colors.bg, borderRadius: t.radius.md }}>
                    <button
                      onClick={() => togglePrepItem(i)}
                      style={{
                        width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                        border: `2px solid ${item.done ? t.colors.primary : t.colors.border}`,
                        backgroundColor: item.done ? t.colors.primary : '#fff',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {item.done && <span style={{ color: '#fff', fontSize: '9px', fontWeight: '700' }}>✓</span>}
                    </button>
                    <span style={{
                      flex: 1, fontSize: t.fontSizes.sm,
                      color: item.done ? t.colors.textTertiary : t.colors.textPrimary,
                      textDecoration: item.done ? 'line-through' : 'none',
                    }}>
                      {item.text}
                    </span>
                    <button onClick={() => deletePrepItem(i)} style={{ background: 'none', border: 'none', color: t.colors.textTertiary, cursor: 'pointer', fontSize: '11px' }}>✕</button>
                  </div>
                ))}
                {prepItems.length === 0 && (
                  <p style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, textAlign: 'center', padding: '12px 0' }}>
                    No prep items yet
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  style={{ ...styles.input, flex: 1 }}
                  placeholder="Add prep item..."
                  value={newPrepItem}
                  onChange={e => setNewPrepItem(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addPrepItem()}
                />
                <button onClick={addPrepItem} disabled={!newPrepItem.trim()} style={styles.saveBtn}>
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div style={{ backgroundColor: '#fff', borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.borderLight}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: 0 }}>Notes</h3>
              <button
                onClick={saveNotes}
                style={{
                  padding: '6px 14px', borderRadius: t.radius.md, border: 'none',
                  backgroundColor: notesSaved ? '#10B981' : t.colors.primary,
                  color: '#fff', fontSize: t.fontSizes.sm, fontWeight: '600',
                  cursor: 'pointer', fontFamily: t.fonts.sans, transition: 'background 0.2s',
                }}
              >
                {notesSaved ? '✓ Saved' : savingNotes ? 'Saving...' : 'Save notes'}
              </button>
            </div>
            <textarea
              style={{
                width: '100%', padding: '12px', borderRadius: t.radius.md,
                border: `1px solid ${t.colors.borderLight}`, fontSize: t.fontSizes.base,
                color: t.colors.textPrimary, outline: 'none', resize: 'vertical',
                fontFamily: t.fonts.sans, lineHeight: '1.6', boxSizing: 'border-box',
                backgroundColor: t.colors.bg,
              }}
              rows={5}
              placeholder="Prep notes, what to bring, people to meet, follow-up reminders..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </>
      )}
    </div>
  )
}

const styles = {
  addBtn: { padding: '10px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#1D9E75', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  formCard: { backgroundColor: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #f0f0eb', marginBottom: '24px' },
  formTitle: { fontSize: '16px', fontWeight: '600', color: '#1a1a1a', margin: '0 0 20px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '500', color: '#666' },
  input: { padding: '9px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '13px', color: '#1a1a1a', outline: 'none', backgroundColor: '#fff' },
  formActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  cancelBtn: { padding: '9px 16px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff', color: '#666', fontSize: '13px', cursor: 'pointer' },
  saveBtn: { padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#1D9E75', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  error: { padding: '10px 14px', borderRadius: '8px', backgroundColor: '#fff0f0', color: '#cc3333', fontSize: '13px', marginBottom: '16px' },
  table: { backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #f0f0eb', overflow: 'hidden' },
  tableHeader: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.8fr 1fr 1fr 0.3fr', padding: '12px 20px', backgroundColor: '#fafaf8', borderBottom: '1px solid #f0f0eb', fontSize: '12px', fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' },
  tableRow: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.8fr 1fr 1fr 0.3fr', padding: '14px 20px', borderBottom: '1px solid #f9f9f7', alignItems: 'center', cursor: 'pointer' },
  tableCell: { fontSize: '13px', color: '#666' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #f0f0eb' },
  empty: { fontSize: '13px', color: '#999', padding: '40px', textAlign: 'center' },
  backBtn: { padding: '8px 14px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff', color: '#555', fontSize: '13px', cursor: 'pointer' },
  editBtn: { padding: '8px 14px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff', color: '#555', fontSize: '13px', cursor: 'pointer' },
  deleteBtn: { padding: '8px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#fff0f0', color: '#cc3333', fontSize: '13px', cursor: 'pointer' },
}