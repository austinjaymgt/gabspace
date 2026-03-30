import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Assets() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({
    name: '',
    category: '',
    file_url: '',
    description: '',
    tags: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(null)

  const categories = [
    'Logo', 'Brand Colors', 'Typography', 'Photography',
    'Video', 'Templates', 'Social Media', 'Documents', 'Other'
  ]

  const categoryIcons = {
    'Logo': '🎨',
    'Brand Colors': '🎨',
    'Typography': '✍️',
    'Photography': '📸',
    'Video': '🎬',
    'Templates': '📄',
    'Social Media': '📱',
    'Documents': '📁',
    'Other': '📦',
  }

  useEffect(() => { fetchAssets() }, [])

  async function fetchAssets() {
    setLoading(true)
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setAssets(data)
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('assets').insert({
      name: form.name,
      category: form.category || null,
      file_url: form.file_url || null,
      description: form.description || null,
      tags: form.tags || null,
      user_id: user.id,
    })
    if (error) setError(error.message)
    else {
      setShowForm(false)
      setForm({ name: '', category: '', file_url: '', description: '', tags: '' })
      fetchAssets()
    }
    setSaving(false)
  }

  async function handleEditSave() {
    await supabase.from('assets').update({
      name: editForm.name,
      category: editForm.category || null,
      file_url: editForm.file_url || null,
      description: editForm.description || null,
      tags: editForm.tags || null,
    }).eq('id', selectedAsset.id)
    fetchAssets()
    setSelectedAsset(prev => ({ ...prev, ...editForm }))
    setEditMode(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this asset?')) return
    await supabase.from('assets').delete().eq('id', id)
    fetchAssets()
    setSelectedAsset(null)
  }

  function copyLink(url, id) {
    navigator.clipboard.writeText(url)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const filteredAssets = filter === 'all'
    ? assets
    : assets.filter(a => a.category === filter)

  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = assets.filter(a => a.category === cat).length
    return acc
  }, {})

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Brand Assets</h2>
          <p style={styles.subtitle}>{assets.length} total assets</p>
        </div>
        <button onClick={() => setShowForm(true)} style={styles.addBtn}>
          + Add Asset
        </button>
      </div>

      <div style={styles.filterRow}>
        <button
          onClick={() => setFilter('all')}
          style={{ ...styles.filterBtn, ...(filter === 'all' ? styles.filterBtnActive : {}) }}
        >
          All ({assets.length})
        </button>
        {categories.filter(cat => categoryCounts[cat] > 0).map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            style={{ ...styles.filterBtn, ...(filter === cat ? styles.filterBtnActive : {}) }}
          >
            {categoryIcons[cat]} {cat} ({categoryCounts[cat]})
          </button>
        ))}
      </div>

      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>New Asset</h3>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.formGrid}>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Asset name *</label>
              <input
                style={styles.input}
                placeholder="e.g. Primary Logo (White)"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Category</label>
              <select
                style={styles.input}
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
              >
                <option value="">Select category</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Tags</label>
              <input
                style={styles.input}
                placeholder="e.g. logo, white, horizontal"
                value={form.tags}
                onChange={e => setForm({ ...form, tags: e.target.value })}
              />
            </div>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>File link</label>
              <input
                style={styles.input}
                placeholder="https://drive.google.com/... or Dropbox, Figma, etc."
                value={form.file_url}
                onChange={e => setForm({ ...form, file_url: e.target.value })}
              />
            </div>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Description</label>
              <input
                style={styles.input}
                placeholder="When to use this asset, format, dimensions..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <div style={styles.formActions}>
            <button onClick={() => { setShowForm(false); setError(null) }} style={styles.cancelBtn}>
              Cancel
            </button>
            <button onClick={handleSave} style={styles.saveBtn} disabled={saving || !form.name}>
              {saving ? 'Saving...' : 'Save Asset'}
            </button>
          </div>
        </div>
      )}

      {selectedAsset && (
        <div style={styles.detailOverlay} onClick={() => { setSelectedAsset(null); setEditMode(false) }}>
          <div style={styles.detailPanel} onClick={e => e.stopPropagation()}>
            <div style={styles.detailPanelHeader}>
              {editMode ? (
                <input
                  style={{ ...styles.input, fontSize: '16px', fontWeight: '700', flex: 1, marginRight: '12px' }}
                  value={editForm.name || ''}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                />
              ) : (
                <h3 style={styles.detailPanelTitle}>{selectedAsset.name}</h3>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                {!editMode && (
                  <button
                    onClick={() => { setEditMode(true); setEditForm({ ...selectedAsset }) }}
                    style={styles.editBtn}
                  >
                    Edit
                  </button>
                )}
                <button onClick={() => { setSelectedAsset(null); setEditMode(false) }} style={styles.closeBtn}>✕</button>
              </div>
            </div>

            {editMode ? (
              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Category</label>
                  <select style={styles.input} value={editForm.category || ''} onChange={e => setEditForm({ ...editForm, category: e.target.value })}>
                    <option value="">No category</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Tags</label>
                  <input style={styles.input} value={editForm.tags || ''} onChange={e => setEditForm({ ...editForm, tags: e.target.value })} placeholder="tag1, tag2" />
                </div>
                <div style={{ ...styles.field, gridColumn: 'span 2' }}>
                  <label style={styles.label}>File link</label>
                  <input style={styles.input} value={editForm.file_url || ''} onChange={e => setEditForm({ ...editForm, file_url: e.target.value })} placeholder="https://..." />
                </div>
                <div style={{ ...styles.field, gridColumn: 'span 2' }}>
                  <label style={styles.label}>Description</label>
                  <textarea
                    style={{ ...styles.input, resize: 'vertical', fontFamily: 'sans-serif' }}
                    rows={3}
                    value={editForm.description || ''}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  />
                </div>
                <div style={{ ...styles.formActions, gridColumn: 'span 2' }}>
                  <button onClick={() => setEditMode(false)} style={styles.cancelBtn}>Cancel</button>
                  <button onClick={handleEditSave} style={styles.saveBtn}>Save changes</button>
                </div>
              </div>
            ) : (
              <>
                {selectedAsset.category && (
                  <div style={styles.categoryTag}>
                    {categoryIcons[selectedAsset.category]} {selectedAsset.category}
                  </div>
                )}
                {selectedAsset.description && (
                  <p style={styles.assetDescription}>{selectedAsset.description}</p>
                )}
                {selectedAsset.tags && (
                  <div style={styles.tagsRow}>
                    {selectedAsset.tags.split(',').map(tag => (
                      <span key={tag} style={styles.tag}>{tag.trim()}</span>
                    ))}
                  </div>
                )}
                {selectedAsset.file_url && (
                  <div style={styles.linkRow}>
                    
                      <a href={selectedAsset.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.openLink}
                    >
                      🔗 Open file
                    </a>
                    <button
                      onClick={() => copyLink(selectedAsset.file_url, selectedAsset.id)}
                      style={styles.copyLinkBtn}
                    >
                      {copied === selectedAsset.id ? '✓ Copied!' : 'Copy link'}
                    </button>
                  </div>
                )}
                <div style={styles.detailMeta}>
                  Added {new Date(selectedAsset.created_at).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric'
                  })}
                </div>
              </>
            )}

            <button onClick={() => handleDelete(selectedAsset.id)} style={styles.deleteBtnFull}>
              Delete asset
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.empty}>Loading assets...</div>
      ) : filteredAssets.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🗂️</div>
          <h3 style={styles.emptyTitle}>
            {filter === 'all' ? 'No assets yet' : `No ${filter} assets`}
          </h3>
          <p style={styles.emptyText}>
            {filter === 'all'
              ? 'Add your brand assets — logos, templates, photos and more'
              : 'Try a different category or add a new asset'}
          </p>
          {filter === 'all' && (
            <button onClick={() => setShowForm(true)} style={styles.addBtn}>
              + Add Asset
            </button>
          )}
        </div>
      ) : (
        <div style={styles.grid}>
          {filteredAssets.map(asset => (
            <div
              key={asset.id}
              style={styles.assetCard}
              onClick={() => setSelectedAsset(asset)}
            >
              <div style={styles.assetCardTop}>
                <div style={styles.assetIcon}>
                  {categoryIcons[asset.category] || '📦'}
                </div>
                {asset.category && (
                  <div style={styles.categoryBadge}>{asset.category}</div>
                )}
              </div>
              <div style={styles.assetName}>{asset.name}</div>
              {asset.description && (
                <div style={styles.assetDesc}>{asset.description}</div>
              )}
              {asset.tags && (
                <div style={styles.tagsRow}>
                  {asset.tags.split(',').slice(0, 3).map(tag => (
                    <span key={tag} style={styles.tag}>{tag.trim()}</span>
                  ))}
                </div>
              )}
              {asset.file_url && (
                <div style={styles.hasLink}>🔗 Has file link</div>
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
  filterRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  filterBtn: {
    padding: '7px 14px',
    borderRadius: '20px',
    border: '1px solid #e0e0e0',
    backgroundColor: '#fff',
    color: '#666',
    fontSize: '12px',
    cursor: 'pointer',
  },
  filterBtnActive: {
    backgroundColor: '#1D9E75',
    borderColor: '#1D9E75',
    color: '#fff',
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
    backgroundColor: '#fff',
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '16px',
  },
  assetCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #f0f0eb',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  assetCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '4px',
  },
  assetIcon: { fontSize: '24px' },
  categoryBadge: {
    fontSize: '11px',
    color: '#666',
    backgroundColor: '#f5f5f0',
    padding: '3px 8px',
    borderRadius: '20px',
  },
  assetName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a1a1a',
  },
  assetDesc: {
    fontSize: '12px',
    color: '#999',
    lineHeight: '1.4',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  tagsRow: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
  },
  tag: {
    fontSize: '11px',
    color: '#4466cc',
    backgroundColor: '#f0f4ff',
    padding: '2px 8px',
    borderRadius: '20px',
  },
  hasLink: {
    fontSize: '11px',
    color: '#1D9E75',
    marginTop: '4px',
  },
  detailOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  detailPanel: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '28px',
    width: '100%',
    maxWidth: '440px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  detailPanelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailPanelTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1a1a1a',
    margin: 0,
    flex: 1,
    paddingRight: '12px',
  },
  editBtn: {
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
    backgroundColor: '#fff',
    color: '#555',
    fontSize: '12px',
    cursor: 'pointer',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '16px',
    color: '#aaa',
    cursor: 'pointer',
    padding: '2px',
  },
  categoryTag: {
    display: 'inline-block',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '500',
    backgroundColor: '#f5f5f0',
    color: '#555',
    alignSelf: 'flex-start',
  },
  assetDescription: {
    fontSize: '14px',
    color: '#555',
    lineHeight: '1.6',
    margin: 0,
  },
  linkRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  openLink: {
    display: 'inline-block',
    padding: '8px 14px',
    borderRadius: '8px',
    backgroundColor: '#f0f4ff',
    color: '#4466cc',
    fontSize: '13px',
    fontWeight: '500',
    textDecoration: 'none',
    flex: 1,
    textAlign: 'center',
  },
  copyLinkBtn: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
    backgroundColor: '#fff',
    color: '#666',
    fontSize: '12px',
    cursor: 'pointer',
  },
  detailMeta: {
    fontSize: '11px',
    color: '#bbb',
  },
  deleteBtnFull: {
    padding: '10px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#fff0f0',
    color: '#cc3333',
    fontSize: '13px',
    cursor: 'pointer',
    width: '100%',
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
  emptyText: { fontSize: '13px', color: '#999', margin: '0 0 24px', textAlign: 'center' },
  empty: { fontSize: '13px', color: '#999', padding: '40px', textAlign: 'center' },
}