import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import { quarterInfoFromDate, formatDate, resolveDateRange, isDateInRange } from '../utils/dates'
import DateRangeFilter from '../components/DateRangeFilter'

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const cardStyle = { background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '20px 24px' }
const selectStyle = { padding: '8px 12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, color: t.colors.textPrimary, background: t.colors.bgCard, fontFamily: t.fonts.sans }
const tabRowStyle = { display: 'flex', gap: '4px', background: t.colors.bg, borderRadius: t.radius.full, padding: '4px', width: 'fit-content', marginBottom: '24px' }
const tabBtnStyle = active => ({
  padding: '7px 16px', borderRadius: t.radius.full, border: 'none',
  background: active ? t.colors.bgCard : 'transparent',
  color: active ? t.colors.textPrimary : t.colors.textSecondary,
  fontSize: t.fontSizes.sm, fontWeight: active ? '600' : '400',
  fontFamily: t.fonts.sans, cursor: 'pointer', boxShadow: active ? t.shadows.sm : 'none',
})

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_QUARTER = `Q${Math.floor(new Date().getMonth() / 3) + 1}`

const REPORT_TYPES = [
  { key: 'pl', label: 'Profit & Loss' },
  { key: 'income', label: 'Income detail' },
  { key: 'expense', label: 'Expense detail' },
]

// Minimal CSV writer — quotes any value containing a comma, quote, or newline.
function toCSV(headers, rows) {
  const esc = v => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers, ...rows].map(r => r.map(esc).join(',')).join('\n')
}

