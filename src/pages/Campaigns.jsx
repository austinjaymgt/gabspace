import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

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
    draft: { bg: '#f5f5f0', color: '#888' },
    active: { bg: '#f0faf6', color: '#1D9E75' },
    paused: { bg: '#fff8f0', color: '#cc7700' },
    completed: { bg: '#f0f4ff', color: '#4466cc' },
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
              <span style={{ ...styles.budgetValue, color: spendPct > 90 ? '#cc3333' : '#1a1a1a' }}>
                ${spend.toLocaleString()}
              </span>
            </div>
            <div style={styles.progressBar}>
              <div style={{
                ...styles.progressFill,
                width: `${spendPct}%`,
                backgroundColor: spendPct > 90 ? '#cc3333' : '#1D9E75',
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
          <div style={{ ...styles.summaryValue, color: '#1D9E75' }}>{activeCampaigns}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total budget</div>
          <div style={styles.summaryValue}>${totalBudget.toLocaleString()}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total spent</div>
          <div style={{ ...styles.summaryValue, color: '#cc7700' }}>${totalSpend.toLocaleString()}</div>
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
                        backgroundColor: spendPct > 90 ? '#cc3333' : '#1D9E75',
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
  page: { padding: '32px' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px',
  },
  title: { fontSize: '20px', fontWeight: '700', color: '#1a1a1a', margin: 0 },
  subtitle: { fontSize: '13px', color: '#999', margin: '4px 0 0' },
  addBtn: {
    padding: '10px 18px', borderRadius: '8px', border: 'none',
    backgroundColor: '#1D9E75', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
  },
  editBtn: {
    padding: '8px 14px', borderRadius: '8px', border: '1px solid #1D9E75',
    backgroundColor: '#fff', color: '#1D9E75', fontSize: '13px', cursor: 'pointer',
  },
  summaryRow: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px',
  },
  summaryCard: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '20px 24px', border: '1px solid #f0f0eb',
  },
  summaryLabel: { fontSize: '12px', color: '#999', marginBottom: '6px' },
  summaryValue: { fontSize: '24px', fontWeight: '700', color: '#1a1a1a' },
  formCard: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '24px',
    border: '1px solid #f0f0eb', marginBottom: '24px',
  },
  formTitle: { fontSize: '16px', fontWeight: '600', color: '#1a1a1a', margin: '0 0 20px' },
  formGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '500', color: '#666' },
  input: {
    padding: '9px 12px', borderRadius: '8px', border: '1px solid #e0e0e0',
    fontSize: '13px', color: '#1a1a1a', outline: 'none', backgroundColor: '#fff',
  },
  formActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  cancelBtn: {
    padding: '9px 16px', borderRadius: '8px', border: '1px solid #e0e0e0',
    backgroundColor: '#fff', color: '#666', fontSize: '13px', cursor: 'pointer',
  },
  saveBtn: {
    padding: '9px 16px', borderRadius: '8px', border: 'none',
    backgroundColor: '#1D9E75', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
  },
  error: {
    padding: '10px 14px', borderRadius: '8px', backgroundColor: '#fff0f0',
    color: '#cc3333', fontSize: '13px', marginBottom: '16px',
  },
  cardGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px',
  },
  campaignCard: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '20px',
    border: '1px solid #f0f0eb', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '10px',
  },
  campaignCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: {
    display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500',
  },
  platformBadge: {
    fontSize: '11px', color: '#888', backgroundColor: '#f5f5f0', padding: '3px 8px', borderRadius: '20px',
  },
  campaignName: { fontSize: '15px', fontWeight: '600', color: '#1a1a1a' },
  campaignProject: { fontSize: '12px', color: '#999' },
  campaignGoal: { fontSize: '12px', color: '#666' },
  campaignBudget: { display: 'flex', flexDirection: 'column', gap: '6px' },
  budgetNumbers: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  spendAmt: { fontSize: '12px', fontWeight: '600', color: '#1a1a1a' },
  budgetAmt: { fontSize: '11px', color: '#aaa' },
  progressBar: { height: '4px', backgroundColor: '#f0f0eb', borderRadius: '2px', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: '2px', transition: 'width 0.3s ease' },
  campaignDates: { fontSize: '11px', color: '#bbb' },
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '80px 20px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #f0f0eb',
  },
  emptyIcon: { fontSize: '40px', marginBottom: '16px' },
  emptyTitle: { fontSize: '16px', fontWeight: '600', color: '#1a1a1a', margin: '0 0 8px' },
  emptyText: { fontSize: '13px', color: '#999', margin: '0 0 24px' },
  empty: { fontSize: '13px', color: '#999', padding: '40px', textAlign: 'center' },
  detailHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '24px' },
  backBtn: {
    padding: '8px 14px', borderRadius: '8px', border: '1px solid #e0e0e0',
    backgroundColor: '#fff', color: '#555', fontSize: '13px', cursor: 'pointer',
  },
  deleteBtn: {
    padding: '8px 14px', borderRadius: '8px', border: 'none',
    backgroundColor: '#fff0f0', color: '#cc3333', fontSize: '13px', cursor: 'pointer',
  },
  detailCard: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '32px', border: '1px solid #f0f0eb',
  },
  detailTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' },
  detailName: { fontSize: '22px', fontWeight: '700', color: '#1a1a1a', margin: '0 0 4px' },
  detailSub: { fontSize: '14px', color: '#999', margin: 0 },
  description: { fontSize: '14px', color: '#555', lineHeight: '1.6', margin: '0 0 24px' },
  budgetSection: { backgroundColor: '#fafaf8', borderRadius: '10px', padding: '20px', marginBottom: '24px' },
  budgetRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
  budgetLabel: { fontSize: '13px', color: '#888' },
  budgetValue: { fontSize: '13px', fontWeight: '600', color: '#1a1a1a' },
  budgetMeta: { fontSize: '11px', color: '#aaa', marginTop: '8px', textAlign: 'right' },
  detailGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' },
  detailField: { backgroundColor: '#fafaf8', borderRadius: '8px', padding: '14px 16px' },
  detailFieldLabel: {
    fontSize: '11px', color: '#aaa', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px',
  },
  detailFieldValue: { fontSize: '14px', color: '#1a1a1a' },
  resultsSection: { backgroundColor: '#f0faf6', borderRadius: '10px', padding: '20px' },
  resultsText: { fontSize: '14px', color: '#1a1a1a', margin: '8px 0 0', lineHeight: '1.6' },
}