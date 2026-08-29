import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import CurrencyInput from '../components/CurrencyInput'
import { formatDate, quarterInfoFromDate } from '../utils/dates'

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
const CURRENT_YEAR = new Date().getFullYear()
const STATUS_OPTIONS = ['draft', 'active', 'paused', 'completed']
const GOAL_OPTIONS = [
  'Brand Awareness',
  'Acquisition',
  'Retention',
  'Engagement',
  'Community Building',
  'Revenue',
  'Partnership',
  'Culture',
]

const CALENDAR_STATUSES = [
  { value: 'idea', label: 'Idea', color: '#6B7280', bg: '#F7F5F0' },
  { value: 'in-production', label: 'In production', color: '#D4874E', bg: '#FBF0E6' },
  { value: 'scheduled', label: 'Scheduled', color: '#7C5CBF', bg: '#F0EBF9' },
  { value: 'published', label: 'Published', color: '#6B8F71', bg: '#EAF2EA' },
]

const statusStyles = {
  draft: { bg: '#F3F3F3', color: '#6B7280', label: 'Draft' },
active: { bg: t.colors.primaryLight, color: t.colors.primary, label: 'Active' },
  paused: { bg: t.colors.warningLight, color: t.colors.warning, label: 'Paused' },
  completed: { bg: t.colors.successLight, color: t.colors.success, label: 'Completed' },
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function pctFor(goal) {
  const target = Number(goal.target || 0)
  if (!target) return 0
  return Math.max(0, Math.min(100, Math.round((Number(goal.current || 0) / target) * 100)))
}

function ChipList({ values, onChange, placeholder }) {
  const [input, setInput] = useState('')
  function add() {
    const v = input.trim()
    if (!v || values.includes(v)) { setInput(''); return }
    onChange([...values, v])
    setInput('')
  }
  return (
    <div>
      {values.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {values.map(v => (
            <span key={v} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: t.colors.primary, background: t.colors.primaryLight, padding: '4px 10px', borderRadius: t.radius.full }}>
              {v}
              <button type="button" onClick={() => onChange(values.filter(x => x !== v))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.colors.primary, fontSize: '12px', lineHeight: 1, padding: 0 }}>×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder}
          style={{ flex: 1, padding: '9px 12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }}
        />
        <button type="button" onClick={add} style={{ padding: '9px 16px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, cursor: 'pointer' }}>Add</button>
      </div>
    </div>
  )
}

export default function CreativeStrategy({ businessSpaceId, userRole }) {
  const [campaigns, setCampaigns] = useState([])
  const [goalsByCampaign, setGoalsByCampaign] = useState({})
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('strategy') // strategy | form | detail
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [calendarItems, setCalendarItems] = useState([])
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState(null)
  const [filterQuarter, setFilterQuarter] = useState('all')
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR)
  const [filterStatus, setFilterStatus] = useState('all')
  const [newGoal, setNewGoal] = useState({ label: '', target: '', unit: '' })

  const [form, setForm] = useState({
    name: '',
    overall_goal: '',
    strategy_notes: '',
    status: 'draft',
    start_date: '',
    end_date: '',
    budget: '',
    channels: [],
    platforms: [],
    description: '',
    goal: '',
    audience: '',
  })

  const isCreativeOrDirector = ['owner', 'co-owner', 'employee'].includes(userRole)

  useEffect(() => {
    if (businessSpaceId) fetchAll()
  }, [businessSpaceId])

  async function fetchAll() {
    setLoading(true)
    const [campRes, goalsRes] = await Promise.all([
      supabase.from('campaigns').select('*').eq('business_space_id', businessSpaceId).order('created_at', { ascending: false }),
      supabase.from('campaign_goals').select('*').eq('business_space_id', businessSpaceId).order('created_at', { ascending: true }),
    ])
    setCampaigns(campRes.data || [])
    const map = {}
    ;(goalsRes.data || []).forEach(g => { (map[g.campaign_id] ||= []).push(g) })
    setGoalsByCampaign(map)
    setLoading(false)
  }

  async function saveCampaign() {
    if (!form.name) return
    const { data: user } = await supabase.auth.getUser()
    const qy = quarterInfoFromDate(form.start_date) || quarterInfoFromDate(form.end_date)
    const payload = {
      business_space_id: businessSpaceId,
      user_id: user.user?.id,
      name: form.name,
      overall_goal: form.overall_goal,
      strategy_notes: form.strategy_notes,
      quarter: qy?.quarter || null,
      year: qy?.year || null,
      status: form.status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      budget: Number(form.budget) || 0,
      channels: form.channels,
      platforms: form.platforms,
      description: form.description,
      goal: form.goal,
      audience: form.audience,
    }

    if (editingCampaign) {
      await supabase.from('campaigns').update(payload).eq('id', editingCampaign.id)
    } else {
      await supabase.from('campaigns').insert(payload)
    }
    const returnToDetail = selectedCampaign && editingCampaign && selectedCampaign.id === editingCampaign.id
    setEditingCampaign(null)
    setView(returnToDetail ? 'detail' : 'strategy')
    if (returnToDetail) setSelectedCampaign(prev => ({ ...prev, ...payload }))
    await fetchAll()
  }

  async function deleteCampaign(id) {
    await supabase.from('campaigns').delete().eq('id', id)
    fetchAll()
    if (selectedCampaign?.id === id) {
      setView('strategy')
      setSelectedCampaign(null)
    }
  }

  async function updateStatus(id, status) {
    await supabase.from('campaigns').update({ status }).eq('id', id)
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status } : c))
    setSelectedCampaign(prev => prev && prev.id === id ? { ...prev, status } : prev)
  }

  function viewCampaign(campaign) {
    setSelectedCampaign(campaign)
    setView('detail')
    setNewGoal({ label: '', target: '', unit: '' })
    fetchCalendarItems(campaign.id)
  }

  async function fetchCalendarItems(campaignId) {
    setCalendarLoading(true)
    const { data } = await supabase
      .from('content_calendar')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('scheduled_date', { ascending: true })
    setCalendarItems(data || [])
    setCalendarLoading(false)
  }

  async function addGoal(campaignId, { label, target, unit }) {
    const targetNum = Number(target)
    if (!targetNum) return
    const { data } = await supabase.from('campaign_goals').insert({
      campaign_id: campaignId,
      business_space_id: businessSpaceId,
      label: label || null,
      target: targetNum,
      current: 0,
      unit: unit || null,
    }).select().single()
    if (data) {
      setGoalsByCampaign(prev => ({ ...prev, [campaignId]: [...(prev[campaignId] || []), data] }))
    }
  }

  async function updateGoalCurrent(goalId, campaignId, current) {
    await supabase.from('campaign_goals').update({ current }).eq('id', goalId)
    setGoalsByCampaign(prev => ({
      ...prev,
      [campaignId]: (prev[campaignId] || []).map(g => g.id === goalId ? { ...g, current } : g),
    }))
  }

  async function deleteGoal(goalId, campaignId) {
    await supabase.from('campaign_goals').delete().eq('id', goalId)
    setGoalsByCampaign(prev => ({
      ...prev,
      [campaignId]: (prev[campaignId] || []).filter(g => g.id !== goalId),
    }))
  }

  function startEdit(campaign) {
    setEditingCampaign(campaign)
    setForm({
      name: campaign.name || '',
      overall_goal: campaign.overall_goal || '',
      strategy_notes: campaign.strategy_notes || '',
      status: campaign.status || 'draft',
      start_date: campaign.start_date || '',
      end_date: campaign.end_date || '',
      budget: campaign.budget || '',
      channels: campaign.channels || [],
      platforms: campaign.platforms || [],
      description: campaign.description || '',
      goal: campaign.goal || '',
      audience: campaign.audience || '',
    })
    setView('form')
  }

  function startNew() {
    setEditingCampaign(null)
    setForm({
      name: '', overall_goal: '', strategy_notes: '',
      status: 'draft', start_date: '', end_date: '',
      budget: '', channels: [], platforms: [], description: '', goal: '', audience: '',
    })
    setView('form')
  }

  function resetForm() {
    const returnToDetail = selectedCampaign && editingCampaign && selectedCampaign.id === editingCampaign.id
    setView(returnToDetail ? 'detail' : 'strategy')
    setEditingCampaign(null)
  }

  const filtered = campaigns.filter(c => {
    const matchQ = filterQuarter === 'all' || c.quarter === filterQuarter
    const matchY = c.year === filterYear || !c.year
    const matchS = filterStatus === 'all' || c.status === filterStatus
    return matchQ && matchY && matchS
  })

  const byQuarter = QUARTERS.map(q => ({
    quarter: q,
    campaigns: filtered.filter(c => c.quarter === q),
  }))

  const unquartered = filtered.filter(c => !c.quarter)

  // ── FORM VIEW ──
  if (view === 'form') {
    return (
      <div style={{ padding: '32px 40px', fontFamily: t.fonts.sans, maxWidth: '800px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.colors.textTertiary, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans }}>← Back</button>
          <h1 style={{ fontFamily: t.fonts.heading, fontSize: '24px', fontWeight: '800', color: t.colors.textPrimary, letterSpacing: '-0.02em', margin: 0 }}>
            {editingCampaign ? 'Edit Campaign' : 'New Campaign'}
          </h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Core info */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px' }}>
            <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '16px' }}>Campaign Info</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '14px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Campaign Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Spring Product Launch Campaign" style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }} />
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Overall Goal</label>
                <select value={form.overall_goal} onChange={e => setForm(f => ({ ...f, overall_goal: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }}>
                  <option value="">Select goal</option>
                  {GOAL_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{statusStyles[s].label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Audience</label>
                <input value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))} placeholder="Who is this campaign targeting?" style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this campaign about?" rows={2} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', resize: 'vertical', color: t.colors.textPrimary }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Strategy Notes</label>
                <textarea value={form.strategy_notes} onChange={e => setForm(f => ({ ...f, strategy_notes: e.target.value }))} placeholder="Creative direction, key messages, brand goals, target audience..." rows={3} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', resize: 'vertical', color: t.colors.textPrimary }} />
              </div>
            </div>
          </div>

          {/* Timeline & budget */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px' }}>
            <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '16px' }}>Timeline & Budget</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: '14px' }}>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Start Date</label>
                <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }} />
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>End Date</label>
                <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }} />
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Budget</label>
                <CurrencyInput value={form.budget} onChange={val => setForm(f => ({ ...f, budget: val }))} />
              </div>
            </div>
            {(() => {
              const qy = quarterInfoFromDate(form.start_date) || quarterInfoFromDate(form.end_date)
              return (
                <div style={{ marginTop: '12px', fontSize: t.fontSizes.sm, color: qy ? t.colors.primary : t.colors.textTertiary }}>
                  {qy ? `📌 Falls under ${qy.quarter} ${qy.year} — set automatically from the dates above` : 'Add a start date to place this campaign in a quarter'}
                </div>
              )
            })()}
          </div>

          {/* Channels */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px' }}>
            <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '16px' }}>Channels & Platforms</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '14px' }}>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Channels</label>
                <ChipList values={form.channels} onChange={vals => setForm(f => ({ ...f, channels: vals }))} placeholder="e.g. Social, Email, OOH, IRL" />
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Platforms</label>
                <ChipList values={form.platforms} onChange={vals => setForm(f => ({ ...f, platforms: vals }))} placeholder="e.g. Instagram, TikTok, YouTube" />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', paddingBottom: '40px' }}>
            <button onClick={saveCampaign} style={{ padding: '11px 28px', borderRadius: t.radius.full, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.md, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>
              {editingCampaign ? 'Save Changes' : 'Create Campaign'}
            </button>
            <button onClick={resetForm} style={{ padding: '11px 20px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.md, fontFamily: t.fonts.sans, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── DETAIL VIEW ──
  if (view === 'detail' && selectedCampaign) {
    const campaign = selectedCampaign
    const s = statusStyles[campaign.status] || statusStyles.draft
    const campaignGoals = goalsByCampaign[campaign.id] || []
    const allGoalsReached = campaignGoals.length > 0 && campaignGoals.every(g => pctFor(g) >= 100)

    return (
      <div style={{ padding: '32px 40px', fontFamily: t.fonts.sans, maxWidth: '900px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <button onClick={() => { setView('strategy'); setSelectedCampaign(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.colors.textTertiary, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans }}>← Back</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <h1 style={{ fontFamily: t.fonts.heading, fontSize: '26px', fontWeight: '800', color: t.colors.textPrimary, letterSpacing: '-0.02em', margin: 0 }}>{campaign.name}</h1>
              <span style={{ fontSize: '11px', fontWeight: '500', background: s.bg, color: s.color, padding: '3px 10px', borderRadius: '100px' }}>{s.label}</span>
            </div>
            {campaign.quarter && campaign.year && (
              <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>{campaign.quarter} {campaign.year}</div>
            )}
          </div>
          {isCreativeOrDirector && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => startEdit(campaign)} style={{ padding: '8px 16px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, cursor: 'pointer' }}>Edit</button>
              <button onClick={() => deleteCampaign(campaign.id)} style={{ padding: '8px 14px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.danger, fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, cursor: 'pointer' }}>Delete</button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Goal tracker */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${allGoalsReached ? t.colors.success : t.colors.border}`, borderRadius: t.radius.lg, padding: '24px' }}>
            <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '16px' }}>Goal Tracking</div>

            {campaignGoals.length === 0 ? (
              <div style={{ color: t.colors.textTertiary, fontSize: t.fontSizes.sm, marginBottom: '14px' }}>No goals yet. Add one below to start tracking progress.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '14px' }}>
                {campaignGoals.map(g => {
                  const pct = pctFor(g)
                  const reached = pct >= 100
                  return (
                    <div key={g.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>{g.label || g.unit || 'Goal'}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>
                            {Number(g.current || 0).toLocaleString()} / {Number(g.target).toLocaleString()} {g.unit || ''}
                          </span>
                          <span style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: reached ? t.colors.success : t.colors.textSecondary }}>{pct}%{reached ? ' ✓' : ''}</span>
                          {isCreativeOrDirector && (
                            <>
                              <input
                                type="number"
                                defaultValue={g.current || 0}
                                onBlur={e => {
                                  const val = Number(e.target.value) || 0
                                  if (val !== Number(g.current || 0)) updateGoalCurrent(g.id, campaign.id, val)
                                }}
                                style={{ width: '70px', padding: '4px 8px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.xs, fontFamily: t.fonts.sans, color: t.colors.textPrimary }}
                              />
                              <button onClick={() => deleteGoal(g.id, campaign.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.colors.textTertiary, fontSize: t.fontSizes.xs, fontFamily: t.fonts.sans }}>Remove</button>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ height: '8px', background: t.colors.bg, borderRadius: t.radius.full, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: reached ? t.colors.success : t.colors.primary, borderRadius: t.radius.full, transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {allGoalsReached && (
              <div style={{ padding: '10px 14px', background: t.colors.successLight, color: t.colors.success, borderRadius: t.radius.md, fontSize: t.fontSizes.sm, fontWeight: '600', marginBottom: '14px' }}>
                🎉 All goals reached — time to switch to the next campaign!
              </div>
            )}

            {isCreativeOrDirector && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: campaignGoals.length > 0 ? '4px' : 0, borderTop: campaignGoals.length > 0 ? `1px solid ${t.colors.border}` : 'none' }}>
                <input placeholder="Goal label (optional)" value={newGoal.label} onChange={e => setNewGoal(g => ({ ...g, label: e.target.value }))} style={{ flex: '1 1 140px', padding: '8px 12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, color: t.colors.textPrimary, marginTop: campaignGoals.length > 0 ? '10px' : 0 }} />
                <input type="number" placeholder="Target" value={newGoal.target} onChange={e => setNewGoal(g => ({ ...g, target: e.target.value }))} style={{ width: '100px', padding: '8px 12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, color: t.colors.textPrimary, marginTop: campaignGoals.length > 0 ? '10px' : 0 }} />
                <input placeholder="Unit (e.g. new followers)" value={newGoal.unit} onChange={e => setNewGoal(g => ({ ...g, unit: e.target.value }))} style={{ flex: '1 1 160px', padding: '8px 12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, color: t.colors.textPrimary, marginTop: campaignGoals.length > 0 ? '10px' : 0 }} />
                <button
                  onClick={async () => { if (!newGoal.target) return; await addGoal(campaign.id, newGoal); setNewGoal({ label: '', target: '', unit: '' }) }}
                  style={{ padding: '8px 18px', borderRadius: t.radius.full, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.sm, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer', marginTop: campaignGoals.length > 0 ? '10px' : 0 }}
                >
                  + Add Goal
                </button>
              </div>
            )}
          </div>

          {/* Overview */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px' }}>
            <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '12px' }}>Overview</div>
            {campaign.description && <p style={{ fontSize: t.fontSizes.base, color: t.colors.textSecondary, margin: '0 0 12px', lineHeight: 1.5 }}>{campaign.description}</p>}
            {campaign.strategy_notes && (
              <div style={{ padding: '12px 14px', background: t.colors.bg, borderRadius: t.radius.md, fontSize: t.fontSizes.sm, color: t.colors.textSecondary, lineHeight: 1.5, marginBottom: '12px' }}>{campaign.strategy_notes}</div>
            )}
            {campaign.audience && (
              <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary, marginBottom: '12px' }}>
                <strong style={{ color: t.colors.textPrimary }}>Audience: </strong>{campaign.audience}
              </div>
            )}
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {campaign.overall_goal && <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>🎯 {campaign.overall_goal}</div>}
              {(campaign.start_date || campaign.end_date) && (
                <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>
                  📅 {campaign.start_date && campaign.end_date ? `${formatDate(campaign.start_date)} → ${formatDate(campaign.end_date)}` : formatDate(campaign.start_date || campaign.end_date)}
                </div>
              )}
              {campaign.budget > 0 && <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>💰 {fmt(campaign.budget)}</div>}
              {campaign.channels?.length > 0 && <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>📡 {campaign.channels.join(', ')}</div>}
              {campaign.platforms?.length > 0 && <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>📱 {campaign.platforms.join(', ')}</div>}
            </div>
          </div>

          {/* Content calendar items */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px' }}>
            <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '16px' }}>
              Content Calendar ({calendarItems.length})
            </div>
            {calendarLoading ? (
              <div style={{ color: t.colors.textTertiary, fontSize: t.fontSizes.sm, padding: '12px 0' }}>Loading...</div>
            ) : calendarItems.length === 0 ? (
              <div style={{ color: t.colors.textTertiary, fontSize: t.fontSizes.sm, padding: '12px 0' }}>No content calendar items linked to this campaign yet. Add one from the Content Calendar and select this campaign.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {calendarItems.map(item => {
                  const st = CALENDAR_STATUSES.find(x => x.value === item.status) || CALENDAR_STATUSES[0]
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: t.colors.bg, borderRadius: t.radius.md, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '160px', fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>{item.title}</div>
                      {item.platform && <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{item.platform}</span>}
                      {item.scheduled_date && <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>📅 {formatDate(item.scheduled_date)}</span>}
                      <span style={{ fontSize: '10px', fontWeight: '500', background: st.bg, color: st.color, padding: '3px 8px', borderRadius: t.radius.full }}>{st.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── STRATEGY VIEW ──
  const totalGoals = filtered.reduce((sum, c) => sum + (goalsByCampaign[c.id] || []).length, 0)
  const reachedGoals = filtered.reduce((sum, c) => sum + (goalsByCampaign[c.id] || []).filter(g => pctFor(g) >= 100).length, 0)

  return (
    <div style={{ padding: '32px 40px', fontFamily: t.fonts.sans }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: t.fontSizes.xs, fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.primary, marginBottom: '6px' }}>Creative Collective</div>
          <h1 style={{ fontFamily: t.fonts.heading, fontSize: '28px', fontWeight: '800', color: t.colors.textPrimary, letterSpacing: '-0.02em', margin: 0 }}>Creative Strategy</h1>
        </div>
        {isCreativeOrDirector && (
          <button onClick={startNew} style={{ padding: '9px 18px', borderRadius: t.radius.full, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>
            + New Campaign
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '28px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} style={{ padding: '7px 12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary, background: t.colors.bgCard }}>
          {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '4px', background: t.colors.bg, borderRadius: t.radius.full, padding: '4px' }}>
          {['all', ...QUARTERS].map(q => (
            <button key={q} onClick={() => setFilterQuarter(q)} style={{ padding: '5px 14px', borderRadius: t.radius.full, border: 'none', background: filterQuarter === q ? t.colors.bgCard : 'transparent', color: filterQuarter === q ? t.colors.textPrimary : t.colors.textSecondary, fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, cursor: 'pointer', fontWeight: filterQuarter === q ? '600' : '400', boxShadow: filterQuarter === q ? t.shadows.sm : 'none' }}>
              {q === 'all' ? 'All' : q}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '4px', background: t.colors.bg, borderRadius: t.radius.full, padding: '4px' }}>
          {['all', ...STATUS_OPTIONS].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '5px 14px', borderRadius: t.radius.full, border: 'none', background: filterStatus === s ? t.colors.bgCard : 'transparent', color: filterStatus === s ? t.colors.textPrimary : t.colors.textSecondary, fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, cursor: 'pointer', fontWeight: filterStatus === s ? '600' : '400', boxShadow: filterStatus === s ? t.shadows.sm : 'none' }}>
              {s === 'all' ? 'All' : statusStyles[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '32px' }}>
        {[
          { label: 'Total Campaigns', value: filtered.length },
          { label: 'Active', value: filtered.filter(c => c.status === 'active').length },
          { label: 'Goals Reached', value: `${reachedGoals} / ${totalGoals}` },
          { label: 'Total Budget', value: fmt(filtered.reduce((s, c) => s + Number(c.budget || 0), 0)) },
        ].map(stat => (
          <div key={stat.label} style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '16px 20px' }}>
            <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{stat.label}</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: t.colors.textPrimary, fontFamily: t.fonts.heading }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ color: t.colors.textTertiary, textAlign: 'center', padding: '60px' }}>Loading strategy...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}` }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎨</div>
          <div style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, marginBottom: '6px' }}>No campaigns yet</div>
          <div style={{ fontSize: t.fontSizes.base, color: t.colors.textSecondary, marginBottom: '16px' }}>Create one to start shaping your creative strategy.</div>
          {isCreativeOrDirector && (
            <button onClick={startNew} style={{ padding: '10px 24px', borderRadius: t.radius.full, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>
              New Campaign
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* By quarter */}
          {filterQuarter === 'all' ? (
            <>
              {byQuarter.filter(q => q.campaigns.length > 0).map(({ quarter, campaigns: qCampaigns }) => (
                <div key={quarter}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <div style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes.xl, fontWeight: '800', color: t.colors.textPrimary }}>{quarter}</div>
                    <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{qCampaigns.length} campaign{qCampaigns.length !== 1 ? 's' : ''}</div>
                    <div style={{ flex: 1, height: '1px', background: t.colors.border }} />
                  </div>
                  <CampaignGrid campaigns={qCampaigns} goalsByCampaign={goalsByCampaign} onEdit={startEdit} onDelete={deleteCampaign} onStatusChange={updateStatus} onView={viewCampaign} isCreativeOrDirector={isCreativeOrDirector} />
                </div>
              ))}
              {unquartered.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <div style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes.xl, fontWeight: '800', color: t.colors.textSecondary }}>Unscheduled</div>
                    <div style={{ flex: 1, height: '1px', background: t.colors.border }} />
                  </div>
                  <CampaignGrid campaigns={unquartered} goalsByCampaign={goalsByCampaign} onEdit={startEdit} onDelete={deleteCampaign} onStatusChange={updateStatus} onView={viewCampaign} isCreativeOrDirector={isCreativeOrDirector} />
                </div>
              )}
            </>
          ) : (
            <CampaignGrid campaigns={filtered} goalsByCampaign={goalsByCampaign} onEdit={startEdit} onDelete={deleteCampaign} onStatusChange={updateStatus} onView={viewCampaign} isCreativeOrDirector={isCreativeOrDirector} />
          )}
        </div>
      )}
    </div>
  )
}

function CampaignGrid({ campaigns, goalsByCampaign, onEdit, onDelete, onStatusChange, onView, isCreativeOrDirector }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
      {campaigns.map(campaign => {
        const s = statusStyles[campaign.status] || statusStyles.draft
        const campaignGoals = goalsByCampaign[campaign.id] || []
        return (
<div key={campaign.id} style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer' }} onClick={() => onView(campaign)}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
<div style={{ fontFamily: t.fonts.heading, fontSize: '16px', fontWeight: '800', color: t.colors.textPrimary, lineHeight: 1.2, letterSpacing: '-0.01em' }}>{campaign.name}</div>
              <span style={{ fontSize: '10px', fontWeight: '500', background: s.bg, color: s.color, padding: '3px 8px', borderRadius: '100px', flexShrink: 0 }}>{s.label}</span>
            </div>

            {/* Goal progress */}
            {campaignGoals.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {campaignGoals.slice(0, 2).map(g => {
                  const pct = pctFor(g)
                  const reached = pct >= 100
                  return (
                    <div key={g.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: t.colors.textTertiary, marginBottom: '4px' }}>
                        <span>{g.label || g.unit || 'Goal'}</span>
                        <span style={{ fontWeight: '600', color: reached ? t.colors.success : t.colors.textSecondary }}>{pct}%{reached ? ' ✓' : ''}</span>
                      </div>
                      <div style={{ height: '6px', background: t.colors.bg, borderRadius: t.radius.full, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: reached ? t.colors.success : t.colors.primary, borderRadius: t.radius.full }} />
                      </div>
                    </div>
                  )
                })}
                {campaignGoals.length > 2 && (
                  <div style={{ fontSize: '10px', color: t.colors.textTertiary }}>+{campaignGoals.length - 2} more goal{campaignGoals.length - 2 !== 1 ? 's' : ''}</div>
                )}
              </div>
            )}

            {/* Goal + Quarter */}
            {(campaign.overall_goal || (campaign.quarter && campaign.year)) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {campaign.overall_goal && (
                  <span style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', color: t.colors.primary, background: t.colors.primaryLight, padding: '3px 8px', borderRadius: t.radius.full }}>{campaign.overall_goal}</span>
                )}
                {campaign.quarter && campaign.year && (
                  <span style={{ fontSize: '11px', fontWeight: '600', color: t.colors.textSecondary, background: t.colors.bg, padding: '3px 8px', borderRadius: t.radius.full }}>{campaign.quarter} {campaign.year}</span>
                )}
              </div>
            )}

            {/* Description */}
            {campaign.description && (
              <p style={{ fontSize: '13px', color: t.colors.textSecondary, margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{campaign.description}</p>
            )}

            {/* Strategy notes preview */}
            {campaign.strategy_notes && (
<div style={{ padding: '10px 12px', background: t.colors.bg, borderRadius: t.radius.md, fontSize: t.fontSizes.sm, color: t.colors.textSecondary, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {campaign.strategy_notes}
              </div>
            )}

            {/* Meta */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {(campaign.start_date || campaign.end_date) && (
               <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
                  📅 {campaign.start_date && campaign.end_date
                    ? `${formatDate(campaign.start_date)} → ${formatDate(campaign.end_date)}`
                    : formatDate(campaign.start_date || campaign.end_date)}
                </div>
              )}
              {campaign.budget > 0 && <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>💰 {Number(campaign.budget).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</div>}
              {campaign.channels?.length > 0 && <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>📡 {campaign.channels.join(', ')}</div>}
            </div>

            {/* Actions */}
            {isCreativeOrDirector && (
              <div style={{ display: 'flex', gap: '6px', paddingTop: '4px' }} onClick={e => e.stopPropagation()}>
                <select value={campaign.status} onChange={e => onStatusChange(campaign.id, e.target.value)} style={{ flex: 1, padding: '6px 8px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.xs, fontFamily: t.fonts.sans, color: t.colors.textPrimary, background: t.colors.bgCard }}>
                  {Object.entries(statusStyles).map(([val, st]) => <option key={val} value={val}>{st.label}</option>)}
                </select>
                <button onClick={() => onEdit(campaign)} style={{ padding: '6px 12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.xs, fontFamily: t.fonts.sans, cursor: 'pointer' }}>Edit</button>
                <button onClick={() => onDelete(campaign.id)} style={{ padding: '6px 10px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.danger, fontSize: t.fontSizes.xs, fontFamily: t.fonts.sans, cursor: 'pointer' }}>Delete</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
