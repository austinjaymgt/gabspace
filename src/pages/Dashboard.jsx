import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import { Icon } from '../components/Icon'

// Local midnight today, for date-only (YYYY-MM-DD) comparisons
function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// Parse a date-only string as a LOCAL date (avoids UTC off-by-one)
function parseDateOnly(s) {
  return new Date(s + 'T00:00:00')
}

// Format a local Date as YYYY-MM-DD (for querying date columns)
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

// Single source of truth for project status presentation
const projectStatusConfig = {
  planning:  { label: 'Planning',  color: '#D4874E', bg: '#FBF0E6' },
  active:    { label: 'Active',    color: '#6B8F71', bg: '#EAF2EA' },
  cancelled: { label: 'Cancelled', color: '#C06B7A', bg: '#FAF0F2' },
}

// Upcoming-agenda item presentation
const upcomingConfig = {
  event: { icon: 'events',    color: '#D4874E', bg: '#FBF0E6' },
  task:  { icon: 'task-done', color: '#7C5CBF', bg: '#F0EBF9' },
}

// Platform brand colors for content calendar (preserved from ContentCalendar.jsx)
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

// --- Scaffold helpers ---------------------------------------------------------

function QuickAction({ label, onClick, primary = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '10px 16px',
        borderRadius: t.radius.md,
        border: primary ? 'none' : `1px solid ${t.colors.borderLight}`,
        backgroundColor: primary ? '#7C5CBF' : t.colors.bgCard,
        color: primary ? '#fff' : t.colors.textPrimary,
        fontSize: t.fontSizes.sm,
        fontWeight: '600',
        cursor: 'pointer',
        fontFamily: t.fonts.sans,
      }}
    >
      <Icon name="add" size="sm" />
      {label}
    </button>
  )
}

function StatTile({ label, value, valueColor }) {
  return (
    <div style={{
      backgroundColor: t.colors.bgCard,
      border: `1px solid ${t.colors.borderLight}`,
      borderRadius: t.radius.lg,
      padding: '18px 20px',
    }}>
      <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, fontWeight: '500', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: '700', color: valueColor || t.colors.textPrimary, letterSpacing: '-0.5px' }}>{value}</div>
    </div>
  )
}

// --- Attention strip flag chip ------------------------------------------------

function FlagChip({ icon, label, color, bg, onClick }) {
  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: t.fontSizes.sm,
    fontWeight: '500',
    padding: '5px 11px',
    borderRadius: t.radius.full,
    backgroundColor: bg,
    color,
    border: 'none',
    fontFamily: t.fonts.sans,
    cursor: onClick ? 'pointer' : 'default',
  }
  const inner = (
    <>
      <Icon name={icon} size="sm" />
      {label}
    </>
  )
  return onClick
    ? <button onClick={onClick} style={style}>{inner}</button>
    : <div style={style}>{inner}</div>
}

// --- Tasks hero ---------------------------------------------------------------

function TaskRow({ task, color, onComplete }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderTop: `1px solid ${t.colors.borderLight}` }}>
      <input
        type="checkbox"
        onChange={() => onComplete(task.id)}
        aria-label={`Complete ${task.title}`}
        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#7C5CBF', flexShrink: 0 }}
      />
      <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textPrimary, flex: 1, lineHeight: '1.3' }}>{task.title}</span>
      {task.projects?.title && (
        <span style={{ fontSize: t.fontSizes.xs, padding: '2px 8px', borderRadius: t.radius.md, backgroundColor: t.colors.bg, color: t.colors.textSecondary, whiteSpace: 'nowrap' }}>
          {task.projects.title}
        </span>
      )}
      <span style={{ fontSize: t.fontSizes.xs, color, fontWeight: '500', whiteSpace: 'nowrap' }}>
        {task.due_date ? dueLabel(task.due_date) : ''}
      </span>
    </div>
  )
}

