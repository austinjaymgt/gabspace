import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

const STATUS_COLORS = {
  draft:          { bg: t.colors.bgHover,      color: t.colors.textSecondary, label: 'Draft' },
  pending_review: { bg: t.colors.warningLight, color: t.colors.warning,       label: 'Pending Review' },
  approved:       { bg: t.colors.successLight, color: t.colors.success,       label: 'Approved' },
}

const PORTAL_STATUS = {
  active:    { bg: t.colors.successLight,  color: t.colors.success,       label: 'Active' },
  paused:    { bg: t.colors.warningLight,  color: t.colors.warning,       label: 'Paused' },
  completed: { bg: t.colors.bgHover,       color: t.colors.textTertiary,  label: 'Completed' },
}

const REACTIONS = ['👍', '❤️', '🔥', '🎉']

function StatusBadge({ status }) {
  const cfg = STATUS_COLORS[status] || STATUS_COLORS.draft
  return (
    <span style={{ fontSize: t.fontSizes.xs, fontWeight: 600, padding: '2px 8px', borderRadius: t.radius.full, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}

function UnreadDot({ count }) {
  if (!count) return null
  return (
    <span style={{ background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.xs, fontWeight: 700, borderRadius: t.radius.full, minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
      {count}
    </span>
  )
}

function chevron(open) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

export default function ClientPortalManager({ workspaceId, session }) {
  const [portals, setPortals] = useState([])
  const [clients, setClients] = useState([])
  const [projectsByClient, setProjectsByClient] = useState({})
  const [loading, setLoading] = useState(true)
  const [expandedPortal, setExpandedPortal] = useState(null)
  const [expandedProject, setExpandedProject] = useState(null)
  const [expandedDeliv, setExpandedDeliv] = useState(null) // deliverable id
  const [showNewPortal, setShowNewPortal] = useState(false)
  const [newClientId, setNewClientId] = useState('')
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(null)

  // Activity: unread comment counts per portal_project id
  const [unreadCounts, setUnreadCounts] = useState({}) // portalProjectId → number

  // Deliverable form
  const [showDelivForm, setShowDelivForm] = useState(null)
  const [delivForm, setDelivForm] = useState({ name: '', description: '', file_url: '', file_type: 'link', status: 'draft' })
  const [savingDeliv, setSavingDeliv] = useState(false)

  // Deliverables + activity per project
  const [deliverables, setDeliverables] = useState({}) // project_id → []
  const [delivComments, setDelivComments] = useState({}) // delivId → []
  const [delivReactions, setDelivReactions] = useState({}) // delivId → { emoji: count }

  // Staff reply
  const [replyInput, setReplyInput] = useState({}) // delivId → string
  const [sendingReply, setSendingReply] = useState(false)

  const staffName = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Team'

  useEffect(() => { if (workspaceId) init() }, [workspaceId])

  async function init() {
    setLoading(true)
    await Promise.all([fetchPortals(), fetchClients()])
    setLoading(false)
  }

  async function fetchPortals() {
    const { data } = await supabase
      .from('portal_links')
      .select('*, clients(name, company), portal_projects(id, project_id, staff_last_viewed, projects(id, title, status))')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    setPortals(data || [])
    return data || []
  }

  async function fetchActivityForPortal(portal) {
    const pps = portal.portal_projects || []
    if (!pps.length) return

    // Collect all project ids
    const projectIds = pps.map(pp => pp.project_id)

    // Fetch all deliverables for these projects
    const { data: delivs } = await supabase
      .from('deliverables')
      .select('id, project_id')
      .in('project_id', projectIds)

    if (!delivs?.length) return

    const delivIds = delivs.map(d => d.id)
    const delivToProject = Object.fromEntries(delivs.map(d => [d.id, d.project_id]))

    // Fetch all client comments for those deliverables
    const { data: cmts } = await supabase
      .from('deliverable_comments')
      .select('deliverable_id, created_at, author_type')
      .in('deliverable_id', delivIds)
      .eq('author_type', 'client')

    if (!cmts?.length) return

    // Map project → portal_project for staff_last_viewed lookup
    const projectToPP = Object.fromEntries(pps.map(pp => [pp.project_id, pp]))

    // Count unread per portal_project
    const counts = {}
    for (const cmt of cmts) {
      const projectId = delivToProject[cmt.deliverable_id]
      const pp = projectToPP[projectId]
      if (!pp) continue
      const lastViewed = pp.staff_last_viewed ? new Date(pp.staff_last_viewed) : null
      const isUnread = !lastViewed || new Date(cmt.created_at) > lastViewed
      if (isUnread) {
        counts[pp.id] = (counts[pp.id] || 0) + 1
      }
    }

    setUnreadCounts(prev => ({ ...prev, ...counts }))
  }

  async function fetchClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, name, company')
      .eq('workspace_id', workspaceId)
      .order('name')
    setClients(data || [])
  }

  async function fetchClientProjects(clientId) {
    if (projectsByClient[clientId]) return
    const { data } = await supabase
      .from('projects')
      .select('id, title, status')
      .eq('client_id', clientId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    setProjectsByClient(prev => ({ ...prev, [clientId]: data || [] }))
  }

  async function fetchDeliverables(projectId) {
    const { data } = await supabase
      .from('deliverables')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    setDeliverables(prev => ({ ...prev, [projectId]: data || [] }))
    return data || []
  }

  async function fetchDelivActivity(delivIds) {
    if (!delivIds.length) return

    const [{ data: cmts }, { data: rxns }] = await Promise.all([
      supabase.from('deliverable_comments').select('*').in('deliverable_id', delivIds).order('created_at', { ascending: true }),
      supabase.from('deliverable_reactions').select('deliverable_id, emoji').in('deliverable_id', delivIds),
    ])

    const cmtMap = {}
    for (const c of cmts || []) {
      cmtMap[c.deliverable_id] = cmtMap[c.deliverable_id] || []
      cmtMap[c.deliverable_id].push(c)
    }

    const rxnMap = {}
    for (const r of rxns || []) {
      rxnMap[r.deliverable_id] = rxnMap[r.deliverable_id] || {}
      rxnMap[r.deliverable_id][r.emoji] = (rxnMap[r.deliverable_id][r.emoji] || 0) + 1
    }

    setDelivComments(prev => ({ ...prev, ...cmtMap }))
    setDelivReactions(prev => ({ ...prev, ...rxnMap }))
  }

  async function markProjectViewed(portalProjectId) {
    const now = new Date().toISOString()
    await supabase.from('portal_projects').update({ staff_last_viewed: now }).eq('id', portalProjectId)
    setUnreadCounts(prev => { const next = { ...prev }; delete next[portalProjectId]; return next })
    // update local portal state
    setPortals(prev => prev.map(p => ({
      ...p,
      portal_projects: p.portal_projects.map(pp =>
        pp.id === portalProjectId ? { ...pp, staff_last_viewed: now } : pp
      )
    })))
  }

  async function createPortal() {
    if (!newClientId) return
    setCreating(true)
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    const { error } = await supabase.from('portal_links').insert({ client_id: newClientId, workspace_id: workspaceId, token })
    if (!error) { setShowNewPortal(false); setNewClientId(''); await fetchPortals() }
    setCreating(false)
  }

  async function deletePortal(id) {
    if (!confirm('Remove this client portal? This will also remove all deliverables and comments.')) return
    await supabase.from('portal_links').delete().eq('id', id)
    setPortals(prev => prev.filter(p => p.id !== id))
  }

  async function addProjectToPortal(portalId, projectId) {
    await supabase.from('portal_projects').insert({ portal_link_id: portalId, project_id: projectId })
    await fetchPortals()
  }

  async function removeProjectFromPortal(portalProjectId) {
    await supabase.from('portal_projects').delete().eq('id', portalProjectId)
    await fetchPortals()
  }

  async function addDeliverable(projectId) {
    if (!delivForm.name.trim()) return
    setSavingDeliv(true)
    const { data, error } = await supabase.from('deliverables').insert({
      project_id: projectId,
      workspace_id: workspaceId,
      ...delivForm,
    }).select().single()
    if (!error) {
      setDeliverables(prev => ({ ...prev, [projectId]: [data, ...(prev[projectId] || [])] }))
      setDelivForm({ name: '', description: '', file_url: '', file_type: 'link', status: 'draft' })
      setShowDelivForm(null)
    }
    setSavingDeliv(false)
  }

  async function deleteDeliverable(delivId, projectId) {
    await supabase.from('deliverables').delete().eq('id', delivId)
    setDeliverables(prev => ({ ...prev, [projectId]: prev[projectId].filter(d => d.id !== delivId) }))
    if (expandedDeliv === delivId) setExpandedDeliv(null)
  }

  async function updateDeliverableStatus(delivId, projectId, status) {
    await supabase.from('deliverables').update({ status }).eq('id', delivId)
    setDeliverables(prev => ({
      ...prev,
      [projectId]: prev[projectId].map(d => d.id === delivId ? { ...d, status } : d)
    }))
  }

  async function submitReply(delivId) {
    const body = (replyInput[delivId] || '').trim()
    if (!body) return
    setSendingReply(true)
    const { data: newComment } = await supabase.from('deliverable_comments').insert({
      deliverable_id: delivId,
      author_type: 'staff',
      author_name: staffName,
      body,
    }).select().single()
    if (newComment) {
      setDelivComments(prev => ({ ...prev, [delivId]: [...(prev[delivId] || []), newComment] }))
      setReplyInput(prev => ({ ...prev, [delivId]: '' }))
    }
    setSendingReply(false)
  }

  async function updatePortalStatus(portalId, status) {
    await supabase.from('portal_links').update({ status }).eq('id', portalId)
    setPortals(prev => prev.map(p => p.id === portalId ? { ...p, status } : p))
    // collapse if just moved to completed
    if (status === 'completed' && expandedPortal === portalId) {
      setExpandedPortal(null)
      setExpandedProject(null)
      setExpandedDeliv(null)
    }
  }

  function copyLink(token) {
    const url = `${window.location.origin}?portal=${token}`
    navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  const [showCompleted, setShowCompleted] = useState(false)

  const alreadyHasPortal = new Set(portals.map(p => p.client_id))
  const availableClients = clients.filter(c => !alreadyHasPortal.has(c.id))
  const activePortals = portals.filter(p => p.status !== 'completed')
  const completedPortals = portals.filter(p => p.status === 'completed')

  if (loading) return <div style={{ padding: t.space.xl, color: t.colors.textTertiary, fontFamily: t.fonts.sans }}>Loading...</div>

  return (
    <div style={{ padding: t.space.xl, fontFamily: t.fonts.sans, maxWidth: 860, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.space.xl }}>
        <div>
          <h1 style={{ margin: 0, fontSize: t.fontSizes['2xl'], fontFamily: t.fonts.heading, color: t.colors.textPrimary }}>Client Portals</h1>
          <p style={{ margin: '4px 0 0', fontSize: t.fontSizes.md, color: t.colors.textTertiary }}>{portals.length} active portal{portals.length !== 1 ? 's' : ''}</p>
        </div>
        {!showNewPortal && (
          <button onClick={() => setShowNewPortal(true)} style={btnStyle}>+ New Portal</button>
        )}
      </div>

      {/* New portal form */}
      {showNewPortal && (
        <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: t.space.lg, marginBottom: t.space.lg, display: 'flex', gap: t.space.md, alignItems: 'center' }}>
          <select value={newClientId} onChange={e => setNewClientId(e.target.value)} style={inputStyle}>
            <option value="">Select a client...</option>
            {availableClients.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>
            ))}
          </select>
          <button onClick={createPortal} disabled={!newClientId || creating} style={btnStyle}>
            {creating ? 'Creating...' : 'Create'}
          </button>
          <button onClick={() => { setShowNewPortal(false); setNewClientId('') }} style={ghostBtnStyle}>Cancel</button>
        </div>
      )}

      {portals.length === 0 && !showNewPortal && (
        <div style={{ textAlign: 'center', padding: `${t.space['3xl']} 0`, color: t.colors.textTertiary, fontSize: t.fontSizes.md }}>
          No portals yet — create one to give your client a home base.
        </div>
      )}

      {/* Active + Paused portal list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: t.space.md }}>
        {activePortals.map(portal => {
          const isOpen = expandedPortal === portal.id
          const client = portal.clients
          const linkedProjects = portal.portal_projects || []
          const linkedProjectIds = new Set(linkedProjects.map(pp => pp.project_id))
          const availableToAdd = (projectsByClient[portal.client_id] || []).filter(p => !linkedProjectIds.has(p.id))
          const portalUnread = linkedProjects.reduce((sum, pp) => sum + (unreadCounts[pp.id] || 0), 0)

          return (
            <div key={portal.id} style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, overflow: 'hidden' }}>

              {/* Portal header row */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: t.space.md, padding: `${t.space.md} ${t.space.lg}`, cursor: 'pointer', userSelect: 'none' }}
                onClick={async () => {
                  const next = isOpen ? null : portal.id
                  setExpandedPortal(next)
                  setExpandedProject(null)
                  setExpandedDeliv(null)
                  if (next) {
                    await fetchClientProjects(portal.client_id)
                    await fetchActivityForPortal(portal)
                  }
                }}
              >
                <span style={{ color: t.colors.textTertiary }}>{chevron(isOpen)}</span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: t.space.sm }}>
                  <span style={{ fontWeight: 600, fontSize: t.fontSizes.lg, color: t.colors.textPrimary }}>{client?.name}</span>
                  {client?.company && <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>{client.company}</span>}
                  <UnreadDot count={portalUnread} />
                </div>
                <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>{linkedProjects.length} project{linkedProjects.length !== 1 ? 's' : ''}</span>
                <select
                  value={portal.status || 'active'}
                  onChange={e => { updatePortalStatus(portal.id, e.target.value) }}
                  onClick={e => e.stopPropagation()}
                  style={{ ...inputStyle, width: 'auto', fontSize: t.fontSizes.sm, padding: '3px 8px', color: PORTAL_STATUS[portal.status || 'active'].color, fontWeight: 600 }}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
                <button onClick={e => { e.stopPropagation(); copyLink(portal.token) }} style={{ ...ghostBtnStyle, fontSize: t.fontSizes.sm }}>
                  {copied === portal.token ? 'Copied!' : 'Copy Link'}
                </button>
                <button onClick={e => { e.stopPropagation(); deletePortal(portal.id) }} style={{ ...ghostBtnStyle, color: t.colors.danger, fontSize: t.fontSizes.sm }}>
                  Remove
                </button>
              </div>

              {/* Expanded: projects */}
              {isOpen && (
                <div style={{ borderTop: `1px solid ${t.colors.borderLight}` }}>

                  {linkedProjects.length === 0 && (
                    <div style={{ padding: `${t.space.md} ${t.space.lg}`, color: t.colors.textTertiary, fontSize: t.fontSizes.md }}>
                      No projects added yet — add one so your client can follow along.
                    </div>
                  )}

                  {linkedProjects.map(pp => {
                    const proj = pp.projects
                    const projOpen = expandedProject === pp.id
                    const delivs = deliverables[proj.id] || []
                    const ppUnread = unreadCounts[pp.id] || 0

                    return (
                      <div key={pp.id} style={{ borderBottom: `1px solid ${t.colors.borderLight}` }}>

                        {/* Project row */}
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: t.space.sm, padding: `${t.space.sm} ${t.space.lg} ${t.space.sm} 40px`, cursor: 'pointer', background: projOpen ? t.colors.bgHover : 'transparent' }}
                          onClick={async () => {
                            const next = projOpen ? null : pp.id
                            setExpandedProject(next)
                            setExpandedDeliv(null)
                            if (next) {
                              const delivs = await fetchDeliverables(proj.id)
                              await fetchDelivActivity(delivs.map(d => d.id))
                              await markProjectViewed(pp.id)
                            }
                          }}
                        >
                          <span style={{ color: t.colors.textTertiary }}>{chevron(projOpen)}</span>
                          <span style={{ flex: 1, fontWeight: 500, color: t.colors.textPrimary, fontSize: t.fontSizes.md }}>{proj?.title}</span>
                          <UnreadDot count={ppUnread} />
                          <button onClick={e => { e.stopPropagation(); removeProjectFromPortal(pp.id) }} style={{ ...ghostBtnStyle, fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
                            Remove
                          </button>
                        </div>

                        {/* Deliverables */}
                        {projOpen && (
                          <div style={{ padding: `${t.space.sm} ${t.space.lg} ${t.space.md} 64px` }}>

                            {delivs.map(d => {
                              const isDelivOpen = expandedDeliv === d.id
                              const cmts = delivComments[d.id] || []
                              const rxns = delivReactions[d.id] || {}
                              const totalCmts = cmts.length
                              const clientCmts = cmts.filter(c => c.author_type === 'client').length

                              return (
                                <div key={d.id} style={{ borderBottom: `1px solid ${t.colors.borderLight}`, marginBottom: 0 }}>

                                  {/* Deliverable header row */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: t.space.md, padding: `${t.space.sm} 0` }}>
                                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpandedDeliv(isDelivOpen ? null : d.id)}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: t.space.sm }}>
                                        <span style={{ color: t.colors.textTertiary }}>{chevron(isDelivOpen)}</span>
                                        <span style={{ fontWeight: 500, fontSize: t.fontSizes.md, color: t.colors.textPrimary }}>{d.name}</span>
                                        {totalCmts > 0 && (
                                          <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
                                            💬 {totalCmts}{clientCmts > 0 ? ` (${clientCmts} from client)` : ''}
                                          </span>
                                        )}
                                        {Object.keys(rxns).length > 0 && (
                                          <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
                                            {Object.entries(rxns).map(([e, c]) => `${e}${c}`).join(' ')}
                                          </span>
                                        )}
                                      </div>
                                      {d.description && <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, marginTop: 2, paddingLeft: 22 }}>{d.description}</div>}
                                    </div>
                                    <select
                                      value={d.status}
                                      onChange={e => updateDeliverableStatus(d.id, proj.id, e.target.value)}
                                      style={{ ...inputStyle, width: 'auto', fontSize: t.fontSizes.sm, padding: '3px 8px' }}
                                    >
                                      <option value="draft">Draft</option>
                                      <option value="pending_review">Pending Review</option>
                                      <option value="approved">Approved</option>
                                    </select>
                                    <StatusBadge status={d.status} />
                                    <button onClick={() => deleteDeliverable(d.id, proj.id)} style={{ ...ghostBtnStyle, color: t.colors.danger, fontSize: t.fontSizes.xs }}>✕</button>
                                  </div>

                                  {/* Expanded: comments + reactions + reply */}
                                  {isDelivOpen && (
                                    <div style={{ marginBottom: t.space.md, paddingLeft: 22 }}>

                                      {/* Reaction summary */}
                                      {Object.keys(rxns).length > 0 && (
                                        <div style={{ display: 'flex', gap: t.space.sm, flexWrap: 'wrap', marginBottom: t.space.sm }}>
                                          {REACTIONS.filter(e => rxns[e]).map(e => (
                                            <span key={e} style={{ background: t.colors.bgHover, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.full, padding: '2px 10px', fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>
                                              {e} {rxns[e]}
                                            </span>
                                          ))}
                                        </div>
                                      )}

                                      {/* Comment thread */}
                                      {cmts.length === 0 && (
                                        <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, marginBottom: t.space.sm }}>No comments yet — this is where client feedback will show up.</div>
                                      )}
                                      {cmts.map(c => (
                                        <div key={c.id} style={{ display: 'flex', gap: t.space.sm, marginBottom: t.space.sm, alignItems: 'flex-start' }}>
                                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: c.author_type === 'staff' ? t.colors.primary : t.colors.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span style={{ color: '#fff', fontSize: t.fontSizes.xs, fontWeight: 700 }}>{(c.author_name || '?')[0].toUpperCase()}</span>
                                          </div>
                                          <div style={{ background: t.colors.bgHover, borderRadius: `0 ${t.radius.md} ${t.radius.md} ${t.radius.md}`, padding: `${t.space.sm} ${t.space.md}`, flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: t.space.sm, marginBottom: 2 }}>
                                              <span style={{ fontWeight: 600, fontSize: t.fontSizes.sm, color: t.colors.textPrimary }}>{c.author_name}</span>
                                              <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{c.author_type === 'staff' ? '· Staff' : '· Client'}</span>
                                              <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{timeAgo(c.created_at)}</span>
                                            </div>
                                            <div style={{ fontSize: t.fontSizes.md, color: t.colors.textPrimary, lineHeight: 1.4 }}>{c.body}</div>
                                          </div>
                                        </div>
                                      ))}

                                      {/* Staff reply input */}
                                      <div style={{ display: 'flex', gap: t.space.sm, alignItems: 'center', marginTop: t.space.sm }}>
                                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: t.colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                          <span style={{ color: '#fff', fontSize: t.fontSizes.xs, fontWeight: 700 }}>{staffName[0].toUpperCase()}</span>
                                        </div>
                                        <input
                                          placeholder="Reply as staff..."
                                          value={replyInput[d.id] || ''}
                                          onChange={e => setReplyInput(prev => ({ ...prev, [d.id]: e.target.value }))}
                                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply(d.id) } }}
                                          style={{ ...inputStyle, borderRadius: t.radius.full, padding: '6px 14px' }}
                                        />
                                        <button
                                          onClick={() => submitReply(d.id)}
                                          disabled={sendingReply || !(replyInput[d.id] || '').trim()}
                                          style={{ ...btnStyle, padding: '6px 14px', fontSize: t.fontSizes.sm }}
                                        >
                                          Send
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}

                            {/* Add deliverable form */}
                            {showDelivForm === proj.id ? (
                              <div style={{ marginTop: t.space.md, display: 'flex', flexDirection: 'column', gap: t.space.sm }}>
                                <input placeholder="Deliverable name *" value={delivForm.name} onChange={e => setDelivForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
                                <input placeholder="Description (optional)" value={delivForm.description} onChange={e => setDelivForm(f => ({ ...f, description: e.target.value }))} style={inputStyle} />
                                <input placeholder="File URL (optional)" value={delivForm.file_url} onChange={e => setDelivForm(f => ({ ...f, file_url: e.target.value }))} style={inputStyle} />
                                <div style={{ display: 'flex', gap: t.space.sm }}>
                                  <select value={delivForm.file_type} onChange={e => setDelivForm(f => ({ ...f, file_type: e.target.value }))} style={{ ...inputStyle, flex: 1 }}>
                                    <option value="link">Link</option>
                                    <option value="image">Image</option>
                                    <option value="pdf">PDF</option>
                                    <option value="video">Video</option>
                                    <option value="other">Other</option>
                                  </select>
                                  <select value={delivForm.status} onChange={e => setDelivForm(f => ({ ...f, status: e.target.value }))} style={{ ...inputStyle, flex: 1 }}>
                                    <option value="draft">Draft</option>
                                    <option value="pending_review">Pending Review</option>
                                    <option value="approved">Approved</option>
                                  </select>
                                </div>
                                <div style={{ display: 'flex', gap: t.space.sm }}>
                                  <button onClick={() => addDeliverable(proj.id)} disabled={savingDeliv || !delivForm.name.trim()} style={btnStyle}>
                                    {savingDeliv ? 'Saving...' : 'Add'}
                                  </button>
                                  <button onClick={() => { setShowDelivForm(null); setDelivForm({ name: '', description: '', file_url: '', file_type: 'link', status: 'draft' }) }} style={ghostBtnStyle}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setShowDelivForm(proj.id)} style={{ ...ghostBtnStyle, marginTop: t.space.sm, fontSize: t.fontSizes.sm }}>
                                + Add Deliverable
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Add project to portal */}
                  <div style={{ padding: `${t.space.md} ${t.space.lg} ${t.space.md} 40px`, display: 'flex', gap: t.space.sm, alignItems: 'center' }}>
                    {(projectsByClient[portal.client_id] || []).length === 0 ? (
                      <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>No projects found for this client.</span>
                    ) : availableToAdd.length === 0 ? (
                      <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>All projects added.</span>
                    ) : (
                      <select defaultValue="" onChange={e => { if (e.target.value) addProjectToPortal(portal.id, e.target.value) }} style={{ ...inputStyle, fontSize: t.fontSizes.sm }}>
                        <option value="">+ Add a project...</option>
                        {availableToAdd.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Completed portals — collapsed section */}
      {completedPortals.length > 0 && (
        <div style={{ marginTop: t.space.xl }}>
          <button
            onClick={() => setShowCompleted(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: t.space.sm, background: 'none', border: 'none', cursor: 'pointer', color: t.colors.textTertiary, fontSize: t.fontSizes.sm, fontWeight: 600, fontFamily: 'inherit', padding: `${t.space.sm} 0`, marginBottom: t.space.sm }}
          >
            {chevron(showCompleted)}
            Completed ({completedPortals.length})
          </button>

          {showCompleted && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: t.space.md }}>
              {completedPortals.map(portal => {
                const client = portal.clients
                const linkedProjects = portal.portal_projects || []
                return (
                  <div key={portal.id} style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.borderLight}`, borderRadius: t.radius.lg, opacity: 0.75 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: t.space.md, padding: `${t.space.md} ${t.space.lg}` }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600, fontSize: t.fontSizes.md, color: t.colors.textSecondary }}>{client?.name}</span>
                        {client?.company && <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, marginLeft: t.space.sm }}>{client.company}</span>}
                      </div>
                      <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{linkedProjects.length} project{linkedProjects.length !== 1 ? 's' : ''}</span>
                      <select
                        value="completed"
                        onChange={e => updatePortalStatus(portal.id, e.target.value)}
                        style={{ ...inputStyle, width: 'auto', fontSize: t.fontSizes.sm, padding: '3px 8px', color: PORTAL_STATUS.completed.color, fontWeight: 600 }}
                      >
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="completed">Completed</option>
                      </select>
                      <button onClick={() => deletePortal(portal.id)} style={{ ...ghostBtnStyle, color: t.colors.danger, fontSize: t.fontSizes.sm }}>Remove</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const btnStyle = {
  background: 'var(--color-primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius-md, 8px)',
  padding: '7px 16px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}

const ghostBtnStyle = {
  background: 'transparent',
  color: 'var(--color-text-secondary)',
  border: `1px solid var(--color-border)`,
  borderRadius: 'var(--radius-md, 8px)',
  padding: '6px 12px',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}

const inputStyle = {
  width: '100%',
  border: `1px solid var(--color-border)`,
  borderRadius: 'var(--radius-md, 8px)',
  padding: '7px 10px',
  fontSize: '13px',
  fontFamily: 'inherit',
  background: 'var(--color-bg)',
  color: 'var(--color-text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
}
