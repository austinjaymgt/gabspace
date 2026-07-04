import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t, taskStatusConfig } from '../theme'
import EventHero from '../components/events/EventHero'
import RunOfShow from '../components/events/RunOfShow'
import Staffing from '../components/events/Staffing'
import ConceptForm from '../components/events/ConceptForm'
import Milestones from '../components/Milestones'

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
  { key: 'active',    label: 'In Progress',    color: '#6B8F71' },
  { key: 'on-hold',   label: 'On hold',   color: '#BA7517' },
  { key: 'completed', label: 'Completed', color: '#378ADD' },
]

const STATUS_STEPS = ['planning', 'active', 'on-hold', 'completed', 'cancelled']

// ── Shared helpers ─────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const sc = STATUS_COLORS[status] || STATUS_COLORS.planning
  return (
    <div style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: t.radius.full,
      fontSize: t.fontSizes.xs,
      fontWeight: '500',
      backgroundColor: sc.bg,
      color: sc.color,
      textTransform: 'capitalize',
    }}>
      {status === 'active' ? 'In Progress' : (status || '').replace(/-/g, ' ')}
    </div>
  )
}

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : ''
}

// ── Project row ────────────────────────────────────────────────────────────

function ProjectRow({ record, onClick }) {
  const sc = STATUS_COLORS[record.status] || STATUS_COLORS.planning
  const dateStart = record.event_date || record.start_date
  const dateEnd = record.end_date
  return (
    <div style={{ ...styles.tableRow, gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.5fr 1fr 0.3fr' }} onClick={onClick}>
      <span style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>
        {record.title}
        {record.has_event_features && <span style={{ marginLeft: '6px', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#F0EBF9', color: '#7C5CBF', fontWeight: '600' }}>EVENT</span>}
      </span>
      <span style={styles.tableCell}>{record.clients?.name || '—'}</span>
      <span style={styles.tableCell}>{record.project_type || (record.has_event_features ? 'Event' : '—')}</span>
      <span style={styles.tableCell}>{record.budget ? `$${parseFloat(record.budget).toLocaleString()}` : '—'}</span>
      <span style={styles.tableCell}>
        {dateStart && dateEnd
          ? `${new Date(dateStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → ${new Date(dateEnd + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          : dateStart
            ? new Date(dateStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : '—'}
      </span>
      <span>
        <div style={{ display: 'inline-block', padding: '3px 10px', borderRadius: t.radius.full, fontSize: t.fontSizes.xs, fontWeight: '500', backgroundColor: sc.bg, color: sc.color, textTransform: 'capitalize' }}>
          {record.status === 'active' ? 'In Progress' : (record.status || '').replace(/-/g, ' ')}
        </div>
      </span>
      <span style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary }}>→</span>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────

export default function Projects({ workspaceId }) {
  const [records, setRecords] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [sortBy, setSortBy] = useState('created_at')
  const [filterStatus, setFilterStatus] = useState('all')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [showCancelled, setShowCancelled] = useState(false)
  const [collapsedStatuses, setCollapsedStatuses] = useState({})

  const [projectForm, setProjectForm] = useState({
    title: '', client_id: '', status: 'planning',
    project_type: '', start_date: '', end_date: '',
    budget: '', description: '',
  })

  useEffect(() => {
    fetchRecords()
    fetchClients()
  }, [])

  async function fetchRecords() {
    setLoading(true)
    setFilterStatus('all')
    const { data } = await supabase
      .from('projects')
      .select('*, clients(name, company)')
      .eq('type', 'project')
      .order('created_at', { ascending: false })
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

    const payload = {
      type: 'project',
      title: projectForm.title,
      client_id: projectForm.client_id || null,
      status: projectForm.status,
      project_type: projectForm.project_type || null,
      start_date: projectForm.start_date || null,
      end_date: projectForm.end_date || null,
      budget: projectForm.budget ? parseFloat(projectForm.budget) : null,
      description: projectForm.description || null,
      has_event_features: false,
      user_id: user.id,
    }

    const { error: saveError } = await supabase.from('projects').insert({ ...payload, workspace_id: workspaceId })
    if (saveError) {
      setError(saveError.message)
    } else {
      setShowForm(false)
      setProjectForm({ title: '', client_id: '', status: 'planning', project_type: '', start_date: '', end_date: '', budget: '', description: '' })
      fetchRecords()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this project?')) return
    await supabase.from('projects').delete().eq('id', id)
    fetchRecords()
    setSelectedRecord(null)
  }

  const sortFn = (a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title)
    if (sortBy === 'budget') return (parseFloat(b.budget) || 0) - (parseFloat(a.budget) || 0)
    if (sortBy === 'status') return (a.status || '').localeCompare(b.status || '')
    if (sortBy === 'category') return (a.project_type || '').localeCompare(b.project_type || '')
    if (sortBy === 'timeline') {
      const dateA = a.event_date || a.start_date
      const dateB = b.event_date || b.start_date
      return new Date(dateA || '9999') - new Date(dateB || '9999')
    }
    return new Date(b.created_at) - new Date(a.created_at)
  }

  const isFiltered = filterStatus !== 'all'
  const filteredRecords = isFiltered
    ? records.filter(r => r.status === filterStatus).sort(sortFn)
    : records.filter(r => r.status !== 'completed' && r.status !== 'cancelled').sort(sortFn)
  const completedRecords = isFiltered ? [] : records.filter(r => r.status === 'completed').sort(sortFn)
  const cancelledRecords = isFiltered ? [] : records.filter(r => r.status === 'cancelled').sort(sortFn)

  const STATUS_GROUP_ORDER = ['planning', 'active', 'on-hold']
  const STATUS_GROUP_LABELS = { planning: 'Planning', active: 'In Progress', 'on-hold': 'On Hold' }
  const STATUS_GROUP_COLORS = { planning: '#534AB7', active: '#6B8F71', 'on-hold': '#BA7517' }

  const groupedByStatus = !isFiltered && sortBy !== 'category'
    ? STATUS_GROUP_ORDER.map(status => ({
        status,
        records: filteredRecords.filter(r => r.status === status),
      })).filter(g => g.records.length > 0)
    : null

  const groupedByType = sortBy === 'category' ? (() => {
    const groups = {}
    filteredRecords.forEach(r => {
      const key = r.project_type || 'No type'
      if (!groups[key]) groups[key] = []
      groups[key].push(r)
    })
    return Object.entries(groups).sort(([a], [b]) => a === 'No type' ? 1 : b === 'No type' ? -1 : a.localeCompare(b))
  })() : null

  if (selectedRecord) {
    return (
      <ProjectDetail
        record={selectedRecord}
        onBack={() => { setSelectedRecord(null); fetchRecords() }}
        onDelete={handleDelete}
        clients={clients}
        workspaceId={workspaceId}
      />
    )
  }

  return (
    <div style={{ padding: '32px', fontFamily: t.fonts.sans }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: t.fontSizes.xs, fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.primary, marginBottom: '6px' }}>
            Client Management
          </div>
          <h2 style={{ fontSize: t.fontSizes['2xl'], fontWeight: '800', color: t.colors.textPrimary, margin: '0 0 4px', fontFamily: t.fonts.heading, letterSpacing: '0.01em' }}>
            Projects
          </h2>
          <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: 0 }}>
            {records.filter(r => r.status !== 'completed' && r.status !== 'cancelled').length} active · {records.length} total
          </p>
        </div>
        <button onClick={() => setShowForm(true)} style={styles.addBtn}>+ Add Project</button>
      </div>

      {/* Status stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${PROJECT_STATUS_CARDS.length}, 1fr)`, gap: '14px', marginBottom: '20px' }}>
        {PROJECT_STATUS_CARDS.map(({ key, label, color }) => {
          const count = records.filter(r => r.status === key).length
          const isSelected = filterStatus === key
          return (
            <div
              key={key}
              onClick={() => setFilterStatus(isSelected ? 'all' : key)}
              style={{
                backgroundColor: t.colors.bgCard,
                borderRadius: '12px',
                padding: '20px 22px',
                border: isSelected ? `1.5px solid ${color}` : `1px solid ${t.colors.border}`,
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
            >
              <p style={{ fontSize: '13px', color: t.colors.textTertiary, margin: '0 0 8px' }}>{label}</p>
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
          style={{ padding: '6px 10px', borderRadius: t.radius.md, border: `1px solid ${t.colors.borderLight}`, fontSize: t.fontSizes.sm, color: t.colors.textSecondary, outline: 'none', backgroundColor: t.colors.bgCard, fontFamily: t.fonts.sans }}
        >
          <option value="created_at">Date added</option>
          <option value="title">Name</option>
          <option value="budget">Budget</option>
          <option value="status">Status</option>
          <option value="timeline">Timeline</option>
          <option value="category">Project type</option>
        </select>
      </div>

      {/* New project form */}
      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>New Project</h3>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.formGrid}>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Project title *</label>
              <input style={styles.input} placeholder="e.g. Spring Portrait Series 2026" value={projectForm.title} onChange={e => setProjectForm({ ...projectForm, title: e.target.value })} />
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
                <option value="active">In Progress</option>
                <option value="on-hold">On hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Project type</label>
              <input style={styles.input} placeholder="e.g. Portrait, Branding, Commission" value={projectForm.project_type} onChange={e => setProjectForm({ ...projectForm, project_type: e.target.value })} />
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
            <button onClick={() => { setShowForm(false); setError(null) }} style={styles.cancelBtn}>Cancel</button>
            <button onClick={handleSave} style={styles.saveBtn} disabled={saving || !projectForm.title}>
              {saving ? 'Saving...' : 'Save Project'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={styles.empty}>Loading projects...</div>
      ) : filteredRecords.length === 0 && completedRecords.length === 0 && cancelledRecords.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>📋</div>
          <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px' }}>
            {filterStatus === 'all' ? 'No projects yet' : `No ${filterStatus} projects`}
          </h3>
          <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '0 0 24px' }}>
            {filterStatus === 'all' ? 'Add your first project to start bringing your ideas to life' : 'Try a different filter'}
          </p>
          {filterStatus === 'all' && (
            <button onClick={() => setShowForm(true)} style={styles.addBtn}>+ Add Project</button>
          )}
        </div>
      ) : (
        <>
          {groupedByType ? (
            groupedByType.map(([type, recs]) => (
              <div key={type} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: t.fontSizes.xs, fontWeight: '700', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{type} · {recs.length}</span>
                  <div style={{ flex: 1, height: '1px', backgroundColor: t.colors.border }} />
                </div>
                <div style={styles.table}>
                  <div style={{ ...styles.tableHeader, gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.5fr 1fr 0.3fr' }}>
                    <span>Project</span><span>Client</span><span>Type</span><span>Budget</span><span>Timeline</span><span>Status</span><span></span>
                  </div>
                  {recs.map(record => <ProjectRow key={record.id} record={record} onClick={() => setSelectedRecord(record)} />)}
                </div>
              </div>
            ))
          ) : groupedByStatus ? (
            groupedByStatus.map(({ status, records: recs }) => {
              const isCollapsed = collapsedStatuses[status]
              const color = STATUS_GROUP_COLORS[status]
              return (
                <div key={status} style={{ marginBottom: '16px' }}>
                  <button
                    onClick={() => setCollapsedStatuses(prev => ({ ...prev, [status]: !prev[status] }))}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', background: 'none', border: 'none', padding: '10px 0', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ fontSize: t.fontSizes.xs, fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                      {STATUS_GROUP_LABELS[status]} · {recs.length}
                    </span>
                    <div style={{ flex: 1, height: '1px', backgroundColor: t.colors.border }} />
                    <span style={{ fontSize: '11px', color: t.colors.textTertiary, fontWeight: '600' }}>{isCollapsed ? '▼' : '▲'}</span>
                  </button>
                  {!isCollapsed && (
                    <div style={styles.table}>
                      <div style={{ ...styles.tableHeader, gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.5fr 1fr 0.3fr' }}>
                        <span>Project</span><span>Client</span><span>Type</span><span>Budget</span><span>Timeline</span><span>Status</span><span></span>
                      </div>
                      {recs.map(record => <ProjectRow key={record.id} record={record} onClick={() => setSelectedRecord(record)} />)}
                    </div>
                  )}
                </div>
              )
            })
          ) : filteredRecords.length > 0 ? (
            <div style={styles.table}>
              <div style={{ ...styles.tableHeader, gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.5fr 1fr 0.3fr' }}>
                <span>Project</span><span>Client</span><span>Type</span><span>Budget</span><span>Timeline</span><span>Status</span><span></span>
              </div>
              {filteredRecords.map(record => <ProjectRow key={record.id} record={record} onClick={() => setSelectedRecord(record)} />)}
            </div>
          ) : !isFiltered ? (
            <div style={styles.emptyState}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>📋</div>
              <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px' }}>No projects yet</h3>
              <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '0 0 24px' }}>Add your first project to get started</p>
              <button onClick={() => setShowForm(true)} style={styles.addBtn}>+ Add Project</button>
            </div>
          ) : null}

          {!isFiltered && completedRecords.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <button
                onClick={() => setShowCompleted(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', background: 'none', border: 'none', padding: '12px 0', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ fontSize: t.fontSizes.xs, fontWeight: '700', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  Completed · {completedRecords.length}
                </span>
                <div style={{ flex: 1, height: '1px', backgroundColor: t.colors.border }} />
                <span style={{ fontSize: '11px', color: t.colors.textTertiary, fontWeight: '600' }}>{showCompleted ? '▲' : '▼'}</span>
              </button>
              {showCompleted && (
                <div style={styles.table}>
                  <div style={{ ...styles.tableHeader, gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.5fr 1fr 0.3fr' }}>
                    <span>Project</span><span>Client</span><span>Type</span><span>Budget</span><span>Timeline</span><span>Status</span><span></span>
                  </div>
                  {completedRecords.map(record => <ProjectRow key={record.id} record={record} onClick={() => setSelectedRecord(record)} />)}
                </div>
              )}
            </div>
          )}

          {!isFiltered && cancelledRecords.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <button
                onClick={() => setShowCancelled(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', background: 'none', border: 'none', padding: '12px 0', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ fontSize: t.fontSizes.xs, fontWeight: '700', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  Cancelled · {cancelledRecords.length}
                </span>
                <div style={{ flex: 1, height: '1px', backgroundColor: t.colors.border }} />
                <span style={{ fontSize: '11px', color: t.colors.textTertiary, fontWeight: '600' }}>{showCancelled ? '▲' : '▼'}</span>
              </button>
              {showCancelled && (
                <div style={styles.table}>
                  <div style={{ ...styles.tableHeader, gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.5fr 1fr 0.3fr' }}>
                    <span>Project</span><span>Client</span><span>Type</span><span>Budget</span><span>Timeline</span><span>Status</span><span></span>
                  </div>
                  {cancelledRecords.map(record => <ProjectRow key={record.id} record={record} onClick={() => setSelectedRecord(record)} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Project Detail ─────────────────────────────────────────────────────────

const DEFAULT_SECTION_ORDER = ['milestones', 'budget', 'tasks', 'notes', 'documents']

function ProjectDetail({ record, onBack, onDelete, clients, workspaceId }) {
  const [data, setData] = useState(record)
  const [tasks, setTasks] = useState([])
  const [documents, setDocuments] = useState([])
  const [budgetItems, setBudgetItems] = useState([])
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ ...record })
  const [sectionOrder, setSectionOrder] = useState(() => {
    try {
      const saved = localStorage.getItem('project-section-order')
      if (saved) {
        const parsed = JSON.parse(saved)
        // ensure any new sections not in saved order are appended
        const missing = DEFAULT_SECTION_ORDER.filter(k => !parsed.includes(k))
        return [...parsed, ...missing]
      }
    } catch {}
    return DEFAULT_SECTION_ORDER
  })
  const [dragSection, setDragSection] = useState(null)
  const [dragOverSection, setDragOverSection] = useState(null)
  const [notes, setNotes] = useState(record.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [notesDirty, setNotesDirty] = useState(false)
  const [notesLastSaved, setNotesLastSaved] = useState(record.notes ? new Date() : null)
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
  const [activeTab, setActiveTab] = useState('details')
  const [conceptOpen, setConceptOpen] = useState(false)
  const [hasEventFeatures, setHasEventFeatures] = useState(!!record.has_event_features)
  const [togglingFeatures, setTogglingFeatures] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [
      { data: tasksData },
      { data: budgetData },
      { data: docsData },
    ] = await Promise.all([
      supabase.from('tasks').select('*').eq('project_id', record.id).order('created_at', { ascending: true }),
      supabase.from('project_budget_items').select('*').eq('project_id', record.id).order('created_at', { ascending: true }),
      supabase.from('project_documents').select('*').eq('project_id', record.id).order('created_at', { ascending: false }),
    ])
    setTasks(tasksData || [])
    setBudgetItems(budgetData || [])
    setDocuments(docsData || [])
  }

  async function toggleEventFeatures() {
    setTogglingFeatures(true)
    const next = !hasEventFeatures
    await supabase.from('projects').update({ has_event_features: next }).eq('id', record.id)
    setHasEventFeatures(next)
    setActiveTab(next ? 'event' : 'details')
    setTogglingFeatures(false)
  }

  async function handleEditSave() {
    const payload = {
      title: editForm.title,
      client_id: editForm.client_id || null,
      status: editForm.status,
      project_type: editForm.project_type || null,
      start_date: editForm.start_date || null,
      end_date: editForm.end_date || null,
      budget: editForm.budget ? parseFloat(editForm.budget) : null,
      description: editForm.description || null,
      ...(hasEventFeatures && {
        event_date: editForm.event_date || null,
        venue: editForm.venue || null,
        headcount: editForm.headcount ? parseInt(editForm.headcount) : null,
        source: editForm.source || null,
      }),
    }
    const { error } = await supabase.from('projects').update(payload).eq('id', record.id)
    if (!error) { setData(prev => ({ ...prev, ...editForm })); setEditMode(false) }
  }

  async function updateStatus(status) {
    await supabase.from('projects').update({ status }).eq('id', record.id)
    setData(prev => ({ ...prev, status }))
  }

  async function saveNotes() {
    setSavingNotes(true)
    await supabase.from('projects').update({ notes }).eq('id', record.id)
    setSavingNotes(false)
    setNotesSaved(true)
    setNotesDirty(false)
    setNotesLastSaved(new Date())
    setTimeout(() => setNotesSaved(false), 2000)
  }

  async function updateTaskStatus(task, newStatus) {
    setTasks(prev => prev.map(tk => tk.id === task.id ? { ...tk, status: newStatus } : tk))
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id)
  }

  async function addTask() {
    if (!newTaskTitle.trim()) return
    setAddingTask(true)
    const { data: newTask, error } = await supabase.from('tasks').insert({ title: newTaskTitle, project_id: record.id, workspace_id: workspaceId, status: 'todo' }).select().single()
    if (!error && newTask) setTasks(prev => [...prev, newTask])
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
    const { data: newItem, error } = await supabase.from('project_budget_items').insert({
      project_id: record.id,
      workspace_id: workspaceId,
      category: budgetForm.category,
      projected_amount: budgetForm.projected_amount ? parseFloat(budgetForm.projected_amount) : null,
      actual_amount: budgetForm.actual_amount ? parseFloat(budgetForm.actual_amount) : null,
      notes: budgetForm.notes || null,
    }).select().single()
    if (error) { console.error('Budget item insert failed:', error); return }
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
      const { error: docError } = await supabase.from('project_documents').insert({
        project_id: record.id,
        workspace_id: workspaceId,
        user_id: user.id,
        name: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
      })
      if (!docError) fetchAll()
    }
    setUploading(false)
  }

  async function deleteDocument(id) {
    if (!confirm('Delete this document?')) return
    await supabase.from('project_documents').delete().eq('id', id)
    setDocuments(prev => prev.filter(d => d.id !== id))
  }

  function reorderSections(fromKey, toKey) {
    if (!fromKey || fromKey === toKey) return
    const next = [...sectionOrder]
    const from = next.indexOf(fromKey)
    const to = next.indexOf(toKey)
    next.splice(from, 1)
    next.splice(to, 0, fromKey)
    setSectionOrder(next)
    localStorage.setItem('project-section-order', JSON.stringify(next))
    setDragSection(null)
    setDragOverSection(null)
  }

  const sc = STATUS_COLORS[data.status] || STATUS_COLORS.planning
  const budget = parseFloat(data.budget) || 0
  const doneTasks = tasks.filter(tk => tk.status === 'done').length

  return (
    <div style={{ padding: '32px', fontFamily: t.fonts.sans }}>

      {/* Top action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={onBack} style={styles.backBtn}>← Back to projects</button>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Event features toggle */}
          <button
            onClick={toggleEventFeatures}
            disabled={togglingFeatures}
            style={{
              padding: '8px 14px',
              borderRadius: t.radius.md,
              border: hasEventFeatures ? '1.5px solid #7C5CBF' : `1px solid ${t.colors.border}`,
              backgroundColor: hasEventFeatures ? '#F0EBF9' : t.colors.bgCard,
              color: hasEventFeatures ? '#7C5CBF' : t.colors.textSecondary,
              fontSize: t.fontSizes.sm,
              fontWeight: hasEventFeatures ? '600' : '400',
              cursor: 'pointer',
              fontFamily: t.fonts.sans,
              transition: 'all 0.15s',
            }}
          >
            {hasEventFeatures ? '✦ Event features on' : '+ Event features'}
          </button>
          {!editMode && <button onClick={() => setEditMode(true)} style={styles.editBtn}>Edit</button>}
          <button onClick={() => onDelete(record.id)} style={styles.deleteBtn}>Delete</button>
        </div>
      </div>

      {editMode ? (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>Edit Project</h3>
          <div style={styles.formGrid}>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Project Name *</label>
              <input style={styles.input} value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Client</label>
              <select style={styles.input} value={editForm.client_id || ''} onChange={e => setEditForm({ ...editForm, client_id: e.target.value })}>
                <option value="">No client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Status</label>
              <select style={styles.input} value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                <option value="planning">Planning</option>
                <option value="active">In Progress</option>
                <option value="on-hold">On hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Project Type</label>
              <input style={styles.input} value={editForm.project_type || ''} onChange={e => setEditForm({ ...editForm, project_type: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Budget ($)</label>
              <input style={styles.input} type="number" value={editForm.budget || ''} onChange={e => setEditForm({ ...editForm, budget: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Start date</label>
              <input style={styles.input} type="date" value={toDateInput(editForm.start_date)} onChange={e => setEditForm({ ...editForm, start_date: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>End date</label>
              <input style={styles.input} type="date" value={toDateInput(editForm.end_date)} onChange={e => setEditForm({ ...editForm, end_date: e.target.value })} />
            </div>

            {/* Event-specific fields, shown only when features are on */}
            {hasEventFeatures && (
              <>
                <div style={{ gridColumn: 'span 2', borderTop: `1px solid ${t.colors.borderLight}`, paddingTop: '16px', marginTop: '4px' }}>
                  <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', color: '#7C5CBF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Event details</div>
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Event date</label>
                  <input style={styles.input} type="date" value={toDateInput(editForm.event_date)} onChange={e => setEditForm({ ...editForm, event_date: e.target.value })} />
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
                  <label style={styles.label}>Source / Lead origin</label>
                  <input style={styles.input} value={editForm.source || ''} onChange={e => setEditForm({ ...editForm, source: e.target.value })} />
                </div>
              </>
            )}

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
          {/* Dark hero banner — all projects */}
          <EventHero data={data} statusColor={sc} />

          {/* Status pipeline — always visible */}
          <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '20px 24px', border: `1px solid ${t.colors.borderLight}`, marginBottom: '20px' }}>
            <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Status</div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {STATUS_STEPS.map(step => {
                const stepColor = STATUS_COLORS[step] || {}
                const isActive = data.status === step
                return (
                  <button key={step} onClick={() => updateStatus(step)} style={{
                    flex: 1, minWidth: '80px', padding: '8px 4px', borderRadius: t.radius.md,
                    border: `1px solid ${isActive ? stepColor.border : t.colors.borderLight}`,
                    backgroundColor: isActive ? stepColor.bg : t.colors.bgCard,
                    color: isActive ? stepColor.color : t.colors.textTertiary,
                    fontSize: t.fontSizes.xs, fontWeight: isActive ? '700' : '400',
                    cursor: 'pointer', fontFamily: t.fonts.sans, transition: 'all 0.15s',
                    textTransform: 'capitalize',
                  }}>
                    {step === 'active' ? 'In Progress' : step.replace(/-/g, ' ')}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', backgroundColor: t.colors.bgCard, borderRadius: '10px', padding: '6px', border: `1px solid ${t.colors.borderLight}` }}>
            <button onClick={() => setActiveTab('details')} style={{
              flex: 1, padding: '8px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer',
              fontSize: t.fontSizes.sm, fontWeight: activeTab === 'details' ? '700' : '400',
              backgroundColor: activeTab === 'details' ? t.colors.primary : 'transparent',
              color: activeTab === 'details' ? '#fff' : t.colors.textTertiary,
              fontFamily: t.fonts.sans, transition: 'all 0.15s',
            }}>Project Details</button>
            {hasEventFeatures && (
              <button onClick={() => setActiveTab('event')} style={{
                flex: 1, padding: '8px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                fontSize: t.fontSizes.sm, fontWeight: activeTab === 'event' ? '700' : '400',
                backgroundColor: activeTab === 'event' ? '#7C5CBF' : 'transparent',
                color: activeTab === 'event' ? '#fff' : t.colors.textTertiary,
                fontFamily: t.fonts.sans, transition: 'all 0.15s',
              }}>Event Planning</button>
            )}
          </div>

          {/* ── Project Details tab ── */}
          {activeTab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {sectionOrder.map(key => {
                const isDragOver = dragOverSection === key
                const wrapperProps = {
                  key,
                  draggable: true,
                  onDragStart: () => setDragSection(key),
                  onDragOver: e => { e.preventDefault(); setDragOverSection(key) },
                  onDragLeave: () => setDragOverSection(null),
                  onDrop: () => reorderSections(dragSection, key),
                  onDragEnd: () => { setDragSection(null); setDragOverSection(null) },
                  style: {
                    opacity: dragSection === key ? 0.4 : 1,
                    outline: isDragOver ? `2px dashed ${t.colors.primary}` : 'none',
                    outlineOffset: '2px',
                    borderRadius: t.radius.lg,
                    transition: 'opacity 0.15s',
                  },
                }

                const grip = (
                  <span
                    title="Drag to reorder"
                    style={{ cursor: 'grab', color: t.colors.textTertiary, fontSize: '14px', lineHeight: 1, userSelect: 'none', opacity: 0.5, marginRight: '8px' }}
                  >⠿</span>
                )

                if (key === 'milestones') return (
                  <div {...wrapperProps} style={{ ...wrapperProps.style, position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '22px', left: '20px', zIndex: 1 }}>{grip}</div>
                    <Milestones projectId={record.id} workspaceId={workspaceId} />
                  </div>
                )

                if (key === 'budget') return (
                  <div {...wrapperProps}>
                    <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.borderLight}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {grip}
                          <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: 0 }}>Budget</h3>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>Contingency</span>
                            <select value={contingency} onChange={e => setContingency(parseInt(e.target.value))} style={{ padding: '4px 8px', borderRadius: t.radius.md, border: `1px solid ${t.colors.borderLight}`, fontSize: t.fontSizes.sm, color: t.colors.textSecondary, outline: 'none', backgroundColor: t.colors.bgCard }}>
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
                            <input style={{ padding: '5px 10px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, outline: 'none', width: '120px', backgroundColor: t.colors.bgCard }} type="number" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} autoFocus />
                            <button onClick={saveBudget} style={{ padding: '5px 10px', borderRadius: t.radius.md, border: 'none', backgroundColor: t.colors.primary, color: '#fff', fontSize: t.fontSizes.xs, fontWeight: '600', cursor: 'pointer' }}>Save</button>
                            <button onClick={() => setEditingBudget(false)} style={{ padding: '5px 10px', borderRadius: t.radius.md, border: `1px solid ${t.colors.borderLight}`, backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: t.fontSizes.xs, cursor: 'pointer' }}>Cancel</button>
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
                            ].map(({ label, key: fk, placeholder, type }) => (
                              <div key={fk} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: t.fontSizes.xs, fontWeight: '500', color: t.colors.textTertiary }}>{label}</label>
                                <input style={{ padding: '8px 10px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, outline: 'none', backgroundColor: t.colors.bgCard }} type={type || 'text'} placeholder={placeholder} value={budgetForm[fk]} onChange={e => setBudgetForm({ ...budgetForm, [fk]: e.target.value })} />
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowBudgetForm(false)} style={{ padding: '7px 14px', borderRadius: t.radius.md, border: `1px solid ${t.colors.borderLight}`, backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: t.fontSizes.sm, cursor: 'pointer' }}>Cancel</button>
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
                                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.5fr', gap: '8px', padding: '10px 12px', backgroundColor: t.colors.bg, borderRadius: t.radius.md, alignItems: 'center' }}>
                                  {isEditing ? (
                                    <>
                                      {['category', 'projected_amount', 'actual_amount'].map(ek => (
                                        <input key={ek} style={{ padding: '5px 8px', borderRadius: t.radius.sm, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, outline: 'none' }} type={ek !== 'category' ? 'number' : 'text'} value={editBudgetForm[ek]} onChange={e => setEditBudgetForm({ ...editBudgetForm, [ek]: e.target.value })} />
                                      ))}
                                      <div style={{ display: 'flex', gap: '4px' }}>
                                        <button onClick={() => saveBudgetItem(item.id)} style={{ padding: '4px 8px', borderRadius: t.radius.sm, border: 'none', backgroundColor: t.colors.primary, color: '#fff', fontSize: t.fontSizes.xs, cursor: 'pointer' }}>Save</button>
                                        <button onClick={() => setEditingBudgetItem(null)} style={{ padding: '4px 8px', borderRadius: t.radius.sm, border: `1px solid ${t.colors.borderLight}`, backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: t.fontSizes.xs, cursor: 'pointer' }}>Cancel</button>
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
                )

                if (key === 'tasks') return (
                  <div {...wrapperProps}>
                    <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.borderLight}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {grip}
                          <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: 0 }}>Tasks</h3>
                        </div>
                        <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>{doneTasks}/{tasks.length} done</span>
                      </div>
                      {tasks.length > 0 && (
                        <div style={{ height: '4px', backgroundColor: t.colors.borderLight, borderRadius: '2px', overflow: 'hidden', marginBottom: '16px' }}>
                          <div style={{ height: '100%', width: `${(doneTasks / tasks.length) * 100}%`, backgroundColor: t.colors.primary, borderRadius: '2px', transition: 'width 0.3s' }} />
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                        {tasks.map(task => {
                          const sc = taskStatusConfig[task.status] || taskStatusConfig.todo
                          return (
                            <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', backgroundColor: t.colors.bg, borderRadius: t.radius.md }}>
                              <span style={{ flex: 1, fontSize: t.fontSizes.base, color: task.status === 'done' ? t.colors.textTertiary : t.colors.textPrimary, textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</span>
                              {task.due_date && <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                              <select
                                value={task.status}
                                onChange={e => updateTaskStatus(task, e.target.value)}
                                className="status-select"
                                style={{ ...styles.statusSelect, '--status-bg': sc.bg, '--status-color': sc.color }}
                                title="Change status"
                              >
                                <option value="todo">To do</option>
                                <option value="in-progress">In progress</option>
                                <option value="done">Done</option>
                              </select>
                              <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', color: t.colors.textTertiary, cursor: 'pointer', fontSize: '12px' }}>✕</button>
                            </div>
                          )
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input style={{ ...styles.input, flex: 1 }} placeholder="Add a task..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} />
                        <button onClick={addTask} disabled={addingTask || !newTaskTitle.trim()} style={styles.saveBtn}>Add</button>
                      </div>
                    </div>
                  </div>
                )

                if (key === 'notes') return (
                  <div {...wrapperProps}>
                    <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.borderLight}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {grip}
                          <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: 0 }}>Notes</h3>
                        </div>
                        <button onClick={saveNotes} disabled={savingNotes} style={{ padding: '6px 14px', borderRadius: t.radius.md, border: 'none', backgroundColor: notesSaved ? '#10B981' : t.colors.primary, color: '#fff', fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans, transition: 'background 0.2s' }}>
                          {notesSaved ? '✓ Saved' : savingNotes ? 'Saving...' : 'Save notes'}
                        </button>
                      </div>
                      <textarea
                        style={{ width: '100%', padding: '12px', borderRadius: t.radius.md, border: `1px solid ${notesDirty ? t.colors.border : t.colors.borderLight}`, fontSize: t.fontSizes.base, color: t.colors.textPrimary, outline: 'none', resize: 'vertical', fontFamily: t.fonts.sans, lineHeight: '1.6', boxSizing: 'border-box', backgroundColor: t.colors.bg }}
                        rows={5}
                        placeholder="Internal notes about this project..."
                        value={notes}
                        onChange={e => { setNotes(e.target.value); setNotesDirty(true) }}
                        onBlur={saveNotes}
                      />
                      <div style={{ marginTop: '6px', fontSize: t.fontSizes.xs, color: notesDirty ? '#F59E0B' : t.colors.textTertiary }}>
                        {savingNotes ? 'Saving...' : notesDirty ? '● Unsaved changes' : notesLastSaved ? `✓ Saved ${notesLastSaved.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : 'Notes are saved automatically when you click away'}
                      </div>
                    </div>
                  </div>
                )

                if (key === 'documents') return (
                  <div {...wrapperProps}>
                    <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.borderLight}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {grip}
                          <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: 0 }}>Documents</h3>
                        </div>
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
                  </div>
                )

                return null
              })}
            </div>
          )}

          {/* ── Event Planning tab ── */}
          {activeTab === 'event' && hasEventFeatures && (
            <>
              {/* Concept — collapsible */}
              <div style={{ marginBottom: '28px' }}>
                <button
                  onClick={() => setConceptOpen(o => !o)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', background: 'none', border: 'none', padding: '0 0 16px', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ fontSize: t.fontSizes.xs, fontWeight: '700', color: '#7C5CBF', textTransform: 'uppercase', letterSpacing: '0.12em' }}>💡 Concept</span>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#7C5CBF', opacity: 0.2 }} />
                  <span style={{ fontSize: '11px', color: '#7C5CBF', opacity: 0.7, fontWeight: '600', flexShrink: 0 }}>{conceptOpen ? '▲ Collapse' : '▼ Expand'}</span>
                </button>
                {conceptOpen && (
                  <ConceptForm
                    event={data}
                    onSave={concept_data => setData(prev => ({ ...prev, concept_data }))}
                  />
                )}
              </div>

              {/* Operations divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ height: '1px', width: '24px', backgroundColor: t.colors.textTertiary, opacity: 0.4 }} />
                <span style={{ fontSize: t.fontSizes.xs, fontWeight: '700', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>Operations</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: t.colors.textTertiary, opacity: 0.2 }} />
              </div>

              <RunOfShow
                eventId={record.id}
                eventTitle={data.title}
                eventDate={data.event_date || data.start_date}
                venue={data.venue}
                workspaceId={workspaceId}
              />
              <Staffing eventId={record.id} workspaceId={workspaceId} />
            </>
          )}
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
  statusSelect: {
    padding: '3px 24px 3px 10px',
    borderRadius: t.radius.full,
    fontSize: t.fontSizes.sm,
    fontWeight: '500',
    flexShrink: 0,
    border: 'none',
    outline: 'none',
    cursor: 'pointer',
    fontFamily: t.fonts.sans,
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' viewBox=\'0 0 10 6\'><path d=\'M1 1l4 4 4-4\' stroke=\'%23888\' stroke-width=\'1.5\' fill=\'none\'/></svg>")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
  },
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
