import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Vendors() {
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
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { fetchVendors() }, [])

  async function fetchVendors() {
    setLoading(true)
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .order('name', { ascending: true })
    if (!error) setVendors(data)
    setLoading(false)
  }

  function openAddForm() {
    setEditingVendor(null)
    setForm({ name: '', category: '', email: '', phone: '', rate: '', address: '', website: '', instagram: '' })
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
      const result = await supabase.from('vendors').insert({ ...payload, user_id: user.id })
      error = result.error
    }

    if (error) {
      setError(error.message)
    } else {
      setShowForm(false)
      setEditingVendor(null)
      setForm({ name: '', category: '', email: '', phone: '', rate: '', address: '', website: '', instagram: '' })
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

  // ── DETAIL / PROFILE VIEW ──────────────────────────────────────────────────
  if (selectedVendor) {
    return (
      <div style={styles.page}>
        <div style={styles.detailHeader}>
          <button onClick={() => { setSelectedVendor(null); setShowForm(false) }} style={styles.backBtn}>
            ← Back to vendors
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => openEditForm(selectedVendor)} style={styles.editBtn}>
              Edit vendor
            </button>
            <button onClick={() => handleDelete(selectedVendor.id)} style={styles.deleteBtn}>
              Delete vendor
            </button>
          </div>
        </div>

        {/* Edit form appears inline when editing from profile */}
        {showForm && editingVendor && (
          <div style={styles.formCard}>
            <h3 style={styles.formTitle}>Edit Vendor</h3>
            {error && <div style={styles.error}>{error}</div>}
            <div style={styles.formGrid}>
              <div style={{ ...styles.field, gridColumn: 'span 2' }}>
                <label style={styles.label}>Vendor name *</label>
                <input style={styles.input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
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
                <input style={styles.input} type="number" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Email</label>
                <input style={styles.input} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Phone</label>
                <input style={styles.input} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
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
            </div>
            <div style={styles.formActions}>
              <button onClick={() => { setShowForm(false); setError(null) }} style={styles.cancelBtn}>Cancel</button>
              <button onClick={handleSave} style={styles.saveBtn} disabled={saving || !form.name}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        <div style={styles.detailCard}>
          <div style={styles.detailTop}>
            <div style={styles.detailAvatar}>
              {selectedVendor.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={styles.detailName}>{selectedVendor.name}</h2>
              {selectedVendor.category && (
                <div style={styles.categoryBadge}>{selectedVendor.category}</div>
              )}
            </div>
          </div>
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
          </div>
        </div>
      </div>
    )
  }

  // ── MAIN LIST VIEW ─────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Vendors</h2>
          <p style={styles.subtitle}>{vendors.length} total vendors</p>
        </div>
        <button onClick={openAddForm} style={styles.addBtn}>
          + Add Vendor
        </button>
      </div>

      {showForm && !editingVendor && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>New Vendor</h3>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.formGrid}>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Vendor name *</label>
              <input
                style={styles.input}
                placeholder="e.g. John's Photography"
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
              <input style={styles.input} placeholder="(555) 000-0000" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
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
          </div>
          <div style={styles.formActions}>
            <button onClick={() => { setShowForm(false); setError(null) }} style={styles.cancelBtn}>Cancel</button>
            <button onClick={handleSave} style={styles.saveBtn} disabled={saving || !form.name}>
              {saving ? 'Saving...' : 'Save Vendor'}
            </button>
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
      ) : (
        <div style={styles.grid}>
          {vendors.map(vendor => (
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
    </div>
  )
}

const styles = {
  page: { padding: '32px' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px',
  },
  title: { fontSize: '20px', fontWeight: '700', color: '#1a1a1a', margin: 0 },
  subtitle: { fontSize: '13px', color: '#999', margin: '4px 0 0' },
  addBtn: {
    padding: '10px 18px', borderRadius: '8px', border: 'none',
    backgroundColor: '#1D9E75', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
  },
  editBtn: {
    padding: '8px 14px', borderRadius: '8px', border: '1px solid #1D9E75',
    backgroundColor: '#fff', color: '#1D9E75', fontSize: '13px', cursor: 'pointer',
  },
  formCard: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '24px',
    border: '1px solid #f0f0eb', marginBottom: '24px',
  },
  formTitle: { fontSize: '16px', fontWeight: '600', color: '#1a1a1a', margin: '0 0 20px' },
  formGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '500', color: '#666' },
  input: {
    padding: '9px 12px', borderRadius: '8px', border: '1px solid #e0e0e0',
    fontSize: '13px', color: '#1a1a1a', outline: 'none', backgroundColor: '#fff',
  },
  formActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  cancelBtn: {
    padding: '9px 16px', borderRadius: '8px', border: '1px solid #e0e0e0',
    backgroundColor: '#fff', color: '#666', fontSize: '13px', cursor: 'pointer',
  },
  saveBtn: {
    padding: '9px 16px', borderRadius: '8px', border: 'none',
    backgroundColor: '#1D9E75', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
  },
  error: {
    padding: '10px 14px', borderRadius: '8px', backgroundColor: '#fff0f0',
    color: '#cc3333', fontSize: '13px', marginBottom: '16px',
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px',
  },
  vendorCard: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '20px',
    border: '1px solid #f0f0eb', cursor: 'pointer',
  },
  vendorTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px',
  },
  avatar: {
    width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#1D9E75',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '16px', fontWeight: '600',
  },
  categoryBadge: {
    padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '500',
    backgroundColor: '#f0f4ff', color: '#4466cc',
  },
  vendorName: { fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '6px' },
  vendorDetail: { fontSize: '12px', color: '#999', marginBottom: '2px' },
  vendorRate: { fontSize: '14px', fontWeight: '600', color: '#1D9E75', marginTop: '8px' },
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '80px 20px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #f0f0eb',
  },
  emptyIcon: { fontSize: '40px', marginBottom: '16px' },
  emptyTitle: { fontSize: '16px', fontWeight: '600', color: '#1a1a1a', margin: '0 0 8px' },
  emptyText: { fontSize: '13px', color: '#999', margin: '0 0 24px' },
  empty: { fontSize: '13px', color: '#999', padding: '40px', textAlign: 'center' },
  detailHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '24px' },
  backBtn: {
    padding: '8px 14px', borderRadius: '8px', border: '1px solid #e0e0e0',
    backgroundColor: '#fff', color: '#555', fontSize: '13px', cursor: 'pointer',
  },
  deleteBtn: {
    padding: '8px 14px', borderRadius: '8px', border: 'none',
    backgroundColor: '#fff0f0', color: '#cc3333', fontSize: '13px', cursor: 'pointer',
  },
  detailCard: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '32px', border: '1px solid #f0f0eb',
  },
  detailTop: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' },
  detailAvatar: {
    width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#1D9E75',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '22px', fontWeight: '700',
  },
  detailName: { fontSize: '22px', fontWeight: '700', color: '#1a1a1a', margin: '0 0 6px' },
  detailGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  detailField: { backgroundColor: '#fafaf8', borderRadius: '8px', padding: '14px 16px' },
  detailFieldLabel: {
    fontSize: '11px', color: '#aaa', fontWeight: '600',
    textTransform: 'uppercase', marginBottom: '4px',
  },
  detailFieldValue: { fontSize: '14px', color: '#1a1a1a' },
  link: { color: '#1D9E75', textDecoration: 'none' },
}