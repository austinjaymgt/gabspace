-- Projects can have a staff-picked icon (projects.icon, added in
-- 20260810020000_add_project_icon.sql) but get_portal_context never
-- returned it, so the client portal always showed a generic folder icon
-- regardless of what was set on the admin side.

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
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'status', p.status, 'icon', p.icon))
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
