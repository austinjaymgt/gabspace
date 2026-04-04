import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

const taxCategories = [
  'Service Income',
  'Product Sales',
  'Royalties & Licensing',
  'Brand Deals & Sponsorships',
  'Teaching & Education',
  'Other Income',
]

export default function Revenue() {
  const [entries, setEntries] = useState([])
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [form, setForm] = useState({
    amount: '', date: '', income_stream: '', status: 'received',
    tax_category: '', notes: '', client_id: '', project_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [editingEntry, setEditingEntry] = useState(null)
const [selectedEntry, setSelectedEntry] = useState(null) 
const [receiptFile, setReceiptFile] = useState(null) 

  useEffect(() => {
    fetchEntries()
    fetchClients()
    fetchProjects()
  }, [])

  async function fetchEntries() {
    setLoading(true)
    const { data } = await supabase
      .from('revenue')
      .select('*, clients(name), projects(title)')
      .order('date', { ascending: false })
    if (data) setEntries(data)
    setLoading(false)
  }

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('id, name')
    if (data) setClients(data)
  }

  async function fetchProjects() {
    const { data } = await supabase.from('projects').select('id, title')
    if (data) setProjects(data)
  }

  async function handleSave() {
  setSaving(true)
  setError(null)
  const { data: { user } } = await supabase.auth.getUser()

  const payload = {
    amount: parseFloat(form.amount),
    date: form.date || null,
    income_stream: form.income_stream,
    status: form.status,
    tax_category: form.tax_category || null,
    notes: form.notes || null,
    client_id: form.client_id || null,
    project_id: form.project_id || null,
  }

  if (editingEntry) {
    const { error } = await supabase.from('revenue').update(payload).eq('id', editingEntry.id)
    if (error) { setError(error.message); setSaving(false); return }
    if (receiptFile) {
      const ext = receiptFile.name.split('.').pop()
      const fileName = `${editingEntry.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('revenue-receipts').upload(fileName, receiptFile)
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('revenue-receipts').getPublicUrl(fileName)
        await supabase.from('revenue').update({ receipt_url: urlData.publicUrl }).eq('id', editingEntry.id)
      }
    }
    if (selectedEntry?.id === editingEntry.id) setSelectedEntry(prev => ({ ...prev, ...payload }))
  } else {
    const { data: newEntry, error } = await supabase.from('revenue').insert({ ...payload, user_id: user.id }).select().single()
    if (error) { setError(error.message); setSaving(false); return }
    if (receiptFile && newEntry) {
      const ext = receiptFile.name.split('.').pop()
      const fileName = `${newEntry.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('revenue-receipts').upload(fileName, receiptFile)
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('revenue-receipts').getPublicUrl(fileName)
        await supabase.from('revenue').update({ receipt_url: urlData.publicUrl }).eq('id', newEntry.id)
      }
    }
  }

  setShowForm(false)
  setEditingEntry(null)
setForm({ amount: '', date: '', income_stream: '', status: 'received', tax_category: '', notes: '', client_id: '', project_id: '' })
setReceiptFile(null)
  fetchEntries()
  setSaving(false)
}
function openEditForm(entry) {
  setEditingEntry(entry)
  setForm({
    amount: entry.amount || '',
    date: entry.date || '',
    income_stream: entry.income_stream || '',
    status: entry.status || 'received',
    tax_category: entry.tax_category || '',
    notes: entry.notes || '',
    client_id: entry.client_id || '',
    project_id: entry.project_id || '',
  })
  setShowForm(true)
}
  async function handleDelete(id) {
    if (!confirm('Delete this entry?')) return
    await supabase.from('revenue').delete().eq('id', id)
    fetchEntries()
  }

  async function toggleStatus(entry) {
    const newStatus = entry.status === 'received' ? 'pending' : 'received'
    await supabase.from('revenue').update({ status: newStatus }).eq('id', entry.id)
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: newStatus } : e))
  }

  const filtered = entries
    .filter(e => filterStatus === 'all' || e.status === filterStatus)
    .filter(e => filterCategory === 'all' || e.tax_category === filterCategory)

  const totalReceived = entries.filter(e => e.status === 'received').reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
  const totalPending = entries.filter(e => e.status === 'pending').reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
