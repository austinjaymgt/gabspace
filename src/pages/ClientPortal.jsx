import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function ClientPortal() {
  const [portals, setPortals] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(null)
  const [showUpdateForm, setShowUpdateForm] = useState(null)
  const [updateForm, setUpdateForm] = useState({ title: '', message: '' })
  const [posting, setPosting] = useState(false)

  useEffect(() => { fetchPortals() }, [])

  async function fetchPortals() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { data: tokens } = await supabase
      .from('portal_tokens')
      .select('*, clients(id, name, company, email)')
      .eq('user_id', user.id)

    if (!tokens) { setLoading(false); return }

    const portalsWithUpdates = await Promise.all(
      tokens.map(async token => {
        const { data: updates } = await supabase
          .from('portal_updates')
          .select('*')
          .eq('client_id', token.client_id)
          .order('created_at', { ascending: false })
        return { ...token, updates: updates || [] }
      })
    )

    setPortals(portalsWithUpdates)
    setLoading(false)
  }

  async function generateForClient(clientId) {
    const { data: { user } } = await supabase.auth.getUser()
    const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)
    await supabase.from('portal_tokens').insert({
      client_id: clientId,
      user_id: user.id,
      token,
    })
    fetchPortals()
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

  function copyLink(token) {
    const url = `${window.location.origin}/portal/${token}`
    navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

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

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Client Portal</h2>
          <p style={styles.subtitle}>Manage all your client portals in one place</p>
        </div>
      </div>

      {loading ? (
        <div style={styles.empty}>Loading portals...</div>
      ) : portals.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🔗</div>
          <h3 style={styles.emptyTitle}>No portals yet</h3>
          <p style={styles.emptyText}>
            Go to a client's detail page and generate their portal link to get started
          </p>
        </div>
      ) : (
        <div style={styles.portalList}>
          {portals.map(portal => (
            <div key={portal.id} style={styles.portalCard}>
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
                  <button
                    onClick={() => copyLink(portal.token)}
                    style={styles.copyBtn}
                  >
                    {copied === portal.token ? '✓ Copied!' : 'Copy link'}
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

              <div style={styles.portalMeta}>
                <div style={styles.metaItem}>
                  <span style={styles.metaLabel}>Last viewed</span>
                  <span style={styles.metaValue}>
                    {portal.last_viewed_at ? timeAgo(portal.last_viewed_at) : 'Not yet viewed'}
                  </span>
                </div>
                <div style={styles.metaItem}>
                  <span style={styles.metaLabel}>Updates posted</span>
                  <span style={styles.metaValue}>{portal.updates.length}</span>
                </div>
                <div style={styles.metaItem}>
                  <span style={styles.metaLabel}>Portal link</span>
                  <span style={styles.metaLink}>
                    /portal/{portal.token.substring(0, 12)}...
                  </span>
                </div>
              </div>

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
                    <button
                      onClick={() => setShowUpdateForm(null)}
                      style={styles.cancelBtn}
                    >
                      Cancel
                    </button>
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

              {portal.updates.length > 0 && (
                <div style={styles.recentUpdates}>
                  <div style={styles.recentUpdatesTitle}>Recent updates</div>
                  {portal.updates.slice(0, 2).map(update => (
                    <div key={update.id} style={styles.updateItem}>
                      <div style={styles.updateItemTitle}>
                        {update.title || 'Update'}
                      </div>
                      <div style={styles.updateItemMeta}>
                        {timeAgo(update.created_at)}
                      </div>
                    </div>
                  ))}
                  {portal.updates.length > 2 && (
                    <div style={styles.moreUpdates}>
                      +{portal.updates.length - 2} more updates
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  page: { padding: '32px' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
  },
  title: { fontSize: '20px', fontWeight: '700', color: '#1a1a1a', margin: 0 },
  subtitle: { fontSize: '13px', color: '#999', margin: '4px 0 0' },
  portalList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  portalCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #f0f0eb',
  },
  portalCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  portalClientInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#1D9E75',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: '600',
    flexShrink: 0,
  },
  clientName: { fontSize: '15px', fontWeight: '600', color: '#1a1a1a' },
  clientCompany: { fontSize: '12px', color: '#999', marginTop: '2px' },
  portalActions: {
    display: 'flex',
    gap: '8px',
  },
  copyBtn: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid #1D9E75',
    backgroundColor: '#fff',
    color: '#1D9E75',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  postBtn: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#1D9E75',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  portalMeta: {
    display: 'flex',
    gap: '24px',
    padding: '14px 16px',
    backgroundColor: '#fafaf8',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  metaItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  metaLabel: {
    fontSize: '11px',
    color: '#aaa',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: '13px',
    color: '#1a1a1a',
    fontWeight: '500',
  },
  metaLink: {
    fontSize: '12px',
    color: '#666',
    fontFamily: 'monospace',
  },
  updateForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    backgroundColor: '#fafaf8',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '16px',
  },
  updateInput: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
    fontSize: '13px',
    outline: 'none',
    backgroundColor: '#fff',
  },
  updateTextarea: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
    fontSize: '13px',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'sans-serif',
    backgroundColor: '#fff',
  },
  updateFormActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
    backgroundColor: '#fff',
    color: '#666',
    fontSize: '13px',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#1D9E75',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  recentUpdates: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  recentUpdatesTitle: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#aaa',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  updateItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#fafaf8',
    borderRadius: '6px',
  },
  updateItemTitle: { fontSize: '13px', color: '#555' },
  updateItemMeta: { fontSize: '11px', color: '#bbb' },
  moreUpdates: {
    fontSize: '12px',
    color: '#bbb',
    textAlign: 'center',
    padding: '4px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    border: '1px solid #f0f0eb',
  },
  emptyIcon: { fontSize: '40px', marginBottom: '16px' },
  emptyTitle: { fontSize: '16px', fontWeight: '600', color: '#1a1a1a', margin: '0 0 8px' },
  emptyText: { fontSize: '13px', color: '#999', margin: 0, textAlign: 'center' },
  empty: { fontSize: '13px', color: '#999', padding: '40px', textAlign: 'center' },
}