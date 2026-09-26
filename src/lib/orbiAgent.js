import { supabase } from '../supabaseClient'

// One turn of the Dashboard Orbi card (supabase/functions/orbi-agent). `messages` is the
// full conversation in Anthropic message format, exactly as the previous
// response returned it — the server owns its shape, the UI only reads it.
// Pass `approval` ({ approved, result? }) to answer pending drafts/actions.
// Resolves { messages, reply, pending? }; throws with a readable message.
export async function sendOrbiTurn(messages, approval) {
  const { data, error } = await supabase.functions.invoke('orbi-agent', {
    body: approval ? { messages, approval } : { messages },
  })
  if (error) {
    let message = "Orbi couldn't answer just now — try again."
    let code = null
    try {
      const body = await error.context.json()
      code = body?.error || null
      if (code === 'conversation_too_long') message = "This chat's gotten long — start a new one to keep going."
      else if (typeof code === 'string' && code.includes(' ')) message = code
    } catch { /* not a JSON error body */ }
    const err = new Error(message)
    err.code = code
    throw err
  }
  return data
}

// Short labels for the activity lines in the Orbi card.
export const TOOL_LABELS = {
  list_businesses: 'Checked your businesses',
  list_clients: 'Looked at clients',
  get_client: 'Opened a client',
  list_projects: 'Looked at projects',
  get_project: 'Opened a project',
  list_tasks: 'Checked tasks',
  list_invoices: 'Checked invoices',
  get_money_snapshot: 'Ran the numbers',
  list_content_calendar: 'Checked the content calendar',
  list_networking_events: 'Checked networking events',
  search_board: 'Searched The Board',
  create_task: 'Created a task',
  update_task: 'Updated a task',
  create_invoice_draft: 'Drafted an invoice',
  schedule_content: 'Added to the content calendar',
  draft_quick_add: 'Drafted items to add',
}
