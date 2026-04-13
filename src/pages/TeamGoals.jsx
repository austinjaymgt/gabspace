import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

const STATUS_OPTIONS = ['on-track', 'at-risk', 'completed', 'not-started']
const PERIOD_OPTIONS = ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026']

const statusStyles = {
  'on-track':    { bg: '#F0FBE0', color: '#3B6D11', label: 'On Track' },
  'at-risk':     { bg: '#FEF9EC', color: '#92610A', label: 'At Risk' },
  'completed':   { bg: '#F0E8FB', color: '#5E1F99', label: 'Completed' },
  'not-started': { bg: '#F3F3F3', color: '#6B7280', label: 'Not Started' },
}

export default function TeamGoals({ workspaceId, userRole }) {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [activePeriod, setActivePeriod] = useState('Q2 2026')
  const [editingGoal, setEditingGoal] = useState(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    owner: '',
    period: 'Q2 2026',
    status: 'not-started',
    progress: 0,
  })

  const isOwnerOrAdmin = ['owner', 'admin'].includes(userRole)

  useEffect(() => {
    if (workspaceId) fetchGoals()
  }, [workspaceId, activePeriod])

  async function fetchGoals() {
    setLoading(true)
    const { data } = await supabase
      .from('team_goals')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('period', activePeriod)
      .order('created_at', { ascending: true })
    setGoals(data || [])
    setLoading(false)
  }

  function resetForm() {
    setForm({ title: '', description: '', owner: '', period: activePeriod, status: 'not-started', progress: 0 })
    setEditingGoal(null)
    setShowForm(false)
  }

  async function handleSubmit() {
    if (!form.title.trim()) return
    if (editingGoal) {
      await supabase.from('team_goals').update(form).eq('id', editingGoal.id)
    } else {
      await supabase.from('team_goals').insert({ ...form, workspace_id: workspaceId })
    }
    resetForm()
    fetchGoals()
  }

  async function handleDelete(id) {
    await supabase.from('team_goals').delete().eq('id', id)
    fetchGoals()
  }

  async function updateProgress(id, progress) {
    await supabase.from('team_goals').update({ progress }).eq('id', id)
    setGoals(prev => prev.map(g => g.id === id ? { ...g, progress } : g))
  }

  async function updateStatus(id, status) {
    await supabase.from('team_goals').update({ status }).eq('id', id)
    setGoals(prev => prev.map(g => g.id === id ? { ...g, status } : g))
  }

  function startEdit(goal) {
    setForm({
      title: goal.title,
      description: goal.description || '',
      owner: goal.owner || '',
      period: goal.period,
      status: goal.status,
      progress: goal.progress || 0,
    })
    setEditingGoal(goal)
    setShowForm(true)
  }

  const onTrack = goals.filter(g => g.status === 'on-track').length
  const completed = goals.filter(g => g.status === 'completed').length
  const atRisk = goals.filter(g => g.status === 'at-risk').length
  const avgProgress = goals.length
    ? Math.round(goals.reduce((sum, g) => sum + (g.progress || 0), 0) / goals.length)
    : 0

  return (
    <div style={{ padding: '32px 40px', fontFamily: t.fonts.sans, maxWidth: '900px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: t.fontSizes.xs, fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.primary, marginBottom: '6px' }}>
            Operations
          </div>
          <h1 style={{ fontFamily: t.fonts.heading, fontSize: '28px', fontWeight: '800', color: t.colors.textPrimary, letterSpacing: '-0.02em', margin: 0 }}>
            Team Goals
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Period selector */}
          <select
            value={activePeriod}
            onChange={e => setActivePeriod(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: t.radius.md,
              border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base,
              color: t.colors.textPrimary, background: t.colors.bgCard,
              fontFamily: t.fonts.sans, cursor: 'pointer',
            }}
          >
            {PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {isOwnerOrAdmin && (
            <button
              onClick={() => { setShowForm(true); setEditingGoal(null) }}
              style={{
                padding: '9px 18px', borderRadius: t.radius.md, border: 'none',
                background: t.colors.primary, color: '#FFFFFF',
                fontSize: t.fontSizes.base, fontWeight: '600',
                fontFamily: t.fonts.sans, cursor: 'pointer',
              }}
            >
              + Add Goal
            </button>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
        {[
          { label: 'Total Goals', value: goals.length },
          { label: 'On Track', value: onTrack },
          { label: 'Completed', value: completed },
          { label: 'Avg Progress', value: `${avgProgress}%` },
        ].map(stat => (
          <div key={stat.label} style={{
            background: t.colors.bgCard, border: `1px solid ${t.colors.border}`,
            borderRadius: t.radius.lg, padding: '16px 20px',
          }}>
            <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: t.colors.textPrimary, fontFamily: t.fonts.heading }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div style={{
          background: t.colors.bgCard, border: `1px solid ${t.colors.border}`,
          borderRadius: t.radius.lg, padding: '24px', marginBottom: '24px',
        }}>
          <h3 style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 20px' }}>
            {editingGoal ? 'Edit Goal' : 'New Goal'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Goal Title *</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Deliver 12 flagship events this quarter"
                style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What does success look like?"
                rows={2}
                style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', resize: 'vertical', color: t.colors.textPrimary }}
              />
            </div>
            <div>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Owner</label>
              <input
                value={form.owner}
                onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}
                placeholder="Team member name"
                style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }}
              />
            </div>
            <div>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{statusStyles[s].label}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>
                Progress — {form.progress}%
              </label>
              <input
                type="range" min="0" max="100" step="5"
                value={form.progress}
                onChange={e => setForm(f => ({ ...f, progress: Number(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
            <button
              onClick={handleSubmit}
              style={{ padding: '9px 20px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#FFFFFF', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}
            >
              {editingGoal ? 'Save Changes' : 'Add Goal'}
            </button>
            <button
              onClick={resetForm}
              style={{ padding: '9px 20px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Goals list */}
      {loading ? (
        <div style={{ color: t.colors.textTertiary, fontSize: t.fontSizes.base, padding: '40px 0', textAlign: 'center' }}>Loading goals...</div>
      ) : goals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}` }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎯</div>
          <div style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, marginBottom: '6px' }}>No goals yet for {activePeriod}</div>
          <div style={{ fontSize: t.fontSizes.base, color: t.colors.textSecondary }}>
            {isOwnerOrAdmin ? 'Add your first team goal to get started.' : 'No goals have been set for this period yet.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {goals.map(goal => {
            const s = statusStyles[goal.status] || statusStyles['not-started']
            return (
              <div key={goal.id} style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: t.fontSizes.md, fontWeight: '600', color: t.colors.textPrimary }}>{goal.title}</span>
                      <span style={{ fontSize: t.fontSizes.xs, fontWeight: '500', letterSpacing: '0.06em', textTransform: 'uppercase', background: s.bg, color: s.color, borderRadius: t.radius.full, padding: '3px 10px' }}>
                        {s.label}
                      </span>
                    </div>
                    {goal.description && (
                      <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary, lineHeight: 1.5 }}>{goal.description}</div>
                    )}
                    {goal.owner && (
                      <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '4px' }}>Owner: {goal.owner}</div>
                    )}
                  </div>
                  {isOwnerOrAdmin && (
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => startEdit(goal)} style={{ background: 'none', border: `1px solid ${t.colors.border}`, borderRadius: t.radius.sm, padding: '5px 10px', fontSize: t.fontSizes.xs, color: t.colors.textSecondary, cursor: 'pointer', fontFamily: t.fonts.sans }}>Edit</button>
                      <button onClick={() => handleDelete(goal.id)} style={{ background: 'none', border: `1px solid ${t.colors.border}`, borderRadius: t.radius.sm, padding: '5px 10px', fontSize: t.fontSizes.xs, color: t.colors.danger, cursor: 'pointer', fontFamily: t.fonts.sans }}>Delete</button>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary }}>Progress</span>
                    <span style={{ fontSize: t.fontSizes.xs, fontWeight: '600', color: t.colors.textPrimary }}>{goal.progress || 0}%</span>
                  </div>
                  <div style={{ height: '6px', background: t.colors.border, borderRadius: t.radius.full, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${goal.progress || 0}%`,
                      background: goal.progress === 100 ? t.colors.accent : t.colors.primary,
                      borderRadius: t.radius.full,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>

                {/* Inline controls for owner/admin */}
                {isOwnerOrAdmin && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="range" min="0" max="100" step="5"
                      value={goal.progress || 0}
                      onChange={e => updateProgress(goal.id, Number(e.target.value))}
                      style={{ flex: 1, minWidth: '120px' }}
                    />
                    <select
                      value={goal.status}
                      onChange={e => updateStatus(goal.id, e.target.value)}
                      style={{ padding: '4px 8px', borderRadius: t.radius.sm, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.xs, fontFamily: t.fonts.sans, color: t.colors.textPrimary }}
                    >
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{statusStyles[s].label}</option>)}
                    </select>
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
