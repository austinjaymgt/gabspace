import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

function timeAgo(dateString) {
  if (!dateString) return 'Never'
  const diff = Date.now() - new Date(dateString).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function ClientPortal() {
  const [portals, setPortals] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(null)
  const [showUpdateForm, setShowUpdateForm] = useState(null)
  const [updateForm, setUpdateForm] = useState({ title: '', message: '' })
  const [posting, setPosting] = useState(false)
  const [expandedPortal, setExpandedPortal] = useState(null)
  const [editingUpdate, setEditingUpdate] = useState(null)
  const [editUpdateForm, setEditUpdateForm] = useState({ title: '', message: '' })
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('last_viewed')

  useEffect(() => { fetchPortals() }, [])

  async function fetchPortals() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: tokens } = await supabase
      .from('portal_tokens')
      .select('*, clients(id, name, company, email)')
      .eq('user_id', user.id)

    if (!tokens) { setLoading(false); return }

    const portalsWithData = await Promise.all(
      tokens.map(async token => {
        const { data: updates } = await supabase
          .from('portal_updates')
          .select('*')
          .eq('client_id', token.client_id)
          .order('created_at', { ascending: false })

        const updateIds = (updates || []).map(u => u.id)
        let reactionsMap = {}
        let commentsMap = {}

        if (updateIds.length > 0) {
          const { data: reactions } = await supabase
            .from('portal_reactions').select('*').in('update_id', updateIds)
          const { data: comments } = await supabase
            .from('portal_comments').select('*').in('update_id', updateIds)
            .order('created_at', { ascending: true })

          updateIds.forEach(id => { reactionsMap[id] = {}; commentsMap[id] = [] })
          reactions?.forEach(r => {
            if (!reactionsMap[r.update_id][r.emoji]) reactionsMap[r.update_id][r.emoji] = 0
            reactionsMap[r.update_id][r.emoji]++
          })
          comments?.forEach(c => { commentsMap[c.update_id].push(c) })
        }

        return { ...token, updates: updates || [], reactionsMap, commentsMap }
      })
    )

    setPortals(portalsWithData)
    setLoading(false)
  }

  async function postUpdate(clientId) {
    setPosting(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('portal_updates').insert({
      client_id: clientId,
      user_id: user.id,
      title: updateForm.title || null,
      message: updateForm.message,
      is_visible: true,
    })
    setUpdateForm({ title: '', message: '' })
    setShowUpdateForm(null)
    setPosting(false)
    fetchPortals()
  }

  async function handleEditUpdate(updateId) {
    await supabase.from('portal_updates').update({
      title: editUpdateForm.title || null,
      message: editUpdateForm.message,
    }).eq('id', updateId)
    setEditingUpdate(null)
    fetchPortals()
  }

  async function deleteUpdate(updateId) {
    if (!confirm('Delete this update?')) return
    await supabase.from('portal_updates').delete().eq('id', updateId)
    fetchPortals()
  }

  function copyLink(token, id) {
    navigator.clipboard.writeText(`${window.location.origin}/portal/${token}`)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const totalComments = portals.reduce((sum, p) =>
    sum + Object.values(p.commentsMap).reduce((s, c) => s + c.length, 0), 0)

  // Search + sort
  const displayedPortals = portals
    .filter(p => {
      const q = search.toLowerCase()
      return (
        p.clients.name?.toLowerCase().includes(q) ||
        p.clients.company?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      if (sortBy === 'last_viewed') {
        return new Date(b.last_viewed_at || 0) - new Date(a.last_viewed_at || 0)
      }
      if (sortBy === 'most_updates') return b.updates.length - a.updates.length
      if (sortBy === 'most_comments') {
        const ac = Object.values(a.commentsMap).reduce((s, c) => s + c.length, 0)
        const bc = Object.values(b.commentsMap).reduce((s, c) => s + c.length, 0)
        return bc - ac
      }
      if (sortBy === 'name') return a.clients.name.localeCompare(b.clients.name)
      return 0
    })

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Client Portals</h2>
          <p style={styles.subtitle}>
            {displayedPortals.length} of {portals.length} portal{portals.length !== 1 ? 's' : ''} · {totalComments} comment{totalComments !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Search + sort */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#bbb', fontSize: '14px', pointerEvents: 'none' }}>🔍</span>
          <input
            style={{ ...styles.input, paddingLeft: '34px', width: '100%', boxSizing: 'border-box' }}
            placeholder="Search by client or company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#999', whiteSpace: 'nowrap' }}>Sort by</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={styles.input}
          >
            <option value="last_viewed">Last viewed</option>
            <option value="most_updates">Most updates</option>
            <option value="most_comments">Most comments</option>
            <option value="name">Client name</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={styles.empty}>Loading portals...</div>
      ) : portals.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🔗</div>
          <h3 style={styles.emptyTitle}>No portals yet</h3>
          <p style={styles.emptyText}>Go to a client's detail page and generate their portal link to get started</p>
        </div>
      ) : displayedPortals.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🔍</div>
          <h3 style={styles.emptyTitle}>No results</h3>
          <p style={styles.emptyText}>Try a different search term</p>
        </div>
      ) : (
        <div style={styles.portalList}>
          {displayedPortals.map(portal => {
            const isExpanded = expandedPortal === portal.id
            const totalPortalComments = Object.values(portal.commentsMap).reduce((s, c) => s + c.length, 0)
            const latestUpdate = portal.updates[0]

            return (
              <div key={portal.id} style={styles.portalCard}>

                {/* Top row — client info + actions */}
                <div style={styles.portalCardTop}>
                  <div style={styles.portalClientInfo}>
                    <div style={styles.avatar}>
                      {portal.clients.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={styles.clientName}>{portal.clients.name}</div>
                      {portal.clients.company && (
                        <div style={styles.clientCompany}>{portal.clients.company}</div>
                      )}
                    </div>
                  </div>
                  <div style={styles.portalActions}>
                    <button onClick={() => copyLink(portal.token, portal.id)} style={styles.copyBtn}>
                      {copied === portal.id ? '✓ Copied!' : 'Copy link'}
                    </button>
                    <button
                      onClick={() => {
                        setShowUpdateForm(showUpdateForm === portal.id ? null : portal.id)
                        setUpdateForm({ title: '', message: '' })
                      }}
                      style={styles.postBtn}
                    >
                      + Post update
                    </button>
                  </div>
                </div>

                {/* Compact meta strip */}
                <div style={styles.metaStrip}>
                  <div style={styles.metaChip}>
                    <span style={styles.metaLabel}>Last viewed</span>
                    <span style={styles.metaValue}>
                      {portal.last_viewed_at ? timeAgo(portal.last_viewed_at) : 'Not viewed'}
                    </span>
                  </div>
                  <div style={styles.metaDivider} />
                  <div style={styles.metaChip}>
                    <span style={styles.metaLabel}>Updates</span>
                    <span style={styles.metaValue}>{portal.updates.length}</span>
                  </div>
                  <div style={styles.metaDivider} />
                  <div style={styles.metaChip}>
                    <span style={styles.metaLabel}>Comments</span>
                    <span style={{ ...styles.metaValue, color: totalPortalComments > 0 ? '#1D9E75' : '#1a1a1a' }}>
                      {totalPortalComments}
                    </span>
                  </div>

                  {/* Latest update preview */}
                  {latestUpdate && (
                    <>
                      <div style={styles.metaDivider} />
                      <div style={styles.metaChip}>
                        <span style={styles.metaLabel}>Latest update</span>
                        <span style={{ ...styles.metaValue, color: '#666', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {latestUpdate.title || latestUpdate.message}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Post update form */}
                {showUpdateForm === portal.id && (
                  <div style={styles.updateForm}>
                    <input
                      style={styles.updateInput}
                      placeholder="Update title (optional)"
                      value={updateForm.title}
                      onChange={e => setUpdateForm({ ...updateForm, title: e.target.value })}
                    />
                    <textarea
                      style={styles.updateTextarea}
                      placeholder="Write your update for this client..."
                      rows={3}
                      value={updateForm.message}
                      onChange={e => setUpdateForm({ ...updateForm, message: e.target.value })}
                    />
                    <div style={styles.updateFormActions}>
                      <button onClick={() => setShowUpdateForm(null)} style={styles.cancelBtn}>Cancel</button>
                      <button
                        onClick={() => postUpdate(portal.clients.id)}
                        style={styles.saveBtn}
                        disabled={posting || !updateForm.message}
                      >
                        {posting ? 'Posting...' : 'Post update'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Updates feed */}
                {portal.updates.length > 0 && (
                  <div style={styles.updatesSection}>
                    <button
                      onClick={() => setExpandedPortal(isExpanded ? null : portal.id)}
                      style={styles.toggleUpdatesBtn}
                    >
                      {isExpanded ? '▾' : '▸'} {portal.updates.length} update{portal.updates.length !== 1 ? 's' : ''}
                      {totalPortalComments > 0 && (
                        <span style={styles.commentBadge}>
                          {totalPortalComments} comment{totalPortalComments !== 1 ? 's' : ''}
                        </span>
                      )}
                    </button>

                    {isExpanded && (
                      <div style={styles.updatesList}>
                        {portal.updates.map(update => {
                          const updateComments = portal.commentsMap[update.id] || []
                          const updateReactions = portal.reactionsMap[update.id] || {}
                          return (
                            <div key={update.id} style={styles.updateItem}>
                              {editingUpdate === update.id ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <input
                                    style={styles.updateInput}
                                    value={editUpdateForm.title}
                                    onChange={e => setEditUpdateForm({ ...editUpdateForm, title: e.target.value })}
                                    placeholder="Title (optional)"
                                  />
                                  <textarea
                                    style={styles.updateTextarea}
                                    rows={3}
                                    value={editUpdateForm.message}
                                    onChange={e => setEditUpdateForm({ ...editUpdateForm, message: e.target.value })}
                                  />
                                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                    <button onClick={() => setEditingUpdate(null)} style={styles.cancelBtn}>Cancel</button>
                                    <button onClick={() => handleEditUpdate(update.id)} style={styles.saveBtn} disabled={!editUpdateForm.message}>Save</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div style={styles.updateItemHeader}>
                                    <div>
                                      {update.title && <div style={styles.updateItemTitle}>{update.title}</div>}
                                      <div style={styles.updateItemDate}>{timeAgo(update.created_at)}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                      <button
                                        onClick={() => { setEditingUpdate(update.id); setEditUpdateForm({ title: update.title || '', message: update.message }) }}
                                        style={styles.iconBtn}
                                      >✏️</button>
                                      <button onClick={() => deleteUpdate(update.id)} style={styles.iconBtn}>✕</button>
                                    </div>
                                  </div>
                                  <p style={styles.updateItemMessage}>{update.message}</p>
                                  {Object.keys(updateReactions).length > 0 && (
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                      {Object.entries(updateReactions).map(([emoji, count]) => (
                                        <div key={emoji} style={styles.reactionPill}>{emoji} {count}</div>
                                      ))}
                                    </div>
                                  )}
                                  {updateComments.length > 0 && (
                                    <div style={styles.commentsSection}>
                                      <div style={styles.commentsLabel}>💬 {updateComments.length} comment{updateComments.length !== 1 ? 's' : ''}</div>
                                      {updateComments.map(comment => (
                                        <div key={comment.id} style={styles.commentItem}>
                                          <div style={styles.commentAvatar}>{comment.author_name.charAt(0).toUpperCase()}</div>
                                          <div style={styles.commentContent}>
                                            <div style={styles.commentAuthor}>{comment.author_name}</div>
                                            <div style={styles.commentMessage}>{comment.message}</div>
                                            <div style={styles.commentDate}>{timeAgo(comment.created_at)}</div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const styles = {
  page: { padding: '32px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  title: { fontSize: '20px', fontWeight: '700', color: '#1a1a1a', margin: 0 },
  subtitle: { fontSize: '13px', color: '#999', margin: '4px 0 0' },
  input: { padding: '8px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '13px', color: '#1a1a1a', outline: 'none', backgroundColor: '#fff' },
  portalList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  portalCard: { backgroundColor: '#fff', borderRadius: '12px', padding: '18px 22px', border: '1px solid #f0f0eb' },
  portalCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  portalClientInfo: { display: 'flex', alignItems: 'center', gap: '10px' },
  avatar: { width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#1D9E75', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '600', flexShrink: 0 },
  clientName: { fontSize: '14px', fontWeight: '600', color: '#1a1a1a' },
  clientCompany: { fontSize: '12px', color: '#999', marginTop: '1px' },
  portalActions: { display: 'flex', gap: '8px' },
  copyBtn: { padding: '6px 12px', borderRadius: '8px', border: '1px solid #1D9E75', backgroundColor: '#fff', color: '#1D9E75', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  postBtn: { padding: '6px 12px', borderRadius: '8px', border: 'none', backgroundColor: '#1D9E75', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  metaStrip: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', backgroundColor: '#fafaf8', borderRadius: '8px', marginBottom: '0px', flexWrap: 'wrap' },
  metaChip: { display: 'flex', gap: '6px', alignItems: 'center' },
  metaLabel: { fontSize: '11px', color: '#aaa', fontWeight: '600', textTransform: 'uppercase' },
  metaValue: { fontSize: '12px', color: '#1a1a1a', fontWeight: '500' },
  metaDivider: { width: '1px', height: '14px', backgroundColor: '#e8e8e4', flexShrink: 0 },
  updateForm: { display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#fafaf8', borderRadius: '10px', padding: '14px', marginTop: '12px', marginBottom: '4px' },
  updateInput: { padding: '8px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '13px', outline: 'none', backgroundColor: '#fff' },
  updateTextarea: { padding: '8px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'sans-serif', backgroundColor: '#fff' },
  updateFormActions: { display: 'flex', gap: '8px', justifyContent: 'flex-end' },
  cancelBtn: { padding: '7px 14px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff', color: '#666', fontSize: '13px', cursor: 'pointer' },
  saveBtn: { padding: '7px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#1D9E75', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  updatesSection: { borderTop: '1px solid #f0f0eb', paddingTop: '12px', marginTop: '12px' },
  toggleUpdatesBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#666', fontWeight: '600', padding: 0, display: 'flex', alignItems: 'center', gap: '8px' },
  commentBadge: { fontSize: '11px', backgroundColor: '#f0faf6', color: '#1D9E75', padding: '2px 8px', borderRadius: '20px', fontWeight: '600' },
  updatesList: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' },
  updateItem: { backgroundColor: '#fafaf8', borderRadius: '8px', padding: '12px 14px' },
  updateItemHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' },
  updateItemTitle: { fontSize: '13px', fontWeight: '600', color: '#1a1a1a', marginBottom: '2px' },
  updateItemDate: { fontSize: '11px', color: '#bbb' },
  updateItemMessage: { fontSize: '13px', color: '#555', margin: '0 0 8px', lineHeight: '1.5' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#bbb', padding: '2px' },
  reactionPill: { padding: '2px 8px', borderRadius: '20px', backgroundColor: '#f0faf6', border: '1px solid #1D9E75', fontSize: '12px', color: '#1D9E75', fontWeight: '500' },
  commentsSection: { borderTop: '1px solid #f0f0eb', paddingTop: '8px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' },
  commentsLabel: { fontSize: '11px', color: '#aaa', fontWeight: '600', textTransform: 'uppercase', marginBottom: '2px' },
  commentItem: { display: 'flex', gap: '8px', alignItems: 'flex-start' },
  commentAvatar: { width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#f0f0eb', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '600', flexShrink: 0 },
  commentContent: { flex: 1, backgroundColor: '#fff', borderRadius: '8px', padding: '6px 10px', border: '1px solid #f0f0eb' },
  commentAuthor: { fontSize: '11px', fontWeight: '600', color: '#1a1a1a', marginBottom: '2px' },
  commentMessage: { fontSize: '12px', color: '#555', lineHeight: '1.4' },
  commentDate: { fontSize: '10px', color: '#bbb', marginTop: '3px' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #f0f0eb' },
  emptyIcon: { fontSize: '40px', marginBottom: '16px' },
  emptyTitle: { fontSize: '16px', fontWeight: '600', color: '#1a1a1a', margin: '0 0 8px' },
  emptyText: { fontSize: '13px', color: '#999', margin: 0, textAlign: 'center' },
  empty: { fontSize: '13px', color: '#999', padding: '40px', textAlign: 'center' },
}