import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

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
    planning: { bg: '#FBF0E6', color: '#D4874E' },
    confirmed: { bg: '#EAF2EA', color: '#6B8F71' },
    completed: { bg: '#F0EBF9', color: '#7C5CBF' },
    cancelled: { bg: '#FAF0F2', color: '#C06B7A' },
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
  page: { padding: '32px', fontFamily: t.fonts.sans },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  title: { fontSize: '22px', fontWeight: '800', color: t.colors.textPrimary, margin: 0, fontFamily: t.fonts.heading, letterSpacing: '-0.02em' },
  subtitle: { fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '4px 0 0' },
  addBtn: { padding: '10px 18px', borderRadius: t.radius.md, border: 'none', backgroundColor: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans },
  formCard: { backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.border}`, marginBottom: '24px' },
  formTitle: { fontSize: t.fontSizes.lg, fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 20px', fontFamily: t.fonts.heading, letterSpacing: '-0.01em' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary },
  input: { padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, color: t.colors.textPrimary, outline: 'none', backgroundColor: t.colors.bgCard, fontFamily: t.fonts.sans },
  formActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  cancelBtn: { padding: '9px 16px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: t.fontSizes.base, cursor: 'pointer', fontFamily: t.fonts.sans },
  saveBtn: { padding: '9px 16px', borderRadius: t.radius.md, border: 'none', backgroundColor: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans },
  error: { padding: '10px 14px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.base, marginBottom: '16px' },
  table: { backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}`, overflow: 'hidden' },
  tableHeader: { display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1.5fr 0.5fr 1fr 0.3fr', padding: '12px 20px', backgroundColor: t.colors.bg, borderBottom: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.xs, fontWeight: '600', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em' },
  tableRow: { display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1.5fr 0.5fr 1fr 0.3fr', padding: '14px 20px', borderBottom: `1px solid ${t.colors.borderLight}`, alignItems: 'center', cursor: 'pointer' },
  eventName: { fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary },
  tableCell: { fontSize: t.fontSizes.base, color: t.colors.textSecondary },
  statusBadge: { display: 'inline-block', padding: '3px 10px', borderRadius: t.radius.full, fontSize: t.fontSizes.sm, fontWeight: '500' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}` },
  emptyIcon: { fontSize: '40px', marginBottom: '16px' },
  emptyTitle: { fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px', fontFamily: t.fonts.heading },
  emptyText: { fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '0 0 24px' },
  empty: { fontSize: t.fontSizes.base, color: t.colors.textTertiary, padding: '40px', textAlign: 'center' },
  detailHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '24px' },
  backBtn: { padding: '8px 14px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: t.fontSizes.base, cursor: 'pointer', fontFamily: t.fonts.sans },
  deleteBtn: { padding: '8px 14px', borderRadius: t.radius.md, border: 'none', backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.base, cursor: 'pointer', fontFamily: t.fonts.sans, fontWeight: '500' },
  detailCard: { backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '32px', border: `1px solid ${t.colors.border}` },
  detailTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' },
  detailName: { fontSize: '24px', fontWeight: '800', color: t.colors.textPrimary, margin: '0 0 4px', fontFamily: t.fonts.heading, letterSpacing: '-0.02em' },
  detailSub: { fontSize: t.fontSizes.md, color: t.colors.textSecondary, margin: 0 },
  detailGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  detailField: { backgroundColor: t.colors.bg, borderRadius: t.radius.md, padding: '14px 16px' },
  detailFieldLabel: { fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.06em' },
  detailFieldValue: { fontSize: t.fontSizes.md, color: t.colors.textPrimary },
}