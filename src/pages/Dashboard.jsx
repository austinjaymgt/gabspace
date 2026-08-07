import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t, taskStatusConfig } from '../theme'
import { Icon } from '../components/Icon'
import { fetchPortalActivity } from '../utils/portalActivity'

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function parseDateOnly(s) {
  return new Date(s + 'T00:00:00')
}

function dueLabel(dueString) {
  const due = parseDateOnly(dueString)
  const diffDays = Math.round((due - startOfToday()) / 86400000)
  if (diffDays < 0) return `${Math.abs(diffDays)}d late`
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  return due.toLocaleDateString('en-US', { weekday: 'short' })
}

const PROJECT_STATUS_FILTERS = [
  { key: 'planning', label: 'Planning', color: '#534AB7', bg: '#EEEDF9' },
  { key: 'active',   label: 'In Progress', color: '#6B8F71', bg: '#EAF2EA' },
  { key: 'on-hold',  label: 'Paused', color: '#D4874E', bg: '#FBF0E6' },
]

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

function TaskRow({ task, dueLabelColor, onComplete, onOpenTask }) {
  const color = dueLabelColor || t.colors.textTertiary
  const sc = taskStatusConfig[task.status] || taskStatusConfig['todo']
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderTop: `1px solid ${t.colors.borderLight}`, cursor: onOpenTask ? 'pointer' : 'default' }}
      onClick={onOpenTask ? () => onOpenTask(task) : undefined}
    >
      <input
        type="checkbox"
        onClick={e => e.stopPropagation()}
        onChange={() => onComplete(task.id)}
        aria-label={`Complete ${task.title}`}
        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: t.colors.primary, flexShrink: 0 }}
      />
      <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textPrimary, flex: 1, lineHeight: '1.3' }}>{task.title}</span>
      <span style={{ fontSize: t.fontSizes.xs, fontWeight: '600', padding: '2px 8px', borderRadius: t.radius.full, backgroundColor: sc.bg, color: sc.color, whiteSpace: 'nowrap' }}>
        {sc.label}
      </span>
      {task.due_date && (
        <span style={{ fontSize: t.fontSizes.xs, color, fontWeight: '500', whiteSpace: 'nowrap' }}>
          {dueLabel(task.due_date)}
        </span>
      )}
    </div>
  )
}

