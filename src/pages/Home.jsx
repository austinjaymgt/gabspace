import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { getModules } from '../utils/businessModules'

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

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function riseAnim(delay, duration = 0.5) {
  return `home-enter-rise ${duration}s cubic-bezier(0.16,1,0.3,1) ${delay}s backwards`
}

// ── Urgent feed ──────────────────────────────────────────────────────────

function FeedTaskRow({ task, dueLabelColor, onComplete }) {
  return (
    <div style={s.taskRow}>
      <input
        type="checkbox"
        onChange={() => onComplete(task.id)}
        aria-label={`Complete ${task.title}`}
        style={s.checkbox}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={s.taskTitle}>{task.title}</div>
        <div style={s.taskBusiness}>{task.business_name}</div>
      </div>
      {task.due_date && (
        <span style={{ ...s.taskDue, color: dueLabelColor }}>{dueLabel(task.due_date)}</span>
      )}
    </div>
  )
}

function FeedGroup({ label, color, tasks, onComplete }) {
  if (!tasks.length) return null
  return (
    <div>
      <div style={{ ...s.taskGroupLabel, color }}>{label}</div>
      {tasks.map(task => <FeedTaskRow key={task.id} task={task} dueLabelColor={color} onComplete={onComplete} />)}
    </div>
  )
}

// ── Home ─────────────────────────────────────────────────────────────────
// The landing moment right after sign-in — a distinct full-screen beat,
// not another page in the app shell. Chrome (sidebar/topbar) is skipped
// entirely by App.jsx while this is the current page.

