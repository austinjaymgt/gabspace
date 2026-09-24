-- Community layer: member directory + collab requests board.
--
-- An additive layer on top of the core product — nothing here changes an
-- existing table's columns or policies. Four pieces:
--
--   business_listings   1:1 with business_spaces, holds ONLY display fields
--                       (name/pitch/tags/city/website/instagram/…). Kept off business_spaces
--                       itself because RLS is row-level: a "discoverable rows
--                       are readable" policy there would also expose
--                       owner_id/access_status/archived_at to everyone. The
--                       future public view can select straight from here.
--   collab_requests     posted by a business, browsable by any signed-in user.
--   collab_responses    one per responding business per request; visible
--                       only to the poster's and the responder's businesses.
--   tag_subscriptions   per-user tag/category alerts.
--   notifications       minimal in-app inbox (none existed before), written
--                       only by the security-definer triggers below.
--
-- "Member" = owner/co-owner of a non-archived business whose owner is in good
-- standing: an active/trialing Stripe subscription, the enterprise plan, or a
-- grandfathered pre-Stripe account (no subscriptions row and
-- requires_checkout=false). Everyone else signed in (canceled/past-due owners,
-- employees, clients) can browse but not post or respond.
--
-- The fixed tag/category list lives in src/utils/communityTaxonomy.js; the
-- database only enforces the slug format and a count cap, so editing the
-- list never needs a migration.


-- ─────────────────────────────────────────────────────────────────────────
-- Helper functions
-- ─────────────────────────────────────────────────────────────────────────

