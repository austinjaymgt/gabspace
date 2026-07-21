import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import TagInput from '../components/TagInput'
import { Icon } from '../components/Icon'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

export default function Resources({ businessSpaceId, session }) {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedResource, setSelectedResource] = useState(null)
  const [editingResource, setEditingResource] = useState(null)
  const [form, setForm] = useState({
    kind: 'link',
    title: '',
    description: '',
    url: '',
    file: null, // File object, only used on insert
    tags: [],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [activeTagFilter, setActiveTagFilter] = useState(null)
  const [kindFilter, setKindFilter] = useState('all') // 'all' | 'file' | 'link'
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => { fetchResources() }, [])

  async function fetchResources() {
    setLoading(true)
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setResources(data)
    setLoading(false)
  }

  function openAddForm() {
    setEditingResource(null)
    setForm({ kind: 'link', title: '', description: '', url: '', file: null, tags: [] })
    setError(null)
    setShowForm(true)
  }

  function openEditForm(resource) {
    setEditingResource(resource)
    setForm({
      kind: resource.kind,
      title: resource.title || '',
      description: resource.description || '',
      url: resource.url || '',
      file: null,
      tags: resource.tags || [],
    })
    setError(null)
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()

    // Validation
    if (!form.title.trim()) {
      setError('Title is required.')
      setSaving(false)
      return
    }
    if (form.kind === 'link' && !normalizeUrl(form.url)) {
      setError('URL is required for link resources.')
      setSaving(false)
      return
    }
    if (form.kind === 'file' && !editingResource && !form.file) {
      setError('Please choose a file to upload.')
      setSaving(false)
      return
    }
    if (form.file && form.file.size > MAX_FILE_SIZE) {
      setError('File is larger than 50 MB.')
      setSaving(false)
      return
    }

    try {
      if (editingResource) {
        // EDIT — only metadata. Kind is locked, file stays put.
        const payload = {
          title: form.title.trim(),
          description: form.description.trim() || null,
          tags: form.tags || [],
        }
if (form.kind === 'link') payload.url = normalizeUrl(form.url)

        const { error: updErr } = await supabase
          .from('resources')
          .update(payload)
          .eq('id', editingResource.id)
        if (updErr) throw updErr

        // Refresh selectedResource so detail view updates immediately
        const updated = { ...editingResource, ...payload }
        setSelectedResource(updated)
      } else {
        // INSERT — different flow for file vs link
        if (form.kind === 'link') {
          const { error: insErr } = await supabase.from('resources').insert({
            business_space_id: businessSpaceId,
            created_by: user.id,
            kind: 'link',
            title: form.title.trim(),
            description: form.description.trim() || null,
            tags: form.tags || [],
  url: normalizeUrl(form.url),
          })
          if (insErr) throw insErr
        } else {
          // FILE: insert row first (to get the resource id), then upload,
          // then update the row with file_path/file_name/file_size/file_mime.
          // The CHECK constraint requires file_path NOT NULL on insert, so
          // we use a two-step pattern: temp placeholder path, then update.
          //
          // To avoid the constraint headache, we build the storage path BEFORE
          // insert using a pre-generated UUID.
          const resourceId = crypto.randomUUID()
          const safeName = form.file.name.replace(/[^\w.\-]/g, '_')
          const filePath = `${businessSpaceId}/${resourceId}/${safeName}`

          // 1. Upload to storage
          const { error: upErr } = await supabase
            .storage
            .from('resources')
            .upload(filePath, form.file, {
              cacheControl: '3600',
              upsert: false,
            })
          if (upErr) throw upErr

          // 2. Insert the row referencing the uploaded path
          const { error: insErr } = await supabase.from('resources').insert({
            id: resourceId,
            business_space_id: businessSpaceId,
            created_by: user.id,
            kind: 'file',
            title: form.title.trim(),
            description: form.description.trim() || null,
            tags: form.tags || [],
            file_path: filePath,
            file_name: form.file.name,
            file_size: form.file.size,
            file_mime: form.file.type || null,
          })
          if (insErr) {
            // Rollback storage upload if the DB insert failed
            await supabase.storage.from('resources').remove([filePath])
            throw insErr
          }
        }
      }

      setShowForm(false)
      setEditingResource(null)
      setForm({ kind: 'link', title: '', description: '', url: '', file: null, tags: [] })
      fetchResources()
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(resource) {
    if (!confirm(`Delete "${resource.title}"? This can't be undone.`)) return

    // If it's a file resource, remove the storage object too
    if (resource.kind === 'file' && resource.file_path) {
      await supabase.storage.from('resources').remove([resource.file_path])
    }
    await supabase.from('resources').delete().eq('id', resource.id)
    fetchResources()
    if (selectedResource?.id === resource.id) setSelectedResource(null)
  }

  async function handleOpenResource(resource) {
  if (resource.kind === 'link') {
  window.open(normalizeUrl(resource.url), '_blank', 'noopener,noreferrer')
  return
}
    // file — fetch a signed URL and open it
    const { data, error } = await supabase
      .storage
      .from('resources')
      .createSignedUrl(resource.file_path, 60 * 5) // 5 minutes
    if (error) {
      alert('Could not open the file. ' + error.message)
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }
function normalizeUrl(url) {
  if (!url) return url
  const trimmed = url.trim()
  // already has a scheme (http, https, mailto, etc.) → leave it
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) {
    return trimmed
  }
  return `https://${trimmed}`
}
  function formatBytes(bytes) {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function iconForResource(resource) {
    return resource.kind === 'link' ? 'link' : 'file'
  }

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────
  if (selectedResource) {
    return (
      <div style={styles.page}>
        <div style={styles.detailHeader}>
          <button
            onClick={() => { setSelectedResource(null); setShowForm(false) }}
            style={styles.backBtn}
          >
            ← Back to resources
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => openEditForm(selectedResource)} style={styles.editBtn}>
              <Icon name="edit" size="sm" />
              Edit
            </button>
            <button onClick={() => handleDelete(selectedResource)} style={styles.deleteBtn}>
              <Icon name="delete" size="sm" />
              Delete
            </button>
          </div>
        </div>

        {/* Inline edit form */}
        {showForm && editingResource && (
          <div style={styles.formCard}>
            <h3 style={styles.formTitle}>Edit Resource</h3>
            {error && <div style={styles.error}>{error}</div>}
            <ResourceFormFields
              form={form}
              setForm={setForm}
              isEditing={true}
              editingResource={editingResource}
            />
            <div style={styles.formActions}>
              <button onClick={() => { setShowForm(false); setError(null) }} style={styles.cancelBtn}>
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={styles.saveBtn}
                disabled={saving || !form.title.trim()}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        <div style={styles.detailCard}>
          <div style={styles.detailTop}>
            <div style={styles.detailAvatar}>
              <Icon name={iconForResource(selectedResource)} size="lg" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={styles.detailName}>{selectedResource.title}</h2>
              <div style={styles.detailKindBadge}>
                {selectedResource.kind === 'link' ? 'Link' : 'File'}
              </div>
            </div>
            <button onClick={() => handleOpenResource(selectedResource)} style={styles.openBtn}>
              <Icon name={selectedResource.kind === 'link' ? 'external' : 'download'} size="sm" />
              {selectedResource.kind === 'link' ? 'Open link' : 'Open file'}
            </button>
          </div>

          <div style={styles.detailGrid}>
            {selectedResource.description && (
              <div style={{ ...styles.detailField, gridColumn: 'span 2' }}>
                <div style={styles.detailFieldLabel}>Description</div>
                <div style={styles.detailFieldValue}>{selectedResource.description}</div>
              </div>
            )}

            {selectedResource.kind === 'link' && selectedResource.url && (
              <div style={{ ...styles.detailField, gridColumn: 'span 2' }}>
                <div style={styles.detailFieldLabel}>URL</div>
                <div style={styles.detailFieldValue}>
                  <a
                    href={normalizeUrl(selectedResource.url)}
  target="_blank"
  rel="noreferrer"
  style={styles.link}
>
  {selectedResource.url}
</a>
                </div>
              </div>
            )}

            {selectedResource.kind === 'file' && (
              <>
                <div style={styles.detailField}>
                  <div style={styles.detailFieldLabel}>File name</div>
                  <div style={styles.detailFieldValue}>{selectedResource.file_name}</div>
                </div>
                <div style={styles.detailField}>
                  <div style={styles.detailFieldLabel}>Size</div>
                  <div style={styles.detailFieldValue}>
                    {formatBytes(selectedResource.file_size)}
                  </div>
                </div>
              </>
            )}

            {selectedResource.tags && selectedResource.tags.length > 0 && (
              <div style={{ ...styles.detailField, gridColumn: 'span 2' }}>
                <div style={styles.detailFieldLabel}>Tags</div>
                <div style={styles.detailTagRow}>
                  {selectedResource.tags.map(tag => (
                    <span key={tag} style={styles.tagChip}>{tag}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={styles.detailField}>
              <div style={styles.detailFieldLabel}>Added</div>
              <div style={styles.detailFieldValue}>
                {new Date(selectedResource.created_at).toLocaleDateString(undefined, {
                  year: 'numeric', month: 'short', day: 'numeric'
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────

  // All unique tags across resources
  const allTags = Array.from(
    new Set(resources.flatMap(r => r.tags || []))
  ).sort((a, b) => a.localeCompare(b))

  // Apply filters
  const visibleResources = resources.filter(r => {
    if (kindFilter !== 'all' && r.kind !== kindFilter) return false
    if (activeTagFilter && !(r.tags || []).includes(activeTagFilter)) return false
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      const hay = [
        r.title || '',
        r.description || '',
        ...(r.tags || []),
      ].join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={{ fontSize: t.fontSizes.xs, fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.primary, marginBottom: '6px' }}>Operations</div>
          <h2 style={styles.title}>Resources</h2>
          <p style={styles.subtitle}>Files and links your team can reference</p>
        </div>
        <button onClick={openAddForm} style={styles.addBtn}>
          <Icon name="add" size="sm" />
          Add resource
        </button>
      </div>

      {/* Add form (top of page, list view) */}
      {showForm && !editingResource && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>New Resource</h3>
          {error && <div style={styles.error}>{error}</div>}
          <ResourceFormFields
            form={form}
            setForm={setForm}
            isEditing={false}
            editingResource={null}
          />
          <div style={styles.formActions}>
            <button onClick={() => { setShowForm(false); setError(null) }} style={styles.cancelBtn}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={styles.saveBtn}
              disabled={saving || !form.title.trim()}
            >
              {saving ? 'Saving...' : 'Save Resource'}
            </button>
          </div>
        </div>
      )}

      {/* Filter bar — search + kind + tags */}
      {!loading && resources.length > 0 && (
        <div style={styles.filterBar}>
          <input
            type="text"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          <div style={styles.segmented}>
            {[
              { key: 'all', label: 'All' },
              { key: 'file', label: 'Files' },
              { key: 'link', label: 'Links' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setKindFilter(opt.key)}
                style={{
                  ...styles.segmentedBtn,
                  ...(kindFilter === opt.key ? styles.segmentedBtnActive : {}),
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && allTags.length > 0 && (
        <div style={styles.tagFilterBar}>
          <span style={styles.filterLabel}>Tags:</span>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
              style={{
                ...styles.filterChip,
                ...(activeTagFilter === tag ? styles.filterChipActive : {}),
              }}
            >
              {tag}
            </button>
          ))}
          {activeTagFilter && (
            <button onClick={() => setActiveTagFilter(null)} style={styles.clearFilter}>
              Clear
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={styles.empty}>Loading resources...</div>
      ) : resources.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <Icon name="resources" size="xl" />
          </div>
          <h3 style={styles.emptyTitle}>No resources yet</h3>
          <p style={styles.emptyText}>Add files or links your team can reference whenever they need them</p>
          <button onClick={openAddForm} style={styles.addBtn}>
            <Icon name="add" size="sm" />
            Add resource
          </button>
        </div>
      ) : visibleResources.length === 0 ? (
        <div style={styles.empty}>No resources match the current filters.</div>
      ) : (
        <div style={styles.grid}>
          {visibleResources.map(resource => (
            <div
              key={resource.id}
              style={styles.resourceCard}
              onClick={() => setSelectedResource(resource)}
            >
              <div style={styles.cardTop}>
                <div style={{
                  ...styles.cardIcon,
                  backgroundColor: resource.kind === 'link' ? '#EAF4F9' : t.colors.primaryLight,
                  color: resource.kind === 'link' ? '#5B9BBF' : t.colors.primary,
                }}>
                  <Icon name={iconForResource(resource)} size="md" />
                </div>
                <div style={styles.kindBadge}>
                  {resource.kind === 'link' ? 'Link' : 'File'}
                </div>
              </div>

              <div style={styles.cardTitle}>{resource.title}</div>

              {resource.description && (
                <div style={styles.cardDesc}>{resource.description}</div>
              )}

              {resource.kind === 'file' && resource.file_size && (
                <div style={styles.cardMeta}>{formatBytes(resource.file_size)}</div>
              )}

              {resource.tags && resource.tags.length > 0 && (
                <div style={styles.tagRow}>
                  {resource.tags.slice(0, 4).map(tag => (
                    <span key={tag} style={styles.tagChip}>{tag}</span>
                  ))}
                  {resource.tags.length > 4 && (
                    <span style={styles.tagChip}>+{resource.tags.length - 4}</span>
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

// ── Reusable form fields (used in add + edit modes) ─────────────────────────
function ResourceFormFields({ form, setForm, isEditing, editingResource }) {
  return (
    <div style={styles.formGrid}>
      {/* Kind toggle — locked when editing */}
      <div style={{ ...styles.field, gridColumn: 'span 2' }}>
        <label style={styles.label}>Type {isEditing && <span style={styles.lockedHint}>(locked)</span>}</label>
        <div style={styles.kindToggle}>
          <button
            type="button"
            onClick={() => !isEditing && setForm({ ...form, kind: 'link' })}
            disabled={isEditing}
            style={{
              ...styles.kindToggleBtn,
              ...(form.kind === 'link' ? styles.kindToggleBtnActive : {}),
              ...(isEditing ? styles.kindToggleBtnDisabled : {}),
            }}
          >
            <Icon name="link" size="sm" />
            Link
          </button>
          <button
            type="button"
            onClick={() => !isEditing && setForm({ ...form, kind: 'file' })}
            disabled={isEditing}
            style={{
              ...styles.kindToggleBtn,
              ...(form.kind === 'file' ? styles.kindToggleBtnActive : {}),
              ...(isEditing ? styles.kindToggleBtnDisabled : {}),
            }}
          >
            <Icon name="file" size="sm" />
            File
          </button>
        </div>
      </div>

      <div style={{ ...styles.field, gridColumn: 'span 2' }}>
        <label style={styles.label}>Title *</label>
        <input
          style={styles.input}
          placeholder="e.g. Client onboarding checklist"
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
        />
      </div>

      <div style={{ ...styles.field, gridColumn: 'span 2' }}>
        <label style={styles.label}>Description</label>
        <input
          style={styles.input}
          placeholder="One-line summary (optional)"
          maxLength={200}
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
        />
      </div>

      {/* Conditional: link URL or file picker */}
      {form.kind === 'link' ? (
        <div style={{ ...styles.field, gridColumn: 'span 2' }}>
          <label style={styles.label}>URL *</label>
          <input
            style={styles.input}
            placeholder="https://..."
            value={form.url}
            onChange={e => setForm({ ...form, url: e.target.value })}
          />
        </div>
      ) : (
        <div style={{ ...styles.field, gridColumn: 'span 2' }}>
          <label style={styles.label}>
            File {isEditing ? '(cannot be changed)' : '* (max 50 MB)'}
          </label>
          {isEditing && editingResource ? (
            <div style={styles.fileStaticRow}>
              <Icon name="file" size="sm" />
              <span>{editingResource.file_name}</span>
            </div>
          ) : (
            <input
              type="file"
              style={styles.fileInput}
              onChange={e => setForm({ ...form, file: e.target.files?.[0] || null })}
            />
          )}
        </div>
      )}

      <div style={{ ...styles.field, gridColumn: 'span 2' }}>
        <label style={styles.label}>Tags</label>
        <TagInput
          value={form.tags}
          onChange={tags => setForm({ ...form, tags })}
          placeholder="e.g. template, contract, swipe..."
        />
      </div>
    </div>
  )
}

const styles = {
  page: { padding: '32px', fontFamily: t.fonts.sans },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  title: { fontSize: '22px', fontWeight: '800', color: t.colors.textPrimary, margin: 0, fontFamily: t.fonts.heading, letterSpacing: '-0.02em' },
  subtitle: { fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '4px 0 0' },
  addBtn: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: t.radius.md, border: 'none', backgroundColor: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans },
  editBtn: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: t.radius.md, border: `1px solid ${t.colors.primary}`, backgroundColor: t.colors.bgCard, color: t.colors.primary, fontSize: t.fontSizes.base, cursor: 'pointer', fontFamily: t.fonts.sans, fontWeight: '500' },
  deleteBtn: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: t.radius.md, border: 'none', backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.base, cursor: 'pointer', fontFamily: t.fonts.sans, fontWeight: '500' },
  openBtn: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: t.radius.md, border: 'none', backgroundColor: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans },

  // Form
  formCard: { backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.border}`, marginBottom: '24px' },
  formTitle: { fontSize: t.fontSizes.lg, fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 20px', fontFamily: t.fonts.heading, letterSpacing: '-0.01em' },
  formGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px', marginBottom: '20px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'flex', alignItems: 'center', gap: '6px' },
  lockedHint: { fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: 400 },
  input: { padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, color: t.colors.textPrimary, outline: 'none', backgroundColor: t.colors.bgCard, fontFamily: t.fonts.sans },
  fileInput: { padding: '9px 12px', borderRadius: t.radius.md, border: `1px dashed ${t.colors.border}`, fontSize: t.fontSizes.base, color: t.colors.textPrimary, outline: 'none', backgroundColor: t.colors.bg, fontFamily: t.fonts.sans, cursor: 'pointer' },
  fileStaticRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bg, color: t.colors.textSecondary, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans },
  formActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  cancelBtn: { padding: '9px 16px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: t.fontSizes.base, cursor: 'pointer', fontFamily: t.fonts.sans },
  saveBtn: { padding: '9px 16px', borderRadius: t.radius.md, border: 'none', backgroundColor: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans },
  error: { padding: '10px 14px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.base, marginBottom: '16px' },

  // Kind toggle
  kindToggle: { display: 'flex', gap: '8px' },
  kindToggleBtn: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: t.fontSizes.base, cursor: 'pointer', fontFamily: t.fonts.sans, fontWeight: '500' },
  kindToggleBtnActive: { borderColor: t.colors.primary, backgroundColor: t.colors.primaryLight, color: t.colors.primary },
  kindToggleBtnDisabled: { opacity: 0.6, cursor: 'not-allowed' },

  // Filter bar
  filterBar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', padding: '12px 16px', marginBottom: '12px', backgroundColor: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.md },
  searchInput: { flex: 1, minWidth: '200px', padding: '8px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, color: t.colors.textPrimary, outline: 'none', backgroundColor: t.colors.bg, fontFamily: t.fonts.sans },
  segmented: { display: 'inline-flex', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, overflow: 'hidden' },
  segmentedBtn: { padding: '8px 14px', border: 'none', backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: t.fontSizes.sm, fontWeight: 500, cursor: 'pointer', fontFamily: t.fonts.sans },
  segmentedBtnActive: { backgroundColor: t.colors.primary, color: '#fff' },

  // Tag filter bar
  tagFilterBar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', padding: '12px 16px', marginBottom: '16px', backgroundColor: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.md },
  filterLabel: { fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', marginRight: '4px' },
  filterChip: { padding: '4px 12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bg, color: t.colors.textSecondary, fontSize: t.fontSizes.xs, fontWeight: 500, cursor: 'pointer', fontFamily: t.fonts.sans, transition: 'all 0.15s' },
  filterChipActive: { backgroundColor: t.colors.primary, color: '#fff', borderColor: t.colors.primary },
  clearFilter: { background: 'none', border: 'none', color: t.colors.textTertiary, fontSize: t.fontSizes.xs, cursor: 'pointer', textDecoration: 'underline', fontFamily: t.fonts.sans, padding: '4px 8px', marginLeft: 'auto' },

  // Card grid
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' },
  resourceCard: { backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '20px', border: `1px solid ${t.colors.border}`, cursor: 'pointer', transition: 'border-color 0.15s', display: 'flex', flexDirection: 'column', gap: '8px' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' },
  cardIcon: { width: '40px', height: '40px', borderRadius: t.radius.md, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  kindBadge: { padding: '3px 10px', borderRadius: t.radius.full, fontSize: t.fontSizes.xs, fontWeight: '500', backgroundColor: t.colors.bg, color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em' },
  cardTitle: { fontSize: t.fontSizes.md, fontWeight: '600', color: t.colors.textPrimary },
  cardDesc: { fontSize: t.fontSizes.sm, color: t.colors.textTertiary, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  cardMeta: { fontSize: t.fontSizes.xs, color: t.colors.textTertiary },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' },
  tagChip: { padding: '2px 8px', borderRadius: t.radius.full, backgroundColor: t.colors.primaryLight, color: t.colors.primary, fontSize: '11px', fontWeight: 500, fontFamily: t.fonts.sans },

  // Empty states
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}` },
  emptyIcon: { color: t.colors.textTertiary, marginBottom: '16px' },
  emptyTitle: { fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px', fontFamily: t.fonts.heading },
  emptyText: { fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '0 0 24px' },
  empty: { fontSize: t.fontSizes.base, color: t.colors.textTertiary, padding: '40px', textAlign: 'center' },

  // Detail
  detailHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '24px' },
  backBtn: { padding: '8px 14px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: t.fontSizes.base, cursor: 'pointer', fontFamily: t.fonts.sans },
  detailCard: { backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '32px', border: `1px solid ${t.colors.border}` },
  detailTop: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' },
  detailAvatar: { width: '56px', height: '56px', borderRadius: t.radius.md, background: `linear-gradient(135deg, ${t.colors.primary}, #6B8F71)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  detailName: { fontSize: '24px', fontWeight: '800', color: t.colors.textPrimary, margin: '0 0 6px', fontFamily: t.fonts.heading, letterSpacing: '-0.02em' },
  detailKindBadge: { display: 'inline-block', padding: '3px 10px', borderRadius: t.radius.full, fontSize: t.fontSizes.xs, fontWeight: '500', backgroundColor: t.colors.primaryLight, color: t.colors.primary, textTransform: 'uppercase', letterSpacing: '0.05em' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' },
  detailField: { backgroundColor: t.colors.bg, borderRadius: t.radius.md, padding: '14px 16px' },
  detailFieldLabel: { fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.06em' },
  detailFieldValue: { fontSize: t.fontSizes.md, color: t.colors.textPrimary, wordBreak: 'break-word' },
  detailTagRow: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' },
  link: { color: t.colors.primary, textDecoration: 'none', fontWeight: '500' },
}