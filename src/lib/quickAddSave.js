import { supabase } from '../supabaseClient'

// Matches TeamGoals.jsx's periodFromDate — goals created here need the same "Q# YYYY" format.
function periodFromDate(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date()
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `Q${q} ${d.getFullYear()}`
}

const TYPE_LABELS = {
  client: 'client', task: 'task', business_event: 'event', spark_idea: 'idea', project: 'project',
  content_idea: 'content idea', vendor: 'vendor', goal: 'goal', income: 'income', expense: 'expense', invoice: 'invoice draft',
}

// Saves the Quick Add drafts the user confirmed (Orbi's draft_quick_add
// cards) into `businessSpaceId`. Throws on the first failure. Returns a
// short plain-text list of what was added, which goes back to Orbi so it
// can confirm to the user.
export async function saveQuickAddItems(items, { businessSpaceId, userId }) {
  const added = []
  const clientItems = items.filter(i => i.type === 'client')
  const others = items.filter(i => i.type !== 'client')

  // Clients first so their ids are available for task linking below.
  const nameToClientId = {}
  for (const { fields } of clientItems) {
    const { note, ...clientFields } = fields
    const { data: client, error } = await supabase
      .from('clients')
      .insert({ ...clientFields, business_space_id: businessSpaceId, user_id: userId })
      .select('id, name')
      .single()
    if (error) throw error
    nameToClientId[client.name.toLowerCase()] = client.id
    if (note?.trim()) {
      await supabase.from('notes').insert({
        content: note.trim(), client_id: client.id,
        business_space_id: businessSpaceId, user_id: userId,
      })
    }
    added.push(`client "${client.name}"`)
  }

  for (const { type, fields } of others) {
    let error = null
    if (type === 'task') {
      const { client_name, ...taskFields } = fields
      const client_id = client_name ? nameToClientId[client_name.toLowerCase()] || null : null
      ;({ error } = await supabase.from('tasks').insert({
        ...taskFields, client_id, business_space_id: businessSpaceId, status: 'todo',
      }))
    } else if (type === 'business_event') {
      ;({ error } = await supabase.from('business_events').insert({
        ...fields, type: 'networking', event_type: 'attending', status: 'upcoming',
        business_space_id: businessSpaceId, user_id: userId,
      }))
    } else if (type === 'spark_idea') {
      ;({ error } = await supabase.from('projects').insert({
        title: fields.title, business_space_id: businessSpaceId, user_id: userId,
        type: 'event', event_status: 'concept',
      }))
    } else if (type === 'project') {
      const { title, budget, ...rest } = fields
      ;({ error } = await supabase.from('projects').insert({
        ...rest, title, budget: budget ? parseFloat(budget) : null,
        type: 'project', status: 'planning', has_event_features: false,
        business_space_id: businessSpaceId, user_id: userId,
      }))
    } else if (type === 'content_idea') {
      ;({ error } = await supabase.from('content_calendar').insert({
        ...fields, status: 'idea',
        business_space_id: businessSpaceId, user_id: userId,
      }))
    } else if (type === 'vendor') {
      ;({ error } = await supabase.from('vendors').insert({
        ...fields, tags: [],
        business_space_id: businessSpaceId, user_id: userId,
      }))
    } else if (type === 'goal') {
      const { due_date, ...rest } = fields
      ;({ error } = await supabase.from('team_goals').insert({
        ...rest, due_date: due_date || null, period: periodFromDate(due_date),
        status: 'not-started', category: 'team',
        business_space_id: businessSpaceId,
      }))
    } else if (type === 'income') {
      const { amount, ...rest } = fields
      ;({ error } = await supabase.from('revenue').insert({
        ...rest, amount: parseFloat(amount) || 0, status: 'received',
        business_space_id: businessSpaceId, user_id: userId,
      }))
    } else if (type === 'expense') {
      const { amount, ...rest } = fields
      ;({ error } = await supabase.from('expenses').insert({
        ...rest, amount: parseFloat(amount) || 0,
        business_space_id: businessSpaceId, user_id: userId,
      }))
    } else if (type === 'invoice') {
      const { client_name, amount, description } = fields
      const client_id = client_name ? nameToClientId[client_name.toLowerCase()] || null : null
      const { data: invoice, error: invoiceError } = await supabase.from('invoices').insert({
        client_id, due_date: fields.due_date || null, status: 'draft',
        business_space_id: businessSpaceId, user_id: userId,
      }).select('id').single()
      if (invoiceError) throw invoiceError
      ;({ error } = await supabase.from('line_items').insert({
        invoice_id: invoice.id,
        description: description || (client_name ? `Services for ${client_name}` : 'Services'),
        quantity: 1, unit_price: parseFloat(amount) || 0,
      }))
    }
    if (error) throw error
    const label = fields.title || fields.name || fields.income_stream || fields.client_name
    added.push(`${TYPE_LABELS[type] || type}${label ? ` "${label}"` : ''}`)
  }

  return added.join(', ')
}
