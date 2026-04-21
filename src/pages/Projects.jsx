import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  planning:  { bg: '#FBF0E6', color: '#D4874E', border: '#D4874E' },
  active:    { bg: '#EAF2EA', color: '#6B8F71', border: '#6B8F71' },
  'on-hold': { bg: '#FBF0E6', color: '#D4874E', border: '#D4874E' },
  completed: { bg: '#F0EBF9', color: '#7C5CBF', border: '#7C5CBF' },
  cancelled: { bg: '#FAF0F2', color: '#C06B7A', border: '#C06B7A' },
}

const PROJECT_STATUS_CARDS = [
  { key: 'planning',  label: 'Planning',  color: '#534AB7' },
{ key: 'active',    label: 'Active',    color: '#6B8F71' },
  { key: 'on-hold',   label: 'On hold',   color: '#BA7517' },
  { key: 'completed', label: 'Completed', color: '#378ADD' },
]

const EVENT_STATUS_COLORS = {
  inquiry:     { bg: '#F0EBF9', color: '#7C5CBF', border: '#7C5CBF' },
  concept:     { bg: '#F0EBF9', color: '#9B72D0', border: '#9B72D0' },
  planning:    { bg: '#FBF0E6', color: '#D4874E', border: '#D4874E' },
  confirmed:   { bg: '#EAF2EA', color: '#6B8F71', border: '#6B8F71' },
  in_progress: { bg: '#FBF0E6', color: '#D4874E', border: '#D4874E' },
  completed:   { bg: '#F0EBF9', color: '#7C5CBF', border: '#7C5CBF' },
  cancelled:   { bg: '#FAF0F2', color: '#C06B7A', border: '#C06B7A' },
}

const EVENT_STATUS_CARDS = [
  { key: 'inquiry',     label: 'Inquiry',      color: '#7C5CBF' },
{ key: 'confirmed',   label: 'Confirmed',    color: '#6B8F71' },
  { key: 'in_progress', label: 'In Progress',  color: '#BA7517' },
  { key: 'completed',   label: 'Completed',    color: '#378ADD' },
]

const STATUS_STEPS = ['planning', 'active', 'on-hold', 'completed']

// ── Shared helpers ─────────────────────────────────────────────────────────

function StatusBadge({ status, colorMap }) {
  const sc = colorMap[status] || colorMap.planning || {}
  return (
    <div style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: t.radius.full,
      fontSize: t.fontSizes.xs,
      fontWeight: '500',
      backgroundColor: sc.bg || '#f0f0f0',
      color: sc.color || '#666',
    }}>
      {status?.replace('_', ' ')}
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────

