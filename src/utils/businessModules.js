// Which feature modules a business space has turned on. There's no schema
// for this yet, so it's mock/local state persisted per business in
// localStorage — a business with no stored entry (e.g. AJ Management,
// created before this existed) defaults to everything on, unchanged.

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
export const MODULE_NAV_PATHS = {
  clientManagement: ['allclients', 'projects', 'tasks'],
  portals: ['client-portal-manager'],
  money: ['income', 'expenses', 'snapshot'],
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
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + businessSpaceId)
    if (!raw) return ALL_ON
    return { ...ALL_ON, ...JSON.parse(raw) }
  } catch {
    return ALL_ON
  }
}

export function setModules(businessSpaceId, modules) {
  if (!businessSpaceId) return
  localStorage.setItem(STORAGE_PREFIX + businessSpaceId, JSON.stringify(modules))
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
