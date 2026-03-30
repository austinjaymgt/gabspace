import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Tasks() {
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
    fetchTasks()
    fetchProjects()
    fetchEvents()
  }, [])

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
    const { error } = await supabase.from('tasks').insert({
      title: form.title,
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

  const statusColors = {
    todo: { bg: '#f5f5f0', color: '#888' },
    'in-progress': { bg: '#fff8f0', color: '#cc7700' },
    done: { bg: '#f0faf6', color: '#1D9E75' },
  }

  const filteredTasks = tasks.filter(t => {
    if (filter === 'all') return true
    if (filter === 'todo') return t.status === 'todo'
    if (filter === 'in-progress') return t.status === 'in-progress'
    if (filter === 'done') return t.status === 'done'
    return true
  })

  const todoCount = tasks.filter(t => t.status === 'todo').length
  const inProgressCount = tasks.filter(t => t.status === 'in-progress').length
  const doneCount = tasks.filter(t => t.status === 'done').length

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Tasks</h2>
          <p style={styles.subtitle}>{tasks.length} total tasks</p>
        </div>
        <button onClick={() => setShowForm(true)} style={styles.addBtn}>
          + Add Task
        </button>
      </div>

      <div style={styles.summaryRow}>
        <div style={styles.summaryCard} onClick={() => setFilter('todo')}>
          <div style={styles.summaryLabel}>To do</div>
          <div style={{ ...styles.summaryValue, color: '#888' }}>{todoCount}</div>
        </div>
        <div style={styles.summaryCard} onClick={() => setFilter('in-progress')}>
          <div style={styles.summaryLabel}>In progress</div>
          <div style={{ ...styles.summaryValue, color: '#cc7700' }}>{inProgressCount}</div>
        </div>
        <div style={styles.summaryCard} onClick={() => setFilter('done')}>
          <div style={styles.summaryLabel}>Done</div>
          <div style={{ ...styles.summaryValue, color: '#1D9E75' }}>{doneCount}</div>
        </div>
      </div>

      <div style={styles.filters}>
        {['all', 'todo', 'in-progress', 'done'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              ...styles.filterBtn,
              ...(filter === f ? styles.filterBtnActive : {})
            }}
          >
            {f === 'all' ? 'All' : f === 'in-progress' ? 'In progress' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>New Task</h3>
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
              {saving ? 'Saving...' : 'Save Task'}
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
            {filter === 'all' ? 'No tasks yet' : `No ${filter} tasks`}
          </h3>
          <p style={styles.emptyText}>
            {filter === 'all' ? 'Add your first task to get started' : 'Try a different filter'}
          </p>
          {filter === 'all' && (
            <button onClick={() => setShowForm(true)} style={styles.addBtn}>
              + Add Task
            </button>
          )}
        </div>
      ) : (
        <div style={styles.taskList}>
          {filteredTasks.map(task => {
            const sc = statusColors[task.status] || statusColors.todo
            return (
              <div key={task.id} style={styles.taskRow}>
                <button
                  onClick={() => toggleStatus(task)}
                  style={{
                    ...styles.checkbox,
                    backgroundColor: task.status === 'done' ? '#1D9E75' : '#fff',
                    borderColor: task.status === 'done' ? '#1D9E75' : '#ddd',
                  }}
                >
                  {task.status === 'done' && <span style={styles.checkmark}>✓</span>}
                </button>
                <div style={styles.taskContent}>
                  <div style={{
                    ...styles.taskTitle,
                    textDecoration: task.status === 'done' ? 'line-through' : 'none',
                    color: task.status === 'done' ? '#bbb' : '#1a1a1a',
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
                  {task.status === 'in-progress' ? 'In progress' : task.status}
                </div>
                <button
                  onClick={() => handleDelete(task.id)}
                  style={styles.deleteBtn}
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
  summaryRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    marginBottom: '20px',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px 24px',
    border: '1px solid #f0f0eb',
    cursor: 'pointer',
  },
  summaryLabel: { fontSize: '12px', color: '#999', marginBottom: '6px' },
  summaryValue: { fontSize: '28px', fontWeight: '700', color: '#1a1a1a' },
  filters: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
  },
  filterBtn: {
    padding: '7px 14px',
    borderRadius: '20px',
    border: '1px solid #e0e0e0',
    backgroundColor: '#fff',
    color: '#666',
    fontSize: '13px',
    cursor: 'pointer',
  },
  filterBtnActive: {
    backgroundColor: '#1D9E75',
    borderColor: '#1D9E75',
    color: '#fff',
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
  taskList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  taskRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    backgroundColor: '#fff',
    borderRadius: '10px',
    padding: '14px 16px',
    border: '1px solid #f0f0eb',
  },
  checkbox: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    border: '2px solid #ddd',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkmark: {
    color: '#fff',
    fontSize: '12px',
    fontWeight: '700',
  },
  taskContent: { flex: 1 },
  taskTitle: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: '4px',
  },
  taskMeta: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  metaTag: {
    fontSize: '11px',
    color: '#999',
  },
  statusBadge: {
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '500',
    flexShrink: 0,
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: '#ddd',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '4px',
    flexShrink: 0,
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
}