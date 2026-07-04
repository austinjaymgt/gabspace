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

function pct(a, b) {
  if (!b || b === 0) return 0
  return Math.min(Math.round((a / b) * 100), 100)
}

function inSelectedYear(dateStr, year) {
  if (!dateStr) return true
  return quarterInfoFromDate(dateStr)?.year === year
}

const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }
const labelStyle = { fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }
const cardStyle = { background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, overflow: 'hidden' }
const tableWrapStyle = { ...cardStyle, overflow: 'auto' }
const thStyle = { textAlign: 'left', padding: '10px 14px', fontSize: t.fontSizes.xs, fontWeight: '700', color: t.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em', background: t.colors.bg, borderBottom: `1px solid ${t.colors.border}`, borderRight: `1px solid ${t.colors.borderLight}`, whiteSpace: 'nowrap' }
const tdStyle = { padding: '9px 14px', fontSize: t.fontSizes.sm, color: t.colors.textPrimary, borderBottom: `1px solid ${t.colors.borderLight}`, borderRight: `1px solid ${t.colors.borderLight}`, verticalAlign: 'middle' }
const quarterBadgeStyle = { fontSize: t.fontSizes.xs, background: t.colors.primaryLight, color: t.colors.primary, padding: '2px 8px', borderRadius: t.radius.full }
const rowActionBtnStyle = (danger) => ({ background: 'none', border: `1px solid ${t.colors.border}`, borderRadius: t.radius.sm, padding: '4px 8px', fontSize: t.fontSizes.xs, color: danger ? t.colors.danger : t.colors.textSecondary, cursor: 'pointer', fontFamily: t.fonts.sans, whiteSpace: 'nowrap' })

export default function DepartmentBudget({ workspaceId, userRole }) {
  const [budget, setBudget] = useState(null)
  const [lineItems, setLineItems] = useState([])
  const [expenses, setExpenses] = useState([])
  const [revenue, setRevenue] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(CURRENT_YEAR)
  const [topTab, setTopTab] = useState('expenses') // expenses | income
  const [activeView, setActiveView] = useState('overview') // overview | by-project
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [budgetForm, setBudgetForm] = useState({ annual_budget: '', q1_target: '', q2_target: '', q3_target: '', q4_target: '' })

  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [expenseForm, setExpenseForm] = useState({ category: '', title: '', amount: '', date: '', status: 'actual', project_id: '', notes: '' })

  const [showIncomeForm, setShowIncomeForm] = useState(false)
  const [editingIncome, setEditingIncome] = useState(null)
  const [incomeForm, setIncomeForm] = useState({ income_stream: '', amount: '', date: '', status: 'received', tax_category: '', project_id: '', notes: '' })

  const [formError, setFormError] = useState('')

  const [expenseCategories, setExpenseCategories] = useState([])
  const [incomeCategories, setIncomeCategories] = useState([])
  const [manageCategoryType, setManageCategoryType] = useState(null) // 'expense' | 'income' | null
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')

  const [confirmModal, setConfirmModal] = useState(null) // { kind: 'expense' | 'income', item, amount }

  const isDirector = ['owner', 'admin'].includes(userRole)

  useEffect(() => {
    if (workspaceId) fetchAll()
  }, [workspaceId, year])

  async function fetchAll() {
    setLoading(true)
    const [budgetRes, lineRes, expenseRes, revenueRes, projRes, categoryRes] = await Promise.all([
      supabase.from('department_budget').select('*').eq('workspace_id', workspaceId).eq('year', year).maybeSingle(),
      supabase.from('budget_line_items').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: true }),
      supabase.from('expenses').select('*').eq('workspace_id', workspaceId).order('date', { ascending: false }),
      supabase.from('revenue').select('*').eq('workspace_id', workspaceId).order('date', { ascending: false }),
      supabase.from('projects').select('id, title, event_status, event_date').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('budget_categories').select('*').eq('workspace_id', workspaceId).order('position', { ascending: true }),
    ])
    setBudget(budgetRes.data)
    setLineItems(lineRes.data || [])
    setExpenses(expenseRes.data || [])
    setRevenue(revenueRes.data || [])
    setProjects(projRes.data || [])
    if (budgetRes.data) {
      setBudgetForm({
        annual_budget: budgetRes.data.annual_budget || '',
        q1_target: budgetRes.data.q1_target || '',
        q2_target: budgetRes.data.q2_target || '',
        q3_target: budgetRes.data.q3_target || '',
        q4_target: budgetRes.data.q4_target || '',
      })
    }
    let categories = categoryRes.data || []
    if (categories.length === 0) {
      const seedRows = [
        ...DEFAULT_EXPENSE_CATEGORIES.map((name, i) => ({ workspace_id: workspaceId, type: 'expense', name, position: i })),
        ...DEFAULT_INCOME_CATEGORIES.map((name, i) => ({ workspace_id: workspaceId, type: 'income', name, position: i })),
      ]
      const { data: seeded } = await supabase.from('budget_categories').insert(seedRows).select('*')
      categories = seeded || []
    }
    setExpenseCategories(categories.filter(c => c.type === 'expense'))
    setIncomeCategories(categories.filter(c => c.type === 'income'))
    setLoading(false)
  }

  async function addCategory(type) {
    const name = newCategoryName.trim()
    if (!name) return
    const list = type === 'expense' ? expenseCategories : incomeCategories
    if (list.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      setNewCategoryName('')
      return
    }
    const { data } = await supabase.from('budget_categories').insert({ workspace_id: workspaceId, type, name, position: list.length }).select('*').single()
    if (!data) return
    if (type === 'expense') setExpenseCategories(p => [...p, data])
    else setIncomeCategories(p => [...p, data])
    setNewCategoryName('')
  }

  async function renameCategory(cat) {
    const name = editingCategoryName.trim()
    setEditingCategoryId(null)
    if (!name || name === cat.name) return
    await supabase.from('budget_categories').update({ name }).eq('id', cat.id)
    if (cat.type === 'expense') {
      await supabase.from('budget_line_items').update({ category: name }).eq('workspace_id', workspaceId).eq('category', cat.name)
      await supabase.from('expenses').update({ category: name }).eq('workspace_id', workspaceId).eq('category', cat.name)
    } else {
      await supabase.from('revenue').update({ tax_category: name }).eq('workspace_id', workspaceId).eq('tax_category', cat.name)
    }
    fetchAll()
  }

  async function deleteCategory(cat) {
    const inUse = cat.type === 'expense'
      ? lineItems.some(i => i.category === cat.name) || expenses.some(e => e.category === cat.name)
      : revenue.some(r => r.tax_category === cat.name)
    if (inUse) {
      alert(`Can't delete "${cat.name}" — it's still used by existing items. Reassign or delete those first.`)
      return
    }
    await supabase.from('budget_categories').delete().eq('id', cat.id)
    if (cat.type === 'expense') setExpenseCategories(p => p.filter(c => c.id !== cat.id))
    else setIncomeCategories(p => p.filter(c => c.id !== cat.id))
  }

  async function saveBudget() {
    const payload = {
      workspace_id: workspaceId,
      year,
      annual_budget: Number(budgetForm.annual_budget) || 0,
      q1_target: Number(budgetForm.q1_target) || 0,
      q2_target: Number(budgetForm.q2_target) || 0,
      q3_target: Number(budgetForm.q3_target) || 0,
      q4_target: Number(budgetForm.q4_target) || 0,
    }
    if (budget) {
      await supabase.from('department_budget').update(payload).eq('id', budget.id)
    } else {
      await supabase.from('department_budget').insert(payload)
    }
    setShowBudgetForm(false)
    fetchAll()
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
        workspace_id: workspaceId,
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
        workspace_id: workspaceId,
        category: expenseForm.category,
        title: expenseForm.title,
        amount: Number(expenseForm.amount) || 0,
        date: expenseForm.date || null,
        project_id: expenseForm.project_id || null,
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
      workspace_id: workspaceId, category: item.category, label: item.title, projected_amount: item.amount,
      item_date: item.date, quarter: item.date ? quarterFromDate(item.date) : null, project_id: item.project_id, notes: item.notes,
    })
    await supabase.from('expenses').delete().eq('id', item.id)
    fetchAll()
  }

  // Planned → Actual: amount often differs from what was projected, so this takes a confirmed amount from a popup.
  async function confirmExpenseActual(item, amount) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('expenses').insert({
      workspace_id: workspaceId, category: item.category, title: item.label, amount: Number(amount) || 0,
      date: item.item_date, project_id: item.project_id, notes: item.notes, user_id: user.id,
    })
    await supabase.from('budget_line_items').delete().eq('id', item.id)
    fetchAll()
  }

  function handleExpenseStatusClick(item, status) {
    if (status === 'planned') setConfirmModal({ kind: 'expense', item, amount: item.projected_amount })
    else revertExpenseToPlanned(item)
  }

  function resetExpenseForm() {
    setExpenseForm({ category: '', title: '', amount: '', date: '', status: 'actual', project_id: '', notes: '' })
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
      notes: item.notes || '',
    })
    setEditingExpense({ id: item.id, _status: status })
    setShowExpenseForm(true)
    setFormError('')
  }

  // ── Income ──
  async function saveIncome() {
    if (!incomeForm.income_stream || !incomeForm.amount) {
      setFormError('Source and Amount are required.')
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      workspace_id: workspaceId,
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
      setFormError(error.message)
      return
    }
    resetIncomeForm()
    fetchAll()
  }

  async function deleteIncome(id) {
    await supabase.from('revenue').delete().eq('id', id)
    fetchAll()
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
    if (entry.status === 'pending') setConfirmModal({ kind: 'income', item: entry, amount: entry.amount })
    else revertIncomeToPending(entry)
  }

  function resetIncomeForm() {
    setIncomeForm({ income_stream: '', amount: '', date: '', status: 'received', tax_category: '', project_id: '', notes: '' })
    setEditingIncome(null)
    setShowIncomeForm(false)
    setFormError('')
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
    setFormError('')
  }

  if (!isDirector) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: t.fonts.sans }}>
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ fontSize: t.fontSizes.xl, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px' }}>Director access only</h2>
        <p style={{ fontSize: t.fontSizes.md, color: t.colors.textTertiary }}>Budget information is restricted to department directors.</p>
      </div>
    )
  }

  // Year-scoped datasets (date-less legacy items stay visible in every year)
  const yearLineItems = lineItems.filter(i => inSelectedYear(i.item_date, year))
  const yearExpenses = expenses.filter(e => inSelectedYear(e.date, year))
  const yearRevenue = revenue.filter(r => inSelectedYear(r.date, year))

  const totalProjected = yearLineItems.reduce((s, i) => s + Number(i.projected_amount || 0), 0)
  const totalActual = yearExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const totalIncomeReceived = yearRevenue.filter(r => r.status === 'received').reduce((s, r) => s + Number(r.amount || 0), 0)
  const totalIncomePending = yearRevenue.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.amount || 0), 0)
  const annualBudget = Number(budget?.annual_budget || 0)
  const spentPct = pct(totalActual, annualBudget)
  const projectedPct = pct(totalProjected, annualBudget)
  const net = totalIncomeReceived - totalActual

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

  const incomeByCategory = incomeCategories.map(({ name: cat }) => {
    const items = yearRevenue.filter(r => r.tax_category === cat)
    return {
      category: cat,
      received: items.filter(r => r.status === 'received').reduce((s, r) => s + Number(r.amount || 0), 0),
      pending: items.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.amount || 0), 0),
      items,
    }
  }).filter(c => c.items.length > 0)

  const incomeByProject = projects.map(proj => {
    const items = yearRevenue.filter(r => r.project_id === proj.id)
    return {
      ...proj,
      received: items.filter(r => r.status === 'received').reduce((s, r) => s + Number(r.amount || 0), 0),
      pending: items.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.amount || 0), 0),
      items,
    }
  }).filter(p => p.items.length > 0)

  const unassignedIncome = yearRevenue.filter(r => !r.project_id)

  return (
    <div style={{ padding: '32px 40px', fontFamily: t.fonts.sans, maxWidth: '1000px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: t.fontSizes.xs, fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.primary, marginBottom: '6px' }}>Operations</div>
          <h2 style={{ fontFamily: t.fonts.heading, fontSize: '22px', fontWeight: '800', color: t.colors.textPrimary, letterSpacing: '-0.02em', margin: 0 }}>
            Annual Budget
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, color: t.colors.textPrimary, background: t.colors.bgCard, fontFamily: t.fonts.sans }}
          >
            {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => setShowBudgetForm(true)}
            style={{ padding: '9px 18px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: t.colors.bgCard, color: t.colors.textPrimary, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, cursor: 'pointer' }}
          >
            {budget ? 'Edit Budget' : 'Set Budget'}
          </button>
        </div>
      </div>

      {/* Budget setup prompt */}
      {!budget && !showBudgetForm && (
        <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '32px', textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
          <div style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, marginBottom: '8px' }}>Set your {year} budget</div>
          <div style={{ fontSize: t.fontSizes.base, color: t.colors.textSecondary, marginBottom: '16px' }}>Set an annual budget and quarterly targets to track against. You can still log income and expenses below without one.</div>
          <button onClick={() => setShowBudgetForm(true)} style={{ padding: '10px 24px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>
            Set Budget
          </button>
        </div>
      )}

      {/* Budget form */}
      {showBudgetForm && (
        <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 20px' }}>{year} Budget Setup</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            {[
              { key: 'annual_budget', label: 'Annual Budget' },
              { key: 'q1_target', label: 'Q1 Target' },
              { key: 'q2_target', label: 'Q2 Target' },
              { key: 'q3_target', label: 'Q3 Target' },
              { key: 'q4_target', label: 'Q4 Target' },
            ].map(f => (
              <div key={f.key}>
                <label style={labelStyle}>{f.label}</label>
                <input type="number" value={budgetForm[f.key]} onChange={e => setBudgetForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder="0" style={inputStyle} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={saveBudget} style={{ padding: '9px 20px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>Save</button>
            <button onClick={() => setShowBudgetForm(false)} style={{ padding: '9px 20px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* P&L summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Annual Budget', value: budget ? fmt(annualBudget) : '—', sub: `${year} allocation` },
          { label: 'Income (Received)', value: fmt(totalIncomeReceived), sub: totalIncomePending > 0 ? `${fmt(totalIncomePending)} pending` : 'No pending income' },
          { label: 'Actual Expenses', value: fmt(totalActual), sub: budget ? `${spentPct}% of budget` : `${year} logged expenses` },
          { label: 'Net', value: fmt(net), sub: net < 0 ? 'Spending more than earning' : 'Income exceeds spend', danger: net < 0 },
        ].map(stat => (
          <div key={stat.label} style={{ background: t.colors.bgCard, border: `1px solid ${stat.danger ? t.colors.danger : t.colors.border}`, borderRadius: t.radius.lg, padding: '18px 20px' }}>
            <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{stat.label}</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: stat.danger ? t.colors.danger : t.colors.textPrimary, fontFamily: t.fonts.heading, marginBottom: '2px' }}>{stat.value}</div>
            <div style={{ fontSize: t.fontSizes.xs, color: stat.danger ? t.colors.danger : t.colors.textTertiary }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Overall progress bar (evergreen — applies to both tabs) */}
      {budget && (
        <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '20px 24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textPrimary }}>Budget utilization</span>
            <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>{fmt(totalActual)} of {fmt(annualBudget)}</span>
          </div>
          <div style={{ height: '10px', background: t.colors.border, borderRadius: t.radius.full, overflow: 'hidden', marginBottom: '8px', position: 'relative' }}>
            <div style={{ position: 'absolute', height: '100%', width: `${projectedPct}%`, background: t.colors.primaryLight, borderRadius: t.radius.full }} />
            <div style={{ position: 'absolute', height: '100%', width: `${spentPct}%`, background: spentPct > 90 ? t.colors.danger : t.colors.primary, borderRadius: t.radius.full }} />
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: t.colors.primary }} />
              <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary }}>Actual ({spentPct}%)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: t.colors.primaryLight }} />
              <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary }}>Planned ({projectedPct}%)</span>
            </div>
          </div>
        </div>
      )}

      {/* Top-level tab toggle */}
      <div style={{ display: 'flex', gap: '4px', background: t.colors.bg, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.md, padding: '4px', width: 'fit-content', marginBottom: '24px' }}>
        {['expenses', 'income'].map(v => (
          <button key={v} onClick={() => setTopTab(v)} style={{ padding: '8px 20px', borderRadius: t.radius.sm, border: 'none', background: topTab === v ? t.colors.bgCard : 'transparent', color: topTab === v ? t.colors.textPrimary : t.colors.textSecondary, fontSize: t.fontSizes.base, fontWeight: topTab === v ? '600' : '400', fontFamily: t.fonts.sans, cursor: 'pointer', boxShadow: topTab === v ? t.shadows.sm : 'none' }}>
            {v === 'expenses' ? 'Expenses' : 'Income'}
          </button>
        ))}
      </div>

      <h3 style={{ fontFamily: t.fonts.heading, fontSize: '18px', fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 16px', letterSpacing: '-0.01em' }}>Quarterly Breakdown</h3>

      {loading ? (
        <div style={{ color: t.colors.textTertiary, textAlign: 'center', padding: '60px' }}>Loading...</div>
      ) : topTab === 'expenses' ? (
        <>
          {budget && (
            <>
              {/* Quarterly targets */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
                {QUARTERS.map(q => {
                  const target = Number(budget[`${q.toLowerCase()}_target`] || 0)
                  const actual = yearExpenses.filter(e => quarterFromDate(e.date) === q).reduce((s, e) => s + Number(e.amount || 0), 0)
                  const planned = yearLineItems.filter(i => quarterFromDate(i.item_date) === q).reduce((s, i) => s + Number(i.projected_amount || 0), 0)
                  const p = pct(actual, target)
                  return (
                    <div key={q} style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '16px 18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>{q}</span>
                        <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{p}%</span>
                      </div>
                      <div style={{ height: '6px', background: t.colors.border, borderRadius: t.radius.full, overflow: 'hidden', marginBottom: '8px' }}>
                        <div style={{ height: '100%', width: `${p}%`, background: p > 90 ? t.colors.danger : t.colors.primary, borderRadius: t.radius.full }} />
                      </div>
                      <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary }}>{fmt(actual)} / {fmt(target)}</div>
                      <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '2px' }}>Planned: {fmt(planned)}</div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Cost Breakdown subheader + actions */}
          <div style={{ borderTop: `1px solid ${t.colors.border}`, marginBottom: '24px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: t.fontSizes.xs, fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.primary, marginBottom: '4px' }}>Budget</div>
              <h3 style={{ fontFamily: t.fonts.heading, fontSize: '18px', fontWeight: '700', color: t.colors.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>Cost Breakdown</h3>
              <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '4px' }}>Mark an expense "Planned" for upcoming costs or "Actual" once it's paid</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setManageCategoryType(manageCategoryType === 'expense' ? null : 'expense')} style={{ padding: '9px 16px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: t.colors.bgCard, color: t.colors.textPrimary, fontSize: t.fontSizes.sm, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>Manage Categories</button>
              <button onClick={() => { setFormError(''); setShowExpenseForm(true) }} style={{ padding: '9px 16px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.sm, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>+ Log Expense</button>
            </div>
          </div>

          {manageCategoryType === 'expense' && (
            <CategoryManagerPanel
              categories={expenseCategories}
              newCategoryName={newCategoryName}
              setNewCategoryName={setNewCategoryName}
              editingCategoryId={editingCategoryId}
              setEditingCategoryId={setEditingCategoryId}
              editingCategoryName={editingCategoryName}
              setEditingCategoryName={setEditingCategoryName}
              onAdd={() => addCategory('expense')}
              onRename={renameCategory}
              onDelete={deleteCategory}
              onClose={() => setManageCategoryType(null)}
            />
          )}

          {/* Expense form (Status decides whether this is planned or actual) */}
          {showExpenseForm && (
            <div style={{ ...cardStyle, padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 20px' }}>{editingExpense ? 'Edit Expense' : 'Log Expense'}</h3>
              {formError && <div style={{ padding: '10px 14px', borderRadius: t.radius.md, background: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.sm, marginBottom: '16px' }}>{formError}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Category *</label>
                  <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
                    <option value="">Select category</option>
                    {expenseCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Title *</label>
                  <input value={expenseForm.title} onChange={e => setExpenseForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Venue deposit" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Amount *</label>
                  <input type="number" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>
                    Date {expenseForm.date && <span style={{ color: t.colors.primary, fontWeight: '600' }}>→ {quarterFromDate(expenseForm.date)}</span>}
                  </label>
                  <input type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={expenseForm.status} onChange={e => setExpenseForm(p => ({ ...p, status: e.target.value }))} style={inputStyle}>
                    <option value="actual">Actual (paid)</option>
                    <option value="planned">Planned (upcoming)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Link to Event/Project</label>
                  <select value={expenseForm.project_id} onChange={e => setExpenseForm(p => ({ ...p, project_id: e.target.value }))} style={inputStyle}>
                    <option value="">Unassigned</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Notes</label>
                  <input value={expenseForm.notes} onChange={e => setExpenseForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any additional context..." style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button onClick={saveExpense} style={{ padding: '9px 20px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>{editingExpense ? 'Save Changes' : 'Log Expense'}</button>
                <button onClick={resetExpenseForm} style={{ padding: '9px 20px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          {/* View toggle */}
          <div style={{ display: 'flex', gap: '4px', background: t.colors.bg, borderRadius: t.radius.md, padding: '4px', width: 'fit-content', marginBottom: '20px' }}>
            {['overview', 'by-project'].map(v => (
              <button key={v} onClick={() => setActiveView(v)} style={{ padding: '7px 16px', borderRadius: t.radius.sm, border: 'none', background: activeView === v ? t.colors.bgCard : 'transparent', color: activeView === v ? t.colors.textPrimary : t.colors.textSecondary, fontSize: t.fontSizes.sm, fontWeight: activeView === v ? '600' : '400', fontFamily: t.fonts.sans, cursor: 'pointer', boxShadow: activeView === v ? t.shadows.sm : 'none' }}>
                {v === 'overview' ? 'By Category' : 'By Event/Project'}
              </button>
            ))}
          </div>

          {activeView === 'overview' && (
            byCategory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', background: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}`, color: t.colors.textSecondary }}>
                Nothing planned or logged yet for {year} — use the buttons above to get started.
              </div>
            ) : (
              <div style={tableWrapStyle}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Item</th>
                      <th style={thStyle}>Category</th>
                      <th style={thStyle}>Event/Project</th>
                      <th style={thStyle}>Quarter</th>
                      <th style={thStyle}>Notes</th>
                      <th style={thStyle}>Status</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                      <th style={{ ...thStyle, borderRight: 'none' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byCategory.map(cat => (
                      <Fragment key={cat.category}>
                        <GroupHeaderRow label={cat.category} leftValue={fmt(cat.projected)} rightValue={fmt(cat.actual)} rightDanger={cat.actual > cat.projected} />
                        {cat.items.map(item => (
                          <ExpenseItemRow key={`${item._status}-${item.id}`} item={item} status={item._status} projects={projects} onEdit={startEditExpense} onDelete={deleteExpense} onToggleStatus={handleExpenseStatusClick} />
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeView === 'by-project' && (
            byProject.length === 0 && unassignedExpenseItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', background: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}`, color: t.colors.textSecondary }}>
                Nothing planned or logged yet for {year} — use the buttons above to get started.
              </div>
            ) : (
              <div style={tableWrapStyle}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Item</th>
                      <th style={thStyle}>Category</th>
                      <th style={thStyle}>Event/Project</th>
                      <th style={thStyle}>Quarter</th>
                      <th style={thStyle}>Notes</th>
                      <th style={thStyle}>Status</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                      <th style={{ ...thStyle, borderRight: 'none' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
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
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      ) : (
        <>
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
              <div style={{ fontSize: t.fontSizes.xs, fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.primary, marginBottom: '4px' }}>Budget</div>
              <h3 style={{ fontFamily: t.fonts.heading, fontSize: '18px', fontWeight: '700', color: t.colors.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>Income Breakdown</h3>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setManageCategoryType(manageCategoryType === 'income' ? null : 'income')} style={{ padding: '9px 16px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: t.colors.bgCard, color: t.colors.textPrimary, fontSize: t.fontSizes.sm, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>Manage Categories</button>
              <button onClick={() => { setFormError(''); setShowIncomeForm(true) }} style={{ padding: '9px 16px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.sm, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>+ Log Income</button>
            </div>
          </div>

          {manageCategoryType === 'income' && (
            <CategoryManagerPanel
              categories={incomeCategories}
              newCategoryName={newCategoryName}
              setNewCategoryName={setNewCategoryName}
              editingCategoryId={editingCategoryId}
              setEditingCategoryId={setEditingCategoryId}
              editingCategoryName={editingCategoryName}
              setEditingCategoryName={setEditingCategoryName}
              onAdd={() => addCategory('income')}
              onRename={renameCategory}
              onDelete={deleteCategory}
              onClose={() => setManageCategoryType(null)}
            />
          )}

          {showIncomeForm && (
            <div style={{ ...cardStyle, padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 20px' }}>{editingIncome ? 'Edit Income' : 'Log Income'}</h3>
              {formError && <div style={{ padding: '10px 14px', borderRadius: t.radius.md, background: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.sm, marginBottom: '16px' }}>{formError}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Source *</label>
                  <input value={incomeForm.income_stream} onChange={e => setIncomeForm(p => ({ ...p, income_stream: e.target.value }))} placeholder="e.g. Client retainer, sponsorship" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Amount *</label>
                  <input type="number" value={incomeForm.amount} onChange={e => setIncomeForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>
                    Date {incomeForm.date && <span style={{ color: t.colors.primary, fontWeight: '600' }}>→ {quarterFromDate(incomeForm.date)}</span>}
                  </label>
                  <input type="date" value={incomeForm.date} onChange={e => setIncomeForm(p => ({ ...p, date: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={incomeForm.status} onChange={e => setIncomeForm(p => ({ ...p, status: e.target.value }))} style={inputStyle}>
                    <option value="received">Received</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select value={incomeForm.tax_category} onChange={e => setIncomeForm(p => ({ ...p, tax_category: e.target.value }))} style={inputStyle}>
                    <option value="">Select category</option>
                    {incomeCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Link to Event/Project</label>
                  <select value={incomeForm.project_id} onChange={e => setIncomeForm(p => ({ ...p, project_id: e.target.value }))} style={inputStyle}>
                    <option value="">Unassigned</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Notes</label>
                  <input value={incomeForm.notes} onChange={e => setIncomeForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any additional context..." style={inputStyle} />
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
              <button key={v} onClick={() => setActiveView(v)} style={{ padding: '7px 16px', borderRadius: t.radius.sm, border: 'none', background: activeView === v ? t.colors.bgCard : 'transparent', color: activeView === v ? t.colors.textPrimary : t.colors.textSecondary, fontSize: t.fontSizes.sm, fontWeight: activeView === v ? '600' : '400', fontFamily: t.fonts.sans, cursor: 'pointer', boxShadow: activeView === v ? t.shadows.sm : 'none' }}>
                {v === 'overview' ? 'By Category' : 'By Event/Project'}
              </button>
            ))}
          </div>

          {activeView === 'overview' && (
            incomeByCategory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', background: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}`, color: t.colors.textSecondary }}>
                No income logged yet for {year} — use "+ Log Income" above to get started.
              </div>
            ) : (
              <div style={tableWrapStyle}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Item</th>
                      <th style={thStyle}>Category</th>
                      <th style={thStyle}>Event/Project</th>
                      <th style={thStyle}>Quarter</th>
                      <th style={thStyle}>Notes</th>
                      <th style={thStyle}>Status</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                      <th style={{ ...thStyle, borderRight: 'none' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeByCategory.map(cat => (
                      <Fragment key={cat.category}>
                        <GroupHeaderRow label={cat.category} leftValue={fmt(cat.received)} rightValue={fmt(cat.pending)} />
                        {cat.items.map(item => <IncomeRow key={item.id} item={item} projects={projects} onEdit={startEditIncome} onDelete={deleteIncome} onToggleStatus={handleIncomeStatusClick} />)}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeView === 'by-project' && (
            incomeByProject.length === 0 && unassignedIncome.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', background: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}`, color: t.colors.textSecondary }}>
                No income logged yet for {year} — use "+ Log Income" above to get started.
              </div>
            ) : (
              <div style={tableWrapStyle}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Item</th>
                      <th style={thStyle}>Category</th>
                      <th style={thStyle}>Event/Project</th>
                      <th style={thStyle}>Quarter</th>
                      <th style={thStyle}>Notes</th>
                      <th style={thStyle}>Status</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                      <th style={{ ...thStyle, borderRight: 'none' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeByProject.map(proj => (
                      <Fragment key={proj.id}>
                        <GroupHeaderRow label={proj.title} leftValue={fmt(proj.received)} rightValue={fmt(proj.pending)} />
                        {proj.items.map(item => <IncomeRow key={item.id} item={item} projects={projects} onEdit={startEditIncome} onDelete={deleteIncome} onToggleStatus={handleIncomeStatusClick} />)}
                      </Fragment>
                    ))}
                    {unassignedIncome.length > 0 && (
                      <Fragment>
                        <GroupHeaderRow
                          label="Unassigned"
                          leftValue={fmt(unassignedIncome.filter(r => r.status === 'received').reduce((s, r) => s + Number(r.amount || 0), 0))}
                          rightValue={fmt(unassignedIncome.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.amount || 0), 0))}
                        />
                        {unassignedIncome.map(item => <IncomeRow key={item.id} item={item} projects={projects} onEdit={startEditIncome} onDelete={deleteIncome} onToggleStatus={handleIncomeStatusClick} />)}
                      </Fragment>
                    )}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}

      {confirmModal && (
        <ConfirmAmountModal
          title={confirmModal.kind === 'expense' ? 'Confirm actual amount' : 'Confirm received amount'}
          itemLabel={confirmModal.kind === 'expense' ? confirmModal.item.label : confirmModal.item.income_stream}
          initialAmount={confirmModal.amount}
          onCancel={() => setConfirmModal(null)}
          onConfirm={amount => {
            if (confirmModal.kind === 'expense') confirmExpenseActual(confirmModal.item, amount)
            else confirmIncomeReceived(confirmModal.item, amount)
            setConfirmModal(null)
          }}
        />
      )}
    </div>
  )
}

function CategoryManagerPanel({ categories, newCategoryName, setNewCategoryName, editingCategoryId, setEditingCategoryId, editingCategoryName, setEditingCategoryName, onAdd, onRename, onDelete, onClose }) {
  return (
    <div style={{ ...cardStyle, padding: '16px 20px', marginBottom: '24px' }}>
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
                style={{ ...inputStyle, padding: '5px 8px', flex: 1 }}
              />
            ) : (
              <span style={{ flex: 1, fontSize: t.fontSizes.sm, color: t.colors.textPrimary }}>{cat.name}</span>
            )}
            <button onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name) }} style={rowActionBtnStyle(false)}>Rename</button>
            <button onClick={() => onDelete(cat)} style={rowActionBtnStyle(true)}>Delete</button>
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
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={onAdd} style={{ padding: '9px 16px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.sm, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>Add</button>
      </div>
    </div>
  )
}

function GroupHeaderRow({ label, leftValue, rightValue, rightDanger }) {
  return (
    <tr>
      <td style={{ ...tdStyle, fontWeight: '700', background: t.colors.bg }} colSpan={5}>{label}</td>
      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', background: t.colors.bg }}>{leftValue}</td>
      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', background: t.colors.bg, color: rightDanger ? t.colors.danger : t.colors.textPrimary }}>{rightValue}</td>
      <td style={{ ...tdStyle, background: t.colors.bg, borderRight: 'none' }} />
    </tr>
  )
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      <button onClick={onEdit} style={rowActionBtnStyle(false)}>Edit</button>
      <button onClick={onDelete} style={rowActionBtnStyle(true)}>Delete</button>
    </div>
  )
}

function ExpenseItemRow({ item, status, projects, onEdit, onDelete, onToggleStatus }) {
  const isPlanned = status === 'planned'
  const quarter = quarterFromDate(isPlanned ? item.item_date : item.date)
  const amount = isPlanned ? item.projected_amount : item.amount
  return (
    <tr>
      <td style={tdStyle}>{isPlanned ? item.label : item.title}</td>
      <td style={tdStyle}>{item.category || '—'}</td>
      <td style={tdStyle}>{item.project_id ? (projects.find(p => p.id === item.project_id)?.title || '—') : '—'}</td>
      <td style={tdStyle}>{quarter ? <span style={quarterBadgeStyle}>{quarter}</span> : '—'}</td>
      <td style={{ ...tdStyle, color: t.colors.textTertiary }}>{item.notes || '—'}</td>
      <td style={tdStyle}>
        <button
          onClick={() => onToggleStatus(item, status)}
          style={{
            padding: '3px 10px', borderRadius: t.radius.full, fontSize: t.fontSizes.xs, fontWeight: '500', cursor: 'pointer', border: 'none',
            background: isPlanned ? t.colors.warningLight : t.colors.successLight,
            color: isPlanned ? t.colors.warning : t.colors.success,
          }}
        >
          {status}
        </button>
      </td>
      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600' }}>{fmt(amount)}</td>
      <td style={{ ...tdStyle, borderRight: 'none' }}><RowActions onEdit={() => onEdit(item, status)} onDelete={() => onDelete(item.id, status)} /></td>
    </tr>
  )
}

function IncomeRow({ item, projects, onEdit, onDelete, onToggleStatus }) {
  const quarter = quarterFromDate(item.date)
  return (
    <tr>
      <td style={tdStyle}>{item.income_stream}</td>
      <td style={tdStyle}>{item.tax_category || '—'}</td>
      <td style={tdStyle}>{item.project_id ? (projects.find(p => p.id === item.project_id)?.title || '—') : '—'}</td>
      <td style={tdStyle}>{quarter ? <span style={quarterBadgeStyle}>{quarter}</span> : '—'}</td>
      <td style={{ ...tdStyle, color: t.colors.textTertiary }}>{item.notes || '—'}</td>
      <td style={tdStyle}>
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
      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600' }}>{fmt(item.amount)}</td>
      <td style={{ ...tdStyle, borderRight: 'none' }}><RowActions onEdit={() => onEdit(item)} onDelete={() => onDelete(item.id)} /></td>
    </tr>
  )
}

function ConfirmAmountModal({ title, itemLabel, initialAmount, onCancel, onConfirm }) {
  const [amount, setAmount] = useState(initialAmount ?? '')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onCancel}>
      <div style={{ ...cardStyle, padding: '24px', width: '100%', maxWidth: '380px' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes.lg, fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 4px' }}>{title}</h3>
        <p style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, margin: '0 0 16px' }}>{itemLabel} — confirm or adjust the amount before it's finalized.</p>
        <label style={labelStyle}>Amount</label>
        <input
          autoFocus
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onConfirm(amount); if (e.key === 'Escape') onCancel() }}
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
          <button onClick={() => onConfirm(amount)} style={{ padding: '9px 20px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>Confirm</button>
          <button onClick={onCancel} style={{ padding: '9px 20px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
