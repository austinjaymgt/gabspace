import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t, taskStatusConfig as statusConfig } from '../theme'

const sortOptions = [
  { value: 'default',      label: 'Sort: manual' },
  { value: 'due-asc',      label: 'Due date · soonest' },
  { value: 'due-desc',     label: 'Due date · latest' },
  { value: 'start-asc',    label: 'Start date · soonest' },
  { value: 'created-desc', label: 'Recently added' },
  { value: 'title-asc',    label: 'Title · A–Z' },
]

// Date strings ('YYYY-MM-DD' or ISO) sort correctly as plain string compares.
// Missing dates always fall to the bottom regardless of direction.
function dateCompare(av, bv, dir) {
  if (!av && !bv) return 0
  if (!av) return 1
  if (!bv) return -1
  return av < bv ? -dir : av > bv ? dir : 0
}

function compareTasks(a, b, sortBy) {
  switch (sortBy) {
    case 'due-asc':      return dateCompare(a.due_date, b.due_date, 1)
    case 'due-desc':     return dateCompare(a.due_date, b.due_date, -1)
    case 'start-asc':    return dateCompare(a.start_date, b.start_date, 1)
    case 'created-desc': return dateCompare(a.created_at, b.created_at, -1)
    case 'title-asc':    return (a.title || '').localeCompare(b.title || '')
    default:             return 0
  }
}

