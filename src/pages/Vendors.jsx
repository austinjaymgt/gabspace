
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import TagInput from '../components/TagInput'
import PhoneInput from '../components/PhoneInput'
import { Icon } from '../components/Icon'
import Modal from '../components/Modal'

export default function Vendors({ businessSpaceId }) {
    const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [editingVendor, setEditingVendor] = useState(null)
  const [form, setForm] = useState({
    name: '',
    category: '',
    email: '',
    phone: '',
    rate: '',
    address: '',
    website: '',
    instagram: '',
    paymentTerms: '',
    tags: [],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  useEffect(() => { if (businessSpaceId) fetchVendors() }, [businessSpaceId])

  async function fetchVendors() {
    setLoading(true)
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('business_space_id', businessSpaceId)
      .order('name', { ascending: true })
    if (!error) setVendors(data)
    setLoading(false)
  }

  function openAddForm() {
    setEditingVendor(null)
setForm({ name: '', category: '', email: '', phone: '', rate: '', address: '', website: '', instagram: '', paymentTerms: '', tags: [] })
    setShowForm(true)
  }

  function openEditForm(vendor) {
    setEditingVendor(vendor)
    setForm({
      name: vendor.name || '',
      category: vendor.category || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      rate: vendor.rate || '',
      address: vendor.address || '',
      website: vendor.website || '',
      instagram: vendor.instagram || '',
    paymentTerms: vendor.payment_terms || '',
    tags: vendor.tags || [],
    })
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      name: form.name,
      category: form.category || null,
      email: form.email || null,
      phone: form.phone || null,
      rate: form.rate ? parseFloat(form.rate) : null,
      address: form.address || null,
      website: form.website || null,
      instagram: form.instagram || null,
      payment_terms: form.paymentTerms || null,
        tags: form.tags || [],
    }

    let error
    if (editingVendor) {
      // Update existing vendor
      const result = await supabase.from('vendors').update(payload).eq('id', editingVendor.id)
      error = result.error
      if (!error) {
        // Refresh selectedVendor so the profile view updates immediately
        const updated = { ...editingVendor, ...payload }
        setSelectedVendor(updated)
      }
    } else {
  // Insert new vendor
  const result = await supabase.from('vendors').insert({ ...payload, user_id: user.id, business_space_id: businessSpaceId })
  error = result.error
}

    if (error) {
      setError(error.message)
    } else {
      setShowForm(false)
      setEditingVendor(null)
setForm({ name: '', category: '', email: '', phone: '', rate: '', address: '', website: '', instagram: '', paymentTerms: '', tags: [] })
      fetchVendors()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this vendor?')) return
    await supabase.from('vendors').delete().eq('id', id)
    fetchVendors()
    if (selectedVendor?.id === id) setSelectedVendor(null)
  }

  const categories = [
    'Photography', 'Videography', 'Catering', 'Florals', 'Music & DJ',
    'Hair & Makeup', 'Venue', 'Rentals', 'Transportation', 'Other'
  ]

// Category pills reflect whatever categories are actually in use, not the
// fixed add/edit-form option list — an "Other" or ad hoc category a vendor
// was saved with should still get its own filter.
const vendorCategories = Array.from(
  new Set(vendors.map(v => v.category).filter(Boolean))
).sort((a, b) => a.localeCompare(b))

const query = search.trim().toLowerCase()

// Filtered list: active category pill AND the search box, matching name,
// category, or tags.
const visibleVendors = vendors
  .filter(v => activeCategory === 'all' || v.category === activeCategory)
  .filter(v => !query || [v.name, v.category, ...(v.tags || [])].filter(Boolean).some(s => s.toLowerCase().includes(query)))

  // ── MAIN LIST VIEW ─────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={{ fontSize: t.fontSizes.xs, fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.primary, marginBottom: '6px' }}>Operations</div>
          <h2 style={styles.title}>Vendors</h2>
          <p style={styles.subtitle}>{vendors.length} total vendors</p>
        </div>
        <button onClick={openAddForm} style={styles.addBtn}>
          + Add Vendor
        </button>
      </div>

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setError(null) }} title={editingVendor ? 'Edit Vendor' : 'New Vendor'} size="lg">
        <div>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.formGrid}>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Vendor name *</label>
              <input
                style={styles.input}
                placeholder="e.g. Bright Lens Photography"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Category</label>
              <select style={styles.input} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Rate ($)</label>
              <input style={styles.input} type="number" placeholder="0.00" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input style={styles.input} type="email" placeholder="vendor@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Phone</label>
              <PhoneInput style={styles.input} value={form.phone} onChange={phone => setForm({ ...form, phone })} />
            </div>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Address</label>
              <input style={styles.input} placeholder="123 Main St, City, State" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Website</label>
              <input style={styles.input} placeholder="https://example.com" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
            </div>
            <div style={styles.field}>
  <label style={styles.label}>Instagram</label>
  <input style={styles.input} placeholder="@handle" value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} />
