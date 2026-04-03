import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

const statusSteps = ['planning', 'active', 'on-hold', 'completed']

const statusColors = {
  planning: { bg: '#FEF3C7', color: '#92400E', border: '#F59E0B' },
  active: { bg: '#f0faf6', color: '#1D9E75', border: '#1D9E75' },
  'on-hold': { bg: '#fff8f0', color: '#cc7700', border: '#F59E0B' },
  completed: { bg: '#f0f4ff', color: '#4466cc', border: '#4466cc' },
  cancelled: { bg: '#fff0f0', color: '#cc3333', border: '#cc3333' },
}

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [sortBy, setSortBy] = useState('created_at')
  const [filterStatus, setFilterStatus] = useState('all')
  const [form, setForm] = useState({
    title: '', client_id: '', status: 'planning',
    type: '', start_date: '', end_date: '', budget: '',
    description: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchProjects()
    fetchClients()
  }, [])

  async function fetchProjects() {
    setLoading(true)
    const { data } = await supabase
      .from('projects')
      .select('*, clients(name, company)')
      .order('created_at', { ascending: false })
    if (data) setProjects(data)
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
    const { error } = await supabase.from('projects').insert({
      title: form.title,
      client_id: form.client_id || null,
      status: form.status,
      type: form.type || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      budget: form.budget ? parseFloat(form.budget) : null,
      description: form.description || null,
      user_id: user.id,
    })
    if (error) setError(error.message)
    else {
      setShowForm(false)
      setForm({ title: '', client_id: '', status: 'planning', type: '', start_date: '', end_date: '', budget: '', description: '' })
      fetchProjects()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this project?')) return
    await supabase.from('projects').delete().eq('id', id)
    fetchProjects()
    setSelectedProject(null)
  }

  const filteredProjects = projects
    .filter(p => filterStatus === 'all' || p.status === filterStatus)
    .sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title)
      if (sortBy === 'budget') return (parseFloat(b.budget) || 0) - (parseFloat(a.budget) || 0)
      if (sortBy === 'status') return a.status.localeCompare(b.status)
      return new Date(b.created_at) - new Date(a.created_at)
    })

  if (selectedProject) {
    return (
      <ProjectDetail
        project={selectedProject}
        onBack={() => { setSelectedProject(null); fetchProjects() }}
        onDelete={handleDelete}
        clients={clients}
      />
    )
  }

  return (
    <div style={{ padding: '32px', fontFamily: t.fonts.sans }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: 0 }}>Projects</h2>
          <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '4px 0 0' }}>
            {filteredProjects.length} of {projects.length} projects
          </p>
        </div>
        <button onClick={() => setShowForm(true)} style={styles.addBtn}>
          + Add Project
        </button>
      </div>

      {/* Filters and sort */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {['all', 'planning', 'active', 'on-hold', 'completed', 'cancelled'].map(status => (
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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>Sort by</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: t.radius.md,
              border: `1px solid ${t.colors.borderLight}`,
              fontSize: t.fontSizes.sm,
              color: t.colors.textSecondary,
              outline: 'none',
              backgroundColor: '#fff',
              fontFamily: t.fonts.sans,
            }}
          >
            <option value="created_at">Date added</option>
            <option value="title">Name</option>
            <option value="budget">Budget</option>
            <option value="status">Status</option>
          </select>
        </div>
      </div>

      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>New Project</h3>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.formGrid}>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Project title *</label>
              <input
                style={styles.input}
                placeholder="e.g. Brooklen Wedding 2026"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Client</label>
              <select style={styles.input} value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}>
                <option value="">No client</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>
                ))}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Type</label>
              <input style={styles.input} placeholder="e.g. Wedding, Corporate" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Status</label>
              <select style={styles.input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on-hold">On hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Budget ($)</label>
              <input style={styles.input} type="number" placeholder="0.00" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Start date</label>
              <input style={styles.input} type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>End date</label>
              <input style={styles.input} type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
            </div>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Description</label>
              <textarea
                style={{ ...styles.input, resize: 'vertical', fontFamily: t.fonts.sans }}
                rows={2}
                placeholder="Brief project description..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <div style={styles.formActions}>
            <button onClick={() => { setShowForm(false); setError(null) }} style={styles.cancelBtn}>Cancel</button>
            <button onClick={handleSave} style={styles.saveBtn} disabled={saving || !form.title}>
              {saving ? 'Saving...' : 'Save Project'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.empty}>Loading projects...</div>
      ) : filteredProjects.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>📋</div>
          <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px' }}>
            {filterStatus === 'all' ? 'No projects yet' : `No ${filterStatus} projects`}
          </h3>
          <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '0 0 24px' }}>
            {filterStatus === 'all' ? 'Add your first project to get started' : 'Try a different filter'}
          </p>
          {filterStatus === 'all' && (
            <button onClick={() => setShowForm(true)} style={styles.addBtn}>+ Add Project</button>
          )}
        </div>
      ) : (
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span>Project</span>
            <span>Client</span>
            <span>Type</span>
            <span>Budget</span>
            <span>Timeline</span>
            <span>Status</span>
            <span></span>
          </div>
          {filteredProjects.map(project => {
            const sc = statusColors[project.status] || statusColors.planning
            return (
              <div
                key={project.id}
                style={styles.tableRow}
                onClick={() => setSelectedProject(project)}
              >
                <span style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>
                  {project.title}
                </span>
                <span style={styles.tableCell}>
                  {project.clients ? project.clients.name : '—'}
                </span>
                <span style={styles.tableCell}>{project.type || '—'}</span>
                <span style={styles.tableCell}>
                  {project.budget ? `$${parseFloat(project.budget).toLocaleString()}` : '—'}
                </span>
                <span style={styles.tableCell}>
                  {project.start_date && project.end_date
                    ? `${new Date(project.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → ${new Date(project.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : project.start_date
                      ? new Date(project.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                </span>
                <span>
                  <div style={{
                    display: 'inline-block',
                    padding: '3px 10px',
                    borderRadius: t.radius.full,
                    fontSize: t.fontSizes.xs,
                    fontWeight: '500',
                    backgroundColor: sc.bg,
                    color: sc.color,
                  }}>
                    {project.status}
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

function ProjectDetail({ project, onBack, onDelete, clients }) {
  const [data, setData] = useState(project)
  const [tasks, setTasks] = useState([])
  const [events, setEvents] = useState([])
  const [invoices, setInvoices] = useState([])
  const [expenses, setExpenses] = useState([])
  const [documents, setDocuments] = useState([])
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ ...project })
  const [notes, setNotes] = useState(project.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [budgetItems, setBudgetItems] = useState([])
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [budgetForm, setBudgetForm] = useState({ category: '', projected_amount: '', actual_amount: '', notes: '' })
  const [editingBudgetItem, setEditingBudgetItem] = useState(null)
  const [editBudgetForm, setEditBudgetForm] = useState({ category: '', projected_amount: '', actual_amount: '', notes: '' })
  const [contingency, setContingency] = useState(0)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    const [
      { data: tasksData },
      { data: eventsData },
      { data: invoicesData },
      { data: expensesData },
      { data: docsData },
      { data: budgetData },
      { data: docsData },
    ] = await Promise.all([
      supabase.from('tasks').select('*').eq('project_id', project.id).order('created_at', { ascending: true }),
      supabase.from('events').select('*').eq('project_id', project.id).order('event_date', { ascending: true }),
      supabase.from('invoices').select('*').eq('project_id', project.id),
      supabase.from('expenses').select('*').eq('project_id', project.id),
      supabase.from('project_budget_items').select('*').eq('project_id', project.id).order('created_at', { ascending: true }),
      supabase.from('project_documents').select('*').eq('project_id', project.id).order('created_at', { ascending: false }),
    ])
    setTasks(tasksData || [])
    setEvents(eventsData || [])
    setInvoices(invoicesData || [])
    setExpenses(expensesData || [])
    setBudgetItems(budgetData || [])
    setDocuments(docsData || [])
  }

  async function handleEditSave() {
    const { error } = await supabase
      .from('projects')
      .update({
        title: editForm.title,
        client_id: editForm.client_id || null,
        status: editForm.status,
        type: editForm.type || null,
        start_date: editForm.start_date || null,
        end_date: editForm.end_date || null,
        budget: editForm.budget ? parseFloat(editForm.budget) : null,
        description: editForm.description || null,
      })
      .eq('id', project.id)
    if (!error) {
      setData(prev => ({ ...prev, ...editForm }))
      setEditMode(false)
    }
  }

  async function updateStatus(status) {
    await supabase.from('projects').update({ status }).eq('id', project.id)
    setData(prev => ({ ...prev, status }))
  }

  async function saveNotes() {
    setSavingNotes(true)
    await supabase.from('projects').update({ notes }).eq('id', project.id)
    setSavingNotes(false)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  async function toggleTask(task) {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
  }

  async function addTask() {
    if (!newTaskTitle.trim()) return
    setAddingTask(true)
    const { data } = await supabase.from('tasks').insert({
      title: newTaskTitle,
      project_id: project.id,
      status: 'todo',
    }).select().single()
    if (data) setTasks(prev => [...prev, data])
    setNewTaskTitle('')
    setAddingTask(false)
  }

  async function deleteTask(id) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }
async function addBudgetItem() {
  const { data } = await supabase.from('project_budget_items').insert({
    project_id: project.id,
    category: budgetForm.category,
    projected_amount: budgetForm.projected_amount ? parseFloat(budgetForm.projected_amount) : null,
    actual_amount: budgetForm.actual_amount ? parseFloat(budgetForm.actual_amount) : null,
    notes: budgetForm.notes || null,
  }).select().single()
  if (data) setBudgetItems(prev => [...prev, data])
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
    const fileName = `${project.id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('project-files')
      .upload(fileName, file)
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(fileName)
      await supabase.from('project_documents').insert({
        project_id: project.id,
        user_id: user.id,
        name: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
      })
      fetchAll()
    }
    setUploading(false)
  }

  async function deleteDocument(id, fileUrl) {
    if (!confirm('Delete this document?')) return
    await supabase.from('project_documents').delete().eq('id', id)
    setDocuments(prev => prev.filter(d => d.id !== id))
  }

  const sc = statusColors[data.status] || statusColors.planning
  const totalIncome = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount_paid) || 0), 0)
  const totalExpense = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
  const budget = parseFloat(data.budget) || 0
  const budgetUsed = totalExpense
  const budgetPct = budget > 0 ? Math.min((budgetUsed / budget) * 100, 100) : 0
  const doneTasks = tasks.filter(t => t.status === 'done').length

  return (
    <div style={{ padding: '32px', fontFamily: t.fonts.sans }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={onBack} style={styles.backBtn}>← Back to projects</button>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!editMode && (
            <button onClick={() => setEditMode(true)} style={styles.editBtn}>Edit</button>
          )}
          <button onClick={() => onDelete(project.id)} style={styles.deleteBtn}>Delete</button>
        </div>
      </div>

      {editMode ? (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>Edit Project</h3>
          <div style={styles.formGrid}>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Title *</label>
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
              <label style={styles.label}>Type</label>
              <input style={styles.input} value={editForm.type || ''} onChange={e => setEditForm({ ...editForm, type: e.target.value })} />
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
              <label style={styles.label}>Budget ($)</label>
              <input style={styles.input} type="number" value={editForm.budget || ''} onChange={e => setEditForm({ ...editForm, budget: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Start date</label>
              <input style={styles.input} type="date" value={editForm.start_date || ''} onChange={e => setEditForm({ ...editForm, start_date: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>End date</label>
              <input style={styles.input} type="date" value={editForm.end_date || ''} onChange={e => setEditForm({ ...editForm, end_date: e.target.value })} />
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
          {/* Project header card */}
          <div style={{ backgroundColor: '#fff', borderRadius: t.radius.lg, padding: '28px', border: `1px solid ${t.colors.borderLight}`, marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 4px', letterSpacing: '-0.3px' }}>
                  {data.title}
                </h1>
                {data.clients?.name && (
                  <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: 0 }}>
                    {data.clients.name}{data.type ? ` · ${data.type}` : ''}
                  </p>
                )}
              </div>
              <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: t.radius.full, fontSize: t.fontSizes.sm, fontWeight: '600', backgroundColor: sc.bg, color: sc.color }}>
                {data.status}
              </div>
            </div>

            {data.description && (
              <p style={{ fontSize: t.fontSizes.base, color: t.colors.textSecondary, lineHeight: '1.6', margin: '0 0 20px' }}>
                {data.description}
              </p>
            )}

            {/* Status timeline */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                Status timeline
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {['planning', 'active', 'on-hold', 'completed'].map((step, i) => {
                  const sc = statusColors[step]
                  const isActive = data.status === step
                  const isPast = statusSteps.indexOf(data.status) > i
                  return (
                    <button
                      key={step}
                      onClick={() => updateStatus(step)}
                      style={{
                        flex: 1,
                        padding: '8px 4px',
                        borderRadius: t.radius.md,
                        border: `1px solid ${isActive ? sc.border : t.colors.borderLight}`,
                        backgroundColor: isActive ? sc.bg : isPast ? '#fafaf8' : '#fff',
                        color: isActive ? sc.color : t.colors.textTertiary,
                        fontSize: t.fontSizes.xs,
                        fontWeight: isActive ? '700' : '400',
                        cursor: 'pointer',
                        fontFamily: t.fonts.sans,
                        transition: 'all 0.15s',
                      }}
                    >
                      {step.charAt(0).toUpperCase() + step.slice(1)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Key dates */}
            {(data.start_date || data.end_date) && (
              <div style={{ display: 'flex', gap: '16px' }}>
                {data.start_date && (
                  <div style={{ backgroundColor: t.colors.bg, borderRadius: t.radius.md, padding: '10px 14px' }}>
                    <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', marginBottom: '2px' }}>Start</div>
                    <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>
                      {new Date(data.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                )}
                {data.end_date && (
                  <div style={{ backgroundColor: t.colors.bg, borderRadius: t.radius.md, padding: '10px 14px' }}>
                    <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', marginBottom: '2px' }}>End</div>
                    <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>
                      {new Date(data.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>

            {/* Budget tracker */}
<div style={{ backgroundColor: '#fff', borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.borderLight}` }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
    <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: 0 }}>Budget</h3>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>Contingency</span>
        <select
          value={contingency}
          onChange={e => setContingency(parseInt(e.target.value))}
          style={{ padding: '4px 8px', borderRadius: t.radius.md, border: `1px solid ${t.colors.borderLight}`, fontSize: t.fontSizes.sm, color: t.colors.textSecondary, outline: 'none', backgroundColor: '#fff' }}
        >
          {[0, 5, 10, 15, 20, 25].map(n => (
            <option key={n} value={n}>{n}%</option>
          ))}
        </select>
      </div>
      <button
        onClick={() => setShowBudgetForm(true)}
        style={{ padding: '7px 14px', borderRadius: t.radius.md, border: 'none', backgroundColor: t.colors.primary, color: '#fff', fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer' }}
      >
        + Add category
      </button>
    </div>
  </div>

  {showBudgetForm && (
    <div style={{ backgroundColor: t.colors.bg, borderRadius: t.radius.md, padding: '16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: t.fontSizes.xs, fontWeight: '500', color: t.colors.textTertiary }}>Category *</label>
          <input
            style={{ padding: '8px 10px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, outline: 'none', backgroundColor: '#fff' }}
            placeholder="e.g. Catering, Venue, AV"
            value={budgetForm.category}
            onChange={e => setBudgetForm({ ...budgetForm, category: e.target.value })}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: t.fontSizes.xs, fontWeight: '500', color: t.colors.textTertiary }}>Projected ($)</label>
          <input
            style={{ padding: '8px 10px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, outline: 'none', backgroundColor: '#fff' }}
            type="number"
            placeholder="0.00"
            value={budgetForm.projected_amount}
            onChange={e => setBudgetForm({ ...budgetForm, projected_amount: e.target.value })}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: t.fontSizes.xs, fontWeight: '500', color: t.colors.textTertiary }}>Actual ($)</label>
          <input
            style={{ padding: '8px 10px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, outline: 'none', backgroundColor: '#fff' }}
            type="number"
            placeholder="0.00"
            value={budgetForm.actual_amount}
            onChange={e => setBudgetForm({ ...budgetForm, actual_amount: e.target.value })}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: t.fontSizes.xs, fontWeight: '500', color: t.colors.textTertiary }}>Notes</label>
          <input
            style={{ padding: '8px 10px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, outline: 'none', backgroundColor: '#fff' }}
            placeholder="Optional"
            value={budgetForm.notes}
            onChange={e => setBudgetForm({ ...budgetForm, notes: e.target.value })}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowBudgetForm(false)} style={{ padding: '7px 14px', borderRadius: t.radius.md, border: `1px solid ${t.colors.borderLight}`, backgroundColor: '#fff', color: t.colors.textSecondary, fontSize: t.fontSizes.sm, cursor: 'pointer' }}>Cancel</button>
        <button onClick={addBudgetItem} disabled={!budgetForm.category} style={{ padding: '7px 14px', borderRadius: t.radius.md, border: 'none', backgroundColor: t.colors.primary, color: '#fff', fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer' }}>Add</button>
      </div>
    </div>
  )}

  {budgetItems.length === 0 ? (
    <div style={{ textAlign: 'center', padding: '32px', color: t.colors.textTertiary, fontSize: t.fontSizes.sm }}>
      No budget categories yet — add one to start tracking
    </div>
  ) : (
    <>
      {/* Table header */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.5fr', gap: '8px', padding: '8px 12px', backgroundColor: t.colors.bg, borderRadius: t.radius.md, marginBottom: '8px' }}>
        {['Category', 'Projected', 'Actual', 'Difference', ''].map(h => (
          <span key={h} style={{ fontSize: t.fontSizes.xs, fontWeight: '600', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</span>
        ))}
      </div>

      {/* Budget rows */}
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
                  <input
                    style={{ padding: '5px 8px', borderRadius: t.radius.sm, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, outline: 'none' }}
                    value={editBudgetForm.category}
                    onChange={e => setEditBudgetForm({ ...editBudgetForm, category: e.target.value })}
                  />
                  <input
                    style={{ padding: '5px 8px', borderRadius: t.radius.sm, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, outline: 'none' }}
                    type="number"
                    value={editBudgetForm.projected_amount}
                    onChange={e => setEditBudgetForm({ ...editBudgetForm, projected_amount: e.target.value })}
                  />
                  <input
                    style={{ padding: '5px 8px', borderRadius: t.radius.sm, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, outline: 'none' }}
                    type="number"
                    value={editBudgetForm.actual_amount}
                    onChange={e => setEditBudgetForm({ ...editBudgetForm, actual_amount: e.target.value })}
                  />
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
                  <span style={{ fontSize: t.fontSizes.base, color: t.colors.textSecondary }}>
                    {projected > 0 ? `$${projected.toLocaleString()}` : '—'}
                  </span>
                  <span style={{ fontSize: t.fontSizes.base, color: t.colors.textSecondary }}>
                    {actual > 0 ? `$${actual.toLocaleString()}` : '—'}
                  </span>
                  <span style={{ fontSize: t.fontSizes.base, fontWeight: '600', color: projected === 0 ? t.colors.textTertiary : diff >= 0 ? '#10B981' : '#cc3333' }}>
                    {projected === 0 ? '—' : diff >= 0 ? `+$${diff.toLocaleString()}` : `-$${Math.abs(diff).toLocaleString()}`}
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => { setEditingBudgetItem(item.id); setEditBudgetForm({ category: item.category, projected_amount: item.projected_amount || '', actual_amount: item.actual_amount || '', notes: item.notes || '' }) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: t.colors.textTertiary }}
                    >✏️</button>
                    <button onClick={() => deleteBudgetItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: t.colors.textTertiary }}>✕</button>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary row */}
      <div style={{ borderTop: `2px solid ${t.colors.borderLight}`, paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[
          { label: 'Total projected', value: budgetItems.reduce((sum, i) => sum + (parseFloat(i.projected_amount) || 0), 0), color: t.colors.textPrimary },
          contingency > 0 && { label: `Total + ${contingency}% contingency`, value: budgetItems.reduce((sum, i) => sum + (parseFloat(i.projected_amount) || 0), 0) * (1 + contingency / 100), color: '#F59E0B' },
          { label: 'Total actual', value: budgetItems.reduce((sum, i) => sum + (parseFloat(i.actual_amount) || 0), 0), color: '#cc3333' },
          budget > 0 && { label: 'Overall budget remaining', value: budget - budgetItems.reduce((sum, i) => sum + (parseFloat(i.actual_amount) || 0), 0), color: budget - budgetItems.reduce((sum, i) => sum + (parseFloat(i.actual_amount) || 0), 0) >= 0 ? '#10B981' : '#cc3333' },
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
              <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: 0 }}>
                Tasks
              </h3>
              <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>
                {doneTasks}/{tasks.length} done
              </span>
            </div>

            {tasks.length > 0 && (
              <div style={{ height: '4px', backgroundColor: t.colors.borderLight, borderRadius: '2px', overflow: 'hidden', marginBottom: '16px' }}>
                <div style={{ height: '100%', width: `${tasks.length > 0 ? (doneTasks / tasks.length) * 100 : 0}%`, backgroundColor: t.colors.primary, borderRadius: '2px', transition: 'width 0.3s' }} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {tasks.map(task => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', backgroundColor: t.colors.bg, borderRadius: t.radius.md }}>
                  <button
                    onClick={() => toggleTask(task)}
                    style={{
                      width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${task.status === 'done' ? t.colors.primary : t.colors.border}`,
                      backgroundColor: task.status === 'done' ? t.colors.primary : '#fff',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {task.status === 'done' && <span style={{ color: '#fff', fontSize: '10px', fontWeight: '700' }}>✓</span>}
                  </button>
                  <span style={{
                    flex: 1, fontSize: t.fontSizes.base,
                    color: task.status === 'done' ? t.colors.textTertiary : t.colors.textPrimary,
                    textDecoration: task.status === 'done' ? 'line-through' : 'none',
                  }}>
                    {task.title}
                  </span>
                  {task.due_date && (
                    <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
                      {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', color: t.colors.textTertiary, cursor: 'pointer', fontSize: '12px' }}>✕</button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                style={{ ...styles.input, flex: 1 }}
                placeholder="Add a task..."
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()}
              />
              <button onClick={addTask} disabled={addingTask || !newTaskTitle.trim()} style={styles.saveBtn}>
                Add
              </button>
            </div>
          </div>

          {/* Notes */}
          <div style={{ backgroundColor: '#fff', borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.borderLight}`, marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: 0 }}>Notes</h3>
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                style={{
                  padding: '6px 14px', borderRadius: t.radius.md, border: 'none',
                  backgroundColor: notesSaved ? '#10B981' : t.colors.primary,
                  color: '#fff', fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer',
                  fontFamily: t.fonts.sans, transition: 'background 0.2s',
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
              placeholder="Internal notes about this project..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Documents */}
          <div style={{ backgroundColor: '#fff', borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.borderLight}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: 0 }}>Documents</h3>
              <label style={{
                padding: '8px 14px', borderRadius: t.radius.md, border: 'none',
                backgroundColor: t.colors.primary, color: '#fff', fontSize: t.fontSizes.sm,
                fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans,
              }}>
                {uploading ? 'Uploading...' : '+ Upload file'}
                <input type="file" onChange={uploadDocument} style={{ display: 'none' }} />
              </label>
            </div>
            {documents.length === 0 ? (
              <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary }}>No documents yet — upload contracts, briefs, or any project files</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {documents.map(doc => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', backgroundColor: t.colors.bg, borderRadius: t.radius.md }}>
                    <span style={{ fontSize: '18px' }}>
                      {doc.file_type?.includes('image') ? '🖼️' : doc.file_type?.includes('pdf') ? '📄' : '📁'}
                    </span>
                    <span style={{ flex: 1, fontSize: t.fontSizes.base, color: t.colors.textPrimary, fontWeight: '500' }}>{doc.name}</span>
                    <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
                      {new Date(doc.created_at).toLocaleDateString()}
                    </span>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: t.fontSizes.sm, color: t.colors.primary, fontWeight: '500', textDecoration: 'none' }}>
                      Open
                    </a>
                    <button onClick={() => deleteDocument(doc.id, doc.file_url)} style={{ background: 'none', border: 'none', color: t.colors.textTertiary, cursor: 'pointer', fontSize: '12px' }}>✕</button>
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
  tableHeader: { display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.5fr 1fr 0.3fr', padding: '12px 20px', backgroundColor: '#fafaf8', borderBottom: '1px solid #f0f0eb', fontSize: '12px', fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' },
  tableRow: { display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.5fr 1fr 0.3fr', padding: '14px 20px', borderBottom: '1px solid #f9f9f7', alignItems: 'center', cursor: 'pointer' },
  tableCell: { fontSize: '13px', color: '#666' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #f0f0eb' },
  empty: { fontSize: '13px', color: '#999', padding: '40px', textAlign: 'center' },
  backBtn: { padding: '8px 14px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff', color: '#555', fontSize: '13px', cursor: 'pointer' },
  editBtn: { padding: '8px 14px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff', color: '#555', fontSize: '13px', cursor: 'pointer' },
  deleteBtn: { padding: '8px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#fff0f0', color: '#cc3333', fontSize: '13px', cursor: 'pointer' },
}