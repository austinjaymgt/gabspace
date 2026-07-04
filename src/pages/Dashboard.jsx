import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t, taskStatusConfig } from '../theme'
import { Icon } from '../components/Icon'
import { quarterFromDate } from '../utils/dates'

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function pct(a, b) {
  if (!b) return 0
  return Math.min(Math.round((a / b) * 100), 100)
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function parseDateOnly(s) {
  return new Date(s + 'T00:00:00')
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dueLabel(dueString) {
  const due = parseDateOnly(dueString)
  const diffDays = Math.round((due - startOfToday()) / 86400000)
  if (diffDays < 0) return `${Math.abs(diffDays)}d late`
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  return due.toLocaleDateString('en-US', { weekday: 'short' })
}

function shortDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const PROJECT_STATUS_FILTERS = [
  { key: 'planning', label: 'Planning', color: '#534AB7', bg: '#EEEDF9' },
  { key: 'active',   label: 'In Progress', color: '#6B8F71', bg: '#EAF2EA' },
  { key: 'on-hold',  label: 'Paused', color: '#D4874E', bg: '#FBF0E6' },
]

const categoryStyles = {
  team:      { bg: '#F0EBF9', color: '#7C5CBF' },
  business:  { bg: '#EAF2EA', color: '#6B8F71' },
  personal:  { bg: '#FBF0E6', color: '#D4874E' },
  financial: { bg: '#EAF4F9', color: '#5B9BBF' },
  marketing: { bg: '#FAF0F2', color: '#C06B7A' },
  other:     { bg: '#F3F3F3', color: '#6B7280' },
}

function goalTypeLabel(goal) {
  if (goal.category === 'other') return goal.category_label || 'Other'
  const labels = { team: 'Team', business: 'Business', personal: 'Personal', financial: 'Financial', marketing: 'Marketing' }
  return labels[goal.category] || 'Team'
}

const contentStatusColors = {
  draft:     { color: '#D4874E', bg: '#FBF0E6' },
  scheduled: { color: '#7C5CBF', bg: '#F0EBF9' },
  published: { color: '#6B8F71', bg: '#EAF2EA' },
}

const platformColors = {
  Instagram: '#E1306C',
  TikTok: '#000000',
  Facebook: '#1877F2',
  LinkedIn: '#0A66C2',
  Email: '#FF6B35',
  YouTube: '#FF0000',
  'Google Ads': '#4285F4',
  Other: '#888',
}

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

// ── Task row ────────────────────────────────────────────────────────────────

function TaskRow({ task, dueLabelColor, onComplete }) {
  const color = dueLabelColor || t.colors.textTertiary
  const sc = taskStatusConfig[task.status] || taskStatusConfig['todo']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderTop: `1px solid ${t.colors.borderLight}` }}>
      <input
        type="checkbox"
        onChange={() => onComplete(task.id)}
        aria-label={`Complete ${task.title}`}
        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: t.colors.primary, flexShrink: 0 }}
      />
      <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textPrimary, flex: 1, lineHeight: '1.3' }}>{task.title}</span>
      <span style={{ fontSize: t.fontSizes.xs, fontWeight: '600', padding: '2px 8px', borderRadius: t.radius.full, backgroundColor: sc.bg, color: sc.color, whiteSpace: 'nowrap' }}>
        {sc.label}
      </span>
      {task.projects?.title && (
        <span style={{ fontSize: t.fontSizes.xs, padding: '2px 8px', borderRadius: t.radius.md, backgroundColor: t.colors.bg, color: t.colors.textSecondary, whiteSpace: 'nowrap' }}>
          {task.projects.title}
        </span>
      )}
      {task.due_date && (
        <span style={{ fontSize: t.fontSizes.xs, color, fontWeight: '500', whiteSpace: 'nowrap' }}>
          {dueLabel(task.due_date)}
        </span>
      )}
    </div>
  )
}

function TaskGroup({ label, color, tasks, onComplete }) {
  if (!tasks.length) return null
  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.07em', textTransform: 'uppercase', color, margin: '14px 0 2px' }}>
        {label}
      </div>
      {tasks.map(task => <TaskRow key={task.id} task={task} dueLabelColor={color} onComplete={onComplete} />)}
    </div>
  )
}

// ── Goal row ────────────────────────────────────────────────────────────────