</div>
<div style={styles.field}>
  <label style={styles.label}>Payment terms</label>
  <input style={styles.input} placeholder="e.g. Net-30, due on pickup" value={form.paymentTerms} onChange={e => setForm({ ...form, paymentTerms: e.target.value })} />
</div>
<div style={{ ...styles.field, gridColumn: 'span 2' }}>
  <label style={styles.label}>Tags</label>
  <TagInput
    value={form.tags}
    onChange={tags => setForm({ ...form, tags })}
    placeholder="e.g. internal, preferred, backup..."
  />
</div>
</div>
<div style={styles.formActions}>
            <button onClick={() => { setShowForm(false); setError(null) }} style={styles.cancelBtn}>Cancel</button>
            <button onClick={handleSave} style={styles.saveBtn} disabled={saving || !form.name}>
              {saving ? 'Saving...' : editingVendor ? 'Save Changes' : 'Save Vendor'}
            </button>
          </div>
        </div>
      </Modal>

      {!loading && vendors.length > 0 && (
  <div style={styles.filterRow}>
    <div style={styles.searchWrapSmall}>
      <Icon name="search" size="sm" />
      <input
        style={styles.searchInput}
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search vendors..."
      />
      {search && (
        <button onClick={() => setSearch('')} style={styles.clearSearch} aria-label="Clear search">
          <Icon name="close" size="sm" />
        </button>
      )}
    </div>
    <div style={styles.pillRow}>
      {['all', ...vendorCategories].map(c => {
        const active = activeCategory === c
        return (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            style={{ ...styles.pillBtn, ...(active ? styles.pillBtnActive : {}) }}
          >
            {c === 'all' ? 'All Types' : c}
          </button>
        )
      })}
    </div>
  </div>
)}

