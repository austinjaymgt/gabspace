import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

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

const recurrenceOptions = [
  'One-time',
  'Weekly',
  'Monthly',
  'Quarterly',
  'Annually',
]

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterRecurrence, setFilterRecurrence] = useState('all')
  const [form, setForm] = useState({
    title: '', amount: '', date: '', category: '',
    tax_category: '', recurrence: 'One-time', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [editingExpense, setEditingExpense] = useState(null)
  const [receiptFile, setReceiptFile] = useState(null)
  const [selectedExpense, setSelectedExpense] = useState(null)


  useEffect(() => { fetchExpenses() }, [])

  async function fetchExpenses() {
    setLoading(true)
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false })
    if (data) setExpenses(data)
    setLoading(false)
  }

  async function handleSave() {
  setSaving(true)
  setError(null)
  const { data: { user } } = await supabase.auth.getUser()
  const payload = {
    title: form.title,
    amount: parseFloat(form.amount),
    date: form.date || null,
    category: form.category || null,
    tax_category: form.tax_category || null,
    recurrence: form.recurrence || 'One-time',
    notes: form.notes || null,
  }
  if (editingExpense) {
    await supabase.from('expenses').update(payload).eq('id', editingExpense.id)
    if (receiptFile) {
      const ext = receiptFile.name.split('.').pop()
      const fileName = `${editingExpense.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('expense-receipts').upload(fileName, receiptFile)
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('expense-receipts').getPublicUrl(fileName)
        await supabase.from('expenses').update({ receipt_url: urlData.publicUrl }).eq('id', editingExpense.id)
      }
    }
  } else {
    const { data: newExpense, error } = await supabase.from('expenses').insert({ ...payload, user_id: user.id }).select().single()
    if (error) { setError(error.message); setSaving(false); return }
    if (receiptFile && newExpense) {
      const ext = receiptFile.name.split('.').pop()
      const fileName = `${newExpense.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('expense-receipts').upload(fileName, receiptFile)
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('expense-receipts').getPublicUrl(fileName)
        await supabase.from('expenses').update({ receipt_url: urlData.publicUrl }).eq('id', newExpense.id)
      }
    }
  }
  setShowForm(false)
  setEditingExpense(null)
  setForm({ title: '', amount: '', date: '', category: '', tax_category: '', recurrence: 'One-time', notes: '' })
  setReceiptFile(null)
  fetchExpenses()
  setSaving(false)
}
function openEditForm(expense) {
  setEditingExpense(expense)
  setForm({
    title: expense.title || '',
    amount: expense.amount || '',
    date: expense.date || '',
    category: expense.category || '',
    tax_category: expense.tax_category || '',
    recurrence: expense.recurrence || 'One-time',
    notes: expense.notes || '',
  })
  setReceiptFile(null)
  setShowForm(true)
}
  async function handleDelete(id) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('expenses').delete().eq('id', id)
    fetchExpenses()
  }

  const filtered = expenses
    .filter(e => filterCategory === 'all' || e.category === filterCategory)
    .filter(e => filterRecurrence === 'all' || e.recurrence === filterRecurrence)

  const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
  const recurringTotal = expenses
    .filter(e => e.recurrence && e.recurrence !== 'One-time')
    .reduce((sum, e) => {
      const amount = parseFloat(e.amount) || 0
      if (e.recurrence === 'Weekly') return sum + (amount * 4)
      if (e.recurrence === 'Monthly') return sum + amount
      if (e.recurrence === 'Quarterly') return sum + (amount / 3)
      if (e.recurrence === 'Annually') return sum + (amount / 12)
      return sum
    }, 0)
