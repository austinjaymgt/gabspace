-- Lets clients approve their own deliverables from the portal (one-way:
-- staff can still revert via their status dropdown). approved_by_client
-- distinguishes a client approval from a staff-set 'approved' status;
-- approved_at feeds the same unread-activity diffing that comments and
-- reactions already use against portal_projects.staff_last_viewed.
ALTER TABLE public.deliverables
  ADD COLUMN approved_by_client boolean NOT NULL DEFAULT false,
  ADD COLUMN approved_at timestamptz;

ALTER PUBLICATION supabase_realtime ADD TABLE public.deliverables;

-- Re-derives authorization from deliverable -> portal_projects ->
-- portal_links the same way add_portal_comment/add_portal_reaction do,
-- rather than trusting a client-supplied id directly (see
-- 20260725170000_lock_down_portal_and_deliverable_tables.sql). Only
-- allows the pending_review -> approved transition, so a client can't
-- approve a draft or silently no-op re-approve.
CREATE OR REPLACE FUNCTION public.approve_portal_deliverable(p_token text, p_deliverable_id uuid)
 RETURNS public.deliverables
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  updated public.deliverables;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.deliverables d
    JOIN public.portal_projects pp ON pp.project_id = d.project_id
    JOIN public.portal_links pl ON pl.id = pp.portal_link_id
    WHERE d.id = p_deliverable_id AND pl.token = p_token AND pl.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized for this deliverable';
  END IF;

  UPDATE public.deliverables
  SET status = 'approved', approved_by_client = true, approved_at = now()
  WHERE id = p_deliverable_id AND status = 'pending_review'
  RETURNING * INTO updated;

  IF updated.id IS NULL THEN
    RAISE EXCEPTION 'Deliverable is not pending review';
  END IF;

  RETURN updated;
END;
$function$;

REVOKE ALL ON FUNCTION public.approve_portal_deliverable(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_portal_deliverable(text, uuid) TO anon, authenticated;
