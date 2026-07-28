-- budget_categories, deliverables, portal_links, portal_projects,
-- deliverable_comments, deliverable_reactions all had USING(true) RLS
-- policies plus a blanket GRANT ALL TO anon - meaning anyone with the
-- public anon key could read/write every business's budget structure,
-- deliverables (including drafts the UI hides), portal tokens, and
-- deliverable comments/reactions, platform-wide, with zero auth.
--
-- Fix: staff (business members) keep direct table access, scoped to their
-- own business_space_id like every other business table. The public
-- client-portal view (?portal=<token>, no login) loses direct table
-- access entirely and goes through token-checked SECURITY DEFINER
-- functions instead - the same pattern already used correctly for
-- get_portal_invoices.

-- ── Staff-side table policies ───────────────────────────────────────────

DROP POLICY IF EXISTS "workspace members manage budget_categories" ON public.budget_categories;
CREATE POLICY "budget_categories_all" ON public.budget_categories
  USING (business_space_id IN (SELECT user_profiles.business_space_id FROM public.user_profiles WHERE user_profiles.user_id = auth.uid()))
  WITH CHECK (business_space_id IN (SELECT user_profiles.business_space_id FROM public.user_profiles WHERE user_profiles.user_id = auth.uid()));
REVOKE ALL ON TABLE public.budget_categories FROM anon;

DROP POLICY IF EXISTS "workspace members manage deliverables" ON public.deliverables;
CREATE POLICY "deliverables_all" ON public.deliverables
  USING (business_space_id IN (SELECT user_profiles.business_space_id FROM public.user_profiles WHERE user_profiles.user_id = auth.uid()))
  WITH CHECK (business_space_id IN (SELECT user_profiles.business_space_id FROM public.user_profiles WHERE user_profiles.user_id = auth.uid()));
REVOKE ALL ON TABLE public.deliverables FROM anon;

DROP POLICY IF EXISTS "workspace members manage portal_links" ON public.portal_links;
CREATE POLICY "portal_links_all" ON public.portal_links
  USING (business_space_id IN (SELECT user_profiles.business_space_id FROM public.user_profiles WHERE user_profiles.user_id = auth.uid()))
  WITH CHECK (business_space_id IN (SELECT user_profiles.business_space_id FROM public.user_profiles WHERE user_profiles.user_id = auth.uid()));
REVOKE ALL ON TABLE public.portal_links FROM anon;

-- portal_projects has no business_space_id column of its own; scope via
-- its parent portal_link.
DROP POLICY IF EXISTS "workspace members manage portal_projects" ON public.portal_projects;
CREATE POLICY "portal_projects_all" ON public.portal_projects
  USING (EXISTS (
    SELECT 1 FROM public.portal_links pl
    JOIN public.user_profiles up ON up.business_space_id = pl.business_space_id
    WHERE pl.id = portal_projects.portal_link_id AND up.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.portal_links pl
    JOIN public.user_profiles up ON up.business_space_id = pl.business_space_id
    WHERE pl.id = portal_projects.portal_link_id AND up.user_id = auth.uid()
  ));
REVOKE ALL ON TABLE public.portal_projects FROM anon;

DROP POLICY IF EXISTS "anyone can comment" ON public.deliverable_comments;
CREATE POLICY "deliverable_comments_staff" ON public.deliverable_comments
  USING (EXISTS (
    SELECT 1 FROM public.deliverables d
    JOIN public.user_profiles up ON up.business_space_id = d.business_space_id
    WHERE d.id = deliverable_comments.deliverable_id AND up.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.deliverables d
    JOIN public.user_profiles up ON up.business_space_id = d.business_space_id
    WHERE d.id = deliverable_comments.deliverable_id AND up.user_id = auth.uid()
  ));
REVOKE ALL ON TABLE public.deliverable_comments FROM anon;

DROP POLICY IF EXISTS "anyone can react" ON public.deliverable_reactions;
CREATE POLICY "deliverable_reactions_staff" ON public.deliverable_reactions
  USING (EXISTS (
    SELECT 1 FROM public.deliverables d
    JOIN public.user_profiles up ON up.business_space_id = d.business_space_id
    WHERE d.id = deliverable_reactions.deliverable_id AND up.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.deliverables d
    JOIN public.user_profiles up ON up.business_space_id = d.business_space_id
    WHERE d.id = deliverable_reactions.deliverable_id AND up.user_id = auth.uid()
  ));
REVOKE ALL ON TABLE public.deliverable_reactions FROM anon;

-- ── Public portal access, via token-checked functions only ──────────────

CREATE OR REPLACE FUNCTION public.get_portal_context(p_token text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'client', jsonb_build_object('name', c.name, 'company', c.company),
    'projects', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'status', p.status))
      FROM public.portal_projects pp
      JOIN public.projects p ON p.id = pp.project_id
      WHERE pp.portal_link_id = pl.id
    ), '[]'::jsonb)
  )
  FROM public.portal_links pl
  JOIN public.clients c ON c.id = pl.client_id
  WHERE pl.token = p_token AND pl.status = 'active';
$function$;