if (selectedExpense) {
  return (
    <div style={{ padding: '32px', fontFamily: t.fonts.sans }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={() => setSelectedExpense(null)} style={styles.backBtn}>← Back to expenses</button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => { setSelectedExpense(null); openEditForm(selectedExpense) }} style={styles.editBtn}>Edit</button>
          <button onClick={() => { handleDelete(selectedExpense.id); setSelectedExpense(null) }} style={styles.deleteBtn}>Delete</button>
        </div>
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '32px', border: '1px solid #f0f0eb' }}>
        {/* Title + amount */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a1a', margin: '0 0 6px' }}>
              {selectedExpense.recurrence && selectedExpense.recurrence !== 'One-time' && <span style={{ marginRight: '8px' }}>🔄</span>}
              {selectedExpense.title}
            </h2>
            {selectedExpense.notes && (
              <p style={{ fontSize: '14px', color: '#999', margin: 0 }}>{selectedExpense.notes}</p>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#cc3333' }}>
              ${parseFloat(selectedExpense.amount).toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
              {selectedExpense.recurrence || 'One-time'}
            </div>
          </div>
        </div>

        {/* Detail fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Date', value: selectedExpense.date ? new Date(selectedExpense.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—' },
            { label: 'Frequency', value: selectedExpense.recurrence || 'One-time' },
            { label: 'Category', value: selectedExpense.category || '—' },
            { label: 'Tax category', value: selectedExpense.tax_category || '—' },
          ].map(field => (
            <div key={field.label} style={{ backgroundColor: '#fafaf8', borderRadius: '8px', padding: '14px 16px' }}>
              <div style={{ fontSize: '11px', color: '#aaa', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>{field.label}</div>
              <div style={{ fontSize: '14px', color: '#1a1a1a' }}>{field.value}</div>
            </div>
          ))}
        </div>

        {/* Receipt */}
        {selectedExpense.receipt_url ? (
          <div style={{ padding: '16px 20px', backgroundColor: '#f0faf6', borderRadius: '10px', border: '1px solid #d0f0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>📎</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a' }}>Receipt attached</div>
                <div style={{ fontSize: '12px', color: '#999' }}>Click to open</div>
              </div>
            </div>
            <a href={selectedExpense.receipt_url} target="_blank" rel="noreferrer" style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #1D9E75', backgroundColor: '#fff', color: '#1D9E75', fontSize: '12px', fontWeight: '600', textDecoration: 'none' }}>
              View receipt
            </a>
          </div>
        ) : (
          <div style={{ padding: '16px 20px', backgroundColor: '#fafaf8', borderRadius: '10px', border: '1px dashed #e0e0e0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>📎</span>
            <div style={{ fontSize: '13px', color: '#bbb' }}>No receipt attached — click Edit to add one</div>
          </div>
        )}
      </div>
    </div>
  )
}
  return (
    <div style={{ padding: '32px', fontFamily: t.fonts.sans }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: 0 }}>
            Expenses
          </h2>
          <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '4px 0 0' }}>
            Business overhead and operating costs
          </p>
        </div>
        <button onClick={() => setShowForm(true)} style={styles.addBtn}>
          + Add Expense
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total expenses', value: `$${totalExpenses.toLocaleString()}`, color: '#cc3333' },
          { label: 'Recurring/mo equivalent', value: `$${Math.round(recurringTotal).toLocaleString()}`, color: '#F59E0B' },
          { label: 'One-time expenses', value: `$${expenses.filter(e => e.recurrence === 'One-time' || !e.recurrence).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0).toLocaleString()}`, color: t.colors.textPrimary },
        ].map(card => (
          <div key={card.label} style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '20px 24px', border: `1px solid ${t.colors.borderLight}` }}>
            <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, marginBottom: '8px' }}>{card.label}</div>
            <div style={{ fontSize: '26px', fontWeight: '700', color: card.color, letterSpacing: '-0.5px' }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['all', ...categories].map(cat => (
          <button key={cat} onClick={() => setFilterCategory(cat)} style={{
            padding: '6px 14px', borderRadius: t.radius.full, fontSize: t.fontSizes.sm,
            border: `1px solid ${filterCategory === cat ? t.colors.primary : t.colors.borderLight}`,
            backgroundColor: filterCategory === cat ? t.colors.primaryLight : '#fff',
            color: filterCategory === cat ? t.colors.primary : t.colors.textSecondary,
            fontWeight: filterCategory === cat ? '600' : '400', cursor: 'pointer', fontFamily: t.fonts.sans,
          }}>
            {cat === 'all' ? 'All' : cat}
          </button>
        ))}
        <div style={{ width: '1px', backgroundColor: t.colors.borderLight, margin: '0 4px' }} />
        {['all', 'One-time', 'Monthly', 'Annually'].map(rec => (
          <button key={rec} onClick={() => setFilterRecurrence(rec)} style={{
            padding: '6px 14px', borderRadius: t.radius.full, fontSize: t.fontSizes.sm,
            border: `1px solid ${filterRecurrence === rec ? '#F59E0B' : t.colors.borderLight}`,
            backgroundColor: filterRecurrence === rec ? '#FEF3C7' : '#fff',
            color: filterRecurrence === rec ? '#92400E' : t.colors.textSecondary,
            fontWeight: filterRecurrence === rec ? '600' : '400', cursor: 'pointer', fontFamily: t.fonts.sans,
          }}>
            {rec === 'all' ? 'All frequency' : rec}
          </button>
        ))}
      </div>

      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>New Business Expense</h3>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.formGrid}>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Description *</label>
              <input
                style={styles.input}
                placeholder="e.g. Adobe Creative Cloud, Camera lens, Studio rent"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Amount ($) *</label>
              <input style={styles.input} type="number" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Date</label>
              <input style={styles.input} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Category</label>
              <select style={styles.input} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Tax category</label>
              <select style={styles.input} value={form.tax_category} onChange={e => setForm({ ...form, tax_category: e.target.value })}>
                <option value="">Select tax category</option>
                {taxCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Frequency</label>
              <select style={styles.input} value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value })}>
                {recurrenceOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={styles.field}>
  <label style={styles.label}>Notes</label>
  <input style={styles.input} placeholder="Any additional details" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
</div>
<div style={{ ...styles.field, gridColumn: 'span 2' }}>
  <label style={styles.label}>Receipt <span style={{ color: '#bbb', fontWeight: '400' }}>(optional)</span></label>
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
    {editingExpense?.receipt_url && !receiptFile && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', backgroundColor: '#f0faf6', borderRadius: '6px', border: '1px solid #d0f0e0' }}>
        <span style={{ fontSize: '13px' }}>📎</span>
        <a href={editingExpense.receipt_url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#1D9E75', textDecoration: 'none', fontWeight: '500' }}>View current receipt</a>
        <span style={{ fontSize: '12px', color: '#bbb' }}>· Upload new to replace</span>
      </div>
    )}
    <label style={{ padding: '7px 14px', borderRadius: '8px', border: '1px dashed #e0e0e0', backgroundColor: '#fafaf8', color: '#888', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>
      {receiptFile ? `📎 ${receiptFile.name}` : editingExpense?.receipt_url ? 'Replace receipt...' : '+ Attach receipt'}
      <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => setReceiptFile(e.target.files[0] || null)} />
    </label>
    {receiptFile && (
      <button onClick={() => setReceiptFile(null)} style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: '12px' }}>✕ Remove</button>
    )}
  </div>
