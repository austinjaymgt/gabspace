import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

export default function FinanceOverview({ onNavigate }) {
  const [loading, setLoading] = useState(true)
  const [revenue, setRevenue] = useState([])
  const [expenses, setExpenses] = useState([])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [{ data: rev }, { data: exp }] = await Promise.all([
      supabase.from('revenue').select('*'),
      supabase.from('expenses').select('*'),
    ])
    setRevenue(rev || [])
    setExpenses(exp || [])
    setLoading(false)
  }

  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()

  function isThisMonth(dateStr) {
    if (!dateStr) return false
    const d = new Date(dateStr)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  }

  function isThisYear(dateStr) {
    if (!dateStr) return false
    return new Date(dateStr).getFullYear() === thisYear
  }

  const monthRevenue = revenue.filter(r => isThisMonth(r.date) && r.status === 'received').reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
  const monthExpenses = expenses.filter(e => isThisMonth(e.date)).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
  const monthNet = monthRevenue - monthExpenses

  const ytdRevenue = revenue.filter(r => isThisYear(r.date) && r.status === 'received').reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
  const ytdExpenses = expenses.filter(e => isThisYear(e.date)).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
  const ytdNet = ytdRevenue - ytdExpenses

  const recurringExpenses = expenses.filter(e => e.recurrence && e.recurrence !== 'One-time' && e.recurrence !== '')
  const monthlyCommitted = recurringExpenses.reduce((sum, e) => {
    const amount = parseFloat(e.amount) || 0
    if (e.recurrence === 'weekly') return sum + (amount * 4)
    if (e.recurrence === 'monthly') return sum + amount
    if (e.recurrence === 'quarterly') return sum + (amount / 3)
    if (e.recurrence === 'annually') return sum + (amount / 12)
    return sum
  }, 0)

  const pendingRevenue = revenue.filter(r => r.status === 'pending')
  const pendingTotal = pendingRevenue.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)

  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  if (loading) return <div style={{ padding: '32px', color: t.colors.textTertiary }}>Loading...</div>

  return (
    <div style={{ padding: '32px', fontFamily: t.fonts.sans }}>
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 4px' }}>
          Finance Overview
        </h2>
        <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: 0 }}>
          A snapshot of your financial health in one place.
        </p>
      </div>

      {/* This month */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
          {monthName}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Revenue', value: monthRevenue, color: '#10B981', prefix: '$' },
            { label: 'Expenses', value: monthExpenses, color: '#cc3333', prefix: '$' },
            { label: 'Net profit', value: monthNet, color: monthNet >= 0 ? '#10B981' : '#cc3333', prefix: '$' },
            { label: 'Recurring/mo', value: monthlyCommitted, color: '#F59E0B', prefix: '$' },
          ].map(card => (
            <div key={card.label} style={{
              backgroundColor: t.colors.bgCard,
              borderRadius: t.radius.lg,
              padding: '20px 24px',
              border: `1px solid ${t.colors.borderLight}`,
            }}>
              <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, marginBottom: '8px' }}>{card.label}</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: card.color, letterSpacing: '-0.5px' }}>
                {card.prefix}{card.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* YTD */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
          Year to date — {thisYear}
        </div>
        <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.borderLight}`, overflow: 'hidden' }}>
          {[
            { label: 'Total revenue', value: ytdRevenue, color: '#10B981' },
            { label: 'Total expenses', value: ytdExpenses, color: '#cc3333' },
            { label: 'Net profit', value: ytdNet, color: ytdNet >= 0 ? '#10B981' : '#cc3333', bold: true },
          ].map((row, i) => (
            <div key={row.label} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: i < 2 ? `1px solid ${t.colors.borderLight}` : 'none',
              backgroundColor: row.bold ? t.colors.bg : 'transparent',
            }}>
              <span style={{ fontSize: t.fontSizes.base, fontWeight: row.bold ? '600' : '400', color: t.colors.textPrimary }}>
                {row.label}
              </span>
              <span style={{ fontSize: row.bold ? '20px' : t.fontSizes.lg, fontWeight: '700', color: row.color }}>
                ${row.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recurring commitments */}
      {recurringExpenses.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
            Recurring commitments
          </div>
          <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.borderLight}`, overflow: 'hidden' }}>
            {recurringExpenses.map((expense, i) => (
              <div key={expense.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 24px',
                borderBottom: i < recurringExpenses.length - 1 ? `1px solid ${t.colors.borderLight}` : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '14px' }}>🔄</span>
                  <div>
                    <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>{expense.title}</div>
                    {expense.category && (
                      <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{expense.category}</div>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: t.fontSizes.base, fontWeight: '600', color: '#cc3333' }}>
                    ${parseFloat(expense.amount).toLocaleString()}
                  </div>
                  <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{expense.recurrence}</div>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', backgroundColor: t.colors.bg, borderTop: `1px solid ${t.colors.borderLight}` }}>
              <span style={{ fontSize: t.fontSizes.base, fontWeight: '600', color: t.colors.textPrimary }}>Monthly equivalent</span>
              <span style={{ fontSize: '18px', fontWeight: '700', color: '#F59E0B' }}>${monthlyCommitted.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo</span>
            </div>
          </div>
        </div>
      )}

      {/* Pending revenue */}
      {pendingRevenue.length > 0 && (
        <div>
          <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
            Outstanding — pending revenue
          </div>
          <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.borderLight}`, overflow: 'hidden' }}>
            {pendingRevenue.map((entry, i) => (
              <div key={entry.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 24px',
                borderBottom: i < pendingRevenue.length - 1 ? `1px solid ${t.colors.borderLight}` : 'none',
              }}>
                <div>
                  <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>{entry.income_stream}</div>
                  {entry.date && (
                    <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
                      {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: t.fontSizes.base, fontWeight: '600', color: '#F59E0B' }}>
                  ${parseFloat(entry.amount).toLocaleString()}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', backgroundColor: t.colors.bg, borderTop: `1px solid ${t.colors.borderLight}` }}>
              <span style={{ fontSize: t.fontSizes.base, fontWeight: '600', color: t.colors.textPrimary }}>Total outstanding</span>
              <span style={{ fontSize: '18px', fontWeight: '700', color: '#F59E0B' }}>${pendingTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {revenue.length === 0 && expenses.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.borderLight}` }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>💵</div>
          <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px' }}>No financial data yet</h3>
          <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '0 0 20px' }}>
            Add revenue and expenses to see your financial overview
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button onClick={() => onNavigate('revenue')} style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', backgroundColor: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', cursor: 'pointer' }}>
              Add revenue
            </button>
            <button onClick={() => onNavigate('expenses')} style={{ padding: '10px 18px', borderRadius: '8px', border: `1px solid ${t.colors.borderLight}`, backgroundColor: '#fff', color: t.colors.textSecondary, fontSize: t.fontSizes.base, cursor: 'pointer' }}>
              Add expense
            </button>
          </div>
        </div>
      )}
    </div>
  )
}