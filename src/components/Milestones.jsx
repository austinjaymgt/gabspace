// src/components/Milestones.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

const STATUSES = {
  upcoming:    { label: 'Upcoming',    color: '#8585A0', bg: '#F0EBF9' },
  in_progress: { label: 'In progress', color: '#D4874E', bg: '#FBF0E6' },
  done:        { label: 'Done',        color: '#1D9E75', bg: '#f0faf6' },
}

const btnStyles = {
  primary: { padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#7C5CBF', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' },
  secondary: { padding: '7px 14px', borderRadius: '8px', border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: '13px', fontWeight: '500', cursor: 'pointer' },
  cancel: { padding: '9px 16px', borderRadius: '8px', border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: '13px', cursor: 'pointer' },
}

const fStyles = {
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '500', color: t.colors.textSecondary },
  input: { padding: '9px 12px', borderRadius: '8px', border: `1px solid ${t.colors.border}`, fontSize: '13px', color: t.colors.textPrimary, outline: 'none', backgroundColor: t.colors.bgCard },
}

const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: t.colors.textTertiary, padding: '4px' }

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(String(dateStr).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Milestones({ projectId, businessSpaceId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', target_date: '' })
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState({ title: '', target_date: '' })

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase.from('project_milestones').select('*').eq('project_id', projectId).order('target_date', { ascending: true, nullsFirst: false })
    setItems(data || [])
    setLoading(false)
  }

  async function addItem() {
    if (!form.title.trim()) return
    setSaving(true)
    const { data: newItem, error } = await supabase.from('project_milestones').insert({
      project_id: projectId,
      business_space_id: businessSpaceId,
      title: form.title,
      target_date: form.target_date || null,
    }).select().single()
    if (error) { console.error('Milestone insert failed:', error); setSaving(false); return }
    if (newItem) setItems(prev => [...prev, newItem])
    setForm({ title: '', target_date: '' })
    setShowForm(false)
    setSaving(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('project_milestones').update({ status }).eq('id', id)
    setItems(prev => prev.map(m => m.id === id ? { ...m, status } : m))
  }

  function startEdit(m) {
    setEditingId(m.id)
    setEditDraft({ title: m.title, target_date: m.target_date ? String(m.target_date).slice(0, 10) : '' })
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(id) {
    if (!editDraft.title.trim()) return
    const updates = { title: editDraft.title.trim(), target_date: editDraft.target_date || null }
    await supabase.from('project_milestones').update(updates).eq('id', id)
    setItems(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m))
    setEditingId(null)
  }

  async function togglePortal(id, current) {
    await supabase.from('project_milestones').update({ show_in_portal: !current }).eq('id', id)
    setItems(prev => prev.map(m => m.id === id ? { ...m, show_in_portal: !current } : m))
  }

  async function deleteItem(id) {
    if (!confirm('Remove this milestone?')) return
    await supabase.from('project_milestones').delete().eq('id', id)
    setItems(prev => prev.filter(m => m.id !== id))
  }

  const done = items.filter(m => m.status === 'done').length

  return (
    <div style={{ backgroundColor: t.colors.bgCard, borderRadius: '14px', padding: '24px', border: `1px solid ${t.colors.borderLight}`, marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: t.colors.textPrimary, margin: 0, fontFamily: 'Syne, sans-serif' }}>Milestones</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {items.length > 0 && <span style={{ fontSize: '13px', color: t.colors.textTertiary }}>{done}/{items.length} done</span>}
          <button onClick={() => setShowForm(true)} style={btnStyles.secondary}>+ Add milestone</button>
        </div>
      </div>

      {items.length > 0 && (
        <div style={{ height: '4px', backgroundColor: t.colors.borderLight, borderRadius: '2px', overflow: 'hidden', marginBottom: '16px' }}>
          <div style={{ height: '100%', width: `${(done / items.length) * 100}%`, backgroundColor: '#7C5CBF', borderRadius: '2px', transition: 'width 0.3s' }} />
        </div>
      )}

      {showForm && (
        <div style={{ backgroundColor: t.colors.bgHover, borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div style={fStyles.field}>
              <label style={fStyles.label}>Milestone *</label>
              <input style={fStyles.input} placeholder="e.g. Deposit received, Contract signed, Final delivery" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div style={fStyles.field}>
              <label style={fStyles.label}>Target date</label>
              <input style={fStyles.input} type="date" value={form.target_date} onChange={e => setForm({ ...form, target_date: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={btnStyles.cancel}>Cancel</button>
            <button onClick={addItem} disabled={saving || !form.title.trim()} style={btnStyles.primary}>{saving ? 'Adding...' : 'Add'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: '13px', color: t.colors.textTertiary, textAlign: 'center', padding: '20px 0' }}>Loading...</p>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>🎯</div>
          <p style={{ fontSize: '13px', color: t.colors.textTertiary, margin: 0 }}>No milestones yet — map out the key moments</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {items.map(m => {
            const st = STATUSES[m.status] || STATUSES.upcoming
            const isEditing = editingId === m.id
            return (
              <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto auto', gap: '8px', padding: '10px 12px', backgroundColor: m.show_in_portal ? t.colors.primaryLight : t.colors.bgHover, borderRadius: '8px', alignItems: 'center', border: m.show_in_portal ? `1px solid ${t.colors.primary}` : '1px solid transparent', transition: 'background 0.15s' }}>
                {isEditing ? (
                  <input
                    autoFocus
                    value={editDraft.title}
                    onChange={e => setEditDraft({ ...editDraft, title: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(m.id); if (e.key === 'Escape') cancelEdit() }}
                    style={{ fontSize: '13px', fontWeight: '600', color: t.colors.textPrimary, border: `1px solid ${t.colors.border}`, borderRadius: '6px', padding: '4px 6px', backgroundColor: t.colors.bgCard, fontFamily: 'DM Sans, sans-serif', outline: 'none', width: '100%' }}
                  />
                ) : (
                  <span style={{ fontSize: '13px', fontWeight: '600', color: t.colors.textPrimary, textDecoration: m.status === 'done' ? 'line-through' : 'none' }}>{m.title}</span>
                )}
                {isEditing ? (
                  <input
                    type="date"
                    value={editDraft.target_date}
                    onChange={e => setEditDraft({ ...editDraft, target_date: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(m.id); if (e.key === 'Escape') cancelEdit() }}
                    style={{ fontSize: '12px', color: t.colors.textSecondary, border: `1px solid ${t.colors.border}`, borderRadius: '6px', padding: '4px 6px', backgroundColor: t.colors.bgCard, outline: 'none', fontFamily: 'DM Sans, sans-serif' }}
                  />
                ) : (
                  <span style={{ fontSize: '12px', color: m.target_date ? t.colors.textSecondary : t.colors.textTertiary, fontStyle: m.target_date ? 'normal' : 'italic' }}>
                    {formatDate(m.target_date) || 'No date'}
                  </span>
                )}
                <select value={m.status} onChange={e => updateStatus(m.id, e.target.value)} style={{ padding: '4px 8px', borderRadius: '20px', border: 'none', fontSize: '11px', fontWeight: '600', backgroundColor: st.bg, color: st.color, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                  <option value="upcoming">Upcoming</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={!!m.show_in_portal}
                    onChange={() => togglePortal(m.id, !!m.show_in_portal)}
                    style={{ accentColor: '#7F5793', width: 14, height: 14, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '11px', color: m.show_in_portal ? '#7F5793' : t.colors.textTertiary, fontWeight: m.show_in_portal ? 600 : 400 }}>Portal</span>
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {isEditing ? (
                    <>
                      <button onClick={() => saveEdit(m.id)} disabled={!editDraft.title.trim()} style={{ ...iconBtn, color: '#1D9E75' }} title="Save">✓</button>
                      <button onClick={cancelEdit} style={iconBtn} title="Cancel">✕</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(m)} style={iconBtn} title="Edit">✎</button>
                      <button onClick={() => deleteItem(m.id)} style={iconBtn} title="Delete">✕</button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}