-- This project has a default-privilege setting that auto-grants EXECUTE
-- to anon and authenticated on every new function in the public schema,
-- regardless of any `REVOKE ALL ... FROM PUBLIC` in the function's own
-- migration (that only revokes the PUBLIC pseudo-role grant - it doesn't
-- touch the separate per-role grants the default-privilege rule creates).
-- Confirmed live: `find_user_id_by_email` and `generate_recurring_invoices`
-- were both callable by anon despite their migrations' explicit intent
-- and comments saying otherwise.
--
-- find_user_id_by_email: lets anon enumerate whether any email has a
-- Gabspace account (find_user_id_by_email('someone@example.com') returns
-- their real user id) - exactly the risk its own migration comment
-- warned about ("granting this to authenticated users would let anyone
-- probe arbitrary emails for an account").
REVOKE EXECUTE ON FUNCTION public.find_user_id_by_email(text) FROM anon, authenticated;

-- generate_recurring_invoices: has no internal auth check at all (it's
-- meant to run unattended via pg_cron once daily) - anon could call it
-- directly to force every business's recurring invoice rules to fire
-- early/repeatedly, spamming duplicate draft invoices and corrupting
-- billing schedules platform-wide.
REVOKE EXECUTE ON FUNCTION public.generate_recurring_invoices() FROM anon, authenticated;
