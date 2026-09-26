// Shared plumbing for the AI edge functions (orbi-brief, quick-add-parse)
// and, later, the MCP server / Orbi agent. Each
// function used to carry its own copy of this auth + rate-limit block.
import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export type AuthedCaller = {
  user: User
  // Runs as the caller, so RLS applies - use for any read/write of their data.
  userClient: SupabaseClient
  // Service role - only for logging/rate limiting, never for user data.
  adminClient: SupabaseClient
}

// Require a real signed-in caller - verify_jwt=true alone only checks
// for *some* valid Supabase JWT, and the public anon key qualifies,
// which previously meant anyone could drive these paid Anthropic calls.
// Returns a ready-to-send error Response when the caller isn't signed in.
export async function requireUser(req: Request): Promise<AuthedCaller | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) return json({ error: 'Invalid or expired session' }, 401)

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  return { user, userClient, adminClient }
}

// Per-user hourly limit backed by ai_request_log. Logs the request when
// it's allowed; returns a 429 Response when it isn't.
export async function enforceRateLimit(
  adminClient: SupabaseClient,
  userId: string,
  functionName: string,
  perHour: number,
): Promise<Response | null> {
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await adminClient
    .from('ai_request_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('function_name', functionName)
    .gte('created_at', windowStart)

  if ((count || 0) >= perHour) return json({ error: 'Rate limit exceeded — try again later' }, 429)

  await adminClient.from('ai_request_log').insert({ user_id: userId, function_name: functionName })
  return null
}

type ClaudeRequest = {
  model: string
  max_tokens: number
  system?: string
  messages: { role: 'user' | 'assistant'; content: string }[]
}

// Returns the raw Messages API response body - callers pass it straight
// back to the client, which already knows how to read `content`.
export async function callClaude(body: ClaudeRequest): Promise<unknown> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
  return res.json()
}