</div>
          </div>
          <div style={styles.formActions}>
            <button onClick={() => { setShowForm(false); setError(null) }} style={styles.cancelBtn}>Cancel</button>
            <button onClick={handleSave} style={styles.saveBtn} disabled={saving || !form.title || !form.amount}>
              {saving ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.empty}>Loading expenses...</div>
      ) : filtered.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>💸</div>
          <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px' }}>
            No expenses yet
          </h3>
          <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '0 0 24px' }}>
            Track your business overhead and operating costs here
          </p>
          <button onClick={() => setShowForm(true)} style={styles.addBtn}>+ Add Expense</button>
        </div>
      ) : (
        <div style={styles.table}>
  <div style={styles.tableHeader}>
    <span>Description</span>
    <span>Date</span>
    <span>Frequency</span>
    <span>Amount</span>
    <span></span>
  </div>
  {filtered.map(expense => (
    <div key={expense.id} style={{ ...styles.tableRow, cursor: 'pointer' }} onClick={() => setSelectedExpense(expense)}>
      <span style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>
        {expense.recurrence && expense.recurrence !== 'One-time' && <span style={{ marginRight: '6px' }}>🔄</span>}
        {expense.title}
        {expense.category && <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '2px' }}>{expense.category}</div>}
      </span>
      <span style={styles.tableCell}>
        {expense.date ? new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
      </span>
      <span style={styles.tableCell}>
        <span style={{
          padding: '2px 8px', borderRadius: t.radius.full, fontSize: t.fontSizes.xs, fontWeight: '500',
          backgroundColor: expense.recurrence && expense.recurrence !== 'One-time' ? '#FEF3C7' : t.colors.bg,
          color: expense.recurrence && expense.recurrence !== 'One-time' ? '#92400E' : t.colors.textTertiary,
        }}>
          {expense.recurrence || 'One-time'}
        </span>
      </span>
      <span style={{ fontSize: t.fontSizes.base, fontWeight: '600', color: '#cc3333' }}>
        ${parseFloat(expense.amount).toLocaleString()}
      </span>
      <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <button onClick={e => { e.stopPropagation(); openEditForm(expense) }} style={{ background: 'none', border: 'none', color: t.colors.textTertiary, cursor: 'pointer', fontSize: '13px' }}>✏️</button>
        <button onClick={e => { e.stopPropagation(); handleDelete(expense.id) }} style={{ background: 'none', border: 'none', color: t.colors.textTertiary, cursor: 'pointer', fontSize: '13px' }}>✕</button>
      </span>
    </div>
  ))}
</div>
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
  tableHeader: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.3fr', padding: '12px 20px', backgroundColor: '#fafaf8', borderBottom: '1px solid #f0f0eb', fontSize: '12px', fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' },
  tableRow: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.3fr', padding: '14px 20px', borderBottom: '1px solid #f9f9f7', alignItems: 'center' },
  tableCell: { fontSize: '13px', color: '#666' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #f0f0eb' },
  empty: { fontSize: '13px', color: '#999', padding: '40px', textAlign: 'center' }, 
  backBtn: { padding: '8px 14px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff', color: '#555', fontSize: '13px', cursor: 'pointer' },
  editBtn: { padding: '8px 14px', borderRadius: '8px', border: '1px solid #1D9E75', backgroundColor: '#fff', color: '#1D9E75', fontSize: '13px', cursor: 'pointer' },
  deleteBtn: { padding: '8px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#fff0f0', color: '#cc3333', fontSize: '13px', cursor: 'pointer' },
}