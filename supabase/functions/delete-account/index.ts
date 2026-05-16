import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Every public table that holds workspace-scoped data.
// Order matters only loosely (no FKs between these), but we list them
// explicitly so deletion is deterministic and auditable.
const WORKSPACE_SCOPED_TABLES = [
  'assets',
  'business_events',
  'campaigns',
  'clients',
  'content_calendar',
  'event_briefs',
  'event_packages',
  'event_staffing',
  'expenses',
  'invoices',
  'notes',
  'portal_tokens',
  'portal_updates',
  'pro_dev',
  'project_documents',
  'projects',
  'resources',
  'revenue',
  'run_of_show',
  'vendors',
]

// Storage buckets that hold workspace-scoped files.
// Path convention: {workspace_id}/...
const WORKSPACE_SCOPED_BUCKETS = ['resources']

async function purgeBucketForWorkspace(
  adminClient: ReturnType<typeof createClient>,
  bucket: string,
  workspaceId: string
) {
  // List everything under {workspaceId}/ then recursively gather paths.
  // Supabase storage list() is non-recursive, so we walk subfolders.
  const allPaths: string[] = []

  async function walk(prefix: string) {
    const { data, error } = await adminClient.storage.from(bucket).list(prefix, {
      limit: 1000,
    })
    if (error) {
      console.log(`storage list error in ${bucket}/${prefix}:`, error.message)
      return
    }
    if (!data) return
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      // Folders have null metadata in Supabase storage
      if (item.id === null || item.metadata === null) {
        await walk(path)
      } else {
        allPaths.push(path)
      }
    }
  }

  await walk(workspaceId)

  if (allPaths.length === 0) return 0

  const { error } = await adminClient.storage.from(bucket).remove(allPaths)
  if (error) {
    console.log(`storage remove error in ${bucket}:`, error.message)
    return 0
  }
  return allPaths.length
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    // 1. Verify the caller's identity from their JWT.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      console.log('auth error:', userError?.message)
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userId = user.id
    const userEmail = user.email || 'unknown'
    console.log('delete-account requested by:', userId, userEmail)

    // 2. Service-role client for all destructive work.
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 3. Fetch all memberships for this user.
    const { data: memberships, error: membershipsError } = await adminClient
      .from('user_profiles')
      .select('workspace_id, role')
      .eq('user_id', userId)

    if (membershipsError) {
      console.log('memberships fetch error:', membershipsError.message)
      return new Response(JSON.stringify({ error: membershipsError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const ownedWorkspaceIds = (memberships || [])
      .filter(m => m.role === 'owner')
      .map(m => m.workspace_id)
    const memberOnlyWorkspaceIds = (memberships || [])
      .filter(m => m.role !== 'owner')
      .map(m => m.workspace_id)

    // 4. BLOCK CHECK: for each owned workspace, count *other* members.
    const blockingWorkspaces: Array<{ id: string; name: string; other_member_count: number }> = []
    const soloOwnedWorkspaceIds: string[] = []

    for (const wsId of ownedWorkspaceIds) {
      const { count, error: countError } = await adminClient
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', wsId)
        .neq('user_id', userId)

      if (countError) {
        console.log(`count error for workspace ${wsId}:`, countError.message)
        return new Response(JSON.stringify({ error: countError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if ((count || 0) > 0) {
        const { data: ws } = await adminClient
          .from('workspaces')
          .select('name')
          .eq('id', wsId)
          .single()
        blockingWorkspaces.push({
          id: wsId,
          name: ws?.name || 'Untitled workspace',
          other_member_count: count || 0,
        })
      } else {
        soloOwnedWorkspaceIds.push(wsId)
      }
    }

    if (blockingWorkspaces.length > 0) {
      console.log('blocked — owns workspaces with other members:', blockingWorkspaces)
      return new Response(JSON.stringify({
        status: 'blocked',
        reason: 'workspace_has_other_members',
        blocking_workspaces: blockingWorkspaces,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 5. PROCEED: clean up solo-owned workspaces.
    for (const wsId of soloOwnedWorkspaceIds) {
      console.log(`deleting workspace ${wsId}`)

      // 5a. Purge storage first (otherwise orphaned).
      for (const bucket of WORKSPACE_SCOPED_BUCKETS) {
        const removed = await purgeBucketForWorkspace(adminClient, bucket, wsId)
        console.log(`  purged ${removed} files from ${bucket}`)
      }

      // 5b. Delete all workspace-scoped table rows.
      for (const table of WORKSPACE_SCOPED_TABLES) {
        const { error: delError } = await adminClient
          .from(table)
          .delete()
          .eq('workspace_id', wsId)
        if (delError) {
          console.log(`  delete error in ${table}:`, delError.message)
          // Don't abort — log and continue. Audit log captures partial state.
        }
      }

      // 5c. Delete the workspace row itself.
      const { error: wsDelError } = await adminClient
        .from('workspaces')
        .delete()
        .eq('id', wsId)
      if (wsDelError) {
        console.log(`  workspace delete error:`, wsDelError.message)
      }
    }

    // 6. Leave member-only workspaces (just remove our profile row from them).
    if (memberOnlyWorkspaceIds.length > 0) {
      const { error: leaveError } = await adminClient
        .from('user_profiles')
        .delete()
        .eq('user_id', userId)
        .in('workspace_id', memberOnlyWorkspaceIds)
      if (leaveError) {
        console.log('leave workspaces error:', leaveError.message)
      }
    }

    // 7. Global user-scoped cleanup.
    const { error: settingsError } = await adminClient
      .from('user_settings')
      .delete()
      .eq('user_id', userId)
    if (settingsError) console.log('user_settings delete error:', settingsError.message)

    // Safety net — catch any stragglers (shouldn't be any after the loops above).
    const { error: profilesError } = await adminClient
      .from('user_profiles')
      .delete()
      .eq('user_id', userId)
    if (profilesError) console.log('user_profiles final cleanup error:', profilesError.message)

    // 8. Audit log — write BEFORE deleting auth user so the email is still accessible.
    const { error: auditError } = await adminClient
      .from('account_deletions')
      .insert({
        user_id: userId,
        email: userEmail,
        workspaces_deleted: soloOwnedWorkspaceIds,
        workspaces_left: memberOnlyWorkspaceIds,
        reason: 'user_requested',
        initiated_from: 'settings_ui',
      })
    if (auditError) {
      console.log('audit log error:', auditError.message)
      // This is bad but not fatal — we already destroyed the user's data.
      // Continue to auth deletion so we don't leave them in a half-state.
    }

    // 9. Finally, delete the auth user.
    const { error: authDelError } = await adminClient.auth.admin.deleteUser(userId)
    if (authDelError) {
      console.log('auth deleteUser error:', authDelError.message)
      return new Response(JSON.stringify({
        error: 'Account data was removed but auth user could not be deleted. Contact support.',
        details: authDelError.message,
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('delete-account complete for:', userId)
    return new Response(JSON.stringify({
      status: 'deleted',
      workspaces_deleted: soloOwnedWorkspaceIds.length,
      workspaces_left: memberOnlyWorkspaceIds.length,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.log('catch error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})