import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [form, setForm] = useState({
    invoice_number: '',
    client_id: '',
    project_id: '',
    total_amount: '',
    amount_paid: '',
    status: 'draft',
    due_date: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchInvoices()
    fetchClients()
    fetchProjects()
  }, [])

  async function fetchInvoices() {
    setLoading(true)
    const { data, error } = await supabase
      .from('invoices')
      .select('*, clients(name, company), projects(title)')
      .order('created_at', { ascending: false })
    if (!error) setInvoices(data)
    setLoading(false)
  }

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('id, name, company')
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
    const { error } = await supabase.from('invoices').insert({
      invoice_number: form.invoice_number || null,
      client_id: form.client_id || null,
      project_id: form.project_id || null,
      total_amount: form.total_amount ? parseFloat(form.total_amount) : 0,
      amount_paid: form.amount_paid ? parseFloat(form.amount_paid) : 0,
      status: form.status,
      due_date: form.due_date || null,
      user_id: user.id,
    })
    if (error) setError(error.message)
    else {
      setShowForm(false)
      setForm({ invoice_number: '', client_id: '', project_id: '', total_amount: '', amount_paid: '', status: 'draft', due_date: '' })
      fetchInvoices()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this invoice?')) return
    await supabase.from('invoices').delete().eq('id', id)
    fetchInvoices()
    if (selectedInvoice?.id === id) setSelectedInvoice(null)
  }

  const statusColors = {
    draft: { bg: '#f5f5f0', color: '#888' },
    sent: { bg: '#f0f4ff', color: '#4466cc' },
    paid: { bg: '#f0faf6', color: '#1D9E75' },
    overdue: { bg: '#fff0f0', color: '#cc3333' },
  }

  const totalRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount_paid) || 0), 0)
  const totalOutstanding = invoices.reduce((sum, inv) => sum + ((parseFloat(inv.total_amount) || 0) - (parseFloat(inv.amount_paid) || 0)), 0)

  if (selectedInvoice) {
    const sc = statusColors[selectedInvoice.status] || statusColors.draft
    const outstanding = (parseFloat(selectedInvoice.total_amount) || 0) - (parseFloat(selectedInvoice.amount_paid) || 0)
    return (
      <div style={styles.page}>
        <div style={styles.detailHeader}>
          <button onClick={() => setSelectedInvoice(null)} style={styles.backBtn}>
            ← Back to invoices
          </button>
          <button onClick={() => handleDelete(selectedInvoice.id)} style={styles.deleteBtn}>
            Delete invoice
          </button>
        </div>
        <div style={styles.detailCard}>
          <div style={styles.detailTop}>
            <div>
              <h2 style={styles.detailName}>
                {selectedInvoice.invoice_number || 'Invoice'}
              </h2>
              {selectedInvoice.clients && (
                <p style={styles.detailSub}>
                  {selectedInvoice.clients.name}
                  {selectedInvoice.clients.company ? ` · ${selectedInvoice.clients.company}` : ''}
                </p>
              )}
            </div>
            <div style={{ ...styles.statusBadge, backgroundColor: sc.bg, color: sc.color }}>
              {selectedInvoice.status}
            </div>
          </div>
          <div style={styles.amountRow}>
            <div style={styles.amountBox}>
              <div style={styles.amountLabel}>Total amount</div>
              <div style={styles.amountValue}>
                ${parseFloat(selectedInvoice.total_amount || 0).toLocaleString()}
              </div>
            </div>
            <div style={styles.amountBox}>
              <div style={styles.amountLabel}>Amount paid</div>
              <div style={{ ...styles.amountValue, color: '#1D9E75' }}>
                ${parseFloat(selectedInvoice.amount_paid || 0).toLocaleString()}
              </div>
            </div>
            <div style={styles.amountBox}>
              <div style={styles.amountLabel}>Outstanding</div>
              <div style={{ ...styles.amountValue, color: outstanding > 0 ? '#cc3333' : '#1D9E75' }}>
                ${outstanding.toLocaleString()}
              </div>
            </div>
          </div>
          <div style={styles.detailGrid}>
            {selectedInvoice.projects && (
              <div style={styles.detailField}>
                <div style={styles.detailFieldLabel}>Project</div>
                <div style={styles.detailFieldValue}>{selectedInvoice.projects.title}</div>
              </div>
            )}
            {selectedInvoice.due_date && (
              <div style={styles.detailField}>
                <div style={styles.detailFieldLabel}>Due date</div>
                <div style={styles.detailFieldValue}>
                  {new Date(selectedInvoice.due_date).toLocaleDateString()}
                </div>
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
          <h2 style={styles.title}>Invoices</h2>
          <p style={styles.subtitle}>{invoices.length} total invoices</p>
        </div>
        <button onClick={() => setShowForm(true)} style={styles.addBtn}>
          + New Invoice
        </button>
      </div>

      <div style={styles.summaryRow}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total collected</div>
          <div style={{ ...styles.summaryValue, color: '#1D9E75' }}>
            ${totalRevenue.toLocaleString()}
          </div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Outstanding</div>
          <div style={{ ...styles.summaryValue, color: totalOutstanding > 0 ? '#cc7700' : '#1D9E75' }}>
            ${totalOutstanding.toLocaleString()}
          </div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total invoiced</div>
          <div style={styles.summaryValue}>
            ${invoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0).toLocaleString()}
          </div>
        </div>
      </div>

      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>New Invoice</h3>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.formGrid}>
            <div style={styles.field}>
              <label style={styles.label}>Invoice number</label>
              <input
                style={styles.input}
                placeholder="e.g. INV-001"
                value={form.invoice_number}
                onChange={e => setForm({ ...form, invoice_number: e.target.value })}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Status</label>
              <select
                style={styles.input}
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
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
              <label style={styles.label}>Total amount ($)</label>
              <input
                style={styles.input}
                type="number"
                placeholder="0.00"
                value={form.total_amount}
                onChange={e => setForm({ ...form, total_amount: e.target.value })}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Amount paid ($)</label>
              <input
                style={styles.input}
                type="number"
                placeholder="0.00"
                value={form.amount_paid}
                onChange={e => setForm({ ...form, amount_paid: e.target.value })}
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
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Invoice'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.empty}>Loading invoices...</div>
      ) : invoices.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>💵</div>
          <h3 style={styles.emptyTitle}>No invoices yet</h3>
          <p style={styles.emptyText}>Create your first invoice to start tracking revenue</p>
          <button onClick={() => setShowForm(true)} style={styles.addBtn}>
            + New Invoice
          </button>
        </div>
      ) : (
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span>Invoice</span>
            <span>Client</span>
            <span>Project</span>
            <span>Total</span>
            <span>Paid</span>
            <span>Due date</span>
            <span>Status</span>
            <span></span>
          </div>
          {invoices.map(invoice => {
            const sc = statusColors[invoice.status] || statusColors.draft
            return (
              <div
                key={invoice.id}
                style={styles.tableRow}
                onClick={() => setSelectedInvoice(invoice)}
              >
                <span style={styles.invoiceNumber}>
                  {invoice.invoice_number || '—'}
                </span>
                <span style={styles.tableCell}>
                  {invoice.clients ? invoice.clients.name : '—'}
                </span>
                <span style={styles.tableCell}>
                  {invoice.projects ? invoice.projects.title : '—'}
                </span>
                <span style={styles.tableCell}>
                  ${parseFloat(invoice.total_amount || 0).toLocaleString()}
                </span>
                <span style={{ ...styles.tableCell, color: '#1D9E75', fontWeight: '500' }}>
                  ${parseFloat(invoice.amount_paid || 0).toLocaleString()}
                </span>
                <span style={styles.tableCell}>
                  {invoice.due_date
                    ? new Date(invoice.due_date).toLocaleDateString()
                    : '—'}
                </span>
                <span>
                  <div style={{ ...styles.statusBadge, backgroundColor: sc.bg, color: sc.color }}>
                    {invoice.status}
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
  summaryRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    marginBottom: '24px',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px 24px',
    border: '1px solid #f0f0eb',
  },
  summaryLabel: { fontSize: '12px', color: '#999', marginBottom: '6px' },
  summaryValue: { fontSize: '24px', fontWeight: '700', color: '#1a1a1a' },
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
    gridTemplateColumns: '1fr 1.5fr 1.5fr 1fr 1fr 1fr 1fr 0.3fr',
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
    gridTemplateColumns: '1fr 1.5fr 1.5fr 1fr 1fr 1fr 1fr 0.3fr',
    padding: '14px 20px',
    borderBottom: '1px solid #f9f9f7',
    alignItems: 'center',
    cursor: 'pointer',
  },
  invoiceNumber: { fontSize: '13px', fontWeight: '600', color: '#1a1a1a' },
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
  detailSub: { fontSize: '14px', color: '#999', margin: 0 },
  amountRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    marginBottom: '24px',
  },
  amountBox: {
    backgroundColor: '#fafaf8',
    borderRadius: '8px',
    padding: '16px',
  },
  amountLabel: { fontSize: '11px', color: '#aaa', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' },
  amountValue: { fontSize: '22px', fontWeight: '700', color: '#1a1a1a' },
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