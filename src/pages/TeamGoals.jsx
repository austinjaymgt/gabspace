import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

const STATUS_OPTIONS = ['on-track', 'at-risk', 'completed', 'not-started']
const PERIOD_OPTIONS = ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026']
const CATEGORY_OPTIONS = ['team', 'business', 'personal', 'financial', 'marketing', 'other']
const SORT_OPTIONS = [
  { value: 'created', label: 'Date created' },
  { value: 'due', label: 'Due date' },
  { value: 'progress', label: 'Progress' },
]

const statusStyles = {
  'on-track':    { bg: '#F0FBE0', color: '#3B6D11', label: 'On Track' },
  'at-risk':     { bg: '#FEF9EC', color: '#92610A', label: 'At Risk' },
  'completed':   { bg: '#F0E8FB', color: '#5E1F99', label: 'Completed' },
  'not-started': { bg: '#F3F3F3', color: '#6B7280', label: 'Not Started' },
}

// Fixed type buckets — labels from the brand palette. 'other' carries a free-text label per goal.
const categoryStyles = {
  team:      { bg: '#F0EBF9', color: '#7C5CBF', label: 'Team' },
  business:  { bg: '#EAF2EA', color: '#6B8F71', label: 'Business' },
  personal:  { bg: '#FBF0E6', color: '#D4874E', label: 'Personal' },
  financial: { bg: '#EAF4F9', color: '#5B9BBF', label: 'Financial' },
  marketing: { bg: '#FAF0F2', color: '#C06B7A', label: 'Marketing' },
  other:     { bg: '#F3F3F3', color: '#6B7280', label: 'Other' },
}

// Progress = % of subtasks completed (rounded). Goals with no subtasks fall back to manual progress.
function rollup(subtasks) {
  if (!subtasks || !subtasks.length) return 0
  return Math.round((subtasks.filter(s => s.completed).length / subtasks.length) * 100)
}
function goalProgress(goal) {
  return (goal.subtasks && goal.subtasks.length) ? rollup(goal.subtasks) : (goal.progress || 0)
}

function typeLabelOf(goal) {
  return goal.category === 'other' ? (goal.category_label || 'Other') : (categoryStyles[goal.category] || categoryStyles.team).label
}

function fmtDate(d, withYear = true) {
  if (!d) return null
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', withYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' })
}

function periodFromDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `Q${q} ${d.getFullYear()}`
}

// Smart due-date chip: overdue / today / soon get a colored tint; otherwise a plain date.
function dueChip(goal) {
  if (!goal.due_date) return null
  const due = new Date(goal.due_date + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((due - today) / 86400000)
  const fmt = fmtDate(goal.due_date, false)
  const done = goal.status === 'completed' || goalProgress(goal) === 100
  if (done)       return { text: `Due ${fmt}`,        bg: 'transparent', color: t.colors.textTertiary }
  if (diff < 0)   return { text: `Overdue · ${fmt}`,  bg: '#FAF0F2',     color: '#C06B7A' }
  if (diff === 0) return { text: 'Due today',         bg: '#FBF0E6',     color: '#D4874E' }
  if (diff <= 3)  return { text: `Due in ${diff}d`,   bg: '#FBF0E6',     color: '#D4874E' }
  return { text: `Due ${fmt}`, bg: 'transparent', color: t.colors.textSecondary }
}

const sorters = {
  created: (a, b) => new Date(a.created_at) - new Date(b.created_at),
  progress: (a, b) => goalProgress(b) - goalProgress(a),
  due: (a, b) => {
    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date) - new Date(b.due_date)
  },
}

