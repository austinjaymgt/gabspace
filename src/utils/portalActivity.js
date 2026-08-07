import { supabase } from '../supabaseClient'

// Computes unread client activity (comments + reactions + approvals)
// across every portal in a business space, eagerly — unlike the old
// per-portal lazy fetch this replaces, so a badge can show "you have
// activity" without the staff member ever opening a portal first.
//
// `items` carries per-event detail (newest first, capped) for UI
// surfaces that need more than a count, e.g. a notifications panel.
export async function fetchPortalActivity(businessSpaceId) {
  const empty = { total: 0, byPortalProject: {}, items: [] }
  if (!businessSpaceId) return empty

  const { data: portals } = await supabase
    .from('portal_links')
    .select('id, portal_projects(id, project_id, staff_last_viewed, projects(id, title))')
    .eq('business_space_id', businessSpaceId)

  const portalProjects = (portals || []).flatMap(p => p.portal_projects || [])
  if (!portalProjects.length) return empty

  const projectIds = portalProjects.map(pp => pp.project_id)
  const { data: delivs } = await supabase
    .from('deliverables')
    .select('id, project_id, name, approved_by_client, approved_at')
    .in('project_id', projectIds)

  if (!delivs?.length) return empty

  const delivToProject = Object.fromEntries(delivs.map(d => [d.id, d.project_id]))
  const delivNames = Object.fromEntries(delivs.map(d => [d.id, d.name]))
  const delivIds = delivs.map(d => d.id)

  const [{ data: comments }, { data: reactions }] = await Promise.all([
    supabase.from('deliverable_comments').select('id, deliverable_id, author_name, body, created_at').in('deliverable_id', delivIds).eq('author_type', 'client'),
    supabase.from('deliverable_reactions').select('id, deliverable_id, emoji, created_at').in('deliverable_id', delivIds),
  ])

  const projectToPP = Object.fromEntries(portalProjects.map(pp => [pp.project_id, pp]))
  const byPortalProject = {}
  const items = []

  const rows = [
    ...(comments || []).map(c => ({ ...c, type: 'comment' })),
    ...(reactions || []).map(r => ({ ...r, type: 'reaction' })),
    ...delivs.filter(d => d.approved_by_client && d.approved_at).map(d => ({
      id: d.id, deliverable_id: d.id, created_at: d.approved_at, type: 'approval',
    })),
  ]

  for (const row of rows) {
    const projectId = delivToProject[row.deliverable_id]
    const pp = projectToPP[projectId]
    if (!pp) continue
    const lastViewed = pp.staff_last_viewed ? new Date(pp.staff_last_viewed) : null
    const isUnread = !lastViewed || new Date(row.created_at) > lastViewed
    if (!isUnread) continue

    byPortalProject[pp.id] = (byPortalProject[pp.id] || 0) + 1
    items.push({
      id: `${row.type}:${row.id}`,
      type: row.type,
      portalProjectId: pp.id,
      projectId,
      projectTitle: pp.projects?.title,
      deliverableId: row.deliverable_id,
      deliverableName: delivNames[row.deliverable_id],
      authorName: row.author_name,
      body: row.body,
      emoji: row.emoji,
      createdAt: row.created_at,
    })
  }

  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const total = Object.values(byPortalProject).reduce((sum, n) => sum + n, 0)
  return { total, byPortalProject, items: items.slice(0, 20) }
}

// Marks a linked portal project as viewed by staff "now", clearing its
// unread activity. Returns the timestamp written so callers can update
// local state without a refetch.
export async function markProjectViewed(portalProjectId) {
  const now = new Date().toISOString()
  await supabase.from('portal_projects').update({ staff_last_viewed: now }).eq('id', portalProjectId)
  return now
}

// Subscribes to new client comments/reactions/approvals across all
// portals and calls `onChange` (debounced, to coalesce bursts) whenever
// one arrives. Callers don't get the row itself — just a signal to
// refetch — since these tables have no direct business_space_id to
// filter on. The deliverables listener fires on any edit, not just
// approvals (there's no way to filter to just approved_by_client
// flips), but that's harmless — it only triggers a refetch. Returns an
// unsubscribe function.
export function subscribeToPortalActivityChanges(businessSpaceId, onChange) {
  if (!businessSpaceId) return () => {}

  let timer = null
  function scheduleRefresh() {
    clearTimeout(timer)
    timer = setTimeout(onChange, 400)
  }

  const channel = supabase
    .channel(`portal-activity-${businessSpaceId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deliverable_comments', filter: 'author_type=eq.client' }, scheduleRefresh)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deliverable_reactions' }, scheduleRefresh)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deliverables' }, scheduleRefresh)
    .subscribe()

  return () => {
    clearTimeout(timer)
    supabase.removeChannel(channel)
  }
}
