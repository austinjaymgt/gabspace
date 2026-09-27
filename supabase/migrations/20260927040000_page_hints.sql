-- First-visit page hints (OrbiHint): the pages whose tip a user has
-- already seen. NULL means tips are off — which is what every existing
-- account gets, since the column is added before its default is set. New
-- signups get the '{}' default and see each page's tip once. "Turn off
-- tips" sets it back to NULL.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS page_hints_seen text[];

ALTER TABLE public.user_settings
  ALTER COLUMN page_hints_seen SET DEFAULT '{}';