function CheckBox({ checked, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={checked ? 'Mark incomplete' : 'Mark complete'}
      style={{
        width: 18, height: 18, borderRadius: 5, flexShrink: 0, padding: 0,
        cursor: disabled ? 'default' : 'pointer',
        border: checked ? 'none' : `1.5px solid ${t.colors.border}`,
        background: checked ? t.colors.accent : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {checked && (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

const pillBase = {
  fontSize: t.fontSizes.xs, fontWeight: '500', borderRadius: t.radius.full,
  padding: '3px 10px', lineHeight: 1.4, whiteSpace: 'nowrap',
}

function StatusPill({ status }) {
  const s = statusStyles[status] || statusStyles['not-started']
  return <span style={{ ...pillBase, letterSpacing: '0.06em', textTransform: 'uppercase', background: s.bg, color: s.color }}>{s.label}</span>
}

function ViewRow({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: t.fontSizes.base, color: t.colors.textPrimary }}>{children}</div>
    </div>
  )
}

export default function TeamGoals({ businessSpaceId, userRole }) {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [activePeriod, setActivePeriod] = useState('Q2 2026')
  const [activeCategory, setActiveCategory] = useState('all')
  const [sortBy, setSortBy] = useState('created')
  const [statusMenuId, setStatusMenuId] = useState(null) // which card's status menu is open

  const [openGoalId, setOpenGoalId] = useState(null)  // which goal's detail is expanded inline
  const [showNewForm, setShowNewForm] = useState(false) // inline new-goal form
  const [editing, setEditing] = useState(false)        // view vs edit mode for expanded goal
  const [newSubtaskText, setNewSubtaskText] = useState('')
  const [formError, setFormError] = useState('')
  const [draft, setDraft] = useState({
    title: '', description: '', owner: '', status: 'not-started',
    category: 'team', categoryLabel: '', progress: 0, startDate: '', dueDate: '',
  })

  const isOwnerOrAdmin = ['owner', 'admin'].includes(userRole)
  const ro = !isOwnerOrAdmin

  useEffect(() => {
    if (businessSpaceId) fetchGoals()
  }, [businessSpaceId, activePeriod])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') { setOpenGoalId(null); setShowNewForm(false) } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  async function fetchGoals() {
    setLoading(true)
    const { data } = await supabase
      .from('team_goals')
      .select('*, goal_subtasks(*)')
      .eq('business_space_id', businessSpaceId)
      .eq('period', activePeriod)
      .order('created_at', { ascending: true })
    const normalized = (data || []).map(g => ({
      ...g,
      subtasks: (g.goal_subtasks || []).slice().sort((a, b) => a.sort_order - b.sort_order),
    }))
    setGoals(normalized)
    setLoading(false)
  }

  const activeGoal = openGoalId ? goals.find(g => g.id === openGoalId) : null
  const activeSubs = activeGoal?.subtasks || []
  const manualMode = activeSubs.length === 0
  const drawerProgress = activeGoal ? goalProgress(activeGoal) : draft.progress

  function draftFromGoal(goal) {
    return {
      title: goal.title, description: goal.description || '', owner: goal.owner || '',
      status: goal.status, category: goal.category || 'team',
      categoryLabel: goal.category_label || '', progress: goal.progress || 0,
      startDate: goal.start_date || '', dueDate: goal.due_date || '',
    }
  }

  function openNew() {
    setDraft({ title: '', description: '', owner: '', status: 'not-started', category: 'team', categoryLabel: '', progress: 0, startDate: '', dueDate: '' })
    setOpenGoalId(null)
    setNewSubtaskText('')
    setFormError('')
    setShowNewForm(true)
  }

  function openGoal(goal) {
    if (openGoalId === goal.id) { setOpenGoalId(null); return }
    setDraft(draftFromGoal(goal))
    setOpenGoalId(goal.id)
    setNewSubtaskText('')
    setFormError('')
    setEditing(false)
    setShowNewForm(false)
  }

  function startEditMode() {
    if (activeGoal) setDraft(draftFromGoal(activeGoal))
    setFormError('')
    setEditing(true)
  }

  function cancelEdit() {
    if (!openGoalId) { setShowNewForm(false); return }
    setDraft(draftFromGoal(activeGoal))
    setFormError('')
    setEditing(false)
  }

  async function handleSave() {
    if (!draft.title.trim()) { setFormError('Give the goal a title.'); return }
    if (draft.category === 'other' && !draft.categoryLabel.trim()) { setFormError('Name the type for an "Other" goal.'); return }
    if (draft.startDate && draft.dueDate && draft.dueDate < draft.startDate) { setFormError("Due date can't be before the start date."); return }

    const payload = {
      title: draft.title.trim(),
      description: draft.description,
      owner: draft.owner,
      period: periodFromDate(draft.dueDate) || activePeriod,
      status: draft.status,
      category: draft.category,
      category_label: draft.category === 'other' ? draft.categoryLabel.trim() : null,
      start_date: draft.startDate || null,
      due_date: draft.dueDate || null,
    }
    if (manualMode) payload.progress = draft.progress

    setFormError('')
    if (openGoalId) {
      await supabase.from('team_goals').update(payload).eq('id', openGoalId)
      setGoals(prev => prev.map(g => g.id === openGoalId ? { ...g, ...payload } : g))
      setEditing(false)
    } else {
      const { data, error } = await supabase
        .from('team_goals')
        .insert({ ...payload, business_space_id: businessSpaceId })
        .select('*, goal_subtasks(*)')
        .single()
      if (error || !data) { setFormError('Could not save — try again.'); return }
      setGoals(prev => [...prev, { ...data, subtasks: [] }])
      setShowNewForm(false)
      setOpenGoalId(data.id) // open the new goal's detail immediately
    }
  }

  async function handleDelete() {
    if (!openGoalId) return
    await supabase.from('team_goals').delete().eq('id', openGoalId)
    setGoals(prev => prev.filter(g => g.id !== openGoalId))
    setOpenGoalId(null)
  }

  async function setGoalStatus(goalId, status) {
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, status } : g))
    if (openGoalId === goalId) setDraft(d => ({ ...d, status }))
    await supabase.from('team_goals').update({ status }).eq('id', goalId)
  }

  async function toggleSubtask(goalId, subtaskId) {
    const goal = goals.find(g => g.id === goalId)
    const sub = goal?.subtasks.find(s => s.id === subtaskId)
    if (!sub) return
    const completed = !sub.completed
    const nextSubs = goal.subtasks.map(s => s.id === subtaskId ? { ...s, completed } : s)
    const derived = rollup(nextSubs)
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, subtasks: nextSubs, progress: derived } : g))
    await supabase.from('goal_subtasks').update({ completed }).eq('id', subtaskId)
    await supabase.from('team_goals').update({ progress: derived }).eq('id', goalId)
  }

  async function addSubtask() {
    const text = newSubtaskText.trim()
    if (!text || !openGoalId) return
    const goal = goals.find(g => g.id === openGoalId)
    const sortOrder = goal.subtasks.length
    const { data, error } = await supabase
      .from('goal_subtasks')
      .insert({ goal_id: openGoalId, business_space_id: businessSpaceId, title: text, sort_order: sortOrder })
      .select()
      .single()
    if (error || !data) return
    const nextSubs = [...goal.subtasks, data]
    const derived = rollup(nextSubs)
    setGoals(prev => prev.map(g => g.id === openGoalId ? { ...g, subtasks: nextSubs, progress: derived } : g))
    setNewSubtaskText('')
    await supabase.from('team_goals').update({ progress: derived }).eq('id', openGoalId)
  }

  async function deleteSubtask(subtaskId) {
    const goal = goals.find(g => g.id === openGoalId)
    const nextSubs = goal.subtasks.filter(s => s.id !== subtaskId)
    setGoals(prev => prev.map(g => g.id === openGoalId
      ? { ...g, subtasks: nextSubs, progress: nextSubs.length ? rollup(nextSubs) : g.progress }
      : g))
    await supabase.from('goal_subtasks').delete().eq('id', subtaskId)
    if (nextSubs.length) await supabase.from('team_goals').update({ progress: rollup(nextSubs) }).eq('id', openGoalId)
  }

  const visibleGoals = (activeCategory === 'all' ? goals : goals.filter(g => g.category === activeCategory))
    .slice().sort(sorters[sortBy])

  const onTrack = visibleGoals.filter(g => g.status === 'on-track').length
  const completed = visibleGoals.filter(g => g.status === 'completed').length
  const avgProgress = visibleGoals.length
    ? Math.round(visibleGoals.reduce((sum, g) => sum + goalProgress(g), 0) / visibleGoals.length)
    : 0

  const selectStyle = {
    padding: '8px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`,
    fontSize: t.fontSizes.base, color: t.colors.textPrimary, background: t.colors.bgCard,
    fontFamily: t.fonts.sans, cursor: 'pointer',
  }
  const fieldStyle = {
    width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`,
    fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box',
    color: t.colors.textPrimary, background: t.colors.bgCard,
  }
  const labelStyle = { fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }

  function renderSubtasks() {
    return (
      <div style={{ marginTop: '20px' }}>
        <div style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary, marginBottom: '10px' }}>
          Subtasks{activeSubs.length > 0 ? ` · ${activeSubs.filter(x => x.completed).length}/${activeSubs.length}` : ''}
        </div>
        {!openGoalId ? (
          <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>Save this goal first to add subtasks.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeSubs.map(sub => (
              <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckBox checked={sub.completed} disabled={ro} onClick={() => toggleSubtask(openGoalId, sub.id)} />
                <span style={{ flex: 1, fontSize: t.fontSizes.sm, color: sub.completed ? t.colors.textTertiary : t.colors.textPrimary, textDecoration: sub.completed ? 'line-through' : 'none' }}>{sub.title}</span>
                {editing && !ro && (
                  <button onClick={() => deleteSubtask(sub.id)} aria-label="Delete subtask" style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.colors.textTertiary, display: 'flex', alignItems: 'center', padding: '2px' }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </button>
                )}
              </div>
            ))}
            {activeSubs.length === 0 && !editing && (
              <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>No subtasks yet — break this down into smaller steps.</div>
            )}
            {editing && !ro && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                <input
                  value={newSubtaskText}
                  onChange={e => setNewSubtaskText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addSubtask() }}
                  placeholder="Add a subtask..."
                  style={{ ...fieldStyle, padding: '7px 10px', fontSize: t.fontSizes.sm }}
                />
                <button onClick={addSubtask} style={{ padding: '7px 14px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#FFFFFF', fontSize: t.fontSizes.sm, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer', flexShrink: 0 }}>Add</button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 40px', fontFamily: t.fonts.sans, maxWidth: '900px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: t.fontSizes.xs, fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.primary, marginBottom: '6px' }}>
            Operations
          </div>
          <h1 style={{ fontFamily: t.fonts.heading, fontSize: '28px', fontWeight: '800', color: t.colors.textPrimary, letterSpacing: '-0.02em', margin: 0 }}>
            Goals
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={selectStyle}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
          </select>
          <select value={activePeriod} onChange={e => setActivePeriod(e.target.value)} style={selectStyle}>
            {PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {isOwnerOrAdmin && (
            <button onClick={openNew} style={{ padding: '9px 18px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#FFFFFF', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>
              + Add Goal
            </button>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '28px' }}>
        {[
          { label: 'Total Goals', value: visibleGoals.length },
          { label: 'On Track', value: onTrack },
          { label: 'Completed', value: completed },
          { label: 'Avg Progress', value: `${avgProgress}%` },
        ].map(stat => (
          <div key={stat.label} style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '16px 20px' }}>
            <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{stat.label}</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: t.colors.textPrimary, fontFamily: t.fonts.heading }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Type filter pills */}
      <div style={{ display: 'flex', gap: '4px', background: t.colors.bg, borderRadius: t.radius.md, padding: '4px', marginBottom: '20px', flexWrap: 'wrap', width: 'fit-content' }}>
        {['all', ...CATEGORY_OPTIONS].map(c => {
          const active = activeCategory === c
          const style = c !== 'all' ? categoryStyles[c] : null
          return (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              style={{
                padding: '5px 14px', borderRadius: t.radius.sm, border: 'none', fontFamily: t.fonts.sans,
                fontSize: t.fontSizes.xs, cursor: 'pointer', fontWeight: active ? '600' : '400',
                background: active ? (style ? style.bg : t.colors.bgCard) : 'transparent',
                color: active ? (style ? style.color : t.colors.textPrimary) : t.colors.textSecondary,
                boxShadow: active ? t.shadows.sm : 'none',
              }}
            >
              {c === 'all' ? 'All Types' : categoryStyles[c].label}
            </button>
          )
        })}
      </div>

      {/* Inline new-goal form */}
      {showNewForm && (
        <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 20px' }}>New Goal</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '14px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Goal Title *</label>
              <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="e.g. Book 12 new clients this quarter" style={fieldStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Description</label>
              <textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="What does success look like?" rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
            </div>
            <div>
              <label style={labelStyle}>Owner</label>
              <input value={draft.owner} onChange={e => setDraft(d => ({ ...d, owner: e.target.value }))} placeholder="Who owns this?" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} style={fieldStyle}>
                {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{categoryStyles[c].label}</option>)}
              </select>
            </div>
            {draft.category === 'other' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Type label *</label>
                <input value={draft.categoryLabel} onChange={e => setDraft(d => ({ ...d, categoryLabel: e.target.value }))} placeholder="Name this type (e.g. Community, Health)" style={fieldStyle} />
              </div>
            )}
            <div>
              <label style={labelStyle}>Status</label>
              <select value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))} style={fieldStyle}>
                {STATUS_OPTIONS.map(st => <option key={st} value={st}>{statusStyles[st].label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Start date</label>
              <input type="date" value={draft.startDate} onChange={e => setDraft(d => ({ ...d, startDate: e.target.value }))} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Due date</label>
              <input type="date" value={draft.dueDate} onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))} style={fieldStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Progress — {draft.progress}%</label>
              <input type="range" min="0" max="100" step="5" value={draft.progress} onChange={e => setDraft(d => ({ ...d, progress: Number(e.target.value) }))} style={{ width: '100%' }} />
            </div>
          </div>
          {formError && <div style={{ fontSize: t.fontSizes.sm, color: t.colors.danger, marginTop: '10px' }}>{formError}</div>}
          <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
            <button onClick={handleSave} style={{ padding: '9px 20px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#FFFFFF', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>Add Goal</button>
            <button onClick={() => setShowNewForm(false)} style={{ padding: '9px 18px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Goals list */}
      {loading ? (
        <div style={{ color: t.colors.textTertiary, fontSize: t.fontSizes.base, padding: '40px 0', textAlign: 'center' }}>Loading goals...</div>
      ) : visibleGoals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}` }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎯</div>
          <div style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, marginBottom: '6px' }}>
            No goals yet for {activePeriod}{activeCategory !== 'all' ? ` · ${categoryStyles[activeCategory].label}` : ''}
          </div>
          <div style={{ fontSize: t.fontSizes.base, color: t.colors.textSecondary }}>
            {isOwnerOrAdmin ? 'Add your first goal to start rallying the team.' : 'No goals set for this period yet — check back soon.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {visibleGoals.map(goal => {
            const c = categoryStyles[goal.category] || categoryStyles.team
            const subs = goal.subtasks || []
            const progress = goalProgress(goal)
            const chip = dueChip(goal)
            const isDetailOpen = openGoalId === goal.id
            const menuOpen = statusMenuId === goal.id

            return (
              <div key={goal.id} style={{ background: t.colors.bgCard, border: `1px solid ${isDetailOpen ? t.colors.primary : t.colors.border}`, borderRadius: t.radius.lg, overflow: 'hidden', transition: 'border-color 0.15s' }}>
                {/* Summary row */}
                <div style={{ padding: '18px 22px' }}>
                  <div
                    onClick={() => { openGoal(goal); setEditing(false) }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '10px', cursor: 'pointer' }}
                    role="button"
                  >
                    <span style={{ fontSize: t.fontSizes.md, fontWeight: '600', color: t.colors.textPrimary }}>{goal.title}</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: t.colors.textTertiary, transform: isDetailOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>

                  {/* Badges row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {isOwnerOrAdmin ? (
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={e => { e.stopPropagation(); setStatusMenuId(menuOpen ? null : goal.id) }}
                          style={{ ...pillBase, letterSpacing: '0.06em', textTransform: 'uppercase', background: statusStyles[goal.status].bg, color: statusStyles[goal.status].color, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: t.fonts.sans }}
                        >
                          {statusStyles[goal.status].label}
                          <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                        {menuOpen && (
                          <>
                            <div onClick={e => { e.stopPropagation(); setStatusMenuId(null) }} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
                            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 51, background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.md, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', padding: '4px', minWidth: '150px' }}>
                              {STATUS_OPTIONS.map(st => (
                                <button
                                  key={st}
                                  onClick={e => { e.stopPropagation(); setGoalStatus(goal.id, st); setStatusMenuId(null) }}
                                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', background: goal.status === st ? t.colors.bgSubtle || '#F7F5F0' : 'none', border: 'none', borderRadius: t.radius.sm, padding: '7px 10px', cursor: 'pointer', fontFamily: t.fonts.sans, fontSize: t.fontSizes.sm, color: t.colors.textPrimary }}
                                >
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusStyles[st].color, flexShrink: 0 }} />
                                  {statusStyles[st].label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <StatusPill status={goal.status} />
                    )}
                    <span style={{ ...pillBase, letterSpacing: '0.04em', background: c.bg, color: c.color }}>{typeLabelOf(goal)}</span>
                    {chip && <span style={{ ...pillBase, background: chip.bg, color: chip.color }}>{chip.text}</span>}
                  </div>

                  {/* Progress bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, height: '6px', background: t.colors.border, borderRadius: t.radius.full, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? t.colors.accent : t.colors.primary, borderRadius: t.radius.full, transition: 'width 0.3s ease' }} />
                    </div>
                    <span style={{ fontSize: t.fontSizes.xs, fontWeight: '600', color: t.colors.textPrimary, minWidth: '34px', textAlign: 'right' }}>{progress}%</span>
                  </div>
                </div>

                {/* Inline detail panel */}
                {isDetailOpen && (
                  <div style={{ borderTop: `1px solid ${t.colors.border}`, padding: '24px', background: t.colors.bg }}>
                    {!editing ? (
                      /* VIEW MODE */
                      <>
                        {activeGoal?.description && (
                          <p style={{ fontSize: t.fontSizes.base, color: t.colors.textSecondary, lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: '0 0 20px' }}>{activeGoal.description}</p>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px', marginBottom: '4px' }}>
                          <ViewRow label="Owner">{activeGoal?.owner || '—'}</ViewRow>
                          <ViewRow label="Start date">{fmtDate(activeGoal?.start_date) || '—'}</ViewRow>
                          <ViewRow label="Due date">{fmtDate(activeGoal?.due_date) || '—'}</ViewRow>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Progress — {drawerProgress}%</div>
                            <div style={{ height: '6px', background: t.colors.border, borderRadius: t.radius.full, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${drawerProgress}%`, background: drawerProgress === 100 ? t.colors.accent : t.colors.primary, borderRadius: t.radius.full, transition: 'width 0.3s ease' }} />
                            </div>
                          </div>
                        </div>
                        {renderSubtasks()}
                        {!ro && (
                          <button onClick={startEditMode} style={{ marginTop: '20px', padding: '8px 18px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#FFFFFF', fontSize: t.fontSizes.sm, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>
                            Edit
                          </button>
                        )}
                      </>
                    ) : (
                      /* EDIT MODE */
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '14px' }}>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={labelStyle}>Goal Title *</label>
                            <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="e.g. Book 12 new clients this quarter" style={fieldStyle} />
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={labelStyle}>Description</label>
                            <textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="What does success look like?" rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
                          </div>
                          <div>
                            <label style={labelStyle}>Owner</label>
                            <input value={draft.owner} onChange={e => setDraft(d => ({ ...d, owner: e.target.value }))} placeholder="Who owns this?" style={fieldStyle} />
                          </div>
                          <div>
                            <label style={labelStyle}>Type</label>
                            <select value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} style={fieldStyle}>
                              {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{categoryStyles[c].label}</option>)}
                            </select>
                          </div>
                          {draft.category === 'other' && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={labelStyle}>Type label *</label>
                              <input value={draft.categoryLabel} onChange={e => setDraft(d => ({ ...d, categoryLabel: e.target.value }))} placeholder="Name this type (e.g. Community, Health)" style={fieldStyle} />
                            </div>
                          )}
                          <div>
                            <label style={labelStyle}>Status</label>
                            <select value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))} style={fieldStyle}>
                              {STATUS_OPTIONS.map(st => <option key={st} value={st}>{statusStyles[st].label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={labelStyle}>Start date</label>
                            <input type="date" value={draft.startDate} onChange={e => setDraft(d => ({ ...d, startDate: e.target.value }))} style={fieldStyle} />
                          </div>
                          <div>
                            <label style={labelStyle}>Due date</label>
                            <input type="date" value={draft.dueDate} onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))} style={fieldStyle} />
                          </div>
                          {manualMode ? (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={labelStyle}>Progress — {draft.progress}%</label>
                              <input type="range" min="0" max="100" step="5" value={draft.progress} onChange={e => setDraft(d => ({ ...d, progress: Number(e.target.value) }))} style={{ width: '100%' }} />
                            </div>
                          ) : (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={labelStyle}>Progress — {drawerProgress}%</label>
                              <div style={{ height: '6px', background: t.colors.border, borderRadius: t.radius.full, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${drawerProgress}%`, background: drawerProgress === 100 ? t.colors.accent : t.colors.primary, borderRadius: t.radius.full, transition: 'width 0.3s ease' }} />
                              </div>
                              <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '5px' }}>Calculated from subtasks below.</div>
                            </div>
                          )}
                        </div>
                        {renderSubtasks()}
                        {formError && <div style={{ fontSize: t.fontSizes.sm, color: t.colors.danger, marginTop: '10px' }}>{formError}</div>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '18px' }}>
                          <button onClick={handleSave} style={{ padding: '9px 20px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#FFFFFF', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>Save changes</button>
                          <button onClick={cancelEdit} style={{ padding: '9px 18px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, cursor: 'pointer' }}>Cancel</button>
                          <button onClick={handleDelete} style={{ marginLeft: 'auto', padding: '9px 16px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.danger, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, cursor: 'pointer' }}>Delete</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}