import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import CurrencyInput from '../components/CurrencyInput'

const TYPES = ['Conference', 'Certification', 'Workshop', 'Course', 'Training', 'Webinar', 'Other']
const STATUS_OPTIONS = ['registered', 'in-progress', 'completed', 'cancelled']

const statusStyles = {
  'registered':  { bg: '#F0E8FB', color: '#7B2FBE', label: 'Registered' },
  'in-progress': { bg: '#FEF9EC', color: '#92610A', label: 'In Progress' },
  'completed':   { bg: '#F0FBE0', color: '#3B6D11', label: 'Completed' },
  'cancelled':   { bg: '#F3F3F3', color: '#6B7280', label: 'Cancelled' },
}

const typeIcons = {
  'Conference':   '🎤',
  'Certification':'🏆',
  'Workshop':     '🔧',
  'Course':       '📚',
  'Training':     '💪',
  'Webinar':      '💻',
  'Other':        '📌',
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function ProDev({ workspaceId, userRole, session }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterMember, setFilterMember] = useState('all')
  const [search, setSearch] = useState('')

  const isDirector = ['owner', 'admin'].includes(userRole)

  const [form, setForm] = useState({
    member_name: '',
    title: '',
    type: '',
    provider: '',
    status: 'registered',
    start_date: '',
    end_date: '',
    cost: '',
    notes: '',
    certificate_url: '',
  })

  useEffect(() => {
    if (workspaceId) fetchItems()
  }, [workspaceId])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase
      .from('pro_dev')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  async function saveItem() {
    if (!form.title || !form.member_name || !form.type) return
    const payload = {
      workspace_id: workspaceId,
      user_id: session?.user?.id,
      member_name: form.member_name,
      title: form.title,
      type: form.type,
      provider: form.provider || null,
      status: form.status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      cost: Number(form.cost) || 0,
      notes: form.notes || null,
      certificate_url: form.certificate_url || null,
    }
    if (editingItem) {
      await supabase.from('pro_dev').update(payload).eq('id', editingItem.id)
    } else {
      await supabase.from('pro_dev').insert(payload)
    }
    resetForm()
    fetchItems()
  }

  async function deleteItem(id) {
    await supabase.from('pro_dev').delete().eq('id', id)
    fetchItems()
  }

  async function updateStatus(id, status) {
    await supabase.from('pro_dev').update({ status }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  function startEdit(item) {
    setEditingItem(item)
    setForm({
      member_name: item.member_name,
      title: item.title,
      type: item.type,
      provider: item.provider || '',
      status: item.status,
      start_date: item.start_date || '',
      end_date: item.end_date || '',
      cost: item.cost || '',
      notes: item.notes || '',
      certificate_url: item.certificate_url || '',
    })
    setShowForm(true)
  }

  function resetForm() {
    setForm({ member_name: '', title: '', type: '', provider: '', status: 'registered', start_date: '', end_date: '', cost: '', notes: '', certificate_url: '' })
    setEditingItem(null)
    setShowForm(false)
  }

  // Unique members for filter
  const members = [...new Set(items.map(i => i.member_name))].sort()

  const filtered = items.filter(i => {
    const matchType = filterType === 'all' || i.type === filterType
    const matchStatus = filterStatus === 'all' || i.status === filterStatus
    const matchMember = filterMember === 'all' || i.member_name === filterMember
    const matchSearch = !search || i.title.toLowerCase().includes(search.toLowerCase()) || i.member_name.toLowerCase().includes(search.toLowerCase()) || (i.provider || '').toLowerCase().includes(search.toLowerCase())
    return matchType && matchStatus && matchMember && matchSearch
  })

  // Stats
  const completed = items.filter(i => i.status === 'completed').length
  const inProgress = items.filter(i => i.status === 'in-progress').length
  const totalCost = items.reduce((s, i) => s + Number(i.cost || 0), 0)
  const byMember = members.map(m => ({
    name: m,
    items: items.filter(i => i.member_name === m),
    completed: items.filter(i => i.member_name === m && i.status === 'completed').length,
  }))

  return (
    <div style={{ padding: '32px 40px', fontFamily: t.fonts.sans, maxWidth: '1000px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: t.fontSizes.xs, fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.primary, marginBottom: '6px' }}>Team</div>
          <h1 style={{ fontFamily: t.fonts.heading, fontSize: '28px', fontWeight: '800', color: t.colors.textPrimary, letterSpacing: '-0.02em', margin: 0 }}>
            Professional Development
          </h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{ padding: '9px 18px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}
        >
          + Add Item
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Items', value: items.length },
          { label: 'In Progress', value: inProgress },
          { label: 'Completed', value: completed },
          { label: 'Total Spend', value: fmt(totalCost) },
        ].map(stat => (
          <div key={stat.label} style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '16px 20px' }}>
            <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{stat.label}</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: t.colors.textPrimary, fontFamily: t.fonts.heading }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div style={{ background: t.colors.bgCard, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.lg, padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 20px' }}>
            {editingItem ? 'Edit Item' : 'New Pro Dev Item'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Team Member *</label>
              <input
                value={form.member_name}
                onChange={e => setForm(f => ({ ...f, member_name: e.target.value }))}
                placeholder="e.g. Ostyn McCarty"
                style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }}
              />
            </div>
            <div>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Type *</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }}>
                <option value="">Select type</option>
                {TYPES.map(ty => <option key={ty} value={ty}>{ty}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Title *</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Event Marketer Certification, SXSW 2026"
                style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }}
              />
            </div>
            <div>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Provider / Platform</label>
              <input
                value={form.provider}
                onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                placeholder="e.g. Coursera, NACE, LinkedIn Learning"
                style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }}
              />
            </div>
            <div>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{statusStyles[s].label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Start Date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }} />
            </div>
            <div>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>End Date</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary }} />
            </div>
            <div>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Cost</label>
              <CurrencyInput value={form.cost} onChange={val => setForm(f => ({ ...f, cost: val }))} />
            </div>
            <div>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Certificate URL</label>
              <input
                value={form.certificate_url}
                onChange={e => setForm(f => ({ ...f, certificate_url: e.target.value }))}
                placeholder="Link to certificate or credential"
                style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', color: t.colors.textPrimary }}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, display: 'block', marginBottom: '5px' }}>Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Key takeaways, relevance to role, application to work..."
                rows={2}
                style={{ width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, boxSizing: 'border-box', resize: 'vertical', color: t.colors.textPrimary }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
            <button onClick={saveItem} style={{ padding: '9px 20px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>
              {editingItem ? 'Save Changes' : 'Add Item'}
            </button>
            <button onClick={resetForm} style={{ padding: '9px 20px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          style={{ padding: '7px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary, width: '180px' }}
        />
        {isDirector && members.length > 0 && (
          <select value={filterMember} onChange={e => setFilterMember(e.target.value)} style={{ padding: '7px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.base, fontFamily: t.fonts.sans, color: t.colors.textPrimary, background: t.colors.bgCard }}>
            <option value="all">All Members</option>
            {members.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        <div style={{ display: 'flex', gap: '4px', background: t.colors.bg, borderRadius: t.radius.md, padding: '4px' }}>
          {['all', ...TYPES].map(ty => (
            <button key={ty} onClick={() => setFilterType(ty)} style={{ padding: '4px 12px', borderRadius: t.radius.sm, border: 'none', background: filterType === ty ? t.colors.bgCard : 'transparent', color: filterType === ty ? t.colors.textPrimary : t.colors.textSecondary, fontSize: t.fontSizes.xs, fontFamily: t.fonts.sans, cursor: 'pointer', fontWeight: filterType === ty ? '600' : '400', boxShadow: filterType === ty ? t.shadows.sm : 'none' }}>
              {ty === 'all' ? 'All' : ty}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '4px', background: t.colors.bg, borderRadius: t.radius.md, padding: '4px' }}>
          {['all', ...STATUS_OPTIONS].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '4px 12px', borderRadius: t.radius.sm, border: 'none', background: filterStatus === s ? t.colors.bgCard : 'transparent', color: filterStatus === s ? t.colors.textPrimary : t.colors.textSecondary, fontSize: t.fontSizes.xs, fontFamily: t.fonts.sans, cursor: 'pointer', fontWeight: filterStatus === s ? '600' : '400', boxShadow: filterStatus === s ? t.shadows.sm : 'none' }}>
              {s === 'all' ? 'All' : statusStyles[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Director view — grouped by member */}
      {loading ? (
        <div style={{ color: t.colors.textTertiary, textAlign: 'center', padding: '60px' }}>Loading...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.border}` }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎓</div>
          <div style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, marginBottom: '6px' }}>No pro dev items yet</div>
          <div style={{ fontSize: t.fontSizes.base, color: t.colors.textSecondary, marginBottom: '16px' }}>Start tracking your team's growth — add conferences, certs, and courses.</div>
          <button onClick={() => setShowForm(true)} style={{ padding: '10px 24px', borderRadius: t.radius.md, border: 'none', background: t.colors.primary, color: '#fff', fontSize: t.fontSizes.base, fontWeight: '600', fontFamily: t.fonts.sans, cursor: 'pointer' }}>
            Add First Item
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: t.colors.textSecondary }}>No items match your filters.</div>
      ) : isDirector && filterMember === 'all' && !search ? (
        // Group by member for director view
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {byMember.filter(m => filtered.some(i => i.member_name === m.name)).map(member => (
            <div key={member.name}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: t.colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: t.fontSizes.sm, fontWeight: '700', flexShrink: 0 }}>
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ fontFamily: t.fonts.heading, fontSize: t.fontSizes.lg, fontWeight: '700', color: t.colors.textPrimary }}>{member.name}</div>
                <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>{member.items.length} item{member.items.length !== 1 ? 's' : ''} · {member.completed} completed</div>
                <div style={{ flex: 1, height: '1px', background: t.colors.border }} />
                <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary }}>{fmt(member.items.reduce((s, i) => s + Number(i.cost || 0), 0))}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filtered.filter(i => i.member_name === member.name).map(item => (
                  <ItemRow key={item.id} item={item} onEdit={startEdit} onDelete={deleteItem} onStatusChange={updateStatus} isDirector={isDirector} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Flat list view
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(item => (
            <ItemRow key={item.id} item={item} onEdit={startEdit} onDelete={deleteItem} onStatusChange={updateStatus} isDirector={isDirector} />
          ))}
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, onEdit, onDelete, onStatusChange, isDirector }) {
  const s = statusStyles[item.status] || statusStyles['registered']
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '10px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
      <div style={{ fontSize: '20px', flexShrink: 0 }}>{typeIcons[item.type] || '📌'}</div>
      <div style={{ flex: 1, minWidth: '180px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#0E0E0E' }}>{item.title}</span>
          <span style={{ fontSize: '10px', fontWeight: '500', background: s.bg, color: s.color, padding: '2px 8px', borderRadius: '100px' }}>{s.label}</span>
          <span style={{ fontSize: '10px', color: '#9CA3AF', background: '#F3F3F3', padding: '2px 8px', borderRadius: '100px' }}>{item.type}</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {item.provider && <span style={{ fontSize: '12px', color: '#6B7280' }}>📍 {item.provider}</span>}
          {item.start_date && <span style={{ fontSize: '12px', color: '#6B7280' }}>📅 {new Date(item.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
          {item.cost > 0 && <span style={{ fontSize: '12px', color: '#6B7280' }}>💰 {Number(item.cost).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</span>}
          {isDirector && <span style={{ fontSize: '12px', color: '#9CA3AF' }}>👤 {item.member_name}</span>}
        </div>
        {item.notes && <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px', fontStyle: 'italic' }}>{item.notes}</div>}
      </div>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
        {item.certificate_url && (
          <a href={item.certificate_url} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #E8E8E8', background: 'transparent', color: '#7B2FBE', fontSize: '11px', fontFamily: 'DM Sans, sans-serif', textDecoration: 'none', fontWeight: '500' }}>🏆 Cert</a>
        )}
        <select value={item.status} onChange={e => onStatusChange(item.id, e.target.value)} style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #E8E8E8', fontSize: '11px', fontFamily: 'DM Sans, sans-serif', color: '#0E0E0E', background: '#FFFFFF', cursor: 'pointer' }}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{statusStyles[s].label}</option>)}
        </select>
        <button onClick={() => onEdit(item)} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #E8E8E8', background: 'transparent', color: '#6B7280', fontSize: '11px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>Edit</button>
        <button onClick={() => onDelete(item.id)} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #E8E8E8', background: 'transparent', color: '#EF4444', fontSize: '11px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>Delete</button>
      </div>
    </div>
  )
}
