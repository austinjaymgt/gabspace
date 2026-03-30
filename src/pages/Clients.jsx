import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

export default function Clients() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [form, setForm] = useState({
    name: '', company: '', email: '', phone: '', status: 'active'
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [portalToken, setPortalToken] = useState(null)
const [portalUpdates, setPortalUpdates] = useState([])
const [showUpdateForm, setShowUpdateForm] = useState(false)
const [updateForm, setUpdateForm] = useState({ title: '', message: '' })
const [copied, setCopied] = useState(false)

  useEffect(() => { fetchClients() }, [])
async function fetchPortalData(clientId) {
  const { data: tokenData, error: tokenError } = await supabase
    .from('portal_tokens')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle()
  setPortalToken(tokenData)

  const { data: updates } = await supabase
    .from('portal_updates')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  setPortalUpdates(updates || [])
}

async function generatePortalLink(clientId) {
  const { data: existing } = await supabase
    .from('portal_tokens')
    .select('*')
    .eq('client_id', clientId)
    .single()

  if (existing) {
    setPortalToken(existing)
    return
  }

  const { data: { user } } = await supabase.auth.getUser()
  const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)
  const { data } = await supabase
    .from('portal_tokens')
    .insert({ client_id: clientId, user_id: user.id, token })
    .select()
    .single()
  setPortalToken(data)
}

async function postUpdate(clientId) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('portal_updates').insert({
    client_id: clientId,
    user_id: user.id,
    title: updateForm.title || null,
    message: updateForm.message,
    is_visible: true,
  })
  if (!error) {
    setUpdateForm({ title: '', message: '' })
    setShowUpdateForm(false)
    fetchPortalData(clientId)
  }
}

