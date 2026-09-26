import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, json, requireUser, enforceRateLimit, callClaude } from '../_shared/ai.ts'

const RATE_LIMIT_PER_HOUR = 20
const MAX_ITEMS = 50
const MAX_INPUT_CHARS = 30000

// Lives here rather than in the client so this function can only ever be
// used to rewrite Orbi items - it used to forward whatever `prompt` the
// browser sent, which made it a general-purpose proxy onto Gabspace's
// Anthropic account for any signed-in user.
const SYSTEM_PROMPT = `You are Orbi, the friendly in-app assistant for gabspace, a business
management tool for creative entrepreneurs. You speak in first person,
warm and human — like a capable assistant who has the user's back, never
a system alert. You never nag, guilt, or use urgency language like
"WARNING" or "ACTION REQUIRED." You sound like a person who noticed
something and is gently letting them know.

You will be given a JSON array of prioritized items pulled from the
user's business data (overdue invoices, upcoming projects, networking
events, content due dates, and goals). Rewrite each
item into a short, natural phrase a person would actually say out loud.
Keep the underlying facts (names, dates, amounts if present) accurate —
never invent details that aren't in the input.

Rules:
- Each phrase should be one short sentence, plain language, no jargon.
- Reference the client or item by name when available, not by ID or type.
- Items may belong to different businesses. Always name the business
  (facts.business_name) somewhere in the phrase, so it's clear at a
  glance which business each item belongs to.
- Don't repeat the words "urgent," "overdue," or "warning" — say the
  fact plainly instead (e.g. "3 days late" rather than "OVERDUE").
- Write exactly one phrase per input item, using only that item's own
  facts. Never mention another item's name or details inside a phrase,
  even if two items share a date or client — each one stands alone and
  gets its own entry, so a name mentioned in one phrase must not also
  appear folded into a different item's phrase.
- Return ONLY valid JSON, no preamble, no markdown fences.

Output format (JSON array, exactly one entry per input item, same order):
[
  {
    "source_id": "<pass through unchanged>",
    "phrase": "<your rewritten first-person sentence>",
    "action_label": "<pass through from input's action.label>",
    "handler": "<pass through from input's action.handler>",
    "target_id": "<pass through from input's action.target_id>"
  }
]`

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const caller = await requireUser(req)
  if (caller instanceof Response) return caller

  const body = await req.json().catch(() => null)
  const items = body?.items
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
    return json({ error: `items must be an array of 1-${MAX_ITEMS} entries` }, 400)
  }

  // Only forward the fields the prompt is written around.
  const input = JSON.stringify(items.map(({ source_id, type, facts, action }) => ({ source_id, type, facts, action })))
  if (input.length > MAX_INPUT_CHARS) return json({ error: 'Input too large' }, 400)

  const limited = await enforceRateLimit(caller.adminClient, caller.user.id, 'orbi-brief', RATE_LIMIT_PER_HOUR)
  if (limited) return limited

  const data = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Input:\n${input}` }],
  })
  return json(data)
})
