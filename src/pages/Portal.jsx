import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Portal() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [client, setClient] = useState(null)
 const [updates, setUpdates] = useState([])
const [visibleCount, setVisibleCount] = useState(3)
  const [projects, setProjects] = useState([])

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
      setLoading(false)
    }

    loadPortal()
  }, [token])

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
          <div style={styles.clientName}>
            {client.name}'s Portal
          </div>
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
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
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
  </div>
))}
{updates.length > visibleCount && (
  <button
    onClick={() => setVisibleCount(prev => prev + 3)}
    style={{
      width: '100%',
      padding: '12px',
      borderRadius: '10px',
      border: '1px solid #f0f0eb',
      backgroundColor: '#fff',
      color: '#888',
      fontSize: '13px',
      cursor: 'pointer',
      fontFamily: 'sans-serif',
      marginTop: '8px',
    }}
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
  page: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f0',
    fontFamily: 'sans-serif',
  },
  centered: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f0',
    fontFamily: 'sans-serif',
  },
  loadingText: {
    fontSize: '14px',
    color: '#999',
  },
  notFound: {
    textAlign: 'center',
    padding: '40px',
  },
  notFoundIcon: { fontSize: '48px', marginBottom: '16px' },
  notFoundTitle: { fontSize: '22px', fontWeight: '700', color: '#1a1a1a', margin: '0 0 8px' },
  notFoundText: { fontSize: '14px', color: '#999', margin: 0 },
  header: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #f0f0eb',
    padding: '16px 24px',
  },
  headerInner: {
    maxWidth: '680px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1a1a1a',
  },
  clientName: {
    fontSize: '13px',
    color: '#999',
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
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '28px',
    border: '1px solid #f0f0eb',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  welcomeAvatar: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: '#1D9E75',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    fontWeight: '700',
    flexShrink: 0,
  },
  welcomeTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1a1a1a',
    margin: '0 0 4px',
  },
  welcomeSubtitle: {
    fontSize: '14px',
    color: '#999',
    margin: 0,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a1a',
    margin: 0,
  },
  projectCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #f0f0eb',
  },
  projectTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  projectTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1a1a1a',
  },
  statusBadge: {
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '500',
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
    backgroundColor: '#fafaf8',
    borderRadius: '8px',
    padding: '12px',
  },
  eventIcon: { fontSize: '18px' },
  eventName: { fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '2px' },
  eventDate: { fontSize: '13px', color: '#666', marginBottom: '2px' },
  eventVenue: { fontSize: '12px', color: '#999' },
  updateFeed: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  updateCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #f0f0eb',
  },
  updateMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
  },
  updateAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#1D9E75',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '700',
    flexShrink: 0,
  },
  updateAuthor: { fontSize: '13px', fontWeight: '600', color: '#1a1a1a' },
  updateDate: { fontSize: '11px', color: '#bbb' },
  updateTitle: { fontSize: '15px', fontWeight: '600', color: '#1a1a1a', margin: '0 0 8px' },
  updateMessage: { fontSize: '14px', color: '#555', margin: 0, lineHeight: '1.6' },
  noUpdates: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '32px',
    border: '1px solid #f0f0eb',
    textAlign: 'center',
    fontSize: '14px',
    color: '#bbb',
  },
  footer: {
    textAlign: 'center',
    padding: '32px 24px',
  },
  footerText: {
    fontSize: '12px',
    color: '#ccc',
    margin: 0,
  },
}