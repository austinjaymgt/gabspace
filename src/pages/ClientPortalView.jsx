import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { statusConfig, computeDisplayStatus } from '../utils/invoiceStatus'
import { formatDate } from '../utils/dates'
import { Icon } from '../components/Icon'
import { theme as t, brand } from '../theme'
import { useIsMobile } from '../hooks/useMediaQuery'
import { subscribeToPortalProjectChanges } from '../utils/portalRealtime'
import SupportFooter from '../components/SupportFooter'

// Reactions keep their emoji as the stored/db value (unchanged data model),
// but render as brand icons with the reaction name on hover instead of
// raw unicode glyphs.
const REACTIONS = [
  { emoji: '👍', icon: 'thumbs-up', label: 'Like' },
  { emoji: '❤️', icon: 'reaction', label: 'Love' },
  { emoji: '🔥', icon: 'fire', label: 'Fire' },
  { emoji: '🎉', icon: 'celebrate', label: 'Celebrate' },
]
const REACTION_META = Object.fromEntries(REACTIONS.map(r => [r.emoji, r]))

const FONT_HEAD = t.fonts.heading
const FONT_SANS = t.fonts.sans

// Semantic tokens — resolved light by the force-light-theme wrapper below,
// so the portal always reads as a bright, inviting look regardless of the
// visitor's own OS/browser theme preference.
const c = t.colors

