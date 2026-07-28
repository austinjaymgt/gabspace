import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import { quarterInfoFromDate } from '../utils/dates'

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const cardStyle = { background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '20px 24px' }
const selectStyle = { padding: '8px 12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, color: t.colors.textPrimary, background: t.colors.bgCard, fontFamily: t.fonts.sans }

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_QUARTER = `Q${Math.floor(new Date().getMonth() / 3) + 1}`

export default function Snapshot({ businessSpaceId, userRole, onNavigate }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [year, setYear] = useState(CURRENT_YEAR)
  const [quarter, setQuarter] = useState(CURRENT_QUARTER)

  const isDirector = ['owner', 'co-owner'].includes(userRole)

  useEffect(() => {
    if (businessSpaceId) fetchAll()
  }, [businessSpaceId, year, quarter])

  async function fetchAll() {
    setLoading(true)
    const inQuarter = dateStr => {
      const info = quarterInfoFromDate(dateStr)
      return info && info.year === year && info.quarter === quarter
    }

    const [expenseRes, revenueRes, invoiceRes] = await Promise.all([
      supabase.from('expenses').select('amount, date, category').eq('business_space_id', businessSpaceId),
      supabase.from('revenue').select('amount, date, status').eq('business_space_id', businessSpaceId),
      supabase.from('invoices').select('id, invoice_payments(amount, paid_date)').eq('business_space_id', businessSpaceId),
    ])

    const quarterExpenses = (expenseRes.data || []).filter(e => inQuarter(e.date))
    const actualExpenses = quarterExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)

    const byCategory = {}
    quarterExpenses.forEach(e => {
      const cat = e.category || 'Uncategorized'
      byCategory[cat] = (byCategory[cat] || 0) + Number(e.amount || 0)
    })
    const expenseCategories = Object.entries(byCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)

    const quarterRevenue = (revenueRes.data || []).filter(r => inQuarter(r.date))
    const additionalIncomeReceived = quarterRevenue.filter(r => r.status === 'received').reduce((s, r) => s + Number(r.amount || 0), 0)
    const additionalIncomePending = quarterRevenue.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.amount || 0), 0)

    const quarterPayments = (invoiceRes.data || [])
      .flatMap(inv => inv.invoice_payments || [])
      .filter(p => inQuarter(p.paid_date))
    const invoiceIncomeReceived = quarterPayments.reduce((s, p) => s + Number(p.amount || 0), 0)

    const totalIncomeReceived = additionalIncomeReceived + invoiceIncomeReceived

    setData({
      quarter: `${quarter} ${year}`,
      actualExpenses,
      expenseCategories,
      invoiceIncomeReceived,
      additionalIncomeReceived,
      additionalIncomePending,
      totalIncomeReceived,
      net: totalIncomeReceived - actualExpenses,
    })
    setLoading(false)
  }

  if (!isDirector) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: t.fonts.sans }}>
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ fontSize: t.fontSizes.xl, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px' }}>Director access only</h2>
        <p style={{ fontSize: t.fontSizes.md, color: t.colors.textTertiary }}>Financial snapshots are restricted to department directors.</p>
      </div>
    )
  }

  if (loading || !data) {
    return <div style={{ color: t.colors.textTertiary, textAlign: 'center', padding: '60px', fontFamily: t.fonts.sans }}>Loading...</div>
  }

  return (
    <div style={{ padding: '32px 40px', fontFamily: t.fonts.sans, maxWidth: '1000px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: t.fontSizes.xs, fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.primary, marginBottom: '6px' }}>Money</div>
          <h2 style={{ fontFamily: t.fonts.heading, fontSize: '22px', fontWeight: '800', color: t.colors.textPrimary, letterSpacing: '-0.02em', margin: 0 }}>
            Snapshot · {data.quarter}
          </h2>
          <p style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, margin: '6px 0 0' }}>How the business is doing this quarter, combining Income and Expenses.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select value={quarter} onChange={e => setQuarter(e.target.value)} style={selectStyle}>
            {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={selectStyle}>
            {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div style={cardStyle}>
          <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Income</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: t.colors.textPrimary, fontFamily: t.fonts.heading, marginBottom: '2px' }}>{fmt(data.totalIncomeReceived)}</div>
          {data.additionalIncomePending > 0 && (
            <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{fmt(data.additionalIncomePending)} pending</div>
          )}
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Expenses</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: t.colors.textPrimary, fontFamily: t.fonts.heading, marginBottom: '2px' }}>{fmt(data.actualExpenses)}</div>
          <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>This quarter</div>
        </div>
        <div style={{ ...cardStyle, border: `1px solid ${data.net < 0 ? t.colors.danger : t.colors.border}` }}>
          <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Net</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: data.net < 0 ? t.colors.danger : t.colors.textPrimary, fontFamily: t.fonts.heading, marginBottom: '2px' }}>{fmt(data.net)}</div>
          <div style={{ fontSize: t.fontSizes.xs, color: data.net < 0 ? t.colors.danger : t.colors.textTertiary }}>
            {data.net < 0 ? 'Spending more than earning' : 'Income exceeds spend'}
          </div>
        </div>
      </div>

      {/* Breakdown panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
        <div style={cardStyle}>
          <h3 style={{ fontFamily: t.fonts.heading, fontSize: '16px', fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 14px' }}>Income breakdown</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${t.colors.borderLight}` }}>
            <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>Invoices</span>
            <span style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>{fmt(data.invoiceIncomeReceived)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>Additional income</span>
            <span style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>{fmt(data.additionalIncomeReceived)}</span>
          </div>
          {onNavigate && (
            <button onClick={() => onNavigate('income')} style={{ marginTop: '10px', background: 'none', border: 'none', color: t.colors.primary, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans, fontSize: t.fontSizes.sm, padding: 0 }}>
              View Income →
            </button>
          )}
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontFamily: t.fonts.heading, fontSize: '16px', fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 14px' }}>Expense breakdown</h3>
          {data.expenseCategories.length === 0 ? (
            <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>No expenses logged yet this quarter.</div>
          ) : (
            data.expenseCategories.slice(0, 5).map(c => (
              <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${t.colors.borderLight}` }}>
                <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>{c.category}</span>
                <span style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>{fmt(c.amount)}</span>
              </div>
            ))
          )}
          {onNavigate && (
            <button onClick={() => onNavigate('expenses')} style={{ marginTop: '10px', background: 'none', border: 'none', color: t.colors.primary, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans, fontSize: t.fontSizes.sm, padding: 0 }}>
              View Expenses →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