function GoalRow({ goal }) {
  const pct = Math.max(0, Math.min(100, goal.progress || 0))
  const cs = categoryStyles[goal.category] || categoryStyles.team
  const typeLabel = goalTypeLabel(goal)
  const dueDateStr = goal.due_date
    ? parseDateOnly(goal.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null
  return (
    <div style={{ padding: '10px 0', borderTop: `1px solid ${t.colors.borderLight}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '6px' }}>
        <span style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textPrimary, minWidth: 0, flex: 1 }}>{goal.title}</span>
        <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary, whiteSpace: 'nowrap', fontWeight: '600' }}>{pct}%</span>
      </div>
      <div style={{ height: '6px', backgroundColor: t.colors.borderLight, borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: '#6B8F71', borderRadius: '3px', transition: 'width 0.3s' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: t.fontSizes.xs, fontWeight: '600', padding: '2px 8px', borderRadius: t.radius.full, backgroundColor: cs.bg, color: cs.color }}>
          {typeLabel}
        </span>
        {dueDateStr && (
          <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>Due {dueDateStr}</span>
        )}
      </div>
    </div>
  )
}

// ── Content row ─────────────────────────────────────────────────────────────

function ContentRow({ item }) {
  const sc = contentStatusColors[(item.status || '').toLowerCase()] || contentStatusColors.draft
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderTop: `1px solid ${t.colors.borderLight}` }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: platformColors[item.platform] || '#888', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textPrimary, lineHeight: '1.3' }}>{item.title}</div>
        <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{item.platform || 'Content'}</div>
      </div>
      <span style={{ fontSize: t.fontSizes.xs, fontWeight: '600', padding: '3px 10px', borderRadius: t.radius.full, backgroundColor: sc.bg, color: sc.color, whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
        {item.status || 'Draft'}
      </span>
    </div>
  )
}

// ── Spark Pad idea row ───────────────────────────────────────────────────────

function SparkIdeaRow({ idea }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0', borderTop: `1px solid ${t.colors.borderLight}` }}>
      <span style={{ color: '#D4874E', flexShrink: 0, marginTop: '1px', lineHeight: 1 }}>
        <Icon name="idea" size="sm" />
      </span>
      <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textPrimary, lineHeight: '1.4' }}>{idea.title}</span>
    </div>
  )
}

// ── Budget quarter summary ───────────────────────────────────────────────────

function BudgetQuarterWidget({ summary, onNavigate }) {
  if (!summary) return null
  const { quarter, hasBudget, target, actual, planned, received, pending } = summary
  const spentPct = pct(actual, target)
  const net = received - actual
  return (
    <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '20px 24px', border: `1px solid ${t.colors.borderLight}` }}>
      <SectionHeader label={`Budget · ${quarter}`} onViewAll={() => onNavigate('department-budget')} viewAllColor={t.colors.primary} />

      {hasBudget ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>Expenses</span>
            <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{spentPct}%</span>
          </div>
          <div style={{ height: '6px', background: t.colors.border, borderRadius: t.radius.full, overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ height: '100%', width: `${spentPct}%`, background: spentPct > 90 ? t.colors.danger : t.colors.primary, borderRadius: t.radius.full }} />
          </div>
          <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary, marginBottom: '2px' }}>{fmtMoney(actual)} of {fmtMoney(target)}</div>
          <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>Planned: {fmtMoney(planned)}</div>
        </>
      ) : (
        <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary, marginBottom: '10px' }}>
          {fmtMoney(actual)} in expenses logged this quarter.{' '}
          <button onClick={() => onNavigate('department-budget')} style={{ background: 'none', border: 'none', color: t.colors.primary, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans, fontSize: t.fontSizes.sm, padding: 0 }}>
            Set a budget →
          </button>
        </div>
      )}

      <div style={{ borderTop: `1px solid ${t.colors.borderLight}`, marginTop: '14px', paddingTop: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>Income</span>
          <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textPrimary, whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtMoney(received)}</span>
        </div>
        {pending > 0 && (
          <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginBottom: '8px' }}>{fmtMoney(pending)} pending</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '8px' }}>
          <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Net</span>
          <span style={{ fontSize: t.fontSizes.sm, fontWeight: '700', color: net < 0 ? t.colors.danger : t.colors.textPrimary, whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtMoney(net)}</span>
        </div>
      </div>
    </div>
  )
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard({ session, workspaceId, userRole, onNavigate }) {
  const isDirector = ['owner', 'admin'].includes(userRole)

  const [settings, setSettings] = useState(null)
  const [projectCounts, setProjectCounts] = useState({ planning: 0, active: 0, 'on-hold': 0 })

  // Spark Pad
  const [sparkIdea, setSparkIdea] = useState('')
  const [sparkIdeas, setSparkIdeas] = useState([])
  const [savingIdea, setSavingIdea] = useState(false)

  // Quick-add task
  const [quickTask, setQuickTask] = useState('')
  const quickTaskRef = useRef(null)

  // Tasks
  const [tasks, setTasks] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(true)

  // Projects by status
  const [allProjects, setAllProjects] = useState([])
  const [projectFilter, setProjectFilter] = useState('active')

  // Goals
  const [goals, setGoals] = useState([])
  const [loadingGoals, setLoadingGoals] = useState(true)

  // Content
  const [content, setContent] = useState([])
  const [loadingContent, setLoadingContent] = useState(true)

  // Budget (directors only)
  const [budgetSummary, setBudgetSummary] = useState(null)

  useEffect(() => {
    fetchSettings()
    fetchProjectCounts()
    fetchAllProjects()
    fetchTasks()
    fetchSparkIdeas()
    fetchGoals()
    if (isDirector) fetchBudgetSummary()
    else fetchContent()
  }, [workspaceId, isDirector])

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
    setSettings(data)
  }

  async function fetchProjectCounts() {
    if (!workspaceId) return
    const { data } = await supabase
      .from('projects')
      .select('status')
      .eq('workspace_id', workspaceId)
      .eq('type', 'project')
      .in('status', ['planning', 'active', 'on-hold'])
    if (!data) return
    const counts = { planning: 0, active: 0, 'on-hold': 0 }
    for (const p of data) if (counts[p.status] !== undefined) counts[p.status]++
    setProjectCounts(counts)
  }

  async function fetchAllProjects() {
    if (!workspaceId) return
    const { data } = await supabase
      .from('projects')
      .select('id, title, status, clients(name)')
      .eq('workspace_id', workspaceId)
      .eq('type', 'project')
      .in('status', ['planning', 'active', 'on-hold'])
      .order('created_at', { ascending: false })
    setAllProjects(data || [])
  }

  async function fetchTasks() {
    setLoadingTasks(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*, projects(title)')
      .eq('workspace_id', workspaceId)
      .neq('status', 'done')
      .order('due_date', { ascending: true, nullsFirst: false })
    if (error) {
      const { data: bare } = await supabase.from('tasks').select('*').eq('workspace_id', workspaceId).neq('status', 'done').order('due_date', { ascending: true, nullsFirst: false })
      setTasks(bare || [])
    } else {
      setTasks(data || [])
    }
    setLoadingTasks(false)
  }

  async function fetchSparkIdeas() {
    if (!workspaceId) return
    const { data } = await supabase
      .from('projects')
      .select('id, title')
      .eq('workspace_id', workspaceId)
      .eq('type', 'event')
      .eq('event_status', 'concept')
      .order('created_at', { ascending: false })
      .limit(5)
    setSparkIdeas(data || [])
  }

  async function saveSparkIdea() {
    if (!sparkIdea.trim() || !workspaceId) return
    setSavingIdea(true)
    await supabase.from('projects').insert({
      workspace_id: workspaceId,
      user_id: session.user.id,
      title: sparkIdea.trim(),
      type: 'event',
      event_status: 'concept',
    })
    setSparkIdea('')
    fetchSparkIdeas()
    setSavingIdea(false)
  }

  async function fetchGoals() {
    setLoadingGoals(true)
    const { data } = await supabase
      .from('team_goals')
      .select('id, title, progress, category, category_label, status, due_date')
      .eq('workspace_id', workspaceId)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(4)
    setGoals(data || [])
    setLoadingGoals(false)
  }

  async function fetchContent() {
    setLoadingContent(true)
    const { data } = await supabase
      .from('content_calendar')
      .select('id, title, platform, status, scheduled_date')
      .order('status', { ascending: true })
      .order('scheduled_date', { ascending: true, nullsFirst: false })
      .limit(5)
    setContent(data || [])
    setLoadingContent(false)
  }

  async function fetchBudgetSummary() {
    if (!workspaceId) return
    const now = new Date()
    const year = now.getFullYear()
    const quarter = quarterFromDate(ymd(now))
    const [budgetRes, expenseRes, lineRes, revenueRes] = await Promise.all([
      supabase.from('department_budget').select('*').eq('workspace_id', workspaceId).eq('year', year).maybeSingle(),
      supabase.from('expenses').select('amount, date').eq('workspace_id', workspaceId),
      supabase.from('budget_line_items').select('projected_amount, quarter').eq('workspace_id', workspaceId),
      supabase.from('revenue').select('amount, status, date').eq('workspace_id', workspaceId),
    ])
    const inQuarter = dateStr => {
      if (!dateStr) return false
      const d = parseDateOnly(dateStr)
      return d.getFullYear() === year && `Q${Math.floor(d.getMonth() / 3) + 1}` === quarter
    }
    const actual = (expenseRes.data || []).filter(e => inQuarter(e.date)).reduce((s, e) => s + Number(e.amount || 0), 0)
    const planned = (lineRes.data || []).filter(i => i.quarter === quarter).reduce((s, i) => s + Number(i.projected_amount || 0), 0)
    const quarterRevenue = (revenueRes.data || []).filter(r => inQuarter(r.date))
    const received = quarterRevenue.filter(r => r.status === 'received').reduce((s, r) => s + Number(r.amount || 0), 0)
    const pending = quarterRevenue.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.amount || 0), 0)
    const target = Number(budgetRes.data?.[`${quarter.toLowerCase()}_target`] || 0)
    setBudgetSummary({ quarter: `${quarter} ${year}`, hasBudget: !!budgetRes.data, target, actual, planned, received, pending })
  }

  async function completeTask(id) {
    setTasks(prev => prev.filter(tk => tk.id !== id))
    const { error } = await supabase.from('tasks').update({ status: 'done' }).eq('id', id)
    if (error) fetchTasks()
  }

  async function handleQuickTask(e) {
    if (e.key !== 'Enter' || !quickTask.trim() || !workspaceId) return
    const title = quickTask.trim()
    setQuickTask('')
    await supabase.from('tasks').insert({ title, workspace_id: workspaceId, status: 'todo' })
    fetchTasks()
  }

  // Task grouping
  const today0 = startOfToday()
  const weekEnd = new Date(today0)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const overdueTasks = [], todayTasks = [], weekTasks = []
  for (const task of tasks) {
    if (!task.due_date) continue
    const due = parseDateOnly(task.due_date)
    if (due < today0) overdueTasks.push(task)
    else if (due.getTime() === today0.getTime()) todayTasks.push(task)
    else if (due <= weekEnd) weekTasks.push(task)
  }
  const totalUpcoming = overdueTasks.length + todayTasks.length + weekTasks.length

  const filteredProjects = allProjects.filter(p => p.status === projectFilter)

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

      {/* ── Spark Pad ── */}
      <div style={{ backgroundColor: t.colors.bgCard, border: `1px solid ${t.colors.borderLight}`, borderRadius: t.radius.lg, padding: '20px 24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#D4874E' }}>Spark Pad</span>
          <button onClick={() => onNavigate('spark')} style={{ fontSize: t.fontSizes.xs, color: '#D4874E', background: 'none', border: 'none', cursor: 'pointer', fontFamily: t.fonts.sans, fontWeight: '600' }}>
            View all →
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <textarea
              value={sparkIdea}
              onChange={e => setSparkIdea(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveSparkIdea() } }}
              placeholder="Drop an idea before it disappears…"
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px', borderRadius: t.radius.md,
                border: `1px solid ${t.colors.border}`,
                backgroundColor: t.colors.bg, color: t.colors.textPrimary,
                fontSize: t.fontSizes.base, fontFamily: t.fonts.sans,
                resize: 'none', outline: 'none', lineHeight: '1.5',
              }}
            />
            <button
              onClick={saveSparkIdea}
              disabled={savingIdea || !sparkIdea.trim()}
              style={{
                marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: t.radius.md,
                border: `1px solid ${t.colors.borderLight}`,
                backgroundColor: t.colors.bg, color: t.colors.textPrimary,
                fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer',
                fontFamily: t.fonts.sans, opacity: savingIdea || !sparkIdea.trim() ? 0.5 : 1,
              }}
            >
              <Icon name="sparkles" size="sm" />
              Save idea
            </button>
          </div>
          <div>
            {sparkIdeas.length === 0 ? (
              <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, paddingTop: '8px' }}>No ideas saved yet — jot one down before it slips away.</div>
            ) : (
              sparkIdeas.map(idea => <SparkIdeaRow key={idea.id} idea={idea} />)
            )}
          </div>
        </div>
      </div>

      {/* ── Quick-add task bar ── */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '8px' }}>
          Quick Add Task +
        </div>
        <input
          ref={quickTaskRef}
          value={quickTask}
          onChange={e => setQuickTask(e.target.value)}
          onKeyDown={handleQuickTask}
          placeholder="Name a task and hit Enter — it'll show up below…"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '14px 20px', borderRadius: t.radius.lg,
            border: `1px solid ${t.colors.border}`,
            backgroundColor: t.colors.bgCard, color: t.colors.textPrimary,
            fontSize: t.fontSizes.md, fontFamily: t.fonts.sans,
            outline: 'none',
          }}
        />
      </div>

      {/* ── Tasks | Projects by Status ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>

        {/* Tasks */}
        <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '20px 24px', border: `1px solid ${t.colors.borderLight}` }}>
          <SectionHeader label="Tasks" onViewAll={() => onNavigate('tasks')} viewAllColor={t.colors.primary} />
          {loadingTasks ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: t.colors.textTertiary, fontSize: t.fontSizes.base }}>Loading tasks…</div>
          ) : totalUpcoming === 0 && tasks.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: t.fontSizes.base, color: t.colors.textTertiary }}>You're all caught up 🎉</div>
          ) : (
            <div>
              <TaskGroup label="Overdue" color="#cc3333" tasks={overdueTasks} onComplete={completeTask} />
              <TaskGroup label="Today" color="#D4874E" tasks={todayTasks} onComplete={completeTask} />
              <TaskGroup label="This week" color={t.colors.textTertiary} tasks={weekTasks} onComplete={completeTask} />
              {tasks.filter(tk => !tk.due_date).slice(0, 5).map(task => (
                <TaskRow key={task.id} task={task} onComplete={completeTask} />
              ))}
            </div>
          )}
        </div>

        {/* Projects by Status */}
        <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '20px 24px', border: `1px solid ${t.colors.borderLight}` }}>
          <SectionHeader label="Projects by Status" onViewAll={() => onNavigate('projects')} viewAllColor={t.colors.primary} />
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {PROJECT_STATUS_FILTERS.map(f => {
              const isActive = projectFilter === f.key
              return (
                <button
                  key={f.key}
                  onClick={() => setProjectFilter(f.key)}
                  style={{
                    padding: '5px 12px', borderRadius: t.radius.full, border: 'none', cursor: 'pointer',
                    fontFamily: t.fonts.sans, fontSize: t.fontSizes.xs, fontWeight: '600',
                    backgroundColor: isActive ? f.color : t.colors.bg,
                    color: isActive ? '#fff' : t.colors.textSecondary,
                    transition: 'all 0.15s',
                  }}
                >
                  {f.label} ({projectCounts[f.key]})
                </button>
              )
            })}
          </div>
          {filteredProjects.length === 0 ? (
            <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>No projects in this status.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredProjects.map(project => {
                const fc = PROJECT_STATUS_FILTERS.find(f => f.key === project.status) || PROJECT_STATUS_FILTERS[0]
                return (
                  <div key={project.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 12px', backgroundColor: t.colors.bg, borderRadius: t.radius.md }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textPrimary }}>{project.title}</div>
                      <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{project.clients?.name || 'No client'}</div>
                    </div>
                    <span style={{ fontSize: t.fontSizes.xs, fontWeight: '600', padding: '3px 10px', borderRadius: t.radius.full, backgroundColor: fc.bg, color: fc.color, whiteSpace: 'nowrap' }}>
                      {fc.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* ── Goals | Budget or Content by Status ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>

        {/* Goals */}
        <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '20px 24px', border: `1px solid ${t.colors.borderLight}` }}>
          <SectionHeader label="Goals" onViewAll={() => onNavigate('team-goals')} viewAllColor="#6B8F71" />
          {loadingGoals ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: t.colors.textTertiary, fontSize: t.fontSizes.base }}>Loading…</div>
          ) : goals.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: t.fontSizes.base, color: t.colors.textTertiary }}>No goals set yet — add one to give the week some direction.</div>
          ) : (
            goals.map(goal => <GoalRow key={goal.id} goal={goal} />)
          )}
        </div>

        {/* Budget (directors) or Content by Status (everyone else) */}
        {isDirector ? (
          <BudgetQuarterWidget summary={budgetSummary} onNavigate={onNavigate} />
        ) : (
          <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '20px 24px', border: `1px solid ${t.colors.borderLight}` }}>
            <SectionHeader label="Content by Status" onViewAll={() => onNavigate('campaign-tracking')} viewAllColor={t.colors.primary} />
            {loadingContent ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: t.colors.textTertiary, fontSize: t.fontSizes.base }}>Loading…</div>
            ) : content.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', fontSize: t.fontSizes.base, color: t.colors.textTertiary }}>Nothing scheduled coming up.</div>
            ) : (
              content.map(item => <ContentRow key={item.id} item={item} />)
            )}
          </div>
        )}

      </div>

    </div>
  )
}
