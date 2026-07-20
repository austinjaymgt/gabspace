import { useState, useEffect, Fragment } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import { quarterFromDate, quarterInfoFromDate } from '../utils/dates'

const DEFAULT_EXPENSE_CATEGORIES = [
  'Tentpole Events',
  'Operations',
  'Staffing',
  'Marketing',
  'A/V & Production',
  'Catering & F&B',
  'Venue',
  'Travel & Logistics',
  'Miscellaneous',
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

export default function Expenses({ businessSpaceId, userRole }) {
  const [lineItems, setLineItems] = useState([])
  const [expenses, setExpenses] = useState([])
  const [projects, setProjects] = useState([])
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(CURRENT_YEAR)
  const [activeView, setActiveView] = useState('overview') // overview | by-project | by-vendor
  const [vendorQuarterFilter, setVendorQuarterFilter] = useState('all') // all | Q1 | Q2 | Q3 | Q4

  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [expenseForm, setExpenseForm] = useState({ category: '', title: '', amount: '', date: '', status: 'actual', project_id: '', vendor_id: '', notes: '' })

  const [formError, setFormError] = useState('')

  const [expenseCategories, setExpenseCategories] = useState([])
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')

  const [confirmModal, setConfirmModal] = useState(null) // { item, amount }

  const isDirector = ['owner', 'admin'].includes(userRole)

  useEffect(() => {
    if (businessSpaceId) fetchAll()
  }, [businessSpaceId, year])

  async function fetchAll() {
    setLoading(true)
    const [lineRes, expenseRes, projRes, categoryRes, vendorRes] = await Promise.all([
      supabase.from('budget_line_items').select('*').eq('business_space_id', businessSpaceId).order('created_at', { ascending: true }),
      supabase.from('expenses').select('*').eq('business_space_id', businessSpaceId).order('date', { ascending: false }),
      supabase.from('projects').select('id, title, event_status, event_date').eq('business_space_id', businessSpaceId).order('created_at', { ascending: false }),
      supabase.from('budget_categories').select('*').eq('business_space_id', businessSpaceId).eq('type', 'expense').order('position', { ascending: true }),
      supabase.from('vendors').select('id, name').eq('business_space_id', businessSpaceId).order('name', { ascending: true }),
    ])
    setLineItems(lineRes.data || [])
    setExpenses(expenseRes.data || [])
    setProjects(projRes.data || [])
    setVendors(vendorRes.data || [])
    let categories = categoryRes.data || []
    if (categories.length === 0) {
      const seedRows = DEFAULT_EXPENSE_CATEGORIES.map((name, i) => ({ business_space_id: businessSpaceId, type: 'expense', name, position: i }))
      const { data: seeded } = await supabase.from('budget_categories').insert(seedRows).select('*')
      categories = seeded || []
    }
    setExpenseCategories(categories)
    setLoading(false)
  }

  async function addCategory() {
    const name = newCategoryName.trim()
    if (!name) return
    if (expenseCategories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      setNewCategoryName('')
      return
    }
    const { data } = await supabase.from('budget_categories').insert({ business_space_id: businessSpaceId, type: 'expense', name, position: expenseCategories.length }).select('*').single()
    if (!data) return
    setExpenseCategories(p => [...p, data])
    setNewCategoryName('')
  }

  async function renameCategory(cat) {
    const name = editingCategoryName.trim()
    setEditingCategoryId(null)
    if (!name || name === cat.name) return
    await supabase.from('budget_categories').update({ name }).eq('id', cat.id)
    await supabase.from('budget_line_items').update({ category: name }).eq('business_space_id', businessSpaceId).eq('category', cat.name)
    await supabase.from('expenses').update({ category: name }).eq('business_space_id', businessSpaceId).eq('category', cat.name)
    fetchAll()
  }

  async function deleteCategory(cat) {
    const inUse = lineItems.some(i => i.category === cat.name) || expenses.some(e => e.category === cat.name)
    if (inUse) {
      alert(`Can't delete "${cat.name}" — it's still used by existing items. Reassign or delete those first.`)
      return
    }
    await supabase.from('budget_categories').delete().eq('id', cat.id)
    setExpenseCategories(p => p.filter(c => c.id !== cat.id))
  }

  // ── Expenses (planned or actual, chosen via the Status field) ──
  async function saveExpense() {
    if (!expenseForm.category || !expenseForm.title || !expenseForm.amount) {
      setFormError('Category, Title, and Amount are required.')
      return
    }
    const status = expenseForm.status
    const wasStatus = editingExpense?._status
    let error
    if (status === 'planned') {
      const payload = {
        business_space_id: businessSpaceId,
        category: expenseForm.category,
        label: expenseForm.title,
        projected_amount: Number(expenseForm.amount) || 0,
        item_date: expenseForm.date || null,
        quarter: expenseForm.date ? quarterFromDate(expenseForm.date) : null,
        project_id: expenseForm.project_id || null,
        notes: expenseForm.notes || null,
      }
      if (editingExpense && wasStatus === 'planned') {
        ;({ error } = await supabase.from('budget_line_items').update(payload).eq('id', editingExpense.id))
      } else {
        if (editingExpense) await supabase.from('expenses').delete().eq('id', editingExpense.id)
        ;({ error } = await supabase.from('budget_line_items').insert(payload))
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        business_space_id: businessSpaceId,
        category: expenseForm.category,
        title: expenseForm.title,
        amount: Number(expenseForm.amount) || 0,
        date: expenseForm.date || null,
        project_id: expenseForm.project_id || null,
        vendor_id: expenseForm.vendor_id || null,
        notes: expenseForm.notes || null,
      }
      if (editingExpense && wasStatus === 'actual') {
        ;({ error } = await supabase.from('expenses').update(payload).eq('id', editingExpense.id))
      } else {
        if (editingExpense) await supabase.from('budget_line_items').delete().eq('id', editingExpense.id)
        ;({ error } = await supabase.from('expenses').insert({ ...payload, user_id: user.id }))
      }
    }
    if (error) {
      setFormError(error.message)
      return
    }
    resetExpenseForm()
    fetchAll()
  }

  async function deleteExpense(id, status) {
    if (status === 'planned') await supabase.from('budget_line_items').delete().eq('id', id)
    else await supabase.from('expenses').delete().eq('id', id)
    fetchAll()
  }

  // Actual → Planned is a reversible, no-consequence move — instant, no confirmation needed.
  async function revertExpenseToPlanned(item) {
    await supabase.from('budget_line_items').insert({
      business_space_id: businessSpaceId, category: item.category, label: item.title, projected_amount: item.amount,
      item_date: item.date, quarter: item.date ? quarterFromDate(item.date) : null, project_id: item.project_id, notes: item.notes,
    })
    await supabase.from('expenses').delete().eq('id', item.id)
    fetchAll()
  }

  // Planned → Actual: amount often differs from what was projected, so this takes a confirmed amount from a popup.
  async function confirmExpenseActual(item, amount) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('expenses').insert({
      business_space_id: businessSpaceId, category: item.category, title: item.label, amount: Number(amount) || 0,
      date: item.item_date, project_id: item.project_id, notes: item.notes, user_id: user.id,
    })
    await supabase.from('budget_line_items').delete().eq('id', item.id)
    fetchAll()
  }

  function handleExpenseStatusClick(item, status) {
    if (status === 'planned') setConfirmModal({ item, amount: item.projected_amount })
    else revertExpenseToPlanned(item)
  }

  function resetExpenseForm() {
    setExpenseForm({ category: '', title: '', amount: '', date: '', status: 'actual', project_id: '', vendor_id: '', notes: '' })
    setEditingExpense(null)
    setShowExpenseForm(false)
    setFormError('')
  }

  function startEditExpense(item, status) {
    setExpenseForm({
      category: item.category || '',
      title: (status === 'planned' ? item.label : item.title) || '',
      amount: (status === 'planned' ? item.projected_amount : item.amount) || '',
      date: (status === 'planned' ? item.item_date : item.date) || '',
      status,
      project_id: item.project_id || '',
      vendor_id: (status === 'actual' ? item.vendor_id : '') || '',
      notes: item.notes || '',
    })
    setEditingExpense({ id: item.id, _status: status })
    setShowExpenseForm(true)
    setFormError('')
  }

  if (!isDirector) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: t.fonts.sans }}>
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ fontSize: t.fontSizes.xl, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px' }}>Director access only</h2>
        <p style={{ fontSize: t.fontSizes.md, color: t.colors.textTertiary }}>Expense information is restricted to department directors.</p>
      </div>
    )
  }

  // Year-scoped datasets (date-less legacy items stay visible in every year)
  const yearLineItems = lineItems.filter(i => inSelectedYear(i.item_date, year))
  const yearExpenses = expenses.filter(e => inSelectedYear(e.date, year))

  const totalActual = yearExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const totalPlanned = yearLineItems.reduce((s, i) => s + Number(i.projected_amount || 0), 0)

  function mergeExpenseItems(planned, actual) {
    return [...planned.map(i => ({ ...i, _status: 'planned' })), ...actual.map(i => ({ ...i, _status: 'actual' }))]
  }

  const byCategory = expenseCategories.map(({ name: cat }) => {
    const catLineItems = yearLineItems.filter(i => i.category === cat)
    const catExpenses = yearExpenses.filter(e => e.category === cat)
    return {
      category: cat,
      projected: catLineItems.reduce((s, i) => s + Number(i.projected_amount || 0), 0),
      actual: catExpenses.reduce((s, e) => s + Number(e.amount || 0), 0),
      items: mergeExpenseItems(catLineItems, catExpenses),
    }
  }).filter(c => c.items.length > 0)

  const byProject = projects.map(proj => {
    const projLineItems = yearLineItems.filter(i => i.project_id === proj.id)
    const projExpenses = yearExpenses.filter(e => e.project_id === proj.id)
    return {
      ...proj,
      projected: projLineItems.reduce((s, i) => s + Number(i.projected_amount || 0), 0),
      actual: projExpenses.reduce((s, e) => s + Number(e.amount || 0), 0),
      items: mergeExpenseItems(projLineItems, projExpenses),
    }
  }).filter(p => p.items.length > 0)

  const unassignedExpenseItems = mergeExpenseItems(
    yearLineItems.filter(i => !i.project_id),
    yearExpenses.filter(e => !e.project_id),
  )

  // Vendor grouping only covers actual (paid) expenses — vendor_id lives on
  // expenses, not budget_line_items, since planned costs aren't vendorized yet.
  const quarterFilteredExpenses = vendorQuarterFilter === 'all'
    ? yearExpenses
    : yearExpenses.filter(e => quarterFromDate(e.date) === vendorQuarterFilter)

  const byVendor = vendors.map(v => {
    const items = quarterFilteredExpenses.filter(e => e.vendor_id === v.id).map(e => ({ ...e, _status: 'actual' }))
    return { ...v, actual: items.reduce((s, e) => s + Number(e.amount || 0), 0), items }
  }).filter(v => v.items.length > 0).sort((a, b) => b.actual - a.actual)

  const uncategorizedVendorItems = quarterFilteredExpenses
    .filter(e => !e.vendor_id)
    .map(e => ({ ...e, _status: 'actual' }))

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Expenses</h2>
          <p style={styles.subtitle}>{yearExpenses.length + yearLineItems.length} logged for {year}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ ...styles.input, width: 'auto' }}
          >
            {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setShowCategoryManager(v => !v)} style={styles.cancelBtn}>Manage Categories</button>
          <button onClick={() => { setFormError(''); setShowExpenseForm(true) }} style={styles.addBtn}>+ Log expense</button>
        </div>
      </div>

      <div style={styles.summaryRow}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Logged</div>
          <div style={styles.summaryValue}>{yearExpenses.length + yearLineItems.length}</div>
          <div style={styles.summaryBreakdown}>{yearExpenses.length} actual · {yearLineItems.length} planned</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total spent</div>
          <div style={{ ...styles.summaryValueSecondary, color: t.colors.danger }}>{fmt(totalActual)}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Planned</div>
          <div style={{ ...styles.summaryValueSecondary, color: t.colors.warning }}>{fmt(totalPlanned)}</div>
        </div>
      </div>

      {showCategoryManager && (
        <CategoryManagerPanel
          categories={expenseCategories}
          newCategoryName={newCategoryName}
          setNewCategoryName={setNewCategoryName}
          editingCategoryId={editingCategoryId}
          setEditingCategoryId={setEditingCategoryId}
          editingCategoryName={editingCategoryName}
          setEditingCategoryName={setEditingCategoryName}
          onAdd={addCategory}
          onRename={renameCategory}
          onDelete={deleteCategory}
          onClose={() => setShowCategoryManager(false)}
        />
      )}

      {/* Expense form (Status decides whether this is planned or actual) */}
      {showExpenseForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>{editingExpense ? 'Edit expense' : 'Log expense'}</h3>
          {formError && <div style={styles.error}>{formError}</div>}
          <div style={styles.formGrid}>
            <div style={styles.field}>
              <label style={styles.label}>Category</label>
              <select style={styles.input} value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))}>
                <option value="">Select category</option>
                {expenseCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Title</label>
              <input style={styles.input} placeholder="e.g. Venue deposit" value={expenseForm.title} onChange={e => setExpenseForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Amount</label>
              <input style={styles.input} type="number" placeholder="0" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>
                Date {expenseForm.date && <span style={{ color: t.colors.primary, fontWeight: '600' }}> → {quarterFromDate(expenseForm.date)}</span>}
              </label>
              <input style={styles.input} type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Status</label>
              <select style={styles.input} value={expenseForm.status} onChange={e => setExpenseForm(p => ({ ...p, status: e.target.value }))}>
                <option value="actual">Actual (paid)</option>
                <option value="planned">Planned (upcoming)</option>
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Link to Event/Project</label>
              <select style={styles.input} value={expenseForm.project_id} onChange={e => setExpenseForm(p => ({ ...p, project_id: e.target.value }))}>
                <option value="">Unassigned</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            {expenseForm.status === 'actual' && (
              <div style={styles.field}>
                <label style={styles.label}>Vendor</label>
                <select style={styles.input} value={expenseForm.vendor_id} onChange={e => setExpenseForm(p => ({ ...p, vendor_id: e.target.value }))}>
                  <option value="">Uncategorized</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ ...styles.field, gridColumn: '1 / -1' }}>
              <label style={styles.label}>Notes</label>
              <input style={styles.input} placeholder="Any additional context..." value={expenseForm.notes} onChange={e => setExpenseForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <div style={styles.formActions}>
            <button onClick={resetExpenseForm} style={styles.cancelBtn}>Cancel</button>
            <button onClick={saveExpense} style={styles.saveBtn}>{editingExpense ? 'Save changes' : 'Log expense'}</button>
          </div>
        </div>
      )}

      {/* View toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '4px', background: t.colors.bg, borderRadius: t.radius.md, padding: '4px', width: 'fit-content' }}>
          {['overview', 'by-project', 'by-vendor'].map(v => (
            <button key={v} onClick={() => setActiveView(v)} style={{ padding: '7px 16px', borderRadius: t.radius.sm, border: 'none', background: activeView === v ? t.colors.bgCard : 'transparent', color: activeView === v ? t.colors.textPrimary : t.colors.textSecondary, fontSize: t.fontSizes.sm, fontWeight: activeView === v ? '600' : '400', fontFamily: t.fonts.sans, cursor: 'pointer', boxShadow: activeView === v ? t.shadows.sm : 'none' }}>
              {v === 'overview' ? 'By Category' : v === 'by-project' ? 'By Event/Project' : 'By Vendor'}
            </button>
          ))}
        </div>
        {activeView === 'by-vendor' && (
          <select value={vendorQuarterFilter} onChange={e => setVendorQuarterFilter(e.target.value)} style={{ ...styles.input, width: 'auto' }}>
            <option value="all">All quarters</option>
            {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div style={styles.empty}>Loading expenses...</div>
      ) : (
        <>
          {activeView === 'overview' && (
            byCategory.length === 0 ? (
              <EmptyState icon="💸" title="No expenses yet" text={`Nothing planned or logged yet for ${year}`} onAdd={() => setShowExpenseForm(true)} />
            ) : (
              <div style={styles.table}>
                <div style={styles.tableHeader}>
                  <span>Item</span>
                  <span>Category</span>
                  <span>Event/Project</span>
                  <span>Quarter</span>
                  <span>Status</span>
                  <span>Amount</span>
                  <span></span>
                </div>
                {byCategory.map(cat => (
                  <Fragment key={cat.category}>
                    <GroupHeaderRow label={cat.category} leftValue={fmt(cat.projected)} rightValue={fmt(cat.actual)} rightDanger={cat.actual > cat.projected} />
                    {cat.items.map(item => (
                      <ExpenseItemRow key={`${item._status}-${item.id}`} item={item} status={item._status} projects={projects} onEdit={startEditExpense} onDelete={deleteExpense} onToggleStatus={handleExpenseStatusClick} />
                    ))}
                  </Fragment>
                ))}
              </div>
            )
          )}

          {activeView === 'by-project' && (
            byProject.length === 0 && unassignedExpenseItems.length === 0 ? (
              <EmptyState icon="💸" title="No expenses yet" text={`Nothing planned or logged yet for ${year}`} onAdd={() => setShowExpenseForm(true)} />
            ) : (
              <div style={styles.table}>
                <div style={styles.tableHeader}>
                  <span>Item</span>
                  <span>Category</span>
                  <span>Event/Project</span>
                  <span>Quarter</span>
                  <span>Status</span>
                  <span>Amount</span>
                  <span></span>
                </div>
                {byProject.map(proj => (
                  <Fragment key={proj.id}>
                    <GroupHeaderRow label={proj.title} leftValue={fmt(proj.projected)} rightValue={fmt(proj.actual)} rightDanger={proj.actual > proj.projected} />
                    {proj.items.map(item => (
                      <ExpenseItemRow key={`${item._status}-${item.id}`} item={item} status={item._status} projects={projects} onEdit={startEditExpense} onDelete={deleteExpense} onToggleStatus={handleExpenseStatusClick} />
                    ))}
                  </Fragment>
                ))}
                {unassignedExpenseItems.length > 0 && (
                  <Fragment>
                    <GroupHeaderRow
                      label="Unassigned"
                      leftValue={fmt(unassignedExpenseItems.filter(i => i._status === 'planned').reduce((s, i) => s + Number(i.projected_amount || 0), 0))}
                      rightValue={fmt(unassignedExpenseItems.filter(i => i._status === 'actual').reduce((s, i) => s + Number(i.amount || 0), 0))}
                    />
                    {unassignedExpenseItems.map(item => (
                      <ExpenseItemRow key={`${item._status}-${item.id}`} item={item} status={item._status} projects={projects} onEdit={startEditExpense} onDelete={deleteExpense} onToggleStatus={handleExpenseStatusClick} />
                    ))}
                  </Fragment>
                )}
              </div>
            )
          )}

          {activeView === 'by-vendor' && (
            byVendor.length === 0 && uncategorizedVendorItems.length === 0 ? (
              <EmptyState icon="💸" title="No actual expenses yet" text={`No actual expenses logged yet for ${year}${vendorQuarterFilter !== 'all' ? ` in ${vendorQuarterFilter}` : ''}`} onAdd={() => setShowExpenseForm(true)} />
            ) : (
              <div style={styles.table}>
                <div style={styles.tableHeader}>
                  <span>Item</span>
                  <span>Category</span>
                  <span>Event/Project</span>
                  <span>Quarter</span>
                  <span>Status</span>
                  <span>Amount</span>
                  <span></span>
                </div>
                {byVendor.map(vendor => (
                  <Fragment key={vendor.id}>
                    <GroupHeaderRow label={vendor.name} leftValue="" rightValue={fmt(vendor.actual)} />
                    {vendor.items.map(item => (
                      <ExpenseItemRow key={`${item._status}-${item.id}`} item={item} status={item._status} projects={projects} onEdit={startEditExpense} onDelete={deleteExpense} onToggleStatus={handleExpenseStatusClick} />
                    ))}
                  </Fragment>
                ))}
                {uncategorizedVendorItems.length > 0 && (
                  <Fragment>
                    <GroupHeaderRow
                      label="Uncategorized"
                      leftValue=""
                      rightValue={fmt(uncategorizedVendorItems.reduce((s, i) => s + Number(i.amount || 0), 0))}
                    />
                    {uncategorizedVendorItems.map(item => (
                      <ExpenseItemRow key={`${item._status}-${item.id}`} item={item} status={item._status} projects={projects} onEdit={startEditExpense} onDelete={deleteExpense} onToggleStatus={handleExpenseStatusClick} />
                    ))}
                  </Fragment>
                )}
              </div>
            )
          )}
        </>
      )}

      {confirmModal && (
        <ConfirmAmountModal
          title="Confirm actual amount"
          itemLabel={confirmModal.item.label}
          initialAmount={confirmModal.amount}
          onCancel={() => setConfirmModal(null)}
          onConfirm={amount => {
            confirmExpenseActual(confirmModal.item, amount)
            setConfirmModal(null)
          }}
        />
      )}
    </div>
  )
}

function EmptyState({ icon, title, text, onAdd }) {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>{icon}</div>
      <h3 style={styles.emptyTitle}>{title}</h3>
      <p style={styles.emptyText}>{text}</p>
      <button onClick={onAdd} style={styles.addBtn}>+ Log expense</button>
    </div>
  )
}

function CategoryManagerPanel({ categories, newCategoryName, setNewCategoryName, editingCategoryId, setEditingCategoryId, editingCategoryName, setEditingCategoryName, onAdd, onRename, onDelete, onClose }) {
  return (
    <div style={styles.formCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ ...styles.formTitle, margin: 0 }}>Manage categories</h4>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.colors.textTertiary, fontSize: t.fontSizes.sm, cursor: 'pointer', fontFamily: t.fonts.sans }}>Close</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px', marginTop: '16px' }}>
        {categories.map(cat => (
          <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: t.radius.md, background: t.colors.bg }}>
            {editingCategoryId === cat.id ? (
              <input
                autoFocus
                value={editingCategoryName}
                onChange={e => setEditingCategoryName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onRename(cat); if (e.key === 'Escape') setEditingCategoryId(null) }}
                onBlur={() => onRename(cat)}
                style={{ ...styles.input, padding: '5px 8px', flex: 1 }}
              />
            ) : (
              <span style={{ flex: 1, fontSize: t.fontSizes.sm, color: t.colors.textPrimary }}>{cat.name}</span>
            )}
            <button onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name) }} style={styles.cancelBtn}>Rename</button>
            <button onClick={() => onDelete(cat)} style={{ ...styles.cancelBtn, color: t.colors.danger }}>Delete</button>
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
          style={{ ...styles.input, flex: 1 }}
        />
        <button onClick={onAdd} style={styles.saveBtn}>Add</button>
      </div>
    </div>
  )
}

function GroupHeaderRow({ label, leftValue, rightValue, rightDanger }) {
  return (
    <div style={{ ...styles.tableRow, cursor: 'default', background: t.colors.bg, fontWeight: '700' }}>
      <span style={{ gridColumn: '1 / 4', fontSize: t.fontSizes.base, color: t.colors.textPrimary }}>{label}</span>
      <span style={{ fontSize: t.fontSizes.base, color: t.colors.textSecondary }}>{leftValue}</span>
      <span style={{ fontSize: t.fontSizes.base, color: rightDanger ? t.colors.danger : t.colors.textPrimary }}>{rightValue}</span>
      <span></span>
    </div>
  )
}

function ExpenseItemRow({ item, status, projects, onEdit, onDelete, onToggleStatus }) {
  const isPlanned = status === 'planned'
  const quarter = quarterFromDate(isPlanned ? item.item_date : item.date)
  const amount = isPlanned ? item.projected_amount : item.amount
  return (
    <div style={styles.tableRow}>
      <span style={{ fontSize: t.fontSizes.base, fontWeight: '600', color: t.colors.textPrimary }}>{isPlanned ? item.label : item.title}</span>
      <span style={styles.tableCell}>{item.category || '—'}</span>
      <span style={styles.tableCell}>{item.project_id ? (projects.find(p => p.id === item.project_id)?.title || '—') : '—'}</span>
      <span style={styles.tableCell}>{quarter || '—'}</span>
      <span>
        <button
          onClick={() => onToggleStatus(item, status)}
          style={{
            ...styles.statusBadge, border: 'none', cursor: 'pointer',
            backgroundColor: isPlanned ? t.colors.warningLight : t.colors.successLight,
            color: isPlanned ? t.colors.warning : t.colors.success,
          }}
        >
          {status}
        </button>
      </span>
      <span style={{ fontSize: t.fontSizes.base, fontWeight: '600', color: t.colors.textPrimary }}>{fmt(amount)}</span>
      <span style={{ display: 'flex', gap: '4px' }}>
        <button onClick={() => onEdit(item, status)} style={styles.cancelBtn}>Edit</button>
        <button onClick={() => onDelete(item.id, status)} style={{ ...styles.cancelBtn, color: t.colors.danger }}>Delete</button>
      </span>
    </div>
  )
}

function ConfirmAmountModal({ title, itemLabel, initialAmount, onCancel, onConfirm }) {
  const [amount, setAmount] = useState(initialAmount ?? '')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onCancel}>
      <div style={{ ...styles.formCard, marginBottom: 0, width: '100%', maxWidth: '380px' }} onClick={e => e.stopPropagation()}>
        <h3 style={styles.formTitle}>{title}</h3>
        <p style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, margin: '0 0 16px' }}>{itemLabel} — confirm or adjust the amount before it's finalized.</p>
        <label style={styles.label}>Amount</label>
        <input
          autoFocus
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onConfirm(amount); if (e.key === 'Escape') onCancel() }}
          style={styles.input}
        />
        <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
          <button onClick={() => onConfirm(amount)} style={styles.saveBtn}>Confirm</button>
          <button onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
        </div>
      </div>
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
    flexWrap: 'wrap',
    gap: '12px',
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
    whiteSpace: 'nowrap',
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
    boxSizing: 'border-box',
  },
  formActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  cancelBtn: {
    padding: '9px 16px',
    borderRadius: t.radius.md,
    border: `1px solid ${t.colors.border}`,
    backgroundColor: t.colors.bgCard,
    color: t.colors.textSecondary,
    fontSize: t.fontSizes.sm,
    cursor: 'pointer',
    fontFamily: t.fonts.sans,
    whiteSpace: 'nowrap',
  },
  saveBtn: {
    padding: '9px 16px',
    borderRadius: t.radius.md,
    border: 'none',
    backgroundColor: t.colors.primary,
    color: '#fff',
    fontSize: t.fontSizes.sm,
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: t.fonts.sans,
    whiteSpace: 'nowrap',
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
    gridTemplateColumns: '1.6fr 1.1fr 1.3fr 0.6fr 0.8fr 0.8fr 1.1fr',
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
    gridTemplateColumns: '1.6fr 1.1fr 1.3fr 0.6fr 0.8fr 0.8fr 1.1fr',
    padding: '14px 20px',
    borderBottom: `1px solid ${t.colors.borderLight}`,
    alignItems: 'center',
  },
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
}