-- Lowercase slug, e.g. 'graphic-design'. Shared by tags and categories.
CREATE OR REPLACE FUNCTION public.community_valid_slug(val text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT val ~ '^[a-z0-9][a-z0-9-]{0,39}$';
$function$;

CREATE OR REPLACE FUNCTION public.community_valid_tags(vals text[])
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT COALESCE(cardinality(vals), 0) <= 8
    AND NOT EXISTS (SELECT 1 FROM unnest(vals) v WHERE NOT public.community_valid_slug(v));
$function$;

-- Whether a business owner's account is paid up. Internal building block for
-- the checks below — not granted to clients directly. plpgsql (not sql) so
-- creation doesn't validate against public.subscriptions, which was created
-- outside this repo's migrations.
CREATE OR REPLACE FUNCTION public.owner_in_good_standing(owner uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN
    EXISTS (
      SELECT 1 FROM subscriptions s
      WHERE s.owner_id = owner AND s.status IN ('active', 'trialing')
    )
    OR EXISTS (
      SELECT 1 FROM user_settings us
      WHERE us.user_id = owner AND us.plan = 'enterprise'
    )
    OR (
      NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.owner_id = owner)
      AND EXISTS (
        SELECT 1 FROM user_settings us
        WHERE us.user_id = owner AND us.requires_checkout = false
      )
    );
END;
$function$;

-- uid is an owner/co-owner of this (non-archived) business. Used for
-- edit/delete/read-own rules — no payment requirement, so a lapsed member
-- can still close their requests or hide their listing. Like is_member(),
-- only answers for the caller, so it can't be used to probe other users.
CREATE OR REPLACE FUNCTION public.can_manage_business(uid uuid, bs_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT (uid = auth.uid() OR auth.role() = 'service_role') AND EXISTS (
    SELECT 1
    FROM business_space_members m
    JOIN business_spaces bs ON bs.id = m.business_space_id
    WHERE m.user_id = uid
      AND m.business_space_id = bs_id
      AND m.role IN ('owner', 'co-owner')
      AND bs.archived_at IS NULL
  );
$function$;

-- uid can post/respond *as this business*: manages it AND its owner is paid up.
CREATE OR REPLACE FUNCTION public.can_post_as_business(uid uuid, bs_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.can_manage_business(uid, bs_id)
    AND public.owner_in_good_standing((SELECT owner_id FROM business_spaces WHERE id = bs_id));
$function$;

-- Reusable membership check: uid can post as at least one business. Only
-- answers for the caller themselves (or the service role), so it can't be
-- used to probe other users' billing status.
CREATE OR REPLACE FUNCTION public.is_member(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT (uid = auth.uid() OR auth.role() = 'service_role')
    AND EXISTS (
      SELECT 1 FROM business_space_members m
      WHERE m.user_id = uid AND public.can_post_as_business(uid, m.business_space_id)
    );
$function$;

-- Businesses the caller manages, with whether each can post. Drives the
-- "post as" picker and the listing settings card.
CREATE OR REPLACE FUNCTION public.my_community_businesses()
 RETURNS TABLE (business_space_id uuid, name text, logo_url text, can_post boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT bs.id, bs.name, bs.logo_url, public.can_post_as_business(auth.uid(), bs.id)
  FROM business_space_members m
  JOIN business_spaces bs ON bs.id = m.business_space_id
  WHERE m.user_id = auth.uid()
    AND m.role IN ('owner', 'co-owner')
    AND bs.archived_at IS NULL
  ORDER BY bs.name;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- business_listings
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.business_listings (
  business_space_id uuid PRIMARY KEY REFERENCES public.business_spaces(id) ON DELETE CASCADE,
  is_discoverable boolean NOT NULL DEFAULT false,
  visibility text NOT NULL DEFAULT 'members' CHECK (visibility IN ('members', 'public')),
  display_name text NOT NULL CHECK (char_length(TRIM(display_name)) BETWEEN 1 AND 80),
  pitch text CHECK (pitch IS NULL OR char_length(pitch) <= 280),
  tags text[] NOT NULL DEFAULT '{}' CHECK (public.community_valid_tags(tags)),
  city text CHECK (city IS NULL OR char_length(city) <= 80),
  remote_ok boolean NOT NULL DEFAULT false,
  -- Public site link shown on the listing. http(s) only, so a listing can't
  -- smuggle in javascript: or other schemes.
  website text CHECK (website IS NULL OR (website ~* '^https?://[^\s]+$' AND char_length(website) <= 200)),
  -- Instagram handle without the @ (Instagram's own rules: letters,
  -- numbers, periods, underscores, max 30).
  instagram text CHECK (instagram IS NULL OR instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  logo_url text,
  slug text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_listings_discoverable_idx
  ON public.business_listings (display_name) WHERE is_discoverable;
CREATE INDEX IF NOT EXISTS business_listings_tags_idx
  ON public.business_listings USING gin (tags);

-- Slug is server-owned: generated from display_name the first time a
-- business is listed, then frozen (so a future public URL never breaks on
-- rename). Client-supplied values are ignored. SECURITY DEFINER so the
-- uniqueness loop also sees other businesses' hidden (non-discoverable) rows.
CREATE OR REPLACE FUNCTION public.business_listings_before_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  base text;
  candidate text;
  n integer := 1;
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' THEN
    NEW.slug := OLD.slug;
    NEW.created_at := OLD.created_at;
  ELSE
    NEW.slug := NULL;
  END IF;

  IF NEW.slug IS NULL AND NEW.is_discoverable THEN
    base := trim(both '-' from regexp_replace(lower(NEW.display_name), '[^a-z0-9]+', '-', 'g'));
    base := left(COALESCE(NULLIF(base, ''), 'business'), 60);
    candidate := base;
    WHILE EXISTS (SELECT 1 FROM business_listings WHERE slug = candidate AND business_space_id <> NEW.business_space_id) LOOP
      n := n + 1;
      candidate := base || '-' || n;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS business_listings_before_write ON public.business_listings;
CREATE TRIGGER business_listings_before_write
  BEFORE INSERT OR UPDATE ON public.business_listings
  FOR EACH ROW EXECUTE FUNCTION public.business_listings_before_write();

-- Display name a business shows in the community: its listing name if it
-- has one, otherwise the business name.
CREATE OR REPLACE FUNCTION public.community_display_name(bs_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT NULLIF(TRIM(display_name), '') FROM business_listings WHERE business_space_id = bs_id),
    (SELECT name FROM business_spaces WHERE id = bs_id)
  );
$function$;


ALTER TABLE public.business_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_listings_select" ON public.business_listings;
CREATE POLICY "business_listings_select" ON public.business_listings
  FOR SELECT TO authenticated
  USING (is_discoverable OR public.can_manage_business(auth.uid(), business_space_id));

DROP POLICY IF EXISTS "business_listings_insert_own" ON public.business_listings;
CREATE POLICY "business_listings_insert_own" ON public.business_listings
  FOR INSERT TO authenticated
  -- 'public' visibility is reserved for the later public-directory phase.
  WITH CHECK (public.can_manage_business(auth.uid(), business_space_id) AND visibility = 'members');

DROP POLICY IF EXISTS "business_listings_update_own" ON public.business_listings;
CREATE POLICY "business_listings_update_own" ON public.business_listings
  FOR UPDATE TO authenticated
  USING (public.can_manage_business(auth.uid(), business_space_id))
  WITH CHECK (public.can_manage_business(auth.uid(), business_space_id) AND visibility = 'members');

DROP POLICY IF EXISTS "business_listings_delete_own" ON public.business_listings;
CREATE POLICY "business_listings_delete_own" ON public.business_listings
  FOR DELETE TO authenticated
  USING (public.can_manage_business(auth.uid(), business_space_id));


-- ─────────────────────────────────────────────────────────────────────────
-- collab_requests
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.collab_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_space_id uuid NOT NULL REFERENCES public.business_spaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Snapshot of the poster's display name (set server-side), so the board
  -- can show who posted without granting read access to non-listed
  -- businesses' listing rows.
  poster_display_name text,
  title text NOT NULL CHECK (char_length(TRIM(title)) BETWEEN 3 AND 120),
  description text CHECK (description IS NULL OR char_length(description) <= 4000),
  category text NOT NULL CHECK (public.community_valid_slug(category)),
  tags text[] NOT NULL DEFAULT '{}' CHECK (public.community_valid_tags(tags)),
  location text CHECK (location IS NULL OR char_length(location) <= 80),
  remote_ok boolean NOT NULL DEFAULT false,
  needed_by date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS collab_requests_board_idx
  ON public.collab_requests (expires_at DESC) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS collab_requests_business_idx
  ON public.collab_requests (business_space_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.collab_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.collab_requests(id) ON DELETE CASCADE,
  responder_business_space_id uuid NOT NULL REFERENCES public.business_spaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  responder_display_name text,
  note text CHECK (note IS NULL OR char_length(note) <= 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, responder_business_space_id)
);

CREATE INDEX IF NOT EXISTS collab_responses_responder_idx
  ON public.collab_responses (responder_business_space_id);

-- Cross-table lookups used inside RLS policies. SECURITY DEFINER so the
-- requests policy can look at responses (and vice versa) without the two
-- policies recursing into each other.
CREATE OR REPLACE FUNCTION public.collab_request_poster(req_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT business_space_id FROM collab_requests WHERE id = req_id;
$function$;

CREATE OR REPLACE FUNCTION public.collab_request_accepting_responses(req_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM collab_requests
    WHERE id = req_id AND status = 'open' AND expires_at > now()
  );
$function$;

CREATE OR REPLACE FUNCTION public.i_responded_to_request(req_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM collab_responses r
    WHERE r.request_id = req_id
      AND public.can_manage_business(auth.uid(), r.responder_business_space_id)
  );
$function$;

-- Server-owned columns on requests: poster snapshot, created_by, timestamps.
CREATE OR REPLACE FUNCTION public.collab_requests_before_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.poster_display_name := public.community_display_name(NEW.business_space_id);
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by := auth.uid();
      NEW.created_at := now();
    END IF;
  ELSE
    NEW.business_space_id := OLD.business_space_id;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.poster_display_name := OLD.poster_display_name;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS collab_requests_before_write ON public.collab_requests;
CREATE TRIGGER collab_requests_before_write
  BEFORE INSERT OR UPDATE ON public.collab_requests
  FOR EACH ROW EXECUTE FUNCTION public.collab_requests_before_write();

ALTER TABLE public.collab_requests ENABLE ROW LEVEL SECURITY;

-- Any signed-in user sees open requests (the board also filters out
-- expired ones in its query); posters see all their own, and responders
-- keep seeing a request after it closes.
DROP POLICY IF EXISTS "collab_requests_select" ON public.collab_requests;
CREATE POLICY "collab_requests_select" ON public.collab_requests
  FOR SELECT TO authenticated
  USING (
    status = 'open'
    OR public.can_manage_business(auth.uid(), business_space_id)
    OR public.i_responded_to_request(id)
  );

-- Paying members only, posting as a business they run, always as 'open'.
DROP POLICY IF EXISTS "collab_requests_insert_member" ON public.collab_requests;
CREATE POLICY "collab_requests_insert_member" ON public.collab_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_post_as_business(auth.uid(), business_space_id)
    AND status = 'open'
    AND expires_at <= now() + interval '90 days'
  );

DROP POLICY IF EXISTS "collab_requests_update_own" ON public.collab_requests;
CREATE POLICY "collab_requests_update_own" ON public.collab_requests
  FOR UPDATE TO authenticated
  USING (public.can_manage_business(auth.uid(), business_space_id))
  WITH CHECK (
    public.can_manage_business(auth.uid(), business_space_id)
    AND expires_at <= now() + interval '90 days'
    -- Re-opening a closed request counts as posting: members only.
    AND (status = 'closed' OR public.can_post_as_business(auth.uid(), business_space_id))
  );

DROP POLICY IF EXISTS "collab_requests_delete_own" ON public.collab_requests;
CREATE POLICY "collab_requests_delete_own" ON public.collab_requests
  FOR DELETE TO authenticated
  USING (public.can_manage_business(auth.uid(), business_space_id));


-- ─────────────────────────────────────────────────────────────────────────
-- collab_responses
-- ─────────────────────────────────────────────────────────────────────────

-- Server-owned columns, plus who may change what on update: the poster's
-- side may only change status (accept/decline); the responder's side may
-- only change the note.
CREATE OR REPLACE FUNCTION public.collab_responses_before_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_poster boolean;
  is_responder boolean;
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.responder_display_name := public.community_display_name(NEW.responder_business_space_id);
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by := auth.uid();
      NEW.created_at := now();
    END IF;
    RETURN NEW;
  END IF;

  NEW.request_id := OLD.request_id;
  NEW.responder_business_space_id := OLD.responder_business_space_id;
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;
  NEW.responder_display_name := OLD.responder_display_name;

  IF auth.uid() IS NULL THEN
    RETURN NEW; -- service role / SQL editor
  END IF;

  is_poster := public.can_manage_business(auth.uid(), public.collab_request_poster(OLD.request_id));
  is_responder := public.can_manage_business(auth.uid(), OLD.responder_business_space_id);

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT is_poster THEN
    RAISE EXCEPTION 'Only the request poster can accept or decline a response';
  END IF;
  IF NEW.note IS DISTINCT FROM OLD.note AND NOT is_responder THEN
    RAISE EXCEPTION 'Only the responder can edit their note';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS collab_responses_before_write ON public.collab_responses;
CREATE TRIGGER collab_responses_before_write
  BEFORE INSERT OR UPDATE ON public.collab_responses
  FOR EACH ROW EXECUTE FUNCTION public.collab_responses_before_write();

ALTER TABLE public.collab_responses ENABLE ROW LEVEL SECURITY;

-- Only the two parties see a response.
DROP POLICY IF EXISTS "collab_responses_select_parties" ON public.collab_responses;
CREATE POLICY "collab_responses_select_parties" ON public.collab_responses
  FOR SELECT TO authenticated
  USING (
    public.can_manage_business(auth.uid(), responder_business_space_id)
    OR public.can_manage_business(auth.uid(), public.collab_request_poster(request_id))
  );

-- Paying members only, as a business they run, on an open/unexpired
-- request that isn't their own business's.
DROP POLICY IF EXISTS "collab_responses_insert_member" ON public.collab_responses;
CREATE POLICY "collab_responses_insert_member" ON public.collab_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_post_as_business(auth.uid(), responder_business_space_id)
    AND status = 'pending'
    AND public.collab_request_accepting_responses(request_id)
    AND public.collab_request_poster(request_id) <> responder_business_space_id
  );

DROP POLICY IF EXISTS "collab_responses_update_parties" ON public.collab_responses;
CREATE POLICY "collab_responses_update_parties" ON public.collab_responses
  FOR UPDATE TO authenticated
  USING (
    public.can_manage_business(auth.uid(), responder_business_space_id)
    OR public.can_manage_business(auth.uid(), public.collab_request_poster(request_id))
  )
  WITH CHECK (
    public.can_manage_business(auth.uid(), responder_business_space_id)
    OR public.can_manage_business(auth.uid(), public.collab_request_poster(request_id))
  );

DROP POLICY IF EXISTS "collab_responses_delete_own" ON public.collab_responses;
CREATE POLICY "collab_responses_delete_own" ON public.collab_responses
  FOR DELETE TO authenticated
  USING (public.can_manage_business(auth.uid(), responder_business_space_id));


-- ─────────────────────────────────────────────────────────────────────────
-- tag_subscriptions
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tag_subscriptions (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  tag text NOT NULL CHECK (public.community_valid_slug(tag)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tag)
);

CREATE INDEX IF NOT EXISTS tag_subscriptions_tag_idx ON public.tag_subscriptions (tag);

ALTER TABLE public.tag_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tag_subscriptions_own" ON public.tag_subscriptions;
CREATE POLICY "tag_subscriptions_own" ON public.tag_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────
-- notifications
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  -- In-app destination: a currentPage key in App.jsx plus the record to open.
  target_page text,
  target_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users read, mark-read, and dismiss their own. No INSERT policy: rows only
-- come from the security-definer triggers below.
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────
-- Notification triggers
-- ─────────────────────────────────────────────────────────────────────────

-- New request → everyone subscribed to its category or any of its tags,
-- except the people who run the posting business.
CREATE OR REPLACE FUNCTION public.notify_collab_request_subscribers()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, target_page, target_id)
  SELECT DISTINCT ts.user_id,
    'collab_request_posted',
    'New collab request: ' || NEW.title,
    COALESCE(NEW.poster_display_name, 'A business') || ' posted in ' || NEW.category,
    'community-request',
    NEW.id
  FROM tag_subscriptions ts
  WHERE (ts.tag = NEW.category OR ts.tag = ANY (NEW.tags))
    AND ts.user_id IS DISTINCT FROM NEW.created_by
    AND NOT EXISTS (
      SELECT 1 FROM business_space_members m
      WHERE m.business_space_id = NEW.business_space_id
        AND m.user_id = ts.user_id
        AND m.role IN ('owner', 'co-owner')
    );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS notify_collab_request_subscribers ON public.collab_requests;
CREATE TRIGGER notify_collab_request_subscribers
  AFTER INSERT ON public.collab_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_collab_request_subscribers();

-- New response → owners/co-owners of the posting business.
CREATE OR REPLACE FUNCTION public.notify_collab_response_poster()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  req record;
BEGIN
  SELECT id, business_space_id, title INTO req FROM collab_requests WHERE id = NEW.request_id;

  INSERT INTO notifications (user_id, type, title, body, target_page, target_id)
  SELECT m.user_id,
    'collab_response_received',
    COALESCE(NEW.responder_display_name, 'A business') || ' is interested',
    'In your request "' || req.title || '"',
    'community-my-requests',
    req.id
  FROM business_space_members m
  WHERE m.business_space_id = req.business_space_id
    AND m.role IN ('owner', 'co-owner')
    AND m.user_id IS DISTINCT FROM NEW.created_by;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS notify_collab_response_poster ON public.collab_responses;
CREATE TRIGGER notify_collab_response_poster
  AFTER INSERT ON public.collab_responses
  FOR EACH ROW EXECUTE FUNCTION public.notify_collab_response_poster();

-- Accepted/declined → owners/co-owners of the responding business.
CREATE OR REPLACE FUNCTION public.notify_collab_response_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  req record;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status = 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT id, title, poster_display_name INTO req FROM collab_requests WHERE id = NEW.request_id;

  INSERT INTO notifications (user_id, type, title, body, target_page, target_id)
  SELECT m.user_id,
    'collab_response_' || NEW.status,
    COALESCE(req.poster_display_name, 'The poster') || ' ' || NEW.status || ' your response',
    'For "' || req.title || '"',
    'community-request',
    req.id
  FROM business_space_members m
  WHERE m.business_space_id = NEW.responder_business_space_id
    AND m.role IN ('owner', 'co-owner');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS notify_collab_response_status ON public.collab_responses;
CREATE TRIGGER notify_collab_response_status
  AFTER UPDATE OF status ON public.collab_responses
  FOR EACH ROW EXECUTE FUNCTION public.notify_collab_response_status();


-- ─────────────────────────────────────────────────────────────────────────
-- Grants
-- ─────────────────────────────────────────────────────────────────────────
-- Signed-in only for now (a public directory is a later phase). This
-- project's default privileges auto-grant EXECUTE on new functions to anon
-- and authenticated (see 20260726160000_revoke_default_privilege_grants.sql),
-- so revoke explicitly.

REVOKE ALL ON public.business_listings, public.collab_requests, public.collab_responses,
  public.tag_subscriptions, public.notifications FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_listings, public.collab_requests,
  public.collab_responses, public.tag_subscriptions TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;

-- Trigger/internal functions: nobody calls these directly.
REVOKE EXECUTE ON FUNCTION public.owner_in_good_standing(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.business_listings_before_write() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.collab_requests_before_write() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.collab_responses_before_write() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_collab_request_subscribers() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_collab_response_poster() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_collab_response_status() FROM PUBLIC, anon, authenticated;

-- RLS helpers + client RPCs: signed-in users only.
REVOKE EXECUTE ON FUNCTION public.can_manage_business(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_post_as_business(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_community_businesses() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_display_name(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.collab_request_poster(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.collab_request_accepting_responses(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.i_responded_to_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_business(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_post_as_business(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_community_businesses() TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_display_name(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.collab_request_poster(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.collab_request_accepting_responses(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.i_responded_to_request(uuid) TO authenticated;
