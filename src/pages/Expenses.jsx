import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [projects, setProjects] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: '',
    amount: '',
    category: '',
    project_id: '',
    event_id: '',
    date: '',
    notes: '',
    recurrence: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const categories = [
  'Vendor payment',
  'Software & subscriptions',
  'Travel',
  'Equipment & supplies',
  'Other',
]

const taxCategories = [
  'Equipment & gear',
  'Software & subscriptions',
  'Marketing & advertising',
  'Travel & transportation',
  'Education & training',
  'Studio & workspace',
  'Professional services',
  'Cost of goods',
  'Meals & entertainment',
  'Other',
]

  useEffect(() => {
    fetchExpenses()
    fetchProjects()
    fetchEvents()
  }, [])

  async function fetchExpenses() {
    setLoading(true)
    const { data, error } = await supabase
      .from('expenses')
      .select('*, projects(title), events(name)')
      .order('created_at', { ascending: false })
    if (!error) setExpenses(data)
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
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('expenses').insert({
      title: form.title,
      amount: parseFloat(form.amount),
      category: form.category || null,
      project_id: form.project_id || null,
      event_id: form.event_id || null,
      date: form.date || null,
      notes: form.notes || null,
      recurrence: form.recurrence || null,
      tax_category: form.tax_category || null,
      user_id: user.id,
    })
    if (error) setError(error.message)
    else {
      setShowForm(false)
      setForm({ title: '', amount: '', category: '', project_id: '', event_id: '', date: '', notes: '' })
      fetchExpenses()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('expenses').delete().eq('id', id)
    fetchExpenses()
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
  const byCategory = categories.map(cat => ({
    name: cat,
    total: expenses
      .filter(e => e.category === cat)
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
  })).filter(c => c.total > 0)

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Expenses</h2>
          <p style={styles.subtitle}>{expenses.length} total expenses</p>
        </div>
        <button onClick={() => setShowForm(true)} style={styles.addBtn}>
          + Add Expense
        </button>
      </div>

      <div style={styles.summaryRow}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total expenses</div>
          <div style={{ ...styles.summaryValue, color: '#cc3333' }}>
            ${totalExpenses.toLocaleString()}
          </div>
        </div>
        {byCategory.map(cat => (
          <div key={cat.name} style={styles.summaryCard}>
            <div style={styles.summaryLabel}>{cat.name}</div>
            <div style={styles.summaryValue}>
              ${cat.total.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>New Expense</h3>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.formGrid}>
            <div style={styles.field}>
  <label style={styles.label}>Tax category</label>
  <select
    style={styles.input}
    value={form.tax_category || ''}
    onChange={e => setForm({ ...form, tax_category: e.target.value })}
  >
    <option value="">Select tax category</option>
    {taxCategories.map(c => <option key={c} value={c}>{c}</option>)}
  </select>
</div>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Title *</label>
              <input
                style={styles.input}
                placeholder="e.g. Adobe Creative Cloud"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Amount ($) *</label>
              <input
                style={styles.input}
                type="number"
                placeholder="0.00"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Category</label>
              <select
                style={styles.input}
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
              >
                <option value="">Select category</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Date</label>
              <input
                style={styles.input}
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
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
  <label style={styles.label}>Recurrence</label>
  <select
    style={styles.input}
    value={form.recurrence}
    onChange={e => setForm({ ...form, recurrence: e.target.value })}
  >
    <option value="">One-time</option>
    <option value="weekly">Weekly</option>
    <option value="monthly">Monthly</option>
    <option value="quarterly">Quarterly</option>
    <option value="annually">Annually</option>
  </select>
</div>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Notes</label>
              <input
                style={styles.input}
                placeholder="Any additional details"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
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
              disabled={saving || !form.title || !form.amount}
            >
              {saving ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.empty}>Loading expenses...</div>
      ) : expenses.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>💸</div>
          <h3 style={styles.emptyTitle}>No expenses yet</h3>
          <p style={styles.emptyText}>Track your business expenses to see real net revenue</p>
          <button onClick={() => setShowForm(true)} style={styles.addBtn}>
            + Add Expense
          </button>
        </div>
      ) : (
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span>Title</span>
            <span>Category</span>
            <span>Project</span>
            <span>Date</span>
            <span>Amount</span>
            <span></span>
          </div>
          {expenses.map(expense => (
            <div key={expense.id} style={styles.tableRow}>
              <span style={styles.expenseTitle}>{expense.title}</span>
              <span style={styles.tableCell}>{expense.category || '—'}</span>
              <span style={styles.tableCell}>
                {expense.projects ? expense.projects.title : '—'}
              </span>
              <span style={styles.tableCell}>
                {expense.date
                  ? new Date(expense.date).toLocaleDateString()
                  : '—'}
              </span>
              <span style={{ ...styles.tableCell, color: '#cc3333', fontWeight: '600' }}>
                ${parseFloat(expense.amount).toLocaleString()}
              </span>
              <span>
                <button
                  onClick={() => handleDelete(expense.id)}
                  style={styles.deleteBtn}
                >
                  ✕
                </button>
              </span>
            </div>
          ))}
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
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px 24px',
    border: '1px solid #f0f0eb',
    minWidth: '160px',
  },
  summaryLabel: { fontSize: '12px', color: '#999', marginBottom: '6px' },
  summaryValue: { fontSize: '22px', fontWeight: '700', color: '#1a1a1a' },
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
    gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr 0.3fr',
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
    gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr 0.3fr',
    padding: '14px 20px',
    borderBottom: '1px solid #f9f9f7',
    alignItems: 'center',
  },
  expenseTitle: { fontSize: '13px', fontWeight: '500', color: '#1a1a1a' },
  tableCell: { fontSize: '13px', color: '#666' },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: '#ddd',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '4px',
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