function TaskGroup({ label, color, tasks, onComplete }) {
  if (!tasks.length) return null
  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', color, margin: '14px 0 2px' }}>
        {label}
      </div>
      {tasks.map(task => <TaskRow key={task.id} task={task} color={color} onComplete={onComplete} />)}
    </div>
  )
}

// --- Upcoming agenda row ------------------------------------------------------

function UpcomingRow({ item }) {
  const cfg = upcomingConfig[item.kind] || upcomingConfig.task
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderTop: `1px solid ${t.colors.borderLight}` }}>
      <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={cfg.icon} size="sm" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textPrimary, lineHeight: '1.3' }}>{item.title}</div>
        <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{item.context}</div>
      </div>
      <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary, whiteSpace: 'nowrap' }}>{item.dateLabel}</span>
    </div>
  )
}

// --- Team goal row ------------------------------------------------------------

function GoalRow({ goal }) {
  const pct = Math.max(0, Math.min(100, goal.progress || 0))
  const meta = [goal.category_label, goal.period].filter(Boolean).join(' · ')
  return (
    <div style={{ padding: '10px 0', borderTop: `1px solid ${t.colors.borderLight}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', marginBottom: '6px' }}>
        <span style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textPrimary, minWidth: 0 }}>{goal.title}</span>
        <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary, whiteSpace: 'nowrap' }}>{pct}%</span>
      </div>
      <div style={{ height: '6px', backgroundColor: t.colors.borderLight, borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: '#6B8F71', borderRadius: '3px', transition: 'width 0.3s' }} />
      </div>
      {meta && <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '4px' }}>{meta}</div>}
    </div>
  )
}

// --- Content calendar row -----------------------------------------------------

function ContentRow({ item }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderTop: `1px solid ${t.colors.borderLight}` }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: platformColors[item.platform] || '#888', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textPrimary, lineHeight: '1.3' }}>{item.title}</div>
        <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{item.platform || 'Content'}{item.status ? ` · ${item.status}` : ''}</div>
      </div>
      <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary, whiteSpace: 'nowrap' }}>
        {item.scheduled_date ? shortDate(parseDateOnly(item.scheduled_date)) : ''}
      </span>
    </div>
  )
}

// -----------------------------------------------------------------------------

export default function Dashboard({ session, onNavigate }) {
  const [stats, setStats] = useState({
    activeClients: 0,
    totalClients: 0,
    activeProjects: 0,
    projectsList: [],
  })
  const [tasks, setTasks] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [upcoming, setUpcoming] = useState([])
  const [eventsCount, setEventsCount] = useState(0)
  const [eventsThisWeek, setEventsThisWeek] = useState(0)
  const [loadingUpcoming, setLoadingUpcoming] = useState(true)
  const [goals, setGoals] = useState([])
  const [loadingGoals, setLoadingGoals] = useState(true)
  const [content, setContent] = useState([])
  const [loadingContent, setLoadingContent] = useState(true)
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    fetchStats()
    fetchTasks()
    fetchUpcoming()
    fetchGoals()
    fetchContent()
    fetchSettings()
  }, [])

  function getGreeting() {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  async function fetchSettings() {
    if (!session) return
    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
    setSettings(data)
  }

  async function fetchStats() {
    const [
      { count: activeClients },
      { count: totalClients },
      { count: activeProjects },
      { data: projectsList },
    ] = await Promise.all([
      supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('clients').select('*', { count: 'exact', head: true }),
      supabase.from('projects').select('*', { count: 'exact', head: true }).eq('type', 'project').eq('status', 'active'),
      supabase.from('projects').select('title, status, project_type, clients(name)').eq('type', 'project').in('status', ['active', 'planning']).order('created_at', { ascending: false }).limit(5),
    ])

    setStats({
      activeClients: activeClients || 0,
      totalClients: totalClients || 0,
      activeProjects: activeProjects || 0,
      projectsList: projectsList || [],
    })
  }

  async function fetchTasks() {
    setLoadingTasks(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*, projects(title)')
      .neq('status', 'done')
      .order('due_date', { ascending: true })
    if (error) {
      // If the projects(title) embed errors on a relationship ambiguity,
      // fall back to tasks without the project tag so the panel still renders.
      const { data: bare } = await supabase
        .from('tasks')
        .select('*')
        .neq('status', 'done')
        .order('due_date', { ascending: true })
      setTasks(bare || [])
    } else {
      setTasks(data || [])
    }
    setLoadingTasks(false)
  }

  async function fetchUpcoming() {
    setLoadingUpcoming(true)
    const today = startOfToday()
    const in14 = new Date(today)
    in14.setDate(in14.getDate() + 14)
    in14.setHours(23, 59, 59, 999)

    const todayStr = ymd(today)
    const in14Str = ymd(in14)

    const [{ data: events, count: evCount }, { data: dueTasks }] = await Promise.all([
      supabase
        .from('projects')
        .select('id, title, event_date, venue, clients(name)', { count: 'exact' })
        .eq('type', 'event')
        .gte('event_date', today.toISOString())
        .lte('event_date', in14.toISOString())
        .order('event_date', { ascending: true })
        .limit(10),
      supabase
        .from('tasks')
        .select('id, title, due_date, projects(title)')
        .neq('status', 'done')
        .gte('due_date', todayStr)
        .lte('due_date', in14Str)
        .order('due_date', { ascending: true })
        .limit(10),
    ])

    setEventsCount(evCount || 0)

    const wkEnd = new Date(today)
    wkEnd.setDate(wkEnd.getDate() + 7)
    wkEnd.setHours(23, 59, 59, 999)
    setEventsThisWeek((events || []).filter(e => new Date(e.event_date) <= wkEnd).length)

    const items = [
      ...(events || []).map(e => ({
        kind: 'event',
        id: `event-${e.id}`,
        title: e.title,
        context: e.clients?.name || e.venue || 'Event',
        sortTs: new Date(e.event_date).getTime(),
        dateLabel: shortDate(new Date(e.event_date)),
      })),
      ...(dueTasks || []).map(tk => ({
        kind: 'task',
        id: `task-${tk.id}`,
        title: tk.title,
        context: tk.projects?.title || 'Task',
        sortTs: parseDateOnly(tk.due_date).getTime(),
        dateLabel: shortDate(parseDateOnly(tk.due_date)),
      })),
    ]

    items.sort((a, b) => a.sortTs - b.sortTs)
    setUpcoming(items.slice(0, 6))
    setLoadingUpcoming(false)
  }

  async function fetchGoals() {
    setLoadingGoals(true)
    // Nearest due date first; nulls (no deadline) sort to the end.
    const { data } = await supabase
      .from('team_goals')
      .select('id, title, progress, period, category_label, status, due_date')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(4)
    setGoals(data || [])
    setLoadingGoals(false)
  }

  async function fetchContent() {
    setLoadingContent(true)
    const todayStr = ymd(startOfToday())
    // Upcoming scheduled content: future-dated, soonest first.
    const { data } = await supabase
      .from('content_calendar')
      .select('id, title, platform, status, scheduled_date')
      .gte('scheduled_date', todayStr)
      .order('scheduled_date', { ascending: true })
      .limit(5)
    setContent(data || [])
    setLoadingContent(false)
  }

  async function completeTask(id) {
    // Optimistic: remove from the hero immediately (it's now done)
    setTasks(prev => prev.filter(tk => tk.id !== id))
    const { error } = await supabase.from('tasks').update({ status: 'done' }).eq('id', id)
    if (error) {
      // Revert by refetching
      fetchTasks()
    } else {
      // Keep the Upcoming agenda in sync (the task may have been listed there)
      fetchUpcoming()
    }
  }

  const openTasksCount = tasks.length

  // Group open tasks into Overdue / Today / This week
  const today0 = startOfToday()
  const weekEnd = new Date(today0)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const overdueTasks = []
  const todayTasks = []
  const weekTasks = []
  for (const task of tasks) {
    if (!task.due_date) continue
    const due = parseDateOnly(task.due_date)
    if (due < today0) overdueTasks.push(task)
    else if (due.getTime() === today0.getTime()) todayTasks.push(task)
    else if (due <= weekEnd) weekTasks.push(task)
  }
  const totalUpcoming = overdueTasks.length + todayTasks.length + weekTasks.length

  // Attention-strip flags — only those with a count > 0 render
  const flags = []
  if (overdueTasks.length) flags.push({ key: 'overdue', icon: 'warning', label: `${overdueTasks.length} overdue`, color: '#cc3333', bg: '#FBEAEA', onClick: () => onNavigate('tasks') })
  if (todayTasks.length) flags.push({ key: 'today', icon: 'task-done', label: `${todayTasks.length} due today`, color: '#D4874E', bg: '#FBF0E6', onClick: () => onNavigate('tasks') })
  if (eventsThisWeek) flags.push({ key: 'events', icon: 'events', label: `${eventsThisWeek} event${eventsThisWeek > 1 ? 's' : ''} this week`, color: '#4466cc', bg: '#EEF2FC' })
  const subline = flags.length > 0 ? "Here's what needs you today." : "You're all clear — nothing urgent today. 🎉"

  return (
    <div style={{ padding: '32px', fontFamily: t.fonts.sans }}>

      {/* Welcome banner */}
      <div style={{
        backgroundColor: t.colors.bgCard,
        border: `1px solid ${t.colors.borderLight}`,
        borderRadius: t.radius.lg,
        padding: '32px 24px',
        textAlign: 'center',
        marginBottom: '24px',
      }}>
        <h2 style={{ fontFamily: t.fonts.heading, fontSize: '26px', fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 4px', letterSpacing: '-0.5px' }}>
          {getGreeting()}, {settings?.first_name || session?.user?.email?.split('@')[0]} 👋
        </h2>
        <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '0 0 20px' }}>
          {subline}
        </p>
        {flags.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '20px' }}>
            {flags.map(f => <FlagChip key={f.key} icon={f.icon} label={f.label} color={f.color} bg={f.bg} onClick={f.onClick} />)}
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <QuickAction label="New task" primary onClick={() => onNavigate('tasks')} />
          <QuickAction label="New project" onClick={() => onNavigate('projects')} />
          <QuickAction label="New client" onClick={() => onNavigate('allclients')} />
        </div>
      </div>

      {/* Stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <StatTile label="Active clients" value={stats.activeClients} />
        <StatTile label="Active projects" value={stats.activeProjects} valueColor="#4466cc" />
        <StatTile label="Open tasks" value={openTasksCount} valueColor="#7C5CBF" />
        <StatTile label="Upcoming events" value={eventsCount} valueColor="#D4874E" />
      </div>

      {/* Tasks — hero */}
      <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.borderLight}`, borderTop: '3px solid #7C5CBF', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <h3 style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes.lg, fontWeight: '700', color: t.colors.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.3px' }}>
            <Icon name="task-done" size="md" />
            Tasks
          </h3>
          <button onClick={() => onNavigate('tasks')} style={{ fontSize: t.fontSizes.xs, color: '#7C5CBF', background: 'none', border: 'none', cursor: 'pointer', fontFamily: t.fonts.sans, fontWeight: '600' }}>
            View all →
          </button>
        </div>

        {loadingTasks ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: t.colors.textTertiary, fontSize: t.fontSizes.base }}>
            Loading tasks...
          </div>
        ) : totalUpcoming === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <div style={{ fontSize: t.fontSizes.md, fontWeight: '600', color: t.colors.textPrimary, marginBottom: '4px' }}>You're all caught up 🎉</div>
            <div style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary }}>Nothing due in the next 7 days.</div>
          </div>
        ) : (
          <div>
            <TaskGroup label="Overdue" color="#cc3333" tasks={overdueTasks} onComplete={completeTask} />
            <TaskGroup label="Today" color="#D4874E" tasks={todayTasks} onComplete={completeTask} />
            <TaskGroup label="This week" color={t.colors.textTertiary} tasks={weekTasks} onComplete={completeTask} />
          </div>
        )}
      </div>

      {/* Projects + Upcoming row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>

        {/* Projects panel */}
        <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.borderLight}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes.lg, fontWeight: '700', color: t.colors.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.3px' }}>
              <Icon name="projects" size="md" />
              Projects
            </h3>
            <button onClick={() => onNavigate('projects')} style={{ fontSize: t.fontSizes.xs, color: '#4466cc', background: 'none', border: 'none', cursor: 'pointer', fontFamily: t.fonts.sans, fontWeight: '600' }}>
              View all →
            </button>
          </div>
          {stats.projectsList?.length === 0 ? (
            <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>No active projects right now</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.projectsList?.map((project, i) => {
                const cfg = projectStatusConfig[project.status] || projectStatusConfig.active
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 12px', backgroundColor: t.colors.bg, borderRadius: t.radius.md }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textPrimary }}>{project.title}</div>
                      <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
                        {project.clients?.name || 'No client'}{project.project_type ? ` · ${project.project_type}` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: t.fontSizes.xs, fontWeight: '600', padding: '3px 10px', borderRadius: t.radius.full, backgroundColor: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
                      {cfg.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Upcoming agenda */}
        <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.borderLight}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h3 style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes.lg, fontWeight: '700', color: t.colors.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.3px' }}>
              <Icon name="events" size="md" />
              Upcoming
            </h3>
            <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '500' }}>Next 14 days</span>
          </div>

          {loadingUpcoming ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: t.colors.textTertiary, fontSize: t.fontSizes.base }}>
              Loading...
            </div>
          ) : upcoming.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: t.fontSizes.base, color: t.colors.textTertiary }}>
              Nothing scheduled in the next 14 days.
            </div>
          ) : (
            <div>
              {upcoming.map(item => <UpcomingRow key={item.id} item={item} />)}
            </div>
          )}
        </div>

      </div>

      {/* Team Goals + Content row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>

        {/* Team Goals */}
        <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.borderLight}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h3 style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes.lg, fontWeight: '700', color: t.colors.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.3px' }}>
              <Icon name="team" size="md" />
              Team Goals
            </h3>
            <button onClick={() => onNavigate('goals')} style={{ fontSize: t.fontSizes.xs, color: '#6B8F71', background: 'none', border: 'none', cursor: 'pointer', fontFamily: t.fonts.sans, fontWeight: '600' }}>
              View all →
            </button>
          </div>

          {loadingGoals ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: t.colors.textTertiary, fontSize: t.fontSizes.base }}>
              Loading...
            </div>
          ) : goals.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: t.fontSizes.base, color: t.colors.textTertiary }}>
              No goals set yet.
            </div>
          ) : (
            <div>
              {goals.map(goal => <GoalRow key={goal.id} goal={goal} />)}
            </div>
          )}
        </div>

        {/* Content calendar preview */}
        <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.borderLight}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h3 style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes.lg, fontWeight: '700', color: t.colors.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.3px' }}>
              <Icon name="campaigns" size="md" />
              Content
            </h3>
            <button onClick={() => onNavigate('content-calendar')} style={{ fontSize: t.fontSizes.xs, color: '#8B5CF6', background: 'none', border: 'none', cursor: 'pointer', fontFamily: t.fonts.sans, fontWeight: '600' }}>
              View all →
            </button>
          </div>

          {loadingContent ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: t.colors.textTertiary, fontSize: t.fontSizes.base }}>
              Loading...
            </div>
          ) : content.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: t.fontSizes.base, color: t.colors.textTertiary }}>
              Nothing scheduled coming up.
            </div>
          ) : (
            <div>
              {content.map(item => <ContentRow key={item.id} item={item} />)}
            </div>
          )}
        </div>

      </div>

    </div>
  )
}