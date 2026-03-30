import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [form, setForm] = useState({
    title: '',
    client_id: '',
    status: 'active',
    type: '',
    start_date: '',
    end_date: '',
    budget: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchProjects()
    fetchClients()
  }, [])

  async function fetchProjects() {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('*, clients(name, company)')
      .order('created_at', { ascending: false })
if (!error) setProjects(data)
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
type: form.type || null,
status: form.status,
budget: form.budget ? parseFloat(form.budget) : null,
client_id: form.client_id || null,
start_date: form.start_date || null,
end_date: form.end_date || null,
user_id: user.id,
    })
if (error) { setError(error.message); console.log('Save error:', error) }    else {
      setShowForm(false)
      setForm({ title: '', client_id: '', status: 'active', type: '', start_date: '', end_date: '', budget: '' })
      fetchProjects()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this project?')) return
    await supabase.from('projects').delete().eq('id', id)
    fetchProjects()
    if (selectedProject?.id === id) setSelectedProject(null)
  }

  const statusColors = {
    active: { bg: '#f0faf6', color: '#1D9E75' },
    completed: { bg: '#f0f4ff', color: '#4466cc' },
    'on-hold': { bg: '#fff8f0', color: '#cc7700' },
    cancelled: { bg: '#fff0f0', color: '#cc3333' },
  }

  if (selectedProject) {
    const sc = statusColors[selectedProject.status] || statusColors.active
    return (
      <div style={styles.page}>
        <div style={styles.detailHeader}>
          <button onClick={() => setSelectedProject(null)} style={styles.backBtn}>
            ← Back to projects
          </button>
          <button onClick={() => handleDelete(selectedProject.id)} style={styles.deleteBtn}>
            Delete project
          </button>
        </div>
        <div style={styles.detailCard}>
          <div style={styles.detailTop}>
            <div>
              <h2 style={styles.detailName}>{selectedProject.title}</h2>
              {selectedProject.clients && (
                <p style={styles.detailClient}>
                  {selectedProject.clients.name}
                  {selectedProject.clients.company ? ` · ${selectedProject.clients.company}` : ''}
                </p>
              )}
            </div>
            <div style={{ ...styles.statusBadge, backgroundColor: sc.bg, color: sc.color }}>
              {selectedProject.status}
            </div>
          </div>
          <div style={styles.detailGrid}>
            {selectedProject.type && (
              <div style={styles.detailField}>
                <div style={styles.detailFieldLabel}>Type</div>
                <div style={styles.detailFieldValue}>{selectedProject.type}</div>
              </div>
            )}
            {selectedProject.budget && (
              <div style={styles.detailField}>
                <div style={styles.detailFieldLabel}>Budget</div>
                <div style={styles.detailFieldValue}>${parseFloat(selectedProject.budget).toLocaleString()}</div>
              </div>
            )}
            {selectedProject.start_date && (
              <div style={styles.detailField}>
                <div style={styles.detailFieldLabel}>Start date</div>
                <div style={styles.detailFieldValue}>{new Date(selectedProject.start_date).toLocaleDateString()}</div>
              </div>
            )}
            {selectedProject.end_date && (
              <div style={styles.detailField}>
                <div style={styles.detailFieldLabel}>End date</div>
                <div style={styles.detailFieldValue}>{new Date(selectedProject.end_date).toLocaleDateString()}</div>
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
          <h2 style={styles.title}>Projects</h2>
          <p style={styles.subtitle}>{projects.length} total projects</p>
        </div>
        <button onClick={() => setShowForm(true)} style={styles.addBtn}>
          + Add Project
        </button>
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
              <select
                style={styles.input}
                value={form.client_id}
                onChange={e => setForm({ ...form, client_id: e.target.value })}
              >
                <option value="">No client</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.company ? ` (${c.company})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Type</label>
              <input
                style={styles.input}
                placeholder="e.g. Wedding, Corporate, Branding"
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Status</label>
              <select
                style={styles.input}
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="on-hold">On hold</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Budget ($)</label>
              <input
                style={styles.input}
                type="number"
                placeholder="0.00"
                value={form.budget}
                onChange={e => setForm({ ...form, budget: e.target.value })}
              />
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
              <label style={styles.label}>End date</label>
              <input
                style={styles.input}
                type="date"
                value={form.end_date}
                onChange={e => setForm({ ...form, end_date: e.target.value })}
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
              {saving ? 'Saving...' : 'Save Project'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.empty}>Loading projects...</div>
      ) : projects.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📋</div>
          <h3 style={styles.emptyTitle}>No projects yet</h3>
          <p style={styles.emptyText}>Add your first project to get started</p>
          <button onClick={() => setShowForm(true)} style={styles.addBtn}>
            + Add Project
          </button>
        </div>
      ) : (
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span>Project</span>
            <span>Client</span>
            <span>Type</span>
            <span>Budget</span>
            <span>Status</span>
            <span></span>
          </div>
          {projects.map(project => {
            const sc = statusColors[project.status] || statusColors.active
            return (
              <div
                key={project.id}
                style={styles.tableRow}
                onClick={() => setSelectedProject(project)}
              >
                <span style={styles.projectName}>{project.title}</span>
                <span style={styles.tableCell}>
                  {project.clients ? project.clients.name : '—'}
                </span>
                <span style={styles.tableCell}>{project.type || '—'}</span>
                <span style={styles.tableCell}>
                  {project.budget ? `$${parseFloat(project.budget).toLocaleString()}` : '—'}
                </span>
                <span>
                  <div style={{ ...styles.statusBadge, backgroundColor: sc.bg, color: sc.color }}>
                    {project.status}
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
    gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 0.3fr',
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
    gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 0.3fr',
    padding: '14px 20px',
    borderBottom: '1px solid #f9f9f7',
    alignItems: 'center',
    cursor: 'pointer',
  },
  projectName: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#1a1a1a',
  },
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
  detailClient: { fontSize: '14px', color: '#999', margin: 0 },
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