if (selectedEntry) {
  return (
    <div style={{ padding: '32px', fontFamily: t.fonts.sans }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <button onClick={() => setSelectedEntry(null)} style={styles.backBtn}>← Back to revenue</button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => { setSelectedEntry(null); openEditForm(selectedEntry) }} style={styles.editBtn}>Edit</button>
          <button onClick={() => { handleDelete(selectedEntry.id); setSelectedEntry(null) }} style={styles.deleteBtn}>Delete</button>
        </div>
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '32px', border: '1px solid #f0f0eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a1a', margin: '0 0 6px' }}>{selectedEntry.income_stream}</h2>
            {selectedEntry.notes && <p style={{ fontSize: '14px', color: '#999', margin: 0 }}>{selectedEntry.notes}</p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#10B981' }}>${parseFloat(selectedEntry.amount).toLocaleString()}</div>
            <button
              onClick={() => toggleStatus(selectedEntry)}
              style={{
                marginTop: '6px', padding: '3px 10px', borderRadius: '999px', fontSize: '12px',
                fontWeight: '500', cursor: 'pointer', border: 'none',
                backgroundColor: selectedEntry.status === 'received' ? '#f0faf6' : '#FEF3C7',
                color: selectedEntry.status === 'received' ? '#1D9E75' : '#92400E',
              }}
            >
              {selectedEntry.status}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {[
            { label: 'Date', value: selectedEntry.date ? new Date(selectedEntry.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—' },
            { label: 'Status', value: selectedEntry.status ? selectedEntry.status.charAt(0).toUpperCase() + selectedEntry.status.slice(1) : '—' },
            { label: 'Tax category', value: selectedEntry.tax_category || '—' },
            { label: 'Client', value: selectedEntry.clients?.name || '—' },
            { label: 'Project', value: selectedEntry.projects?.title || '—' },
          ].map(field => (
            <div key={field.label} style={{ backgroundColor: '#fafaf8', borderRadius: '8px', padding: '14px 16px' }}>
              <div style={{ fontSize: '11px', color: '#aaa', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>{field.label}</div>
              <div style={{ fontSize: '14px', color: '#1a1a1a' }}>{field.value}</div>
            </div>
          ))}
       </div>

        {selectedEntry.receipt_url ? (
          <div style={{ marginTop: '24px', padding: '16px 20px', backgroundColor: '#f0faf6', borderRadius: '10px', border: '1px solid #d0f0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>📎</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a' }}>File attached</div>
                <div style={{ fontSize: '12px', color: '#999' }}>Receipt or proof of payment</div>
              </div>
            </div>
            <a href={selectedEntry.receipt_url} target="_blank" rel="noreferrer" style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #1D9E75', backgroundColor: '#fff', color: '#1D9E75', fontSize: '12px', fontWeight: '600', textDecoration: 'none' }}>View file</a>
          </div>
        ) : (
          <div style={{ marginTop: '24px', padding: '16px 20px', backgroundColor: '#fafaf8', borderRadius: '10px', border: '1px dashed #e0e0e0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>📎</span>
            <div style={{ fontSize: '13px', color: '#bbb' }}>No file attached — click Edit to add one</div>
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
          <h2 style={{ fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: 0 }}>Revenue</h2>
          <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '4px 0 0' }}>
            All income across every stream
          </p>
        </div>
        <button onClick={() => setShowForm(true)} style={styles.addBtn}>+ Add Revenue</button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total received', value: totalReceived, color: '#10B981' },
          { label: 'Pending', value: totalPending, color: '#F59E0B' },
          { label: 'Total invoiced', value: totalReceived + totalPending, color: t.colors.textPrimary },
        ].map(card => (
          <div key={card.label} style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '20px 24px', border: `1px solid ${t.colors.borderLight}` }}>
            <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, marginBottom: '8px' }}>{card.label}</div>
            <div style={{ fontSize: '26px', fontWeight: '700', color: card.color, letterSpacing: '-0.5px' }}>
              ${card.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['all', 'received', 'pending'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} style={{
            padding: '6px 14px', borderRadius: t.radius.full, fontSize: t.fontSizes.sm,
            border: `1px solid ${filterStatus === s ? t.colors.primary : t.colors.borderLight}`,
            backgroundColor: filterStatus === s ? t.colors.primaryLight : '#fff',
            color: filterStatus === s ? t.colors.primary : t.colors.textSecondary,
            fontWeight: filterStatus === s ? '600' : '400', cursor: 'pointer', fontFamily: t.fonts.sans,
          }}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <div style={{ width: '1px', backgroundColor: t.colors.borderLight, margin: '0 4px' }} />
        {['all', ...taxCategories].map(cat => (
          <button key={cat} onClick={() => setFilterCategory(cat)} style={{
            padding: '6px 14px', borderRadius: t.radius.full, fontSize: t.fontSizes.sm,
            border: `1px solid ${filterCategory === cat ? '#8B5CF6' : t.colors.borderLight}`,
            backgroundColor: filterCategory === cat ? '#F5F3FF' : '#fff',
            color: filterCategory === cat ? '#8B5CF6' : t.colors.textSecondary,
            fontWeight: filterCategory === cat ? '600' : '400', cursor: 'pointer', fontFamily: t.fonts.sans,
          }}>
            {cat === 'all' ? 'All categories' : cat}
          </button>
        ))}
      </div>

      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>New Revenue Entry</h3>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.formGrid}>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Income stream *</label>
              <input style={styles.input} placeholder="e.g. Wedding photography — Smith wedding, Lightroom preset pack" value={form.income_stream} onChange={e => setForm({ ...form, income_stream: e.target.value })} />
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
              <label style={styles.label}>Status</label>
              <select style={styles.input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="received">Received</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Tax category</label>
              <select style={styles.input} value={form.tax_category} onChange={e => setForm({ ...form, tax_category: e.target.value })}>
                <option value="">Select category</option>
                {taxCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Client</label>
              <select style={styles.input} value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}>
                <option value="">No client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Project</label>
              <select style={styles.input} value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
  <label style={styles.label}>Notes</label>
  <input style={styles.input} placeholder="Any additional details" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
</div>
<div style={{ ...styles.field, gridColumn: 'span 2' }}>
  <label style={styles.label}>Receipt / proof of payment <span style={{ color: '#bbb', fontWeight: '400' }}>(optional)</span></label>
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
    {editingEntry?.receipt_url && !receiptFile && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', backgroundColor: '#f0faf6', borderRadius: '6px', border: '1px solid #d0f0e0' }}>
        <span style={{ fontSize: '13px' }}>📎</span>
        <a href={editingEntry.receipt_url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#1D9E75', textDecoration: 'none', fontWeight: '500' }}>View current file</a>
        <span style={{ fontSize: '12px', color: '#bbb' }}>· Upload new to replace</span>
      </div>
    )}
    <label style={{ padding: '7px 14px', borderRadius: '8px', border: '1px dashed #e0e0e0', backgroundColor: '#fafaf8', color: '#888', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>
      {receiptFile ? `📎 ${receiptFile.name}` : editingEntry?.receipt_url ? 'Replace file...' : '+ Attach file'}
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
            <button onClick={handleSave} style={styles.saveBtn} disabled={saving || !form.income_stream || !form.amount}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.empty}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>💵</div>
          <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px' }}>No revenue entries yet</h3>
          <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '0 0 24px' }}>Add your first income entry to start tracking</p>
          <button onClick={() => setShowForm(true)} style={styles.addBtn}>+ Add Revenue</button>
        </div>
      ) : (
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span>Income stream</span>
            <span>Category</span>
            <span>Client</span>
            <span>Date</span>
            <span>Amount</span>
            <span>Status</span>
            <span></span>
          </div>
          {filtered.map(entry => (
              <div key={entry.id} style={{ ...styles.tableRow, cursor: 'pointer' }} onClick={() => setSelectedEntry(entry)}>
              <span style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>
                {entry.income_stream}
                {entry.notes && <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '2px' }}>{entry.notes}</div>}
              </span>
              <span style={styles.tableCell}>{entry.tax_category || '—'}</span>
              <span style={styles.tableCell}>{entry.clients?.name || '—'}</span>
              <span style={styles.tableCell}>
                {entry.date ? new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
              </span>
              <span style={{ fontSize: t.fontSizes.base, fontWeight: '600', color: '#10B981' }}>
                ${parseFloat(entry.amount).toLocaleString()}
              </span>
              <span>
                <button
                  onClick={() => toggleStatus(entry)}
                  style={{
                    padding: '3px 10px', borderRadius: t.radius.full, fontSize: t.fontSizes.xs, fontWeight: '500', cursor: 'pointer', border: 'none',
                    backgroundColor: entry.status === 'received' ? '#f0faf6' : '#FEF3C7',
                    color: entry.status === 'received' ? '#1D9E75' : '#92400E',
                  }}
                >
                  {entry.status}
                </button>
              </span>
              <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
  <button onClick={e => { e.stopPropagation(); openEditForm(entry) }} style={{ background: 'none', border: 'none', color: t.colors.textTertiary, cursor: 'pointer', fontSize: '13px' }}>✏️</button>
  <button onClick={e => { e.stopPropagation(); handleDelete(entry.id) }} style={{ background: 'none', border: 'none', color: t.colors.textTertiary, cursor: 'pointer', fontSize: '13px' }}>✕</button>
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
  tableHeader: { display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr 0.3fr', padding: '12px 20px', backgroundColor: '#fafaf8', borderBottom: '1px solid #f0f0eb', fontSize: '12px', fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' },
  tableRow: { display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr 0.3fr', padding: '14px 20px', borderBottom: '1px solid #f9f9f7', alignItems: 'center' },
  tableCell: { fontSize: '13px', color: '#666' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #f0f0eb' },
  empty: { fontSize: '13px', color: '#999', padding: '40px', textAlign: 'center' },
  backBtn: { padding: '8px 14px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff', color: '#555', fontSize: '13px', cursor: 'pointer' },
editBtn: { padding: '8px 14px', borderRadius: '8px', border: '1px solid #1D9E75', backgroundColor: '#fff', color: '#1D9E75', fontSize: '13px', cursor: 'pointer' },
deleteBtn: { padding: '8px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#fff0f0', color: '#cc3333', fontSize: '13px', cursor: 'pointer' },
}