function TaskGroup({ label, color, tasks, onComplete, onOpenTask }) {
  if (!tasks.length) return null
  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.07em', textTransform: 'uppercase', color, margin: '14px 0 2px' }}>
        {label}
      </div>
      {tasks.map(task => <TaskRow key={task.id} task={task} dueLabelColor={color} onComplete={onComplete} onOpenTask={onOpenTask} />)}
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

// ── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard({ session, businessSpaceId, onNavigate, portalActivityVersion, onOpenTask }) {
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

  // Portal activity
  const [portalUnread, setPortalUnread] = useState(0)

  function getGreeting() {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  function getTodayLabel() {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  async function fetchPortalUnread() {
    const { total } = await fetchPortalActivity(businessSpaceId)
    setPortalUnread(total)
  }

  async function fetchSettings() {
    if (!session) return
    const { data } = await supabase.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle()
    const { data: business } = businessSpaceId
      ? await supabase.from('business_spaces').select('name, logo_url').eq('id', businessSpaceId).single()
      : { data: null }
    setSettings({ ...data, business_name: business?.name || '', logo_url: business?.logo_url || '' })
  }

  async function fetchProjectCounts() {
    if (!businessSpaceId) return
    const { data } = await supabase
      .from('projects')
      .select('status')
      .eq('business_space_id', businessSpaceId)
      .eq('type', 'project')
      .in('status', ['planning', 'active', 'on-hold'])
    if (!data) return
    const counts = { planning: 0, active: 0, 'on-hold': 0 }
    for (const p of data) if (counts[p.status] !== undefined) counts[p.status]++
    setProjectCounts(counts)
  }

  async function fetchAllProjects() {
    if (!businessSpaceId) return
    const { data } = await supabase
      .from('projects')
      .select('id, title, status, clients(name)')
      .eq('business_space_id', businessSpaceId)
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
      .eq('business_space_id', businessSpaceId)
      .neq('status', 'done')
      .order('due_date', { ascending: true, nullsFirst: false })
    if (error) {
      const { data: bare } = await supabase.from('tasks').select('*').eq('business_space_id', businessSpaceId).neq('status', 'done').order('due_date', { ascending: true, nullsFirst: false })
      setTasks(bare || [])
    } else {
      setTasks(data || [])
    }
    setLoadingTasks(false)
  }

  async function fetchSparkIdeas() {
    if (!businessSpaceId) return
    const { data } = await supabase
      .from('projects')
      .select('id, title')
      .eq('business_space_id', businessSpaceId)
      .eq('type', 'event')
      .eq('event_status', 'concept')
      .order('created_at', { ascending: false })
      .limit(5)
    setSparkIdeas(data || [])
  }

  useEffect(() => {
    queueMicrotask(() => {
      fetchSettings()
      fetchProjectCounts()
      fetchAllProjects()
      fetchTasks()
      fetchSparkIdeas()
    })
  }, [businessSpaceId])

  useEffect(() => {
    if (!businessSpaceId) return
    queueMicrotask(() => fetchPortalUnread())
  }, [businessSpaceId, portalActivityVersion])

  async function saveSparkIdea() {
    if (!sparkIdea.trim() || !businessSpaceId) return
    setSavingIdea(true)
    await supabase.from('projects').insert({
      business_space_id: businessSpaceId,
      user_id: session.user.id,
      title: sparkIdea.trim(),
      type: 'event',
      event_status: 'concept',
    })
    setSparkIdea('')
    fetchSparkIdeas()
    setSavingIdea(false)
  }

  function handleOpenTask(task) {
    onOpenTask?.(task.business_space_id || businessSpaceId)
  }

  async function completeTask(id) {
    setTasks(prev => prev.filter(tk => tk.id !== id))
    const { error } = await supabase.from('tasks').update({ status: 'done' }).eq('id', id)
    if (error) fetchTasks()
  }

  async function handleQuickTask(e) {
    if (e.key !== 'Enter' || !quickTask.trim() || !businessSpaceId) return
    const title = quickTask.trim()
    setQuickTask('')
    await supabase.from('tasks').insert({ title, business_space_id: businessSpaceId, status: 'todo' })
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
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }}>
          <div>
            <textarea
              value={sparkIdea}
              onChange={e => setSparkIdea(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveSparkIdea() } }}
              placeholder="Drop an idea before it disappears…"
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px', borderRadius: t.radius.full,
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
                padding: '8px 16px', borderRadius: t.radius.full,
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
            padding: '14px 20px', borderRadius: t.radius.full,
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
              <TaskGroup label="Overdue" color="var(--color-danger)" tasks={overdueTasks} onComplete={completeTask} onOpenTask={handleOpenTask} />
              <TaskGroup label="Today" color="#D4874E" tasks={todayTasks} onComplete={completeTask} onOpenTask={handleOpenTask} />
              <TaskGroup label="This week" color={t.colors.textTertiary} tasks={weekTasks} onComplete={completeTask} onOpenTask={handleOpenTask} />
              {tasks.filter(tk => !tk.due_date).slice(0, 5).map(task => (
                <TaskRow key={task.id} task={task} onComplete={completeTask} onOpenTask={handleOpenTask} />
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

        {/* Portal Activity */}
        <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '20px 24px', border: `1px solid ${t.colors.borderLight}` }}>
          <SectionHeader label="Portal Activity" onViewAll={() => onNavigate('client-portal-manager')} viewAllColor={t.colors.primary} />
          {portalUnread === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: t.fontSizes.base, color: t.colors.textTertiary }}>No new activity</div>
          ) : (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: t.colors.primary, fontFamily: t.fonts.heading }}>{portalUnread}</div>
              <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary, marginTop: '4px' }}>
                unread update{portalUnread === 1 ? '' : 's'} from clients
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  )
}
