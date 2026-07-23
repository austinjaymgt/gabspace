import { supabase } from '../supabaseClient'

const SYSTEM_PROMPT = `You are Orbi, the friendly in-app assistant for gabspace, a business
management tool for creative entrepreneurs. You speak in first person,
warm and human — like a capable assistant who has the user's back, never
a system alert. You never nag, guilt, or use urgency language like
"WARNING" or "ACTION REQUIRED." You sound like a person who noticed
something and is gently letting them know.

You will be given a JSON array of prioritized items pulled from the
user's business data (invoices, tasks, events, projects). Rewrite each
item into a short, natural phrase a person would actually say out loud.
Keep the underlying facts (names, dates, amounts if present) accurate —
never invent details that aren't in the input.

Rules:
- Each phrase should be one short sentence, plain language, no jargon.
- Reference the client or item by name when available, not by ID or type.
- Don't repeat the words "urgent," "overdue," or "warning" — say the
  fact plainly instead (e.g. "3 days late" rather than "OVERDUE").
- If multiple items are for the same client, you may combine them into
  one sentence.
- Return ONLY valid JSON, no preamble, no markdown fences.

Output format (JSON array, same length or shorter than input if you
combine items):
[
  {
    "source_id": "<pass through unchanged>",
    "phrase": "<your rewritten first-person sentence>",
    "action_label": "<pass through from input's action.label>",
    "handler": "<pass through from input's action.handler>",
    "target_id": "<pass through from input's action.target_id>"
  }
]`

// Calls the orbi-brief edge function to rewrite prioritized business items
// into Orbi's voice. Navigation data (action.handler/target_id) is always
// re-attached from the original `items` by source_id rather than trusted
// from the model's output — the model only supplies the phrase, so a
// hallucinated id can never send the user to the wrong record.
export async function getOrbiBrief(items) {
  if (!items.length) return []

  const prompt = `${SYSTEM_PROMPT}\n\nInput:\n${JSON.stringify(items.map(({ source_id, type, facts, action }) => ({ source_id, type, facts, action })))}`

  const res = await supabase.functions.invoke('orbi-brief', { body: { prompt } })
  const data = res.data
  if (!data?.content) throw new Error(data?.error?.message || 'No content returned')
  const raw = data.content.map(b => b.text || '').join('')
  const clean = raw.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(clean)

  const bySourceId = Object.fromEntries(items.map(i => [i.source_id, i]))
  return parsed
    .filter(entry => bySourceId[entry.source_id])
    .map(entry => ({
      phrase: entry.phrase,
      action: bySourceId[entry.source_id].action,
    }))
}
