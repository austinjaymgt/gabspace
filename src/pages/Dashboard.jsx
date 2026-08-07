import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import { Icon } from '../components/Icon'
import { parseQuickAdd } from '../lib/quickAdd'

const QUICK_ADD_TYPE_META = {
  client: { label: 'Client', icon: 'client-add', color: '#534AB7', bg: '#EEEDF9' },
  task: { label: 'Task', icon: 'task', color: '#6B8F71', bg: '#EAF2EA' },
  business_event: { label: 'Event', icon: 'events', color: '#D4874E', bg: '#FBF0E6' },
  spark_idea: { label: 'Idea', icon: 'idea', color: '#D4874E', bg: '#FBF0E6' },
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

function fmtCurrency(n) {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const PROJECT_STATUS_FILTERS = [
  { key: 'planning', label: 'Planning', color: '#534AB7', bg: '#EEEDF9' },
  { key: 'active',   label: 'In Progress', color: '#6B8F71', bg: '#EAF2EA' },
  { key: 'on-hold',  label: 'Paused', color: '#D4874E', bg: '#FBF0E6' },
]

const cardStyle = { backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '20px 24px', border: `1px solid ${t.colors.borderLight}` }

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
                type={key === 'due_date' || key === 'date' ? 'date' : 'text'}
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
  const [settings, setSettings] = useState(null)

  // Quick add
  const [quickTask, setQuickTask] = useState('')
  const quickTaskRef = useRef(null)
  const [quickAddParsing, setQuickAddParsing] = useState(false)
  const [quickAddError, setQuickAddError] = useState('')
  const [quickAddItems, setQuickAddItems] = useState(null) // [{ type, fields }] or null when no preview
  const [quickAddSaving, setQuickAddSaving] = useState(false)

  // Project pulse
  const [projectPulse, setProjectPulse] = useState({ active: 0, stalled: 0, statusCounts: { planning: 0, active: 0, 'on-hold': 0 } })

  // Revenue snapshot (director only)
  const isDirector = ['owner', 'co-owner'].includes(userRole)
  const [revenueSnapshot, setRevenueSnapshot] = useState({ outstanding: 0, collectedThisMonth: 0, collectedLastMonth: 0 })

  // Team goals progress
  const [goalsProgress, setGoalsProgress] = useState({ avgProgress: 0, onTrack: 0, atRisk: 0, completed: 0, total: 0 })

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
    if (!businessSpaceId) return
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString()
    const [projectsRes, tasksRes] = await Promise.all([
      supabase.from('projects').select('id, created_at, status').eq('business_space_id', businessSpaceId).eq('type', 'project').in('status', ['planning', 'active', 'on-hold']),
      supabase.from('tasks').select('project_id, created_at').eq('business_space_id', businessSpaceId).not('project_id', 'is', null),
    ])
    const projects = projectsRes.data || []

    const statusCounts = { planning: 0, active: 0, 'on-hold': 0 }
    for (const p of projects) if (statusCounts[p.status] !== undefined) statusCounts[p.status]++

    const lastActivity = {}
    for (const p of projects) lastActivity[p.id] = p.created_at
    for (const tk of tasksRes.data || []) {
      if (tk.project_id && tk.created_at > (lastActivity[tk.project_id] || '')) lastActivity[tk.project_id] = tk.created_at
    }
    const stalled = projects.filter(p => (lastActivity[p.id] || p.created_at) < fourteenDaysAgo).length

    setProjectPulse({ active: projects.length, stalled, statusCounts })
  }

  async function fetchRevenueSnapshot() {
    if (!businessSpaceId || !isDirector) return
    const thisMonthStart = monthBoundaryDate(0)
    const thisMonthEnd = monthBoundaryDate(1)
    const lastMonthStart = monthBoundaryDate(-1)

    const [invoicesRes, revenueRes] = await Promise.all([
      supabase.from('invoices').select('total_amount, amount_paid, invoice_payments(amount, paid_date)').eq('business_space_id', businessSpaceId),
      supabase.from('revenue').select('amount, date, status').eq('business_space_id', businessSpaceId),
    ])

    const invoices = invoicesRes.data || []
    const outstanding = invoices.reduce((s, inv) => s + (Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)), 0)
    const allPayments = invoices.flatMap(inv => inv.invoice_payments || [])
    const receivedRevenue = (revenueRes.data || []).filter(r => r.status === 'received')

    const inRange = (dateStr, start, end) => dateStr && dateStr >= start && dateStr < end
    const sumInRange = (start, end) =>
      allPayments.filter(p => inRange(p.paid_date, start, end)).reduce((s, p) => s + Number(p.amount || 0), 0) +
      receivedRevenue.filter(r => inRange(r.date, start, end)).reduce((s, r) => s + Number(r.amount || 0), 0)

    setRevenueSnapshot({
      outstanding,
      collectedThisMonth: sumInRange(thisMonthStart, thisMonthEnd),
      collectedLastMonth: sumInRange(lastMonthStart, thisMonthStart),
    })
  }

  async function fetchGoalsProgress() {
    if (!businessSpaceId) return
    const { data } = await supabase.from('team_goals').select('progress, status').eq('business_space_id', businessSpaceId)
    const goals = data || []
    const active = goals.filter(g => g.status !== 'completed')
    const avgProgress = active.length ? Math.round(active.reduce((s, g) => s + Number(g.progress || 0), 0) / active.length) : 0
    setGoalsProgress({
      avgProgress,
      onTrack: goals.filter(g => g.status === 'on-track').length,
      atRisk: goals.filter(g => g.status === 'at-risk').length,
      completed: goals.filter(g => g.status === 'completed').length,
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
        }
      }

      setQuickAddItems(null)
      fetchProjectPulse()
      fetchRevenueSnapshot()
    } catch (err) {
      setQuickAddError(err.message || 'Something went wrong saving those.')
    } finally {
      setQuickAddSaving(false)
    }
  }

  const revenueDelta = revenueSnapshot.collectedThisMonth - revenueSnapshot.collectedLastMonth

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

      {/* ── Quick add (hero) ── */}
      <div style={{ backgroundColor: t.colors.bgCard, border: `1px solid ${t.colors.borderLight}`, borderRadius: t.radius.card, padding: '28px 32px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Icon name="magic" size="md" />
          <span style={{ fontSize: t.fontSizes.sm, fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', color: t.colors.textTertiary }}>
            Quick Add
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            ref={quickTaskRef}
            value={quickTask}
            onChange={e => setQuickTask(e.target.value)}
            onKeyDown={handleQuickAddSubmit}
            disabled={quickAddParsing}
            placeholder="Tell me what happened — I'll turn it into tasks, clients, or events…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '18px 24px', borderRadius: t.radius.full,
              border: `1px solid ${t.colors.border}`,
              backgroundColor: t.colors.bg, color: t.colors.textPrimary,
              fontSize: t.fontSizes.lg || t.fontSizes.md, fontFamily: t.fonts.sans,
              outline: 'none', opacity: quickAddParsing ? 0.6 : 1,
            }}
          />
          {quickAddParsing && (
            <span style={{ position: 'absolute', right: '24px', top: '50%', transform: 'translateY(-50%)', fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>
              Thinking…
            </span>
          )}
        </div>

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

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '16px' }}>

        {/* Project Pulse */}
        <div style={cardStyle}>
          <SectionHeader label="Project Pulse" onViewAll={() => onNavigate('projects')} viewAllColor={t.colors.primary} />
          <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
            <StatNumber value={projectPulse.active} label="Active projects" />
            <StatNumber value={projectPulse.stalled} label="Stalled 14+ days" />
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {PROJECT_STATUS_FILTERS.map(f => (
              <StatPill key={f.key} label={f.label} count={projectPulse.statusCounts[f.key]} color={f.color} bg={f.bg} />
            ))}
          </div>
          <div style={{ fontSize: t.fontSizes.sm, color: projectPulse.stalled > 0 ? t.colors.textSecondary : t.colors.textTertiary }}>
            {projectPulse.stalled > 0
              ? `${projectPulse.stalled} project${projectPulse.stalled === 1 ? '' : 's'} with no task activity in 2+ weeks`
              : "Everything's moving"}
          </div>
        </div>

        {/* Revenue Snapshot — director only */}
        {isDirector && (
          <div style={cardStyle}>
            <SectionHeader label="Revenue Snapshot" onViewAll={() => onNavigate('snapshot')} viewAllColor={t.colors.primary} />
            <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
              <StatNumber value={fmtCurrency(revenueSnapshot.collectedThisMonth)} label="Collected this month" />
              <StatNumber value={fmtCurrency(revenueSnapshot.outstanding)} label="Outstanding" />
            </div>
            <div style={{ fontSize: t.fontSizes.sm, color: revenueDelta >= 0 ? '#6B8F71' : '#B3453D' }}>
              {revenueDelta >= 0 ? '↑' : '↓'} {fmtCurrency(Math.abs(revenueDelta))} vs last month
            </div>
          </div>
        )}

        {/* Team Goals Progress */}
        <div style={cardStyle}>
          <SectionHeader label="Team Goals" onViewAll={() => onNavigate('team-goals')} viewAllColor={t.colors.primary} />
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '26px', fontWeight: '700', color: t.colors.textPrimary, fontFamily: t.fonts.heading, lineHeight: 1.1 }}>
              {goalsProgress.avgProgress}%
            </div>
            <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '2px', marginBottom: '8px' }}>average progress</div>
            <div style={{ width: '100%', height: '6px', borderRadius: t.radius.full, backgroundColor: t.colors.bg, overflow: 'hidden' }}>
              <div style={{ width: `${goalsProgress.avgProgress}%`, height: '100%', backgroundColor: t.colors.primary, borderRadius: t.radius.full }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <StatPill label="On track" count={goalsProgress.onTrack} color="#6B8F71" bg="#EAF2EA" />
            <StatPill label="At risk" count={goalsProgress.atRisk} color="#D4874E" bg="#FBF0E6" />
          </div>
        </div>

      </div>

    </div>
  )
}
