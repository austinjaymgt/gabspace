-- Gates app access behind Stripe Checkout for brand-new, self-serve
-- signups (the "else" branch of handle_new_user — someone creating their
-- own workspace, not joining one via invite). Invited teammates (co-owner/
-- employee) ride on the inviting owner's subscription and never need their
-- own checkout. Existing accounts are grandfathered — this only applies
-- going forward.

ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS requires_checkout boolean NOT NULL DEFAULT true;

-- Grandfather everyone who already has a row as of this migration — none of
-- them went through Stripe Checkout (it didn't exist yet), so retroactively
-- requiring it would lock every current beta user out of their own account.
UPDATE public.user_settings SET requires_checkout = false;

-- handle_new_user() needs to set requires_checkout itself (true for a new
-- owner, false for an invited member) as part of the same INSERT — which
-- enforce_plan_immutable would otherwise block, since neither case matches
-- the trigger's "unmodified defaults" carve-out and there's no signed-in
-- admin during signup. A transaction-local flag lets handle_new_user
-- (SECURITY DEFINER, so it fully controls what gets set here) bypass the
-- guard for just its own writes — same shape as the service_role bypass
-- already used for the Stripe webhook.
CREATE OR REPLACE FUNCTION public.enforce_plan_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' OR current_setting('gabspace.system_write', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW.plan IS DISTINCT FROM OLD.plan
    OR NEW.is_founder IS DISTINCT FROM OLD.is_founder
    OR NEW.requires_checkout IS DISTINCT FROM OLD.requires_checkout
  ) THEN
    IF NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'Only a platform admin can change plan, founder status, or checkout requirement';
    END IF;
  ELSIF TG_OP = 'INSERT' AND (
    NEW.plan IS DISTINCT FROM 'business'
    OR NEW.is_founder IS DISTINCT FROM false
    OR NEW.requires_checkout IS DISTINCT FROM true
  ) THEN
    IF NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'Only a platform admin can set a non-default plan, founder status, or checkout requirement';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  new_business_space_id uuid;
  ws_name text;
  pending_invite record;
  full_name_val text;
  first_name_val text;
BEGIN
  PERFORM set_config('gabspace.system_write', 'true', true);

  full_name_val := NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), '');
  first_name_val := NULLIF(SPLIT_PART(COALESCE(full_name_val, ''), ' ', 1), '');

  SELECT * INTO pending_invite
  FROM public.invites
  WHERE email = NEW.email AND accepted = false
  ORDER BY created_at ASC
  LIMIT 1;

  IF pending_invite.id IS NOT NULL THEN
    INSERT INTO public.user_profiles (user_id, business_space_id, role, display_name, invited_by)
    VALUES (NEW.id, pending_invite.business_space_id, pending_invite.role, full_name_val, pending_invite.invited_by);

    INSERT INTO public.business_space_members (business_space_id, user_id, role, display_name)
    VALUES (pending_invite.business_space_id, NEW.id, pending_invite.role, full_name_val);

    UPDATE public.invites SET accepted = true WHERE id = pending_invite.id;
  ELSE
    ws_name := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'workspace_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), '') || '''s Workspace',
      'My Workspace'
    );

    INSERT INTO public.business_spaces (id, name, owner_id)
    VALUES (gen_random_uuid(), ws_name, NEW.id)
    RETURNING id INTO new_business_space_id;

    INSERT INTO public.user_profiles (user_id, business_space_id, role, display_name)
    VALUES (NEW.id, new_business_space_id, 'owner', full_name_val);

    INSERT INTO public.business_space_members (business_space_id, user_id, role, display_name)
    VALUES (new_business_space_id, NEW.id, 'owner', full_name_val);
  END IF;

  -- Only a brand-new owner (no pending invite) needs to complete checkout —
  -- an invited co-owner/employee uses the business they were invited into,
  -- which is already on a plan.
  INSERT INTO public.user_settings (user_id, onboarding_completed, first_name, requires_checkout)
  VALUES (NEW.id, false, first_name_val, pending_invite.id IS NULL);

  RETURN NEW;
END;
$function$;
