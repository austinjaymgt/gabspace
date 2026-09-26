import { z } from 'npm:zod@^4.3.6'
import { check, resolveBusiness, todayISO, ToolError, type Business, type ToolContext } from '../context.ts'
import { businessIdField, defineTool, isoDate, limitField } from '../types.ts'

// Financial tables are owner/co-owner only under RLS; say so up front
// instead of letting an employee's query quietly come back empty.
function moneyBusiness(ctx: ToolContext, businessSpaceId: string | undefined): Business {
  const business = resolveBusiness(ctx, businessSpaceId, 'money')
  if (!['owner', 'co-owner'].includes(business.role)) {
    throw new ToolError(`Money in ${business.name} is only visible to owners and co-owners.`, 'denied')
  }
  return business
}

// Same derivation as computeDisplayStatus in src/utils/invoiceStatus.js -
// only draft/sent/paid are stored; partial and overdue are always derived.
function displayStatus(invoice: { status: string; due_date: string | null; amount_paid: number | string | null }, today: string) {
  if (invoice.status === 'paid') return 'paid'
  if (invoice.status === 'draft') return 'draft'
  if (invoice.due_date && invoice.due_date < today) return 'overdue'
  if (Number(invoice.amount_paid) > 0) return 'partial'
  return 'sent'
}

const round = (n: number) => Math.round(n * 100) / 100

export const listInvoices = defineTool({
  name: 'list_invoices',
  title: 'List invoices',
  description: 'List invoices of the active business with their current status (draft, sent, partial, paid, overdue) and outstanding balance. Owners and co-owners only. "Overdue" is computed against today in UTC.',
  input: z.object({
    business_space_id: businessIdField,
    status: z.enum(['draft', 'sent', 'partial', 'paid', 'overdue', 'unpaid']).optional()
      .describe('"unpaid" means sent, partial or overdue.'),
    client_id: z.string().uuid().optional(),
    limit: limitField,
  }),
  readOnly: true,
  handler: async (ctx, { business_space_id, status, client_id, limit }) => {
    const business = moneyBusiness(ctx, business_space_id)
    const today = todayISO()
    let query = ctx.supabase
      .from('invoices')
      .select('id, invoice_number, status, total_amount, amount_paid, due_date, paid_date, sent_at, client_id, clients(name), project_id, projects(title)')
      .eq('business_space_id', business.id)
      .order('due_date', { ascending: false, nullsFirst: false })
      .limit(500)
    if (client_id) query = query.eq('client_id', client_id)
    if (status === 'paid' || status === 'draft') query = query.eq('status', status)

    const rows = check(await query, 'invoices') as any[]
    const invoices = rows
      .map(({ status: stored, ...inv }) => {
        const shown = displayStatus({ status: stored, due_date: inv.due_date, amount_paid: inv.amount_paid }, today)
        return { ...inv, status: shown, balance_due: shown === 'paid' || shown === 'draft' ? 0 : round(Number(inv.total_amount) - Number(inv.amount_paid || 0)) }
      })
      .filter(inv => !status || (status === 'unpaid' ? ['sent', 'partial', 'overdue'].includes(inv.status) : inv.status === status))

    return { business: business.name, today, total_matching: invoices.length, invoices: invoices.slice(0, limit) }
  },
})

function currentQuarter(today: string) {
  const [y, m] = today.split('-').map(Number)
  const startMonth = Math.floor((m - 1) / 3) * 3 + 1
  const endMonth = startMonth + 2
  const lastDay = new Date(Date.UTC(y, endMonth, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return { from: `${y}-${pad(startMonth)}-01`, to: `${y}-${pad(endMonth)}-${pad(lastDay)}` }
}

export const getMoneySnapshot = defineTool({
  name: 'get_money_snapshot',
  title: 'Money snapshot',
  description: 'Summarize money for the active business over a date range (defaults to the current quarter, like the Snapshot page): invoice payments received, other income received/pending, expenses by category, and what is currently outstanding or overdue. Owners and co-owners only.',
  input: z.object({
    business_space_id: businessIdField,
    from: isoDate.optional(),
    to: isoDate.optional(),
  }),
  readOnly: true,
  handler: async (ctx, args) => {
    const business = moneyBusiness(ctx, args.business_space_id)
    const today = todayISO()
    const quarter = currentQuarter(today)
    const from = args.from ?? quarter.from
    const to = args.to ?? quarter.to
    const inRange = (d: string | null) => !!d && d >= from && d <= to

    const [invoicesRes, revenueRes, expensesRes] = await Promise.all([
      ctx.supabase.from('invoices').select('status, total_amount, amount_paid, due_date, invoice_payments(amount, paid_date)').eq('business_space_id', business.id),
      ctx.supabase.from('revenue').select('amount, date, status').eq('business_space_id', business.id).gte('date', from).lte('date', to),
      ctx.supabase.from('expenses').select('amount, date, category').eq('business_space_id', business.id).gte('date', from).lte('date', to),
    ])
    const invoices = check(invoicesRes, 'invoices') as any[]
    const revenue = check(revenueRes, 'income') as any[]
    const expenses = check(expensesRes, 'expenses') as any[]

    const invoicePayments = invoices.flatMap(i => i.invoice_payments || []).filter((p: any) => inRange(p.paid_date))
    const sum = (rows: any[]) => round(rows.reduce((s, r) => s + Number(r.amount || 0), 0))

    const byCategory: Record<string, number> = {}
    for (const e of expenses) {
      const key = e.category || 'Uncategorized'
      byCategory[key] = round((byCategory[key] || 0) + Number(e.amount || 0))
    }

    let outstanding = 0, overdueAmount = 0, overdueCount = 0
    for (const inv of invoices) {
      const shown = displayStatus(inv, today)
      if (shown === 'paid' || shown === 'draft') continue
      const balance = Number(inv.total_amount) - Number(inv.amount_paid || 0)
      outstanding += balance
      if (shown === 'overdue') { overdueAmount += balance; overdueCount++ }
    }

    const invoiceIncome = sum(invoicePayments)
    const otherReceived = sum(revenue.filter(r => r.status === 'received'))
    const expenseTotal = sum(expenses)
    return {
      business: business.name,
      range: { from, to },
      income: {
        invoice_payments_received: invoiceIncome,
        other_income_received: otherReceived,
        other_income_pending: sum(revenue.filter(r => r.status === 'pending')),
        total_received: round(invoiceIncome + otherReceived),
      },
      expenses: { total: expenseTotal, by_category: byCategory },
      net_received_minus_expenses: round(invoiceIncome + otherReceived - expenseTotal),
      // Point-in-time as of today, regardless of range.
      as_of_today: { date: today, outstanding_invoice_balance: round(outstanding), overdue_invoice_count: overdueCount, overdue_invoice_balance: round(overdueAmount) },
    }
  },
})
