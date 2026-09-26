import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, json, requireUser, enforceRateLimit, callClaude } from '../_shared/ai.ts'

const RATE_LIMIT_PER_HOUR = 20
const MAX_TEXT_CHARS = 2000

// Lives here rather than in the client so this function can only ever be
// used to parse Quick Add notes - it used to forward whatever `prompt`
// the browser sent to Anthropic.
const SYSTEM_PROMPT = `You are the parsing engine behind "Quick Add" in gabspace, a
business management tool for creative entrepreneurs. The user will type a
short, informal note describing something that just happened — meeting a
client, remembering a task, hearing about an event, or jotting a stray idea.
Your job is to break that note into a list of structured items to create.

Each item has a "type" and a "fields" object:

- type "client": fields = { name (required), company, email, phone, note }
  Use this when the note describes meeting or working with a new person or
  business. "note" should capture freeform context worth remembering about
  them (how you met, what they do, what was discussed) — omit if there's
  nothing beyond the name.
- type "task": fields = { title (required), due_date, client_name }
  Use this for an action the user needs to take. "due_date" is an ISO date
  (YYYY-MM-DD), only include it if a date or relative date ("tomorrow",
  "next week") is stated or clearly implied — never guess one. "client_name"
  is the plain name of a client this task relates to, if any (omit if none).
- type "business_event": fields = { name (required), date, location, notes }
  Use this for a networking event, conference, or gathering the user
  mentions attending or wanting to attend. "date" is ISO format if known.
- type "spark_idea": fields = { title (required) }
  Use this as a fallback for a stray idea or thought that isn't clearly a
  task, client, or event.
- type "project": fields = { title (required), project_type, budget, start_date }
  Use this when the user describes a new project or job they've landed or
  started (not a stray idea — something concrete, e.g. "booked the Miller
  wedding for June"). "project_type" is a short free-text category (e.g.
  "Wedding", "Portrait", "Branding"). "budget" is a plain number, no currency
  symbol. "start_date" is ISO format if known.
- type "content_idea": fields = { title (required), platform, scheduled_date, notes }
  Use this for a content/social media post idea. "platform" is a single
  platform name if mentioned (e.g. Instagram, TikTok, Blog).
- type "vendor": fields = { name (required), category, email, phone }
  Use this when the user mentions a new vendor, supplier, or contractor
  relationship (distinct from "client" — vendors are who the business pays,
  clients are who pay the business). "category" is a short free-text type
  (e.g. "Florist", "Caterer", "Printer").
- type "goal": fields = { title (required), owner, due_date }
  Use this for a team or business goal/objective being set, not a one-off
  task. "owner" is the plain name of whoever is responsible, if stated.
- type "income": fields = { income_stream (required), amount (required), date, notes }
  Use this when the user mentions money already received or a payment that's
  been confirmed (not invoiced yet, just received) — e.g. "got paid $400 for
  the Miller shoot". "income_stream" is a short label for what the money is
  for. "amount" is a plain number, no currency symbol.
- type "expense": fields = { title (required), amount (required), category, date, notes }
  Use this when the user mentions a business cost, purchase, or bill — e.g.
  "bought a new lens for $800" or "paid $50 for Canva subscription".
  "category" is a short free-text type (e.g. "Equipment", "Software",
  "Travel"). "amount" is a plain number, no currency symbol.
- type "invoice": fields = { client_name (required), amount (required), description, due_date }
  Use this when the user wants to bill or invoice a client for something —
  e.g. "need to invoice Sarah $600 for the branding package". "description"
  is what the invoice line item is for. "amount" is a plain number, no
  currency symbol.

Rules:
- Only extract "amount" when a dollar figure is explicitly stated — never
  estimate or guess one.
- Only extract what is explicitly stated or clearly implied by the input.
  Never invent names, dates, companies, or other details that aren't there.
- A single input can produce multiple items (e.g. one client + one task +
  one event). Produce as many or as few items as the input actually
  describes — don't force items that aren't present.
- Return ONLY a valid JSON array, no preamble, no markdown fences.

Output format:
[
  { "type": "client", "fields": { "name": "...", ... } },
  { "type": "task", "fields": { "title": "...", ... } }
]`

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const caller = await requireUser(req)
  if (caller instanceof Response) return caller

  const body = await req.json().catch(() => null)
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) return json({ error: 'text is required' }, 400)
  if (text.length > MAX_TEXT_CHARS) return json({ error: `text must be ${MAX_TEXT_CHARS} characters or fewer` }, 400)

  // Date the client sent (what it has always put in the prompt) - falls
  // back to the server's date if it's missing or malformed.
  const today = /^\d{4}-\d{2}-\d{2}$/.test(body?.today) ? body.today : new Date().toISOString().slice(0, 10)

  const limited = await enforceRateLimit(caller.adminClient, caller.user.id, 'quick-add-parse', RATE_LIMIT_PER_HOUR)
  if (limited) return limited

  const data = await callClaude({
    model: 'claude-sonnet-5',
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Today's date: ${today}\n\nInput: ${text}` }],
  })
  return json(data)
})
