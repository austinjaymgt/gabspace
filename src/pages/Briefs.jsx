import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import CurrencyInput from '../components/CurrencyInput'

const STATUS_OPTIONS = ['draft', 'shared', 'approved']
const statusStyles = {
  draft: { bg: '#F3F3F3', color: '#6B7280', label: 'Draft' },
  shared: { bg: '#F0E8FB', color: '#7B2FBE', label: 'Shared' },
  approved: { bg: '#F0FBE0', color: '#3B6D11', label: 'Approved' },
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function Briefs({ workspaceId, userRole, session }) {
  const [briefs, setBriefs] = useState([])
  const [packages, setPackages] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list') // list | form | detail
  const [selectedBrief, setSelectedBrief] = useState(null)
  const [editingBrief, setEditingBrief] = useState(null)
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [packageTimeline, setPackageTimeline] = useState([])

  const [form, setForm] = useState({
    package_id: '',
    project_id: '',
    event_name: '',
    event_type: '',
    event_date: '',
    venue: '',
    headcount: '',
    budget_tier: '',
    budget_amount: '',
    vendor_notes: '',
    merch_notes: '',
    creative_notes: '',
    status: 'draft',
  })

  useEffect(() => {
    if (workspaceId) fetchAll()
  }, [workspaceId])

  async function fetchAll() {
    setLoading(true)
    const [briefsRes, packagesRes, projectsRes] = await Promise.all([
      supabase.from('event_briefs').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('event_packages').select('*').eq('workspace_id', workspaceId).order('name'),
      supabase.from('projects').select('id, title').eq('workspace_id', workspaceId).order('title'),
    ])
    setBriefs(briefsRes.data || [])
    setPackages(packagesRes.data || [])
    setProjects(projectsRes.data || [])
    setLoading(false)
  }

  async function fetchPackageTimeline(packageId) {
    const { data } = await supabase
      .from('package_timeline')
      .select('*')
      .eq('package_id', packageId)
      .order('days_out', { ascending: false })
    setPackageTimeline(data || [])
  }

  async function handlePackageSelect(packageId) {
    setForm(f => ({ ...f, package_id: packageId }))
    if (!packageId) {
      setSelectedPackage(null)
      setPackageTimeline([])
      return
    }
    const pkg = packages.find(p => p.id === packageId)
    setSelectedPackage(pkg)
    await fetchPackageTimeline(packageId)
    // Pre-fill from package
    if (pkg) {
      setForm(f => ({
        ...f,
        event_type: pkg.event_type || f.event_type,
        vendor_notes: pkg.vendor_categories?.join(', ') || f.vendor_notes,
        merch_notes: pkg.merch_notes || f.merch_notes,
        budget_amount: pkg.budget_mid || f.budget_amount,
        budget_tier: 'mid',
      }))
    }
  }

  async function saveBrief() {
    if (!form.event_name) return
    const payload = {
      workspace_id: workspaceId,
      package_id: form.package_id || null,
      project_id: form.project_id || null,
      event_name: form.event_name,
      event_type: form.event_type,
      event_date: form.event_date || null,
      venue: form.venue,
      headcount: Number(form.headcount) || null,
      budget_tier: form.budget_tier,
      budget_amount: Number(form.budget_amount) || 0,
      vendor_notes: form.vendor_notes,
      merch_notes: form.merch_notes,
      creative_notes: form.creative_notes,
      timeline_overrides: packageTimeline,
      status: form.status,
      created_by: session?.user?.id,
    }

    if (editingBrief) {
      await supabase.from('event_briefs').update(payload).eq('id', editingBrief.id)
    } else {
      await supabase.from('event_briefs').insert(payload)
    }
    resetForm()
    fetchAll()
  }

  async function deleteBrief(id) {
    await supabase.from('event_briefs').delete().eq('id', id)
    fetchAll()
    if (selectedBrief?.id === id) {
      setView('list')
      setSelectedBrief(null)
    }
  }

  async function updateStatus(id, status) {
    await supabase.from('event_briefs').update({ status }).eq('id', id)
    setBriefs(prev => prev.map(b => b.id === id ? { ...b, status } : b))
    if (selectedBrief?.id === id) setSelectedBrief(b => ({ ...b, status }))
  }

  function startEdit(brief) {
    setEditingBrief(brief)
    setForm({
      package_id: brief.package_id || '',
      project_id: brief.project_id || '',
      event_name: brief.event_name,
      event_type: brief.event_type || '',
      event_date: brief.event_date || '',
      venue: brief.venue || '',
      headcount: brief.headcount || '',
      budget_tier: brief.budget_tier || '',
      budget_amount: brief.budget_amount || '',
      vendor_notes: brief.vendor_notes || '',
      merch_notes: brief.merch_notes || '',
      creative_notes: brief.creative_notes || '',
      status: brief.status || 'draft',
    })
    if (brief.package_id) {
      const pkg = packages.find(p => p.id === brief.package_id)
      setSelectedPackage(pkg)
      fetchPackageTimeline(brief.package_id)
    }
    setView('form')
  }

  function startNew(preselectedPackage) {
    setEditingBrief(null)
    setForm({
      package_id: preselectedPackage?.id || '',
      project_id: '',
      event_name: preselectedPackage?.name || '',
      event_type: preselectedPackage?.event_type || '',
      event_date: '',
      venue: '',
      headcount: '',
      budget_tier: 'mid',
      budget_amount: preselectedPackage?.budget_mid || '',
      vendor_notes: preselectedPackage?.vendor_categories?.join(', ') || '',
      merch_notes: preselectedPackage?.merch_notes || '',
      creative_notes: '',
      status: 'draft',
    })
    if (preselectedPackage) {
      setSelectedPackage(preselectedPackage)
      fetchPackageTimeline(preselectedPackage.id)
    } else {
      setSelectedPackage(null)
      setPackageTimeline([])
    }
    setView('form')
  }

  function resetForm() {
    setView('list')
    setEditingBrief(null)
    setSelectedPackage(null)
    setPackageTimeline([])
    setForm({
      package_id: '', project_id: '', event_name: '', event_type: '',
      event_date: '', venue: '', headcount: '', budget_tier: '',
      budget_amount: '', vendor_notes: '', merch_notes: '',
      creative_notes: '', status: 'draft',
    })
  }

  function exportPDF(brief) {
    const pkg = packages.find(p => p.id === brief.package_id)
    const proj = projects.find(p => p.id === brief.project_id)
    const timeline = brief.timeline_overrides || []
    const s = statusStyles[brief.status] || statusStyles.draft

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${brief.event_name} — Event Brief</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', sans-serif; color: #0E0E0E; background: #fff; padding: 48px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #0E0E0E; }
    .wordmark { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: #7B2FBE; letter-spacing: -0.02em; }
    .tagline { font-size: 11px; color: #9CA3AF; margin-top: 2px; }
    .doc-label { font-size: 11px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; text-align: right; }
    .date { font-size: 13px; color: #6B7280; margin-top: 2px; text-align: right; }
    h1 { font-family: 'Syne', sans-serif; font-size: 32px; font-weight: 800; letter-spacing: -0.02em; color: #0E0E0E; margin-bottom: 8px; }
    .meta { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 32px; }
    .badge { font-size: 11px; font-weight: 500; padding: 4px 12px; border-radius: 100px; background: #F0E8FB; color: #7B2FBE; }
    .badge.status { background: ${s.bg}; color: ${s.color}; }
    .section { margin-bottom: 28px; }
    .section-label { font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #9CA3AF; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #E8E8E8; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .field-label { font-size: 11px; color: #9CA3AF; margin-bottom: 3px; }
    .field-value { font-size: 14px; font-weight: 500; color: #0E0E0E; }
    .budget-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .budget-box { text-align: center; padding: 12px; background: #F7F7F7; border-radius: 8px; }
    .budget-tier { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #9CA3AF; margin-bottom: 4px; }
    .budget-val { font-size: 18px; font-weight: 700; color: #0E0E0E; }
    .budget-selected { background: #F0E8FB; }
    .budget-selected .budget-val { color: #7B2FBE; }
    .timeline-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #F2F2F2; }
    .days-badge { font-size: 11px; font-weight: 600; color: #7B2FBE; background: #F0E8FB; padding: 3px 8px; border-radius: 100px; white-space: nowrap; min-width: 56px; text-align: center; }
    .timeline-task { font-size: 13px; color: #0E0E0E; flex: 1; }
    .timeline-owner { font-size: 11px; color: #9CA3AF; }
    .notes-box { background: #F7F7F7; border-radius: 8px; padding: 14px; font-size: 13px; color: #3D3D3D; line-height: 1.65; }
    .vendor-tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .vendor-tag { font-size: 11px; background: #F0E8FB; color: #7B2FBE; padding: 4px 10px; border-radius: 100px; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #E8E8E8; display: flex; justify-content: space-between; font-size: 11px; color: #9CA3AF; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="wordmark">gabspace</div>
      <div class="tagline">where events meet excellence.</div>
    </div>
    <div>
      <div class="doc-label">Event Brief</div>
      <div class="date">Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    </div>
  </div>

  <h1>${brief.event_name}</h1>
  <div class="meta">
    ${brief.event_type ? `<span class="badge">${brief.event_type}</span>` : ''}
    <span class="badge status">${s.label}</span>
    ${pkg ? `<span class="badge" style="background:#F7F7F7;color:#6B7280;">Based on: ${pkg.name}</span>` : ''}
  </div>

  <div class="section">
    <div class="section-label">Event Details</div>
    <div class="grid">
      ${brief.event_date ? `<div><div class="field-label">Date</div><div class="field-value">${new Date(brief.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div></div>` : ''}
      ${brief.venue ? `<div><div class="field-label">Venue</div><div class="field-value">${brief.venue}</div></div>` : ''}
      ${brief.headcount ? `<div><div class="field-label">Headcount</div><div class="field-value">${Number(brief.headcount).toLocaleString()} guests</div></div>` : ''}
      ${proj ? `<div><div class="field-label">Linked Project</div><div class="field-value">${proj.title}</div></div>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-label">Budget</div>
    ${pkg ? `
    <div class="budget-grid" style="margin-bottom:12px;">
      <div class="budget-box ${brief.budget_tier === 'low' ? 'budget-selected' : ''}">
        <div class="budget-tier">Low</div>
        <div class="budget-val">${fmt(pkg.budget_low)}</div>
      </div>
      <div class="budget-box ${brief.budget_tier === 'mid' ? 'budget-selected' : ''}">
        <div class="budget-tier">Mid</div>
        <div class="budget-val">${fmt(pkg.budget_mid)}</div>
      </div>
      <div class="budget-box ${brief.budget_tier === 'high' ? 'budget-selected' : ''}">
        <div class="budget-tier">High</div>
        <div class="budget-val">${fmt(pkg.budget_high)}</div>
      </div>
    </div>` : ''}
    <div><div class="field-label">Approved Budget</div><div class="field-value" style="font-size:20px;font-weight:700;color:#7B2FBE;">${fmt(brief.budget_amount)}</div></div>
  </div>

  ${brief.vendor_notes ? `
  <div class="section">
    <div class="section-label">Vendor Categories</div>
    <div class="vendor-tags">
      ${brief.vendor_notes.split(',').map(v => `<span class="vendor-tag">${v.trim()}</span>`).join('')}
    </div>
  </div>` : ''}

  ${brief.merch_notes ? `
  <div class="section">
    <div class="section-label">Merch & Swag</div>
    <div class="notes-box">${brief.merch_notes}</div>
  </div>` : ''}

  ${brief.creative_notes ? `
  <div class="section">
    <div class="section-label">Creative Notes</div>
    <div class="notes-box">${brief.creative_notes}</div>
  </div>` : ''}

  ${timeline.length > 0 ? `
  <div class="section">
    <div class="section-label">Planning Timeline</div>
    ${[...timeline].sort((a, b) => b.days_out - a.days_out).map(item => `
    <div class="timeline-item">
      <span class="days-badge">${item.days_out === 0 ? 'Day of' : `${item.days_out}d out`}</span>
      <span class="timeline-task">${item.task}</span>
      ${item.owner_role ? `<span class="timeline-owner">${item.owner_role}</span>` : ''}
    </div>`).join('')}
  </div>` : ''}

  <div class="footer">
    <span>gabspace — Creativity meets clarity</span>
    <span>Confidential · Internal Use Only</span>
  </div>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    setTimeout(() => {
      win?.print()
      URL.revokeObjectURL(url)
    }, 800)
  }

  // ── FORM VIEW ──
  if (view === 'form') {
    return (
      <div style={{ padding: '32px 40px', fontFamily: t.fonts.sans, maxWidth: '800px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.colors.textTertiary, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans }}>← Back</button>
          <h1 style={{ fontFamily: t.fonts.heading, fontSize: '24px', fontWeight: '800', color: t.colors.textPrimary, letterSpacing: '-0.02em', margin: 0 }}>
            {editingBrief ? 'Edit Brief' : 'New Brief'}
          </h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Package selection */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px' }}>
            <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '16px' }}>Package Template</div>
            <div>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Based on package</label>
              <select value={form.package_id} onChange={e => handlePackageSelect(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }}>
                <option value="">No package — start from scratch</option>
                {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {selectedPackage && (
              <div style={{ marginTop: '12px', padding: '12px', background: t.colors.primaryLight, borderRadius: t.radius.md, fontSize: t.fontSizes.sm, color: t.colors.primary }}>
                ✓ Pre-filled from <strong>{selectedPackage.name}</strong> — edit any field below
              </div>
            )}
          </div>

          {/* Event details */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px' }}>
            <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '16px' }}>Event Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Event Name *</label>
                <input value={form.event_name} onChange={e => setForm(f => ({ ...f, event_name: e.target.value }))} placeholder="e.g. PrizePicks House x NBA Finals" style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }} />
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Event Track</label>
                <select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }}>
                  <option value="">Select track</option>
                  {['External', 'Internal', 'F&F'].map(tr => <option key={tr} value={tr}>{tr}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Event Date</label>
                <input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }} />
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Venue</label>
                <input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} placeholder="Venue name or TBD" style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }} />
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Headcount</label>
                <input type="number" value={form.headcount} onChange={e => setForm(f => ({ ...f, headcount: e.target.value }))} placeholder="e.g. 200" style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }} />
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Link to Project</label>
                <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }}>
                  <option value="">No project link</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Budget */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px' }}>
            <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '16px' }}>Budget</div>
            {selectedPackage && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                {['low', 'mid', 'high'].map(tier => (
                  <button key={tier} onClick={() => setForm(f => ({ ...f, budget_tier: tier, budget_amount: selectedPackage[`budget_${tier}`] || '' }))}
                    style={{ padding: '12px', borderRadius: t.radius.md, border: `2px solid ${form.budget_tier === tier ? t.colors.primary : t.colors.border}`, background: form.budget_tier === tier ? t.colors.primaryLight : t.colors.bg, cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ fontSize: t.fontSizes.xs, textTransform: 'uppercase', letterSpacing: '0.08em', color: form.budget_tier === tier ? t.colors.primary : t.colors.textTertiary, marginBottom: '4px' }}>{tier}</div>
                    <div style={{ fontSize: t.fontSizes.lg, fontWeight: '700', color: form.budget_tier === tier ? t.colors.primary : t.colors.textPrimary }}>{fmt(selectedPackage[`budget_${tier}`])}</div>
                  </button>
                ))}
              </div>
            )}
            <div>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Approved Budget Amount</label>
              <CurrencyInput value={form.budget_amount} onChange={val => setForm(f => ({ ...f, budget_amount: val }))} />
            </div>
          </div>

          {/* Notes */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px' }}>
            <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '16px' }}>Brief Notes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Vendor Notes</label>
                <textarea value={form.vendor_notes} onChange={e => setForm(f => ({ ...f, vendor_notes: e.target.value }))} placeholder="Vendor categories, specific requirements, preferred partners..." rows={2} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', resize: 'vertical', color: t.colors.textPrimary }} />
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Merch & Swag Notes</label>
                <textarea value={form.merch_notes} onChange={e => setForm(f => ({ ...f, merch_notes: e.target.value }))} placeholder="Merch items, quantities, drop timing..." rows={2} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', resize: 'vertical', color: t.colors.textPrimary }} />
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Creative Notes</label>
                <textarea value={form.creative_notes} onChange={e => setForm(f => ({ ...f, creative_notes: e.target.value }))} placeholder="Creative direction, campaign linkage, brand goals..." rows={2} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', resize: 'vertical', color: t.colors.textPrimary }} />
              </div>
            </div>
          </div>

          {/* Timeline preview */}
          {packageTimeline.length > 0 && (
            <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px' }}>
              <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '14px' }}>Planning Timeline (from package)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[...packageTimeline].sort((a, b) => b.days_out - a.days_out).map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: t.colors.bg, borderRadius: t.radius.md }}>
                    <span style={{ fontSize: t.fontSizes.xs, fontWeight: '600', color: t.colors.primary, background: t.colors.primaryLight, padding: '2px 8px', borderRadius: t.radius.full, whiteSpace: 'nowrap' }}>
                      {item.days_out === 0 ? 'Day of' : `${item.days_out}d out`}
                    </span>
                    <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textPrimary, flex: 1 }}>{item.task}</span>
                    {item.owner_role && <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{item.owner_role}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status & save */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px' }}>
            <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '16px' }}>Status</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {STATUS_OPTIONS.map(s => {
                const st = statusStyles[s]
                return (
                  <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))}
                    style={{ padding: '7px 16px', borderRadius: t.radius.full, border: `2px solid ${form.status === s ? st.color : t.colors.border}`, background: form.status === s ? st.bg : 'transparent', color: form.status === s ? st.color : t.colors.textSecondary, fontSize: t.fontSizes.sm, fontWeight: '500', fontFamily: t.fonts.sans, cursor: 'pointer' }}>
                    {st.label}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={saveBrief} style={{ padding: '11px 28px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.md, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>
                {editingBrief ? 'Save Changes' : 'Create Brief'}
              </button>
              <button onClick={resetForm} style={{ padding: '11px 20px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.md, fontFamily: t.fonts.sans, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── LIST VIEW ──
  return (
    <div style={{ padding: '32px 40px', fontFamily: t.fonts.sans }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
<div style={{ fontSize: t.fontSizes.xs, fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.primary, marginBottom: '6px' }}>Toolkit</div>
          <h1 style={{ fontFamily: t.fonts.heading, fontSize: '28px', fontWeight: '800', color: t.colors.textPrimary, letterSpacing: '-0.02em', margin: 0 }}>Event Briefs</h1>
        </div>
        <button onClick={() => startNew(null)} style={{ padding: '9px 18px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>
          + New Brief
        </button>
      </div>

      {loading ? (
        <div style={{ color: t.colors.textTertiary, textAlign: 'center', padding: '60px' }}>Loading briefs...</div>
      ) : briefs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}` }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
          <div style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, marginBottom: '6px' }}>No briefs yet</div>
          <div style={{ fontSize: t.fontSizes.base, color: t.colors.textSecondary, marginBottom: '16px' }}>Generate a brief from a package or start from scratch.</div>
          <button onClick={() => startNew(null)} style={{ padding: '10px 24px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>
            Create Brief
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {briefs.map(brief => {
            const s = statusStyles[brief.status] || statusStyles.draft
            const pkg = packages.find(p => p.id === brief.package_id)
            const proj = projects.find(p => p.id === brief.project_id)
            return (
              <div key={brief.id} style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: t.fontSizes.md, fontWeight: '600', color: t.colors.textPrimary }}>{brief.event_name}</span>
                    <span style={{ fontSize: t.fontSizes.xs, fontWeight: '500', background: s.bg, color: s.color, padding: '2px 10px', borderRadius: t.radius.full }}>{s.label}</span>
                    {brief.event_type && <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, background: t.colors.bg, padding: '2px 8px', borderRadius: t.radius.full }}>{brief.event_type}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {pkg && <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>📦 {pkg.name}</span>}
                    {brief.event_date && <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>📅 {new Date(brief.event_date).toLocaleDateString()}</span>}
                    {brief.budget_amount > 0 && <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>💰 {fmt(brief.budget_amount)}</span>}
                    {proj && <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>🔗 {proj.title}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <select
                    value={brief.status}
                    onChange={e => updateStatus(brief.id, e.target.value)}
                    style={{ padding: '5px 10px', borderRadius: t.radius.sm, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.xs, fontFamily: t.fonts.sans, color: t.colors.textPrimary, background: t.colors.bgCard }}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{statusStyles[s].label}</option>)}
                  </select>
                  <button onClick={() => startEdit(brief)} style={{ padding: '6px 12px', borderRadius: t.radius.sm, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.xs, fontFamily: t.fonts.sans, cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => exportPDF(brief)} style={{ padding: '6px 12px', borderRadius: t.radius.sm, border: 'none', background: t.colors.nav, color: '#fff', fontSize: t.fontSizes.xs, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>↓ PDF</button>
                  <button onClick={() => deleteBrief(brief.id)} style={{ padding: '6px 10px', borderRadius: t.radius.sm, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.danger, fontSize: t.fontSizes.xs, fontFamily: t.fonts.sans, cursor: 'pointer' }}>Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
