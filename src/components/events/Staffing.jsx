// src/components/events/Staffing.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'

const STAFF_STATUSES = {
  confirmed:  { label: 'Confirmed',  color: '#1D9E75', bg: '#f0faf6' },
  tentative:  { label: 'Tentative',  color: '#D4874E', bg: '#FBF0E6' },
  needed:     { label: 'Needed',     color: '#8585A0', bg: '#F0EBF9' },
}

const btnStyles = {
  primary: { padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#7C5CBF', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' },
  secondary: { padding: '7px 14px', borderRadius: '8px', border: '1px solid #f0f0eb', backgroundColor: '#fff', color: '#3D3D5C', fontSize: '13px', fontWeight: '500', cursor: 'pointer' },
  cancel: { padding: '9px 16px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff', color: '#666', fontSize: '13px', cursor: 'pointer' },
}

const fStyles = {
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '500', color: '#666' },
  input: { padding: '9px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '13px', color: '#1A1A2E', outline: 'none', backgroundColor: '#fff' },
}

export default function Staffing({ eventId }) {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ role: '', person_name: '', status: 'needed', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchStaff() }, [])

  async function fetchStaff() {
    setLoading(true)
    const { data } = await supabase.from('event_staffing').select('*').eq('project_id', eventId).order('created_at', { ascending: true })
    setStaff(data || [])
    setLoading(false)
  }

  async function addStaff() {
    if (!form.role) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('event_staffing').insert({
      project_id: eventId, user_id: user.id,
      role: form.role, person_name: form.person_name || null,
      status: form.status, notes: form.notes || null,
    }).select().single()
    if (data) setStaff(prev => [...prev, data])
    setForm({ role: '', person_name: '', status: 'needed', notes: '' })
    setShowForm(false)
    setSaving(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('event_staffing').update({ status }).eq('id', id)
    setStaff(prev => prev.map(s => s.id === id ? { ...s, status } : s))
  }

  async function deleteStaff(id) {
    if (!confirm('Remove this staff slot?')) return
    await supabase.from('event_staffing').delete().eq('id', id)
    setStaff(prev => prev.filter(s => s.id !== id))
  }

  const confirmed = staff.filter(s => s.status === 'confirmed').length
  const tentative = staff.filter(s => s.status === 'tentative').length
  const needed = staff.filter(s => s.status === 'needed').length

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '14px', padding: '24px', border: '1px solid #f0f0eb', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: staff.length > 0 ? '10px' : '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1A1A2E', margin: 0, fontFamily: 'Syne, sans-serif' }}>Staffing</h3>
        <button onClick={() => setShowForm(true)} style={btnStyles.secondary}>+ Add staff</button>
      </div>

      {staff.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {[
            { label: `${confirmed} confirmed`, color: '#1D9E75', bg: '#f0faf6' },
            { label: `${tentative} tentative`, color: '#D4874E', bg: '#FBF0E6' },
            { label: `${needed} needed`, color: '#8585A0', bg: '#F0EBF9' },
          ].map(p => (
            <span key={p.label} style={{ fontSize: '11px', fontWeight: '600', color: p.color, backgroundColor: p.bg, padding: '3px 10px', borderRadius: '20px' }}>{p.label}</span>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ backgroundColor: '#fafaf8', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div style={fStyles.field}>
              <label style={fStyles.label}>Role *</label>
              <input style={fStyles.input} placeholder="e.g. Event Coordinator, AV Tech, Greeter" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} />
            </div>
            <div style={fStyles.field}>
              <label style={fStyles.label}>Person's name</label>
              <input style={fStyles.input} placeholder="Name (optional if TBD)" value={form.person_name} onChange={e => setForm({ ...form, person_name: e.target.value })} />
            </div>
            <div style={fStyles.field}>
              <label style={fStyles.label}>Status</label>
              <select style={fStyles.input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="needed">Needed</option>
                <option value="tentative">Tentative</option>
                <option value="confirmed">Confirmed</option>
              </select>
            </div>
            <div style={fStyles.field}>
              <label style={fStyles.label}>Notes</label>
              <input style={fStyles.input} placeholder="Any details" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={btnStyles.cancel}>Cancel</button>
            <button onClick={addStaff} disabled={saving || !form.role} style={btnStyles.primary}>{saving ? 'Adding...' : 'Add'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: '13px', color: '#8585A0', textAlign: 'center', padding: '20px 0' }}>Loading...</p>
      ) : staff.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>👥</div>
          <p style={{ fontSize: '13px', color: '#8585A0', margin: 0 }}>No staff added yet — build your event roster</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 0.3fr', gap: '8px', padding: '6px 12px' }}>
            {['Role', 'Person', 'Status', ''].map(h => (
              <span key={h} style={{ fontSize: '11px', fontWeight: '600', color: '#8585A0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</span>
            ))}
          </div>
          {staff.map(s => {
            const st = STAFF_STATUSES[s.status]
            return (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 0.3fr', gap: '8px', padding: '10px 12px', backgroundColor: '#fafaf8', borderRadius: '8px', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1A2E' }}>{s.role}</div>
                  {s.notes && <div style={{ fontSize: '11px', color: '#8585A0' }}>{s.notes}</div>}
                </div>
                <span style={{ fontSize: '13px', color: s.person_name ? '#3D3D5C' : '#B0B0C0', fontStyle: s.person_name ? 'normal' : 'italic' }}>
                  {s.person_name || 'TBD'}
                </span>
                <select value={s.status} onChange={e => updateStatus(s.id, e.target.value)} style={{ padding: '4px 8px', borderRadius: '20px', border: 'none', fontSize: '11px', fontWeight: '600', backgroundColor: st.bg, color: st.color, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                  <option value="needed">Needed</option>
                  <option value="tentative">Tentative</option>
                  <option value="confirmed">Confirmed</option>
                </select>
                <button onClick={() => deleteStaff(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#8585A0' }}>✕</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}