import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'


export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [projects, setProjects] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [editingCampaign, setEditingCampaign] = useState(null)
  const [form, setForm] = useState({
    name: '',
    status: 'draft',
    platform: '',
    channel: '',
    goal: '',
    budget: '',
    spend: '',
    start_date: '',
    end_date: '',
    project_id: '',
    description: '',
    results: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const platforms = [
    'Instagram', 'TikTok', 'Facebook', 'LinkedIn',
    'Email', 'Google Ads', 'YouTube', 'Pinterest', 'Other'
  ]

  const statusColors = {
    draft: { bg: '#F7F5F0', color: '#6B7280' },
    active: { bg: '#EAF2EA', color: '#6B8F71' },
    paused: { bg: '#FBF0E6', color: '#D4874E' },
    completed: { bg: '#F0EBF9', color: '#7C5CBF' },
  }

  useEffect(() => {
    fetchCampaigns()
    fetchProjects()
    fetchClients()
  }, [])

  async function fetchCampaigns() {
    setLoading(true)
    const { data, error } = await supabase
      .from('campaigns')
      .select('*, projects(title, clients(name))')
      .order('created_at', { ascending: false })
    if (!error) setCampaigns(data)
    setLoading(false)
  }

  async function fetchProjects() {
    const { data } = await supabase.from('projects').select('id, title')
    if (data) setProjects(data)
  }

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('id, name')
    if (data) setClients(data)
  }

  function openAddForm() {
    setEditingCampaign(null)
    setForm({
      name: '', status: 'draft', platform: '', channel: '', goal: '',
      budget: '', spend: '', start_date: '', end_date: '',
      project_id: '', description: '', results: '',
    })
    setShowForm(true)
  }

  function openEditForm(campaign) {
    setEditingCampaign(campaign)
    setForm({
      name: campaign.name || '',
      status: campaign.status || 'draft',
      platform: campaign.platform || '',
      channel: campaign.channel || '',
      goal: campaign.goal || '',
      budget: campaign.budget || '',
      spend: campaign.spend || '',
      start_date: campaign.start_date || '',
      end_date: campaign.end_date || '',
      project_id: campaign.project_id || '',
      description: campaign.description || '',
      results: campaign.results || '',
    })
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      name: form.name,
      status: form.status,
      platform: form.platform || null,
      channel: form.channel || null,
      goal: form.goal || null,
      budget: form.budget ? parseFloat(form.budget) : null,
      spend: form.spend ? parseFloat(form.spend) : 0,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      project_id: form.project_id || null,
      description: form.description || null,
      results: form.results || null,
    }

    let error
    if (editingCampaign) {
      const result = await supabase.from('campaigns').update(payload).eq('id', editingCampaign.id)
      error = result.error
      if (!error) {
        const updated = { ...editingCampaign, ...payload }
        setSelectedCampaign(updated)
      }
    } else {
      const result = await supabase.from('campaigns').insert({ ...payload, user_id: user.id })
      error = result.error
    }

    if (error) {
      setError(error.message)
    } else {
      setShowForm(false)
      setEditingCampaign(null)
      setForm({
        name: '', status: 'draft', platform: '', channel: '', goal: '',
        budget: '', spend: '', start_date: '', end_date: '',
        project_id: '', description: '', results: '',
      })
      fetchCampaigns()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this campaign?')) return
    await supabase.from('campaigns').delete().eq('id', id)
    fetchCampaigns()
    if (selectedCampaign?.id === id) setSelectedCampaign(null)
  }

  const totalBudget = campaigns.reduce((sum, c) => sum + (parseFloat(c.budget) || 0), 0)
  const totalSpend = campaigns.reduce((sum, c) => sum + (parseFloat(c.spend) || 0), 0)
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length

  // Reusable form fields JSX
  function renderFormFields() {
    return (
      <div style={styles.formGrid}>
        <div style={{ ...styles.field, gridColumn: 'span 2' }}>
          <label style={styles.label}>Campaign name *</label>
          <input
            style={styles.input}
            placeholder="e.g. Spring Wedding Season Push"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Platform</label>
          <select style={styles.input} value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}>
            <option value="">Select platform</option>
            {platforms.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Status</label>
          <select style={styles.input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Budget ($)</label>
          <input style={styles.input} type="number" placeholder="0.00" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Amount spent ($)</label>
          <input style={styles.input} type="number" placeholder="0.00" value={form.spend} onChange={e => setForm({ ...form, spend: e.target.value })} />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Start date</label>
          <input style={styles.input} type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>End date</label>
          <input style={styles.input} type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Project</label>
          <select style={styles.input} value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
            <option value="">No project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Goal</label>
          <input style={styles.input} placeholder="e.g. 10 new leads, 500 reach" value={form.goal} onChange={e => setForm({ ...form, goal: e.target.value })} />
        </div>
        <div style={{ ...styles.field, gridColumn: 'span 2' }}>
          <label style={styles.label}>Description</label>
          <input style={styles.input} placeholder="What is this campaign about?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        <div style={{ ...styles.field, gridColumn: 'span 2' }}>
          <label style={styles.label}>Results</label>
          <input style={styles.input} placeholder="What were the outcomes? (fill in after campaign ends)" value={form.results} onChange={e => setForm({ ...form, results: e.target.value })} />
        </div>
      </div>
    )
  }

  // ── DETAIL / PROFILE VIEW ──────────────────────────────────────────────────
  if (selectedCampaign) {
    const sc = statusColors[selectedCampaign.status] || statusColors.draft
    const budget = parseFloat(selectedCampaign.budget) || 0
    const spend = parseFloat(selectedCampaign.spend) || 0
    const spendPct = budget > 0 ? Math.min((spend / budget) * 100, 100) : 0

    return (
      <div style={styles.page}>
        <div style={styles.detailHeader}>
          <button onClick={() => { setSelectedCampaign(null); setShowForm(false) }} style={styles.backBtn}>
            ← Back to campaigns
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => openEditForm(selectedCampaign)} style={styles.editBtn}>
              Edit campaign
            </button>
            <button onClick={() => handleDelete(selectedCampaign.id)} style={styles.deleteBtn}>
              Delete campaign
            </button>
          </div>
        </div>

        {/* Edit form appears inline when editing from profile */}
        {showForm && editingCampaign && (
          <div style={styles.formCard}>
            <h3 style={styles.formTitle}>Edit Campaign</h3>
            {error && <div style={styles.error}>{error}</div>}
            {renderFormFields()}
            <div style={styles.formActions}>
              <button onClick={() => { setShowForm(false); setError(null) }} style={styles.cancelBtn}>Cancel</button>
              <button onClick={handleSave} style={styles.saveBtn} disabled={saving || !form.name}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        <div style={styles.detailCard}>
          <div style={styles.detailTop}>
            <div>
              <h2 style={styles.detailName}>{selectedCampaign.name}</h2>
              {selectedCampaign.projects && (
                <p style={styles.detailSub}>
                  {selectedCampaign.projects.title}
                  {selectedCampaign.projects.clients?.name
                    ? ` · ${selectedCampaign.projects.clients.name}`
                    : ''}
                </p>
              )}
            </div>
            <div style={{ ...styles.statusBadge, backgroundColor: sc.bg, color: sc.color }}>
              {selectedCampaign.status}
            </div>
          </div>

          {selectedCampaign.description && (
            <p style={styles.description}>{selectedCampaign.description}</p>
          )}

          <div style={styles.budgetSection}>
            <div style={styles.budgetRow}>
              <span style={styles.budgetLabel}>Budget</span>
              <span style={styles.budgetValue}>${budget.toLocaleString()}</span>
            </div>
            <div style={styles.budgetRow}>
              <span style={styles.budgetLabel}>Spent</span>
<span style={{ ...styles.budgetValue, color: spendPct > 90 ? t.colors.danger : t.colors.textPrimary }}>  
                ${spend.toLocaleString()}
              </span>
            </div>
            <div style={styles.progressBar}>
              <div style={{
                ...styles.progressFill,
                width: `${spendPct}%`,
backgroundColor: spendPct > 90 ? t.colors.danger : t.colors.primary,
              }} />
            </div>
            <div style={styles.budgetMeta}>
              {spendPct.toFixed(0)}% of budget used · ${(budget - spend).toLocaleString()} remaining
            </div>
          </div>

          <div style={styles.detailGrid}>
            {selectedCampaign.platform && (
              <div style={styles.detailField}>
                <div style={styles.detailFieldLabel}>Platform</div>
                <div style={styles.detailFieldValue}>{selectedCampaign.platform}</div>
              </div>
            )}
            {selectedCampaign.goal && (
              <div style={styles.detailField}>
                <div style={styles.detailFieldLabel}>Goal</div>
                <div style={styles.detailFieldValue}>{selectedCampaign.goal}</div>
              </div>
            )}
            {selectedCampaign.start_date && (
              <div style={styles.detailField}>
                <div style={styles.detailFieldLabel}>Start date</div>
                <div style={styles.detailFieldValue}>
                  {new Date(selectedCampaign.start_date).toLocaleDateString()}
                </div>
              </div>
            )}
            {selectedCampaign.end_date && (
              <div style={styles.detailField}>
                <div style={styles.detailFieldLabel}>End date</div>
                <div style={styles.detailFieldValue}>
                  {new Date(selectedCampaign.end_date).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>

          {selectedCampaign.results && (
            <div style={styles.resultsSection}>
              <div style={styles.detailFieldLabel}>Results</div>
              <p style={styles.resultsText}>{selectedCampaign.results}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── MAIN LIST VIEW ─────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Campaigns</h2>
          <p style={styles.subtitle}>{campaigns.length} total campaigns</p>
        </div>
        <button onClick={openAddForm} style={styles.addBtn}>
          + New Campaign
        </button>
      </div>

      <div style={styles.summaryRow}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Active campaigns</div>
<div style={{ ...styles.summaryValue, color: t.colors.primary }}>{activeCampaigns}</div>        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total budget</div>
          <div style={styles.summaryValue}>${totalBudget.toLocaleString()}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total spent</div>
<div style={{ ...styles.summaryValue, color: t.colors.warning }}>${totalSpend.toLocaleString()}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Remaining</div>
          <div style={styles.summaryValue}>${(totalBudget - totalSpend).toLocaleString()}</div>
        </div>
      </div>

      {showForm && !editingCampaign && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>New Campaign</h3>
          {error && <div style={styles.error}>{error}</div>}
          {renderFormFields()}
          <div style={styles.formActions}>
            <button onClick={() => { setShowForm(false); setError(null) }} style={styles.cancelBtn}>Cancel</button>
            <button onClick={handleSave} style={styles.saveBtn} disabled={saving || !form.name}>
              {saving ? 'Saving...' : 'Save Campaign'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.empty}>Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📣</div>
          <h3 style={styles.emptyTitle}>No campaigns yet</h3>
          <p style={styles.emptyText}>Create your first campaign to start tracking marketing efforts</p>
          <button onClick={openAddForm} style={styles.addBtn}>+ New Campaign</button>
        </div>
      ) : (
        <div style={styles.cardGrid}>
          {campaigns.map(campaign => {
            const sc = statusColors[campaign.status] || statusColors.draft
            const budget = parseFloat(campaign.budget) || 0
            const spend = parseFloat(campaign.spend) || 0
            const spendPct = budget > 0 ? Math.min((spend / budget) * 100, 100) : 0
            return (
              <div key={campaign.id} style={styles.campaignCard} onClick={() => setSelectedCampaign(campaign)}>
                <div style={styles.campaignCardTop}>
                  <div style={{ ...styles.statusBadge, backgroundColor: sc.bg, color: sc.color }}>
                    {campaign.status}
                  </div>
                  {campaign.platform && (
                    <div style={styles.platformBadge}>{campaign.platform}</div>
                  )}
                </div>
                <div style={styles.campaignName}>{campaign.name}</div>
                {campaign.projects && (
                  <div style={styles.campaignProject}>📋 {campaign.projects.title}</div>
                )}
                {campaign.goal && (
                  <div style={styles.campaignGoal}>🎯 {campaign.goal}</div>
                )}
                {budget > 0 && (
                  <div style={styles.campaignBudget}>
                    <div style={styles.budgetNumbers}>
                      <span style={styles.spendAmt}>${spend.toLocaleString()} spent</span>
                      <span style={styles.budgetAmt}>of ${budget.toLocaleString()}</span>
                    </div>
                    <div style={styles.progressBar}>
                      <div style={{
                        ...styles.progressFill,
                        width: `${spendPct}%`,
backgroundColor: spendPct > 90 ? t.colors.danger : t.colors.primary,
                      }} />
                    </div>
                  </div>
                )}
                {campaign.start_date && campaign.end_date && (
                  <div style={styles.campaignDates}>
                    {new Date(campaign.start_date).toLocaleDateString()} →{' '}
                    {new Date(campaign.end_date).toLocaleDateString()}
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

const styles = {
  page: { padding: '32px', fontFamily: t.fonts.sans },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  title: { fontSize: '22px', fontWeight: '800', color: t.colors.textPrimary, margin: 0, fontFamily: t.fonts.heading, letterSpacing: '-0.02em' },
  subtitle: { fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '4px 0 0' },
  addBtn: { padding: '10px 18px', borderRadius: t.radius.md, border: 'none', backgroundColor: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans },
  editBtn: { padding: '8px 14px', borderRadius: t.radius.md, border: `1px solid ${t.colors.primary}`, backgroundColor: t.colors.bgCard, color: t.colors.primary, fontSize: t.fontSizes.base, cursor: 'pointer', fontFamily: t.fonts.sans, fontWeight: '500' },
  summaryRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' },
  summaryCard: { backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '20px 24px', border: `1px solid ${t.colors.border}` },
  summaryLabel: { fontSize: t.fontSizes.sm, color: t.colors.textTertiary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '500' },
  summaryValue: { fontSize: '26px', fontWeight: '800', color: t.colors.textPrimary, fontFamily: t.fonts.heading, letterSpacing: '-0.02em' },
  formCard: { backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.border}`, marginBottom: '24px' },
  formTitle: { fontSize: t.fontSizes.lg, fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 20px', fontFamily: t.fonts.heading, letterSpacing: '-0.01em' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary },
  input: { padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, color: t.colors.textPrimary, outline: 'none', backgroundColor: t.colors.bgCard, fontFamily: t.fonts.sans },
  formActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  cancelBtn: { padding: '9px 16px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: t.fontSizes.base, cursor: 'pointer', fontFamily: t.fonts.sans },
  saveBtn: { padding: '9px 16px', borderRadius: t.radius.md, border: 'none', backgroundColor: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans },
  error: { padding: '10px 14px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.base, marginBottom: '16px' },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
  campaignCard: { backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '20px', border: `1px solid ${t.colors.border}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '10px', transition: 'border-color 0.15s' },
  campaignCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { display: 'inline-block', padding: '3px 10px', borderRadius: t.radius.full, fontSize: t.fontSizes.sm, fontWeight: '500' },
  platformBadge: { fontSize: t.fontSizes.xs, color: t.colors.textTertiary, backgroundColor: t.colors.bg, padding: '3px 8px', borderRadius: t.radius.full },
  campaignName: { fontSize: t.fontSizes.md, fontWeight: '600', color: t.colors.textPrimary },
  campaignProject: { fontSize: t.fontSizes.sm, color: t.colors.textTertiary },
  campaignGoal: { fontSize: t.fontSizes.sm, color: t.colors.textSecondary },
  campaignBudget: { display: 'flex', flexDirection: 'column', gap: '6px' },
  budgetNumbers: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  spendAmt: { fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary },
  budgetAmt: { fontSize: t.fontSizes.xs, color: t.colors.textTertiary },
  progressBar: { height: '4px', backgroundColor: t.colors.border, borderRadius: '2px', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: '2px', transition: 'width 0.3s ease' },
  campaignDates: { fontSize: t.fontSizes.xs, color: t.colors.textTertiary },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}` },
  emptyIcon: { fontSize: '40px', marginBottom: '16px' },
  emptyTitle: { fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px', fontFamily: t.fonts.heading },
  emptyText: { fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '0 0 24px' },
  empty: { fontSize: t.fontSizes.base, color: t.colors.textTertiary, padding: '40px', textAlign: 'center' },
  detailHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '24px' },
  backBtn: { padding: '8px 14px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: t.fontSizes.base, cursor: 'pointer', fontFamily: t.fonts.sans },
  deleteBtn: { padding: '8px 14px', borderRadius: t.radius.md, border: 'none', backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.base, cursor: 'pointer', fontFamily: t.fonts.sans, fontWeight: '500' },
  detailCard: { backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '32px', border: `1px solid ${t.colors.border}` },
  detailTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' },
  detailName: { fontSize: '24px', fontWeight: '800', color: t.colors.textPrimary, margin: '0 0 4px', fontFamily: t.fonts.heading, letterSpacing: '-0.02em' },
  detailSub: { fontSize: t.fontSizes.md, color: t.colors.textSecondary, margin: 0 },
  description: { fontSize: t.fontSizes.md, color: t.colors.textSecondary, lineHeight: '1.6', margin: '0 0 24px' },
  budgetSection: { backgroundColor: t.colors.bg, borderRadius: t.radius.md, padding: '20px', marginBottom: '24px' },
  budgetRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
  budgetLabel: { fontSize: t.fontSizes.base, color: t.colors.textTertiary },
  budgetValue: { fontSize: t.fontSizes.base, fontWeight: '600', color: t.colors.textPrimary },
  budgetMeta: { fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '8px', textAlign: 'right' },
  detailGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' },
  detailField: { backgroundColor: t.colors.bg, borderRadius: t.radius.md, padding: '14px 16px' },
  detailFieldLabel: { fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.06em' },
  detailFieldValue: { fontSize: t.fontSizes.md, color: t.colors.textPrimary },
  resultsSection: { backgroundColor: t.colors.successLight, borderRadius: t.radius.md, padding: '20px' },
  resultsText: { fontSize: t.fontSizes.md, color: t.colors.textPrimary, margin: '8px 0 0', lineHeight: '1.6' },
}