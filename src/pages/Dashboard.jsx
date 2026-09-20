import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import { Icon } from '../components/Icon'
import Orb from '../components/Orb'
import { parseQuickAdd } from '../lib/quickAdd'
import { getModules } from '../utils/businessModules'

const QUICK_ADD_TYPE_META = {
  client: { label: 'Client', icon: 'client-add', color: '#534AB7', bg: '#EEEDF9' },
  task: { label: 'Task', icon: 'task', color: '#6B8F71', bg: '#EAF2EA' },
  business_event: { label: 'Event', icon: 'events', color: '#D4874E', bg: '#FBF0E6' },
  spark_idea: { label: 'Idea', icon: 'idea', color: '#D4874E', bg: '#FBF0E6' },
  project: { label: 'Project', icon: 'projects', color: '#3E6FB1', bg: '#E8EFF8' },
  content_idea: { label: 'Content idea', icon: 'campaigns', color: '#A34FA0', bg: '#F6EAF5' },
  vendor: { label: 'Vendor', icon: 'vendors', color: '#3E8F8A', bg: '#E7F3F2' },
  goal: { label: 'Goal', icon: 'team-goals', color: '#B18A3E', bg: '#F8F1E4' },
  income: { label: 'Income', icon: 'revenue', color: '#6B8F71', bg: '#EAF2EA' },
  expense: { label: 'Expense', icon: 'expense', color: '#B3453D', bg: '#F8EAE9' },
  invoice: { label: 'Invoice', icon: 'invoice', color: '#534AB7', bg: '#EEEDF9' },
}

// Month boundaries as plain YYYY-MM-DD, for comparing against `date` columns
// (invoice_payments.paid_date, revenue.date) which have no time component.
function monthBoundaryDate(offsetMonths) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offsetMonths)
  return d.toISOString().slice(0, 10)
}

// Month boundaries as full ISO timestamps, for comparing against
// timestamptz `created_at` columns.
function monthBoundaryISO(offsetMonths) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offsetMonths)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

const QUICK_ADD_MAX_LEN = 600

function fmtCurrency(n) {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

// Matches TeamGoals.jsx's periodFromDate — goals created here need the same "Q# YYYY" format.
function periodFromDate(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date()
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `Q${q} ${d.getFullYear()}`
}

const PROJECT_STATUS_FILTERS = [
  { key: 'planning', label: 'Planning', color: '#534AB7', bg: '#EEEDF9' },
  { key: 'active',   label: 'In Progress', color: '#6B8F71', bg: '#EAF2EA' },
  { key: 'on-hold',  label: 'Paused', color: '#D4874E', bg: '#FBF0E6' },
]

const GOAL_STATUS_FILTERS = [
  { statKey: 'onTrack',   label: 'On track',    color: '#6B8F71', bg: '#EAF2EA' },
  { statKey: 'atRisk',    label: 'At risk',     color: '#D4874E', bg: '#FBF0E6' },
  { statKey: 'completed', label: 'Completed',   color: '#3E6FB1', bg: '#E8EFF8' },
  { statKey: 'notStarted', label: 'Not started', color: t.colors.textTertiary, bg: t.colors.bg },
]

const cardStyle = { backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '20px 24px', border: `1px solid ${t.colors.borderLight}` }

// Matches the top stat cards on the Snapshot page (Income/Expenses/Net).
const snapshotLabelStyle = { fontSize: t.fontSizes.xs, color: t.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }
const snapshotValueStyle = { fontSize: '22px', fontWeight: '700', color: t.colors.textPrimary, fontFamily: t.fonts.heading, marginBottom: '2px' }

// ── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ label, onViewAll, viewAllColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
      <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: t.colors.textTertiary }}>
        {label}
      </span>
      {onViewAll && (
        <button onClick={onViewAll} style={{ fontSize: t.fontSizes.xs, color: viewAllColor || t.colors.primary, background: 'none', border: 'none', cursor: 'pointer', fontFamily: t.fonts.sans, fontWeight: '600' }}>
          View all →
        </button>
      )}
    </div>
  )
}