export default function Home({ session, businessSpaceId, onSwitchBusinessSpace, onNavigate }) {
  const [firstName, setFirstName] = useState('')
  const [businesses, setBusinesses] = useState([])
  const [tasks, setTasks] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [quickTask, setQuickTask] = useState('')
  const [quickTaskBusinessId, setQuickTaskBusinessId] = useState('')
  const [switchingId, setSwitchingId] = useState(null)

  useEffect(() => {
    if (!session?.user?.id) return
    supabase.from('user_settings').select('first_name').eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => setFirstName(data?.first_name || session.user.email?.split('@')[0] || ''))
  }, [session])

  useEffect(() => {
    fetchBusinesses()
  }, [session])

  useEffect(() => {
    if (businesses.length === 0) { setTasks([]); setLoadingTasks(false); return }
    fetchFeed()
  }, [businesses])

  function fetchBusinesses() {
    if (!session?.user?.id) return
    supabase
      .from('business_space_members')
      .select('business_space_id, business_spaces(id, name, logo_url, archived_at)')
      .eq('user_id', session.user.id)
      .then(({ data }) => {
        const rows = (data || [])
          .filter(r => r.business_spaces && !r.business_spaces.archived_at)
          .map(r => ({ id: r.business_spaces.id, name: r.business_spaces.name, logo_url: r.business_spaces.logo_url }))
        setBusinesses(rows)
      })
  }

  function fetchFeed() {
    setLoadingTasks(true)
    const businessIds = businesses.map(b => b.id)
    const nameById = Object.fromEntries(businesses.map(b => [b.id, b.name]))
    // tasks.business_space_id has no FK to business_spaces, so PostgREST
    // can't embed it — resolve the business name client-side instead.
    supabase
      .from('tasks')
      .select('id, title, status, due_date, business_space_id')
      .in('business_space_id', businessIds)
      .neq('status', 'done')
      .order('due_date', { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        setTasks((data || []).map(tk => ({ ...tk, business_name: nameById[tk.business_space_id] })))
        setLoadingTasks(false)
      })
  }

  async function completeTask(id) {
    setTasks(prev => prev.filter(tk => tk.id !== id))
    const { error } = await supabase.from('tasks').update({ status: 'done' }).eq('id', id)
    if (error) fetchFeed()
  }

  // Only businesses with Client Management turned on are eligible for
  // quick-add — no override, no unassigned fallback.
  const clientManagedBusinesses = businesses.filter(b => getModules(b.id).clientManagement)

  useEffect(() => {
    if (clientManagedBusinesses.length === 0) { setQuickTaskBusinessId(''); return }
    if (!clientManagedBusinesses.some(b => b.id === quickTaskBusinessId)) {
      setQuickTaskBusinessId(businessSpaceId && clientManagedBusinesses.some(b => b.id === businessSpaceId) ? businessSpaceId : clientManagedBusinesses[0].id)
    }
  }, [businesses])

  async function handleQuickTask(e) {
    if (e.key !== 'Enter' || !quickTask.trim() || !quickTaskBusinessId) return
    const title = quickTask.trim()
    setQuickTask('')
    await supabase.from('tasks').insert({ title, business_space_id: quickTaskBusinessId, status: 'todo' })
    fetchFeed()
  }

  async function handleChipClick(id) {
    if (switchingId) return
    setSwitchingId(id)
    const { error } = await onSwitchBusinessSpace?.(id) || {}
    setSwitchingId(null)
    if (!error) onNavigate?.('dashboard')
  }

  function handleEnterWorkspace() {
    onNavigate?.('dashboard')
  }

  // Same overdue/today/this-week qualification the per-business dashboard
  // uses, merged across every business the user belongs to.
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
  const totalUrgent = overdueTasks.length + todayTasks.length + weekTasks.length

  const statusLine = loadingTasks
    ? 'Loading your day…'
    : totalUrgent === 0
      ? "You're all caught up"
      : `${totalUrgent} urgent item${totalUrgent === 1 ? '' : 's'} across your businesses`

  return (
    <div style={s.screen} onClick={handleEnterWorkspace}>
      <style>{`
        @keyframes home-enter-rise {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes home-orb-enter {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes home-orb-drift {
          0%   { border-radius: 42% 58% 65% 35% / 45% 40% 60% 55%; }
          25%  { border-radius: 58% 42% 40% 60% / 60% 55% 45% 40%; }
          50%  { border-radius: 50% 50% 35% 65% / 40% 60% 40% 60%; }
          75%  { border-radius: 40% 60% 55% 45% / 55% 45% 60% 40%; }
          100% { border-radius: 42% 58% 65% 35% / 45% 40% 60% 55%; }
        }
        @keyframes home-halo-pulse {
          0%, 100% { opacity: 0.45; transform: translate(-50%, -50%) scale(1); }
          50%      { opacity: 0.85; transform: translate(-50%, -50%) scale(1.08); }
        }
      `}</style>

      <div style={s.glowTop} />
      <div style={s.glowBottom} />

      <div style={s.center}>
        <div style={s.orbWrap}>
          <div style={s.orbHalo} />
          <div style={s.orb} />
        </div>

        <div style={{ ...s.greeting, animation: riseAnim(0.3) }}>
          {getGreeting()}, {firstName}
        </div>
        <div style={{ ...s.status, animation: riseAnim(0.5) }}>
          {statusLine}
        </div>

        {clientManagedBusinesses.length > 0 && (
          <div style={{ ...s.quickAddRow, animation: riseAnim(0.65) }} onClick={e => e.stopPropagation()}>
            <select
              value={quickTaskBusinessId}
              onChange={e => setQuickTaskBusinessId(e.target.value)}
              style={s.picker}
            >
              {clientManagedBusinesses.map(b => (
                <option key={b.id} value={b.id} style={{ color: '#111' }}>{b.name}</option>
              ))}
            </select>
            <input
              value={quickTask}
              onChange={e => setQuickTask(e.target.value)}
              onKeyDown={handleQuickTask}
              placeholder="Name a task and hit Enter…"
              style={s.input}
            />
          </div>
        )}

        {!loadingTasks && totalUrgent > 0 && (
          <div style={{ ...s.feedPanel, animation: riseAnim(0.8) }} onClick={e => e.stopPropagation()}>
            <FeedGroup label="Overdue" color="rgba(224,57,155,1)" tasks={overdueTasks} onComplete={completeTask} />
            <FeedGroup label="Today" color="rgba(224,57,155,0.65)" tasks={todayTasks} onComplete={completeTask} />
            <FeedGroup label="This week" color="rgba(244,238,248,0.5)" tasks={weekTasks} onComplete={completeTask} />
          </div>
        )}

        {businesses.length > 0 && (
          <div style={s.chipsRow} onClick={e => e.stopPropagation()}>
            {businesses.map((business, i) => (
              <div
                key={business.id}
                onClick={() => handleChipClick(business.id)}
                style={{
                  ...s.chip,
                  ...(business.id === businessSpaceId ? s.chipActive : {}),
                  animation: riseAnim(0.95 + i * 0.1),
                }}
              >
                {business.name}
              </div>
            ))}
          </div>
        )}

        <div style={{ ...s.hint, animation: riseAnim(1.3) }}>
          click anywhere to enter
        </div>
      </div>
    </div>
  )
}