async function deleteUpdate(updateId, clientId) {
  await supabase.from('portal_updates').delete().eq('id', updateId)
  fetchPortalData(clientId)
}
async function regeneratePortalLink(clientId) {
  if (!confirm('This will invalidate the old link. Are you sure?')) return
  await supabase.from('portal_tokens').delete().eq('client_id', clientId)
  setPortalToken(null)
  await generatePortalLink(clientId)
}
function copyPortalLink(token) {
  const url = `${window.location.origin}/portal/${token}`
  navigator.clipboard.writeText(url)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}
  async function fetchClients() {
    setLoading(true)
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setClients(data)
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('clients').insert({
      ...form,
      user_id: user.id,
    })
    if (error) setError(error.message)
    else {
      setShowForm(false)
      setForm({ name: '', company: '', email: '', phone: '', status: 'active' })
      fetchClients()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this client?')) return
    await supabase.from('clients').delete().eq('id', id)
    fetchClients()
    if (selectedClient?.id === id) setSelectedClient(null)
  }

  if (selectedClient) {
    return (
      <div style={styles.page}>
        <div style={styles.detailHeader}>
          <button onClick={() => { setSelectedClient(client); fetchPortalData(client.id) }} style={styles.backBtn}>
            ← Back to clients
          </button>
          <button onClick={() => handleDelete(selectedClient.id)} style={styles.deleteBtn}>
            Delete client
          </button>
        </div>
        <div style={styles.detailCard}>
          <div style={styles.detailAvatar}>
            {selectedClient.name.charAt(0).toUpperCase()}
          </div>
          <h2 style={styles.detailName}>{selectedClient.name}</h2>
          {selectedClient.company && (
            <p style={styles.detailCompany}>{selectedClient.company}</p>
          )}
          <div style={styles.detailGrid}>
            {selectedClient.email && (
              <div style={styles.detailField}>
                <div style={styles.detailFieldLabel}>Email</div>
                <div style={styles.detailFieldValue}>{selectedClient.email}</div>
              </div>
            )}
            {selectedClient.phone && (
              <div style={styles.detailField}>
                <div style={styles.detailFieldLabel}>Phone</div>
                <div style={styles.detailFieldValue}>{selectedClient.phone}</div>
              </div>
            )}
            <div style={styles.detailField}>
              <div style={styles.detailFieldLabel}>Status</div>
              <div style={{
                ...styles.statusBadge,
                backgroundColor: selectedClient.status === 'active' ? '#f0faf6' : '#f5f5f0',
                color: selectedClient.status === 'active' ? '#1D9E75' : '#999',
              }}>
                {selectedClient.status}
              </div>
            </div>
            <div style={styles.detailField}>
              <div style={styles.detailFieldLabel}>Added</div>
              <div style={styles.detailFieldValue}>
                {new Date(selectedClient.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
          <div style={styles.portalSection}>
            <div style={styles.portalHeader}>
              <h3 style={styles.portalTitle}>Client Portal</h3>
              {!portalToken ? (
                <button
                  onClick={() => generatePortalLink(selectedClient.id)}
                  style={styles.portalGenerateBtn}
                >
                  Generate portal link
                </button>
              ) : (
                <button
                  onClick={() => copyPortalLink(portalToken.token)}
                  style={styles.portalCopyBtn}
                >
                  <div style={{ display: 'flex', gap: '8px' }}>
  <button
    onClick={() => copyPortalLink(portalToken.token)}
    style={styles.portalCopyBtn}
  >
    {copied ? '✓ Copied!' : 'Copy link'}
  </button>
  <button
    onClick={() => regeneratePortalLink(portalToken.client_id)}
    style={styles.portalRegenerateBtn}
  >
    Regenerate
  </button>
</div>
                </button>
              )}
            </div>

            {portalToken && (
              <div style={styles.portalLinkBox}>
                <span style={styles.portalLinkText}>
                  {window.location.origin}/portal/{portalToken.token}
                </span>
              </div>
            )}

            <div style={styles.portalFeed}>
              <div style={styles.portalFeedHeader}>
                <span style={styles.portalFeedTitle}>Updates</span>
                <button
                  onClick={() => setShowUpdateForm(!showUpdateForm)}
                  style={styles.postUpdateBtn}
                >
                  + Post update
                </button>
              </div>

              {showUpdateForm && (
                <div style={styles.updateForm}>
                  <input
                    style={styles.updateInput}
                    placeholder="Update title (optional)"
                    value={updateForm.title}
                    onChange={e => setUpdateForm({ ...updateForm, title: e.target.value })}
                  />
                  <textarea
                    style={styles.updateTextarea}
                    placeholder="Write your update..."
                    rows={3}
                    value={updateForm.message}
                    onChange={e => setUpdateForm({ ...updateForm, message: e.target.value })}
                  />
                  <div style={styles.updateFormActions}>
                    <button
                      onClick={() => setShowUpdateForm(false)}
                      style={styles.cancelBtn}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => postUpdate(selectedClient.id)}
                      style={styles.saveBtn}
                      disabled={!updateForm.message}
                    >
                      Post
                    </button>
                  </div>
                </div>
              )}

              {portalUpdates.length === 0 ? (
                <p style={styles.noUpdates}>No updates posted yet</p>
              ) : (
                portalUpdates.map(update => (
                  <div key={update.id} style={styles.updateCard}>
                    <div style={styles.updateCardHeader}>
                      <div>
                        {update.title && (
                          <div style={styles.updateCardTitle}>{update.title}</div>
                        )}
                        <div style={styles.updateCardDate}>
                          {new Date(update.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric'
                          })}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteUpdate(update.id, selectedClient.id)}
                        style={styles.deleteUpdateBtn}
                      >
                        ✕
                      </button>
                    </div>
                    <p style={styles.updateCardMessage}>{update.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Clients</h2>
          <p style={styles.subtitle}>{clients.length} total clients</p>
        </div>
        <button onClick={() => setShowForm(true)} style={styles.addBtn}>
          + Add Client
        </button>
      </div>

      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>New Client</h3>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.formGrid}>
            <div style={styles.field}>
              <label style={styles.label}>Name *</label>
              <input
                style={styles.input}
                placeholder="Full name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Company</label>
              <input
                style={styles.input}
                placeholder="Company name"
                value={form.company}
                onChange={e => setForm({ ...form, company: e.target.value })}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input
                style={styles.input}
                placeholder="email@example.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Phone</label>
              <input
                style={styles.input}
                placeholder="(555) 000-0000"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          <div style={styles.formActions}>
            <button
              onClick={() => { setShowForm(false); setError(null) }}
              style={styles.cancelBtn}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={styles.saveBtn}
              disabled={saving || !form.name}
            >
              {saving ? 'Saving...' : 'Save Client'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.empty}>Loading clients...</div>
      ) : clients.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>👥</div>
          <h3 style={styles.emptyTitle}>No clients yet</h3>
          <p style={styles.emptyText}>Add your first client to get started</p>
          <button onClick={() => setShowForm(true)} style={styles.addBtn}>
            + Add Client
          </button>
        </div>
      ) : (
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span>Name</span>
            <span>Company</span>
            <span>Email</span>
            <span>Status</span>
            <span></span>
          </div>
          {clients.map(client => (
            <div
              key={client.id}
              style={styles.tableRow}
              onClick={() => { setSelectedClient(client); fetchPortalData(client.id) }}
            >
              <span style={styles.clientName}>
                <div style={styles.avatar}>
                  {client.name.charAt(0).toUpperCase()}
                </div>
                {client.name}
              </span>
              <span style={styles.tableCell}>{client.company || '—'}</span>
              <span style={styles.tableCell}>{client.email || '—'}</span>
              <span>
                <div style={{
                  ...styles.statusBadge,
                  backgroundColor: client.status === 'active' ? '#f0faf6' : '#f5f5f0',
                  color: client.status === 'active' ? '#1D9E75' : '#999',
                }}>
                  {client.status}
                </div>
              </span>
              <span style={styles.tableCell}>→</span>
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
  addBtn: {
    padding: '10px 18px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#1D9E75',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #f0f0eb',
    marginBottom: '24px',
  },
  formTitle: { fontSize: '16px', fontWeight: '600', color: '#1a1a1a', margin: '0 0 20px' },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '20px',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '500', color: '#666' },
  input: {
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
    fontSize: '13px',
    color: '#1a1a1a',
    outline: 'none',
  },
  formActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  cancelBtn: {
    padding: '9px 16px',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
    backgroundColor: '#fff',
    color: '#666',
    fontSize: '13px',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '9px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#1D9E75',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  error: {
    padding: '10px 14px',
    borderRadius: '8px',
    backgroundColor: '#fff0f0',
    color: '#cc3333',
    fontSize: '13px',
    marginBottom: '16px',
  },
  table: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    border: '1px solid #f0f0eb',
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '2fr 1.5fr 2fr 1fr 0.3fr',
    padding: '12px 20px',
    backgroundColor: '#fafaf8',
    borderBottom: '1px solid #f0f0eb',
    fontSize: '12px',
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1.5fr 2fr 1fr 0.3fr',
    padding: '14px 20px',
    borderBottom: '1px solid #f9f9f7',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  clientName: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#1a1a1a',
  },
  avatar: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    backgroundColor: '#1D9E75',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '600',
    flexShrink: 0,
  },
  tableCell: { fontSize: '13px', color: '#666' },
  statusBadge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '500',
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
  emptyText: { fontSize: '13px', color: '#999', margin: '0 0 24px' },
  empty: { fontSize: '13px', color: '#999', padding: '40px', textAlign: 'center' },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '24px',
  },
  backBtn: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
    backgroundColor: '#fff',
    color: '#555',
    fontSize: '13px',
    cursor: 'pointer',
  },
  deleteBtn: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#fff0f0',
    color: '#cc3333',
    fontSize: '13px',
    cursor: 'pointer',
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '40px',
    border: '1px solid #f0f0eb',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  detailAvatar: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#1D9E75',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: '700',
    marginBottom: '16px',
  },
  detailName: { fontSize: '22px', fontWeight: '700', color: '#1a1a1a', margin: '0 0 4px' },
  detailCompany: { fontSize: '14px', color: '#999', margin: '0 0 32px' },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    width: '100%',
    maxWidth: '500px',
  },
  detailField: {
    backgroundColor: '#fafaf8',
    borderRadius: '8px',
    padding: '14px 16px',
  },
  detailFieldLabel: { fontSize: '11px', color: '#aaa', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' },
  detailFieldValue: { fontSize: '14px', color: '#1a1a1a' },
  portalSection: {
    marginTop: '28px',
    borderTop: '1px solid #f0f0eb',
    paddingTop: '28px',
  },
  portalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  portalTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1a1a1a',
    margin: 0,
  },
  portalGenerateBtn: {
    padding: '7px 14px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#1D9E75',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  portalCopyBtn: {
    padding: '7px 14px',
    borderRadius: '8px',
    border: '1px solid #1D9E75',
    backgroundColor: '#fff',
    color: '#1D9E75',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  portalRegenerateBtn: {
  padding: '7px 14px',
  borderRadius: '8px',
  border: '1px solid #e0e0e0',
  backgroundColor: '#fff',
  color: '#999',
  fontSize: '12px',
  cursor: 'pointer',
},
  portalLinkBox: {
    backgroundColor: '#f5f5f0',
    borderRadius: '8px',
    padding: '10px 14px',
    marginBottom: '20px',
  },
  portalLinkText: {
    fontSize: '12px',
    color: '#666',
    fontFamily: 'monospace',
  },
  portalFeed: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  portalFeedHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  portalFeedTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#666',
  },
  postUpdateBtn: {
    padding: '6px 12px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#f0faf6',
    color: '#1D9E75',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  updateForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    backgroundColor: '#fafaf8',
    borderRadius: '10px',
    padding: '16px',
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
  noUpdates: {
    fontSize: '13px',
    color: '#bbb',
    textAlign: 'center',
    padding: '20px 0',
  },
  updateCard: {
    backgroundColor: '#fafaf8',
    borderRadius: '10px',
    padding: '14px 16px',
    border: '1px solid #f0f0eb',
  },
  updateCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px',
  },
  updateCardTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '2px',
  },
  updateCardDate: {
    fontSize: '11px',
    color: '#bbb',
  },
  updateCardMessage: {
    fontSize: '13px',
    color: '#555',
    margin: 0,
    lineHeight: '1.5',
  },
  deleteUpdateBtn: {
    background: 'none',
    border: 'none',
    color: '#ddd',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '2px',
  },
}