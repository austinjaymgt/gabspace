// Per-request context shared by every Gabspace tool: who the caller is,
// which businesses they can act in, and the helpers tools use to scope
// themselves to one of those businesses. Used by the MCP server now and
// the Orbi agent later, so nothing here is MCP-specific.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

// Client-role members only ever see their portal - tools are for staff.
const STAFF_ROLES = ['owner', 'co-owner', 'employee']

// Mirrors MODULE_DEFS in src/utils/businessModules.js.
export type ModuleKey = 'clientManagement' | 'portals' | 'money' | 'operations' | 'creativeCollective' | 'team'

export const MODULE_LABELS: Record<ModuleKey, string> = {
  clientManagement: 'Client Management',
  portals: 'Portals',
  money: 'Money',
  operations: 'Operations',
  creativeCollective: 'Creative Collective',
  team: 'Team',
}

export type Business = {
  id: string
  name: string
  role: string
  // NULL in the DB means never configured, which reads as everything on.
  modules: Record<ModuleKey, boolean>
}

export type ToolContext = {
  userId: string
  // Runs as the caller, so every read goes through RLS - tools never get
  // a service-role client.
  supabase: SupabaseClient
  businesses: Business[]
  // The business the user is currently switched into in the web app
  // (user_profiles.business_space_id). Most tables' RLS only exposes this
  // one, so tools only operate on it - see resolveBusiness.
  activeBusinessId: string | null
}

// Thrown for anything the caller should see as a plain explanation
// (wrong business, module off, bad id) rather than a server fault.
export class ToolError extends Error {
  kind: 'denied' | 'error'
  constructor(message: string, kind: 'denied' | 'error' = 'error') {
    super(message)
    this.kind = kind
  }
}

export async function loadToolContext(supabase: SupabaseClient, userId: string): Promise<ToolContext> {
  const [membershipsRes, profileRes] = await Promise.all([
    supabase
      .from('business_space_members')
      .select('business_space_id, role, business_spaces(name, archived_at, enabled_modules)')
      .eq('user_id', userId),
    supabase.from('user_profiles').select('business_space_id').eq('user_id', userId).maybeSingle(),
  ])
  if (membershipsRes.error) throw new Error(`Couldn't load your businesses: ${membershipsRes.error.message}`)

  const businesses = (membershipsRes.data || [])
    .filter((m: any) => STAFF_ROLES.includes(m.role) && m.business_spaces && !m.business_spaces.archived_at)
    .map((m: any) => ({
      id: m.business_space_id,
      name: m.business_spaces.name,
      role: m.role,
      modules: {
        ...Object.fromEntries(Object.keys(MODULE_LABELS).map(k => [k, true])),
        ...(m.business_spaces.enabled_modules || {}),
      } as Record<ModuleKey, boolean>,
    }))

  return { userId, supabase, businesses, activeBusinessId: profileRes.data?.business_space_id ?? null }
}

// Picks the business a tool call is about. RLS on most business tables
// (clients, projects, invoices, ...) only exposes the user's *active*
// business, so querying any other one would silently come back empty -
// instead, anything but the active business gets a clear "switch first"
// answer. Once those policies move to membership-based access this can
// accept any business the caller is staff on.
export function resolveBusiness(ctx: ToolContext, businessSpaceId: string | undefined, module?: ModuleKey): Business {
  const active = ctx.businesses.find(b => b.id === ctx.activeBusinessId)
  if (!active) {
    throw new ToolError('Your active business in gabspace isn\'t one you\'re on the team for (or it\'s archived). Switch to one of your businesses in gabspace, then try again.', 'denied')
  }

  if (businessSpaceId && businessSpaceId !== active.id) {
    const requested = ctx.businesses.find(b => b.id === businessSpaceId)
    if (!requested) throw new ToolError('That business either doesn\'t exist or you aren\'t on its team. Call list_businesses to see the ones you can use.', 'denied')
    throw new ToolError(`For now I can only read your active business, which is ${active.name}. To look at ${requested.name}, switch to it in gabspace and ask again.`, 'denied')
  }

  if (module && !active.modules[module]) {
    throw new ToolError(`${active.name} has the ${MODULE_LABELS[module]} module turned off, so there's nothing to show here.`, 'denied')
  }
  return active
}

// For tools that take a record id rather than a business id: confirms the
// record's business is one the caller is staff on (RLS alone would also
// let client-role members read some rows) and that the module is on.
export function businessForRecord(ctx: ToolContext, businessSpaceId: string | null, module?: ModuleKey): Business {
  if (!businessSpaceId) throw new ToolError('Record not found.', 'denied')
  return resolveBusiness(ctx, businessSpaceId, module)
}

// UTC date. Good enough for "overdue" / "upcoming" windows; the model is
// told the date it was computed against so it can caveat edge cases.
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// Supabase errors from RLS on role-scoped tables (e.g. employees and
// financial data) surface as generic permission errors - make them readable.
export function check<T>(result: { data: T | null; error: { message: string; code?: string } | null }, what: string): T {
  if (result.error) {
    if (result.error.code === '42501') throw new ToolError(`Your role doesn't have access to ${what}.`, 'denied')
    throw new Error(`Couldn't load ${what}: ${result.error.message}`)
  }
  return (result.data ?? []) as T
}