// ── Stat primitives ──────────────────────────────────────────────────────────

function StatNumber({ value, label }) {
  return (
    <div>
      <div style={{ fontSize: '26px', fontWeight: '700', color: t.colors.textPrimary, fontFamily: t.fonts.heading, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '2px' }}>{label}</div>
    </div>
  )
}

function StatPill({ label, count, color, bg }) {
  return (
    <span style={{ fontSize: t.fontSizes.xs, fontWeight: '600', padding: '3px 10px', borderRadius: t.radius.full, backgroundColor: bg, color, whiteSpace: 'nowrap' }}>
      {label} ({count})
    </span>
  )
}

// ── Quick add preview card ──────────────────────────────────────────────────

const QUICK_ADD_FIELD_LABELS = {
  name: 'Name', company: 'Company', email: 'Email', phone: 'Phone', note: 'Note',
  title: 'Title', due_date: 'Due date', client_name: 'Related client',
  date: 'Date', location: 'Location', notes: 'Notes',
  project_type: 'Project type', budget: 'Budget', start_date: 'Start date',
  platform: 'Platform', scheduled_date: 'Scheduled date',
  category: 'Category', owner: 'Owner',
  income_stream: 'Source', amount: 'Amount', description: 'Description',
}

function fieldInputStyle(multiline) {
  return {
    width: '100%', boxSizing: 'border-box',
    padding: '7px 10px', borderRadius: multiline ? t.radius.md : t.radius.full,
    border: `1px solid ${t.colors.borderLight}`,
    backgroundColor: t.colors.bg, color: t.colors.textPrimary,
    fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, outline: 'none',
  }
}

