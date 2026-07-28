import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RATE_LIMIT_PER_HOUR = 20

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Require a real signed-in caller - verify_jwt=true alone only checks
  // for *some* valid Supabase JWT, and the public anon key qualifies,
  // which previously meant anyone could drive this paid Anthropic call.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await adminClient
    .from('ai_request_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('function_name', 'generate-event-concept')
    .gte('created_at', windowStart)

  if ((count || 0) >= RATE_LIMIT_PER_HOUR) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded — try again later' }), {
      status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { prompt } = await req.json()

  await adminClient.from('ai_request_log').insert({ user_id: user.id, function_name: 'generate-event-concept' })

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await res.json()
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
