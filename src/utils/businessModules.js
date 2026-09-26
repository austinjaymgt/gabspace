import { supabase } from '../supabaseClient'

// Which feature modules a business space has turned on. The source of
// truth is business_spaces.enabled_modules (NULL = never configured =
// everything on). localStorage is kept as a synchronous cache so the
// sidebar/tab bar/dashboard can keep reading getModules() during render —
// App calls loadModules() whenever the active business changes to refresh it.

// One module per top-level sidebar section, so a toggle here always maps
// to a whole nav group turning on/off together (see MODULE_NAV_PATHS).
export const MODULE_DEFS = [
  { key: 'clientManagement', label: 'Client Management', icon: 'clients', description: 'Clients, projects, and tasks.' },
  { key: 'portals', label: 'Portals', icon: 'portal', description: 'A shared space where clients can log in and see updates.', requires: 'clientManagement' },
  { key: 'money', label: 'Money', icon: 'finance', description: 'Invoices, expenses, and financial snapshots.', requires: 'clientManagement' },
  { key: 'operations', label: 'Operations', icon: 'operations', description: 'Vendors and shared resources.' },
  { key: 'creativeCollective', label: 'Creative Collective', icon: 'creative', description: 'Spark, creative strategy, content calendar, and creative assets.' },
  { key: 'team', label: 'Team', icon: 'team', description: 'Team goals, professional development, and networking.' },
]

// Sidebar nav paths gated by each module — one entry per top-level sidebar
// section, listing every path under it (parent + children).
// 'team-members' (invites/roster) is intentionally excluded here — it's
// core account management, not an optional feature, so toggling the Team
// module off must not also hide the ability to manage who's on the team.
export const MODULE_NAV_PATHS = {
  clientManagement: ['allclients', 'projects', 'tasks'],
  portals: ['client-portal-manager'],
  money: ['snapshot', 'income', 'expenses'],
  operations: ['vendors', 'resources'],
  creativeCollective: ['spark', 'creative-strategy', 'campaign-tracking', 'assets'],
  team: ['team-goals', 'pro-dev', 'business-events'],
}

// Tables to check for existing data before warning that a toggle-off will
// hide it. One representative table per module; Portals has no dedicated
// table of its own.
export const MODULE_DATA_TABLES = {
  clientManagement: 'clients',
  money: 'invoices',
  operations: 'vendors',
  creativeCollective: 'assets',
  team: 'team_goals',
}

const ALL_ON = MODULE_DEFS.reduce((acc, m) => ({ ...acc, [m.key]: true }), {})
const STORAGE_PREFIX = 'gabspace_modules_'

export function getModules(businessSpaceId) {
  if (!businessSpaceId) return ALL_ON
  const cached = readCache(businessSpaceId)
  return cached ? { ...ALL_ON, ...cached } : ALL_ON
}

function writeCache(businessSpaceId, modules) {
  try {
    localStorage.setItem(STORAGE_PREFIX + businessSpaceId, JSON.stringify(modules))
  } catch { /* storage unavailable — the DB is still the source of truth */ }
}

function readCache(businessSpaceId) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + businessSpaceId)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Pulls the business's modules from the DB into the cache. A business that
// was configured back when this only lived in localStorage has a NULL
// column but a cached entry — push that up once so the owner's earlier
// choices aren't reset to all-on. Only owners/co-owners can write, so for
// anyone else the push just fails and the DB default (all on) wins.
export async function loadModules(businessSpaceId) {
  if (!businessSpaceId) return ALL_ON
  const { data, error } = await supabase
    .from('business_spaces')
    .select('enabled_modules')
    .eq('id', businessSpaceId)
    .maybeSingle()
  if (error) return getModules(businessSpaceId)

  if (data?.enabled_modules) {
    const modules = { ...ALL_ON, ...data.enabled_modules }
    writeCache(businessSpaceId, modules)
    return modules
  }

  const legacy = readCache(businessSpaceId)
  if (legacy) {
    const modules = { ...ALL_ON, ...legacy }
    const { error: pushError } = await supabase.rpc('set_business_modules', {
      target_business_space_id: businessSpaceId,
      new_modules: modules,
    })
    if (!pushError) return modules
  }
  writeCache(businessSpaceId, ALL_ON)
  return ALL_ON
}

// Writes the cache first so a re-render picks the change up immediately,
// then persists. On failure the cache is rolled back and the error returned.
export async function setModules(businessSpaceId, modules) {
  if (!businessSpaceId) return { error: null }
  const previous = getModules(businessSpaceId)
  writeCache(businessSpaceId, modules)
  const { error } = await supabase.rpc('set_business_modules', {
    target_business_space_id: businessSpaceId,
    new_modules: modules,
  })
  if (error) writeCache(businessSpaceId, previous)
  return { error }
}

// Flips one module and cascades its dependency relationship: turning a
// dependent on force-enables what it requires; turning off something
// required force-disables whatever depended on it. Returns the note to
// surface for whichever cascade fired, or null if the toggle was a no-op.
export function toggleModuleState(modules, key) {
  const def = MODULE_DEFS.find(m => m.key === key)
  const next = { ...modules, [key]: !modules[key] }
  let note = null

  if (next[key] && def.requires && !next[def.requires]) {
    next[def.requires] = true
    note = `${MODULE_DEFS.find(m => m.key === def.requires).label} was turned on too, since ${def.label} needs it.`
  }
  if (!next[key]) {
    MODULE_DEFS.forEach(m => {
      if (m.requires === key && next[m.key]) {
        next[m.key] = false
        note = `${m.label} was turned off too, since it needs ${def.label}.`
      }
    })
  }
  return { modules: next, note }
}