function QuickAddPreviewCard({ item, onChange, onRemove }) {
  const meta = QUICK_ADD_TYPE_META[item.type] || QUICK_ADD_TYPE_META.spark_idea
  const fieldKeys = Object.keys(item.fields)
  return (
    <div style={{ backgroundColor: t.colors.bg, border: `1px solid ${t.colors.borderLight}`, borderRadius: t.radius.md, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontSize: t.fontSizes.xs, fontWeight: '700', padding: '3px 10px',
          borderRadius: t.radius.full, backgroundColor: meta.bg, color: meta.color,
        }}>
          <Icon name={meta.icon} size="sm" />
          {meta.label}
        </span>
        <button
          onClick={onRemove}
          aria-label="Remove item"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.colors.textTertiary, display: 'flex', padding: '2px' }}
        >
          <Icon name="close" size="sm" />
        </button>
      </div>
      <div style={{ display: 'grid', gap: '8px' }}>
        {fieldKeys.map(key => (
          <label key={key} style={{ display: 'block' }}>
            <span style={{ fontSize: '10px', fontWeight: '600', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px', display: 'block' }}>
              {QUICK_ADD_FIELD_LABELS[key] || key}
            </span>
            {key === 'note' || key === 'notes' ? (
              <textarea
                value={item.fields[key] || ''}
                onChange={e => onChange(key, e.target.value)}
                rows={2}
                style={{ ...fieldInputStyle(true), resize: 'none' }}
              />
            ) : (
              <input
                type={key === 'due_date' || key === 'date' ? 'date' : key === 'amount' ? 'number' : 'text'}
                value={item.fields[key] || ''}
                onChange={e => onChange(key, e.target.value)}
                style={fieldInputStyle(false)}
              />
            )}
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard({ session, businessSpaceId, userRole, onNavigate }) {
  const modules = getModules(businessSpaceId)
  const [settings, setSettings] = useState(null)

  // Quick add
  const [quickTask, setQuickTask] = useState('')
  const quickTaskRef = useRef(null)
  const [quickAddParsing, setQuickAddParsing] = useState(false)
  const [quickAddError, setQuickAddError] = useState('')
  const [quickAddItems, setQuickAddItems] = useState(null) // [{ type, fields }] or null when no preview
  const [quickAddSaving, setQuickAddSaving] = useState(false)
  const [showPulseInfo, setShowPulseInfo] = useState(false)

  // Project pulse
  const [projectPulse, setProjectPulse] = useState({ active: 0, overdue: 0, dueThisWeek: 0, statusCounts: { planning: 0, active: 0, 'on-hold': 0 } })

  // Revenue snapshot (director only)
  const isDirector = ['owner', 'co-owner'].includes(userRole)
  const [revenueSnapshot, setRevenueSnapshot] = useState({ income: 0, incomeLastMonth: 0, expenses: 0 })

  // Team goals progress
  const [goalsProgress, setGoalsProgress] = useState({ onTrack: 0, atRisk: 0, completed: 0, notStarted: 0, total: 0 })

  function getGreeting() {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  function getTodayLabel() {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  async function fetchSettings() {
    if (!session) return
    const { data } = await supabase.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle()
    const { data: business } = businessSpaceId
      ? await supabase.from('business_spaces').select('name, logo_url').eq('id', businessSpaceId).single()
      : { data: null }
    setSettings({ ...data, business_name: business?.name || '', logo_url: business?.logo_url || '' })
  }

  async function fetchProjectPulse() {
    if (!businessSpaceId || !modules.clientManagement) return
    const todayStr = new Date().toISOString().slice(0, 10)
    const weekOutStr = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

    const [projectsRes, tasksRes, milestonesRes] = await Promise.all([
      supabase.from('projects').select('id, status').eq('business_space_id', businessSpaceId).eq('type', 'project').in('status', ['planning', 'active', 'on-hold']),
      supabase.from('tasks').select('due_date, status').eq('business_space_id', businessSpaceId).not('project_id', 'is', null).not('due_date', 'is', null).neq('status', 'done'),
      supabase.from('project_milestones').select('target_date, status').eq('business_space_id', businessSpaceId).not('target_date', 'is', null).neq('status', 'done'),
    ])
    const projects = projectsRes.data || []

    const statusCounts = { planning: 0, active: 0, 'on-hold': 0 }
    for (const p of projects) if (statusCounts[p.status] !== undefined) statusCounts[p.status]++

    const deadlineDates = [
      ...(tasksRes.data || []).map(row => row.due_date),
      ...(milestonesRes.data || []).map(row => row.target_date),
    ]
    const overdue = deadlineDates.filter(d => d < todayStr).length
    const dueThisWeek = deadlineDates.filter(d => d >= todayStr && d <= weekOutStr).length

    setProjectPulse({ active: projects.length, overdue, dueThisWeek, statusCounts })
  }

  async function fetchRevenueSnapshot() {
    if (!businessSpaceId || !isDirector || !modules.money) return
    const thisMonthStart = monthBoundaryDate(0)
    const thisMonthEnd = monthBoundaryDate(1)
    const lastMonthStart = monthBoundaryDate(-1)

    const [invoicesRes, revenueRes, expensesRes] = await Promise.all([
      supabase.from('invoices').select('invoice_payments(amount, paid_date)').eq('business_space_id', businessSpaceId),
      supabase.from('revenue').select('amount, date, status').eq('business_space_id', businessSpaceId),
      supabase.from('expenses').select('amount, date').eq('business_space_id', businessSpaceId),
    ])

    const allPayments = (invoicesRes.data || []).flatMap(inv => inv.invoice_payments || [])
    const receivedRevenue = (revenueRes.data || []).filter(r => r.status === 'received')
    const expenses = expensesRes.data || []

    const inRange = (dateStr, start, end) => dateStr && dateStr >= start && dateStr < end
    const sumIncomeInRange = (start, end) =>
      allPayments.filter(p => inRange(p.paid_date, start, end)).reduce((s, p) => s + Number(p.amount || 0), 0) +
      receivedRevenue.filter(r => inRange(r.date, start, end)).reduce((s, r) => s + Number(r.amount || 0), 0)
    const sumExpensesInRange = (start, end) =>
      expenses.filter(e => inRange(e.date, start, end)).reduce((s, e) => s + Number(e.amount || 0), 0)

    setRevenueSnapshot({
      income: sumIncomeInRange(thisMonthStart, thisMonthEnd),
      incomeLastMonth: sumIncomeInRange(lastMonthStart, thisMonthStart),
      expenses: sumExpensesInRange(thisMonthStart, thisMonthEnd),
    })
  }

  async function fetchGoalsProgress() {
    if (!businessSpaceId || !modules.team) return
    const { data } = await supabase.from('team_goals').select('status').eq('business_space_id', businessSpaceId)
    const goals = data || []
    setGoalsProgress({
      onTrack: goals.filter(g => g.status === 'on-track').length,
      atRisk: goals.filter(g => g.status === 'at-risk').length,
      completed: goals.filter(g => g.status === 'completed').length,
      notStarted: goals.filter(g => g.status === 'not-started').length,
      total: goals.length,
    })
  }

  useEffect(() => {
    queueMicrotask(() => {
      fetchSettings()
      fetchProjectPulse()
      fetchRevenueSnapshot()
      fetchGoalsProgress()
    })
  }, [businessSpaceId])

  useEffect(() => {
    const el = quickTaskRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
    el.style.overflowY = el.scrollHeight > 220 ? 'auto' : 'hidden'
  }, [quickTask])

  async function handleQuickAddSubmit(e) {
    if (e.key !== 'Enter' || e.shiftKey || !quickTask.trim() || !businessSpaceId || quickAddParsing) return
    e.preventDefault()
    const text = quickTask.trim()
    setQuickAddParsing(true)
    setQuickAddError('')
    try {
      const items = await parseQuickAdd(text)
      if (!items.length) {
        setQuickAddError("Couldn't find anything to add in that — try rephrasing.")
      } else {
        setQuickAddItems(items.map(item => ({ ...item, fields: { ...item.fields } })))
        setQuickTask('')
      }
    } catch (err) {
      setQuickAddError(err.message || 'Something went wrong parsing that.')
    } finally {
      setQuickAddParsing(false)
    }
  }

  function updateQuickAddField(index, field, value) {
    setQuickAddItems(prev => prev.map((item, i) => i === index ? { ...item, fields: { ...item.fields, [field]: value } } : item))
  }

  function removeQuickAddItem(index) {
    setQuickAddItems(prev => {
      const next = prev.filter((_, i) => i !== index)
      return next.length ? next : null
    })
  }

  function cancelQuickAdd() {
    setQuickAddItems(null)
    setQuickAddError('')
  }

  async function confirmQuickAdd() {
    if (!quickAddItems?.length || !businessSpaceId) return
    setQuickAddSaving(true)
    setQuickAddError('')
    try {
      const clientItems = quickAddItems.filter(i => i.type === 'client')
      const others = quickAddItems.filter(i => i.type !== 'client')

      // Clients first so their ids are available for task linking below.
      const nameToClientId = {}
      for (const { fields } of clientItems) {
        const { note, ...clientFields } = fields
        const { data: client, error } = await supabase
          .from('clients')
          .insert({ ...clientFields, business_space_id: businessSpaceId, user_id: session.user.id })
          .select('id, name')
          .single()
        if (error) throw error
        nameToClientId[client.name.toLowerCase()] = client.id
        if (note?.trim()) {
          await supabase.from('notes').insert({
            content: note.trim(), client_id: client.id,
            business_space_id: businessSpaceId, user_id: session.user.id,
          })
        }
      }

      for (const { type, fields } of others) {
        if (type === 'task') {
          const { client_name, ...taskFields } = fields
          const client_id = client_name ? nameToClientId[client_name.toLowerCase()] || null : null
          await supabase.from('tasks').insert({
            ...taskFields, client_id, business_space_id: businessSpaceId, status: 'todo',
          })
        } else if (type === 'business_event') {
          await supabase.from('business_events').insert({
            ...fields, type: 'networking', event_type: 'attending', status: 'upcoming',
            business_space_id: businessSpaceId, user_id: session.user.id,
          })
        } else if (type === 'spark_idea') {
          await supabase.from('projects').insert({
            title: fields.title, business_space_id: businessSpaceId, user_id: session.user.id,
            type: 'event', event_status: 'concept',
          })
        } else if (type === 'project') {
          const { title, budget, ...rest } = fields
          await supabase.from('projects').insert({
            ...rest, title, budget: budget ? parseFloat(budget) : null,
            type: 'project', status: 'planning', has_event_features: false,
            business_space_id: businessSpaceId, user_id: session.user.id,
          })
        } else if (type === 'content_idea') {
          await supabase.from('content_calendar').insert({
            ...fields, status: 'idea',
            business_space_id: businessSpaceId, user_id: session.user.id,
          })
        } else if (type === 'vendor') {
          await supabase.from('vendors').insert({
            ...fields, tags: [],
            business_space_id: businessSpaceId, user_id: session.user.id,
          })
        } else if (type === 'goal') {
          const { due_date, ...rest } = fields
          await supabase.from('team_goals').insert({
            ...rest, due_date: due_date || null, period: periodFromDate(due_date),
            status: 'not-started', category: 'team',
            business_space_id: businessSpaceId,
          })
        } else if (type === 'income') {
          const { amount, ...rest } = fields
          await supabase.from('revenue').insert({
            ...rest, amount: parseFloat(amount) || 0, status: 'received',
            business_space_id: businessSpaceId, user_id: session.user.id,
          })
        } else if (type === 'expense') {
          const { amount, ...rest } = fields
          await supabase.from('expenses').insert({
            ...rest, amount: parseFloat(amount) || 0,
            business_space_id: businessSpaceId, user_id: session.user.id,
          })
        } else if (type === 'invoice') {
          const { client_name, amount, description } = fields
          const client_id = client_name ? nameToClientId[client_name.toLowerCase()] || null : null
          const { data: invoice, error } = await supabase.from('invoices').insert({
            client_id, due_date: fields.due_date || null, status: 'draft',
            business_space_id: businessSpaceId, user_id: session.user.id,
          }).select('id').single()
          if (error) throw error
          await supabase.from('line_items').insert({
            invoice_id: invoice.id,
            description: description || (client_name ? `Services for ${client_name}` : 'Services'),
            quantity: 1, unit_price: parseFloat(amount) || 0,
          })
        }
      }

      setQuickAddItems(null)
      fetchProjectPulse()
      fetchRevenueSnapshot()
      fetchGoalsProgress()
    } catch (err) {
      setQuickAddError(err.message || 'Something went wrong saving those.')
    } finally {
      setQuickAddSaving(false)
    }
  }

  const revenueDelta = revenueSnapshot.income - revenueSnapshot.incomeLastMonth
  const netThisMonth = revenueSnapshot.income - revenueSnapshot.expenses

  const firstName = settings?.first_name || session?.user?.email?.split('@')[0] || ''
  const workspaceName = settings?.business_name || ''
  const workspaceLogo = settings?.logo_url || ''
  const initials = (firstName || 'U').charAt(0).toUpperCase()

  return (
    <div style={{ padding: '28px 32px', fontFamily: t.fonts.sans, maxWidth: '1200px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px', gap: '10px' }}>
        {workspaceLogo ? (
          <img src={workspaceLogo} alt="logo" style={{ width: '64px', height: '64px', borderRadius: t.radius.full, objectFit: 'cover', border: `1px solid ${t.colors.borderLight}` }} />
        ) : (
          <div style={{
            width: '64px', height: '64px', borderRadius: t.radius.full,
            backgroundColor: t.colors.primary, color: t.colors.textInverse,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', fontWeight: '700', fontFamily: t.fonts.sans,
          }}>
            {initials}
          </div>
        )}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: t.fonts.heading, fontSize: '22px', fontWeight: '700', color: t.colors.textPrimary, letterSpacing: '-0.4px', lineHeight: 1.2 }}>
            {getGreeting()}, {firstName} 👋
          </div>
          {workspaceName && (
            <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary, marginTop: '2px', fontWeight: '600' }}>
              {workspaceName}
            </div>
          )}
          <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '2px' }}>
            {getTodayLabel()}
          </div>
        </div>
      </div>

      {/* ── Orbi (hero quick-add) ── */}
      <div style={{ backgroundColor: t.colors.bgCard, border: `1px solid ${t.colors.borderLight}`, borderRadius: t.radius.card, padding: '28px 32px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Orb size={18} />
            <span style={{ fontSize: t.fontSizes.sm, fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', color: t.colors.textTertiary }}>
              Orbi
            </span>
            <button
              onClick={() => setShowPulseInfo(v => !v)}
              aria-label="How Orbi works"
              style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: t.colors.textTertiary }}
            >
              <Icon name="info" size="sm" />
            </button>
          </div>
          {quickAddParsing && (
            <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>
              Thinking…
            </span>
          )}
        </div>
        {showPulseInfo && (
          <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, marginBottom: '14px', marginTop: '-6px' }}>
            Jot it down naturally. Orbi will draft the right item - client, task, project, event, goal, income, expense or invoice - and you confirm before anything is created.
          </div>
        )}
        <textarea
          ref={quickTaskRef}
          value={quickTask}
          onChange={e => setQuickTask(e.target.value)}
          onKeyDown={handleQuickAddSubmit}
          disabled={quickAddParsing}
          placeholder="Met Sarah from Bloom Events, need to send her a proposal by Friday…"
          maxLength={QUICK_ADD_MAX_LEN}
          rows={1}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '18px 24px', borderRadius: t.radius.xl,
            border: `1px solid ${t.colors.border}`,
            backgroundColor: t.colors.bg, color: t.colors.textPrimary,
            fontSize: t.fontSizes.md, fontFamily: t.fonts.sans,
            outline: 'none', opacity: quickAddParsing ? 0.6 : 1,
            resize: 'none', overflow: 'hidden', maxHeight: '220px',
            lineHeight: 1.5,
          }}
        />
        {quickTask.length > QUICK_ADD_MAX_LEN * 0.8 && (
          <div style={{
            textAlign: 'right', marginTop: '4px', fontSize: t.fontSizes.xs,
            color: quickTask.length >= QUICK_ADD_MAX_LEN ? '#B3453D' : t.colors.textTertiary,
          }}>
            {quickTask.length} / {QUICK_ADD_MAX_LEN}
          </div>
        )}

        {quickAddError && (
          <div style={{ marginTop: '10px', fontSize: t.fontSizes.sm, color: '#B3453D' }}>
            {quickAddError}
          </div>
        )}

        {quickAddItems && (
          <div style={{ backgroundColor: t.colors.bg, border: `1px solid ${t.colors.borderLight}`, borderRadius: t.radius.lg, padding: '16px', marginTop: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
              {quickAddItems.map((item, i) => (
                <QuickAddPreviewCard
                  key={i}
                  item={item}
                  onChange={(field, value) => updateQuickAddField(i, field, value)}
                  onRemove={() => removeQuickAddItem(i)}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <button
                onClick={confirmQuickAdd}
                disabled={quickAddSaving}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '9px 18px', borderRadius: t.radius.full, border: 'none',
                  backgroundColor: t.colors.primary, color: t.colors.textInverse,
                  fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer',
                  fontFamily: t.fonts.sans, opacity: quickAddSaving ? 0.6 : 1,
                }}
              >
                {quickAddSaving ? 'Adding…' : `Add all (${quickAddItems.length})`}
              </button>
              <button
                onClick={cancelQuickAdd}
                disabled={quickAddSaving}
                style={{
                  padding: '9px 18px', borderRadius: t.radius.full,
                  border: `1px solid ${t.colors.borderLight}`,
                  backgroundColor: 'transparent', color: t.colors.textSecondary,
                  fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Revenue Snapshot — director only, styled like the Snapshot page's top stat cards ── */}
      {isDirector && modules.money && (
        <div style={{ marginBottom: '16px' }}>
          <SectionHeader label="Revenue Snapshot" onViewAll={() => onNavigate('snapshot')} viewAllColor={t.colors.primary} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
            <div style={cardStyle}>
              <div style={snapshotLabelStyle}>Income</div>
              <div style={snapshotValueStyle}>{fmtCurrency(revenueSnapshot.income)}</div>
              <div style={{ fontSize: t.fontSizes.xs, color: revenueDelta >= 0 ? '#6B8F71' : '#B3453D' }}>
                {revenueDelta >= 0 ? '↑' : '↓'} {fmtCurrency(Math.abs(revenueDelta))} vs last month
              </div>
            </div>
            <div style={cardStyle}>
              <div style={snapshotLabelStyle}>Expenses</div>
              <div style={snapshotValueStyle}>{fmtCurrency(revenueSnapshot.expenses)}</div>
              <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>This month</div>
            </div>
            <div style={{ ...cardStyle, border: `1px solid ${netThisMonth < 0 ? '#B3453D' : t.colors.borderLight}` }}>
              <div style={snapshotLabelStyle}>Net</div>
              <div style={{ ...snapshotValueStyle, color: netThisMonth < 0 ? '#B3453D' : t.colors.textPrimary }}>{fmtCurrency(netThisMonth)}</div>
              <div style={{ fontSize: t.fontSizes.xs, color: netThisMonth < 0 ? '#B3453D' : t.colors.textTertiary }}>
                {netThisMonth < 0 ? 'Spending more than earning' : 'Income exceeds spend'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stat cards ── */}
      {(modules.clientManagement || modules.team) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '16px' }}>

          {/* Project Pulse */}
          {modules.clientManagement && (
            <div style={cardStyle}>
              <SectionHeader label="Project Pulse" onViewAll={() => onNavigate('projects')} viewAllColor={t.colors.primary} />
              <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
                <StatNumber value={projectPulse.overdue} label="Overdue" />
                <StatNumber value={projectPulse.dueThisWeek} label="Due this week" />
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {PROJECT_STATUS_FILTERS.map(f => (
                  <StatPill key={f.key} label={f.label} count={projectPulse.statusCounts[f.key]} color={f.color} bg={f.bg} />
                ))}
              </div>
              <div style={{ fontSize: t.fontSizes.sm, color: projectPulse.overdue > 0 ? '#B3453D' : t.colors.textTertiary }}>
                {projectPulse.overdue > 0
                  ? `${projectPulse.overdue} task${projectPulse.overdue === 1 ? '' : 's'}/milestone${projectPulse.overdue === 1 ? '' : 's'} past due`
                  : "Nothing overdue"}
              </div>
            </div>
          )}

          {/* Team Goals — status breakdown */}
          {modules.team && (
            <div style={cardStyle}>
              <SectionHeader label="Team Goals" onViewAll={() => onNavigate('team-goals')} viewAllColor={t.colors.primary} />
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '26px', fontWeight: '700', color: t.colors.textPrimary, fontFamily: t.fonts.heading, lineHeight: 1.1 }}>
                  {goalsProgress.total}
                </div>
                <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '2px' }}>total goals</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {GOAL_STATUS_FILTERS.map(f => (
                  <StatPill key={f.statKey} label={f.label} count={goalsProgress[f.statKey]} color={f.color} bg={f.bg} />
                ))}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  )
}