function downloadCSV(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function Snapshot({ businessSpaceId, userRole, onNavigate }) {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  // Raw records, fetched once — the Overview tab scopes them to a quarter,
  // the Reports tab scopes them to its own date range.
  const [expenses, setExpenses] = useState([])
  const [revenue, setRevenue] = useState([])
  const [invoicePayments, setInvoicePayments] = useState([])

  const [year, setYear] = useState(CURRENT_YEAR)
  const [quarter, setQuarter] = useState(CURRENT_QUARTER)

  const [reportType, setReportType] = useState('pl')
  const [reportDateFilterPreset, setReportDateFilterPreset] = useState('ytd')
  const [reportDateFilterStart, setReportDateFilterStart] = useState('')
  const [reportDateFilterEnd, setReportDateFilterEnd] = useState('')

  const isDirector = ['owner', 'co-owner'].includes(userRole)

  useEffect(() => {
    if (businessSpaceId) fetchAll()
  }, [businessSpaceId])

  async function fetchAll() {
    setLoading(true)
    const [expenseRes, revenueRes, invoiceRes] = await Promise.all([
      supabase.from('expenses').select('title, amount, date, category, vendors(name)').eq('business_space_id', businessSpaceId),
      supabase.from('revenue').select('income_stream, amount, date, status, tax_category').eq('business_space_id', businessSpaceId),
      supabase.from('invoices').select('invoice_number, clients(name), invoice_payments(amount, paid_date)').eq('business_space_id', businessSpaceId),
    ])
    setExpenses(expenseRes.data || [])
    setRevenue(revenueRes.data || [])
    setInvoicePayments(
      (invoiceRes.data || []).flatMap(inv =>
        (inv.invoice_payments || []).map(p => ({
          amount: p.amount,
          date: p.paid_date,
          invoice_number: inv.invoice_number,
          client_name: inv.clients ? inv.clients.name : null,
        }))
      )
    )
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

  if (loading) {
    return <div style={{ color: t.colors.textTertiary, textAlign: 'center', padding: '60px', fontFamily: t.fonts.sans }}>Loading...</div>
  }

  // ── Overview: quarter-scoped ──
  const inQuarter = dateStr => {
    const info = quarterInfoFromDate(dateStr)
    return info && info.year === year && info.quarter === quarter
  }
  const quarterExpenses = expenses.filter(e => inQuarter(e.date))
  const actualExpenses = quarterExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const byCategory = {}
  quarterExpenses.forEach(e => {
    const cat = e.category || 'Uncategorized'
    byCategory[cat] = (byCategory[cat] || 0) + Number(e.amount || 0)
  })
  const expenseCategories = Object.entries(byCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
  const quarterRevenue = revenue.filter(r => inQuarter(r.date))
  const additionalIncomeReceived = quarterRevenue.filter(r => r.status === 'received').reduce((s, r) => s + Number(r.amount || 0), 0)
  const additionalIncomePending = quarterRevenue.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.amount || 0), 0)
  const quarterPayments = invoicePayments.filter(p => inQuarter(p.date))
  const invoiceIncomeReceived = quarterPayments.reduce((s, p) => s + Number(p.amount || 0), 0)
  const totalIncomeReceived = additionalIncomeReceived + invoiceIncomeReceived
  const netQuarter = totalIncomeReceived - actualExpenses

  // ── Reports: scoped to their own date range ──
  const reportDateRange = resolveDateRange(reportDateFilterPreset, { start: reportDateFilterStart, end: reportDateFilterEnd })
  const reportExpenses = expenses.filter(e => isDateInRange(e.date, reportDateRange)).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  const reportRevenue = revenue.filter(r => isDateInRange(r.date, reportDateRange))
  const reportPayments = invoicePayments.filter(p => isDateInRange(p.date, reportDateRange))

  const reportIncomeRows = [
    ...reportPayments.map(p => ({ date: p.date, source: p.invoice_number ? `Invoice ${p.invoice_number}` : 'Invoice', type: 'Invoice', category: p.client_name || '—', status: 'received', amount: Number(p.amount || 0) })),
    ...reportRevenue.map(r => ({ date: r.date, source: r.income_stream, type: 'Additional income', category: r.tax_category || '—', status: r.status, amount: Number(r.amount || 0) })),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

  const reportTotalIncome = reportIncomeRows.filter(r => r.status === 'received').reduce((s, r) => s + r.amount, 0)
  const reportPendingIncome = reportIncomeRows.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0)
  const reportTotalExpenses = reportExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const reportExpensesByCategory = {}
  reportExpenses.forEach(e => {
    const cat = e.category || 'Uncategorized'
    reportExpensesByCategory[cat] = (reportExpensesByCategory[cat] || 0) + Number(e.amount || 0)
  })
  const reportExpenseCategoryRows = Object.entries(reportExpensesByCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
  const reportNet = reportTotalIncome - reportTotalExpenses

  const rangeLabel = reportDateFilterPreset === 'all' ? 'all time'
    : reportDateFilterPreset === 'mtd' ? 'month to date'
    : reportDateFilterPreset === 'ytd' ? 'year to date'
    : `${reportDateRange.start || '…'} to ${reportDateRange.end || '…'}`

  function exportReport() {
    if (reportType === 'pl') {
      const rows = [
        ['Total income (received)', fmt(reportTotalIncome)],
        ['Income pending', fmt(reportPendingIncome)],
        ['Total expenses', fmt(reportTotalExpenses)],
        ['Net', fmt(reportNet)],
        [],
        ['Expenses by category', ''],
        ...reportExpenseCategoryRows.map(c => [c.category, fmt(c.amount)]),
      ]
      downloadCSV(`profit-and-loss_${rangeLabel.replace(/\s+/g, '-')}.csv`, toCSV(['Line', 'Amount'], rows))
    } else if (reportType === 'income') {
      const rows = reportIncomeRows.map(r => [r.date ? formatDate(r.date, { year: 'numeric', month: 'numeric', day: 'numeric' }) : '', r.source, r.type, r.category, r.status, r.amount.toFixed(2)])
      downloadCSV(`income-detail_${rangeLabel.replace(/\s+/g, '-')}.csv`, toCSV(['Date', 'Source', 'Type', 'Category', 'Status', 'Amount'], rows))
    } else {
      const rows = reportExpenses.map(e => [e.date ? formatDate(e.date, { year: 'numeric', month: 'numeric', day: 'numeric' }) : '', e.title, e.category || '—', e.vendors ? e.vendors.name : '—', Number(e.amount || 0).toFixed(2)])
      downloadCSV(`expense-detail_${rangeLabel.replace(/\s+/g, '-')}.csv`, toCSV(['Date', 'Title', 'Category', 'Vendor', 'Amount'], rows))
    }
  }

  return (
    <div style={{ padding: '32px 40px', fontFamily: t.fonts.sans, maxWidth: '1000px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: t.fontSizes.xs, fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.primary, marginBottom: '6px' }}>Money</div>
          <h2 style={{ fontFamily: t.fonts.heading, fontSize: '22px', fontWeight: '800', color: t.colors.textPrimary, letterSpacing: '-0.02em', margin: 0 }}>
            Snapshot
          </h2>
          <p style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, margin: '6px 0 0' }}>How the business is doing, combining Income and Expenses.</p>
        </div>
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select value={quarter} onChange={e => setQuarter(e.target.value)} style={selectStyle}>
              {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={selectStyle}>
              {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
      </div>

      <div style={tabRowStyle}>
        <button onClick={() => setActiveTab('overview')} style={tabBtnStyle(activeTab === 'overview')}>Overview</button>
        <button onClick={() => setActiveTab('reports')} style={tabBtnStyle(activeTab === 'reports')}>Reports</button>
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* Top stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <div style={cardStyle}>
              <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Income</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: t.colors.textPrimary, fontFamily: t.fonts.heading, marginBottom: '2px' }}>{fmt(totalIncomeReceived)}</div>
              {additionalIncomePending > 0 && (
                <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{fmt(additionalIncomePending)} pending</div>
              )}
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Expenses</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: t.colors.textPrimary, fontFamily: t.fonts.heading, marginBottom: '2px' }}>{fmt(actualExpenses)}</div>
              <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>This quarter</div>
            </div>
            <div style={{ ...cardStyle, border: `1px solid ${netQuarter < 0 ? t.colors.danger : t.colors.border}` }}>
              <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Net</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: netQuarter < 0 ? t.colors.danger : t.colors.textPrimary, fontFamily: t.fonts.heading, marginBottom: '2px' }}>{fmt(netQuarter)}</div>
              <div style={{ fontSize: t.fontSizes.xs, color: netQuarter < 0 ? t.colors.danger : t.colors.textTertiary }}>
                {netQuarter < 0 ? 'Spending more than earning' : 'Income exceeds spend'}
              </div>
            </div>
          </div>

          {/* Breakdown panels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
            <div style={cardStyle}>
              <h3 style={{ fontFamily: t.fonts.heading, fontSize: '16px', fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 14px' }}>Income breakdown</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${t.colors.borderLight}` }}>
                <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>Invoices</span>
                <span style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>{fmt(invoiceIncomeReceived)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>Additional income</span>
                <span style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>{fmt(additionalIncomeReceived)}</span>
              </div>
              {onNavigate && (
                <button onClick={() => onNavigate('income')} style={{ marginTop: '10px', background: 'none', border: 'none', color: t.colors.primary, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans, fontSize: t.fontSizes.sm, padding: 0 }}>
                  View Income →
                </button>
              )}
            </div>

            <div style={cardStyle}>
              <h3 style={{ fontFamily: t.fonts.heading, fontSize: '16px', fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 14px' }}>Expense breakdown</h3>
              {expenseCategories.length === 0 ? (
                <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>No expenses logged yet this quarter.</div>
              ) : (
                expenseCategories.slice(0, 5).map(c => (
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
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
            <select value={reportType} onChange={e => setReportType(e.target.value)} style={selectStyle}>
              {REPORT_TYPES.map(rt => <option key={rt.key} value={rt.key}>{rt.label}</option>)}
            </select>
            <DateRangeFilter
              preset={reportDateFilterPreset}
              start={reportDateFilterStart}
              end={reportDateFilterEnd}
              onPresetChange={setReportDateFilterPreset}
              onStartChange={setReportDateFilterStart}
              onEndChange={setReportDateFilterEnd}
            />
            <button
              onClick={exportReport}
              style={{ marginLeft: 'auto', padding: '9px 18px', borderRadius: t.radius.full, border: 'none', backgroundColor: t.colors.primary, color: '#fff', fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans }}
            >
              Export CSV
            </button>
          </div>

          {reportType === 'pl' && (
            <div style={cardStyle}>
              <h3 style={{ fontFamily: t.fonts.heading, fontSize: '16px', fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 14px' }}>Profit &amp; Loss — {rangeLabel}</h3>
              {[
                ['Total income (received)', fmt(reportTotalIncome)],
                ...(reportPendingIncome > 0 ? [['Income pending', fmt(reportPendingIncome)]] : []),
                ['Total expenses', fmt(reportTotalExpenses)],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${t.colors.borderLight}` }}>
                  <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>{label}</span>
                  <span style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>{value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
                <span style={{ fontSize: t.fontSizes.md, fontWeight: '700', color: t.colors.textPrimary }}>Net</span>
                <span style={{ fontSize: t.fontSizes.md, fontWeight: '700', color: reportNet < 0 ? t.colors.danger : t.colors.success }}>{fmt(reportNet)}</span>
              </div>
              {reportExpenseCategoryRows.length > 0 && (
                <>
                  <div style={{ fontSize: t.fontSizes.xs, fontWeight: '600', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 8px' }}>Expenses by category</div>
                  {reportExpenseCategoryRows.map(c => (
                    <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${t.colors.borderLight}` }}>
                      <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>{c.category}</span>
                      <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textPrimary }}>{fmt(c.amount)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {reportType === 'income' && (
            reportIncomeRows.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', color: t.colors.textTertiary, fontSize: t.fontSizes.sm }}>No income in this date range.</div>
            ) : (
              <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}`, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.8fr) minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 0.8fr)', padding: '10px 20px', backgroundColor: t.colors.bg, borderBottom: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.xs, fontWeight: '600', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <span>Date</span><span>Source</span><span>Type</span><span>Category</span><span>Status</span><span>Amount</span>
                </div>
                {reportIncomeRows.map((r, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.8fr) minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 0.8fr)', padding: '11px 20px', borderBottom: `1px solid ${t.colors.borderLight}`, alignItems: 'center' }}>
                    <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>{r.date ? formatDate(r.date) : '—'}</span>
                    <span style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>{r.source}</span>
                    <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>{r.type}</span>
                    <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>{r.category}</span>
                    <span style={{ fontSize: t.fontSizes.xs, color: r.status === 'received' ? t.colors.success : t.colors.warning }}>{r.status}</span>
                    <span style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>{fmt(r.amount)}</span>
                  </div>
                ))}
              </div>
            )
          )}

          {reportType === 'expense' && (
            reportExpenses.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', color: t.colors.textTertiary, fontSize: t.fontSizes.sm }}>No expenses in this date range.</div>
            ) : (
              <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}`, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.8fr) minmax(0, 1.8fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.8fr)', padding: '10px 20px', backgroundColor: t.colors.bg, borderBottom: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.xs, fontWeight: '600', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <span>Date</span><span>Title</span><span>Category</span><span>Vendor</span><span>Amount</span>
                </div>
                {reportExpenses.map((e, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.8fr) minmax(0, 1.8fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.8fr)', padding: '11px 20px', borderBottom: `1px solid ${t.colors.borderLight}`, alignItems: 'center' }}>
                    <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>{e.date ? formatDate(e.date) : '—'}</span>
                    <span style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>{e.title}</span>
                    <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>{e.category || '—'}</span>
                    <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>{e.vendors ? e.vendors.name : '—'}</span>
                    <span style={{ fontSize: t.fontSizes.sm, fontWeight: '600', color: t.colors.textPrimary }}>{fmt(Number(e.amount || 0))}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}
