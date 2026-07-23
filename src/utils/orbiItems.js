import { supabase } from '../supabaseClient'
import { computeDisplayStatus } from './invoiceStatus'

const WEEK_MS = 7 * 86400000
const ITEM_CAP = 8

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function parseDateOnly(s) {
  return new Date(s + 'T00:00:00')
}

// Overdue first, then due today, then due this week.
function rankForDiff(daysDiff) {
  if (daysDiff < 0) return 0
  if (daysDiff === 0) return 1
  return 2
}

// Pulls the prioritized business items (overdue/upcoming tasks, invoices,
// events, projects) for the current business space and shapes them into
// the flat item format Orbi's prompt expects. Scoped to a single business
// space, matching Dashboard.jsx rather than Home.jsx's cross-business feed,
// since the corner Orb only appears once inside a business space.
export async function fetchOrbiItems(businessSpaceId) {
  if (!businessSpaceId) return []

  const today0 = startOfToday()
  const weekEnd = new Date(today0.getTime() + WEEK_MS)

  const [tasksRes, invoicesRes, eventsRes, businessEventsRes, projectsRes] = await Promise.all([
    supabase.from('tasks').select('id, title, due_date').eq('business_space_id', businessSpaceId).neq('status', 'done'),
    supabase.from('invoices').select('id, invoice_number, total_amount, amount_paid, due_date, status, clients(name)').eq('business_space_id', businessSpaceId),
    supabase.from('events').select('id, name, event_date').eq('business_space_id', businessSpaceId),
    supabase.from('business_events').select('id, name, date').eq('business_space_id', businessSpaceId),
    supabase.from('projects').select('id, title, end_date').eq('business_space_id', businessSpaceId).eq('type', 'project').in('status', ['planning', 'active', 'on-hold']),
  ])

  const items = []

  for (const task of tasksRes.data || []) {
    if (!task.due_date) continue
    const due = parseDateOnly(task.due_date)
    if (due > weekEnd) continue
    const daysDiff = Math.round((due - today0) / 86400000)
    items.push({
      source_id: `task:${task.id}`,
      type: 'task',
      rank: rankForDiff(daysDiff),
      facts: { name: task.title, due_date: task.due_date, days_diff: daysDiff },
      action: { label: 'View task', handler: 'tasks', target_id: task.id },
    })
  }

  for (const invoice of invoicesRes.data || []) {
    if (computeDisplayStatus(invoice) !== 'overdue') continue
    const due = invoice.due_date ? parseDateOnly(invoice.due_date) : null
    const daysDiff = due ? Math.round((due - today0) / 86400000) : null
    const amountDue = parseFloat(invoice.total_amount || 0) - parseFloat(invoice.amount_paid || 0)
    items.push({
      source_id: `invoice:${invoice.id}`,
      type: 'invoice',
      rank: 0,
      facts: {
        name: invoice.clients?.name || `Invoice ${invoice.invoice_number}`,
        invoice_number: invoice.invoice_number,
        amount_due: amountDue,
        due_date: invoice.due_date,
        days_diff: daysDiff,
      },
      action: { label: 'View invoice', handler: 'income', target_id: invoice.id },
    })
  }

  const upcomingEvents = [
    ...(eventsRes.data || []).map(e => ({ id: e.id, name: e.name, date: e.event_date, handler: 'events' })),
    ...(businessEventsRes.data || []).map(e => ({ id: e.id, name: e.name, date: e.date, handler: 'business-events' })),
  ]
  for (const event of upcomingEvents) {
    if (!event.date) continue
    const due = parseDateOnly(event.date)
    if (due < today0 || due > weekEnd) continue
    const daysDiff = Math.round((due - today0) / 86400000)
    items.push({
      source_id: `${event.handler}:${event.id}`,
      type: 'event',
      rank: rankForDiff(daysDiff),
      facts: { name: event.name, date: event.date, days_diff: daysDiff },
      action: { label: 'View event', handler: event.handler, target_id: event.id },
    })
  }

  for (const project of projectsRes.data || []) {
    if (!project.end_date) continue
    const due = parseDateOnly(project.end_date)
    if (due > weekEnd) continue
    const daysDiff = Math.round((due - today0) / 86400000)
    items.push({
      source_id: `project:${project.id}`,
      type: 'project',
      rank: rankForDiff(daysDiff),
      facts: { name: project.title, end_date: project.end_date, days_diff: daysDiff },
      action: { label: 'View project', handler: 'projects', target_id: project.id },
    })
  }

  items.sort((a, b) => a.rank - b.rank)
  return items.slice(0, ITEM_CAP)
}
