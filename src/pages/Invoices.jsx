import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

const statusConfig = {
  draft:   { bg: t.colors.bg,           color: t.colors.textTertiary, label: 'Draft' },
  sent:    { bg: t.colors.primaryLight, color: t.colors.primary,      label: 'Sent' },
  paid:    { bg: t.colors.successLight, color: t.colors.success,      label: 'Paid' },
  overdue: { bg: t.colors.dangerLight,  color: t.colors.danger,       label: 'Overdue' },
}

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

  const totalRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount_paid) || 0), 0)
  const totalOutstanding = invoices.reduce((sum, inv) => sum + ((parseFloat(inv.total_amount) || 0) - (parseFloat(inv.amount_paid) || 0)), 0)
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0)

  if (selectedInvoice) {
    const sc = statusConfig[selectedInvoice.status] || statusConfig.draft
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
              {sc.label}
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
              <div style={{ ...styles.amountValue, color: t.colors.success }}>
                ${parseFloat(selectedInvoice.amount_paid || 0).toLocaleString()}
              </div>
            </div>
            <div style={styles.amountBox}>
              <div style={styles.amountLabel}>Outstanding</div>
              <div style={{ ...styles.amountValue, color: outstanding > 0 ? t.colors.danger : t.colors.success }}>
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
          <p style={styles.subtitle}>{invoices.length} total invoice{invoices.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(true)} style={styles.addBtn}>
          + New invoice
        </button>
      </div>

      <div style={styles.summaryRow}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total collected</div>
          <div style={{ ...styles.summaryValue, color: t.colors.success }}>
            ${totalRevenue.toLocaleString()}
          </div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Outstanding</div>
          <div style={{ ...styles.summaryValue, color: totalOutstanding > 0 ? t.colors.warning : t.colors.success }}>
            ${totalOutstanding.toLocaleString()}
          </div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total invoiced</div>
          <div style={styles.summaryValue}>
            ${totalInvoiced.toLocaleString()}
          </div>
        </div>
      </div>

      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>New invoice</h3>
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
              {saving ? 'Saving...' : 'Save invoice'}
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
            + New invoice
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
            const sc = statusConfig[invoice.status] || statusConfig.draft
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
                <span style={{ ...styles.tableCell, color: t.colors.success, fontWeight: '500' }}>
                  ${parseFloat(invoice.amount_paid || 0).toLocaleString()}
                </span>
                <span style={styles.tableCell}>
                  {invoice.due_date
                    ? new Date(invoice.due_date).toLocaleDateString()
                    : '—'}
                </span>
                <span>
                  <div style={{ ...styles.statusBadge, backgroundColor: sc.bg, color: sc.color }}>
                    {sc.label}
                  </div>
                </span>
                <span style={{ ...styles.tableCell, color: t.colors.textTertiary }}>→</span>
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
  title: { fontSize: '22px', fontWeight: '800', color: t.colors.textPrimary, margin: 0, fontFamily: t.fonts.heading, letterSpacing: '-0.02em' },
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
    marginBottom: '24px',
  },
  summaryCard: {
    backgroundColor: t.colors.bgCard,
    borderRadius: t.radius.lg,
    padding: '20px 24px',
    border: `1px solid ${t.colors.border}`,
  },
  summaryLabel: { fontSize: t.fontSizes.sm, color: t.colors.textTertiary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '500' },
  summaryValue: { fontSize: '26px', fontWeight: '800', color: t.colors.textPrimary, fontFamily: t.fonts.heading, letterSpacing: '-0.02em' },
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
  table: {
    backgroundColor: t.colors.bgCard,
    borderRadius: t.radius.lg,
    border: `1px solid ${t.colors.border}`,
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.5fr 1.5fr 1fr 1fr 1fr 1fr 0.3fr',
    padding: '12px 20px',
    backgroundColor: t.colors.bg,
    borderBottom: `1px solid ${t.colors.border}`,
    fontSize: t.fontSizes.xs,
    fontWeight: '600',
    color: t.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.5fr 1.5fr 1fr 1fr 1fr 1fr 0.3fr',
    padding: '14px 20px',
    borderBottom: `1px solid ${t.colors.borderLight}`,
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  invoiceNumber: { fontSize: t.fontSizes.base, fontWeight: '600', color: t.colors.textPrimary },
  tableCell: { fontSize: t.fontSizes.base, color: t.colors.textSecondary },
  statusBadge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: t.radius.full,
    fontSize: t.fontSizes.sm,
    fontWeight: '500',
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
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '24px',
  },
  backBtn: {
    padding: '8px 14px',
    borderRadius: t.radius.md,
    border: `1px solid ${t.colors.border}`,
    backgroundColor: t.colors.bgCard,
    color: t.colors.textSecondary,
    fontSize: t.fontSizes.base,
    cursor: 'pointer',
    fontFamily: t.fonts.sans,
  },
  deleteBtn: {
    padding: '8px 14px',
    borderRadius: t.radius.md,
    border: 'none',
    backgroundColor: t.colors.dangerLight,
    color: t.colors.danger,
    fontSize: t.fontSizes.base,
    cursor: 'pointer',
    fontFamily: t.fonts.sans,
    fontWeight: '500',
  },
  detailCard: {
    backgroundColor: t.colors.bgCard,
    borderRadius: t.radius.lg,
    padding: '32px',
    border: `1px solid ${t.colors.border}`,
  },
  detailTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '28px',
  },
  detailName: { fontSize: '26px', fontWeight: '800', color: t.colors.textPrimary, margin: '0 0 4px', fontFamily: t.fonts.heading, letterSpacing: '-0.02em' },
  detailSub: { fontSize: t.fontSizes.md, color: t.colors.textSecondary, margin: 0 },
  amountRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    marginBottom: '24px',
  },
  amountBox: {
    backgroundColor: t.colors.bg,
    borderRadius: t.radius.md,
    padding: '16px 18px',
  },
  amountLabel: { fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.06em' },
  amountValue: { fontSize: '22px', fontWeight: '800', color: t.colors.textPrimary, fontFamily: t.fonts.heading, letterSpacing: '-0.02em' },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  detailField: {
    backgroundColor: t.colors.bg,
    borderRadius: t.radius.md,
    padding: '14px 16px',
  },
  detailFieldLabel: {
    fontSize: t.fontSizes.xs,
    color: t.colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: '4px',
    letterSpacing: '0.06em',
  },
  detailFieldValue: { fontSize: t.fontSizes.md, color: t.colors.textPrimary },
}