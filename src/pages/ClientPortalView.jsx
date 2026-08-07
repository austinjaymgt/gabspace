import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { statusConfig, computeDisplayStatus } from '../utils/invoiceStatus'
import { formatDate } from '../utils/dates'

const REACTIONS = ['👍', '❤️', '🔥', '🎉']

// Brand palette
const PLUM    = '#7F5793'
const PLUM_LT = '#ede6f2'
const CYAN    = '#6EFFFF'
const BLUE    = '#09ACEF'
const ORCHID  = '#FB4BEB'
const GRAPHITE = '#414042'

const STATUS_LABEL = {
  draft: { label: 'Draft', color: '#888' },
  pending_review: { label: 'Pending Review', color: '#c07a00' },
  approved: { label: 'Approved', color: '#0e8a4a' },
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
  const [pendingComment, setPendingComment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('portal')
    if (t) setToken(t)
    else setNotFound(true)
    const invoiceParam = params.get('invoice')
    if (invoiceParam) {
      setInitialInvoiceId(invoiceParam)
      setViewMode('invoices')
    }
  }, [])

  useEffect(() => { if (token) loadPortal() }, [token])

  async function loadPortal() {
    setLoading(true)
    const { data: ctx } = await supabase.rpc('get_portal_context', { p_token: token })

    if (!ctx) { setNotFound(true); setLoading(false); return }
    setPortalLink({ clients: ctx.client })
    const projs = ctx.projects || []
    setProjects(projs)

    const { data: invs } = await supabase.rpc('get_portal_invoices', { p_token: token })
    setInvoices(invs || [])

    if (viewMode !== 'invoices' && projs.length > 0) await loadProject(projs[0].id)
    setLoading(false)
  }

  async function loadProject(projectId) {
    setActiveProject(projectId)
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
    for (const c of cmts || []) {
      cmtMap[c.deliverable_id] = cmtMap[c.deliverable_id] || []
      cmtMap[c.deliverable_id].push(c)
    }
    setComments(cmtMap)
  }

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
    <div style={centerStyle}>
      <div style={{ color: PLUM, fontFamily: '"Source Sans 3", sans-serif', fontSize: 15, letterSpacing: '0.02em' }}>Loading your portal...</div>
    </div>
  )

  if (notFound) return (
    <div style={centerStyle}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <div style={{ fontFamily: '"Big Shoulders Display", sans-serif', fontSize: 20, color: GRAPHITE, marginBottom: 8 }}>Portal not found</div>
        <div style={{ color: '#888', fontSize: 14, fontFamily: '"Source Sans 3", sans-serif' }}>This link may be invalid or expired.</div>
      </div>
    </div>
  )

  const client = portalLink?.clients
  const activeProj = projects.find(p => p.id === activeProject)

  return (
    <div style={{ minHeight: '100vh', background: '#f0f0f0', fontFamily: '"Source Sans 3", sans-serif' }}>

      {/* Top banner */}
      <div style={{ background: '#fff', padding: '0 20px', display: 'flex', alignItems: 'center', height: 52, borderBottom: '1px solid #e2e2e2', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ color: GRAPHITE, fontWeight: 700, fontSize: 20, fontFamily: '"Big Shoulders Display", sans-serif', letterSpacing: '0.02em' }}>
          {client?.company || client?.name}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ color: PLUM, fontSize: 11, fontFamily: '"Source Sans 3", sans-serif', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>Client Portal</div>
      </div>

      {/* Two-column body */}
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px 16px', display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* Left sidebar */}
        <div style={{ width: 220, flexShrink: 0, position: 'sticky', top: 20 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e2e2', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div style={{ background: `linear-gradient(135deg, ${ORCHID} 0%, ${CYAN} 50%, ${BLUE} 100%)`, height: 64 }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 16px 20px', marginTop: -28 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: PLUM, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', flexShrink: 0 }}>
                <span style={{ color: '#fff', fontSize: 22, fontWeight: 700, fontFamily: '"Big Shoulders Display", sans-serif' }}>{(client?.name || '?')[0].toUpperCase()}</span>
              </div>
              <div style={{ marginTop: 10, textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: GRAPHITE, fontFamily: '"Big Shoulders Display", sans-serif', letterSpacing: '0.01em' }}>{client?.name}</div>
                {client?.company && <div style={{ fontSize: 12, color: PLUM, marginTop: 3, fontFamily: '"Source Sans 3", sans-serif' }}>{client.company}</div>}
              </div>
            </div>

            {projects.length > 0 && (
              <div style={{ borderTop: '1px solid #ebebeb' }}>
                <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 700, color: '#aaa', fontFamily: '"Source Sans 3", sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Projects</div>
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setViewMode('projects'); loadProject(p.id) }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      background: viewMode === 'projects' && activeProject === p.id ? PLUM_LT : 'none',
                      border: 'none',
                      borderLeft: viewMode === 'projects' && activeProject === p.id ? `3px solid ${BLUE}` : '3px solid transparent',
                      color: viewMode === 'projects' && activeProject === p.id ? GRAPHITE : '#666',
                      fontWeight: viewMode === 'projects' && activeProject === p.id ? 600 : 400,
                      fontSize: 13,
                      padding: '8px 14px',
                      cursor: 'pointer',
                      fontFamily: '"Source Sans 3", sans-serif',
                      transition: 'background 0.12s',
                    }}
                  >
                    {p.title}
                  </button>
                ))}
                <div style={{ height: 8 }} />
              </div>
            )}

            {invoices.length > 0 && (
              <div style={{ borderTop: '1px solid #ebebeb' }}>
                <button
                  onClick={() => setViewMode('invoices')}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    background: viewMode === 'invoices' ? PLUM_LT : 'none',
                    border: 'none',
                    borderLeft: viewMode === 'invoices' ? `3px solid ${BLUE}` : '3px solid transparent',
                    color: viewMode === 'invoices' ? GRAPHITE : '#666',
                    fontWeight: viewMode === 'invoices' ? 600 : 400,
                    fontSize: 13,
                    padding: '8px 14px',
                    cursor: 'pointer',
                    fontFamily: '"Source Sans 3", sans-serif',
                    transition: 'background 0.12s',
                  }}
                >
                  Invoices
                </button>
                <div style={{ height: 8 }} />
              </div>
            )}
          </div>
        </div>

        {/* Right feed */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {viewMode === 'projects' && projects.length === 0 && (
            <div style={{ background: '#fff', border: '1px solid #e2e2e2', borderRadius: 8, padding: 32, textAlign: 'center', color: PLUM, fontFamily: '"Source Sans 3", sans-serif', fontSize: 14 }}>
              Nothing's been shared with you yet — check back soon.
            </div>
          )}

          {/* Project header */}
          {viewMode === 'projects' && activeProj && (
            <div style={{ background: '#fff', border: '1px solid #e2e2e2', borderRadius: 8, marginBottom: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ height: 5, background: `linear-gradient(90deg, ${PLUM} 0%, ${BLUE} 100%)` }} />
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 8, background: PLUM_LT, border: '1px solid #d4c5e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 20 }}>📁</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: '"Big Shoulders Display", sans-serif', fontSize: 18, fontWeight: 700, color: GRAPHITE, letterSpacing: '0.01em' }}>{activeProj.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, fontFamily: '"Source Sans 3", sans-serif',
                      padding: '2px 8px', borderRadius: 20,
                      background: activeProj.status === 'active' ? '#e6f4ea' : activeProj.status === 'completed' ? PLUM_LT : '#f0f0f0',
                      color: activeProj.status === 'active' ? '#0e8a4a' : activeProj.status === 'completed' ? PLUM : '#888',
                      textTransform: 'capitalize',
                    }}>
                      {activeProj.status?.replace('_', ' ') || 'In Progress'}
                    </span>
                    <span style={{ fontSize: 12, color: '#bbb', fontFamily: '"Source Sans 3", sans-serif' }}>·</span>
                    <span style={{ fontSize: 12, color: '#999', fontFamily: '"Source Sans 3", sans-serif' }}>
                      {deliverables.length} deliverable{deliverables.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Milestones */}
              {milestones.length > 0 && (
                <div style={{ borderTop: '1px solid #ebebeb', padding: '12px 20px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#aaa', fontFamily: '"Source Sans 3", sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', alignSelf: 'center', marginRight: 4 }}>Upcoming</span>
                  {milestones.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: PLUM_LT, border: '1px solid #d4c5e2', borderRadius: 20, padding: '4px 12px' }}>
                      <span style={{ fontSize: 13 }}>📍</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: GRAPHITE, fontFamily: '"Source Sans 3", sans-serif' }}>{m.title}</span>
                      {m.target_date && (
                        <>
                          <span style={{ fontSize: 11, color: '#bbb' }}>·</span>
                          <span style={{ fontSize: 11, color: PLUM, fontFamily: '"Source Sans 3", sans-serif', fontWeight: 500 }}>
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

          {viewMode === 'projects' && deliverables.length === 0 && activeProject && (
            <div style={{ background: '#fff', border: '1px solid #e2e2e2', borderRadius: 8, padding: 32, textAlign: 'center', color: PLUM, fontFamily: '"Source Sans 3", sans-serif', fontSize: 14 }}>
              No deliverables yet for <strong>{activeProj?.title}</strong> — they'll show up here as soon as they're ready.
            </div>
          )}

          {viewMode === 'projects' && deliverables.map(d => {
            const rxn = reactions[d.id] || {}
            const mySet = myReactions[d.id] || new Set()
            const cmts = comments[d.id] || []
            const status = STATUS_LABEL[d.status] || STATUS_LABEL.draft

            return (
              <div key={d.id} style={{ background: '#fff', border: '1px solid #e2e2e2', borderRadius: 8, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

                {/* Card header */}
                <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: PLUM_LT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #d4c5e2' }}>
                    <span style={{ fontSize: 16 }}>📄</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: GRAPHITE, fontFamily: '"Source Sans 3", sans-serif' }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: '#aaa', fontFamily: '"Source Sans 3", sans-serif', marginTop: 1 }}>
                      {timeAgo(d.created_at)} · <span style={{ color: status.color, fontWeight: 600 }}>{status.label}</span>
                    </div>
                  </div>
                  {(d.status === 'pending_review' || d.status === 'approved') && (
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                      fontSize: 12, fontWeight: 600, color: d.status === 'approved' ? '#0e8a4a' : GRAPHITE,
                      fontFamily: '"Source Sans 3", sans-serif',
                      cursor: d.status === 'pending_review' ? 'pointer' : 'default',
                    }}>
                      <input
                        type="checkbox"
                        checked={d.status === 'approved'}
                        disabled={d.status === 'approved'}
                        onChange={() => approveDeliverable(d.id)}
                        style={{ width: 15, height: 15, accentColor: '#0e8a4a', cursor: d.status === 'pending_review' ? 'pointer' : 'default' }}
                      />
                      Approved
                    </label>
                  )}
                </div>

                {/* Description */}
                {d.description && (
                  <div style={{ padding: '0 16px 10px', fontSize: 14, color: GRAPHITE, fontFamily: '"Source Sans 3", sans-serif', lineHeight: 1.5 }}>
                    {d.description}
                  </div>
                )}

                {/* File preview */}
                {d.file_url && (
                  <div style={{ borderTop: '1px solid #e8e0f0', borderBottom: '1px solid #e8e0f0' }}>
                    {d.file_type === 'image' ? (
                      <img src={d.file_url} alt={d.name} style={{ width: '100%', maxHeight: 400, objectFit: 'cover', display: 'block' }} />
                    ) : d.file_type === 'video' ? (
                      <video src={d.file_url} controls style={{ width: '100%', display: 'block' }} />
                    ) : (
                      <a href={d.file_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', color: BLUE, textDecoration: 'none', fontFamily: '"Source Sans 3", sans-serif', fontSize: 14 }}>
                        <span style={{ fontSize: 22 }}>{d.file_type === 'pdf' ? '📕' : '🔗'}</span>
                        <span style={{ fontWeight: 600 }}>View {d.file_type === 'pdf' ? 'PDF' : 'File'}</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Reaction counts */}
                {Object.keys(rxn).length > 0 && (
                  <div style={{ padding: '6px 16px', display: 'flex', gap: 6, borderBottom: '1px solid #e8e0f0' }}>
                    {Object.entries(rxn).filter(([, c]) => c > 0).map(([emoji, count]) => (
                      <span key={emoji} style={{ fontSize: 12, color: PLUM, fontFamily: '"Source Sans 3", sans-serif', background: PLUM_LT, borderRadius: 10, padding: '1px 8px' }}>{emoji} {count}</span>
                    ))}
                  </div>
                )}

                {/* Reaction bar */}
                <div style={{ padding: '4px 8px', display: 'flex', gap: 2, borderBottom: '1px solid #f0f0f0' }}>
                  {REACTIONS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => toggleReaction(d.id, emoji)}
                      style={{
                        background: mySet.has(emoji) ? PLUM_LT : 'none',
                        border: mySet.has(emoji) ? '1px solid #c9aeda' : '1px solid transparent',
                        borderRadius: 9999,
                        padding: '5px 10px',
                        cursor: 'pointer',
                        fontSize: 18,
                        lineHeight: 1,
                        transition: 'background 0.15s, border-color 0.15s',
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Comments */}
                {cmts.length > 0 && (
                  <div style={{ padding: '8px 16px', borderTop: '1px solid #f5f5f5' }}>
                    {(() => {
                      const isExpanded = expandedComments[d.id]
                      const hidden = cmts.length > 2 && !isExpanded ? cmts.length - 2 : 0
                      const visible = hidden > 0 ? cmts.slice(-2) : cmts
                      return (
                        <>
                          {hidden > 0 && (
                            <button
                              onClick={() => setExpandedComments(prev => ({ ...prev, [d.id]: true }))}
                              style={{ background: 'none', border: 'none', padding: '0 0 8px 0', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: PLUM, fontFamily: '"Source Sans 3", sans-serif' }}
                            >
                              View {hidden} previous comment{hidden !== 1 ? 's' : ''}
                            </button>
                          )}
                          {visible.map(c => (
                            <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: c.author_type === 'staff' ? PLUM : BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{(c.author_name || '?')[0].toUpperCase()}</span>
                              </div>
                              <div style={{ background: '#f5f0fb', borderRadius: '0 12px 12px 12px', padding: '6px 10px', flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 12, color: GRAPHITE, fontFamily: '"Source Sans 3", sans-serif' }}>{c.author_name}</div>
                                <div style={{ fontSize: 13, color: '#555', fontFamily: '"Source Sans 3", sans-serif', marginTop: 1, lineHeight: 1.4 }}>{c.body}</div>
                                <div style={{ fontSize: 11, color: '#aaa', marginTop: 3, fontFamily: '"Source Sans 3", sans-serif' }}>{timeAgo(c.created_at)}</div>
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
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{commentName ? commentName[0].toUpperCase() : '?'}</span>
                  </div>
                  <input
                    placeholder="Write a comment..."
                    value={commentInput[d.id] || ''}
                    onChange={e => setCommentInput(prev => ({ ...prev, [d.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') submitComment(d.id) }}
                    style={{ flex: 1, background: '#f5f0fb', border: '1px solid #e0d0f0', borderRadius: 9999, padding: '7px 14px', fontSize: 13, fontFamily: '"Source Sans 3", sans-serif', outline: 'none', color: GRAPHITE }}
                  />
                </div>
              </div>
            )
          })}

          {viewMode === 'invoices' && invoices.length === 0 && (
            <div style={{ background: '#fff', border: '1px solid #e2e2e2', borderRadius: 8, padding: 32, textAlign: 'center', color: PLUM, fontFamily: '"Source Sans 3", sans-serif', fontSize: 14 }}>
              No invoices to show yet.
            </div>
          )}

          {viewMode === 'invoices' && invoices.map(inv => {
            const displayStatus = computeDisplayStatus(inv)
            const sc = statusConfig[displayStatus]
            const outstanding = (parseFloat(inv.total_amount) || 0) - (parseFloat(inv.amount_paid) || 0)
            const highlighted = initialInvoiceId === inv.id
            return (
              <div
                key={inv.id}
                style={{
                  background: '#fff',
                  border: highlighted ? `2px solid ${BLUE}` : '1px solid #e2e2e2',
                  borderRadius: 8,
                  marginBottom: 16,
                  padding: 20,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontFamily: '"Big Shoulders Display", sans-serif', fontSize: 17, fontWeight: 700, color: GRAPHITE }}>
                      {inv.invoice_number || 'Invoice'}
                    </div>
                    {inv.due_date && (
                      <div style={{ fontSize: 12, color: '#999', fontFamily: '"Source Sans 3", sans-serif', marginTop: 2 }}>
                        Due {formatDate(inv.due_date, { year: 'numeric', month: 'numeric', day: 'numeric' })}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: sc.bg, color: sc.color, fontFamily: '"Source Sans 3", sans-serif' }}>
                    {sc.label}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
                  <div style={{ background: '#f7f7f7', borderRadius: 6, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#aaa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Total</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: GRAPHITE, fontFamily: '"Big Shoulders Display", sans-serif' }}>${parseFloat(inv.total_amount || 0).toLocaleString()}</div>
                  </div>
                  <div style={{ background: '#f7f7f7', borderRadius: 6, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#aaa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Paid</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0e8a4a', fontFamily: '"Big Shoulders Display", sans-serif' }}>${parseFloat(inv.amount_paid || 0).toLocaleString()}</div>
                  </div>
                  <div style={{ background: '#f7f7f7', borderRadius: 6, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#aaa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Outstanding</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: outstanding > 0 ? '#c0392b' : '#0e8a4a', fontFamily: '"Big Shoulders Display", sans-serif' }}>${outstanding.toLocaleString()}</div>
                  </div>
                </div>

                <div>
                  {(inv.line_items || []).map((li, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: i === 0 ? 'none' : '1px solid #f0f0f0', fontSize: 13, fontFamily: '"Source Sans 3", sans-serif', color: '#555' }}>
                      <span>{li.description} {parseFloat(li.quantity) !== 1 ? `× ${li.quantity}` : ''}</span>
                      <span>${parseFloat(li.total || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(65,64,66,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 28, width: 340, boxShadow: '0 8px 32px rgba(127,87,147,0.25)', border: '1px solid #e0d0f0' }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6, fontFamily: '"Big Shoulders Display", sans-serif', color: GRAPHITE }}>What's your name?</div>
        <div style={{ fontSize: 13, color: PLUM, marginBottom: 18, fontFamily: '"Source Sans 3", sans-serif' }}>We'll use this for your comments.</div>
        <input
          autoFocus
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onSave(name.trim()) }}
          style={{ width: '100%', border: '1px solid #d0c0e8', borderRadius: 9999, padding: '9px 12px', fontSize: 14, fontFamily: '"Source Sans 3", sans-serif', outline: 'none', boxSizing: 'border-box', marginBottom: 14, color: GRAPHITE, background: '#faf8fd' }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #d0c0e8', borderRadius: 9999, padding: '7px 16px', cursor: 'pointer', fontFamily: '"Source Sans 3", sans-serif', fontSize: 13, color: PLUM }}>Cancel</button>
          <button onClick={() => { if (name.trim()) onSave(name.trim()) }} disabled={!name.trim()} style={{ background: PLUM, color: '#fff', border: 'none', borderRadius: 9999, padding: '7px 16px', cursor: 'pointer', fontFamily: '"Source Sans 3", sans-serif', fontSize: 13, fontWeight: 700, opacity: name.trim() ? 1 : 0.5 }}>Continue</button>
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
  background: '#f0f0f0',
  fontFamily: '"Source Sans 3", sans-serif',
}
