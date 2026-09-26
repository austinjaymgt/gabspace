import { supabase } from '../supabaseClient'

export async function parseQuickAdd(text) {
  const today = new Date().toISOString().slice(0, 10)

  // The parsing prompt lives in the quick-add-parse edge function — only
  // the user's note and date are sent from here.
  const res = await supabase.functions.invoke('quick-add-parse', { body: { text, today } })
  const data = res.data
  if (!data?.content) throw new Error(data?.error?.message || 'No content returned')
  const raw = data.content.map(b => b.text || '').join('')
  const clean = raw.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(clean)
  if (!Array.isArray(parsed)) throw new Error('Unexpected response shape')
  return parsed
}
