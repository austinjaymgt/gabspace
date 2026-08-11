-- The portal header currently shows the CLIENT's own company name, which
-- reads like the client is looking at their own site rather than the
-- agency's branded portal. Expose the owning business_space's name so the
-- header can read "<Agency Name> | Client Portal" instead.

CREATE OR REPLACE FUNCTION public.get_portal_context(p_token text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'client', jsonb_build_object('name', c.name, 'company', c.company),
    'business', jsonb_build_object('name', bs.name),
    'projects', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'status', p.status))
      FROM public.portal_projects pp
      JOIN public.projects p ON p.id = pp.project_id
      WHERE pp.portal_link_id = pl.id
    ), '[]'::jsonb)
  )
  FROM public.portal_links pl
  JOIN public.clients c ON c.id = pl.client_id
  JOIN public.business_spaces bs ON bs.id = pl.business_space_id
  WHERE pl.token = p_token AND pl.status = 'active';
$function$;

REVOKE ALL ON FUNCTION public.get_portal_context(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_context(text) TO anon, authenticated;
