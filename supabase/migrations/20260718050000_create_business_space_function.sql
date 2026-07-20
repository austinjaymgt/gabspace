-- Lets an existing user spin up an additional business space and become
-- its owner. Runs as SECURITY DEFINER because business_space_members has
-- no client-facing INSERT policy (only business_space_members_select_own) -
-- membership rows are otherwise only ever written by trigger functions.
CREATE OR REPLACE FUNCTION public.create_business_space(business_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_business_space_id uuid;
  clean_name text;
BEGIN
  clean_name := NULLIF(TRIM(business_name), '');
  IF clean_name IS NULL THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;

  INSERT INTO public.business_spaces (id, name, owner_id)
  VALUES (gen_random_uuid(), clean_name, auth.uid())
  RETURNING id INTO new_business_space_id;

  INSERT INTO public.business_space_members (business_space_id, user_id, role)
  VALUES (new_business_space_id, auth.uid(), 'owner');

  RETURN new_business_space_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_business_space(text) TO authenticated;
