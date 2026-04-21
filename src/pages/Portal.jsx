import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

function getSessionId() {
  let id = localStorage.getItem('portal_session_id')
  if (!id) {
    id = Math.random().toString(36).substring(2) + Date.now().toString(36)
    localStorage.setItem('portal_session_id', id)
  }
  return id
}

// Small four-square brand mark — reused in header and update avatars
function BrandMark({ size = 32 }) {
  const inner = size * 0.28
  const offset = size * 0.11
  const gap = size * 0.5
  const rx = size * 0.07
  return (
    <div style={{
      width: `${size}px`,
      height: `${size}px`,
      background: 'linear-gradient(135deg, #7C5CBF, #6B8F71)',
      borderRadius: `${size * 0.25}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg viewBox="0 0 28 28" width={size * 0.55} height={size * 0.55} fill="none">
        <rect x="3" y="3" width="9" height="9" rx="2.5" fill="white" fillOpacity="0.9"/>
        <rect x="16" y="3" width="9" height="9" rx="2.5" fill="white" fillOpacity="0.55"/>
        <rect x="3" y="16" width="9" height="9" rx="2.5" fill="white" fillOpacity="0.55"/>
        <rect x="16" y="16" width="9" height="9" rx="2.5" fill="white" fillOpacity="0.9"/>
      </svg>
    </div>
  )
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
          <div style={styles.brandLockup}>
            <BrandMark size={32} />
            <span style={styles.brandWordmark}>gabspace</span>
          </div>
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
                    backgroundColor: project.status === 'active' ? t.colors.successLight : t.colors.bg,
                    color: project.status === 'active' ? t.colors.success : t.colors.textTertiary,
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
                    <BrandMark size={32} />
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
                            backgroundColor: reacted ? t.colors.primaryLight : t.colors.bg,
                            border: `1px solid ${reacted ? t.colors.primary : t.colors.border}`,
                            color: reacted ? t.colors.primary : t.colors.textSecondary,
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
        <p style={styles.footerText}>Powered by gabspace · creativity meets clarity</p>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: t.colors.bg,
    fontFamily: t.fonts.sans,
  },
  centered: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.bg,
    fontFamily: t.fonts.sans,
  },
  loadingText: {
    fontSize: t.fontSizes.md,
    color: t.colors.textTertiary,
  },
  notFound: {
    textAlign: 'center',
    padding: '40px',
  },
  notFoundIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  notFoundTitle: {
    fontSize: '22px',
    fontWeight: '800',
    color: t.colors.textPrimary,
    margin: '0 0 8px',
    fontFamily: t.fonts.heading,
    letterSpacing: '-0.02em',
  },
  notFoundText: {
    fontSize: t.fontSizes.md,
    color: t.colors.textTertiary,
    margin: 0,
  },
  header: {
    backgroundColor: t.colors.bgCard,
    borderBottom: `1px solid ${t.colors.border}`,
    padding: '16px 24px',
  },
  headerInner: {
    maxWidth: '680px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  brandLockup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  brandWordmark: {
    fontFamily: t.fonts.heading,
    fontSize: '22px',
    fontWeight: '800',
    color: t.colors.textPrimary,
    letterSpacing: '-0.02em',
    lineHeight: 1,
  },
  clientName: {
    fontSize: t.fontSizes.base,
    color: t.colors.textTertiary,
    fontFamily: t.fonts.sans,
  },
  content: {
    maxWidth: '680px',
    margin: '0 auto',
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  welcomeCard: {
    backgroundColor: t.colors.bgCard,
    borderRadius: t.radius.xl,
    padding: '28px',
    border: `1px solid ${t.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  welcomeAvatar: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${t.colors.primary}, #6B8F71)`,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    fontWeight: '700',
    fontFamily: t.fonts.heading,
    flexShrink: 0,
  },
  welcomeTitle: {
    fontSize: '24px',
    fontWeight: '800',
    color: t.colors.textPrimary,
    margin: '0 0 4px',
    fontFamily: t.fonts.heading,
    letterSpacing: '-0.02em',
  },
  welcomeSubtitle: {
    fontSize: t.fontSizes.md,
    color: t.colors.textSecondary,
    margin: 0,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionTitle: {
    fontSize: t.fontSizes.lg,
    fontWeight: '700',
    color: t.colors.textPrimary,
    margin: 0,
    fontFamily: t.fonts.heading,
    letterSpacing: '-0.01em',
  },
  projectCard: {
    backgroundColor: t.colors.bgCard,
    borderRadius: t.radius.lg,
    padding: '20px',
    border: `1px solid ${t.colors.border}`,
  },
  projectTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  projectTitle: {
    fontSize: t.fontSizes.md,
    fontWeight: '600',
    color: t.colors.textPrimary,
  },
  statusBadge: {
    padding: '3px 10px',
    borderRadius: t.radius.full,
    fontSize: t.fontSizes.sm,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  eventList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  eventItem: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    backgroundColor: t.colors.bg,
    borderRadius: t.radius.md,
    padding: '12px',
  },
  eventIcon: {
    fontSize: '18px',
  },
  eventName: {
    fontSize: t.fontSizes.md,
    fontWeight: '600',
    color: t.colors.textPrimary,
    marginBottom: '2px',
  },
  eventDate: {
    fontSize: t.fontSizes.base,
    color: t.colors.textSecondary,
    marginBottom: '2px',
  },
  eventVenue: {
    fontSize: t.fontSizes.sm,
    color: t.colors.textTertiary,
  },
  updateFeed: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  updateCard: {
    backgroundColor: t.colors.bgCard,
    borderRadius: t.radius.lg,
    padding: '20px',
    border: `1px solid ${t.colors.border}`,
  },
  updateMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '14px',
  },
  updateAuthor: {
    fontSize: t.fontSizes.base,
    fontWeight: '600',
    color: t.colors.textPrimary,
  },
  updateDate: {
    fontSize: t.fontSizes.xs,
    color: t.colors.textTertiary,
  },
  updateTitle: {
    fontSize: t.fontSizes.md,
    fontWeight: '600',
    color: t.colors.textPrimary,
    margin: '0 0 8px',
  },
  updateMessage: {
    fontSize: t.fontSizes.md,
    color: t.colors.textSecondary,
    margin: '0 0 16px',
    lineHeight: '1.6',
  },
  reactionsRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    marginBottom: '12px',
  },
  reactionBtn: {
    padding: '5px 10px',
    borderRadius: t.radius.full,
    fontSize: t.fontSizes.base,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontFamily: t.fonts.sans,
    transition: 'all 0.15s',
  },
  reactionCount: {
    fontSize: t.fontSizes.sm,
    fontWeight: '600',
  },
  commentToggleBtn: {
    padding: '5px 10px',
    borderRadius: t.radius.full,
    border: `1px solid ${t.colors.border}`,
    backgroundColor: t.colors.bgCard,
    color: t.colors.textSecondary,
    fontSize: t.fontSizes.base,
    cursor: 'pointer',
    fontFamily: t.fonts.sans,
  },
  commentsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '12px',
  },
  commentItem: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: t.colors.border,
    color: t.colors.textSecondary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: t.fontSizes.xs,
    fontWeight: '600',
    flexShrink: 0,
  },
  commentContent: {
    flex: 1,
    backgroundColor: t.colors.bg,
    borderRadius: t.radius.md,
    padding: '8px 12px',
  },
  commentAuthor: {
    fontSize: t.fontSizes.sm,
    fontWeight: '600',
    color: t.colors.textPrimary,
    marginBottom: '2px',
  },
  commentMessage: {
    fontSize: t.fontSizes.base,
    color: t.colors.textSecondary,
    lineHeight: '1.5',
  },
  commentDate: {
    fontSize: t.fontSizes.xs,
    color: t.colors.textTertiary,
    marginTop: '4px',
  },
  commentForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
    backgroundColor: t.colors.bg,
    borderRadius: t.radius.md,
  },
  commentInput: {
    padding: '8px 12px',
    borderRadius: t.radius.md,
    border: `1px solid ${t.colors.border}`,
    fontSize: t.fontSizes.base,
    outline: 'none',
    fontFamily: t.fonts.sans,
    color: t.colors.textPrimary,
  },
  commentTextarea: {
    padding: '8px 12px',
    borderRadius: t.radius.md,
    border: `1px solid ${t.colors.border}`,
    fontSize: t.fontSizes.base,
    outline: 'none',
    resize: 'vertical',
    fontFamily: t.fonts.sans,
    color: t.colors.textPrimary,
  },
  commentFormActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  },
  commentCancelBtn: {
    padding: '7px 14px',
    borderRadius: t.radius.md,
    border: `1px solid ${t.colors.border}`,
    backgroundColor: t.colors.bgCard,
    color: t.colors.textSecondary,
    fontSize: t.fontSizes.sm,
    cursor: 'pointer',
    fontFamily: t.fonts.sans,
  },
  commentSubmitBtn: {
    padding: '7px 14px',
    borderRadius: t.radius.md,
    border: 'none',
    backgroundColor: t.colors.primary,
    color: '#fff',
    fontSize: t.fontSizes.sm,
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: t.fonts.sans,
  },
  noUpdates: {
    backgroundColor: t.colors.bgCard,
    borderRadius: t.radius.lg,
    padding: '32px',
    border: `1px solid ${t.colors.border}`,
    textAlign: 'center',
    fontSize: t.fontSizes.md,
    color: t.colors.textTertiary,
  },
  loadMoreBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: t.radius.md,
    border: `1px solid ${t.colors.border}`,
    backgroundColor: t.colors.bgCard,
    color: t.colors.textSecondary,
    fontSize: t.fontSizes.base,
    cursor: 'pointer',
    fontFamily: t.fonts.sans,
  },
  footer: {
    textAlign: 'center',
    padding: '32px 24px',
  },
  footerText: {
    fontSize: t.fontSizes.sm,
    color: t.colors.textTertiary,
    margin: 0,
    fontFamily: t.fonts.sans,
  },
}