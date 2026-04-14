import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import CurrencyInput from '../components/CurrencyInput'

const PRESET_TYPES = [
  'PrizePicks House',
  'PPWC',
  'Game Watch / LCS',
  'All Pack',
  'Internal All Hands',
  'F&F Event',
  'External Activation',
  'Hackathon',
  'Custom',
]

const EVENT_TRACKS = ['External', 'Internal', 'F&F']

const VENDOR_OPTIONS = [
  'A/V & Production',
  'Catering & F&B',
  'Venue',
  'Merch & Swag',
  'Photography',
  'Staffing',
  'Transportation',
  'Security',
  'Decor & Floral',
  'Entertainment',
]

const DAYS_OUT_OPTIONS = [120, 90, 60, 45, 30, 21, 14, 7, 3, 1, 0]

const trackColors = {
  'External': { bg: '#F0E8FB', color: '#7B2FBE' },
  'Internal': { bg: '#F0FBE0', color: '#3B6D11' },
  'F&F': { bg: '#FEF9EC', color: '#92610A' },
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function Packages({ workspaceId, userRole }) {
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('library') // library | detail | form
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [editingPackage, setEditingPackage] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [search, setSearch] = useState('')
  const [filterTrack, setFilterTrack] = useState('all')

  const isDirector = ['owner', 'admin'].includes(userRole)

  const [form, setForm] = useState({
    name: '',
    custom_name: '',
    event_type: '',
    description: '',
    budget_low: '',
    budget_mid: '',
    budget_high: '',
    headcount_min: '',
    headcount_max: '',
    vendor_categories: [],
    merch_notes: '',
    inspo_deck_url: '',
    inspo_deck_label: '',
    notes: '',
  })

  const [newTimelineItem, setNewTimelineItem] = useState({ days_out: 30, task: '', owner_role: '' })

  useEffect(() => {
    if (workspaceId) fetchPackages()
  }, [workspaceId])

  async function fetchPackages() {
    setLoading(true)
    const { data } = await supabase
      .from('event_packages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })
    setPackages(data || [])
    setLoading(false)
  }

  async function fetchTimeline(packageId) {
    const { data } = await supabase
      .from('package_timeline')
      .select('*')
      .eq('package_id', packageId)
      .order('days_out', { ascending: false })
    setTimeline(data || [])
  }

  async function savePackage() {
    const name = form.name === 'Custom' ? form.custom_name : form.name
    if (!name) return

    const payload = {
      workspace_id: workspaceId,
      name,
      event_type: form.event_type,
      description: form.description,
      budget_low: Number(form.budget_low) || 0,
      budget_mid: Number(form.budget_mid) || 0,
      budget_high: Number(form.budget_high) || 0,
      headcount_min: Number(form.headcount_min) || 0,
      headcount_max: Number(form.headcount_max) || 0,
      vendor_categories: form.vendor_categories,
      merch_notes: form.merch_notes,
      inspo_deck_url: form.inspo_deck_url,
      inspo_deck_label: form.inspo_deck_label,
      notes: form.notes,
      created_by: (await supabase.auth.getUser()).data.user?.id,
    }

    let packageId
    if (editingPackage) {
      await supabase.from('event_packages').update(payload).eq('id', editingPackage.id)
      packageId = editingPackage.id
    } else {
      const { data } = await supabase.from('event_packages').insert(payload).select().single()
      packageId = data?.id
    }

    // Save timeline items
    if (packageId && timeline.length > 0) {
      const newItems = timeline.filter(i => !i.id)
      if (newItems.length > 0) {
        await supabase.from('package_timeline').insert(
          newItems.map((item, idx) => ({ ...item, package_id: packageId, sort_order: idx }))
        )
      }
    }

    resetForm()
    fetchPackages()
  }

  async function deletePackage(id) {
    await supabase.from('event_packages').delete().eq('id', id)
    fetchPackages()
    if (selectedPackage?.id === id) {
      setView('library')
      setSelectedPackage(null)
    }
  }

  async function deleteTimelineItem(id) {
    await supabase.from('package_timeline').delete().eq('id', id)
    fetchTimeline(selectedPackage?.id || editingPackage?.id)
  }

  function startEdit(pkg) {
    setEditingPackage(pkg)
    setForm({
      name: PRESET_TYPES.includes(pkg.name) ? pkg.name : 'Custom',
      custom_name: PRESET_TYPES.includes(pkg.name) ? '' : pkg.name,
      event_type: pkg.event_type || '',
      description: pkg.description || '',
      budget_low: pkg.budget_low || '',
      budget_mid: pkg.budget_mid || '',
      budget_high: pkg.budget_high || '',
      headcount_min: pkg.headcount_min || '',
      headcount_max: pkg.headcount_max || '',
      vendor_categories: pkg.vendor_categories || [],
      merch_notes: pkg.merch_notes || '',
      inspo_deck_url: pkg.inspo_deck_url || '',
      inspo_deck_label: pkg.inspo_deck_label || '',
      notes: pkg.notes || '',
    })
    fetchTimeline(pkg.id).then(() => setView('form'))
  }

  function startNew() {
    setEditingPackage(null)
    setForm({
      name: '', custom_name: '', event_type: '', description: '',
      budget_low: '', budget_mid: '', budget_high: '',
      headcount_min: '', headcount_max: '',
      vendor_categories: [], merch_notes: '',
      inspo_deck_url: '', inspo_deck_label: '', notes: '',
    })
    setTimeline([])
    setView('form')
  }

  function resetForm() {
    setView('library')
    setEditingPackage(null)
    setTimeline([])
  }

  function toggleVendor(v) {
    setForm(f => ({
      ...f,
      vendor_categories: f.vendor_categories.includes(v)
        ? f.vendor_categories.filter(x => x !== v)
        : [...f.vendor_categories, v]
    }))
  }

  function addTimelineItem() {
    if (!newTimelineItem.task) return
    setTimeline(prev => [...prev, { ...newTimelineItem, id: null }])
    setNewTimelineItem({ days_out: 30, task: '', owner_role: '' })
  }

  async function viewPackage(pkg) {
    setSelectedPackage(pkg)
    await fetchTimeline(pkg.id)
    setView('detail')
  }

  const filtered = packages.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchTrack = filterTrack === 'all' || p.event_type === filterTrack
    return matchSearch && matchTrack
  })

  // ── FORM VIEW ──
  if (view === 'form') {
    return (
      <div style={{ padding: '32px 40px', fontFamily: t.fonts.sans, maxWidth: '800px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.colors.textTertiary, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans }}>← Back</button>
          <h1 style={{ fontFamily: t.fonts.heading, fontSize: '24px', fontWeight: '800', color: t.colors.textPrimary, letterSpacing: '-0.02em', margin: 0 }}>
            {editingPackage ? 'Edit Package' : 'New Package'}
          </h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Basic info */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px' }}>
            <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '16px' }}>Basic Info</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Event Type *</label>
                <select value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }}>
                  <option value="">Select type</option>
                  {PRESET_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              {form.name === 'Custom' && (
                <div>
                  <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Custom Name *</label>
                  <input value={form.custom_name} onChange={e => setForm(f => ({ ...f, custom_name: e.target.value }))} placeholder="e.g. Partner Summit" style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }} />
                </div>
              )}
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Track</label>
                <select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }}>
                  <option value="">Select track</option>
                  {EVENT_TRACKS.map(tr => <option key={tr} value={tr}>{tr}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this event type and when is it typically used?" rows={3} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', resize: 'vertical', color: t.colors.textPrimary }} />
              </div>
            </div>
          </div>

          {/* Budget & headcount */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px' }}>
            <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '16px' }}>Budget & Headcount</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '14px' }}>
              {[
                { key: 'budget_low', label: 'Budget Low' },
                { key: 'budget_mid', label: 'Budget Mid' },
                { key: 'budget_high', label: 'Budget High' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>{f.label}</label>
                  <CurrencyInput value={form[f.key]} onChange={val => setForm(p => ({ ...p, [f.key]: val }))} />
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Headcount Min</label>
                <input type="number" value={form.headcount_min} onChange={e => setForm(f => ({ ...f, headcount_min: e.target.value }))} placeholder="e.g. 50" style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }} />
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Headcount Max</label>
                <input type="number" value={form.headcount_max} onChange={e => setForm(f => ({ ...f, headcount_max: e.target.value }))} placeholder="e.g. 500" style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }} />
              </div>
            </div>
          </div>

          {/* Vendors */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px' }}>
            <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '16px' }}>Vendor Categories Needed</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {VENDOR_OPTIONS.map(v => (
                <button key={v} onClick={() => toggleVendor(v)} style={{ padding: '6px 14px', borderRadius: t.radius.full, border: `1px solid ${form.vendor_categories.includes(v) ? t.colors.primary : t.colors.border}`, background: form.vendor_categories.includes(v) ? t.colors.primaryLight : 'transparent', color: form.vendor_categories.includes(v) ? t.colors.primary : t.colors.textSecondary, fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, cursor: 'pointer', fontWeight: form.vendor_categories.includes(v) ? '600' : '400' }}>
                  {v}
                </button>
              ))}
            </div>
            <div style={{ marginTop: '16px' }}>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Merch Notes</label>
              <input value={form.merch_notes} onChange={e => setForm(f => ({ ...f, merch_notes: e.target.value }))} placeholder="Typical merch items, drop timing, budget allocation..." style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }} />
            </div>
          </div>

          {/* Inspo deck */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px' }}>
            <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '16px' }}>Inspo Deck</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Deck URL</label>
                <input value={form.inspo_deck_url} onChange={e => setForm(f => ({ ...f, inspo_deck_url: e.target.value }))} placeholder="https://figma.com/... or Google Drive link" style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }} />
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Display Label</label>
                <input value={form.inspo_deck_label} onChange={e => setForm(f => ({ ...f, inspo_deck_label: e.target.value }))} placeholder="e.g. 2024 House Deck" style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }} />
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px' }}>
            <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '16px' }}>Planning Timeline</div>

            {/* Existing items */}
            {timeline.length > 0 && (
              <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[...timeline].sort((a, b) => b.days_out - a.days_out).map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: t.colors.bg, borderRadius: t.radius.md, border: `1px solid ${t.colors.borderLight}` }}>
                    <span style={{ fontSize: t.fontSizes.xs, fontWeight: '600', color: t.colors.primary, background: t.colors.primaryLight, padding: '3px 8px', borderRadius: t.radius.full, whiteSpace: 'nowrap' }}>
                      {item.days_out === 0 ? 'Day of' : `${item.days_out}d out`}
                    </span>
                    <span style={{ flex: 1, fontSize: t.fontSizes.base, color: t.colors.textPrimary }}>{item.task}</span>
                    {item.owner_role && <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{item.owner_role}</span>}
                    {item.id && (
                      <button onClick={() => deleteTimelineItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.colors.danger, fontSize: t.fontSizes.xs, fontFamily: t.fonts.sans }}>Remove</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add new timeline item */}
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 140px auto', gap: '10px', alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary, display: 'block', marginBottom: '4px' }}>Days out</label>
                <select value={newTimelineItem.days_out} onChange={e => setNewTimelineItem(p => ({ ...p, days_out: Number(e.target.value) }))} style={{ width: '100%', padding: '8px 10px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, color: t.colors.textPrimary }}>
                  {DAYS_OUT_OPTIONS.map(d => <option key={d} value={d}>{d === 0 ? 'Day of' : `${d} days`}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary, display: 'block', marginBottom: '4px' }}>Task</label>
                <input value={newTimelineItem.task} onChange={e => setNewTimelineItem(p => ({ ...p, task: e.target.value }))} placeholder="e.g. Book venue" style={{ width: '100%', padding: '8px 10px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }} />
              </div>
              <div>
                <label style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary, display: 'block', marginBottom: '4px' }}>Owner</label>
                <input value={newTimelineItem.owner_role} onChange={e => setNewTimelineItem(p => ({ ...p, owner_role: e.target.value }))} placeholder="e.g. Events Lead" style={{ width: '100%', padding: '8px 10px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }} />
              </div>
              <button onClick={addTimelineItem} style={{ padding: '8px 16px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.sm, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Add</button>
            </div>
          </div>

          {/* Notes */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px' }}>
            <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '16px' }}>Additional Notes</div>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="History, lessons learned, special considerations for this event type..." rows={4} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', resize: 'vertical', color: t.colors.textPrimary }} />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', paddingBottom: '40px' }}>
            <button onClick={savePackage} style={{ padding: '11px 28px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.md, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>
              {editingPackage ? 'Save Changes' : 'Create Package'}
            </button>
            <button onClick={resetForm} style={{ padding: '11px 20px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.md, fontFamily: t.fonts.sans, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── DETAIL VIEW ──
  if (view === 'detail' && selectedPackage) {
    const pkg = selectedPackage
    const tc = trackColors[pkg.event_type] || { bg: '#F3F3F3', color: '#6B7280' }
    return (
      <div style={{ padding: '32px 40px', fontFamily: t.fonts.sans, maxWidth: '800px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
          <button onClick={() => setView('library')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.colors.textTertiary, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans }}>← Packages</button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontFamily: t.fonts.heading, fontSize: '24px', fontWeight: '800', color: t.colors.textPrimary, letterSpacing: '-0.02em', margin: 0 }}>{pkg.name}</h1>
              {pkg.event_type && <span style={{ fontSize: t.fontSizes.xs, fontWeight: '500', background: tc.bg, color: tc.color, padding: '3px 10px', borderRadius: t.radius.full }}>{pkg.event_type}</span>}
            </div>
            {pkg.description && <p style={{ fontSize: t.fontSizes.base, color: t.colors.textSecondary, margin: '6px 0 0', lineHeight: 1.6 }}>{pkg.description}</p>}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {isDirector && (
              <button onClick={() => startEdit(pkg)} style={{ padding: '8px 16px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, cursor: 'pointer' }}>Edit</button>
            )}
            <button onClick={() => alert('Brief generator coming soon!')} style={{ padding: '8px 18px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.sm, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>Generate Brief</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Budget & headcount */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '20px 24px' }}>
            <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '14px' }}>Budget Range</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
              {[
                { label: 'Low', value: pkg.budget_low },
                { label: 'Mid', value: pkg.budget_mid },
                { label: 'High', value: pkg.budget_high },
              ].map(b => (
                <div key={b.label} style={{ textAlign: 'center', padding: '12px', background: t.colors.bg, borderRadius: t.radius.md }}>
                  <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{b.label}</div>
                  <div style={{ fontSize: t.fontSizes.xl, fontWeight: '700', color: t.colors.textPrimary, fontFamily: t.fonts.heading }}>{fmt(b.value)}</div>
                </div>
              ))}
            </div>
            {(pkg.headcount_min || pkg.headcount_max) && (
              <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>
                Headcount: <strong>{pkg.headcount_min}–{pkg.headcount_max} guests</strong>
              </div>
            )}
          </div>

          {/* Vendors */}
          {pkg.vendor_categories?.length > 0 && (
            <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '20px 24px' }}>
              <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '14px' }}>Vendor Categories</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {pkg.vendor_categories.map(v => (
                  <span key={v} style={{ fontSize: t.fontSizes.sm, background: t.colors.primaryLight, color: t.colors.primary, padding: '5px 12px', borderRadius: t.radius.full, fontWeight: '500' }}>{v}</span>
                ))}
              </div>
              {pkg.merch_notes && <p style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary, margin: '12px 0 0', lineHeight: 1.6 }}>🎁 {pkg.merch_notes}</p>}
            </div>
          )}

          {/* Inspo deck */}
          {pkg.inspo_deck_url && (
            <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '20px 24px' }}>
              <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '14px' }}>Inspo Deck</div>
              <a href={pkg.inspo_deck_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: t.radius.md, border: `1px solid ${t.colors.primary}`, color: t.colors.primary, textDecoration: 'none', fontSize: t.fontSizes.base, fontWeight: '500', fontFamily: t.fonts.sans }}>
                🔗 {pkg.inspo_deck_label || 'View Inspo Deck'}
              </a>
            </div>
          )}

          {/* Timeline */}
          {timeline.length > 0 && (
            <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '20px 24px' }}>
              <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '14px' }}>Planning Timeline</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[...timeline].sort((a, b) => b.days_out - a.days_out).map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: t.colors.bg, borderRadius: t.radius.md }}>
                    <span style={{ fontSize: t.fontSizes.xs, fontWeight: '600', color: t.colors.primary, background: t.colors.primaryLight, padding: '3px 8px', borderRadius: t.radius.full, whiteSpace: 'nowrap', minWidth: '60px', textAlign: 'center' }}>
                      {item.days_out === 0 ? 'Day of' : `${item.days_out}d out`}
                    </span>
                    <span style={{ flex: 1, fontSize: t.fontSizes.base, color: t.colors.textPrimary }}>{item.task}</span>
                    {item.owner_role && <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, background: t.colors.border, padding: '2px 8px', borderRadius: t.radius.full }}>{item.owner_role}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {pkg.notes && (
            <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '20px 24px' }}>
              <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '14px' }}>Notes & History</div>
              <p style={{ fontSize: t.fontSizes.base, color: t.colors.textSecondary, margin: 0, lineHeight: 1.7 }}>{pkg.notes}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── LIBRARY VIEW ──
  return (
    <div style={{ padding: '32px 40px', fontFamily: t.fonts.sans }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: t.fontSizes.xs, fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.primary, marginBottom: '6px' }}>Playbooks</div>
          <h1 style={{ fontFamily: t.fonts.heading, fontSize: '28px', fontWeight: '800', color: t.colors.textPrimary, letterSpacing: '-0.02em', margin: 0 }}>Event Packages</h1>
        </div>
        {isDirector && (
          <button onClick={startNew} style={{ padding: '9px 18px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>
            + New Package
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search packages..."
          style={{ padding: '8px 14px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary, width: '220px' }}
        />
        <div style={{ display: 'flex', gap: '4px', background: t.colors.bg, borderRadius: t.radius.md, padding: '4px' }}>
          {['all', ...EVENT_TRACKS].map(tr => (
            <button key={tr} onClick={() => setFilterTrack(tr)} style={{ padding: '5px 14px', borderRadius: t.radius.sm, border: 'none', background: filterTrack === tr ? t.colors.bgCard : 'transparent', color: filterTrack === tr ? t.colors.textPrimary : t.colors.textSecondary, fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, cursor: 'pointer', fontWeight: filterTrack === tr ? '600' : '400', boxShadow: filterTrack === tr ? t.shadows.sm : 'none' }}>
              {tr === 'all' ? 'All' : tr}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ color: t.colors.textTertiary, textAlign: 'center', padding: '60px' }}>Loading packages...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}` }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📦</div>
          <div style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, marginBottom: '6px' }}>No packages yet</div>
          <div style={{ fontSize: t.fontSizes.base, color: t.colors.textSecondary, marginBottom: '16px' }}>
            {isDirector ? 'Create your first event package to get started.' : 'No packages have been created yet.'}
          </div>
          {isDirector && (
            <button onClick={startNew} style={{ padding: '10px 24px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>
              Create Package
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {filtered.map(pkg => {
            const tc = trackColors[pkg.event_type] || { bg: '#F3F3F3', color: '#6B7280' }
            return (
              <div key={pkg.id} style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = t.colors.primary}
                onMouseLeave={e => e.currentTarget.style.borderColor = t.colors.border}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes.xl, fontWeight: '800', color: t.colors.textPrimary, letterSpacing: '-0.01em', lineHeight: 1.2 }}>{pkg.name}</div>
                  {pkg.event_type && <span style={{ fontSize: '10px', fontWeight: '500', background: tc.bg, color: tc.color, padding: '3px 8px', borderRadius: t.radius.full, flexShrink: 0, marginLeft: '8px' }}>{pkg.event_type}</span>}
                </div>

                {pkg.description && <p style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary, margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{pkg.description}</p>}

                <div style={{ display: 'flex', gap: '16px' }}>
                  {pkg.budget_low && <div><div style={{ fontSize: '10px', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Budget</div><div style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>{fmt(pkg.budget_low)}–{fmt(pkg.budget_high)}</div></div>}
                  {pkg.headcount_min && <div><div style={{ fontSize: '10px', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Headcount</div><div style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>{pkg.headcount_min}–{pkg.headcount_max}</div></div>}
                </div>

                {pkg.vendor_categories?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {pkg.vendor_categories.slice(0, 3).map(v => (
                      <span key={v} style={{ fontSize: '10px', color: t.colors.textTertiary, background: t.colors.bg, padding: '2px 8px', borderRadius: t.radius.full }}>{v}</span>
                    ))}
                    {pkg.vendor_categories.length > 3 && <span style={{ fontSize: '10px', color: t.colors.textTertiary }}>+{pkg.vendor_categories.length - 3} more</span>}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '4px' }}>
                  <button onClick={() => viewPackage(pkg)} style={{ flex: 1, padding: '8px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, cursor: 'pointer' }}>View</button>
                  <button onClick={() => alert('Brief generator coming soon!')} style={{ flex: 1, padding: '8px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.sm, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>Generate Brief</button>
                  {isDirector && (
                    <button onClick={() => startEdit(pkg)} style={{ padding: '8px 10px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, cursor: 'pointer' }}>✏️</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
