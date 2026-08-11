import { supabase } from '../supabaseClient'

// The client portal (?portal=<token>, anon/no-auth) has zero direct table
// grants on `deliverables` (see 20260725170000_lock_down_portal_and_deliverable_tables.sql)
// — it only ever reads through token-checked SECURITY DEFINER RPCs. That
// means it can't use postgres_changes realtime either, since Realtime
// authorizes subscriptions the same way it would a SELECT. Broadcast
// sidesteps that: it's a channel-scoped signal with no table access
// implied, carrying no deliverable data itself — just "something changed,
// go refetch via the RPC you already trust."

function channelName(projectId) {
  return `portal-project-${projectId}`
}

// Called from the admin side after any deliverable add/edit/status change,
// so an open client portal tab picks it up without a manual reload.
export async function broadcastPortalProjectChange(projectId) {
  if (!projectId) return
  const channel = supabase.channel(channelName(projectId))
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.send({ type: 'broadcast', event: 'deliverables-changed', payload: {} })
      supabase.removeChannel(channel)
    }
  })
}

// Called from the client portal for whichever project is currently open.
// Debounced so a burst of admin edits triggers one refetch, not several.
// Returns an unsubscribe function.
export function subscribeToPortalProjectChanges(projectId, onChange) {
  if (!projectId) return () => {}

  let timer = null
  function scheduleRefresh() {
    clearTimeout(timer)
    timer = setTimeout(onChange, 400)
  }

  const channel = supabase
    .channel(channelName(projectId))
    .on('broadcast', { event: 'deliverables-changed' }, scheduleRefresh)
    .subscribe()

  return () => {
    clearTimeout(timer)
    supabase.removeChannel(channel)
  }
}
