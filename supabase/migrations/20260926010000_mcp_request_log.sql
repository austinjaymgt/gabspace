-- Audit + rate-limit log for the upcoming Gabspace MCP server (Claude
-- connector). One row per tool call, written by the edge function with the
-- admin client. Kept separate from ai_request_log because these calls
-- don't spend Gabspace's Anthropic budget - they're the user's own Claude
-- driving Gabspace data - and they need more context (which business,
-- which tool, which OAuth client, outcome) for a future "Connected apps"
-- view and for investigating anything a connector did.
CREATE TABLE IF NOT EXISTS public.mcp_request_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_space_id uuid REFERENCES public.business_spaces(id) ON DELETE SET NULL,
  tool_name text NOT NULL,
  oauth_client_id text,
  status text NOT NULL CHECK (status IN ('ok', 'error', 'denied', 'rate_limited')),
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mcp_request_log_user_created_idx
  ON public.mcp_request_log (user_id, created_at);
CREATE INDEX IF NOT EXISTS mcp_request_log_business_created_idx
  ON public.mcp_request_log (business_space_id, created_at);

-- Service-role only for now, same as ai_request_log - no policies means
-- end users can't read or write it directly. A select-own policy can be
-- added when the Connected apps UI needs it.
ALTER TABLE public.mcp_request_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mcp_request_log FROM anon, authenticated;
