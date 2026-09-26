import { supabase } from '../supabaseClient'

// Calls the orbi-brief edge function to rewrite prioritized business items
// into Orbi's voice. Navigation data (action.handler/target_id) is always
// re-attached from the original `items` by source_id rather than trusted
// from the model's output — the model only supplies the phrase, so a
// hallucinated id can never send the user to the wrong record.
export async function getOrbiBrief(items) {
  if (!items.length) return []

  // The system prompt lives in the orbi-brief edge function — only the
  // items are sent from here.
  const body = { items: items.map(({ source_id, type, facts, action }) => ({ source_id, type, facts, action })) }
  const res = await supabase.functions.invoke('orbi-brief', { body })
  const data = res.data
  if (!data?.content) throw new Error(data?.error?.message || 'No content returned')
  const raw = data.content.map(b => b.text || '').join('')
  const clean = raw.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(clean)

  const bySourceId = Object.fromEntries(items.map(i => [i.source_id, i]))
  return parsed
    .filter(entry => bySourceId[entry.source_id])
    .map(entry => {
      const source = bySourceId[entry.source_id]
      const daysDiff = source.facts.days_diff
      return {
        phrase: entry.phrase,
        action: source.action,
        // Due today, tomorrow, or already overdue — worth calling out
        // visually since everything else in the window is routine.
        urgent: daysDiff != null && daysDiff <= 1,
      }
    })
}
