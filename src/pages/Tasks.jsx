import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

const statusConfig = {
  'todo':        { bg: t.colors.bg,           color: t.colors.textTertiary, label: 'To do' },
  'in-progress': { bg: t.colors.warningLight, color: t.colors.warning,      label: 'In progress' },
  'done':        { bg: t.colors.successLight, color: t.colors.success,      label: 'Done' },
}

export default function Tasks({ workspaceId }) {
    const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({
    title: '',
    project_id: '',
    event_id: '',
    status: 'todo',
    due_date: '',
    assigned_to: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
  loadWorkspace()
  fetchTasks()
  fetchProjects()
  fetchEvents()
}, [])

async function loadWorkspace() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data, error } = await supabase
    .from('user_profiles')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) {
    console.error('Could not load workspace:', error)
    return
  }
  if (data) setWorkspaceId(data.workspace_id)
}

  async function fetchTasks() {
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*, projects(title), events(name)')
    if (!error) setTasks(data)
    setLoading(false)
  }

  async function fetchProjects() {
    const { data } = await supabase.from('projects').select('id, title')
    if (data) setProjects(data)
  }

  async function fetchEvents() {
    const { data } = await supabase.from('events').select('id, name')
    if (data) setEvents(data)
  }

  async function handleSave() {
  setSaving(true)
  setError(null)

  if (!workspaceId) {
    setError('Workspace not loaded yet. Please try again.')
    setSaving(false)
    return
  }

  const { error } = await supabase.from('tasks').insert({
    title: form.title,
    workspace_id: workspaceId,
    project_id: form.project_id || null,
    event_id: form.event_id || null,
    status: form.status,
    due_date: form.due_date || null,
    assigned_to: form.assigned_to || null,
  })
  if (error) setError(error.message)
  else {
    setShowForm(false)
    setForm({ title: '', project_id: '', event_id: '', status: 'todo', due_date: '', assigned_to: '' })
    fetchTasks()
  }
  setSaving(false)
}

  async function toggleStatus(task) {
    const nextStatus = task.status === 'todo' ? 'done' : 'todo'
    await supabase.from('tasks').update({ status: nextStatus }).eq('id', task.id)
    fetchTasks()
  }

  async function handleDelete(id) {
    await supabase.from('tasks').delete().eq('id', id)
    fetchTasks()
  }

  const filteredTasks = tasks.filter(t => {
    if (filter === 'all') return true
    return t.status === filter
  })

  const todoCount = tasks.filter(t => t.status === 'todo').length
  const inProgressCount = tasks.filter(t => t.status === 'in-progress').length
  const doneCount = tasks.filter(t => t.status === 'done').length

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Tasks</h2>
          <p style={styles.subtitle}>{tasks.length} total task{tasks.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(true)} style={styles.addBtn}>
          + Add task
        </button>
      </div>

      <div style={styles.summaryRow}>
        <div style={styles.summaryCard} onClick={() => setFilter('todo')}>
          <div style={styles.summaryLabel}>To do</div>
          <div style={{ ...styles.summaryValue, color: t.colors.textTertiary }}>{todoCount}</div>
        </div>
        <div style={styles.summaryCard} onClick={() => setFilter('in-progress')}>
          <div style={styles.summaryLabel}>In progress</div>
          <div style={{ ...styles.summaryValue, color: t.colors.warning }}>{inProgressCount}</div>
        </div>
        <div style={styles.summaryCard} onClick={() => setFilter('done')}>
          <div style={styles.summaryLabel}>Done</div>
          <div style={{ ...styles.summaryValue, color: t.colors.success }}>{doneCount}</div>
        </div>
      </div>

      <div style={styles.filters}>
        {['all', 'todo', 'in-progress', 'done'].map(f => {
          const isActive = filter === f
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                ...styles.filterBtn,
                ...(isActive ? styles.filterBtnActive : {})
              }}
            >
              {f === 'all' ? 'All' : f === 'in-progress' ? 'In progress' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          )
        })}
      </div>

      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>New task</h3>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.formGrid}>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Task title *</label>
              <input
                style={styles.input}
                placeholder="e.g. Confirm catering order"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
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
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Event</label>
              <select
                style={styles.input}
                value={form.event_id}
                onChange={e => setForm({ ...form, event_id: e.target.value })}
              >
                <option value="">No event</option>
                {events.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
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
                <option value="todo">To do</option>
                <option value="in-progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Due date</label>
              <input
                style={styles.input}
                type="date"
                value={form.due_date}
                onChange={e => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Assigned to</label>
              <input
                style={styles.input}
                placeholder="Name or email"
                value={form.assigned_to}
                onChange={e => setForm({ ...form, assigned_to: e.target.value })}
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
              disabled={saving || !form.title}
            >
              {saving ? 'Saving...' : 'Save task'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.empty}>Loading tasks...</div>
      ) : filteredTasks.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>✅</div>
          <h3 style={styles.emptyTitle}>
            {filter === 'all' ? 'No tasks yet' : `No ${filter === 'in-progress' ? 'in-progress' : filter} tasks`}
          </h3>
          <p style={styles.emptyText}>
            {filter === 'all' ? 'Add your first task to get started' : 'Try a different filter'}
          </p>
          {filter === 'all' && (
            <button onClick={() => setShowForm(true)} style={styles.addBtn}>
              + Add task
            </button>
          )}
        </div>
      ) : (
        <div style={styles.taskList}>
          {filteredTasks.map(task => {
            const sc = statusConfig[task.status] || statusConfig.todo
            const isDone = task.status === 'done'
            return (
              <div key={task.id} style={styles.taskRow}>
                <button
                  onClick={() => toggleStatus(task)}
                  style={{
                    ...styles.checkbox,
                    backgroundColor: isDone ? t.colors.success : t.colors.bgCard,
                    borderColor: isDone ? t.colors.success : t.colors.border,
                  }}
                >
                  {isDone && <span style={styles.checkmark}>✓</span>}
                </button>
                <div style={styles.taskContent}>
                  <div style={{
                    ...styles.taskTitle,
                    textDecoration: isDone ? 'line-through' : 'none',
                    color: isDone ? t.colors.textTertiary : t.colors.textPrimary,
                  }}>
                    {task.title}
                  </div>
                  <div style={styles.taskMeta}>
                    {task.projects && (
                      <span style={styles.metaTag}>📋 {task.projects.title}</span>
                    )}
                    {task.events && (
                      <span style={styles.metaTag}>📅 {task.events.name}</span>
                    )}
                    {task.due_date && (
                      <span style={styles.metaTag}>
                        🗓 {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                    {task.assigned_to && (
                      <span style={styles.metaTag}>👤 {task.assigned_to}</span>
                    )}
                  </div>
                </div>
                <div style={{ ...styles.statusBadge, backgroundColor: sc.bg, color: sc.color }}>
                  {sc.label}
                </div>
                <button
                  onClick={() => handleDelete(task.id)}
                  style={styles.deleteBtn}
                  title="Delete task"
                >
                  ✕
                </button>
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
  },
  title: {
    fontSize: '22px',
    fontWeight: '800',
    color: t.colors.textPrimary,
    margin: 0,
    fontFamily: t.fonts.heading,
    letterSpacing: '-0.02em',
  },
  subtitle: { fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '4px 0 0' },
  addBtn: {
    padding: '10px 18px',
    borderRadius: t.radius.md,
    border: 'none',
    backgroundColor: t.colors.primary,
    color: '#fff',
    fontSize: t.fontSizes.base,
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: t.fonts.sans,
  },
  summaryRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    marginBottom: '20px',
  },
  summaryCard: {
    backgroundColor: t.colors.bgCard,
    borderRadius: t.radius.lg,
    padding: '20px 24px',
    border: `1px solid ${t.colors.border}`,
    cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  summaryLabel: { fontSize: t.fontSizes.sm, color: t.colors.textTertiary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '500' },
  summaryValue: { fontSize: '28px', fontWeight: '800', color: t.colors.textPrimary, fontFamily: t.fonts.heading, letterSpacing: '-0.02em' },
  filters: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  filterBtn: {
    padding: '7px 14px',
    borderRadius: t.radius.full,
    border: `1px solid ${t.colors.border}`,
    backgroundColor: t.colors.bgCard,
    color: t.colors.textSecondary,
    fontSize: t.fontSizes.sm,
    cursor: 'pointer',
    fontFamily: t.fonts.sans,
    transition: 'all 0.15s',
  },
  filterBtnActive: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
    color: '#fff',
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: t.colors.bgCard,
    borderRadius: t.radius.lg,
    padding: '24px',
    border: `1px solid ${t.colors.border}`,
    marginBottom: '24px',
  },
  formTitle: { fontSize: t.fontSizes.lg, fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 20px', fontFamily: t.fonts.heading, letterSpacing: '-0.01em' },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '20px',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary },
  input: {
    padding: '9px 12px',
    borderRadius: t.radius.md,
    border: `1px solid ${t.colors.border}`,
    fontSize: t.fontSizes.base,
    color: t.colors.textPrimary,
    outline: 'none',
    backgroundColor: t.colors.bgCard,
    fontFamily: t.fonts.sans,
  },
  formActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  cancelBtn: {
    padding: '9px 16px',
    borderRadius: t.radius.md,
    border: `1px solid ${t.colors.border}`,
    backgroundColor: t.colors.bgCard,
    color: t.colors.textSecondary,
    fontSize: t.fontSizes.base,
    cursor: 'pointer',
    fontFamily: t.fonts.sans,
  },
  saveBtn: {
    padding: '9px 16px',
    borderRadius: t.radius.md,
    border: 'none',
    backgroundColor: t.colors.primary,
    color: '#fff',
    fontSize: t.fontSizes.base,
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: t.fonts.sans,
  },
  error: {
    padding: '10px 14px',
    borderRadius: t.radius.md,
    backgroundColor: t.colors.dangerLight,
    color: t.colors.danger,
    fontSize: t.fontSizes.base,
    marginBottom: '16px',
  },
  taskList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  taskRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    backgroundColor: t.colors.bgCard,
    borderRadius: t.radius.md,
    padding: '14px 16px',
    border: `1px solid ${t.colors.border}`,
    transition: 'border-color 0.15s',
  },
  checkbox: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    border: `2px solid ${t.colors.border}`,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.15s',
  },
  checkmark: {
    color: '#fff',
    fontSize: t.fontSizes.sm,
    fontWeight: '700',
  },
  taskContent: { flex: 1, minWidth: 0 },
  taskTitle: {
    fontSize: t.fontSizes.md,
    fontWeight: '500',
    color: t.colors.textPrimary,
    marginBottom: '4px',
  },
  taskMeta: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  metaTag: {
    fontSize: t.fontSizes.xs,
    color: t.colors.textTertiary,
  },
  statusBadge: {
    padding: '3px 10px',
    borderRadius: t.radius.full,
    fontSize: t.fontSizes.sm,
    fontWeight: '500',
    flexShrink: 0,
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: t.colors.textTertiary,
    fontSize: t.fontSizes.md,
    cursor: 'pointer',
    padding: '4px 8px',
    flexShrink: 0,
    borderRadius: t.radius.sm,
    fontFamily: t.fonts.sans,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
    backgroundColor: t.colors.bgCard,
    borderRadius: t.radius.lg,
    border: `1px solid ${t.colors.border}`,
  },
  emptyIcon: { fontSize: '40px', marginBottom: '16px' },
  emptyTitle: { fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px', fontFamily: t.fonts.heading },
  emptyText: { fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '0 0 24px' },
  empty: { fontSize: t.fontSizes.base, color: t.colors.textTertiary, padding: '40px', textAlign: 'center' },
}