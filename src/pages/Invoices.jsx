import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import { statusConfig, computeDisplayStatus } from '../utils/invoiceStatus'
import { quarterFromDate, quarterInfoFromDate } from '../utils/dates'

const emptyLineItem = () => ({ description: '', quantity: '1', unit_price: '' })

function lineItemsTotal(items) {
  return items.reduce((sum, li) => sum + ((parseFloat(li.quantity) || 0) * (parseFloat(li.unit_price) || 0)), 0)
}

const FREQUENCY_LABELS = { weekly: 'Weekly', monthly: 'Monthly', custom: 'Custom' }

const DEFAULT_INCOME_CATEGORIES = [
  'Service Income',
  'Product Sales',
  'Royalties & Licensing',
  'Brand Deals & Sponsorships',
  'Teaching & Education',
  'Other Income',
]

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
const CURRENT_YEAR = new Date().getFullYear()

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function inSelectedYear(dateStr, year) {
  if (!dateStr) return true
  return quarterInfoFromDate(dateStr)?.year === year
}

const incomeInputStyle = { width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }
const incomeLabelStyle = { fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }
const incomeCardStyle = { background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, overflow: 'hidden' }
const incomeTableWrapStyle = { ...incomeCardStyle, overflow: 'auto' }
const incomeThStyle = { textAlign: 'left', padding: '10px 14px', fontSize: t.fontSizes.xs, fontWeight: '700', color: t.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em', background: t.colors.bg, borderBottom: `1px solid ${t.colors.border}`, borderRight: `1px solid ${t.colors.borderLight}`, whiteSpace: 'nowrap' }
const incomeTdStyle = { padding: '9px 14px', fontSize: t.fontSizes.sm, color: t.colors.textPrimary, borderBottom: `1px solid ${t.colors.borderLight}`, borderRight: `1px solid ${t.colors.borderLight}`, verticalAlign: 'middle' }
const incomeQuarterBadgeStyle = { fontSize: t.fontSizes.xs, background: t.colors.primaryLight, color: t.colors.primary, padding: '2px 8px', borderRadius: t.radius.full }
const incomeRowActionBtnStyle = (danger) => ({ background: 'none', border: `1px solid ${t.colors.border}`, borderRadius: t.radius.sm, padding: '4px 8px', fontSize: t.fontSizes.xs, color: danger ? t.colors.danger : t.colors.textSecondary, cursor: 'pointer', fontFamily: t.fonts.sans, whiteSpace: 'nowrap' })

export default function Invoices({ businessSpaceId }) {
  const [activeTab, setActiveTab] = useState('invoices')

  // ── Additional Income (moved over from the old Budget page's Income tab) ──
  const [incomeYear, setIncomeYear] = useState(CURRENT_YEAR)
  const [revenue, setRevenue] = useState([])
  const [incomeProjects, setIncomeProjects] = useState([])
  const [incomeCategories, setIncomeCategories] = useState([])
  const [showIncomeForm, setShowIncomeForm] = useState(false)
  const [editingIncome, setEditingIncome] = useState(null)
  const [incomeForm, setIncomeForm] = useState({ income_stream: '', amount: '', date: '', status: 'received', tax_category: '', project_id: '', notes: '' })
  const [incomeActiveView, setIncomeActiveView] = useState('overview') // overview | by-project
  const [showIncomeCategoryManager, setShowIncomeCategoryManager] = useState(false)
  const [newIncomeCategoryName, setNewIncomeCategoryName] = useState('')
  const [editingIncomeCategoryId, setEditingIncomeCategoryId] = useState(null)
  const [editingIncomeCategoryName, setEditingIncomeCategoryName] = useState('')
  const [incomeFormError, setIncomeFormError] = useState('')
  const [incomeConfirmModal, setIncomeConfirmModal] = useState(null) // { item, amount }

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
    due_date: '',
    lineItems: [emptyLineItem()],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [shareUrl, setShareUrl] = useState(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const [recurringRules, setRecurringRules] = useState([])
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [ruleForm, setRuleForm] = useState({
    client_id: '',
    project_id: '',
    frequency: 'monthly',
    interval_days: '',
    next_run_date: '',
    lineItems: [emptyLineItem()],
  })
  const [ruleSaving, setRuleSaving] = useState(false)
  const [ruleError, setRuleError] = useState(null)

  useEffect(() => {
    fetchInvoices()
    fetchClients()
    fetchProjects()
    fetchRecurringRules()
  }, [])

  useEffect(() => {
    if (businessSpaceId) fetchAdditionalIncome()
  }, [businessSpaceId])

  useEffect(() => {
    setShareUrl(null)
    if (!selectedInvoice || selectedInvoice.status === 'draft' || !selectedInvoice.client_id) return
    let cancelled = false
    setShareLoading(true)
    ensurePortalLink(selectedInvoice.client_id).then(token => {
      if (!cancelled && token) setShareUrl(`${window.location.origin}?portal=${token}&invoice=${selectedInvoice.id}`)
      if (!cancelled) setShareLoading(false)
    })
    return () => { cancelled = true }
  }, [selectedInvoice?.id, selectedInvoice?.status])

  async function fetchInvoices() {
    setLoading(true)
    const { data, error } = await supabase
      .from('invoices')
      .select('*, clients(name, company), projects(title), line_items(*), invoice_payments(*)')
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

  async function fetchRecurringRules() {
    const { data } = await supabase
      .from('recurring_invoice_rules')
      .select('*, clients(name, company), projects(title), recurring_invoice_rule_line_items(*)')
      .order('created_at', { ascending: false })
    if (data) setRecurringRules(data)
  }

  async function fetchAdditionalIncome() {
    const [revenueRes, projRes, categoryRes] = await Promise.all([
      supabase.from('revenue').select('*').eq('business_space_id', businessSpaceId).order('date', { ascending: false }),
      supabase.from('projects').select('id, title').eq('business_space_id', businessSpaceId).order('created_at', { ascending: false }),
      supabase.from('budget_categories').select('*').eq('business_space_id', businessSpaceId).eq('type', 'income').order('position', { ascending: true }),
    ])
    setRevenue(revenueRes.data || [])
    setIncomeProjects(projRes.data || [])
    let categories = categoryRes.data || []
    if (categories.length === 0) {
      const seedRows = DEFAULT_INCOME_CATEGORIES.map((name, i) => ({ business_space_id: businessSpaceId, type: 'income', name, position: i }))
      const { data: seeded } = await supabase.from('budget_categories').insert(seedRows).select('*')
      categories = seeded || []
    }
    setIncomeCategories(categories)
  }

  async function addIncomeCategory() {
    const name = newIncomeCategoryName.trim()
    if (!name) return
    if (incomeCategories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      setNewIncomeCategoryName('')
      return
    }
    const { data } = await supabase.from('budget_categories').insert({ business_space_id: businessSpaceId, type: 'income', name, position: incomeCategories.length }).select('*').single()
    if (!data) return
    setIncomeCategories(p => [...p, data])
    setNewIncomeCategoryName('')
  }

  async function renameIncomeCategory(cat) {
    const name = editingIncomeCategoryName.trim()
    setEditingIncomeCategoryId(null)
    if (!name || name === cat.name) return
    await supabase.from('budget_categories').update({ name }).eq('id', cat.id)
    await supabase.from('revenue').update({ tax_category: name }).eq('business_space_id', businessSpaceId).eq('tax_category', cat.name)
    fetchAdditionalIncome()
  }

  async function deleteIncomeCategory(cat) {
    const inUse = revenue.some(r => r.tax_category === cat.name)
    if (inUse) {
      alert(`Can't delete "${cat.name}" — it's still used by existing entries. Reassign or delete those first.`)
      return
    }
    await supabase.from('budget_categories').delete().eq('id', cat.id)
    setIncomeCategories(p => p.filter(c => c.id !== cat.id))
  }

  async function saveIncome() {
    if (!incomeForm.income_stream || !incomeForm.amount) {
      setIncomeFormError('Source and Amount are required.')
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      business_space_id: businessSpaceId,
      income_stream: incomeForm.income_stream,
      amount: Number(incomeForm.amount) || 0,
      date: incomeForm.date || null,
      status: incomeForm.status,
      tax_category: incomeForm.tax_category || null,
      project_id: incomeForm.project_id || null,
      notes: incomeForm.notes || null,
    }
    const { error } = editingIncome
      ? await supabase.from('revenue').update(payload).eq('id', editingIncome.id)
      : await supabase.from('revenue').insert({ ...payload, user_id: user.id })
    if (error) {
      setIncomeFormError(error.message)
      return
    }
    resetIncomeForm()
    fetchAdditionalIncome()
  }

  async function deleteIncome(id) {
    await supabase.from('revenue').delete().eq('id', id)
    fetchAdditionalIncome()
  }

  // Received → Pending is reversible with no amount consequence — instant, no confirmation needed.
  async function revertIncomeToPending(entry) {
    await supabase.from('revenue').update({ status: 'pending' }).eq('id', entry.id)
    setRevenue(prev => prev.map(r => r.id === entry.id ? { ...r, status: 'pending' } : r))
  }

  // Pending → Received: amount received sometimes differs from what was invoiced, so this takes a confirmed amount from a popup.
  async function confirmIncomeReceived(entry, amount) {
    const updates = { status: 'received', amount: Number(amount) || 0 }
    await supabase.from('revenue').update(updates).eq('id', entry.id)
    setRevenue(prev => prev.map(r => r.id === entry.id ? { ...r, ...updates } : r))
  }

  function handleIncomeStatusClick(entry) {
    if (entry.status === 'pending') setIncomeConfirmModal({ item: entry, amount: entry.amount })
    else revertIncomeToPending(entry)
  }

  function resetIncomeForm() {
    setIncomeForm({ income_stream: '', amount: '', date: '', status: 'received', tax_category: '', project_id: '', notes: '' })
    setEditingIncome(null)
    setShowIncomeForm(false)
    setIncomeFormError('')
  }

  function startEditIncome(entry) {
    setIncomeForm({
      income_stream: entry.income_stream || '',
      amount: entry.amount || '',
      date: entry.date || '',
      status: entry.status || 'received',
      tax_category: entry.tax_category || '',
      project_id: entry.project_id || '',
      notes: entry.notes || '',
    })
    setEditingIncome(entry)
    setShowIncomeForm(true)
    setIncomeFormError('')
  }

  function updateLineItem(index, field, value) {
    const items = [...form.lineItems]
    items[index] = { ...items[index], [field]: value }
    setForm({ ...form, lineItems: items })
  }

  function updateRuleLineItem(index, field, value) {
    const items = [...ruleForm.lineItems]
    items[index] = { ...items[index], [field]: value }
    setRuleForm({ ...ruleForm, lineItems: items })
  }

  async function handleSaveInvoice() {
    setSaving(true)
    setError(null)
    const validItems = form.lineItems.filter(li => li.description.trim())
    if (validItems.length === 0) {
      setError('Add at least one line item')
      setSaving(false)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        business_space_id: businessSpaceId,
        invoice_number: form.invoice_number || null,
        client_id: form.client_id || null,
        project_id: form.project_id || null,
        due_date: form.due_date || null,
        status: 'draft',
        user_id: user.id,
      })
      .select()
      .single()
    if (invoiceError) {
      setError(invoiceError.message)
      setSaving(false)
      return
    }
    const { error: lineItemsError } = await supabase.from('line_items').insert(
      validItems.map(li => ({
        invoice_id: invoice.id,
        description: li.description,
        quantity: parseFloat(li.quantity) || 1,
        unit_price: parseFloat(li.unit_price) || 0,
      }))
    )
    if (lineItemsError) setError(lineItemsError.message)
    else {
      setShowForm(false)
      setForm({ invoice_number: '', client_id: '', project_id: '', due_date: '', lineItems: [emptyLineItem()] })
      fetchInvoices()
    }
    setSaving(false)
  }

  async function handleDeleteInvoice(id) {
    if (!confirm('Delete this invoice?')) return
    await supabase.from('invoices').delete().eq('id', id)
    fetchInvoices()
    if (selectedInvoice?.id === id) setSelectedInvoice(null)
  }

  // Draft invoices are staff-only; the client's portal only shows sent+
  // invoices, so this is also the moment a share link becomes meaningful.
  async function ensurePortalLink(clientId) {
    const { data: existing } = await supabase
      .from('portal_links')
      .select('token')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    if (existing) return existing.token

    const { data: created, error } = await supabase
      .from('portal_links')
      .insert({ client_id: clientId, business_space_id: businessSpaceId })
      .select('token')
      .single()
    if (error) return null
    return created.token
  }

  async function handleMarkSent(invoice) {
    await supabase.from('invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', invoice.id)
    await fetchInvoices()
    // The selectedInvoice.status change here triggers the share-link
    // useEffect below, which creates/looks up the portal link.
    setSelectedInvoice(prev => prev && { ...prev, status: 'sent', sent_at: new Date().toISOString() })
  }

  async function handleCopyShareLink() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // amount_paid/status/paid_date are all derived from invoice_payments by
  // a DB trigger (recalc_invoice_paid) — this just records the payment and
  // re-reads the invoice rather than computing the new totals itself.
  async function handleRecordPayment(invoice) {
    const amount = parseFloat(paymentAmount)
    if (!amount || amount <= 0) return
    const { error } = await supabase.from('invoice_payments').insert({
      invoice_id: invoice.id,
      amount,
      note: paymentNote || null,
    })
    if (error) { setError(error.message); return }
    setPaymentAmount('')
    setPaymentNote('')
    await refetchSelectedInvoice(invoice.id)
  }

  async function handleDeletePayment(paymentId, invoiceId) {
    if (!confirm('Remove this payment?')) return
    await supabase.from('invoice_payments').delete().eq('id', paymentId)
    await refetchSelectedInvoice(invoiceId)
  }

  async function refetchSelectedInvoice(invoiceId) {
    await fetchInvoices()
    const { data } = await supabase
      .from('invoices')
      .select('*, clients(name, company), projects(title), line_items(*), invoice_payments(*)')
      .eq('id', invoiceId)
      .single()
    if (data) setSelectedInvoice(data)
  }

  async function handleSaveRule() {
    setRuleSaving(true)
    setRuleError(null)
    const validItems = ruleForm.lineItems.filter(li => li.description.trim())
    if (!ruleForm.client_id) {
      setRuleError('Choose a client')
      setRuleSaving(false)
      return
    }
    if (!ruleForm.next_run_date) {
      setRuleError('Choose a first send date')
      setRuleSaving(false)
      return
    }
    if (validItems.length === 0) {
      setRuleError('Add at least one line item')
      setRuleSaving(false)
      return
    }
    if (ruleForm.frequency === 'custom' && !ruleForm.interval_days) {
      setRuleError('Set an interval for a custom frequency')
      setRuleSaving(false)
      return
    }
    const { data: rule, error: ruleErr } = await supabase
      .from('recurring_invoice_rules')
      .insert({
        business_space_id: businessSpaceId,
        client_id: ruleForm.client_id,
        project_id: ruleForm.project_id || null,
        frequency: ruleForm.frequency,
        interval_days: ruleForm.frequency === 'custom' ? parseInt(ruleForm.interval_days, 10) : null,
        next_run_date: ruleForm.next_run_date,
        active: true,
      })
      .select()
      .single()
    if (ruleErr) {
      setRuleError(ruleErr.message)
      setRuleSaving(false)
      return
    }
    const { error: itemsErr } = await supabase.from('recurring_invoice_rule_line_items').insert(
      validItems.map(li => ({
        recurring_rule_id: rule.id,
        description: li.description,
        quantity: parseFloat(li.quantity) || 1,
        unit_price: parseFloat(li.unit_price) || 0,
      }))
    )
    if (itemsErr) setRuleError(itemsErr.message)
    else {
      setShowRuleForm(false)
      setRuleForm({ client_id: '', project_id: '', frequency: 'monthly', interval_days: '', next_run_date: '', lineItems: [emptyLineItem()] })
      fetchRecurringRules()
    }
    setRuleSaving(false)
  }

  async function handleToggleRuleActive(rule) {
    await supabase.from('recurring_invoice_rules').update({ active: !rule.active }).eq('id', rule.id)
    fetchRecurringRules()
  }

  async function handleDeleteRule(rule) {
    if (!confirm('Delete this recurring rule? Already-generated invoices are kept.')) return
    await supabase.from('recurring_invoice_rules').delete().eq('id', rule.id)
    fetchRecurringRules()
  }

  const totalRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount_paid) || 0), 0)
  const totalOutstanding = invoices.reduce((sum, inv) => sum + ((parseFloat(inv.total_amount) || 0) - (parseFloat(inv.amount_paid) || 0)), 0)
  const statusCounts = invoices.reduce((acc, inv) => {
    const s = computeDisplayStatus(inv)
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})
  const statusBreakdown = ['draft', 'sent', 'partial', 'overdue', 'paid']
    .filter(s => statusCounts[s])
    .map(s => `${statusCounts[s]} ${statusConfig[s].label.toLowerCase()}`)
    .join(' · ')

  // ── Additional Income derived data ──
  const yearRevenue = revenue.filter(r => inSelectedYear(r.date, incomeYear))
  const totalIncomeReceived = yearRevenue.filter(r => r.status === 'received').reduce((s, r) => s + Number(r.amount || 0), 0)
  const totalIncomePending = yearRevenue.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.amount || 0), 0)

  const incomeByCategory = incomeCategories.map(({ name: cat }) => {
    const items = yearRevenue.filter(r => r.tax_category === cat)
    return {
      category: cat,
      received: items.filter(r => r.status === 'received').reduce((s, r) => s + Number(r.amount || 0), 0),
      pending: items.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.amount || 0), 0),
      items,
    }
  }).filter(c => c.items.length > 0)

  const incomeByProject = incomeProjects.map(proj => {
    const items = yearRevenue.filter(r => r.project_id === proj.id)
    return {
      ...proj,
      received: items.filter(r => r.status === 'received').reduce((s, r) => s + Number(r.amount || 0), 0),
      pending: items.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.amount || 0), 0),
      items,
    }
  }).filter(p => p.items.length > 0)

  const unassignedIncome = yearRevenue.filter(r => !r.project_id)

  if (selectedInvoice) {
    const displayStatus = computeDisplayStatus(selectedInvoice)
    const sc = statusConfig[displayStatus]
    const outstanding = (parseFloat(selectedInvoice.total_amount) || 0) - (parseFloat(selectedInvoice.amount_paid) || 0)
    return (
      <div style={styles.page}>
        <div style={styles.detailHeader}>
          <button onClick={() => setSelectedInvoice(null)} style={styles.backBtn}>
            ← Back to invoices
          </button>
          <button onClick={() => handleDeleteInvoice(selectedInvoice.id)} style={styles.deleteBtn}>
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

          <div style={styles.lineItemsTable}>
            <div style={styles.lineItemsHeader}>
              <span>Description</span>
              <span>Qty</span>
              <span>Unit price</span>
              <span>Total</span>
            </div>
            {(selectedInvoice.line_items || []).map(li => (
              <div key={li.id} style={styles.lineItemsRow}>
                <span>{li.description}</span>
                <span>{li.quantity}</span>
                <span>${parseFloat(li.unit_price || 0).toLocaleString()}</span>
                <span>${parseFloat(li.total || 0).toLocaleString()}</span>
              </div>
            ))}
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

          <div style={styles.actionsRow}>
            {selectedInvoice.status === 'draft' && (
              <button onClick={() => handleMarkSent(selectedInvoice)} style={styles.saveBtn}>
                Mark as sent
              </button>
            )}
            {selectedInvoice.status !== 'paid' && (
              <div style={styles.paymentRow}>
                <input
                  style={{ ...styles.input, width: '140px' }}
                  type="number"
                  placeholder="Amount received"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                />
                <input
                  style={{ ...styles.input, width: '160px' }}
                  placeholder="Note (optional)"
                  value={paymentNote}
                  onChange={e => setPaymentNote(e.target.value)}
                />
                <button onClick={() => handleRecordPayment(selectedInvoice)} style={styles.saveBtn}>
                  Record payment
                </button>
              </div>
            )}
          </div>

          {(selectedInvoice.invoice_payments || []).length > 0 && (
            <div style={styles.shareRow}>
              <div style={styles.detailFieldLabel}>Payment history</div>
              <div style={styles.paymentHistory}>
                {[...selectedInvoice.invoice_payments]
                  .sort((a, b) => new Date(b.paid_date) - new Date(a.paid_date))
                  .map(p => (
                    <div key={p.id} style={styles.paymentHistoryRow}>
                      <span style={styles.tableCell}>{new Date(p.paid_date).toLocaleDateString()}</span>
                      <span style={{ ...styles.tableCell, color: t.colors.success, fontWeight: '600' }}>
                        ${parseFloat(p.amount).toLocaleString()}
                      </span>
                      <span style={styles.tableCell}>{p.note || '—'}</span>
                      <button onClick={() => handleDeletePayment(p.id, selectedInvoice.id)} style={styles.removeRowBtn}>
                        ×
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {selectedInvoice.status !== 'draft' && selectedInvoice.client_id && (
            <div style={styles.shareRow}>
              <div style={styles.detailFieldLabel}>Client link</div>
              {shareLoading ? (
                <div style={styles.tableCell}>Generating link...</div>
              ) : shareUrl ? (
                <div style={styles.paymentRow}>
                  <input style={{ ...styles.input, flex: 1 }} readOnly value={shareUrl} onFocus={e => e.target.select()} />
                  <button onClick={handleCopyShareLink} style={styles.cancelBtn}>
                    {copied ? 'Copied!' : 'Copy link'}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>
            {activeTab === 'invoices' ? 'Invoices' : activeTab === 'recurring' ? 'Recurring' : 'Additional Income'}
          </h2>
          {activeTab === 'invoices' && (
            <p style={styles.subtitle}>{invoices.length} total invoice{invoices.length !== 1 ? 's' : ''}</p>
          )}
        </div>
        {activeTab === 'invoices' ? (
          <button onClick={() => setShowForm(true)} style={styles.addBtn}>
            + New invoice
          </button>
        ) : activeTab === 'recurring' ? (
          <button onClick={() => setShowRuleForm(true)} style={styles.addBtn}>
            + New recurring rule
          </button>
        ) : (
          <button onClick={() => { setIncomeFormError(''); setShowIncomeForm(true) }} style={styles.addBtn}>
            + Log income
          </button>
        )}
      </div>

      <div style={styles.tabs}>
        <button
          onClick={() => setActiveTab('invoices')}
          style={{ ...styles.tab, ...(activeTab === 'invoices' ? styles.tabActive : {}) }}
        >
          Invoices
        </button>
        <button
          onClick={() => setActiveTab('recurring')}
          style={{ ...styles.tab, ...(activeTab === 'recurring' ? styles.tabActive : {}) }}
        >
          Recurring
        </button>
        <button
          onClick={() => setActiveTab('additional-income')}
          style={{ ...styles.tab, ...(activeTab === 'additional-income' ? styles.tabActive : {}) }}
        >
          Additional Income
        </button>
      </div>

      {activeTab === 'invoices' && (
        <>
          <div style={styles.summaryRow}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Invoices</div>
              <div style={styles.summaryValue}>{invoices.length}</div>
              {statusBreakdown && <div style={styles.summaryBreakdown}>{statusBreakdown}</div>}
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Total revenue</div>
              <div style={{ ...styles.summaryValueSecondary, color: t.colors.success }}>
                ${totalRevenue.toLocaleString()}
              </div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Outstanding</div>
              <div style={{ ...styles.summaryValueSecondary, color: totalOutstanding > 0 ? t.colors.warning : t.colors.success }}>
                ${totalOutstanding.toLocaleString()}
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
                  <label style={styles.label}>Due date</label>
                  <input
                    style={styles.input}
                    type="date"
                    value={form.due_date}
                    onChange={e => setForm({ ...form, due_date: e.target.value })}
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
              </div>

              <div style={styles.lineItemsEditor}>
                <div style={styles.lineItemsEditorHeader}>
                  <span>Description</span>
                  <span>Qty</span>
                  <span>Unit price</span>
                  <span></span>
                </div>
                {form.lineItems.map((li, i) => (
                  <div key={i} style={styles.lineItemsEditorRow}>
                    <input
                      style={styles.input}
                      placeholder="Description"
                      value={li.description}
                      onChange={e => updateLineItem(i, 'description', e.target.value)}
                    />
                    <input
                      style={styles.input}
                      type="number"
                      value={li.quantity}
                      onChange={e => updateLineItem(i, 'quantity', e.target.value)}
                    />
                    <input
                      style={styles.input}
                      type="number"
                      placeholder="0.00"
                      value={li.unit_price}
                      onChange={e => updateLineItem(i, 'unit_price', e.target.value)}
                    />
                    <button
                      onClick={() => setForm({ ...form, lineItems: form.lineItems.filter((_, idx) => idx !== i) })}
                      style={styles.removeRowBtn}
                      disabled={form.lineItems.length === 1}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setForm({ ...form, lineItems: [...form.lineItems, emptyLineItem()] })}
                  style={styles.addRowBtn}
                >
                  + Add line item
                </button>
                <div style={styles.lineItemsTotal}>
                  Total: ${lineItemsTotal(form.lineItems).toLocaleString()}
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
                  onClick={handleSaveInvoice}
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
              <p style={styles.emptyText}>Create your first invoice to start getting paid for your work</p>
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
                const sc = statusConfig[computeDisplayStatus(invoice)]
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
        </>
      )}

      {activeTab === 'recurring' && (
        <>
          {showRuleForm && (
            <div style={styles.formCard}>
              <h3 style={styles.formTitle}>New recurring rule</h3>
              {ruleError && <div style={styles.error}>{ruleError}</div>}
              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Client</label>
                  <select
                    style={styles.input}
                    value={ruleForm.client_id}
                    onChange={e => setRuleForm({ ...ruleForm, client_id: e.target.value })}
                  >
                    <option value="">Choose a client</option>
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
                    value={ruleForm.project_id}
                    onChange={e => setRuleForm({ ...ruleForm, project_id: e.target.value })}
                  >
                    <option value="">No project</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Frequency</label>
                  <select
                    style={styles.input}
                    value={ruleForm.frequency}
                    onChange={e => setRuleForm({ ...ruleForm, frequency: e.target.value })}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="custom">Custom interval</option>
                  </select>
                </div>
                {ruleForm.frequency === 'custom' && (
                  <div style={styles.field}>
                    <label style={styles.label}>Interval (days)</label>
                    <input
                      style={styles.input}
                      type="number"
                      value={ruleForm.interval_days}
                      onChange={e => setRuleForm({ ...ruleForm, interval_days: e.target.value })}
                    />
                  </div>
                )}
                <div style={styles.field}>
                  <label style={styles.label}>First send date</label>
                  <input
                    style={styles.input}
                    type="date"
                    value={ruleForm.next_run_date}
                    onChange={e => setRuleForm({ ...ruleForm, next_run_date: e.target.value })}
                  />
                </div>
              </div>

              <div style={styles.lineItemsEditor}>
                <div style={styles.lineItemsEditorHeader}>
                  <span>Description</span>
                  <span>Qty</span>
                  <span>Unit price</span>
                  <span></span>
                </div>
                {ruleForm.lineItems.map((li, i) => (
                  <div key={i} style={styles.lineItemsEditorRow}>
                    <input
                      style={styles.input}
                      placeholder="Description"
                      value={li.description}
                      onChange={e => updateRuleLineItem(i, 'description', e.target.value)}
                    />
                    <input
                      style={styles.input}
                      type="number"
                      value={li.quantity}
                      onChange={e => updateRuleLineItem(i, 'quantity', e.target.value)}
                    />
                    <input
                      style={styles.input}
                      type="number"
                      placeholder="0.00"
                      value={li.unit_price}
                      onChange={e => updateRuleLineItem(i, 'unit_price', e.target.value)}
                    />
                    <button
                      onClick={() => setRuleForm({ ...ruleForm, lineItems: ruleForm.lineItems.filter((_, idx) => idx !== i) })}
                      style={styles.removeRowBtn}
                      disabled={ruleForm.lineItems.length === 1}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setRuleForm({ ...ruleForm, lineItems: [...ruleForm.lineItems, emptyLineItem()] })}
                  style={styles.addRowBtn}
                >
                  + Add line item
                </button>
                <div style={styles.lineItemsTotal}>
                  Total per invoice: ${lineItemsTotal(ruleForm.lineItems).toLocaleString()}
                </div>
              </div>

              <div style={styles.formActions}>
                <button
                  onClick={() => { setShowRuleForm(false); setRuleError(null) }}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRule}
                  style={styles.saveBtn}
                  disabled={ruleSaving}
                >
                  {ruleSaving ? 'Saving...' : 'Save rule'}
                </button>
              </div>
            </div>
          )}

          {recurringRules.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🔁</div>
              <h3 style={styles.emptyTitle}>No recurring rules yet</h3>
              <p style={styles.emptyText}>Set up a rule to auto-generate draft invoices on a schedule</p>
              <button onClick={() => setShowRuleForm(true)} style={styles.addBtn}>
                + New recurring rule
              </button>
            </div>
          ) : (
            <div style={styles.table}>
              <div style={styles.recurringTableHeader}>
                <span>Client</span>
                <span>Project</span>
                <span>Frequency</span>
                <span>Next invoice</span>
                <span>Per-invoice total</span>
                <span>Status</span>
                <span></span>
              </div>
              {recurringRules.map(rule => (
                <div key={rule.id} style={styles.recurringTableRow}>
                  <span style={styles.tableCell}>{rule.clients ? rule.clients.name : '—'}</span>
                  <span style={styles.tableCell}>{rule.projects ? rule.projects.title : '—'}</span>
                  <span style={styles.tableCell}>
                    {FREQUENCY_LABELS[rule.frequency]}{rule.frequency === 'custom' ? ` (${rule.interval_days}d)` : ''}
                  </span>
                  <span style={styles.tableCell}>{new Date(rule.next_run_date).toLocaleDateString()}</span>
                  <span style={styles.tableCell}>
                    ${lineItemsTotal(rule.recurring_invoice_rule_line_items || []).toLocaleString()}
                  </span>
                  <span>
                    <div style={{
                      ...styles.statusBadge,
                      backgroundColor: rule.active ? t.colors.successLight : t.colors.bg,
                      color: rule.active ? t.colors.success : t.colors.textTertiary,
                    }}>
                      {rule.active ? 'Active' : 'Paused'}
                    </div>
                  </span>
                  <span style={styles.recurringRowActions}>
                    <button onClick={() => handleToggleRuleActive(rule)} style={styles.cancelBtn}>
                      {rule.active ? 'Pause' : 'Resume'}
                    </button>
                    <button onClick={() => handleDeleteRule(rule)} style={styles.deleteBtn}>
                      Delete
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'additional-income' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <select
              value={incomeYear}
              onChange={e => setIncomeYear(Number(e.target.value))}
              style={{ padding: '8px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, color: t.colors.textPrimary, background: t.colors.bgCard, fontFamily: t.fonts.sans }}
            >
              {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Quarterly income cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
            {QUARTERS.map(q => {
              const items = yearRevenue.filter(r => quarterFromDate(r.date) === q)
              const received = items.filter(r => r.status === 'received').reduce((s, r) => s + Number(r.amount || 0), 0)
              const pending = items.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.amount || 0), 0)
              return (
                <div key={q} style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '16px 18px' }}>
                  <div style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary, marginBottom: '8px' }}>{q}</div>
                  <div style={{ fontSize: t.fontSizes.md, fontWeight: '700', color: t.colors.success || t.colors.primary }}>{fmt(received)}</div>
                  <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '2px' }}>received</div>
                  {pending > 0 && <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '4px' }}>{fmt(pending)} pending</div>}
                </div>
              )
            })}
          </div>

          <div style={{ borderTop: `1px solid ${t.colors.border}`, marginBottom: '24px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: t.fontSizes.xs, fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.primary, marginBottom: '4px' }}>Money</div>
              <h3 style={{ fontFamily: t.fonts.heading, fontSize: '18px', fontWeight: '700', color: t.colors.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>Income Breakdown</h3>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowIncomeCategoryManager(v => !v)} style={{ padding: '9px 16px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: t.colors.bgCard, color: t.colors.textPrimary, fontSize: t.fontSizes.sm, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>Manage Categories</button>
              <button onClick={() => { setIncomeFormError(''); setShowIncomeForm(true) }} style={{ padding: '9px 16px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.sm, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>+ Log Income</button>
            </div>
          </div>

          {showIncomeCategoryManager && (
            <IncomeCategoryManagerPanel
              categories={incomeCategories}
              newCategoryName={newIncomeCategoryName}
              setNewCategoryName={setNewIncomeCategoryName}
              editingCategoryId={editingIncomeCategoryId}
              setEditingCategoryId={setEditingIncomeCategoryId}
              editingCategoryName={editingIncomeCategoryName}
              setEditingCategoryName={setEditingIncomeCategoryName}
              onAdd={addIncomeCategory}
              onRename={renameIncomeCategory}
              onDelete={deleteIncomeCategory}
              onClose={() => setShowIncomeCategoryManager(false)}
            />
          )}

          {showIncomeForm && (
            <div style={{ ...incomeCardStyle, padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 20px' }}>{editingIncome ? 'Edit Income' : 'Log Income'}</h3>
              {incomeFormError && <div style={{ padding: '10px 14px', borderRadius: t.radius.md, background: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.sm, marginBottom: '16px' }}>{incomeFormError}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={incomeLabelStyle}>Source *</label>
                  <input value={incomeForm.income_stream} onChange={e => setIncomeForm(p => ({ ...p, income_stream: e.target.value }))} placeholder="e.g. Client retainer, sponsorship" style={incomeInputStyle} />
                </div>
                <div>
                  <label style={incomeLabelStyle}>Amount *</label>
                  <input type="number" value={incomeForm.amount} onChange={e => setIncomeForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" style={incomeInputStyle} />
                </div>
                <div>
                  <label style={incomeLabelStyle}>
                    Date {incomeForm.date && <span style={{ color: t.colors.primary, fontWeight: '600' }}>→ {quarterFromDate(incomeForm.date)}</span>}
                  </label>
                  <input type="date" value={incomeForm.date} onChange={e => setIncomeForm(p => ({ ...p, date: e.target.value }))} style={incomeInputStyle} />
                </div>
                <div>
                  <label style={incomeLabelStyle}>Status</label>
                  <select value={incomeForm.status} onChange={e => setIncomeForm(p => ({ ...p, status: e.target.value }))} style={incomeInputStyle}>
                    <option value="received">Received</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div>
                  <label style={incomeLabelStyle}>Category</label>
                  <select value={incomeForm.tax_category} onChange={e => setIncomeForm(p => ({ ...p, tax_category: e.target.value }))} style={incomeInputStyle}>
                    <option value="">Select category</option>
                    {incomeCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={incomeLabelStyle}>Link to Event/Project</label>
                  <select value={incomeForm.project_id} onChange={e => setIncomeForm(p => ({ ...p, project_id: e.target.value }))} style={incomeInputStyle}>
                    <option value="">Unassigned</option>
                    {incomeProjects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={incomeLabelStyle}>Notes</label>
                  <input value={incomeForm.notes} onChange={e => setIncomeForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any additional context..." style={incomeInputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button onClick={saveIncome} style={{ padding: '9px 20px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>{editingIncome ? 'Save Changes' : 'Log Income'}</button>
                <button onClick={resetIncomeForm} style={{ padding: '9px 20px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '4px', background: t.colors.bg, borderRadius: t.radius.md, padding: '4px', width: 'fit-content', marginBottom: '20px' }}>
            {['overview', 'by-project'].map(v => (
              <button key={v} onClick={() => setIncomeActiveView(v)} style={{ padding: '7px 16px', borderRadius: t.radius.sm, border: 'none', background: incomeActiveView === v ? t.colors.bgCard : 'transparent', color: incomeActiveView === v ? t.colors.textPrimary : t.colors.textSecondary, fontSize: t.fontSizes.sm, fontWeight: incomeActiveView === v ? '600' : '400', fontFamily: t.fonts.sans, cursor: 'pointer', boxShadow: incomeActiveView === v ? t.shadows.sm : 'none' }}>
                {v === 'overview' ? 'By Category' : 'By Event/Project'}
              </button>
            ))}
          </div>

          {incomeActiveView === 'overview' && (
            incomeByCategory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', background: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}`, color: t.colors.textSecondary }}>
                No income logged yet for {incomeYear} — use "+ Log Income" above to get started.
              </div>
            ) : (
              <div style={incomeTableWrapStyle}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={incomeThStyle}>Item</th>
                      <th style={incomeThStyle}>Category</th>
                      <th style={incomeThStyle}>Event/Project</th>
                      <th style={incomeThStyle}>Quarter</th>
                      <th style={incomeThStyle}>Notes</th>
                      <th style={incomeThStyle}>Status</th>
                      <th style={{ ...incomeThStyle, textAlign: 'right' }}>Amount</th>
                      <th style={{ ...incomeThStyle, borderRight: 'none' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeByCategory.map(cat => (
                      <IncomeGroup key={cat.category} label={cat.category} received={cat.received} pending={cat.pending} items={cat.items} projects={incomeProjects} onEdit={startEditIncome} onDelete={deleteIncome} onToggleStatus={handleIncomeStatusClick} />
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {incomeActiveView === 'by-project' && (
            incomeByProject.length === 0 && unassignedIncome.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', background: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}`, color: t.colors.textSecondary }}>
                No income logged yet for {incomeYear} — use "+ Log Income" above to get started.
              </div>
            ) : (
              <div style={incomeTableWrapStyle}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={incomeThStyle}>Item</th>
                      <th style={incomeThStyle}>Category</th>
                      <th style={incomeThStyle}>Event/Project</th>
                      <th style={incomeThStyle}>Quarter</th>
                      <th style={incomeThStyle}>Notes</th>
                      <th style={incomeThStyle}>Status</th>
                      <th style={{ ...incomeThStyle, textAlign: 'right' }}>Amount</th>
                      <th style={{ ...incomeThStyle, borderRight: 'none' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeByProject.map(proj => (
                      <IncomeGroup key={proj.id} label={proj.title} received={proj.received} pending={proj.pending} items={proj.items} projects={incomeProjects} onEdit={startEditIncome} onDelete={deleteIncome} onToggleStatus={handleIncomeStatusClick} />
                    ))}
                    {unassignedIncome.length > 0 && (
                      <IncomeGroup
                        label="Unassigned"
                        received={unassignedIncome.filter(r => r.status === 'received').reduce((s, r) => s + Number(r.amount || 0), 0)}
                        pending={unassignedIncome.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.amount || 0), 0)}
                        items={unassignedIncome}
                        projects={incomeProjects}
                        onEdit={startEditIncome}
                        onDelete={deleteIncome}
                        onToggleStatus={handleIncomeStatusClick}
                      />
                    )}
                  </tbody>
                </table>
              </div>
            )
          )}

          {incomeConfirmModal && (
            <IncomeConfirmAmountModal
              itemLabel={incomeConfirmModal.item.income_stream}
              initialAmount={incomeConfirmModal.amount}
              onCancel={() => setIncomeConfirmModal(null)}
              onConfirm={amount => {
                confirmIncomeReceived(incomeConfirmModal.item, amount)
                setIncomeConfirmModal(null)
              }}
            />
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
  tabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '24px',
    borderBottom: `1px solid ${t.colors.border}`,
  },
  tab: {
    padding: '10px 16px',
    border: 'none',
    background: 'none',
    fontSize: t.fontSizes.base,
    fontWeight: '600',
    color: t.colors.textTertiary,
    cursor: 'pointer',
    fontFamily: t.fonts.sans,
    borderBottom: '2px solid transparent',
    marginBottom: '-1px',
  },
  tabActive: {
    color: t.colors.primary,
    borderBottom: `2px solid ${t.colors.primary}`,
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
  summaryValueSecondary: { fontSize: '20px', fontWeight: '700', color: t.colors.textPrimary, fontFamily: t.fonts.heading, letterSpacing: '-0.02em' },
  summaryBreakdown: { fontSize: t.fontSizes.sm, color: t.colors.textTertiary, marginTop: '4px' },
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
  lineItemsEditor: {
    marginBottom: '20px',
    padding: '16px',
    backgroundColor: t.colors.bg,
    borderRadius: t.radius.md,
  },
  lineItemsEditorHeader: {
    display: 'grid',
    gridTemplateColumns: '2fr 0.8fr 1fr 0.4fr',
    gap: '10px',
    fontSize: t.fontSizes.xs,
    fontWeight: '600',
    color: t.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '8px',
  },
  lineItemsEditorRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 0.8fr 1fr 0.4fr',
    gap: '10px',
    marginBottom: '8px',
    alignItems: 'center',
  },
  addRowBtn: {
    padding: '6px 12px',
    borderRadius: t.radius.md,
    border: `1px dashed ${t.colors.border}`,
    backgroundColor: 'transparent',
    color: t.colors.primary,
    fontSize: t.fontSizes.sm,
    cursor: 'pointer',
    fontFamily: t.fonts.sans,
    marginTop: '4px',
  },
  removeRowBtn: {
    padding: '6px 10px',
    borderRadius: t.radius.md,
    border: 'none',
    backgroundColor: t.colors.dangerLight,
    color: t.colors.danger,
    cursor: 'pointer',
    fontFamily: t.fonts.sans,
    fontWeight: '600',
  },
  lineItemsTotal: {
    marginTop: '12px',
    textAlign: 'right',
    fontSize: t.fontSizes.md,
    fontWeight: '700',
    color: t.colors.textPrimary,
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
  recurringTableHeader: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 1fr 1fr 1.2fr',
    padding: '12px 20px',
    backgroundColor: t.colors.bg,
    borderBottom: `1px solid ${t.colors.border}`,
    fontSize: t.fontSizes.xs,
    fontWeight: '600',
    color: t.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  recurringTableRow: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 1fr 1fr 1.2fr',
    padding: '14px 20px',
    borderBottom: `1px solid ${t.colors.borderLight}`,
    alignItems: 'center',
  },
  recurringRowActions: { display: 'flex', gap: '8px' },
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
  lineItemsTable: {
    marginBottom: '24px',
    backgroundColor: t.colors.bg,
    borderRadius: t.radius.md,
    padding: '4px 16px',
  },
  lineItemsHeader: {
    display: 'grid',
    gridTemplateColumns: '2fr 0.6fr 1fr 1fr',
    padding: '10px 0',
    fontSize: t.fontSizes.xs,
    fontWeight: '600',
    color: t.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  lineItemsRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 0.6fr 1fr 1fr',
    padding: '10px 0',
    borderTop: `1px solid ${t.colors.borderLight}`,
    fontSize: t.fontSizes.base,
    color: t.colors.textSecondary,
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '24px',
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
  actionsRow: { display: 'flex', gap: '10px', alignItems: 'center' },
  paymentRow: { display: 'flex', gap: '10px', alignItems: 'center' },
  shareRow: { marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${t.colors.borderLight}` },
  paymentHistory: { marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' },
  paymentHistoryRow: {
    display: 'grid',
    gridTemplateColumns: '110px 90px 1fr 28px',
    gap: '10px',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: `1px solid ${t.colors.borderLight}`,
  },
}

function IncomeCategoryManagerPanel({ categories, newCategoryName, setNewCategoryName, editingCategoryId, setEditingCategoryId, editingCategoryName, setEditingCategoryName, onAdd, onRename, onDelete, onClose }) {
  return (
    <div style={{ ...incomeCardStyle, padding: '16px 20px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes.md, fontWeight: '700', color: t.colors.textPrimary, margin: 0 }}>Manage Categories</h4>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.colors.textTertiary, fontSize: t.fontSizes.sm, cursor: 'pointer', fontFamily: t.fonts.sans }}>Close</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
        {categories.map(cat => (
          <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: t.radius.md, background: t.colors.bg }}>
            {editingCategoryId === cat.id ? (
              <input
                autoFocus
                value={editingCategoryName}
                onChange={e => setEditingCategoryName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onRename(cat); if (e.key === 'Escape') setEditingCategoryId(null) }}
                onBlur={() => onRename(cat)}
                style={{ ...incomeInputStyle, padding: '5px 8px', flex: 1 }}
              />
            ) : (
              <span style={{ flex: 1, fontSize: t.fontSizes.sm, color: t.colors.textPrimary }}>{cat.name}</span>
            )}
            <button onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name) }} style={incomeRowActionBtnStyle(false)}>Rename</button>
            <button onClick={() => onDelete(cat)} style={incomeRowActionBtnStyle(true)}>Delete</button>
          </div>
        ))}
        {categories.length === 0 && (
          <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, padding: '6px 10px' }}>No categories yet — add one below.</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          value={newCategoryName}
          onChange={e => setNewCategoryName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onAdd() }}
          placeholder="New category name"
          style={{ ...incomeInputStyle, flex: 1 }}
        />
        <button onClick={onAdd} style={{ padding: '9px 16px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.sm, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>Add</button>
      </div>
    </div>
  )
}

function IncomeGroup({ label, received, pending, items, projects, onEdit, onDelete, onToggleStatus }) {
  return (
    <>
      <tr>
        <td style={{ ...incomeTdStyle, fontWeight: '700', background: t.colors.bg }} colSpan={5}>{label}</td>
        <td style={{ ...incomeTdStyle, background: t.colors.bg }} />
        <td style={{ ...incomeTdStyle, textAlign: 'right', fontWeight: '700', background: t.colors.bg }}>{fmt(received)}</td>
        <td style={{ ...incomeTdStyle, background: t.colors.bg, borderRight: 'none' }} />
      </tr>
      {items.map(item => (
        <IncomeRow key={item.id} item={item} projects={projects} onEdit={onEdit} onDelete={onDelete} onToggleStatus={onToggleStatus} />
      ))}
    </>
  )
}

function IncomeRow({ item, projects, onEdit, onDelete, onToggleStatus }) {
  const quarter = quarterFromDate(item.date)
  return (
    <tr>
      <td style={incomeTdStyle}>{item.income_stream}</td>
      <td style={incomeTdStyle}>{item.tax_category || '—'}</td>
      <td style={incomeTdStyle}>{item.project_id ? (projects.find(p => p.id === item.project_id)?.title || '—') : '—'}</td>
      <td style={incomeTdStyle}>{quarter ? <span style={incomeQuarterBadgeStyle}>{quarter}</span> : '—'}</td>
      <td style={{ ...incomeTdStyle, color: t.colors.textTertiary }}>{item.notes || '—'}</td>
      <td style={incomeTdStyle}>
        <button
          onClick={() => onToggleStatus(item)}
          style={{
            padding: '3px 10px', borderRadius: t.radius.full, fontSize: t.fontSizes.xs, fontWeight: '500', cursor: 'pointer', border: 'none',
            background: item.status === 'received' ? t.colors.successLight : t.colors.warningLight,
            color: item.status === 'received' ? t.colors.success : t.colors.warning,
          }}
        >
          {item.status}
        </button>
      </td>
      <td style={{ ...incomeTdStyle, textAlign: 'right', fontWeight: '600' }}>{fmt(item.amount)}</td>
      <td style={{ ...incomeTdStyle, borderRight: 'none' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => onEdit(item)} style={incomeRowActionBtnStyle(false)}>Edit</button>
          <button onClick={() => onDelete(item.id)} style={incomeRowActionBtnStyle(true)}>Delete</button>
        </div>
      </td>
    </tr>
  )
}

function IncomeConfirmAmountModal({ itemLabel, initialAmount, onCancel, onConfirm }) {
  const [amount, setAmount] = useState(initialAmount ?? '')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onCancel}>
      <div style={{ ...incomeCardStyle, padding: '24px', width: '100%', maxWidth: '380px' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes.lg, fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 4px' }}>Confirm received amount</h3>
        <p style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, margin: '0 0 16px' }}>{itemLabel} — confirm or adjust the amount before it's finalized.</p>
        <label style={incomeLabelStyle}>Amount</label>
        <input
          autoFocus
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onConfirm(amount); if (e.key === 'Escape') onCancel() }}
          style={incomeInputStyle}
        />
        <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
          <button onClick={() => onConfirm(amount)} style={{ padding: '9px 20px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>Confirm</button>
          <button onClick={onCancel} style={{ padding: '9px 20px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
