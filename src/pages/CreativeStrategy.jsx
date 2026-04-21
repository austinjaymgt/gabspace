import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import CurrencyInput from '../components/CurrencyInput'

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

const statusStyles = {
  draft: { bg: '#F3F3F3', color: '#6B7280', label: 'Draft' },
active: { bg: t.colors.primaryLight, color: t.colors.primary, label: 'Active' },
  paused: { bg: t.colors.warningLight, color: t.colors.warning, label: 'Paused' },
  completed: { bg: t.colors.successLight, color: t.colors.success, label: 'Completed' },
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function CreativeStrategy({ workspaceId, userRole }) {
  const [campaigns, setCampaigns] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('strategy') // strategy | form | detail
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [editingCampaign, setEditingCampaign] = useState(null)
  const [filterQuarter, setFilterQuarter] = useState('all')
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR)
  const [filterStatus, setFilterStatus] = useState('all')

  const [form, setForm] = useState({
    name: '',
    overall_goal: '',
    strategy_notes: '',
    quarter: '',
    year: CURRENT_YEAR,
    status: 'draft',
    start_date: '',
    end_date: '',
    budget: '',
    channel: '',
    platform: '',
    description: '',
    goal: '',
    project_id: '',
  })

  const isCreativeOrDirector = ['owner', 'admin', 'member'].includes(userRole)

  useEffect(() => {
    if (workspaceId) fetchAll()
  }, [workspaceId])

  async function fetchAll() {
    setLoading(true)
    const [campRes, projRes] = await Promise.all([
      supabase.from('campaigns').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('projects').select('id, title, event_date, event_status').order('title'),
    ])
    setCampaigns(campRes.data || [])
    setProjects(projRes.data || [])
    setLoading(false)
  }

  async function saveCampaign() {
    if (!form.name) return
    const { data: user } = await supabase.auth.getUser()
    const payload = {
      workspace_id: workspaceId,
      user_id: user.user?.id,
      name: form.name,
      overall_goal: form.overall_goal,
      strategy_notes: form.strategy_notes,
      quarter: form.quarter,
      year: Number(form.year) || CURRENT_YEAR,
      status: form.status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      budget: Number(form.budget) || 0,
      channel: form.channel,
      platform: form.platform,
      description: form.description,
      goal: form.goal,
      project_id: form.project_id || null,
    }

    if (editingCampaign) {
      await supabase.from('campaigns').update(payload).eq('id', editingCampaign.id)
    } else {
      await supabase.from('campaigns').insert(payload)
    }
    resetForm()
    fetchAll()
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
  }

  async function linkEvent(campaignId, projectId) {
    await supabase.from('campaigns').update({ project_id: projectId || null }).eq('id', campaignId)
    fetchAll()
  }

  function startEdit(campaign) {
    setEditingCampaign(campaign)
    setForm({
      name: campaign.name || '',
      overall_goal: campaign.overall_goal || '',
      strategy_notes: campaign.strategy_notes || '',
      quarter: campaign.quarter || '',
      year: campaign.year || CURRENT_YEAR,
      status: campaign.status || 'draft',
      start_date: campaign.start_date || '',
      end_date: campaign.end_date || '',
      budget: campaign.budget || '',
      channel: campaign.channel || '',
      platform: campaign.platform || '',
      description: campaign.description || '',
      goal: campaign.goal || '',
      project_id: campaign.project_id || '',
    })
    setView('form')
  }

  function startNew() {
    setEditingCampaign(null)
    setForm({
      name: '', overall_goal: '', strategy_notes: '', quarter: '',
      year: CURRENT_YEAR, status: 'draft', start_date: '', end_date: '',
      budget: '', channel: '', platform: '', description: '', goal: '', project_id: '',
    })
    setView('form')
  }

  function resetForm() {
    setView('strategy')
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Campaign Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. NBA Finals 2026 Campaign" style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }} />
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Overall Goal</label>
                <select value={form.overall_goal} onChange={e => setForm(f => ({ ...f, overall_goal: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }}>
                  <option value="">Select goal</option>
                  {GOAL_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{statusStyles[s].label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Quarter</label>
                <select value={form.quarter} onChange={e => setForm(f => ({ ...f, quarter: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }}>
                  <option value="">No quarter</option>
                  {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Year</label>
                <select value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }}>
                  {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this campaign about?" rows={2} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', resize: 'vertical', color: t.colors.textPrimary }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Strategy Notes</label>
                <textarea value={form.strategy_notes} onChange={e => setForm(f => ({ ...f, strategy_notes: e.target.value }))} placeholder="Creative direction, key messages, brand goals, target audience..." rows={3} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', resize: 'vertical', color: t.colors.textPrimary }} />
              </div>
            </div>
          </div>

          {/* Timeline & budget */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px' }}>
            <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '16px' }}>Timeline & Budget</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Start Date</label>
                <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }} />
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>End Date</label>
                <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }} />
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Budget</label>
                <CurrencyInput value={form.budget} onChange={val => setForm(f => ({ ...f, budget: val }))} />
              </div>
            </div>
          </div>

          {/* Channels */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px' }}>
            <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '16px' }}>Channels & Platform</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Channel</label>
                <input value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} placeholder="e.g. Social, Email, OOH, IRL" style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }} />
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Platform</label>
                <input value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} placeholder="e.g. Instagram, TikTok, YouTube" style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }} />
              </div>
            </div>
          </div>

          {/* Event linkage */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px' }}>
            <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '16px' }}>Linked Event</div>
            <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }}>
              <option value="">No event linked</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            {form.project_id && (
              <div style={{ marginTop: '10px', fontSize: t.fontSizes.sm, color: t.colors.primary }}>
                ✓ This campaign will be visible on the linked event's detail page
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', paddingBottom: '40px' }}>
            <button onClick={saveCampaign} style={{ padding: '11px 28px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.md, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>
              {editingCampaign ? 'Save Changes' : 'Create Campaign'}
            </button>
            <button onClick={resetForm} style={{ padding: '11px 20px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.md, fontFamily: t.fonts.sans, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── STRATEGY VIEW ──
  return (
    <div style={{ padding: '32px 40px', fontFamily: t.fonts.sans }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: t.fontSizes.xs, fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.primary, marginBottom: '6px' }}>Creative Collective</div>
          <h1 style={{ fontFamily: t.fonts.heading, fontSize: '28px', fontWeight: '800', color: t.colors.textPrimary, letterSpacing: '-0.02em', margin: 0 }}>Creative Strategy</h1>
        </div>
        {isCreativeOrDirector && (
          <button onClick={startNew} style={{ padding: '9px 18px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>
            + New Campaign
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '28px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} style={{ padding: '7px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary, background: t.colors.bgCard }}>
          {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '4px', background: t.colors.bg, borderRadius: t.radius.md, padding: '4px' }}>
          {['all', ...QUARTERS].map(q => (
            <button key={q} onClick={() => setFilterQuarter(q)} style={{ padding: '5px 14px', borderRadius: t.radius.sm, border: 'none', background: filterQuarter === q ? t.colors.bgCard : 'transparent', color: filterQuarter === q ? t.colors.textPrimary : t.colors.textSecondary, fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, cursor: 'pointer', fontWeight: filterQuarter === q ? '600' : '400', boxShadow: filterQuarter === q ? t.shadows.sm : 'none' }}>
              {q === 'all' ? 'All' : q}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '4px', background: t.colors.bg, borderRadius: t.radius.md, padding: '4px' }}>
          {['all', ...STATUS_OPTIONS].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '5px 14px', borderRadius: t.radius.sm, border: 'none', background: filterStatus === s ? t.colors.bgCard : 'transparent', color: filterStatus === s ? t.colors.textPrimary : t.colors.textSecondary, fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, cursor: 'pointer', fontWeight: filterStatus === s ? '600' : '400', boxShadow: filterStatus === s ? t.shadows.sm : 'none' }}>
              {s === 'all' ? 'All' : statusStyles[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
        {[
          { label: 'Total Campaigns', value: filtered.length },
          { label: 'Active', value: filtered.filter(c => c.status === 'active').length },
          { label: 'Linked to Events', value: filtered.filter(c => c.project_id).length },
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
          <div style={{ fontSize: t.fontSizes.base, color: t.colors.textSecondary, marginBottom: '16px' }}>Start building your creative strategy by adding your first campaign.</div>
          {isCreativeOrDirector && (
            <button onClick={startNew} style={{ padding: '10px 24px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>
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
                  <CampaignGrid campaigns={qCampaigns} projects={projects} onEdit={startEdit} onDelete={deleteCampaign} onStatusChange={updateStatus} onLinkEvent={linkEvent} isCreativeOrDirector={isCreativeOrDirector} />
                </div>
              ))}
              {unquartered.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <div style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes.xl, fontWeight: '800', color: t.colors.textSecondary }}>Unscheduled</div>
                    <div style={{ flex: 1, height: '1px', background: t.colors.border }} />
                  </div>
                  <CampaignGrid campaigns={unquartered} projects={projects} onEdit={startEdit} onDelete={deleteCampaign} onStatusChange={updateStatus} onLinkEvent={linkEvent} isCreativeOrDirector={isCreativeOrDirector} />
                </div>
              )}
            </>
          ) : (
            <CampaignGrid campaigns={filtered} projects={projects} onEdit={startEdit} onDelete={deleteCampaign} onStatusChange={updateStatus} onLinkEvent={linkEvent} isCreativeOrDirector={isCreativeOrDirector} />
          )}
        </div>
      )}
    </div>
  )
}

function CampaignGrid({ campaigns, projects, onEdit, onDelete, onStatusChange, onLinkEvent, isCreativeOrDirector }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
      {campaigns.map(campaign => {
        const s = statusStyles[campaign.status] || statusStyles.draft
        const linkedProject = projects.find(p => p.id === campaign.project_id)
        return (
<div key={campaign.id} style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
<div style={{ fontFamily: t.fonts.heading, fontSize: '16px', fontWeight: '800', color: t.colors.textPrimary, lineHeight: 1.2, letterSpacing: '-0.01em' }}>{campaign.name}</div>
              <span style={{ fontSize: '10px', fontWeight: '500', background: s.bg, color: s.color, padding: '3px 8px', borderRadius: '100px', flexShrink: 0 }}>{s.label}</span>
            </div>

            {/* Goal */}
            {campaign.overall_goal && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
<span style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', color: t.colors.primary, background: t.colors.primaryLight, padding: '3px 8px', borderRadius: t.radius.full }}>{campaign.overall_goal}</span>
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
              {campaign.start_date && campaign.end_date && (
               <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
                  📅 {new Date(campaign.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → {new Date(campaign.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              )}
              {campaign.budget > 0 && <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>💰 {Number(campaign.budget).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</div>}
              {campaign.channel && <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>📡 {campaign.channel}</div>}
            </div>

            {/* Linked event */}
            <div>
              {linkedProject ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: t.colors.primaryLight, borderRadius: t.radius.md }}>
                  <span style={{ fontSize: t.fontSizes.sm, color: t.colors.primary, fontWeight: '500', flex: 1 }}>🔗 {linkedProject.title}</span>
                  {isCreativeOrDirector && (
                    <button onClick={() => onLinkEvent(campaign.id, null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.colors.textTertiary, fontSize: t.fontSizes.xs, fontFamily: t.fonts.sans }}>Unlink</button>
                  )}
                </div>
              ) : isCreativeOrDirector ? (
                <select
                    onChange={e => { if (e.target.value) onLinkEvent(campaign.id, e.target.value) }}
                    value=""
                    style={{ width: '100%', padding: '7px 10px', borderRadius: t.radius.md, border: `1px dashed ${t.colors.border}`, fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, color: t.colors.textTertiary, background: 'transparent', cursor: 'pointer' }}
          >
                    <option value="" disabled>+ Link to an event</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              ) : (
                <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>No event linked</div>
              )}
            </div>

            {/* Actions */}
            {isCreativeOrDirector && (
              <div style={{ display: 'flex', gap: '6px', paddingTop: '4px' }}>
                <select value={campaign.status} onChange={e => onStatusChange(campaign.id, e.target.value)} style={{ flex: 1, padding: '6px 8px', borderRadius: t.radius.sm, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.xs, fontFamily: t.fonts.sans, color: t.colors.textPrimary, background: t.colors.bgCard }}>
                  {Object.entries(statusStyles).map(([val, st]) => <option key={val} value={val}>{st.label}</option>)}
                </select>
                <button onClick={() => onEdit(campaign)} style={{ padding: '6px 12px', borderRadius: t.radius.sm, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.xs, fontFamily: t.fonts.sans, cursor: 'pointer' }}>Edit</button>
                <button onClick={() => onDelete(campaign.id)} style={{ padding: '6px 10px', borderRadius: t.radius.sm, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.danger, fontSize: t.fontSizes.xs, fontFamily: t.fonts.sans, cursor: 'pointer' }}>Delete</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
