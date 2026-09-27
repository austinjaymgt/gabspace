// First-visit hints: one Orbi bubble the first time someone opens a page.
// Pages with a clear main action tag it data-tour="page-action" and the
// hint points at it; everything else gets a centered bubble. Pages not
// listed here (Dashboard, which the tour covers, detail pages) get none.
export const PAGE_HINTS = {
  calendar: { title: 'Your calendar', body: 'Tasks, project milestones, content, networking events and goals — all on one calendar.' },
  tasks: { title: 'Tasks', body: 'Your to-do list. Add due dates and hand things off to teammates.' },
  allclients: { title: 'Your clients', target: 'page-action', body: 'Everyone you work with lives here. Add a client to keep their projects, notes and invoices together.' },
  projects: { title: 'Projects', target: 'page-action', body: 'Track each job from kickoff to delivery, with milestones and files in one place.' },
  'client-portal-manager': { title: 'Portals', target: 'page-action', body: 'Make a portal for a client and they can log in to follow along with their project.' },
  snapshot: { title: 'Snapshot', body: 'How the business is doing, pulled together from your income and expenses. Export reports whenever you need them.' },
  income: { title: 'Invoices & income', target: 'page-action', body: 'Create invoices, log income that came in another way, or set up recurring billing.' },
  expenses: { title: 'Expenses', target: 'page-action', body: 'Log what you spend and sort it into categories — future-you at tax time will be grateful.' },
  vendors: { title: 'Vendors', target: 'page-action', body: 'Keep the people and companies you hire, and their payment terms, close at hand.' },
  resources: { title: 'Resources', target: 'page-action', body: 'Files and links your team reaches for often, all in one spot.' },
  spark: { title: 'Spark', body: 'Got a rough idea — a vibe, a link, a working title? Shape it into a concept here, then turn it into a project.' },
  'creative-strategy': { title: 'Creative Strategy', body: "Plan campaigns: who they're for, what you're saying and where it'll show up." },
  'campaign-tracking': { title: 'Content Calendar', target: 'page-action', body: 'Plan and schedule your content. Switch between calendar, list and kanban views up top.' },
  assets: { title: 'Creative Assets', target: 'page-action', body: 'Your brand kit — logos, photos and files, with notes on when to use each one.' },
  'team-goals': { title: 'Goals', target: 'page-action', body: 'Set goals for the business and break them into steps so progress fills in as you go.' },
  'pro-dev': { title: 'Professional development', body: 'Track courses, certifications and conferences for everyone on the team.' },
  'business-events': { title: 'Networking', target: 'page-action', body: 'Plan the events you go to and host — goals, a prep list, and notes on how it went.' },
  'community-directory': { title: 'Directory', body: 'Find other creative businesses by name or city.' },
  'community-board': { title: 'The Board', body: "Post what you're looking for — a collaborator, a vendor, an extra pair of hands — or answer someone else's request." },
  'community-my-requests': { title: 'My Collabs', body: "Requests you've posted, ones you've answered, and your conversations with collaborators." },
  settings: { title: 'Settings', body: 'Your business details and logo, which modules are switched on, and your account.' },
}
