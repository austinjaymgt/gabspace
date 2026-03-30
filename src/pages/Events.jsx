import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Events() {
  const [events, setEvents] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [form, setForm] = useState({
    name: '',
    project_id: '',
    event_date: '',
    venue: '',
    guest_count: '',
    status: 'planning',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchEvents()
    fetchProjects()
  }, [])

  async function fetchEvents() {
    setLoading(true)
    const { data, error } = await supabase
      .from('events')
      .select('*, projects(title, client_id, clients(name))')
      .order('event_date', { ascending: true })
    if (!error) setEvents(data)
    setLoading(false)
  }

  async function fetchProjects() {
    const { data } = await supabase
      .from('projects')
      .select('id, title, clients(name)')
    if (data) setProjects(data)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('events').insert({
      name: form.name,
      project_id: form.project_id || null,
      event_date: form.event_date || null,
      venue: form.venue || null,
      guest_count: form.guest_count ? parseInt(form.guest_count) : null,
      status: form.status,
    })
    if (error) setError(error.message)
    else {
      setShowForm(false)
      setForm({ name: '', project_id: '', event_date: '', venue: '', guest_count: '', status: 'planning' })
      fetchEvents()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this event?')) return
    await supabase.from('events').delete().eq('id', id)
    fetchEvents()
    if (selectedEvent?.id === id) setSelectedEvent(null)
  }

  const statusColors = {
    planning: { bg: '#fff8f0', color: '#cc7700' },
    confirmed: { bg: '#f0faf6', color: '#1D9E75' },
    completed: { bg: '#f0f4ff', color: '#4466cc' },
    cancelled: { bg: '#fff0f0', color: '#cc3333' },
  }

  if (selectedEvent) {
    const sc = statusColors[selectedEvent.status] || statusColors.planning
    return (
      <div style={styles.page}>
        <div style={styles.detailHeader}>
          <button onClick={() => setSelectedEvent(null)} style={styles.backBtn}>
            ← Back to events
          </button>
          <button onClick={() => handleDelete(selectedEvent.id)} style={styles.deleteBtn}>
            Delete event
          </button>
        </div>
        <div style={styles.detailCard}>
          <div style={styles.detailTop}>
            <div>
              <h2 style={styles.detailName}>{selectedEvent.name}</h2>
              {selectedEvent.projects && (
                <p style={styles.detailSub}>
                  {selectedEvent.projects.title}
                  {selectedEvent.projects.clients?.name ? ` · ${selectedEvent.projects.clients.name}` : ''}
                </p>
              )}
            </div>
            <div style={{ ...styles.statusBadge, backgroundColor: sc.bg, color: sc.color }}>
              {selectedEvent.status}
            </div>
          </div>
          <div style={styles.detailGrid}>
            {selectedEvent.event_date && (
              <div style={styles.detailField}>
                <div style={styles.detailFieldLabel}>Event date</div>
                <div style={styles.detailFieldValue}>
                  {new Date(selectedEvent.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
            )}
            {selectedEvent.venue && (
              <div style={styles.detailField}>
                <div style={styles.detailFieldLabel}>Venue</div>
                <div style={styles.detailFieldValue}>{selectedEvent.venue}</div>
              </div>
            )}
            {selectedEvent.guest_count && (
              <div style={styles.detailField}>
                <div style={styles.detailFieldLabel}>Guest count</div>
                <div style={styles.detailFieldValue}>{selectedEvent.guest_count} guests</div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Events</h2>
          <p style={styles.subtitle}>{events.length} total events</p>
        </div>
        <button onClick={() => setShowForm(true)} style={styles.addBtn}>
          + Add Event
        </button>
      </div>

      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>New Event</h3>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.formGrid}>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Event name *</label>
              <input
                style={styles.input}
                placeholder="e.g. Brooklen & Jay Wedding"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Project</label>
              <select
                style={styles.input}
                value={form.project_id}
                onChange={e => setForm({ ...form, project_id: e.target.value })}
              >
                <option value="">No project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title}{p.clients?.name ? ` (${p.clients.name})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Status</label>
              <select
                style={styles.input}
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
              >
                <option value="planning">Planning</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Event date</label>
              <input
                style={styles.input}
                type="date"
                value={form.event_date}
                onChange={e => setForm({ ...form, event_date: e.target.value })}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Venue</label>
              <input
                style={styles.input}
                placeholder="Venue name or address"
                value={form.venue}
                onChange={e => setForm({ ...form, venue: e.target.value })}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Guest count</label>
              <input
                style={styles.input}
                type="number"
                placeholder="0"
                value={form.guest_count}
                onChange={e => setForm({ ...form, guest_count: e.target.value })}
              />
            </div>
          </div>
          <div style={styles.formActions}>
            <button
              onClick={() => { setShowForm(false); setError(null) }}
              style={styles.cancelBtn}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={styles.saveBtn}
              disabled={saving || !form.name}
            >
              {saving ? 'Saving...' : 'Save Event'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.empty}>Loading events...</div>
      ) : events.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📅</div>
          <h3 style={styles.emptyTitle}>No events yet</h3>
          <p style={styles.emptyText}>Add your first event to get started</p>
          <button onClick={() => setShowForm(true)} style={styles.addBtn}>
            + Add Event
          </button>
        </div>
      ) : (
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span>Event</span>
            <span>Project</span>
            <span>Date</span>
            <span>Venue</span>
            <span>Guests</span>
            <span>Status</span>
            <span></span>
          </div>
          {events.map(event => {
            const sc = statusColors[event.status] || statusColors.planning
            return (
              <div
                key={event.id}
                style={styles.tableRow}
                onClick={() => setSelectedEvent(event)}
              >
                <span style={styles.eventName}>{event.name}</span>
                <span style={styles.tableCell}>
                  {event.projects ? event.projects.title : '—'}
                </span>
                <span style={styles.tableCell}>
                  {event.event_date
                    ? new Date(event.event_date).toLocaleDateString()
                    : '—'}
                </span>
                <span style={styles.tableCell}>{event.venue || '—'}</span>
                <span style={styles.tableCell}>
                  {event.guest_count ? `${event.guest_count}` : '—'}
                </span>
                <span>
                  <div style={{ ...styles.statusBadge, backgroundColor: sc.bg, color: sc.color }}>
                    {event.status}
                  </div>
                </span>
                <span style={styles.tableCell}>→</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const styles = {
  page: { padding: '32px' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
  },
  title: { fontSize: '20px', fontWeight: '700', color: '#1a1a1a', margin: 0 },
  subtitle: { fontSize: '13px', color: '#999', margin: '4px 0 0' },
  addBtn: {
    padding: '10px 18px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#1D9E75',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #f0f0eb',
    marginBottom: '24px',
  },
  formTitle: { fontSize: '16px', fontWeight: '600', color: '#1a1a1a', margin: '0 0 20px' },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '20px',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '500', color: '#666' },
  input: {
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
    fontSize: '13px',
    color: '#1a1a1a',
    outline: 'none',
    backgroundColor: '#fff',
  },
  formActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  cancelBtn: {
    padding: '9px 16px',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
    backgroundColor: '#fff',
    color: '#666',
    fontSize: '13px',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '9px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#1D9E75',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  error: {
    padding: '10px 14px',
    borderRadius: '8px',
    backgroundColor: '#fff0f0',
    color: '#cc3333',
    fontSize: '13px',
    marginBottom: '16px',
  },
  table: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    border: '1px solid #f0f0eb',
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '2fr 1.5fr 1fr 1.5fr 0.5fr 1fr 0.3fr',
    padding: '12px 20px',
    backgroundColor: '#fafaf8',
    borderBottom: '1px solid #f0f0eb',
    fontSize: '12px',
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1.5fr 1fr 1.5fr 0.5fr 1fr 0.3fr',
    padding: '14px 20px',
    borderBottom: '1px solid #f9f9f7',
    alignItems: 'center',
    cursor: 'pointer',
  },
  eventName: { fontSize: '13px', fontWeight: '500', color: '#1a1a1a' },
  tableCell: { fontSize: '13px', color: '#666' },
  statusBadge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '500',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    border: '1px solid #f0f0eb',
  },
  emptyIcon: { fontSize: '40px', marginBottom: '16px' },
  emptyTitle: { fontSize: '16px', fontWeight: '600', color: '#1a1a1a', margin: '0 0 8px' },
  emptyText: { fontSize: '13px', color: '#999', margin: '0 0 24px' },
  empty: { fontSize: '13px', color: '#999', padding: '40px', textAlign: 'center' },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '24px',
  },
  backBtn: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
    backgroundColor: '#fff',
    color: '#555',
    fontSize: '13px',
    cursor: 'pointer',
  },
  deleteBtn: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#fff0f0',
    color: '#cc3333',
    fontSize: '13px',
    cursor: 'pointer',
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '32px',
    border: '1px solid #f0f0eb',
  },
  detailTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '28px',
  },
  detailName: { fontSize: '22px', fontWeight: '700', color: '#1a1a1a', margin: '0 0 4px' },
  detailSub: { fontSize: '14px', color: '#999', margin: 0 },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  detailField: {
    backgroundColor: '#fafaf8',
    borderRadius: '8px',
    padding: '14px 16px',
  },
  detailFieldLabel: {
    fontSize: '11px',
    color: '#aaa',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  detailFieldValue: { fontSize: '14px', color: '#1a1a1a' },
}