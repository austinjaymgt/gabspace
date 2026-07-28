-- Backs a basic per-user rate limit for the AI proxy functions
-- (orbi-brief, generate-event-concept), which previously had no caller
-- auth and no rate limiting at all - anyone with the anon key could drive
-- unlimited requests through Gabspace's paid Anthropic account.
CREATE TABLE IF NOT EXISTS public.ai_request_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_request_log_user_function_created_idx
  ON public.ai_request_log (user_id, function_name, created_at);

-- Service-role only - the edge functions write/read this with the admin
-- client, end users never touch it directly.
ALTER TABLE public.ai_request_log ENABLE ROW LEVEL SECURITY;
