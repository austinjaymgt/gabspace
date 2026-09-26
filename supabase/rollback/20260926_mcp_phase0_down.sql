-- Rollback for MCP phase 0:
--   20260926000000_business_space_modules.sql
--   20260926010000_mcp_request_log.sql
--
-- NOT a migration — run by hand only if these need to be removed. Dropping
-- enabled_modules loses every business's module choices server-side (the
-- client's localStorage cache still has whatever each browser last saw).
-- Also revert src/utils/businessModules.js, or module toggles will fail to
-- save. Afterwards, remove the two rows from
-- supabase_migrations.schema_migrations (at the bottom).

BEGIN;

DROP TABLE IF EXISTS public.mcp_request_log;

DROP FUNCTION IF EXISTS public.set_business_modules(uuid, jsonb);
ALTER TABLE public.business_spaces DROP COLUMN IF EXISTS enabled_modules;

DELETE FROM supabase_migrations.schema_migrations
WHERE version IN ('20260926000000', '20260926010000');

COMMIT;
