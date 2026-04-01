import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

function getSessionId() {
  let id = localStorage.getItem('portal_session_id')
  if (!id) {
    id = Math.random().toString(36).substring(2) + Date.now().toString(36)
    localStorage.setItem('portal_session_id', id)
  }
  return id
}

export default function Portal() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [client, setClient] = useState(null)
  const [updates, setUpdates] = useState([])
  const [visibleCount, setVisibleCount] = useState(3)
  const [projects, setProjects] = useState([])
  const [reactions, setReactions] = useState({})
  const [comments, setComments] = useState({})
  const [showCommentForm, setShowCommentForm] = useState(null)
  const [commentForm, setCommentForm] = useState({ author_name: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [clientId, setClientId] = useState(null)

  const sessionId = getSessionId()
  const emojis = ['👍', '❤️', '🙌', '😮']

  useEffect(() => {
    async function loadPortal() {
      const { data: tokenData, error: tokenError } = await supabase
        .from('portal_tokens')
        .select('*, clients(*)')
        .eq('token', token)
        .single()

      if (tokenError || !tokenData) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setClient(tokenData.clients)
      setClientId(tokenData.clients.id)

      await supabase
        .from('portal_tokens')
        .update({ last_viewed_at: new Date().toISOString() })
        .eq('token', token)

      const { data: updatesData } = await supabase
        .from('portal_updates')
        .select('*')
        .eq('client_id', tokenData.clients.id)
        .eq('is_visible', true)
        .order('created_at', { ascending: false })

      setUpdates(updatesData || [])

      const { data: projectsData } = await supabase
        .from('projects')
        .select('*, events(*)')
        .eq('client_id', tokenData.clients.id)

      setProjects(projectsData || [])

      if (updatesData?.length > 0) {
        const updateIds = updatesData.map(u => u.id)
        await loadReactionsAndComments(updateIds)
      }

      setLoading(false)
    }

    loadPortal()
  }, [token])

  async function loadReactionsAndComments(updateIds) {
    const { data: reactionsData } = await supabase
      .from('portal_reactions')
      .select('*')
      .in('update_id', updateIds)

    const { data: commentsData } = await supabase
      .from('portal_comments')
      .select('*')
      .in('update_id', updateIds)
      .order('created_at', { ascending: true })

    const reactionsMap = {}
    const commentsMap = {}

    updateIds.forEach(id => {
      reactionsMap[id] = {}
      commentsMap[id] = []
    })

    reactionsData?.forEach(r => {
      if (!reactionsMap[r.update_id]) reactionsMap[r.update_id] = {}
      if (!reactionsMap[r.update_id][r.emoji]) reactionsMap[r.update_id][r.emoji] = { count: 0, reacted: false }
      reactionsMap[r.update_id][r.emoji].count++
      if (r.session_id === sessionId) reactionsMap[r.update_id][r.emoji].reacted = true
    })

    commentsData?.forEach(c => {
      if (!commentsMap[c.update_id]) commentsMap[c.update_id] = []
      commentsMap[c.update_id].push(c)
    })

    setReactions(reactionsMap)
    setComments(commentsMap)
  }

  async function handleReaction(updateId, emoji) {
    const existing = reactions[updateId]?.[emoji]?.reacted

    if (existing) {
      await supabase
        .from('portal_reactions')
        .delete()
        .eq('update_id', updateId)
        .eq('session_id', sessionId)
        .eq('emoji', emoji)
    } else {
      await supabase.from('portal_reactions').insert({
        update_id: updateId,
        client_id: clientId,
        emoji,
        session_id: sessionId,
      })
    }

    const updateIds = updates.map(u => u.id)
    await loadReactionsAndComments(updateIds)
  }

  async function handleComment(updateId) {
    if (!commentForm.author_name || !commentForm.message) return
    setSubmitting(true)
    await supabase.from('portal_comments').insert({
      update_id: updateId,
      client_id: clientId,
      author_name: commentForm.author_name,
      message: commentForm.message,
    })
    setCommentForm({ author_name: '', message: '' })
    setShowCommentForm(null)
    const updateIds = updates.map(u => u.id)
    await loadReactionsAndComments(updateIds)
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div style={styles.centered}>
        <div style={styles.loadingText}>Loading your portal...</div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div style={styles.centered}>
        <div style={styles.notFound}>
          <div style={styles.notFoundIcon}>🔒</div>
          <h2 style={styles.notFoundTitle}>Portal not found</h2>
          <p style={styles.notFoundText}>This link may have expired or been regenerated.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.brand}>gabspace</div>
          <div style={styles.clientName}>{client.name}'s Portal</div>
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.welcomeCard}>
          <div style={styles.welcomeAvatar}>
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 style={styles.welcomeTitle}>Hi, {client.name.split(' ')[0]}! 👋</h1>
            <p style={styles.welcomeSubtitle}>
              Here's everything you need to know about your project.
            </p>
          </div>
        </div>

        {projects.length > 0 && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Your Projects</h2>
            {projects.map(project => (
              <div key={project.id} style={styles.projectCard}>
                <div style={styles.projectTop}>
                  <div style={styles.projectTitle}>{project.title}</div>
                  <div style={{
                    ...styles.statusBadge,
                    backgroundColor: project.status === 'active' ? '#f0faf6' : '#f5f5f0',
                    color: project.status === 'active' ? '#1D9E75' : '#999',
                  }}>
                    {project.status}
                  </div>
                </div>
                {project.events && project.events.length > 0 && (
                  <div style={styles.eventList}>
                    {project.events.map(event => (
                      <div key={event.id} style={styles.eventItem}>
                        <span style={styles.eventIcon}>📅</span>
                        <div>
                          <div style={styles.eventName}>{event.name}</div>
                          {event.event_date && (
                            <div style={styles.eventDate}>
                              {new Date(event.event_date).toLocaleDateString('en-US', {
                                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                              })}
                            </div>
                          )}
                          {event.venue && (
                            <div style={styles.eventVenue}>📍 {event.venue}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Updates</h2>
          {updates.length === 0 ? (
            <div style={styles.noUpdates}>
              <p>No updates yet — check back soon!</p>
            </div>
          ) : (
            <div style={styles.updateFeed}>
              {updates.slice(0, visibleCount).map(update => (
                <div key={update.id} style={styles.updateCard}>
                  <div style={styles.updateMeta}>
                    <div style={styles.updateAvatar}>G</div>
                    <div>
                      <div style={styles.updateAuthor}>Gabspace Team</div>
                      <div style={styles.updateDate}>
                        {new Date(update.created_at).toLocaleDateString('en-US', {
                          month: 'long', day: 'numeric', year: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>

                  {update.title && (
                    <h3 style={styles.updateTitle}>{update.title}</h3>
                  )}
                  <p style={styles.updateMessage}>{update.message}</p>

                  {/* Reactions */}
                  <div style={styles.reactionsRow}>
                    {emojis.map(emoji => {
                      const data = reactions[update.id]?.[emoji]
                      const count = data?.count || 0
                      const reacted = data?.reacted || false
                      return (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(update.id, emoji)}
                          style={{
                            ...styles.reactionBtn,
                            backgroundColor: reacted ? '#f0faf6' : '#f5f5f0',
                            border: reacted ? '1px solid #1D9E75' : '1px solid #e0e0e0',
                            color: reacted ? '#1D9E75' : '#666',
                          }}
                        >
                          {emoji} {count > 0 && <span style={styles.reactionCount}>{count}</span>}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setShowCommentForm(showCommentForm === update.id ? null : update.id)}
                      style={styles.commentToggleBtn}
                    >
                      💬 {comments[update.id]?.length > 0 ? comments[update.id].length : ''} Comment
                    </button>
                  </div>

                  {/* Comments */}
                  {comments[update.id]?.length > 0 && (
                    <div style={styles.commentsSection}>
                      {comments[update.id].map(comment => (
                        <div key={comment.id} style={styles.commentItem}>
                          <div style={styles.commentAvatar}>
                            {comment.author_name.charAt(0).toUpperCase()}
                          </div>
                          <div style={styles.commentContent}>
                            <div style={styles.commentAuthor}>{comment.author_name}</div>
                            <div style={styles.commentMessage}>{comment.message}</div>
                            <div style={styles.commentDate}>
                              {new Date(comment.created_at).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric'
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Comment form */}
                  {showCommentForm === update.id && (
                    <div style={styles.commentForm}>
                      <input
                        style={styles.commentInput}
                        placeholder="Your name"
                        value={commentForm.author_name}
                        onChange={e => setCommentForm({ ...commentForm, author_name: e.target.value })}
                      />
                      <textarea
                        style={styles.commentTextarea}
                        placeholder="Write a comment..."
                        rows={2}
                        value={commentForm.message}
                        onChange={e => setCommentForm({ ...commentForm, message: e.target.value })}
                      />
                      <div style={styles.commentFormActions}>
                        <button
                          onClick={() => setShowCommentForm(null)}
                          style={styles.commentCancelBtn}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleComment(update.id)}
                          style={styles.commentSubmitBtn}
                          disabled={submitting || !commentForm.author_name || !commentForm.message}
                        >
                          {submitting ? 'Posting...' : 'Post comment'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {updates.length > visibleCount && (
                <button
                  onClick={() => setVisibleCount(prev => prev + 3)}
                  style={styles.loadMoreBtn}
                >
                  Load more ({updates.length - visibleCount} remaining)
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={styles.footer}>
        <p style={styles.footerText}>Powered by gabspace · Clarity meets creativity</p>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', backgroundColor: '#f5f5f0', fontFamily: 'sans-serif' },
  centered: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f0', fontFamily: 'sans-serif' },
  loadingText: { fontSize: '14px', color: '#999' },
  notFound: { textAlign: 'center', padding: '40px' },
  notFoundIcon: { fontSize: '48px', marginBottom: '16px' },
  notFoundTitle: { fontSize: '22px', fontWeight: '700', color: '#1a1a1a', margin: '0 0 8px' },
  notFoundText: { fontSize: '14px', color: '#999', margin: 0 },
  header: { backgroundColor: '#ffffff', borderBottom: '1px solid #f0f0eb', padding: '16px 24px' },
  headerInner: { maxWidth: '680px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontSize: '18px', fontWeight: '700', color: '#1a1a1a' },
  clientName: { fontSize: '13px', color: '#999' },
  content: { maxWidth: '680px', margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '24px' },
  welcomeCard: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '28px', border: '1px solid #f0f0eb', display: 'flex', alignItems: 'center', gap: '20px' },
  welcomeAvatar: { width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#1D9E75', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '700', flexShrink: 0 },
  welcomeTitle: { fontSize: '22px', fontWeight: '700', color: '#1a1a1a', margin: '0 0 4px' },
  welcomeSubtitle: { fontSize: '14px', color: '#999', margin: 0 },
  section: { display: 'flex', flexDirection: 'column', gap: '12px' },
  sectionTitle: { fontSize: '16px', fontWeight: '600', color: '#1a1a1a', margin: 0 },
  projectCard: { backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #f0f0eb' },
  projectTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  projectTitle: { fontSize: '15px', fontWeight: '600', color: '#1a1a1a' },
  statusBadge: { padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' },
  eventList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  eventItem: { display: 'flex', gap: '12px', alignItems: 'flex-start', backgroundColor: '#fafaf8', borderRadius: '8px', padding: '12px' },
  eventIcon: { fontSize: '18px' },
  eventName: { fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '2px' },
  eventDate: { fontSize: '13px', color: '#666', marginBottom: '2px' },
  eventVenue: { fontSize: '12px', color: '#999' },
  updateFeed: { display: 'flex', flexDirection: 'column', gap: '12px' },
  updateCard: { backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #f0f0eb' },
  updateMeta: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
  updateAvatar: { width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#1D9E75', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', flexShrink: 0 },
  updateAuthor: { fontSize: '13px', fontWeight: '600', color: '#1a1a1a' },
  updateDate: { fontSize: '11px', color: '#bbb' },
  updateTitle: { fontSize: '15px', fontWeight: '600', color: '#1a1a1a', margin: '0 0 8px' },
  updateMessage: { fontSize: '14px', color: '#555', margin: '0 0 16px', lineHeight: '1.6' },
  reactionsRow: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' },
  reactionBtn: {
    padding: '5px 10px',
    borderRadius: '20px',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontFamily: 'sans-serif',
  },
  reactionCount: { fontSize: '12px', fontWeight: '600' },
  commentToggleBtn: {
    padding: '5px 10px',
    borderRadius: '20px',
    border: '1px solid #e0e0e0',
    backgroundColor: '#fff',
    color: '#666',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'sans-serif',
  },
  commentsSection: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' },
  commentItem: { display: 'flex', gap: '10px', alignItems: 'flex-start' },
  commentAvatar: { width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#f0f0eb', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', flexShrink: 0 },
  commentContent: { flex: 1, backgroundColor: '#fafaf8', borderRadius: '10px', padding: '8px 12px' },
  commentAuthor: { fontSize: '12px', fontWeight: '600', color: '#1a1a1a', marginBottom: '2px' },
  commentMessage: { fontSize: '13px', color: '#555', lineHeight: '1.5' },
  commentDate: { fontSize: '11px', color: '#bbb', marginTop: '4px' },
  commentForm: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: '#fafaf8', borderRadius: '10px' },
  commentInput: { padding: '8px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '13px', outline: 'none', fontFamily: 'sans-serif' },
  commentTextarea: { padding: '8px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'sans-serif' },
  commentFormActions: { display: 'flex', gap: '8px', justifyContent: 'flex-end' },
  commentCancelBtn: { padding: '7px 14px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff', color: '#666', fontSize: '12px', cursor: 'pointer' },
  commentSubmitBtn: { padding: '7px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#1D9E75', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  noUpdates: { backgroundColor: '#ffffff', borderRadius: '12px', padding: '32px', border: '1px solid #f0f0eb', textAlign: 'center', fontSize: '14px', color: '#bbb' },
  loadMoreBtn: { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #f0f0eb', backgroundColor: '#fff', color: '#888', fontSize: '13px', cursor: 'pointer', fontFamily: 'sans-serif' },
  footer: { textAlign: 'center', padding: '32px 24px' },
  footerText: { fontSize: '12px', color: '#ccc', margin: 0 },
}