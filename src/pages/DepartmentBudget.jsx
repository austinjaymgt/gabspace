import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

const CATEGORIES = [
  'Tentpole Events',
  'Operations',
  'Staffing',
  'Marketing',
  'A/V & Production',
  'Catering & F&B',
  'Venue',
  'Travel & Logistics',
  'Miscellaneous',
]

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
const CURRENT_YEAR = new Date().getFullYear()

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function pct(a, b) {
  if (!b || b === 0) return 0
  return Math.min(Math.round((a / b) * 100), 100)
}

export default function DepartmentBudget({ workspaceId, userRole, session }) {
  const [budget, setBudget] = useState(null)
  const [lineItems, setLineItems] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(CURRENT_YEAR)
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [showLineForm, setShowLineForm] = useState(false)
  const [editingLine, setEditingLine] = useState(null)
  const [activeView, setActiveView] = useState('overview')
  const [budgetForm, setBudgetForm] = useState({
    annual_budget: '',
    q1_target: '',
    q2_target: '',
    q3_target: '',
    q4_target: '',
  })
  const [lineForm, setLineForm] = useState({
    category: '',
    label: '',
    projected_amount: '',
    actual_amount: '',
    quarter: '',
    project_id: '',
    notes: '',
  })

  const isDirector = ['owner', 'admin'].includes(userRole)

  useEffect(() => {
    if (workspaceId) {
      fetchAll()
    }
  }, [workspaceId, year])

  async function fetchAll() {
    setLoading(true)
    const [budgetRes, lineRes, projRes] = await Promise.all([
      supabase.from('department_budget').select('*').eq('workspace_id', workspaceId).eq('year', year).maybeSingle(),
      supabase.from('budget_line_items').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: true }),
      supabase.from('projects').select('id, title, event_status, event_date').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
    ])
    setBudget(budgetRes.data)
    setLineItems(lineRes.data || [])
    setProjects(projRes.data || [])
    if (budgetRes.data) {
      setBudgetForm({
        annual_budget: budgetRes.data.annual_budget || '',
        q1_target: budgetRes.data.q1_target || '',
        q2_target: budgetRes.data.q2_target || '',
        q3_target: budgetRes.data.q3_target || '',
        q4_target: budgetRes.data.q4_target || '',
      })
    }
    setLoading(false)
  }

  async function saveBudget() {
    const payload = {
      workspace_id: workspaceId,
      year,
      annual_budget: Number(budgetForm.annual_budget) || 0,
      q1_target: Number(budgetForm.q1_target) || 0,
      q2_target: Number(budgetForm.q2_target) || 0,
      q3_target: Number(budgetForm.q3_target) || 0,
      q4_target: Number(budgetForm.q4_target) || 0,
    }
    if (budget) {
      await supabase.from('department_budget').update(payload).eq('id', budget.id)
    } else {
      await supabase.from('department_budget').insert(payload)
    }
    setShowBudgetForm(false)
    fetchAll()
  }

  async function saveLineItem() {
    if (!lineForm.category || !lineForm.label) return
    const payload = {
      workspace_id: workspaceId,
      category: lineForm.category,
      label: lineForm.label,
      projected_amount: Number(lineForm.projected_amount) || 0,
      actual_amount: Number(lineForm.actual_amount) || 0,
      quarter: lineForm.quarter || null,
      project_id: lineForm.project_id || null,
      notes: lineForm.notes || null,
    }
    if (editingLine) {
      await supabase.from('budget_line_items').update(payload).eq('id', editingLine.id)
    } else {
      await supabase.from('budget_line_items').insert(payload)
    }
    resetLineForm()
    fetchAll()
  }

  async function deleteLine(id) {
    await supabase.from('budget_line_items').delete().eq('id', id)
    fetchAll()
  }

  function resetLineForm() {
    setLineForm({ category: '', label: '', projected_amount: '', actual_amount: '', quarter: '', project_id: '', notes: '' })
    setEditingLine(null)
    setShowLineForm(false)
  }

  function startEditLine(item) {
    setLineForm({
      category: item.category,
      label: item.label || '',
      projected_amount: item.projected_amount || '',
      actual_amount: item.actual_amount || '',
      quarter: item.quarter || '',
      project_id: item.project_id || '',
      notes: item.notes || '',
    })
    setEditingLine(item)
    setShowLineForm(true)
  }

  // Computed totals
  const totalProjected = lineItems.reduce((s, i) => s + Number(i.projected_amount || 0), 0)
  const totalActual = lineItems.reduce((s, i) => s + Number(i.actual_amount || 0), 0)
  const annualBudget = Number(budget?.annual_budget || 0)
  const remaining = annualBudget - totalActual
  const spentPct = pct(totalActual, annualBudget)
  const projectedPct = pct(totalProjected, annualBudget)

  // Group by category
  const byCategory = CATEGORIES.map(cat => {
    const items = lineItems.filter(i => i.category === cat)
    return {
      category: cat,
      projected: items.reduce((s, i) => s + Number(i.projected_amount || 0), 0),
      actual: items.reduce((s, i) => s + Number(i.actual_amount || 0), 0),
      items,
    }
  }).filter(c => c.items.length > 0)

  // Group by project
  const byProject = projects.map(proj => {
    const items = lineItems.filter(i => i.project_id === proj.id)
    return {
      ...proj,
      projected: items.reduce((s, i) => s + Number(i.projected_amount || 0), 0),
      actual: items.reduce((s, i) => s + Number(i.actual_amount || 0), 0),
      items,
    }
  }).filter(p => p.items.length > 0)

  const unassigned = lineItems.filter(i => !i.project_id)

  if (!isDirector) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: t.fonts.sans }}>
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ fontSize: t.fontSizes.xl, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px' }}>Director access only</h2>
        <p style={{ fontSize: t.fontSizes.md, color: t.colors.textTertiary }}>Budget information is restricted to department directors.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 40px', fontFamily: t.fonts.sans, maxWidth: '1000px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: t.fontSizes.xs, fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.primary, marginBottom: '6px' }}>Operations</div>
          <h1 style={{ fontFamily: t.fonts.heading, fontSize: '28px', fontWeight: '800', color: t.colors.textPrimary, letterSpacing: '-0.02em', margin: 0 }}>
            Department Budget
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, color: t.colors.textPrimary, background: t.colors.bgCard, fontFamily: t.fonts.sans }}
          >
            {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => setShowBudgetForm(true)}
            style={{ padding: '9px 18px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: t.colors.bgCard, color: t.colors.textPrimary, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, cursor: 'pointer' }}
          >
            {budget ? 'Edit Budget' : 'Set Budget'}
          </button>
          <button
            onClick={() => setShowLineForm(true)}
            style={{ padding: '9px 18px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}
          >
            + Add Line Item
          </button>
        </div>
      </div>

      {/* Budget setup prompt */}
      {!budget && !showBudgetForm && (
        <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '32px', textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
          <div style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, marginBottom: '8px' }}>Set your {year} budget</div>
          <div style={{ fontSize: t.fontSizes.base, color: t.colors.textSecondary, marginBottom: '16px' }}>Add your annual budget and quarterly targets to start tracking.</div>
          <button onClick={() => setShowBudgetForm(true)} style={{ padding: '10px 24px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>
            Set Budget
          </button>
        </div>
      )}

      {/* Budget form */}
      {showBudgetForm && (
        <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 20px' }}>{year} Budget Setup</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            {[
              { key: 'annual_budget', label: 'Annual Budget' },
              { key: 'q1_target', label: 'Q1 Target' },
              { key: 'q2_target', label: 'Q2 Target' },
              { key: 'q3_target', label: 'Q3 Target' },
              { key: 'q4_target', label: 'Q4 Target' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>{f.label}</label>
                <input
                  type="number"
                  value={budgetForm[f.key]}
                  onChange={e => setBudgetForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder="0"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={saveBudget} style={{ padding: '9px 20px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>Save</button>
            <button onClick={() => setShowBudgetForm(false)} style={{ padding: '9px 20px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Line item form */}
      {showLineForm && (
        <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 20px' }}>{editingLine ? 'Edit Line Item' : 'New Line Item'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Category *</label>
              <select value={lineForm.category} onChange={e => setLineForm(p => ({ ...p, category: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }}>
                <option value="">Select category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Label *</label>
              <input value={lineForm.label} onChange={e => setLineForm(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Summer Kickoff Event" style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }} />
            </div>
            <div>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Projected Amount</label>
              <input type="number" value={lineForm.projected_amount} onChange={e => setLineForm(p => ({ ...p, projected_amount: e.target.value }))} placeholder="0" style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }} />
            </div>
            <div>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Actual Amount</label>
              <input type="number" value={lineForm.actual_amount} onChange={e => setLineForm(p => ({ ...p, actual_amount: e.target.value }))} placeholder="0" style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }} />
            </div>
            <div>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Quarter</label>
              <select value={lineForm.quarter} onChange={e => setLineForm(p => ({ ...p, quarter: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }}>
                <option value="">No quarter</option>
                {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Link to Event/Project</label>
              <select value={lineForm.project_id} onChange={e => setLineForm(p => ({ ...p, project_id: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }}>
                <option value="">Unassigned</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Notes</label>
              <input value={lineForm.notes} onChange={e => setLineForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any additional context..." style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button onClick={saveLineItem} style={{ padding: '9px 20px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>{editingLine ? 'Save Changes' : 'Add Item'}</button>
            <button onClick={resetLineForm} style={{ padding: '9px 20px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {budget && (
        <>
          {/* Big numbers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Annual Budget', value: fmt(annualBudget), sub: `${year} allocation` },
              { label: 'Total Projected', value: fmt(totalProjected), sub: `${projectedPct}% of budget` },
              { label: 'Total Actual', value: fmt(totalActual), sub: `${spentPct}% spent` },
              { label: 'Remaining', value: fmt(remaining), sub: remaining < 0 ? 'Over budget' : 'Available', danger: remaining < 0 },
            ].map(stat => (
              <div key={stat.label} style={{ background: t.colors.bgCard, border: `1px solid ${stat.danger ? t.colors.danger : t.colors.border}`, borderRadius: t.radius.lg, padding: '18px 20px' }}>
                <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{stat.label}</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: stat.danger ? t.colors.danger : t.colors.textPrimary, fontFamily: t.fonts.heading, marginBottom: '2px' }}>{stat.value}</div>
                <div style={{ fontSize: t.fontSizes.xs, color: stat.danger ? t.colors.danger : t.colors.textTertiary }}>{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Overall progress bar */}
          <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '20px 24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textPrimary }}>Budget utilization</span>
              <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>{fmt(totalActual)} of {fmt(annualBudget)}</span>
            </div>
            <div style={{ height: '10px', background: t.colors.border, borderRadius: t.radius.full, overflow: 'hidden', marginBottom: '8px', position: 'relative' }}>
              <div style={{ position: 'absolute', height: '100%', width: `${projectedPct}%`, background: t.colors.primaryLight, borderRadius: t.radius.full }} />
              <div style={{ position: 'absolute', height: '100%', width: `${spentPct}%`, background: spentPct > 90 ? t.colors.danger : t.colors.primary, borderRadius: t.radius.full }} />
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: t.colors.primary }} />
                <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary }}>Actual ({spentPct}%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: t.colors.primaryLight }} />
                <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary }}>Projected ({projectedPct}%)</span>
              </div>
            </div>
          </div>

          {/* Quarterly targets */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
            {QUARTERS.map(q => {
              const target = Number(budget[`${q.toLowerCase()}_target`] || 0)
              const actual = lineItems.filter(i => i.quarter === q).reduce((s, i) => s + Number(i.actual_amount || 0), 0)
              const p = pct(actual, target)
              return (
                <div key={q} style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>{q}</span>
                    <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{p}%</span>
                  </div>
                  <div style={{ height: '6px', background: t.colors.border, borderRadius: t.radius.full, overflow: 'hidden', marginBottom: '8px' }}>
                    <div style={{ height: '100%', width: `${p}%`, background: p > 90 ? t.colors.danger : t.colors.primary, borderRadius: t.radius.full }} />
                  </div>
                  <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary }}>{fmt(actual)} / {fmt(target)}</div>
                </div>
              )
            })}
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', gap: '4px', background: t.colors.bg, borderRadius: t.radius.md, padding: '4px', width: 'fit-content', marginBottom: '20px' }}>
            {['overview', 'by-project'].map(v => (
              <button key={v} onClick={() => setActiveView(v)} style={{ padding: '7px 16px', borderRadius: t.radius.sm, border: 'none', background: activeView === v ? t.colors.bgCard : 'transparent', color: activeView === v ? t.colors.textPrimary : t.colors.textSecondary, fontSize: t.fontSizes.sm, fontWeight: activeView === v ? '600' : '400', fontFamily: t.fonts.sans, cursor: 'pointer', boxShadow: activeView === v ? t.shadows.sm : 'none' }}>
                {v === 'overview' ? 'By Category' : 'By Event/Project'}
              </button>
            ))}
          </div>

          {/* By Category view */}
          {activeView === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {byCategory.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', background: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}`, color: t.colors.textSecondary }}>
                  No line items yet. Add your first item above.
                </div>
              )}
              {byCategory.map(cat => (
                <div key={cat.category} style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.colors.borderLight}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: '600', fontSize: t.fontSizes.md, color: t.colors.textPrimary }}>{cat.category}</div>
                    <div style={{ display: 'flex', gap: '24px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginBottom: '2px' }}>Projected</div>
                        <div style={{ fontSize: t.fontSizes.md, fontWeight: '600', color: t.colors.textPrimary }}>{fmt(cat.projected)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginBottom: '2px' }}>Actual</div>
                        <div style={{ fontSize: t.fontSizes.md, fontWeight: '600', color: cat.actual > cat.projected ? t.colors.danger : t.colors.textPrimary }}>{fmt(cat.actual)}</div>
                      </div>
                    </div>
                  </div>
                  {cat.items.map(item => (
                    <div key={item.id} style={{ padding: '12px 20px', borderBottom: `1px solid ${t.colors.borderLight}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.colors.bg }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: t.fontSizes.base, color: t.colors.textPrimary, marginBottom: '2px' }}>{item.label}</div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {item.quarter && <span style={{ fontSize: t.fontSizes.xs, background: t.colors.primaryLight, color: t.colors.primary, padding: '2px 8px', borderRadius: t.radius.full }}>{item.quarter}</span>}
                          {item.project_id && <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{projects.find(p => p.id === item.project_id)?.title}</span>}
                          {item.notes && <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>· {item.notes}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>Proj</div>
                          <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>{fmt(item.projected_amount)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>Actual</div>
                          <div style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>{fmt(item.actual_amount)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => startEditLine(item)} style={{ background: 'none', border: `1px solid ${t.colors.border}`, borderRadius: t.radius.sm, padding: '4px 8px', fontSize: t.fontSizes.xs, color: t.colors.textSecondary, cursor: 'pointer', fontFamily: t.fonts.sans }}>Edit</button>
                          <button onClick={() => deleteLine(item.id)} style={{ background: 'none', border: `1px solid ${t.colors.border}`, borderRadius: t.radius.sm, padding: '4px 8px', fontSize: t.fontSizes.xs, color: t.colors.danger, cursor: 'pointer', fontFamily: t.fonts.sans }}>Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* By Project view */}
          {activeView === 'by-project' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {byProject.map(proj => (
                <div key={proj.id} style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.colors.borderLight}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: t.fontSizes.md, color: t.colors.textPrimary }}>{proj.title}</div>
                      {proj.event_date && <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '2px' }}>{new Date(proj.event_date).toLocaleDateString()}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '24px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginBottom: '2px' }}>Projected</div>
                        <div style={{ fontSize: t.fontSizes.md, fontWeight: '600', color: t.colors.textPrimary }}>{fmt(proj.projected)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginBottom: '2px' }}>Actual</div>
                        <div style={{ fontSize: t.fontSizes.md, fontWeight: '600', color: proj.actual > proj.projected ? t.colors.danger : t.colors.textPrimary }}>{fmt(proj.actual)}</div>
                      </div>
                    </div>
                  </div>
                  {proj.items.map(item => (
                    <div key={item.id} style={{ padding: '12px 20px', borderBottom: `1px solid ${t.colors.borderLight}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.colors.bg }}>
                      <div>
                        <div style={{ fontSize: t.fontSizes.base, color: t.colors.textPrimary }}>{item.label}</div>
                        <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{item.category}{item.quarter ? ` · ${item.quarter}` : ''}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>Proj</div>
                          <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>{fmt(item.projected_amount)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>Actual</div>
                          <div style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>{fmt(item.actual_amount)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => startEditLine(item)} style={{ background: 'none', border: `1px solid ${t.colors.border}`, borderRadius: t.radius.sm, padding: '4px 8px', fontSize: t.fontSizes.xs, color: t.colors.textSecondary, cursor: 'pointer', fontFamily: t.fonts.sans }}>Edit</button>
                          <button onClick={() => deleteLine(item.id)} style={{ background: 'none', border: `1px solid ${t.colors.border}`, borderRadius: t.radius.sm, padding: '4px 8px', fontSize: t.fontSizes.xs, color: t.colors.danger, cursor: 'pointer', fontFamily: t.fonts.sans }}>Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* Unassigned */}
              {unassigned.length > 0 && (
                <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.colors.borderLight}` }}>
                    <div style={{ fontWeight: '600', fontSize: t.fontSizes.md, color: t.colors.textSecondary }}>Unassigned</div>
                  </div>
                  {unassigned.map(item => (
                    <div key={item.id} style={{ padding: '12px 20px', borderBottom: `1px solid ${t.colors.borderLight}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.colors.bg }}>
                      <div>
                        <div style={{ fontSize: t.fontSizes.base, color: t.colors.textPrimary }}>{item.label}</div>
                        <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{item.category}{item.quarter ? ` · ${item.quarter}` : ''}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>Proj</div>
                          <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>{fmt(item.projected_amount)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>Actual</div>
                          <div style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>{fmt(item.actual_amount)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => startEditLine(item)} style={{ background: 'none', border: `1px solid ${t.colors.border}`, borderRadius: t.radius.sm, padding: '4px 8px', fontSize: t.fontSizes.xs, color: t.colors.textSecondary, cursor: 'pointer', fontFamily: t.fonts.sans }}>Edit</button>
                          <button onClick={() => deleteLine(item.id)} style={{ background: 'none', border: `1px solid ${t.colors.border}`, borderRadius: t.radius.sm, padding: '4px 8px', fontSize: t.fontSizes.xs, color: t.colors.danger, cursor: 'pointer', fontFamily: t.fonts.sans }}>Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {byProject.length === 0 && unassigned.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', background: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}`, color: t.colors.textSecondary }}>
                  No line items yet. Add your first item above.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