const s = {
  screen: {
    position: 'relative',
    minHeight: '100vh',
    width: '100%',
    zIndex: 500,
    backgroundColor: '#07060a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'safe center',
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '60px 24px',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  glowTop: {
    position: 'fixed',
    top: '-15%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '900px',
    height: '900px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(107,26,122,0.5) 0%, rgba(107,26,122,0) 70%)',
    pointerEvents: 'none',
  },
  glowBottom: {
    position: 'fixed',
    bottom: '-20%',
    left: '62%',
    transform: 'translateX(-50%)',
    width: '900px',
    height: '900px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(214,60,201,0.32) 0%, rgba(214,60,201,0) 70%)',
    pointerEvents: 'none',
  },
  center: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '18px',
    maxWidth: '520px',
    width: '100%',
    boxSizing: 'border-box',
  },
  orbWrap: {
    position: 'relative',
    width: '150px',
    height: '150px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '8px',
  },
  orbHalo: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '260px',
    height: '260px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(183,111,224,0.55) 0%, rgba(107,26,122,0.25) 55%, rgba(107,26,122,0) 75%)',
    filter: 'blur(28px)',
    animation: 'home-halo-pulse 3.4s ease-in-out infinite',
  },
  orb: {
    position: 'relative',
    width: '150px',
    height: '150px',
    background: 'linear-gradient(135deg, #6B1A7A 0%, #6EFFFFEB 55%, #b76fe0 100%)',
    boxShadow: '0 0 60px rgba(190,111,224,0.55), 0 0 120px rgba(107,26,122,0.35)',
    animation: 'home-orb-enter 0.8s cubic-bezier(0.16,1,0.3,1) backwards, home-orb-drift 7s ease-in-out infinite',
  },
  greeting: {
    fontFamily: '"Montserrat", sans-serif',
    fontWeight: 400,
    fontSize: '46px',
    letterSpacing: '0.02em',
    color: 'rgba(244,238,248,0.94)',
    textAlign: 'center',
    lineHeight: 1.15,
    margin: 0,
  },
  status: {
    fontFamily: '"Inter", sans-serif',
    fontSize: '13px',
    fontWeight: 500,
    color: 'rgba(214,60,201,0.75)',
    textAlign: 'center',
    letterSpacing: '0.02em',
    margin: 0,
  },
  quickAddRow: {
    display: 'flex',
    gap: '10px',
    width: '100%',
    marginTop: '18px',
    cursor: 'default',
  },
  picker: {
    flexShrink: 0,
    maxWidth: '150px',
    padding: '12px 16px',
    borderRadius: '9999px',
    border: '1px solid rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: 'rgba(244,238,248,0.85)',
    fontFamily: '"Inter", sans-serif',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
  },
  input: {
    flex: 1,
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '12px 20px',
    borderRadius: '9999px',
    border: '1px solid rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(6px)',
    color: 'rgba(244,238,248,0.94)',
    fontFamily: '"Inter", sans-serif',
    fontSize: '14px',
    outline: 'none',
  },
  feedPanel: {
    width: '100%',
    boxSizing: 'border-box',
    marginTop: '6px',
    padding: '18px 22px',
    borderRadius: '24px',
    border: '1px solid rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(6px)',
    cursor: 'default',
    maxHeight: '260px',
    overflowY: 'auto',
  },
  taskGroupLabel: {
    fontFamily: '"Inter", sans-serif',
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    margin: '10px 0 2px',
  },
  taskRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 0',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  checkbox: {
    width: '15px',
    height: '15px',
    cursor: 'pointer',
    accentColor: 'rgba(214,60,201,0.85)',
    flexShrink: 0,
  },
  taskTitle: {
    fontFamily: '"Inter", sans-serif',
    fontSize: '13px',
    color: 'rgba(244,238,248,0.9)',
    lineHeight: 1.3,
  },
  taskBusiness: {
    fontFamily: '"Inter", sans-serif',
    fontSize: '11px',
    color: 'rgba(244,238,248,0.4)',
    marginTop: '2px',
  },
  taskDue: {
    fontFamily: '"Inter", sans-serif',
    fontSize: '11px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  chipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '6px',
    cursor: 'default',
  },
  chip: {
    padding: '8px 18px',
    borderRadius: '9999px',
    border: '1px solid rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: 'rgba(244,238,248,0.75)',
    fontFamily: '"Inter", sans-serif',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  chipActive: {
    borderColor: 'rgba(214,60,201,0.55)',
    color: 'rgba(244,238,248,0.96)',
    backgroundColor: 'rgba(214,60,201,0.14)',
  },
  hint: {
    marginTop: '22px',
    fontFamily: '"Inter", sans-serif',
    fontSize: '11px',
    fontWeight: 400,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(244,238,248,0.35)',
  },
}