{loading ? (
  <div style={styles.empty}>Loading vendors...</div>
) : vendors.length === 0 ? (
  <div style={styles.emptyState}>
    <div style={styles.emptyIcon}>🏪</div>
    <h3 style={styles.emptyTitle}>No vendors yet</h3>
    <p style={styles.emptyText}>Add vendors you work with regularly</p>
    <button onClick={openAddForm} style={styles.addBtn}>+ Add Vendor</button>
  </div>
) : visibleVendors.length === 0 ? (
  <div style={styles.empty}>No vendors match {search ? `"${search}"` : 'this filter'}.</div>
) : (
  <div style={styles.grid}>
    {visibleVendors.map(vendor => (
            <div key={vendor.id} style={styles.vendorCard} onClick={() => setSelectedVendor(vendor)}>
              <div style={styles.vendorTop}>
                <div style={styles.avatar}>{vendor.name.charAt(0).toUpperCase()}</div>
                {vendor.category && <div style={styles.categoryBadge}>{vendor.category}</div>}
              </div>
              <div style={styles.vendorName}>{vendor.name}</div>
              {vendor.email && <div style={styles.vendorDetail}>{vendor.email}</div>}
              {vendor.phone && <div style={styles.vendorDetail}>{vendor.phone}</div>}
              {vendor.rate && (
                <div style={styles.vendorRate}>${parseFloat(vendor.rate).toLocaleString()}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!selectedVendor && !showForm}
        onClose={() => setSelectedVendor(null)}
        title={selectedVendor?.name}
        size="lg"
        headerActions={selectedVendor && (
          <>
            <button onClick={() => openEditForm(selectedVendor)} style={styles.editBtn}>Edit vendor</button>
            <button onClick={() => handleDelete(selectedVendor.id)} style={styles.deleteBtn}>Delete vendor</button>
          </>
        )}
      >
        {selectedVendor && (
          <div>
            {selectedVendor.category && (
              <div style={{ ...styles.categoryBadge, marginBottom: '16px', display: 'inline-block' }}>{selectedVendor.category}</div>
            )}
            <div style={styles.detailGrid}>
              {selectedVendor.email && (
                <div style={styles.detailField}>
                  <div style={styles.detailFieldLabel}>Email</div>
                  <div style={styles.detailFieldValue}>{selectedVendor.email}</div>
                </div>
              )}
              {selectedVendor.phone && (
                <div style={styles.detailField}>
                  <div style={styles.detailFieldLabel}>Phone</div>
                  <div style={styles.detailFieldValue}>{selectedVendor.phone}</div>
                </div>
              )}
              {selectedVendor.rate && (
                <div style={styles.detailField}>
                  <div style={styles.detailFieldLabel}>Rate</div>
                  <div style={styles.detailFieldValue}>
                    ${parseFloat(selectedVendor.rate).toLocaleString()}
                  </div>
                </div>
              )}
              {selectedVendor.payment_terms && (
                <div style={styles.detailField}>
                  <div style={styles.detailFieldLabel}>Payment terms</div>
                  <div style={styles.detailFieldValue}>{selectedVendor.payment_terms}</div>
                </div>
              )}
              {selectedVendor.address && (
                <div style={{ ...styles.detailField, gridColumn: 'span 2' }}>
                  <div style={styles.detailFieldLabel}>Address</div>
                  <div style={styles.detailFieldValue}>{selectedVendor.address}</div>
                </div>
              )}
              {selectedVendor.website && (
                <div style={styles.detailField}>
                  <div style={styles.detailFieldLabel}>Website</div>
                  <div style={styles.detailFieldValue}>
                    <a href={selectedVendor.website} target="_blank" rel="noreferrer" style={styles.link}>
                      {selectedVendor.website}
                    </a>
                  </div>
                </div>
              )}
              {selectedVendor.instagram && (
                <div style={styles.detailField}>
                  <div style={styles.detailFieldLabel}>Instagram</div>
                  <div style={styles.detailFieldValue}>{selectedVendor.instagram}</div>
                </div>
              )}
              {selectedVendor.tags && selectedVendor.tags.length > 0 && (
                <div style={{ ...styles.detailField, gridColumn: 'span 2' }}>
                  <div style={styles.detailFieldLabel}>Tags</div>
                  <div style={styles.detailTagRow}>
                    {selectedVendor.tags.map(tag => (
                      <span key={tag} style={styles.tagChip}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

const styles = {
  page: { padding: '32px', fontFamily: t.fonts.sans },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  title: { fontSize: '22px', fontWeight: '800', color: t.colors.textPrimary, margin: 0, fontFamily: t.fonts.heading, letterSpacing: '-0.02em' },
  subtitle: { fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '4px 0 0' },
  addBtn: { padding: '10px 18px', borderRadius: t.radius.full, border: 'none', backgroundColor: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans },
  editBtn: { padding: '8px 14px', borderRadius: t.radius.full, border: `1px solid ${t.colors.primary}`, backgroundColor: t.colors.bgCard, color: t.colors.primary, fontSize: t.fontSizes.base, cursor: 'pointer', fontFamily: t.fonts.sans, fontWeight: '500' },
  formCard: { backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '24px', border: `1px solid ${t.colors.border}`, marginBottom: '24px' },
  formTitle: { fontSize: t.fontSizes.lg, fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 20px', fontFamily: t.fonts.heading, letterSpacing: '-0.01em' },
  formGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px', marginBottom: '20px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary },
  input: { padding: '9px 12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, color: t.colors.textPrimary, outline: 'none', backgroundColor: t.colors.bgCard, fontFamily: t.fonts.sans },
  formActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  cancelBtn: { padding: '9px 16px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: t.fontSizes.base, cursor: 'pointer', fontFamily: t.fonts.sans },
  saveBtn: { padding: '9px 16px', borderRadius: t.radius.full, border: 'none', backgroundColor: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans },
  error: { padding: '10px 14px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.base, marginBottom: '16px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' },
  vendorCard: { backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '20px', border: `1px solid ${t.colors.border}`, cursor: 'pointer', transition: 'border-color 0.15s' },
  vendorTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' },
  avatar: { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: t.colors.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: t.fontSizes.md, fontWeight: '600', fontFamily: t.fonts.heading },
  categoryBadge: { padding: '3px 10px', borderRadius: t.radius.full, fontSize: t.fontSizes.xs, fontWeight: '500', backgroundColor: t.colors.primaryLight, color: t.colors.primary },
  vendorName: { fontSize: t.fontSizes.md, fontWeight: '600', color: t.colors.textPrimary, marginBottom: '6px' },
  vendorDetail: { fontSize: t.fontSizes.sm, color: t.colors.textTertiary, marginBottom: '2px' },
  vendorRate: { fontSize: t.fontSizes.md, fontWeight: '700', color: t.colors.primary, marginTop: '8px', fontFamily: t.fonts.heading },
filterRow: {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap',
  marginBottom: '20px',
},
searchWrapSmall: {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '7px 14px',
  width: '220px',
  backgroundColor: t.colors.bgCard,
  border: `1px solid ${t.colors.border}`,
  borderRadius: t.radius.full,
  color: t.colors.textTertiary,
  flexShrink: 0,
},
searchInput: {
  flex: 1,
  minWidth: 0,
  border: 'none',
  outline: 'none',
  fontSize: t.fontSizes.sm,
  color: t.colors.textPrimary,
  backgroundColor: 'transparent',
  fontFamily: t.fonts.sans,
},
clearSearch: {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: t.colors.textTertiary,
  display: 'flex',
  alignItems: 'center',
  padding: 0,
},
pillRow: {
  display: 'flex',
  gap: '4px',
  background: t.colors.bg,
  borderRadius: t.radius.full,
  padding: '4px',
  flexWrap: 'wrap',
},
pillBtn: {
  padding: '5px 14px',
  borderRadius: t.radius.full,
  border: 'none',
  fontFamily: t.fonts.sans,
  fontSize: t.fontSizes.xs,
  fontWeight: 400,
  cursor: 'pointer',
  background: 'transparent',
  color: t.colors.textSecondary,
  whiteSpace: 'nowrap',
},
pillBtnActive: {
  background: t.colors.bgCard,
  color: t.colors.textPrimary,
  fontWeight: 600,
  boxShadow: t.shadows.sm,
},
tagChip: {
  padding: '2px 8px',
  borderRadius: t.radius.full,
  backgroundColor: t.colors.primaryLight,
  color: t.colors.primary,
  fontSize: '11px',
  fontWeight: 500,
  fontFamily: t.fonts.sans,
},
detailTagRow: {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  marginTop: '4px',
},
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}` },
  emptyIcon: { fontSize: '40px', marginBottom: '16px' },
  emptyTitle: { fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px', fontFamily: t.fonts.heading },
  emptyText: { fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '0 0 24px' },
  empty: { fontSize: t.fontSizes.base, color: t.colors.textTertiary, padding: '40px', textAlign: 'center' },
  detailHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '24px' },
  backBtn: { padding: '8px 14px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: t.fontSizes.base, cursor: 'pointer', fontFamily: t.fonts.sans },
  deleteBtn: { padding: '8px 14px', borderRadius: t.radius.full, border: 'none', backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.base, cursor: 'pointer', fontFamily: t.fonts.sans, fontWeight: '500' },
  detailCard: { backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: '32px', border: `1px solid ${t.colors.border}` },
  detailTop: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' },
  detailAvatar: { width: '56px', height: '56px', borderRadius: '50%', background: `linear-gradient(135deg, ${t.colors.primary}, #6B8F71)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '700', fontFamily: t.fonts.heading },
  detailName: { fontSize: '24px', fontWeight: '800', color: t.colors.textPrimary, margin: '0 0 6px', fontFamily: t.fonts.heading, letterSpacing: '-0.02em' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' },
  detailField: { backgroundColor: t.colors.bg, borderRadius: t.radius.md, padding: '14px 16px' },
  detailFieldLabel: { fontSize: t.fontSizes.xs, color: t.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.06em' },
  detailFieldValue: { fontSize: t.fontSizes.md, color: t.colors.textPrimary },
  link: { color: t.colors.primary, textDecoration: 'none', fontWeight: '500' },
}