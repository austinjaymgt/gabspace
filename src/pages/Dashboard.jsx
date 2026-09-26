import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import { Icon } from '../components/Icon'
import Orb from '../components/Orb'
import OrbiCard from '../components/OrbiCard'
import { getModules } from '../utils/businessModules'

// Month boundaries as plain YYYY-MM-DD, for comparing against `date` columns
// (invoice_payments.paid_date, revenue.date) which have no time component.
function monthBoundaryDate(offsetMonths) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offsetMonths)
  return d.toISOString().slice(0, 10)
}

// Month boundaries as full ISO timestamps, for comparing against
// timestamptz `created_at` columns.
function monthBoundaryISO(offsetMonths) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offsetMonths)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function fmtCurrency(n) {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const PROJECT_STATUS_FILTERS = [
  { key: 'planning', label: 'Planning', color: '#534AB7', bg: '#EEEDF9' },
  { key: 'active',   label: 'In Progress', color: '#6B8F71', bg: '#EAF2EA' },
  { key: 'on-hold',  label: 'Paused', color: '#D4874E', bg: '#FBF0E6' },
]

const GOAL_STATUS_FILTERS = [
  { statKey: 'onTrack',   label: 'On track',    color: '#6B8F71', bg: '#EAF2EA' },
  { statKey: 'atRisk',    label: 'At risk',     color: '#D4874E', bg: '#FBF0E6' },
  { statKey: 'completed', label: 'Completed',   color: '#3E6FB1', bg: '#E8EFF8' },
  { statKey: 'notStarted', label: 'Not started', color: t.colors.textTertiary, bg: t.colors.bg },
]

// The Dashboard header sticks just below the app's own sticky bars
// (TopBar 60px + SubHeader 44px) so the greeting and business name stay
// visible while the Orbi conversation grows.
const STICKY_HEADER_TOP = 104

const cardStyle = { backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '20px 24px', border: `1px solid ${t.colors.borderLight}` }

// Matches the top stat cards on the Snapshot page (Income/Expenses/Net).
const snapshotLabelStyle = { fontSize: t.fontSizes.xs, color: t.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }
const snapshotValueStyle = { fontSize: '22px', fontWeight: '700', color: t.colors.textPrimary, fontFamily: t.fonts.heading, marginBottom: '2px' }

// ── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ label, onViewAll, viewAllColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
      <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: t.colors.textTertiary }}>
        {label}
      </span>
      {onViewAll && (
        <button onClick={onViewAll} style={{ fontSize: t.fontSizes.xs, color: viewAllColor || t.colors.primary, background: 'none', border: 'none', cursor: 'pointer', fontFamily: t.fonts.sans, fontWeight: '600' }}>
          View all →
        </button>
      )}
    </div>
  )
}

// ── Stat primitives ──────────────────────────────────────────────────────────

function StatNumber({ value, label }) {
  return (
    <div>
      <div style={{ fontSize: '26px', fontWeight: '700', color: t.colors.textPrimary, fontFamily: t.fonts.heading, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '2px' }}>{label}</div>
    </div>
  )
}