const STATUS_LABEL = {
  draft: { label: 'Draft', color: c.textTertiary },
  pending_review: { label: 'Pending Review', color: c.warning },
  approved: { label: 'Approved', color: c.success },
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

export default function ClientPortalView() {
  const [token, setToken] = useState(null)
  const [initialInvoiceId, setInitialInvoiceId] = useState(null)
  const [portalLink, setPortalLink] = useState(null)
  const [projects, setProjects] = useState([])
  const [activeProject, setActiveProject] = useState(null)
  const [viewMode, setViewMode] = useState('projects') // 'projects' | 'invoices'
  const [feedTab, setFeedTab] = useState('active') // 'active' | 'approved'
  const [invoices, setInvoices] = useState([])
  const [deliverables, setDeliverables] = useState([])
  const [reactions, setReactions] = useState({})
  const [myReactions, setMyReactions] = useState({})
  const [comments, setComments] = useState({})
  const [milestones, setMilestones] = useState([])
  const [commentInput, setCommentInput] = useState({})
  const [commentName, setCommentName] = useState(() => localStorage.getItem('portal_commenter_name') || '')
  const [namePrompt, setNamePrompt] = useState(false)
  const [expandedComments, setExpandedComments] = useState({})
  const [expandedInvoices, setExpandedInvoices] = useState({})
  const [pendingComment, setPendingComment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const portalToken = params.get('portal')
    if (portalToken) setToken(portalToken)
    else setNotFound(true)
    const invoiceParam = params.get('invoice')
    if (invoiceParam) {
      setInitialInvoiceId(invoiceParam)
      setViewMode('invoices')
    }
  }, [])

  // Split out from loadProject so the realtime handler below can refresh
  // deliverables/reactions/comments without resetting feedTab or scroll
  // position out from under someone actively looking at the Approved tab.
  async function fetchProjectFeed(projectId) {
    const { data: delivs } = await supabase.rpc('get_portal_deliverables', { p_token: token, p_project_id: projectId })
    setDeliverables(delivs || [])

    const { data: ms } = await supabase.rpc('get_portal_milestones', { p_token: token, p_project_id: projectId })
    setMilestones(ms || [])

    if (!delivs || delivs.length === 0) return

    const ids = delivs.map(d => d.id)

    const { data: rxns } = await supabase.rpc('get_portal_reactions', { p_token: token, p_deliverable_ids: ids })

    const rxnMap = {}
    const myMap = {}
    for (const r of rxns || []) {
      rxnMap[r.deliverable_id] = rxnMap[r.deliverable_id] || {}
      rxnMap[r.deliverable_id][r.emoji] = r.reaction_count
      if (r.reacted_by_me) {
        myMap[r.deliverable_id] = myMap[r.deliverable_id] || new Set()
        myMap[r.deliverable_id].add(r.emoji)
      }
    }
    setReactions(rxnMap)
    setMyReactions(myMap)

    const { data: cmts } = await supabase.rpc('get_portal_comments', { p_token: token, p_deliverable_ids: ids })

    const cmtMap = {}
    for (const cmt of cmts || []) {
      cmtMap[cmt.deliverable_id] = cmtMap[cmt.deliverable_id] || []
      cmtMap[cmt.deliverable_id].push(cmt)
    }
    setComments(cmtMap)
  }

  async function loadProject(projectId) {
    setActiveProject(projectId)
    setFeedTab('active')
    await fetchProjectFeed(projectId)
  }

  async function loadPortal() {
    setLoading(true)
    const { data: ctx } = await supabase.rpc('get_portal_context', { p_token: token })

    if (!ctx) { setNotFound(true); setLoading(false); return }
    setPortalLink({ clients: ctx.client, business: ctx.business })
    const projs = ctx.projects || []
    setProjects(projs)

    const { data: invs } = await supabase.rpc('get_portal_invoices', { p_token: token })
    setInvoices(invs || [])

    if (viewMode !== 'invoices' && projs.length > 0) await loadProject(projs[0].id)
    setLoading(false)
  }

  useEffect(() => { if (token) loadPortal() }, [token])

  // Staff can approve/un-approve or add/remove deliverables from the admin
  // side while a client already has this tab open — pick that up live
  // instead of making them refresh to see a deliverable move between the
  // Feed and Approved tabs.
  useEffect(() => {
    if (!activeProject) return undefined
    return subscribeToPortalProjectChanges(activeProject, () => fetchProjectFeed(activeProject))
  }, [activeProject])

  async function toggleReaction(delivId, emoji) {
    const mySet = myReactions[delivId] || new Set()
    const has = mySet.has(emoji)

    if (has) {
      await supabase.rpc('remove_portal_reaction', { p_token: token, p_deliverable_id: delivId, p_emoji: emoji })
      setReactions(prev => {
        const next = { ...prev }
        next[delivId] = { ...next[delivId] }
        next[delivId][emoji] = Math.max(0, (next[delivId][emoji] || 1) - 1)
        if (!next[delivId][emoji]) delete next[delivId][emoji]
        return next
      })
      setMyReactions(prev => {
        const s = new Set(prev[delivId])
        s.delete(emoji)
        return { ...prev, [delivId]: s }
      })
    } else {
      await supabase.rpc('add_portal_reaction', { p_token: token, p_deliverable_id: delivId, p_emoji: emoji })
      setReactions(prev => {
        const next = { ...prev }
        next[delivId] = { ...next[delivId], [emoji]: ((next[delivId] || {})[emoji] || 0) + 1 }
        return next
      })
      setMyReactions(prev => {
        const s = new Set(prev[delivId] || [])
        s.add(emoji)
        return { ...prev, [delivId]: s }
      })
    }
  }

  async function submitComment(delivId) {
    const body = (commentInput[delivId] || '').trim()
    if (!body) return
    if (!commentName.trim()) { setPendingComment(delivId); setNamePrompt(true); return }

    const { data: newComment } = await supabase.rpc('add_portal_comment', {
      p_token: token,
      p_deliverable_id: delivId,
      p_author_name: commentName,
      p_body: body,
    })

    setComments(prev => ({ ...prev, [delivId]: [...(prev[delivId] || []), newComment] }))
    setCommentInput(prev => ({ ...prev, [delivId]: '' }))
  }

  async function approveDeliverable(delivId) {
    const { error } = await supabase.rpc('approve_portal_deliverable', { p_token: token, p_deliverable_id: delivId })
    if (error) return
    setDeliverables(prev => prev.map(d => d.id === delivId ? { ...d, status: 'approved', approved_by_client: true } : d))
  }

  function saveName(name) {
    setCommentName(name)
    localStorage.setItem('portal_commenter_name', name)
    setNamePrompt(false)
    if (pendingComment) submitComment(pendingComment)
    setPendingComment(null)
  }

  if (loading) return (
    <div className="force-light-theme" style={centerStyle}>
      <div style={{ color: c.primary, fontFamily: FONT_SANS, fontSize: 15, letterSpacing: '0.02em' }}>Loading your portal...</div>
    </div>
  )

  if (notFound) return (
    <div className="force-light-theme" style={centerStyle}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', color: c.textTertiary }}><Icon name="lock" size="xl" /></div>
        <div style={{ fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 700, color: c.textPrimary, marginBottom: 8 }}>Portal not found</div>
        <div style={{ color: c.textSecondary, fontSize: 14, fontFamily: FONT_SANS }}>This link may be invalid or expired.</div>
      </div>
    </div>
  )

  const client = portalLink?.clients
  const business = portalLink?.business
  const activeProj = projects.find(p => p.id === activeProject)
  const activeDeliverables = deliverables.filter(d => d.status !== 'approved')
  const approvedDeliverables = deliverables.filter(d => d.status === 'approved')
  const visibleDeliverables = feedTab === 'approved' ? approvedDeliverables : activeDeliverables

  return (
    <div className="force-light-theme" style={{ minHeight: '100vh', background: c.bg, fontFamily: FONT_SANS }}>

      {/* Top banner */}
      <div style={{ background: c.bgCard, padding: '0 20px', display: 'flex', alignItems: 'center', height: 56, borderBottom: `1px solid ${c.border}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <span style={{ color: c.textSecondary, fontSize: 11, fontFamily: FONT_SANS, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {business?.name || 'Client Portal'}
          </span>
          {business?.name && (
            <>
              <span style={{ color: c.textTertiary, fontSize: 11 }}>|</span>
              <span style={{ color: c.primary, fontSize: 11, fontFamily: FONT_SANS, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap' }}>Client Portal</span>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: isMobile ? '16px 12px' : '24px 16px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 20, alignItems: 'flex-start' }}>

        {/* Left panel: client info + navigation */}
        <div style={{ width: isMobile ? '100%' : 220, flexShrink: 0, position: isMobile ? 'static' : 'sticky', top: 20 }}>
          <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: t.shadows.sm }}>
            <div style={{ background: brand.bgPlum, padding: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', fontFamily: FONT_HEAD, letterSpacing: '0.01em' }}>
                {client?.company || client?.name}
              </div>
              {client?.company && client?.name && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontFamily: FONT_SANS }}>{client.name}</div>
              )}
            </div>

            {!isMobile && projects.length > 0 && (
              <div style={{ borderTop: `1px solid ${c.borderLight}` }}>
                <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 700, color: c.textTertiary, fontFamily: FONT_SANS, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Projects</div>
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setViewMode('projects'); loadProject(p.id) }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      background: viewMode === 'projects' && activeProject === p.id ? c.primaryLight : 'none',
                      border: 'none',
                      borderLeft: viewMode === 'projects' && activeProject === p.id ? `3px solid ${c.primary}` : '3px solid transparent',
                      color: viewMode === 'projects' && activeProject === p.id ? c.textPrimary : c.textSecondary,
                      fontWeight: viewMode === 'projects' && activeProject === p.id ? 600 : 400,
                      fontSize: 13,
                      padding: '8px 14px',
                      cursor: 'pointer',
                      fontFamily: FONT_SANS,
                      transition: 'background 0.12s',
                    }}
                  >
                    {p.title}
                  </button>
                ))}
                <div style={{ height: 8 }} />
              </div>
            )}

            {!isMobile && invoices.length > 0 && (
              <div style={{ borderTop: `1px solid ${c.borderLight}` }}>
                <button
                  onClick={() => setViewMode('invoices')}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    background: viewMode === 'invoices' ? c.primaryLight : 'none',
                    border: 'none',
                    borderLeft: viewMode === 'invoices' ? `3px solid ${c.primary}` : '3px solid transparent',
                    color: viewMode === 'invoices' ? c.textPrimary : c.textSecondary,
                    fontWeight: viewMode === 'invoices' ? 600 : 400,
                    fontSize: 13,
                    padding: '8px 14px',
                    cursor: 'pointer',
                    fontFamily: FONT_SANS,
                    transition: 'background 0.12s',
                  }}
                >
                  Invoices
                </button>
                <div style={{ height: 8 }} />
              </div>
            )}
          </div>

          {/* Mobile nav: horizontal scrollable chips instead of sidebar list */}
          {isMobile && (projects.length > 0 || invoices.length > 0) && (
            <div className="subheader-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '12px 2px 4px', WebkitOverflowScrolling: 'touch' }}>
              {projects.map(p => {
                const active = viewMode === 'projects' && activeProject === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => { setViewMode('projects'); loadProject(p.id) }}
                    style={{
                      flexShrink: 0,
                      background: active ? c.primaryLight : c.bgCard,
                      border: `1px solid ${active ? c.primary : c.border}`,
                      color: active ? c.textPrimary : c.textSecondary,
                      fontWeight: active ? 600 : 500,
                      fontSize: 13,
                      borderRadius: t.radius.full,
                      padding: '7px 16px',
                      cursor: 'pointer',
                      fontFamily: FONT_SANS,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.title}
                  </button>
                )
              })}
              {invoices.length > 0 && (
                <button
                  onClick={() => setViewMode('invoices')}
                  style={{
                    flexShrink: 0,
                    background: viewMode === 'invoices' ? c.primaryLight : c.bgCard,
                    border: `1px solid ${viewMode === 'invoices' ? c.primary : c.border}`,
                    color: viewMode === 'invoices' ? c.textPrimary : c.textSecondary,
                    fontWeight: viewMode === 'invoices' ? 600 : 500,
                    fontSize: 13,
                    borderRadius: t.radius.full,
                    padding: '7px 16px',
                    cursor: 'pointer',
                    fontFamily: FONT_SANS,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Invoices
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right feed */}
        <div style={{ flex: 1, minWidth: 0, width: isMobile ? '100%' : 'auto' }}>

          {viewMode === 'projects' && projects.length === 0 && (
            <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 8, padding: 32, textAlign: 'center', color: c.primary, fontFamily: FONT_SANS, fontSize: 14 }}>
              Nothing's been shared with you yet — check back soon.
            </div>
          )}

          {/* Project header */}
          {viewMode === 'projects' && activeProj && (
            <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 8, marginBottom: 16, overflow: 'hidden', boxShadow: t.shadows.sm }}>
              <div style={{ height: 5, background: `linear-gradient(90deg, ${c.primary} 0%, ${brand.orbTeal} 100%)` }} />
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 8, background: c.primaryLight, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: c.primary }}>
                  <Icon name={activeProj.icon || 'sparkles'} size="lg" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FONT_HEAD, fontSize: 18, fontWeight: 700, color: c.textPrimary, letterSpacing: '0.01em' }}>{activeProj.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, fontFamily: FONT_SANS,
                      padding: '2px 8px', borderRadius: 20,
                      background: activeProj.status === 'active' ? c.successLight : activeProj.status === 'completed' ? c.primaryLight : c.bgHover,
                      color: activeProj.status === 'active' ? c.success : activeProj.status === 'completed' ? c.primary : c.textTertiary,
                      textTransform: 'capitalize',
                    }}>
                      {activeProj.status?.replace('_', ' ') || 'In Progress'}
                    </span>
                    <span style={{ fontSize: 12, color: c.textTertiary, fontFamily: FONT_SANS }}>·</span>
                    <span style={{ fontSize: 12, color: c.textSecondary, fontFamily: FONT_SANS }}>
                      {deliverables.length} deliverable{deliverables.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Milestones */}
              {milestones.length > 0 && (
                <div style={{ borderTop: `1px solid ${c.borderLight}`, padding: '12px 20px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: c.textTertiary, fontFamily: FONT_SANS, letterSpacing: '0.08em', textTransform: 'uppercase', alignSelf: 'center', marginRight: 4 }}>Milestones</span>
                  {milestones.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: c.primaryLight, border: `1px solid ${c.border}`, borderRadius: 20, padding: '4px 12px' }}>
                      <span style={{ color: c.primary, display: 'flex' }}><Icon name="milestone" size="sm" /></span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: c.textPrimary, fontFamily: FONT_SANS }}>{m.title}</span>
                      {m.target_date && (
                        <>
                          <span style={{ fontSize: 11, color: c.textTertiary }}>·</span>
                          <span style={{ fontSize: 11, color: c.primary, fontFamily: FONT_SANS, fontWeight: 500 }}>
                            {new Date(m.target_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Feed / Approved tab switcher — approved items move out of the
              main feed so it doesn't fill up with things no longer needing
              action, but stay reachable in their own tab. */}
          {viewMode === 'projects' && activeProj && approvedDeliverables.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[
                { key: 'active', label: `Feed (${activeDeliverables.length})` },
                { key: 'approved', label: `Approved (${approvedDeliverables.length})` },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFeedTab(tab.key)}
                  style={{
                    background: feedTab === tab.key ? c.primaryLight : 'transparent',
                    border: `1px solid ${feedTab === tab.key ? c.primary : c.border}`,
                    color: feedTab === tab.key ? c.textPrimary : c.textSecondary,
                    fontWeight: feedTab === tab.key ? 600 : 500,
                    fontSize: 13,
                    borderRadius: t.radius.full,
                    padding: '6px 14px',
                    cursor: 'pointer',
                    fontFamily: FONT_SANS,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {viewMode === 'projects' && activeProject && deliverables.length === 0 && (
            <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 8, padding: 32, textAlign: 'center', color: c.primary, fontFamily: FONT_SANS, fontSize: 14 }}>
              No deliverables yet for <strong>{activeProj?.title}</strong> — they'll show up here as soon as they're ready.
            </div>
          )}

          {viewMode === 'projects' && activeProject && deliverables.length > 0 && visibleDeliverables.length === 0 && (
            <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 8, padding: 32, textAlign: 'center', color: c.textSecondary, fontFamily: FONT_SANS, fontSize: 14 }}>
              {feedTab === 'approved' ? "Nothing approved yet." : "You're all caught up — nothing pending here."}
            </div>
          )}

          {/* Approved tab — a quick-grab list (icon, name, approved date,
              open link), not a re-run of the feed's comments/reactions. */}
          {viewMode === 'projects' && feedTab === 'approved' && approvedDeliverables.length > 0 && (
            <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 8, overflow: 'hidden' }}>
              {approvedDeliverables.map((d, idx) => {
                const fileIcon = !d.file_url ? 'success' : d.file_type === 'image' ? 'image' : 'file'
                return (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderTop: idx === 0 ? 'none' : `1px solid ${c.borderLight}` }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: c.successLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: c.success }}>
                      <Icon name={fileIcon} size="md" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: c.textPrimary, fontFamily: FONT_SANS, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                      <div style={{ fontSize: 12, color: c.textTertiary, fontFamily: FONT_SANS, marginTop: 1 }}>
                        Approved {timeAgo(d.approved_at || d.created_at)}
                      </div>
                    </div>
                    {d.file_url ? (
                      <a
                        href={d.file_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, background: c.primaryLight, color: c.primary, textDecoration: 'none', fontFamily: FONT_SANS, fontWeight: 600, fontSize: 13, padding: '7px 14px', borderRadius: 9999 }}
                      >
                        Open <Icon name="external" size="sm" />
                      </a>
                    ) : (
                      <span style={{ fontSize: 12, color: c.textTertiary, fontFamily: FONT_SANS, flexShrink: 0 }}>No file</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {viewMode === 'projects' && feedTab === 'active' && activeDeliverables.map(d => {
            const rxn = reactions[d.id] || {}
            const mySet = myReactions[d.id] || new Set()
            const cmts = comments[d.id] || []
            const status = STATUS_LABEL[d.status] || STATUS_LABEL.draft

            return (
              <div key={d.id} style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 8, marginBottom: 16, boxShadow: t.shadows.sm }}>

                {/* Card header */}
                <div style={{ padding: '14px 16px 8px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: c.textPrimary, fontFamily: FONT_SANS }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: c.textTertiary, fontFamily: FONT_SANS, marginTop: 1 }}>
                      {timeAgo(d.created_at)} · <span style={{ color: status.color, fontWeight: 600 }}>{status.label}</span>
                    </div>
                  </div>
                  {(d.status === 'pending_review' || d.status === 'approved') && (
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                      fontSize: 12, fontWeight: 600, color: d.status === 'approved' ? c.success : c.textPrimary,
                      fontFamily: FONT_SANS,
                      cursor: d.status === 'pending_review' ? 'pointer' : 'default',
                    }}>
                      <input
                        type="checkbox"
                        checked={d.status === 'approved'}
                        disabled={d.status === 'approved'}
                        onChange={() => approveDeliverable(d.id)}
                        style={{ width: 15, height: 15, accentColor: brand.orbTeal, cursor: d.status === 'pending_review' ? 'pointer' : 'default' }}
                      />
                      Approved
                    </label>
                  )}
                </div>

                {/* Description */}
                {d.description && (
                  <div style={{ padding: '0 16px 10px', fontSize: 14, color: c.textPrimary, fontFamily: FONT_SANS, lineHeight: 1.5 }}>
                    {d.description}
                  </div>
                )}

                {/* File preview */}
                {d.file_url && (
                  <div style={{ borderTop: `1px solid ${c.borderLight}`, borderBottom: `1px solid ${c.borderLight}` }}>
                    {d.file_type === 'image' ? (
                      <img src={d.file_url} alt={d.name} style={{ width: '100%', maxHeight: 400, objectFit: 'cover', display: 'block' }} />
                    ) : d.file_type === 'video' ? (
                      <video src={d.file_url} controls style={{ width: '100%', display: 'block' }} />
                    ) : (
                      <a href={d.file_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', color: c.primary, textDecoration: 'none', fontFamily: FONT_SANS, fontSize: 14 }}>
                        <Icon name={d.file_type === 'pdf' ? 'file' : 'link'} size="lg" />
                        <span style={{ fontWeight: 600 }}>View {d.file_type === 'pdf' ? 'PDF' : 'File'}</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Reaction counts */}
                {Object.keys(rxn).length > 0 && (
                  <div style={{ padding: '6px 16px', display: 'flex', gap: 6, borderBottom: `1px solid ${c.borderLight}` }}>
                    {Object.entries(rxn).filter(([, count]) => count > 0).map(([emoji, count]) => {
                      const meta = REACTION_META[emoji]
                      return (
                        <span key={emoji} title={meta?.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: c.primary, fontFamily: FONT_SANS, background: c.primaryLight, borderRadius: 10, padding: '2px 8px' }}>
                          {meta ? <Icon name={meta.icon} size="sm" /> : null} {count}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Reaction bar */}
                <div style={{ padding: '4px 8px', display: 'flex', gap: 2, borderBottom: `1px solid ${c.borderLight}` }}>
                  {REACTIONS.map(({ emoji, icon, label }) => (
                    <button
                      key={emoji}
                      title={label}
                      aria-label={label}
                      onClick={() => toggleReaction(d.id, emoji)}
                      style={{
                        background: mySet.has(emoji) ? c.primaryLight : 'none',
                        border: mySet.has(emoji) ? `1px solid ${c.primary}` : '1px solid transparent',
                        borderRadius: 9999,
                        padding: '7px 11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        color: mySet.has(emoji) ? c.primary : c.textSecondary,
                        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                      }}
                    >
                      <Icon name={icon} size="md" />
                    </button>
                  ))}
                </div>

                {/* Comments */}
                {cmts.length > 0 && (
                  <div style={{ padding: '8px 16px', borderTop: `1px solid ${c.borderLight}` }}>
                    {(() => {
                      const isExpanded = expandedComments[d.id]
                      const hidden = cmts.length > 2 && !isExpanded ? cmts.length - 2 : 0
                      const visible = hidden > 0 ? cmts.slice(-2) : cmts
                      return (
                        <>
                          {hidden > 0 && (
                            <button
                              onClick={() => setExpandedComments(prev => ({ ...prev, [d.id]: true }))}
                              style={{ background: 'none', border: 'none', padding: '0 0 8px 0', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: c.primary, fontFamily: FONT_SANS }}
                            >
                              View {hidden} previous comment{hidden !== 1 ? 's' : ''}
                            </button>
                          )}
                          {visible.map(comment => (
                            <div key={comment.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: comment.author_type === 'staff' ? c.primary : brand.orbBlue, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{(comment.author_name || '?')[0].toUpperCase()}</span>
                              </div>
                              <div style={{ background: c.bgHover, borderRadius: '0 12px 12px 12px', padding: '6px 10px', flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 12, color: c.textPrimary, fontFamily: FONT_SANS }}>{comment.author_name}</div>
                                <div style={{ fontSize: 13, color: c.textSecondary, fontFamily: FONT_SANS, marginTop: 1, lineHeight: 1.4 }}>{comment.body}</div>
                                <div style={{ fontSize: 11, color: c.textTertiary, marginTop: 3, fontFamily: FONT_SANS }}>{timeAgo(comment.created_at)}</div>
                              </div>
                            </div>
                          ))}
                        </>
                      )
                    })()}
                  </div>
                )}

                {/* Comment input */}
                <div style={{ padding: '8px 16px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: brand.orbBlue, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{commentName ? commentName[0].toUpperCase() : '?'}</span>
                  </div>
                  <input
                    placeholder="Write a comment..."
                    value={commentInput[d.id] || ''}
                    onChange={e => setCommentInput(prev => ({ ...prev, [d.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') submitComment(d.id) }}
                    style={{ flex: 1, background: c.bgHover, border: `1px solid ${c.border}`, borderRadius: 9999, padding: '7px 14px', fontSize: 13, fontFamily: FONT_SANS, outline: 'none', color: c.textPrimary }}
                  />
                </div>
              </div>
            )
          })}

          {viewMode === 'invoices' && invoices.length === 0 && (
            <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 8, padding: 32, textAlign: 'center', color: c.primary, fontFamily: FONT_SANS, fontSize: 14 }}>
              No invoices to show yet.
            </div>
          )}

          {viewMode === 'invoices' && invoices.length > 0 && (() => {
            const totalOutstanding = invoices.reduce((sum, inv) => sum + ((parseFloat(inv.total_amount) || 0) - (parseFloat(inv.amount_paid) || 0)), 0)
            return (
              <>
                {/* Summary strip — a ledger total, not a feed item, so it
                    reads distinctly from the project updates tab. */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 18px', marginBottom: 16, background: c.textPrimary, borderRadius: 8 }}>
                  <div style={{ fontFamily: FONT_HEAD, fontSize: 15, fontWeight: 700, color: c.textInverse }}>
                    {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
                  </div>
                  <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
                    Outstanding <span style={{ fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 700, color: totalOutstanding > 0 ? '#f0a8b8' : '#fff', marginLeft: 6 }}>${totalOutstanding.toLocaleString()}</span>
                  </div>
                </div>

                {/* Ledger — one bordered panel with row dividers instead of
                    a stack of shadowed cards, so it doesn't read like the
                    social feed. */}
                <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 8, overflow: 'hidden' }}>
                  {invoices.map((inv, idx) => {
                    const displayStatus = computeDisplayStatus(inv)
                    const sc = statusConfig[displayStatus]
                    const outstanding = (parseFloat(inv.total_amount) || 0) - (parseFloat(inv.amount_paid) || 0)
                    const highlighted = initialInvoiceId === inv.id
                    const expanded = !!expandedInvoices[inv.id]
                    const lineItems = inv.line_items || []
                    return (
                      <div
                        key={inv.id}
                        style={{
                          display: 'flex',
                          borderTop: idx === 0 ? 'none' : `1px solid ${c.borderLight}`,
                          background: highlighted ? c.primaryLight : 'transparent',
                        }}
                      >
                        <div style={{ width: 4, flexShrink: 0, background: sc.color }} />
                        <div style={{ flex: 1, minWidth: 0, padding: '14px 18px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontFamily: FONT_HEAD, fontSize: 15, fontWeight: 700, color: c.textPrimary }}>
                                  {inv.invoice_number || 'Invoice'}
                                </span>
                                {inv.project_title && (
                                  <span style={{ fontSize: 11, fontWeight: 600, color: c.primary, background: c.primaryLight, borderRadius: 20, padding: '2px 8px', fontFamily: FONT_SANS }}>
                                    {inv.project_title}
                                  </span>
                                )}
                                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color, fontFamily: FONT_SANS }}>
                                  {sc.label}
                                </span>
                              </div>
                              {inv.due_date && (
                                <div style={{ fontSize: 12, color: c.textTertiary, fontFamily: FONT_SANS, marginTop: 4 }}>
                                  Due {formatDate(inv.due_date, { year: 'numeric', month: 'numeric', day: 'numeric' })}
                                </div>
                              )}
                            </div>

                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 700, color: outstanding > 0 ? c.danger : c.success }}>
                                ${outstanding > 0 ? outstanding.toLocaleString() : parseFloat(inv.total_amount || 0).toLocaleString()}
                              </div>
                              <div style={{ fontSize: 11, color: c.textTertiary, fontFamily: FONT_SANS, marginTop: 1 }}>
                                {outstanding > 0 ? 'outstanding' : 'paid in full'}
                              </div>
                            </div>
                          </div>

                          {lineItems.length > 0 && (
                            <button
                              onClick={() => setExpandedInvoices(prev => ({ ...prev, [inv.id]: !prev[inv.id] }))}
                              style={{ background: 'none', border: 'none', padding: '8px 0 0', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: c.primary, fontFamily: FONT_SANS }}
                            >
                              {expanded ? 'Hide details' : `View details (${lineItems.length} item${lineItems.length !== 1 ? 's' : ''})`}
                            </button>
                          )}

                          {expanded && (
                            <div style={{ marginTop: 8, borderTop: `1px solid ${c.borderLight}`, paddingTop: 8 }}>
                              {lineItems.map((li, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, fontFamily: FONT_SANS, color: c.textSecondary }}>
                                  <span>{li.description} {parseFloat(li.quantity) !== 1 ? `× ${li.quantity}` : ''}</span>
                                  <span>${parseFloat(li.total || 0).toLocaleString()}</span>
                                </div>
                              ))}
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', marginTop: 4, borderTop: `1px solid ${c.borderLight}`, fontSize: 12, fontFamily: FONT_SANS, color: c.textTertiary }}>
                                <span>Total</span>
                                <span>${parseFloat(inv.total_amount || 0).toLocaleString()}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 12, fontFamily: FONT_SANS, color: c.textTertiary }}>
                                <span>Paid</span>
                                <span>${parseFloat(inv.amount_paid || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )
          })()}
        </div>
      </div>

      <div style={{ padding: '0 16px 24px' }}>
        <SupportFooter />
      </div>

      {namePrompt && (
        <NamePromptModal onSave={saveName} onClose={() => { setNamePrompt(false); setPendingComment(null) }} />
      )}
    </div>
  )
}

function NamePromptModal({ onSave, onClose }) {
  const [name, setName] = useState('')
  return (
    <div className="force-light-theme" style={{ position: 'fixed', inset: 0, background: 'rgba(22,8,20,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(2px)' }}>
      <div style={{ background: c.bgCard, borderRadius: 10, padding: 28, width: 340, maxWidth: '90vw', boxShadow: t.shadows.lg, border: `1px solid ${c.border}` }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6, fontFamily: FONT_HEAD, color: c.textPrimary }}>What's your name?</div>
        <div style={{ fontSize: 13, color: c.textSecondary, marginBottom: 18, fontFamily: FONT_SANS }}>We'll use this for your comments.</div>
        <input
          autoFocus
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onSave(name.trim()) }}
          style={{ width: '100%', border: `1px solid ${c.border}`, borderRadius: 9999, padding: '9px 12px', fontSize: 14, fontFamily: FONT_SANS, outline: 'none', boxSizing: 'border-box', marginBottom: 14, color: c.textPrimary, background: c.bgHover }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'none', border: `1px solid ${c.border}`, borderRadius: 9999, padding: '7px 16px', cursor: 'pointer', fontFamily: FONT_SANS, fontSize: 13, color: c.textSecondary }}>Cancel</button>
          <button onClick={() => { if (name.trim()) onSave(name.trim()) }} disabled={!name.trim()} style={{ background: c.primary, color: '#fff', border: 'none', borderRadius: 9999, padding: '7px 16px', cursor: 'pointer', fontFamily: FONT_SANS, fontSize: 13, fontWeight: 700, opacity: name.trim() ? 1 : 0.5 }}>Continue</button>
        </div>
      </div>
    </div>
  )
}

const centerStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: c.bg,
  fontFamily: '"Manrope", sans-serif',
}
