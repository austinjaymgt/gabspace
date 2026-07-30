import { supabase } from '../supabaseClient'
import { computeDisplayStatus } from './invoiceStatus'

const DAY_MS = 86400000
const DEFAULT_WINDOW_DAYS = 3
const ITEM_CAP = 8

// Outward-facing business_events types — excludes internal/production
// entries ('Pop-up', 'Workshop', 'Styled shoot', 'Other') that aren't
// really "networking" in the sense Orbi is surfacing them for.
const NETWORKING_EVENT_TYPES = ['Networking mixer', 'Trade show', 'Speaking gig', 'Conference', 'Vendor fair']

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function parseDateOnly(s) {
  return new Date(s + 'T00:00:00')
}

// Overdue first, then due today, then due within the window.
function rankForDiff(daysDiff) {
  if (daysDiff < 0) return 0
  if (daysDiff === 0) return 1
  return 2
}

// Pulls the prioritized items (overdue invoices, upcoming projects,
// networking events, content due dates) across every business space the
// user belongs to and shapes them into the flat item format Orbi's
// prompt expects. Cross-business, like Home.jsx's feed, rather than
// scoped to whichever space happens to be active — the active space's
// items are already visible on its own Dashboard, so repeating just that
// one space here would be redundant. Tasks are deliberately excluded —
// they're the Dashboard's job; Orbi is for the less-visible, more
// interesting stuff (projects wrapping up, events coming up, content due).
export async function fetchOrbiItems(businesses, windowDays = DEFAULT_WINDOW_DAYS) {
  if (!businesses?.length) return []

  const businessIds = businesses.map(b => b.id)
  const nameById = Object.fromEntries(businesses.map(b => [b.id, b.name]))

  const today0 = startOfToday()
  const windowEnd = new Date(today0.getTime() + windowDays * DAY_MS)

  const [invoicesRes, eventsRes, businessEventsRes, projectsRes, contentRes] = await Promise.all([
    supabase.from('invoices').select('id, invoice_number, total_amount, amount_paid, due_date, status, business_space_id, clients(name)').in('business_space_id', businessIds),
    supabase.from('events').select('id, name, event_date, business_space_id').in('business_space_id', businessIds),
    supabase.from('business_events').select('id, name, date, business_space_id').in('business_space_id', businessIds).in('type', NETWORKING_EVENT_TYPES).neq('status', 'completed'),
    supabase.from('projects').select('id, title, end_date, business_space_id').in('business_space_id', businessIds).eq('type', 'project').in('status', ['planning', 'active', 'on-hold']),
    supabase.from('content_calendar').select('id, title, scheduled_date, platform, business_space_id').in('business_space_id', businessIds).neq('status', 'published'),
  ])

  const items = []

  for (const invoice of invoicesRes.data || []) {
    if (computeDisplayStatus(invoice) !== 'overdue') continue
    const due = invoice.due_date ? parseDateOnly(invoice.due_date) : null
    const daysDiff = due ? Math.round((due - today0) / DAY_MS) : null
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
        business_name: nameById[invoice.business_space_id],
      },
      action: { label: 'View invoice', handler: 'income', target_id: invoice.id, business_space_id: invoice.business_space_id },
    })
  }

  const upcomingEvents = [
    ...(eventsRes.data || []).map(e => ({ id: e.id, name: e.name, date: e.event_date, handler: 'events', business_space_id: e.business_space_id })),
    ...(businessEventsRes.data || []).map(e => ({ id: e.id, name: e.name, date: e.date, handler: 'business-events', business_space_id: e.business_space_id })),
  ]
  for (const event of upcomingEvents) {
    if (!event.date) continue
    const due = parseDateOnly(event.date)
    if (due < today0 || due > windowEnd) continue
    const daysDiff = Math.round((due - today0) / DAY_MS)
    items.push({
      source_id: `${event.handler}:${event.id}`,
      type: 'event',
      rank: rankForDiff(daysDiff),
      facts: { name: event.name, date: event.date, days_diff: daysDiff, business_name: nameById[event.business_space_id] },
      action: { label: 'View event', handler: event.handler, target_id: event.id, business_space_id: event.business_space_id },
    })
  }

  for (const project of projectsRes.data || []) {
    if (!project.end_date) continue
    const due = parseDateOnly(project.end_date)
    if (due > windowEnd) continue
    const daysDiff = Math.round((due - today0) / DAY_MS)
    items.push({
      source_id: `project:${project.id}`,
      type: 'project',
      rank: rankForDiff(daysDiff),
      facts: { name: project.title, end_date: project.end_date, days_diff: daysDiff, business_name: nameById[project.business_space_id] },
      action: { label: 'View project', handler: 'projects', target_id: project.id, business_space_id: project.business_space_id },
    })
  }

  for (const content of contentRes.data || []) {
    if (!content.scheduled_date) continue
    const due = parseDateOnly(content.scheduled_date)
    if (due < today0 || due > windowEnd) continue
    const daysDiff = Math.round((due - today0) / DAY_MS)
    items.push({
      source_id: `content:${content.id}`,
      type: 'content',
      rank: rankForDiff(daysDiff),
      facts: { name: content.title, platform: content.platform, scheduled_date: content.scheduled_date, days_diff: daysDiff, business_name: nameById[content.business_space_id] },
      action: { label: 'View content', handler: 'campaign-tracking', target_id: content.id, business_space_id: content.business_space_id },
    })
  }

  items.sort((a, b) => a.rank - b.rank)
  return items.slice(0, ITEM_CAP)
}