export default function Projects() {
  const [view, setView] = useState('projects') // 'projects' | 'events'
  const [records, setRecords] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [sortBy, setSortBy] = useState('created_at')
  const [filterStatus, setFilterStatus] = useState('all')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const isEvents = view === 'events'

  const [projectForm, setProjectForm] = useState({
    title: '', client_id: '', status: 'planning',
    project_type: '', start_date: '', end_date: '',
    budget: '', description: '',
  })

  const [eventForm, setEventForm] = useState({
    title: '', client_id: '', event_status: 'inquiry',
    event_date: '', venue: '', headcount: '',
    budget: '', source: '', description: '',
  })

  useEffect(() => {
    fetchRecords()
    fetchClients()
  }, [view])

  async function fetchRecords() {
    setLoading(true)
    setFilterStatus('all')
    const query = supabase
      .from('projects')
      .select('*, clients(name, company)')
      .eq('type', isEvents ? 'event' : 'project')
      .order('created_at', { ascending: false })
    const { data } = await query
    if (data) setRecords(data)
    setLoading(false)
  }

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('id, name, company')
    if (data) setClients(data)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()

    const payload = isEvents
      ? {
          type: 'event',
          title: eventForm.title,
          client_id: eventForm.client_id || null,
          event_status: eventForm.event_status || 'inquiry',
          event_date: eventForm.event_date || null,
          venue: eventForm.venue || null,
          headcount: eventForm.headcount ? parseInt(eventForm.headcount) : null,
          budget: eventForm.budget ? parseFloat(eventForm.budget) : null,
          source: eventForm.source || null,
          description: eventForm.description || null,
          status: 'planning', // required field default for events
          user_id: user.id,
        }
      : {
          type: 'project',
          title: projectForm.title,
          client_id: projectForm.client_id || null,
          status: projectForm.status,
          project_type: projectForm.project_type || null,
          start_date: projectForm.start_date || null,
          end_date: projectForm.end_date || null,
          budget: projectForm.budget ? parseFloat(projectForm.budget) : null,
          description: projectForm.description || null,
          user_id: user.id,
        }

    const { error: saveError } = await supabase.from('projects').insert(payload)
    if (saveError) {
      setError(saveError.message)
    } else {
      setShowForm(false)
      resetForms()
      fetchRecords()
    }
    setSaving(false)
  }

  function resetForms() {
    setProjectForm({ title: '', client_id: '', status: 'planning', project_type: '', start_date: '', end_date: '', budget: '', description: '' })
    setEventForm({ title: '', client_id: '', event_status: 'inquiry', event_date: '', venue: '', headcount: '', budget: '', source: '', description: '' })
  }

  async function handleDelete(id) {
    if (!confirm(`Delete this ${isEvents ? 'event' : 'project'}?`)) return
    await supabase.from('projects').delete().eq('id', id)
    fetchRecords()
    setSelectedRecord(null)
  }

  const statusCards = isEvents ? EVENT_STATUS_CARDS : PROJECT_STATUS_CARDS
  const statusColorMap = isEvents ? EVENT_STATUS_COLORS : STATUS_COLORS
  const statusField = isEvents ? 'event_status' : 'status'

  const filteredRecords = records
    .filter(r => filterStatus === 'all' || r[statusField] === filterStatus)
    .sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title)
      if (sortBy === 'budget') return (parseFloat(b.budget) || 0) - (parseFloat(a.budget) || 0)
      if (sortBy === 'status') return (a[statusField] || '').localeCompare(b[statusField] || '')
      if (sortBy === 'timeline') {
        const dateA = isEvents ? a.event_date : a.start_date
        const dateB = isEvents ? b.event_date : b.start_date
        return new Date(dateA || '9999') - new Date(dateB || '9999')
      }
      return new Date(b.created_at) - new Date(a.created_at)
    })

  if (selectedRecord) {
    return (
      <ProjectDetail
        record={selectedRecord}
        isEvent={isEvents}
        onBack={() => { setSelectedRecord(null); fetchRecords() }}
        onDelete={handleDelete}
        clients={clients}
      />
    )
  }

  return (
    <div style={{ padding: '32px', fontFamily: t.fonts.sans }}>

      {/* Header + Tab toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '4px' }}>
            <h2 style={{ fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: 0 }}>
              {isEvents ? 'Events' : 'Projects'}
            </h2>
            {/* Tab switcher */}
            <div style={{ display: 'flex', backgroundColor: '#f0f0eb', borderRadius: '8px', padding: '3px', gap: '2px' }}>
              {['projects', 'events'].map(v => (
                <button
                  key={v}
                  onClick={() => { setView(v); setShowForm(false); setError(null) }}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: t.fonts.sans,
                    backgroundColor: view === v ? '#fff' : 'transparent',
                    color: view === v ? t.colors.textPrimary : t.colors.textTertiary,
                    boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: 0 }}>
            {filteredRecords.length} of {records.length} {isEvents ? 'events' : 'projects'}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} style={styles.addBtn}>
          + {isEvents ? 'Add Event' : 'Add Project'}
        </button>
      </div>

      {/* Status stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${statusCards.length}, 1fr)`, gap: '14px', marginBottom: '20px' }}>
        {statusCards.map(({ key, label, color }) => {
          const count = records.filter(r => r[statusField] === key).length
          const isSelected = filterStatus === key
          return (
            <div
              key={key}
              onClick={() => setFilterStatus(isSelected ? 'all' : key)}
              style={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                padding: '20px 22px',
                border: isSelected ? `1.5px solid ${color}` : '1px solid #f0f0eb',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
            >
              <p style={{ fontSize: '13px', color: '#999', margin: '0 0 8px' }}>{label}</p>
              <p style={{ fontSize: '28px', fontWeight: '600', color, margin: 0, lineHeight: 1 }}>{count}</p>
            </div>
          )
        })}
      </div>

      {/* Sort row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>Sort by</span>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: t.radius.md, border: `1px solid ${t.colors.borderLight}`, fontSize: t.fontSizes.sm, color: t.colors.textSecondary, outline: 'none', backgroundColor: '#fff', fontFamily: t.fonts.sans }}
        >
          <option value="created_at">Date added</option>
          <option value="title">Name</option>
          <option value="budget">Budget</option>
          <option value="status">Status</option>
          <option value="timeline">{isEvents ? 'Event date' : 'Timeline'}</option>
        </select>
      </div>

      {/* New project form */}
      {showForm && !isEvents && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>New Project</h3>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.formGrid}>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Project title *</label>
              <input style={styles.input} placeholder="e.g. Brooklen Wedding 2026" value={projectForm.title} onChange={e => setProjectForm({ ...projectForm, title: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Client</label>
              <select style={styles.input} value={projectForm.client_id} onChange={e => setProjectForm({ ...projectForm, client_id: e.target.value })}>
                <option value="">No client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Status</label>
              <select style={styles.input} value={projectForm.status} onChange={e => setProjectForm({ ...projectForm, status: e.target.value })}>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on-hold">On hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Project type</label>
              <input style={styles.input} placeholder="e.g. Wedding, Portrait, Brand" value={projectForm.project_type} onChange={e => setProjectForm({ ...projectForm, project_type: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Budget ($)</label>
              <input style={styles.input} type="number" placeholder="0.00" value={projectForm.budget} onChange={e => setProjectForm({ ...projectForm, budget: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Start date</label>
              <input style={styles.input} type="date" value={projectForm.start_date} onChange={e => setProjectForm({ ...projectForm, start_date: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>End date</label>
              <input style={styles.input} type="date" value={projectForm.end_date} onChange={e => setProjectForm({ ...projectForm, end_date: e.target.value })} />
            </div>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Description</label>
              <textarea style={{ ...styles.input, resize: 'vertical', fontFamily: t.fonts.sans }} rows={2} placeholder="Brief project description..." value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} />
            </div>
          </div>
          <div style={styles.formActions}>
            <button onClick={() => { setShowForm(false); setError(null); resetForms() }} style={styles.cancelBtn}>Cancel</button>
            <button onClick={handleSave} style={styles.saveBtn} disabled={saving || !projectForm.title}>
              {saving ? 'Saving...' : 'Save Project'}
            </button>
          </div>
        </div>
      )}

      {/* New event form */}
      {showForm && isEvents && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>New Event</h3>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.formGrid}>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Event title *</label>
              <input style={styles.input} placeholder="e.g. Johnson Corporate Gala" value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Client</label>
              <select style={styles.input} value={eventForm.client_id} onChange={e => setEventForm({ ...eventForm, client_id: e.target.value })}>
                <option value="">No client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Status</label>
              <select style={styles.input} value={eventForm.event_status} onChange={e => setEventForm({ ...eventForm, event_status: e.target.value })}>
                <option value="inquiry">Inquiry</option>
                <option value="concept">Concept</option>
                <option value="planning">Planning</option>
                <option value="confirmed">Confirmed</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Event date</label>
              <input style={styles.input} type="date" value={eventForm.event_date} onChange={e => setEventForm({ ...eventForm, event_date: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Venue</label>
              <input style={styles.input} placeholder="e.g. The Grand Ballroom" value={eventForm.venue} onChange={e => setEventForm({ ...eventForm, venue: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Headcount</label>
              <input style={styles.input} type="number" placeholder="0" value={eventForm.headcount} onChange={e => setEventForm({ ...eventForm, headcount: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Budget ($)</label>
              <input style={styles.input} type="number" placeholder="0.00" value={eventForm.budget} onChange={e => setEventForm({ ...eventForm, budget: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Source / Lead origin</label>
              <input style={styles.input} placeholder="e.g. Referral, Instagram" value={eventForm.source} onChange={e => setEventForm({ ...eventForm, source: e.target.value })} />
            </div>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Description</label>
              <textarea style={{ ...styles.input, resize: 'vertical', fontFamily: t.fonts.sans }} rows={2} placeholder="Brief event description..." value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} />
            </div>
          </div>
          <div style={styles.formActions}>
            <button onClick={() => { setShowForm(false); setError(null); resetForms() }} style={styles.cancelBtn}>Cancel</button>
            <button onClick={handleSave} style={styles.saveBtn} disabled={saving || !eventForm.title}>
              {saving ? 'Saving...' : 'Save Event'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={styles.empty}>Loading {isEvents ? 'events' : 'projects'}...</div>
      ) : filteredRecords.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>{isEvents ? '🎉' : '📋'}</div>
          <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px' }}>
            {filterStatus === 'all' ? `No ${isEvents ? 'events' : 'projects'} yet` : `No ${filterStatus} ${isEvents ? 'events' : 'projects'}`}
          </h3>
          <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '0 0 24px' }}>
            {filterStatus === 'all' ? `Add your first ${isEvents ? 'event' : 'project'} to get started` : 'Try a different filter'}
          </p>
          {filterStatus === 'all' && (
            <button onClick={() => setShowForm(true)} style={styles.addBtn}>
              + {isEvents ? 'Add Event' : 'Add Project'}
            </button>
          )}
        </div>
      ) : isEvents ? (
        // Events table
        <div style={styles.table}>
          <div style={{ ...styles.tableHeader, gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr 0.3fr' }}>
            <span>Event</span><span>Client</span><span>Date</span><span>Venue</span><span>Headcount</span><span>Status</span><span></span>
          </div>
          {filteredRecords.map(record => (
            <div key={record.id} style={{ ...styles.tableRow, gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr 0.3fr' }} onClick={() => setSelectedRecord(record)}>
              <span style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>{record.title}</span>
              <span style={styles.tableCell}>{record.clients?.name || '—'}</span>
              <span style={styles.tableCell}>
                {record.event_date ? new Date(record.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
              </span>
              <span style={styles.tableCell}>{record.venue || '—'}</span>
              <span style={styles.tableCell}>{record.headcount ? record.headcount.toLocaleString() : '—'}</span>
              <span><StatusBadge status={record.event_status} colorMap={EVENT_STATUS_COLORS} /></span>
              <span style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary }}>→</span>
            </div>
          ))}
        </div>
      ) : (
        // Projects table
        <div style={styles.table}>
          <div style={{ ...styles.tableHeader, gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.5fr 1fr 0.3fr' }}>
            <span>Project</span><span>Client</span><span>Type</span><span>Budget</span><span>Timeline</span><span>Status</span><span></span>
          </div>
          {filteredRecords.map(record => {
            const sc = STATUS_COLORS[record.status] || STATUS_COLORS.planning
            return (
              <div key={record.id} style={{ ...styles.tableRow, gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.5fr 1fr 0.3fr' }} onClick={() => setSelectedRecord(record)}>
                <span style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>{record.title}</span>
                <span style={styles.tableCell}>{record.clients?.name || '—'}</span>
                <span style={styles.tableCell}>{record.project_type || '—'}</span>
                <span style={styles.tableCell}>{record.budget ? `$${parseFloat(record.budget).toLocaleString()}` : '—'}</span>
                <span style={styles.tableCell}>
                  {record.start_date && record.end_date
                    ? `${new Date(record.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → ${new Date(record.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : record.start_date
                      ? new Date(record.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                </span>
                <span>
                  <div style={{ display: 'inline-block', padding: '3px 10px', borderRadius: t.radius.full, fontSize: t.fontSizes.xs, fontWeight: '500', backgroundColor: sc.bg, color: sc.color }}>
                    {record.status}
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

// ── Project / Event Detail ─────────────────────────────────────────────────

function ProjectDetail({ record, isEvent, onBack, onDelete, clients }) {
  const [data, setData] = useState(record)
  const [tasks, setTasks] = useState([])
  const [invoices, setInvoices] = useState([])
  const [expenses, setExpenses] = useState([])
  const [documents, setDocuments] = useState([])
  const [budgetItems, setBudgetItems] = useState([])
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ ...record })
  const [notes, setNotes] = useState(record.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [budgetForm, setBudgetForm] = useState({ category: '', projected_amount: '', actual_amount: '', notes: '' })
  const [editingBudgetItem, setEditingBudgetItem] = useState(null)
  const [editBudgetForm, setEditBudgetForm] = useState({ category: '', projected_amount: '', actual_amount: '', notes: '' })
  const [contingency, setContingency] = useState(0)
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState(data.budget || '')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [
      { data: tasksData },
      { data: invoicesData },
      { data: expensesData },
      { data: budgetData },
      { data: docsData },
    ] = await Promise.all([
      supabase.from('tasks').select('*').eq('project_id', record.id).order('created_at', { ascending: true }),
      supabase.from('invoices').select('*').eq('project_id', record.id),
      supabase.from('expenses').select('*').eq('project_id', record.id),
      supabase.from('project_budget_items').select('*').eq('project_id', record.id).order('created_at', { ascending: true }),
      supabase.from('project_documents').select('*').eq('project_id', record.id).order('created_at', { ascending: false }),
    ])
    setTasks(tasksData || [])
    setInvoices(invoicesData || [])
    setExpenses(expensesData || [])
    setBudgetItems(budgetData || [])
    setDocuments(docsData || [])
  }

  async function handleEditSave() {
    const updatePayload = isEvent
      ? {
          title: editForm.title,
          client_id: editForm.client_id || null,
          event_status: editForm.event_status || 'inquiry',
          event_date: editForm.event_date || null,
          venue: editForm.venue || null,
          headcount: editForm.headcount ? parseInt(editForm.headcount) : null,
          budget: editForm.budget ? parseFloat(editForm.budget) : null,
          source: editForm.source || null,
          description: editForm.description || null,
        }
      : {
          title: editForm.title,
          client_id: editForm.client_id || null,
          status: editForm.status,
          project_type: editForm.project_type || null,
          start_date: editForm.start_date || null,
          end_date: editForm.end_date || null,
          budget: editForm.budget ? parseFloat(editForm.budget) : null,
          description: editForm.description || null,
        }

    const { error } = await supabase.from('projects').update(updatePayload).eq('id', record.id)
    if (!error) { setData(prev => ({ ...prev, ...editForm })); setEditMode(false) }
  }

  async function updateStatus(status) {
    const field = isEvent ? 'event_status' : 'status'
    await supabase.from('projects').update({ [field]: status }).eq('id', record.id)
    setData(prev => ({ ...prev, [field]: status }))
  }

  async function saveNotes() {
    setSavingNotes(true)
    await supabase.from('projects').update({ notes }).eq('id', record.id)
    setSavingNotes(false)
    setNotesSaved(true)
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
    const { data: newTask } = await supabase.from('tasks').insert({ title: newTaskTitle, project_id: record.id, status: 'todo' }).select().single()
    if (newTask) setTasks(prev => [...prev, newTask])
    setNewTaskTitle('')
    setAddingTask(false)
  }

  async function deleteTask(id) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(tk => tk.id !== id))
  }

  async function saveBudget() {
    await supabase.from('projects').update({ budget: parseFloat(budgetInput) || null }).eq('id', record.id)
    setData(prev => ({ ...prev, budget: budgetInput }))
    setEditingBudget(false)
  }

  async function addBudgetItem() {
    const { data: newItem } = await supabase.from('project_budget_items').insert({
      project_id: record.id,
      category: budgetForm.category,
      projected_amount: budgetForm.projected_amount ? parseFloat(budgetForm.projected_amount) : null,
      actual_amount: budgetForm.actual_amount ? parseFloat(budgetForm.actual_amount) : null,
      notes: budgetForm.notes || null,
    }).select().single()
    if (newItem) setBudgetItems(prev => [...prev, newItem])
    setBudgetForm({ category: '', projected_amount: '', actual_amount: '', notes: '' })
    setShowBudgetForm(false)
  }

  async function saveBudgetItem(id) {
    await supabase.from('project_budget_items').update({
      category: editBudgetForm.category,
      projected_amount: editBudgetForm.projected_amount ? parseFloat(editBudgetForm.projected_amount) : null,
      actual_amount: editBudgetForm.actual_amount ? parseFloat(editBudgetForm.actual_amount) : null,
      notes: editBudgetForm.notes || null,
    }).eq('id', id)
    setBudgetItems(prev => prev.map(item => item.id === id ? { ...item, ...editBudgetForm } : item))
    setEditingBudgetItem(null)
  }

  async function deleteBudgetItem(id) {
    if (!confirm('Delete this budget item?')) return
    await supabase.from('project_budget_items').delete().eq('id', id)
    setBudgetItems(prev => prev.filter(item => item.id !== id))
  }

  async function uploadDocument(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const fileName = `${record.id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('project-files').upload(fileName, file)
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(fileName)
      await supabase.from('project_documents').insert({
        project_id: record.id, user_id: user.id, name: file.name,
        file_url: urlData.publicUrl, file_type: file.type,
      })
      fetchAll()
    }
    setUploading(false)
  }

  async function deleteDocument(id) {
    if (!confirm('Delete this document?')) return
    await supabase.from('project_documents').delete().eq('id', id)
    setDocuments(prev => prev.filter(d => d.id !== id))
  }

  const colorMap = isEvent ? EVENT_STATUS_COLORS : STATUS_COLORS
  const currentStatus = isEvent ? data.event_status : data.status
  const sc = colorMap[currentStatus] || colorMap.planning
  const budget = parseFloat(data.budget) || 0
  const doneTasks = tasks.filter(tk => tk.status === 'done').length

  const statusStepOptions = isEvent
    ? ['inquiry', 'concept', 'planning', 'confirmed', 'in_progress', 'completed']
    : STATUS_STEPS

  return (
    <div style={{ padding: '32px', fontFamily: t.fonts.sans }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={onBack} style={styles.backBtn}>← Back to {isEvent ? 'events' : 'projects'}</button>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!editMode && <button onClick={() => setEditMode(true)} style={styles.editBtn}>Edit</button>}
          <button onClick={() => onDelete(record.id)} style={styles.deleteBtn}>Delete</button>
        </div>
      </div>

      {editMode ? (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>Edit {isEvent ? 'Event' : 'Project'}</h3>
          <div style={styles.formGrid}>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>{isEvent ? 'Event' : 'Project'} Name *</label>
              <input style={styles.input} value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Client</label>
              <select style={styles.input} value={editForm.client_id || ''} onChange={e => setEditForm({ ...editForm, client_id: e.target.value })}>
                <option value="">No client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {isEvent ? (
              <>
                <div style={styles.field}>
                  <label style={styles.label}>Status</label>
                  <select style={styles.input} value={editForm.event_status || 'inquiry'} onChange={e => setEditForm({ ...editForm, event_status: e.target.value })}>
                    <option value="inquiry">Inquiry</option>
                    <option value="concept">Concept</option>
                    <option value="planning">Planning</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Event date</label>
                  <input style={styles.input} type="date" value={editForm.event_date || ''} onChange={e => setEditForm({ ...editForm, event_date: e.target.value })} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Venue</label>
                  <input style={styles.input} value={editForm.venue || ''} onChange={e => setEditForm({ ...editForm, venue: e.target.value })} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Headcount</label>
                  <input style={styles.input} type="number" value={editForm.headcount || ''} onChange={e => setEditForm({ ...editForm, headcount: e.target.value })} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Source</label>
                  <input style={styles.input} value={editForm.source || ''} onChange={e => setEditForm({ ...editForm, source: e.target.value })} />
                </div>
              </>
            ) : (
              <>
                <div style={styles.field}>
                  <label style={styles.label}>Project Type</label>
                  <input style={styles.input} value={editForm.project_type || ''} onChange={e => setEditForm({ ...editForm, project_type: e.target.value })} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Status</label>
                  <select style={styles.input} value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="on-hold">On hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Start date</label>
                  <input style={styles.input} type="date" value={editForm.start_date || ''} onChange={e => setEditForm({ ...editForm, start_date: e.target.value })} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>End date</label>
                  <input style={styles.input} type="date" value={editForm.end_date || ''} onChange={e => setEditForm({ ...editForm, end_date: e.target.value })} />
                </div>
              </>
            )}
            <div style={styles.field}>
              <label style={styles.label}>Budget ($)</label>
              <input style={styles.input} type="number" value={editForm.budget || ''} onChange={e => setEditForm({ ...editForm, budget: e.target.value })} />
            </div>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Description</label>
              <textarea style={{ ...styles.input, resize: 'vertical', fontFamily: t.fonts.sans }} rows={2} value={editForm.description || ''} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
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
                <h1 style={{ fontSize: '24px', fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 4px', letterSpacing: '-0.3px' }}>{data.title}</h1>
                <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: 0 }}>
                  {data.clients?.name}
                  {isEvent && data.venue ? ` · ${data.venue}` : ''}
                  {!isEvent && data.project_type ? ` · ${data.project_type}` : ''}
                </p>
              </div>
              <StatusBadge status={currentStatus} colorMap={colorMap} />
            </div>

            {data.description && (
              <p style={{ fontSize: t.fontSizes.base, color: t.colors.textSecondary, lineHeight: '1.6', margin: '0 0 20px' }}>{data.description}</p>
            )}

            {/* Event-specific meta */}
            {isEvent && (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {data.event_date && (
                  <div style={{ backgroundColor: t.colors.bg, borderRadius: t.radius.md, padding: '10px 14px' }}>
                    <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', marginBottom: '2px' }}>Date</div>
                    <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>{new Date(data.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                  </div>
                )}
                {data.headcount && (
                  <div style={{ backgroundColor: t.colors.bg, borderRadius: t.radius.md, padding: '10px 14px' }}>
                    <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', marginBottom: '2px' }}>Headcount</div>
                    <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>{parseInt(data.headcount).toLocaleString()}</div>
                  </div>
                )}
                {data.source && (
                  <div style={{ backgroundColor: t.colors.bg, borderRadius: t.radius.md, padding: '10px 14px' }}>
                    <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', marginBottom: '2px' }}>Source</div>
                    <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>{data.source}</div>
                  </div>
                )}
              </div>
            )}

            {/* Status timeline */}
            <div style={{ marginBottom: isEvent ? '0' : '20px' }}>
              <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Status</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {statusStepOptions.map(step => {
                  const sc = colorMap[step] || {}
                  const isActive = currentStatus === step
                  return (
                    <button key={step} onClick={() => updateStatus(step)} style={{
                      flex: 1, minWidth: '80px', padding: '8px 4px', borderRadius: t.radius.md,
                      border: `1px solid ${isActive ? sc.border : t.colors.borderLight}`,
                      backgroundColor: isActive ? sc.bg : '#fff',
                      color: isActive ? sc.color : t.colors.textTertiary,
                      fontSize: t.fontSizes.xs, fontWeight: isActive ? '700' : '400',
                      cursor: 'pointer', fontFamily: t.fonts.sans, transition: 'all 0.15s',
                    }}>
                      {step.replace('_', ' ').charAt(0).toUpperCase() + step.replace('_', ' ').slice(1)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Project date range */}
            {!isEvent && (data.start_date || data.end_date) && (
              <div style={{ display: 'flex', gap: '16px', marginTop: '20px' }}>
                {data.start_date && (
                  <div style={{ backgroundColor: t.colors.bg, borderRadius: t.radius.md, padding: '10px 14px' }}>
                    <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', marginBottom: '2px' }}>Start</div>
                    <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>{new Date(data.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                  </div>
                )}
                {data.end_date && (
                  <div style={{ backgroundColor: t.colors.bg, borderRadius: t.radius.md, padding: '10px 14px' }}>
                    <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', marginBottom: '2px' }}>End</div>
                    <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>{new Date(data.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Budget */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ backgroundColor: '#fff', borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.borderLight}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: 0 }}>Budget</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>Contingency</span>
                    <select value={contingency} onChange={e => setContingency(parseInt(e.target.value))} style={{ padding: '4px 8px', borderRadius: t.radius.md, border: `1px solid ${t.colors.borderLight}`, fontSize: t.fontSizes.sm, color: t.colors.textSecondary, outline: 'none', backgroundColor: '#fff' }}>
                      {[0, 5, 10, 15, 20, 25].map(n => <option key={n} value={n}>{n}%</option>)}
                    </select>
                  </div>
                  <button onClick={() => setShowBudgetForm(true)} style={{ padding: '7px 14px', borderRadius: t.radius.md, border: 'none', backgroundColor: t.colors.primary, color: '#fff', fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer' }}>+ Add category</button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '12px 16px', backgroundColor: t.colors.bg, borderRadius: t.radius.md }}>
                <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, fontWeight: '500' }}>Overall budget:</span>
                {editingBudget ? (
                  <>
                    <input style={{ padding: '5px 10px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, outline: 'none', width: '120px', backgroundColor: '#fff' }} type="number" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} autoFocus />
                    <button onClick={saveBudget} style={{ padding: '5px 10px', borderRadius: t.radius.md, border: 'none', backgroundColor: t.colors.primary, color: '#fff', fontSize: t.fontSizes.xs, fontWeight: '600', cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setEditingBudget(false)} style={{ padding: '5px 10px', borderRadius: t.radius.md, border: `1px solid ${t.colors.borderLight}`, backgroundColor: '#fff', color: t.colors.textSecondary, fontSize: t.fontSizes.xs, cursor: 'pointer' }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: t.fontSizes.base, fontWeight: '700', color: t.colors.textPrimary }}>{data.budget ? `$${parseFloat(data.budget).toLocaleString()}` : 'Not set'}</span>
                    <button onClick={() => setEditingBudget(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: t.fontSizes.xs, color: t.colors.primary, fontWeight: '600', padding: 0 }}>edit</button>
                  </>
                )}
              </div>

              {showBudgetForm && (
                <div style={{ backgroundColor: t.colors.bg, borderRadius: t.radius.md, padding: '16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px' }}>
                    {[
                      { label: 'Category *', key: 'category', placeholder: 'e.g. Catering, Venue' },
                      { label: 'Projected ($)', key: 'projected_amount', placeholder: '0.00', type: 'number' },
                      { label: 'Actual ($)', key: 'actual_amount', placeholder: '0.00', type: 'number' },
                      { label: 'Notes', key: 'notes', placeholder: 'Optional' },
                    ].map(({ label, key, placeholder, type }) => (
                      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: t.fontSizes.xs, fontWeight: '500', color: t.colors.textTertiary }}>{label}</label>
                        <input style={{ padding: '8px 10px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, outline: 'none', backgroundColor: '#fff' }} type={type || 'text'} placeholder={placeholder} value={budgetForm[key]} onChange={e => setBudgetForm({ ...budgetForm, [key]: e.target.value })} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setShowBudgetForm(false)} style={{ padding: '7px 14px', borderRadius: t.radius.md, border: `1px solid ${t.colors.borderLight}`, backgroundColor: '#fff', color: t.colors.textSecondary, fontSize: t.fontSizes.sm, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={addBudgetItem} disabled={!budgetForm.category} style={{ padding: '7px 14px', borderRadius: t.radius.md, border: 'none', backgroundColor: t.colors.primary, color: '#fff', fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer' }}>Add</button>
                  </div>
                </div>
              )}

              {budgetItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: t.colors.textTertiary, fontSize: t.fontSizes.sm }}>No budget categories yet — add one to start tracking</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.5fr', gap: '8px', padding: '8px 12px', backgroundColor: t.colors.bg, borderRadius: t.radius.md, marginBottom: '8px' }}>
                    {['Category', 'Projected', 'Actual', 'Difference', ''].map(h => (
                      <span key={h} style={{ fontSize: t.fontSizes.xs, fontWeight: '600', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
                    {budgetItems.map(item => {
                      const projected = parseFloat(item.projected_amount) || 0
                      const actual = parseFloat(item.actual_amount) || 0
                      const diff = projected - actual
                      const isEditing = editingBudgetItem === item.id
                      return (
                        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.5fr', gap: '8px', padding: '10px 12px', backgroundColor: '#fafaf8', borderRadius: t.radius.md, alignItems: 'center' }}>
                          {isEditing ? (
                            <>
                              {['category', 'projected_amount', 'actual_amount'].map(key => (
                                <input key={key} style={{ padding: '5px 8px', borderRadius: t.radius.sm, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, outline: 'none' }} type={key !== 'category' ? 'number' : 'text'} value={editBudgetForm[key]} onChange={e => setEditBudgetForm({ ...editBudgetForm, [key]: e.target.value })} />
                              ))}
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button onClick={() => saveBudgetItem(item.id)} style={{ padding: '4px 8px', borderRadius: t.radius.sm, border: 'none', backgroundColor: t.colors.primary, color: '#fff', fontSize: t.fontSizes.xs, cursor: 'pointer' }}>Save</button>
                                <button onClick={() => setEditingBudgetItem(null)} style={{ padding: '4px 8px', borderRadius: t.radius.sm, border: `1px solid ${t.colors.borderLight}`, backgroundColor: '#fff', color: t.colors.textSecondary, fontSize: t.fontSizes.xs, cursor: 'pointer' }}>Cancel</button>
                              </div>
                              <span></span>
                            </>
                          ) : (
                            <>
                              <div>
                                <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>{item.category}</div>
                                {item.notes && <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{item.notes}</div>}
                              </div>
                              <span style={{ fontSize: t.fontSizes.base, color: t.colors.textSecondary }}>{projected > 0 ? `$${projected.toLocaleString()}` : '—'}</span>
                              <span style={{ fontSize: t.fontSizes.base, color: t.colors.textSecondary }}>{actual > 0 ? `$${actual.toLocaleString()}` : '—'}</span>
                              <span style={{ fontSize: t.fontSizes.base, fontWeight: '600', color: projected === 0 ? t.colors.textTertiary : diff >= 0 ? '#10B981' : '#cc3333' }}>
                                {projected === 0 ? '—' : diff >= 0 ? `+$${diff.toLocaleString()}` : `-$${Math.abs(diff).toLocaleString()}`}
                              </span>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={() => { setEditingBudgetItem(item.id); setEditBudgetForm({ category: item.category, projected_amount: item.projected_amount || '', actual_amount: item.actual_amount || '', notes: item.notes || '' }) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: t.colors.textTertiary }}>✏️</button>
                                <button onClick={() => deleteBudgetItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: t.colors.textTertiary }}>✕</button>
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ borderTop: `2px solid ${t.colors.borderLight}`, paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { label: 'Total projected', value: budgetItems.reduce((sum, i) => sum + (parseFloat(i.projected_amount) || 0), 0), color: t.colors.textPrimary },
                      contingency > 0 && { label: `Total + ${contingency}% contingency`, value: budgetItems.reduce((sum, i) => sum + (parseFloat(i.projected_amount) || 0), 0) * (1 + contingency / 100), color: '#F59E0B' },
                      { label: 'Total actual', value: budgetItems.reduce((sum, i) => sum + (parseFloat(i.actual_amount) || 0), 0), color: '#cc3333' },
                      budget > 0 && { label: 'Overall budget remaining', value: budget - budgetItems.reduce((sum, i) => sum + (parseFloat(i.actual_amount) || 0), 0), color: (budget - budgetItems.reduce((sum, i) => sum + (parseFloat(i.actual_amount) || 0), 0)) >= 0 ? '#10B981' : '#cc3333' },
                    ].filter(Boolean).map(row => (
                      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: t.colors.bg, borderRadius: t.radius.md }}>
                        <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>{row.label}</span>
                        <span style={{ fontSize: t.fontSizes.base, fontWeight: '700', color: row.color }}>${row.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Tasks */}
          <div style={{ backgroundColor: '#fff', borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.borderLight}`, marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: 0 }}>Tasks</h3>
              <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>{doneTasks}/{tasks.length} done</span>
            </div>
            {tasks.length > 0 && (
              <div style={{ height: '4px', backgroundColor: t.colors.borderLight, borderRadius: '2px', overflow: 'hidden', marginBottom: '16px' }}>
                <div style={{ height: '100%', width: `${tasks.length > 0 ? (doneTasks / tasks.length) * 100 : 0}%`, backgroundColor: t.colors.primary, borderRadius: '2px', transition: 'width 0.3s' }} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {tasks.map(task => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', backgroundColor: t.colors.bg, borderRadius: t.radius.md }}>
                  <button onClick={() => toggleTask(task)} style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, border: `2px solid ${task.status === 'done' ? t.colors.primary : t.colors.border}`, backgroundColor: task.status === 'done' ? t.colors.primary : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {task.status === 'done' && <span style={{ color: '#fff', fontSize: '10px', fontWeight: '700' }}>✓</span>}
                  </button>
                  <span style={{ flex: 1, fontSize: t.fontSizes.base, color: task.status === 'done' ? t.colors.textTertiary : t.colors.textPrimary, textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</span>
                  {task.due_date && <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                  <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', color: t.colors.textTertiary, cursor: 'pointer', fontSize: '12px' }}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input style={{ ...styles.input, flex: 1 }} placeholder="Add a task..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} />
              <button onClick={addTask} disabled={addingTask || !newTaskTitle.trim()} style={styles.saveBtn}>Add</button>
            </div>
          </div>

          {/* Notes */}
          <div style={{ backgroundColor: '#fff', borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.borderLight}`, marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: 0 }}>Notes</h3>
              <button onClick={saveNotes} disabled={savingNotes} style={{ padding: '6px 14px', borderRadius: t.radius.md, border: 'none', backgroundColor: notesSaved ? '#10B981' : t.colors.primary, color: '#fff', fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans, transition: 'background 0.2s' }}>
                {notesSaved ? '✓ Saved' : savingNotes ? 'Saving...' : 'Save notes'}
              </button>
            </div>
            <textarea style={{ width: '100%', padding: '12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.borderLight}`, fontSize: t.fontSizes.base, color: t.colors.textPrimary, outline: 'none', resize: 'vertical', fontFamily: t.fonts.sans, lineHeight: '1.6', boxSizing: 'border-box', backgroundColor: t.colors.bg }} rows={5} placeholder={`Internal notes about this ${isEvent ? 'event' : 'project'}...`} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {/* Documents */}
          <div style={{ backgroundColor: '#fff', borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.borderLight}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: 0 }}>Documents</h3>
              <label style={{ padding: '8px 14px', borderRadius: t.radius.md, border: 'none', backgroundColor: t.colors.primary, color: '#fff', fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans }}>
                {uploading ? 'Uploading...' : '+ Upload file'}
                <input type="file" onChange={uploadDocument} style={{ display: 'none' }} />
              </label>
            </div>
            {documents.length === 0 ? (
              <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary }}>No documents yet — upload contracts, briefs, or any files</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {documents.map(doc => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', backgroundColor: t.colors.bg, borderRadius: t.radius.md }}>
                    <span style={{ fontSize: '18px' }}>{doc.file_type?.includes('image') ? '🖼️' : doc.file_type?.includes('pdf') ? '📄' : '📁'}</span>
                    <span style={{ flex: 1, fontSize: t.fontSizes.base, color: t.colors.textPrimary, fontWeight: '500' }}>{doc.name}</span>
                    <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{new Date(doc.created_at).toLocaleDateString()}</span>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: t.fontSizes.sm, color: t.colors.primary, fontWeight: '500', textDecoration: 'none' }}>Open</a>
                    <button onClick={() => deleteDocument(doc.id)} style={{ background: 'none', border: 'none', color: t.colors.textTertiary, cursor: 'pointer', fontSize: '12px' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = {
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
  tableHeader: { display: 'grid', padding: '12px 20px', backgroundColor: t.colors.bg, borderBottom: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.xs, fontWeight: '600', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em' },
  tableRow: { display: 'grid', padding: '14px 20px', borderBottom: `1px solid ${t.colors.borderLight}`, alignItems: 'center', cursor: 'pointer', transition: 'background 0.15s' },
  tableCell: { fontSize: t.fontSizes.base, color: t.colors.textSecondary },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}` },
  empty: { fontSize: t.fontSizes.base, color: t.colors.textTertiary, padding: '40px', textAlign: 'center' },
  backBtn: { padding: '8px 14px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: t.fontSizes.base, cursor: 'pointer', fontFamily: t.fonts.sans },
  editBtn: { padding: '8px 14px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: t.fontSizes.base, cursor: 'pointer', fontFamily: t.fonts.sans },
  deleteBtn: { padding: '8px 14px', borderRadius: t.radius.md, border: 'none', backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.base, cursor: 'pointer', fontFamily: t.fonts.sans, fontWeight: '500' },
}