export default function Tasks({ businessSpaceId }) {
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('default')
  const [showCompleted, setShowCompleted] = useState(false)
  const [form, setForm] = useState({
    title: '',
    project_id: '',
    status: 'todo',
    start_date: '',
    due_date: '',
    assigned_to: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!businessSpaceId) return
    fetchTasks()
    fetchProjects()
  }, [businessSpaceId])

  async function fetchTasks() {
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*, projects(title)')
      .eq('business_space_id', businessSpaceId)
    if (!error) setTasks(data)
    setLoading(false)
  }

  async function fetchProjects() {
    const { data } = await supabase
      .from('projects')
      .select('id, title')
      .eq('business_space_id', businessSpaceId)
    if (data) setProjects(data)
  }

  function openCreate() {
    setEditingId(null)
    setForm({ title: '', project_id: '', status: 'todo', start_date: '', due_date: '', assigned_to: '' })
    setError(null)
    setShowForm(true)
  }

  function openEdit(task) {
    setEditingId(task.id)
    setForm({
      title: task.title || '',
      project_id: task.project_id || '',
      status: task.status || 'todo',
      start_date: task.start_date ? task.start_date.slice(0, 10) : '',
      due_date: task.due_date ? task.due_date.slice(0, 10) : '',
      assigned_to: task.assigned_to || '',
    })
    setError(null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({ title: '', project_id: '', status: 'todo', start_date: '', due_date: '', assigned_to: '' })
    setError(null)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    if (!businessSpaceId) {
      setError('Workspace not loaded yet. Please try again.')
      setSaving(false)
      return
    }

    const payload = {
      title: form.title,
      business_space_id: businessSpaceId,
      project_id: form.project_id || null,
      status: form.status,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
      assigned_to: form.assigned_to || null,
    }

    const { error } = editingId
      ? await supabase.from('tasks').update(payload).eq('id', editingId)
      : await supabase.from('tasks').insert(payload)

    if (error) setError(error.message)
    else {
      closeForm()
      fetchTasks()
    }
    setSaving(false)
  }

  async function toggleStatus(task) {
    const nextStatus = task.status === 'todo' ? 'done' : 'todo'
    await updateStatus(task, nextStatus)
  }

  async function updateStatus(task, nextStatus) {
    setTasks(prev => prev.map(tk => tk.id === task.id ? { ...tk, status: nextStatus } : tk))
    const { error } = await supabase.from('tasks').update({ status: nextStatus }).eq('id', task.id)
    if (error) fetchTasks()
  }

  async function handleDelete(id) {
    await supabase.from('tasks').delete().eq('id', id)
    fetchTasks()
  }

  const visibleTasks = tasks
    .filter(task => (filter === 'all' ? true : task.status === filter))
    .sort((a, b) => compareTasks(a, b, sortBy))

  const activeTasks = visibleTasks.filter(task => task.status !== 'done')
  const completedTasks = visibleTasks.filter(task => task.status === 'done')
  const completedOpen = showCompleted || filter === 'done'

  const todoCount = tasks.filter(task => task.status === 'todo').length
  const inProgressCount = tasks.filter(task => task.status === 'in-progress').length
  const doneCount = tasks.filter(task => task.status === 'done').length

  function renderTaskRow(task) {
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
            {task.start_date && (
              <span style={styles.metaTag}>🗓 Starts {new Date(task.start_date).toLocaleDateString()}</span>
            )}
            {task.due_date && (
              <span style={styles.metaTag}>🗓 Due {new Date(task.due_date).toLocaleDateString()}</span>
            )}
            {task.assigned_to && (
              <span style={styles.metaTag}>👤 {task.assigned_to}</span>
            )}
          </div>
        </div>
        <select
          value={task.status}
          onChange={e => updateStatus(task, e.target.value)}
          onClick={e => e.stopPropagation()}
          className="status-select"
          style={{ ...styles.statusBadge, '--status-bg': sc.bg, '--status-color': sc.color }}
          title="Change status"
        >
          <option value="todo">To do</option>
          <option value="in-progress">In progress</option>
          <option value="done">Done</option>
        </select>
        <button
          onClick={() => openEdit(task)}
          style={styles.editBtn}
          title="Edit task"
        >
          ✎
        </button>
        <button
          onClick={() => handleDelete(task.id)}
          style={styles.deleteBtn}
          title="Delete task"
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={{ fontSize: t.fontSizes.xs, fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.primary, marginBottom: '6px' }}>Client Management</div>
          <h2 style={styles.title}>Tasks</h2>
          <p style={styles.subtitle}>{tasks.length} total task{tasks.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openCreate} style={styles.addBtn}>
          + Add task
        </button>
      </div>

      <div style={styles.summaryRow}>
        <div style={styles.summaryCard} onClick={() => setFilter('todo')}>
          <div style={styles.summaryLabel}>To do</div>
          <div style={{ ...styles.summaryValue, color: statusConfig.todo.color }}>{todoCount}</div>
        </div>
        <div style={styles.summaryCard} onClick={() => setFilter('in-progress')}>
          <div style={styles.summaryLabel}>In progress</div>
          <div style={{ ...styles.summaryValue, color: statusConfig['in-progress'].color }}>{inProgressCount}</div>
        </div>
        <div style={styles.summaryCard} onClick={() => setFilter('done')}>
          <div style={styles.summaryLabel}>Done</div>
          <div style={{ ...styles.summaryValue, color: statusConfig.done.color }}>{doneCount}</div>
        </div>
      </div>

      <div style={styles.toolbar}>
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
        <select
          style={styles.sortSelect}
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          {sortOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>{editingId ? 'Edit task' : 'New task'}</h3>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.formGrid}>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Task title *</label>
              <input
                style={styles.input}
                placeholder="e.g. Send client proofs"
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
              <label style={styles.label}>Start date</label>
              <input
                style={styles.input}
                type="date"
                value={form.start_date}
                onChange={e => setForm({ ...form, start_date: e.target.value })}
              />
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
              onClick={closeForm}
              style={styles.cancelBtn}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={styles.saveBtn}
              disabled={saving || !form.title}
            >
              {saving ? 'Saving...' : editingId ? 'Save changes' : 'Save task'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.empty}>Loading tasks...</div>
      ) : visibleTasks.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>✅</div>
          <h3 style={styles.emptyTitle}>
            {filter === 'all' ? 'No tasks yet' : `No ${filter === 'in-progress' ? 'in-progress' : filter} tasks`}
          </h3>
          <p style={styles.emptyText}>
            {filter === 'all' ? 'Add your first task to start crossing things off your list' : 'Try a different filter'}
          </p>
          {filter === 'all' && (
            <button onClick={openCreate} style={styles.addBtn}>
              + Add task
            </button>
          )}
        </div>
      ) : (
        <>
          {activeTasks.length > 0 && (
            <div style={styles.taskList}>
              {activeTasks.map(renderTaskRow)}
            </div>
          )}

          {completedTasks.length > 0 && (
            <div style={styles.completedSection}>
              <button
                style={styles.completedHeader}
                onClick={() => setShowCompleted(s => !s)}
              >
                <span style={styles.completedChevron}>{completedOpen ? '▾' : '▸'}</span>
                Completed
                <span style={styles.completedCount}>{completedTasks.length}</span>
              </button>
              {completedOpen && (
                <div style={styles.taskList}>
                  {completedTasks.map(renderTaskRow)}
                </div>
              )}
            </div>
          )}
        </>
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
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
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
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  filters: {
    display: 'flex',
    gap: '8px',
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
  sortSelect: {
    padding: '7px 12px',
    borderRadius: t.radius.md,
    border: `1px solid ${t.colors.border}`,
    backgroundColor: t.colors.bgCard,
    color: t.colors.textSecondary,
    fontSize: t.fontSizes.sm,
    cursor: 'pointer',
    fontFamily: t.fonts.sans,
    outline: 'none',
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
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
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
  editBtn: {
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
  completedSection: {
    marginTop: '20px',
  },
  completedHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    background: 'none',
    border: 'none',
    padding: '8px 4px',
    marginBottom: '8px',
    cursor: 'pointer',
    fontFamily: t.fonts.sans,
    fontSize: t.fontSizes.sm,
    fontWeight: '600',
    color: t.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  completedChevron: {
    fontSize: t.fontSizes.sm,
    color: t.colors.textTertiary,
  },
  completedCount: {
    fontSize: t.fontSizes.xs,
    fontWeight: '500',
    color: t.colors.textTertiary,
    backgroundColor: t.colors.bg,
    borderRadius: t.radius.full,
    padding: '2px 8px',
    textTransform: 'none',
    letterSpacing: 'normal',
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