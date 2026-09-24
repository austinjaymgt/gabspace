-- Rollback for the Community layer:
--   20260924000000_community_layer.sql
--   20260924010000_collab_messages.sql
--
-- NOT a migration — run by hand only if the Community layer needs to be
-- removed. It permanently deletes every listing, request, response,
-- message, tag alert, and notification, and nothing else (no existing
-- table is touched). Afterwards, also remove the two rows from
-- supabase_migrations.schema_migrations (at the bottom) so the CLI's
-- history matches.

BEGIN;

DROP TABLE IF EXISTS public.collab_messages CASCADE;
DROP TABLE IF EXISTS public.collab_responses CASCADE;
DROP TABLE IF EXISTS public.collab_requests CASCADE;
DROP TABLE IF EXISTS public.business_listings CASCADE;
DROP TABLE IF EXISTS public.tag_subscriptions CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;

DROP FUNCTION IF EXISTS public.collab_messages_before_insert();
DROP FUNCTION IF EXISTS public.notify_collab_message();
DROP FUNCTION IF EXISTS public.collab_thread_side(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_collab_thread_party(uuid);
DROP FUNCTION IF EXISTS public.collab_thread_open(uuid);

DROP FUNCTION IF EXISTS public.notify_collab_request_subscribers();
DROP FUNCTION IF EXISTS public.notify_collab_response_poster();
DROP FUNCTION IF EXISTS public.notify_collab_response_status();
DROP FUNCTION IF EXISTS public.business_listings_before_write();
DROP FUNCTION IF EXISTS public.collab_requests_before_write();
DROP FUNCTION IF EXISTS public.collab_responses_before_write();
DROP FUNCTION IF EXISTS public.collab_request_poster(uuid);
DROP FUNCTION IF EXISTS public.collab_request_accepting_responses(uuid);
DROP FUNCTION IF EXISTS public.i_responded_to_request(uuid);
DROP FUNCTION IF EXISTS public.community_display_name(uuid);
DROP FUNCTION IF EXISTS public.my_community_businesses();
DROP FUNCTION IF EXISTS public.is_member(uuid);
DROP FUNCTION IF EXISTS public.can_post_as_business(uuid, uuid);
DROP FUNCTION IF EXISTS public.can_manage_business(uuid, uuid);
DROP FUNCTION IF EXISTS public.owner_in_good_standing(uuid);
DROP FUNCTION IF EXISTS public.community_valid_tags(text[]);
DROP FUNCTION IF EXISTS public.community_valid_slug(text);

DELETE FROM supabase_migrations.schema_migrations
WHERE version IN ('20260924000000', '20260924010000');

COMMIT;
