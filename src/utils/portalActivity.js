import { supabase } from '../supabaseClient'

// Computes unread client activity (comments + reactions) across every
// portal in a business space, eagerly — unlike the old per-portal lazy
// fetch this replaces, so a badge can show "you have activity" without
// the staff member ever opening a portal first.
export async function fetchPortalActivity(businessSpaceId) {
  const empty = { total: 0, byPortalProject: {} }
  if (!businessSpaceId) return empty

  const { data: portals } = await supabase
    .from('portal_links')
    .select('id, portal_projects(id, project_id, staff_last_viewed)')
    .eq('business_space_id', businessSpaceId)

  const portalProjects = (portals || []).flatMap(p => p.portal_projects || [])
  if (!portalProjects.length) return empty

  const projectIds = portalProjects.map(pp => pp.project_id)
  const { data: delivs } = await supabase
    .from('deliverables')
    .select('id, project_id')
    .in('project_id', projectIds)

  if (!delivs?.length) return empty

  const delivToProject = Object.fromEntries(delivs.map(d => [d.id, d.project_id]))
  const delivIds = delivs.map(d => d.id)

  const [{ data: comments }, { data: reactions }] = await Promise.all([
    supabase.from('deliverable_comments').select('deliverable_id, created_at').in('deliverable_id', delivIds).eq('author_type', 'client'),
    supabase.from('deliverable_reactions').select('deliverable_id, created_at').in('deliverable_id', delivIds),
  ])

  const projectToPP = Object.fromEntries(portalProjects.map(pp => [pp.project_id, pp]))
  const byPortalProject = {}

  for (const row of [...(comments || []), ...(reactions || [])]) {
    const projectId = delivToProject[row.deliverable_id]
    const pp = projectToPP[projectId]
    if (!pp) continue
    const lastViewed = pp.staff_last_viewed ? new Date(pp.staff_last_viewed) : null
    const isUnread = !lastViewed || new Date(row.created_at) > lastViewed
    if (isUnread) byPortalProject[pp.id] = (byPortalProject[pp.id] || 0) + 1
  }

  const total = Object.values(byPortalProject).reduce((sum, n) => sum + n, 0)
  return { total, byPortalProject }
}
