-- "Founders Circle" (plan = 'founding') becomes the default plan for new
-- signups, with 3 businesses included (same cap as 'studio'). Existing
-- users currently on 'free' are converted too, per product decision;
-- 'enterprise' users are left untouched. The founding_member_cap in
-- platform_settings stays informational only — nothing here enforces it
-- automatically.

ALTER TABLE public.user_settings ALTER COLUMN plan SET DEFAULT 'founding';

UPDATE public.user_settings SET plan = 'founding' WHERE plan = 'free';

CREATE OR REPLACE FUNCTION public.create_business_space(business_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_business_space_id uuid;
  clean_name text;
  caller_plan text;
  plan_cap integer;
  current_count integer;
BEGIN
  clean_name := NULLIF(TRIM(business_name), '');
  IF clean_name IS NULL THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;

  SELECT plan INTO caller_plan
  FROM public.user_settings
  WHERE user_id = auth.uid();

  plan_cap := CASE COALESCE(caller_plan, 'founding')
    WHEN 'free' THEN 1
    WHEN 'duo' THEN 2
    WHEN 'studio' THEN 3
    WHEN 'founding' THEN 3
    ELSE NULL -- enterprise: uncapped
  END;

  IF plan_cap IS NOT NULL THEN
    SELECT count(*) INTO current_count
    FROM public.business_space_members
    WHERE user_id = auth.uid();

    IF current_count >= plan_cap THEN
      RAISE EXCEPTION 'Business space limit reached for current plan';
    END IF;
  END IF;

  INSERT INTO public.business_spaces (id, name, owner_id)
  VALUES (gen_random_uuid(), clean_name, auth.uid())
  RETURNING id INTO new_business_space_id;

  INSERT INTO public.business_space_members (business_space_id, user_id, role)
  VALUES (new_business_space_id, auth.uid(), 'owner');

  RETURN new_business_space_id;
END;
$function$;