function StatPill({ label, count, color, bg }) {
  return (
    <span style={{ fontSize: t.fontSizes.xs, fontWeight: '600', padding: '3px 10px', borderRadius: t.radius.full, backgroundColor: bg, color, whiteSpace: 'nowrap' }}>
      {label} ({count})
    </span>
  )
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard({ session, businessSpaceId, userRole, onNavigate }) {
  const modules = getModules(businessSpaceId)
  const [settings, setSettings] = useState(null)
  const headerSentinelRef = useRef(null)
  const [headerStuck, setHeaderStuck] = useState(false)


  // Project pulse
  const [projectPulse, setProjectPulse] = useState({ active: 0, overdue: 0, dueThisWeek: 0, statusCounts: { planning: 0, active: 0, 'on-hold': 0 } })

  // Revenue snapshot (director only)
  const isDirector = ['owner', 'co-owner'].includes(userRole)
  const [revenueSnapshot, setRevenueSnapshot] = useState({ income: 0, incomeLastMonth: 0, expenses: 0 })

  // Team goals progress
  const [goalsProgress, setGoalsProgress] = useState({ onTrack: 0, atRisk: 0, completed: 0, notStarted: 0, total: 0 })

  function getGreeting() {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  function getTodayLabel() {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  async function fetchSettings() {
    if (!session) return
    const { data } = await supabase.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle()
    const { data: business } = businessSpaceId
      ? await supabase.from('business_spaces').select('name, logo_url').eq('id', businessSpaceId).single()
      : { data: null }
    setSettings({ ...data, business_name: business?.name || '', logo_url: business?.logo_url || '' })
  }

  async function fetchProjectPulse() {
    if (!businessSpaceId || !modules.clientManagement) return
    const todayStr = new Date().toISOString().slice(0, 10)
    const weekOutStr = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

    const [projectsRes, tasksRes, milestonesRes] = await Promise.all([
      supabase.from('projects').select('id, status').eq('business_space_id', businessSpaceId).eq('type', 'project').in('status', ['planning', 'active', 'on-hold']),
      supabase.from('tasks').select('due_date, status').eq('business_space_id', businessSpaceId).not('project_id', 'is', null).not('due_date', 'is', null).neq('status', 'done'),
      supabase.from('project_milestones').select('target_date, status').eq('business_space_id', businessSpaceId).not('target_date', 'is', null).neq('status', 'done'),
    ])
    const projects = projectsRes.data || []

    const statusCounts = { planning: 0, active: 0, 'on-hold': 0 }
    for (const p of projects) if (statusCounts[p.status] !== undefined) statusCounts[p.status]++

    const deadlineDates = [
      ...(tasksRes.data || []).map(row => row.due_date),
      ...(milestonesRes.data || []).map(row => row.target_date),
    ]
    const overdue = deadlineDates.filter(d => d < todayStr).length
    const dueThisWeek = deadlineDates.filter(d => d >= todayStr && d <= weekOutStr).length

    setProjectPulse({ active: projects.length, overdue, dueThisWeek, statusCounts })
  }

  async function fetchRevenueSnapshot() {
    if (!businessSpaceId || !isDirector || !modules.money) return
    const thisMonthStart = monthBoundaryDate(0)
    const thisMonthEnd = monthBoundaryDate(1)
    const lastMonthStart = monthBoundaryDate(-1)

    const [invoicesRes, revenueRes, expensesRes] = await Promise.all([
      supabase.from('invoices').select('invoice_payments(amount, paid_date)').eq('business_space_id', businessSpaceId),
      supabase.from('revenue').select('amount, date, status').eq('business_space_id', businessSpaceId),
      supabase.from('expenses').select('amount, date').eq('business_space_id', businessSpaceId),
    ])

    const allPayments = (invoicesRes.data || []).flatMap(inv => inv.invoice_payments || [])
    const receivedRevenue = (revenueRes.data || []).filter(r => r.status === 'received')
    const expenses = expensesRes.data || []

    const inRange = (dateStr, start, end) => dateStr && dateStr >= start && dateStr < end
    const sumIncomeInRange = (start, end) =>
      allPayments.filter(p => inRange(p.paid_date, start, end)).reduce((s, p) => s + Number(p.amount || 0), 0) +
      receivedRevenue.filter(r => inRange(r.date, start, end)).reduce((s, r) => s + Number(r.amount || 0), 0)
    const sumExpensesInRange = (start, end) =>
      expenses.filter(e => inRange(e.date, start, end)).reduce((s, e) => s + Number(e.amount || 0), 0)

    setRevenueSnapshot({
      income: sumIncomeInRange(thisMonthStart, thisMonthEnd),
      incomeLastMonth: sumIncomeInRange(lastMonthStart, thisMonthStart),
      expenses: sumExpensesInRange(thisMonthStart, thisMonthEnd),
    })
  }

  async function fetchGoalsProgress() {
    if (!businessSpaceId || !modules.team) return
    const { data } = await supabase.from('team_goals').select('status').eq('business_space_id', businessSpaceId)
    const goals = data || []
    setGoalsProgress({
      onTrack: goals.filter(g => g.status === 'on-track').length,
      atRisk: goals.filter(g => g.status === 'at-risk').length,
      completed: goals.filter(g => g.status === 'completed').length,
      notStarted: goals.filter(g => g.status === 'not-started').length,
      total: goals.length,
    })
  }

  // Shrinks the header to one compact row once it's pinned under the top
  // bars: a 1px sentinel above it scrolls out of view exactly when it sticks.
  useEffect(() => {
    const el = headerSentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setHeaderStuck(!entry.isIntersecting),
      { rootMargin: `-${STICKY_HEADER_TOP}px 0px 0px 0px`, threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      fetchSettings()
      fetchProjectPulse()
      fetchRevenueSnapshot()
      fetchGoalsProgress()
    })
  }, [businessSpaceId])

  const revenueDelta = revenueSnapshot.income - revenueSnapshot.incomeLastMonth
  const netThisMonth = revenueSnapshot.income - revenueSnapshot.expenses

  const firstName = settings?.first_name || session?.user?.email?.split('@')[0] || ''
  const workspaceName = settings?.business_name || ''
  const workspaceLogo = settings?.logo_url || ''
  const initials = (firstName || 'U').charAt(0).toUpperCase()

  return (
    <div style={{ padding: '28px 32px', fontFamily: t.fonts.sans, maxWidth: '1200px' }}>

      {/* ── Header (sticky; compacts to one row once pinned) ── */}
      <div ref={headerSentinelRef} style={{ height: '1px', marginBottom: '-1px' }} />
      <div style={{
        position: 'sticky', top: STICKY_HEADER_TOP, zIndex: 20,
        margin: '0 -32px 24px', padding: headerStuck ? '10px 32px' : '0 32px',
        display: 'flex', flexDirection: headerStuck ? 'row' : 'column', alignItems: 'center', justifyContent: 'center',
        gap: '10px',
        backgroundColor: headerStuck ? 'color-mix(in srgb, var(--color-bg) 85%, transparent)' : 'transparent',
        backdropFilter: headerStuck ? 'blur(10px)' : 'none',
        WebkitBackdropFilter: headerStuck ? 'blur(10px)' : 'none',
        borderBottom: `1px solid ${headerStuck ? t.colors.borderLight : 'transparent'}`,
        transition: 'padding 0.2s ease, background-color 0.2s ease',
      }}>
        {workspaceLogo ? (
          <img src={workspaceLogo} alt="logo" style={{ width: headerStuck ? '32px' : '64px', height: headerStuck ? '32px' : '64px', borderRadius: t.radius.full, objectFit: 'cover', border: `1px solid ${t.colors.borderLight}`, flexShrink: 0, transition: 'width 0.2s ease, height 0.2s ease' }} />
        ) : (
          <div style={{
            width: headerStuck ? '32px' : '64px', height: headerStuck ? '32px' : '64px', borderRadius: t.radius.full,
            backgroundColor: t.colors.primary, color: t.colors.textInverse,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: headerStuck ? '13px' : '22px', fontWeight: '700', fontFamily: t.fonts.sans,
            flexShrink: 0, transition: 'width 0.2s ease, height 0.2s ease',
          }}>
            {initials}
          </div>
        )}
        <div style={{ textAlign: headerStuck ? 'left' : 'center', minWidth: 0 }}>
          <div style={{ fontFamily: t.fonts.heading, fontSize: headerStuck ? '16px' : '22px', fontWeight: '700', color: t.colors.textPrimary, letterSpacing: '-0.4px', lineHeight: 1.2, whiteSpace: headerStuck ? 'nowrap' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {getGreeting()}, {firstName} 👋
          </div>
          {workspaceName && (
            <div style={{ fontSize: headerStuck ? t.fontSizes.xs : t.fontSizes.sm, color: t.colors.textSecondary, marginTop: '2px', fontWeight: '600', whiteSpace: headerStuck ? 'nowrap' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {workspaceName}
            </div>
          )}
          {!headerStuck && (
            <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '2px' }}>
              {getTodayLabel()}
            </div>
          )}
        </div>
      </div>

      {/* ── Orbi: ask questions or jot things down ── */}
      <OrbiCard session={session} onItemsAdded={() => { fetchProjectPulse(); fetchRevenueSnapshot(); fetchGoalsProgress() }} />

      {/* ── Revenue Snapshot — director only, styled like the Snapshot page's top stat cards ── */}
      {isDirector && modules.money && (
        <div style={{ marginBottom: '16px' }}>
          <SectionHeader label="Revenue Snapshot" onViewAll={() => onNavigate('snapshot')} viewAllColor={t.colors.primary} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
            <div style={cardStyle}>
              <div style={snapshotLabelStyle}>Income</div>
              <div style={snapshotValueStyle}>{fmtCurrency(revenueSnapshot.income)}</div>
              <div style={{ fontSize: t.fontSizes.xs, color: revenueDelta >= 0 ? '#6B8F71' : '#B3453D' }}>
                {revenueDelta >= 0 ? '↑' : '↓'} {fmtCurrency(Math.abs(revenueDelta))} vs last month
              </div>
            </div>
            <div style={cardStyle}>
              <div style={snapshotLabelStyle}>Expenses</div>
              <div style={snapshotValueStyle}>{fmtCurrency(revenueSnapshot.expenses)}</div>
              <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>This month</div>
            </div>
            <div style={{ ...cardStyle, border: `1px solid ${netThisMonth < 0 ? '#B3453D' : t.colors.borderLight}` }}>
              <div style={snapshotLabelStyle}>Net</div>
              <div style={{ ...snapshotValueStyle, color: netThisMonth < 0 ? '#B3453D' : t.colors.textPrimary }}>{fmtCurrency(netThisMonth)}</div>
              <div style={{ fontSize: t.fontSizes.xs, color: netThisMonth < 0 ? '#B3453D' : t.colors.textTertiary }}>
                {netThisMonth < 0 ? 'Spending more than earning' : 'Income exceeds spend'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stat cards ── */}
      {(modules.clientManagement || modules.team) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '16px' }}>

          {/* Project Pulse */}
          {modules.clientManagement && (
            <div style={cardStyle}>
              <SectionHeader label="Project Pulse" onViewAll={() => onNavigate('projects')} viewAllColor={t.colors.primary} />
              <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
                <StatNumber value={projectPulse.overdue} label="Overdue" />
                <StatNumber value={projectPulse.dueThisWeek} label="Due this week" />
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {PROJECT_STATUS_FILTERS.map(f => (
                  <StatPill key={f.key} label={f.label} count={projectPulse.statusCounts[f.key]} color={f.color} bg={f.bg} />
                ))}
              </div>
              <div style={{ fontSize: t.fontSizes.sm, color: projectPulse.overdue > 0 ? '#B3453D' : t.colors.textTertiary }}>
                {projectPulse.overdue > 0
                  ? `${projectPulse.overdue} task${projectPulse.overdue === 1 ? '' : 's'}/milestone${projectPulse.overdue === 1 ? '' : 's'} past due`
                  : "Nothing overdue"}
              </div>
            </div>
          )}

          {/* Team Goals — status breakdown */}
          {modules.team && (
            <div style={cardStyle}>
              <SectionHeader label="Team Goals" onViewAll={() => onNavigate('team-goals')} viewAllColor={t.colors.primary} />
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '26px', fontWeight: '700', color: t.colors.textPrimary, fontFamily: t.fonts.heading, lineHeight: 1.1 }}>
                  {goalsProgress.total}
                </div>
                <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '2px' }}>total goals</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {GOAL_STATUS_FILTERS.map(f => (
                  <StatPill key={f.statKey} label={f.label} count={goalsProgress[f.statKey]} color={f.color} bg={f.bg} />
                ))}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  )
}