REVOKE ALL ON FUNCTION public.get_portal_context(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_context(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_portal_deliverables(p_token text, p_project_id uuid)
 RETURNS SETOF public.deliverables
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT d.*
  FROM public.deliverables d
  WHERE d.project_id = p_project_id
    AND d.status != 'draft'
    AND EXISTS (
      SELECT 1 FROM public.portal_projects pp
      JOIN public.portal_links pl ON pl.id = pp.portal_link_id
      WHERE pp.project_id = p_project_id AND pl.token = p_token AND pl.status = 'active'
    )
  ORDER BY d.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_portal_deliverables(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_deliverables(text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_portal_milestones(p_token text, p_project_id uuid)
 RETURNS TABLE (id uuid, title text, target_date date, status text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT m.id, m.title, m.target_date, m.status
  FROM public.project_milestones m
  WHERE m.project_id = p_project_id
    AND m.show_in_portal = true
    AND m.status != 'done'
    AND EXISTS (
      SELECT 1 FROM public.portal_projects pp
      JOIN public.portal_links pl ON pl.id = pp.portal_link_id
      WHERE pp.project_id = p_project_id AND pl.token = p_token AND pl.status = 'active'
    )
  ORDER BY m.target_date ASC NULLS LAST;
$function$;

REVOKE ALL ON FUNCTION public.get_portal_milestones(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_milestones(text, uuid) TO anon, authenticated;

-- Never returns the raw client_token of who reacted (that's another
-- client's bearer credential) - just a count and whether the requesting
-- token itself has reacted, which is all the UI actually needs.
CREATE OR REPLACE FUNCTION public.get_portal_reactions(p_token text, p_deliverable_ids uuid[])
 RETURNS TABLE (deliverable_id uuid, emoji text, reaction_count bigint, reacted_by_me boolean)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT r.deliverable_id, r.emoji, count(*) AS reaction_count, bool_or(r.client_token = p_token) AS reacted_by_me
  FROM public.deliverable_reactions r
  JOIN public.deliverables d ON d.id = r.deliverable_id
  JOIN public.portal_projects pp ON pp.project_id = d.project_id
  JOIN public.portal_links pl ON pl.id = pp.portal_link_id
  WHERE r.deliverable_id = ANY(p_deliverable_ids) AND pl.token = p_token AND pl.status = 'active'
  GROUP BY r.deliverable_id, r.emoji;
$function$;

REVOKE ALL ON FUNCTION public.get_portal_reactions(text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_reactions(text, uuid[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.add_portal_reaction(p_token text, p_deliverable_id uuid, p_emoji text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.deliverables d
    JOIN public.portal_projects pp ON pp.project_id = d.project_id
    JOIN public.portal_links pl ON pl.id = pp.portal_link_id
    WHERE d.id = p_deliverable_id AND pl.token = p_token AND pl.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized for this deliverable';
  END IF;

  INSERT INTO public.deliverable_reactions (deliverable_id, client_token, emoji)
  VALUES (p_deliverable_id, p_token, p_emoji);
END;
$function$;

REVOKE ALL ON FUNCTION public.add_portal_reaction(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_portal_reaction(text, uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.remove_portal_reaction(p_token text, p_deliverable_id uuid, p_emoji text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  DELETE FROM public.deliverable_reactions
  WHERE deliverable_id = p_deliverable_id AND client_token = p_token AND emoji = p_emoji;
$function$;

REVOKE ALL ON FUNCTION public.remove_portal_reaction(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_portal_reaction(text, uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_portal_comments(p_token text, p_deliverable_ids uuid[])
 RETURNS SETOF public.deliverable_comments
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.*
  FROM public.deliverable_comments c
  JOIN public.deliverables d ON d.id = c.deliverable_id
  JOIN public.portal_projects pp ON pp.project_id = d.project_id
  JOIN public.portal_links pl ON pl.id = pp.portal_link_id
  WHERE c.deliverable_id = ANY(p_deliverable_ids) AND pl.token = p_token AND pl.status = 'active'
  ORDER BY c.created_at ASC;
$function$;

REVOKE ALL ON FUNCTION public.get_portal_comments(text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_comments(text, uuid[]) TO anon, authenticated;

-- author_type is always forced to 'client' here - an anonymous portal
-- caller with only a token should never be able to post a comment that
-- renders as if it came from staff.
CREATE OR REPLACE FUNCTION public.add_portal_comment(p_token text, p_deliverable_id uuid, p_author_name text, p_body text)
 RETURNS public.deliverable_comments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_comment public.deliverable_comments;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.deliverables d
    JOIN public.portal_projects pp ON pp.project_id = d.project_id
    JOIN public.portal_links pl ON pl.id = pp.portal_link_id
    WHERE d.id = p_deliverable_id AND pl.token = p_token AND pl.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized for this deliverable';
  END IF;

  INSERT INTO public.deliverable_comments (deliverable_id, author_type, author_name, body)
  VALUES (p_deliverable_id, 'client', p_author_name, p_body)
  RETURNING * INTO new_comment;

  RETURN new_comment;
END;
$function$;

REVOKE ALL ON FUNCTION public.add_portal_comment(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_portal_comment(text, uuid, text, text) TO anon, authenticated;
