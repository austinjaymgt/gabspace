// src/components/events/RunOfShow.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(timeStr) {
  if (!timeStr) return '—'
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${m} ${ampm}`
}

const btnStyles = {
  primary:   { padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#7C5CBF', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' },
  secondary: { padding: '7px 14px', borderRadius: '8px', border: '1px solid #f0f0eb', backgroundColor: '#fff', color: '#3D3D5C', fontSize: '13px', fontWeight: '500', cursor: 'pointer' },
  cancel:    { padding: '9px 16px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff', color: '#666', fontSize: '13px', cursor: 'pointer' },
}

const fStyles = {
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '500', color: '#666' },
  input: { padding: '9px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '13px', color: '#1A1A2E', outline: 'none', backgroundColor: '#fff' },
}

export default function RunOfShow({ eventId, eventTitle, eventDate, venue }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', start_time: '', end_time: '', role_label: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase.from('run_of_show').select('*').eq('project_id', eventId).order('start_time', { ascending: true })
    setItems(data || [])
    setLoading(false)
  }

  async function addItem() {
    if (!form.title || !form.start_time || !form.end_time) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('run_of_show').insert({
      project_id: eventId, user_id: user.id,
      title: form.title, start_time: form.start_time, end_time: form.end_time,
      role_label: form.role_label || null, notes: form.notes || null,
    }).select().single()
    if (data) setItems(prev => [...prev, data].sort((a, b) => a.start_time.localeCompare(b.start_time)))
    setForm({ title: '', start_time: '', end_time: '', role_label: '', notes: '' })
    setShowForm(false)
    setSaving(false)
  }

  async function deleteItem(id) {
    if (!confirm('Remove this item?')) return
    await supabase.from('run_of_show').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function handlePrint() {
    const printWindow = window.open('', '_blank')
    const rows = items.map(item => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f0f0eb;white-space:nowrap;font-weight:600;color:#7C5CBF;">${formatTime(item.start_time)} → ${formatTime(item.end_time)}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #f0f0eb;font-weight:600;color:#1A1A2E;">${item.title}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #f0f0eb;">${item.role_label ? `<span style="background:#F0EBF9;color:#7C5CBF;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">${item.role_label}</span>` : ''}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #f0f0eb;color:#8585A0;font-size:13px;">${item.notes || ''}</td>
      </tr>`).join('')
    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>Run of Show — ${eventTitle}</title>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
      <style>* { box-sizing:border-box; margin:0; padding:0; } body { font-family:'DM Sans',sans-serif; color:#1A1A2E; background:#fff; padding:48px; } @media print { body { padding:24px; } }</style>
    </head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #1A1A2E;">
        <div>
          <div style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#8585A0;margin-bottom:6px;">Run of Show</div>
          <h1 style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:#1A1A2E;letter-spacing:-0.5px;margin-bottom:4px;">${eventTitle}</h1>
          <div style="font-size:14px;color:#8585A0;">${eventDate ? formatDate(eventDate) : ''}${venue ? ` · ${venue}` : ''}</div>
        </div>
        <div style="background:linear-gradient(135deg,#7C5CBF,#6B8F71);padding:8px 16px;border-radius:10px;color:white;font-family:'Syne',sans-serif;font-weight:800;font-size:16px;">gabspace</div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#fafaf8;">
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#8585A0;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #f0f0eb;">Time</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#8585A0;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #f0f0eb;">Item</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#8585A0;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #f0f0eb;">Owner</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#8585A0;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #f0f0eb;">Notes</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #f0f0eb;font-size:11px;color:#8585A0;text-align:center;">Generated by gabspace · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      <script>window.onload = () => window.print()<\/script>
    </body></html>`)
    printWindow.document.close()
  }

  function handleShare() {
    const shareUrl = `${window.location.origin}/run-of-show.html?event=${eventId}`
    navigator.clipboard.writeText(shareUrl).then(() => alert('Share link copied!\n\nDeploy run-of-show.html to your public folder to activate.'))
  }

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '14px', padding: '24px', border: '1px solid #f0f0eb', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1A1A2E', margin: 0, fontFamily: 'Syne, sans-serif' }}>Run of Show</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {items.length > 0 && <>
            <button onClick={handlePrint} style={btnStyles.secondary}>🖨 Print</button>
            <button onClick={handleShare} style={btnStyles.secondary}>🔗 Share</button>
          </>}
          <button onClick={() => setShowForm(true)} style={btnStyles.secondary}>+ Add item</button>
        </div>
      </div>

      {showForm && (
        <div style={{ backgroundColor: '#fafaf8', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div style={{ ...fStyles.field, gridColumn: 'span 2' }}>
              <label style={fStyles.label}>Item title *</label>
              <input style={fStyles.input} placeholder="e.g. Guest Arrival, Dinner Service, Speeches" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div style={fStyles.field}>
              <label style={fStyles.label}>Start time *</label>
              <input style={fStyles.input} type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div style={fStyles.field}>
              <label style={fStyles.label}>End time *</label>
              <input style={fStyles.input} type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
            </div>
            <div style={fStyles.field}>
              <label style={fStyles.label}>Owner / Role</label>
              <input style={fStyles.input} placeholder="e.g. AV Team, Catering, Director" value={form.role_label} onChange={e => setForm({ ...form, role_label: e.target.value })} />
            </div>
            <div style={fStyles.field}>
              <label style={fStyles.label}>Notes</label>
              <input style={fStyles.input} placeholder="Any details or reminders" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={btnStyles.cancel}>Cancel</button>
            <button onClick={addItem} disabled={saving || !form.title || !form.start_time || !form.end_time} style={btnStyles.primary}>{saving ? 'Adding...' : 'Add item'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: '13px', color: '#8585A0', textAlign: 'center', padding: '20px 0' }}>Loading...</p>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>🕐</div>
          <p style={{ fontSize: '13px', color: '#8585A0', margin: 0 }}>No items yet — add your first timeline entry</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map((item, index) => (
            <div key={item.id} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: '14px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#7C5CBF', flexShrink: 0 }} />
                {index < items.length - 1 && <div style={{ width: '2px', flex: 1, minHeight: '24px', backgroundColor: '#f0f0eb', margin: '4px 0' }} />}
              </div>
              <div style={{ flex: 1, paddingBottom: index < items.length - 1 ? '8px' : '0', paddingTop: '8px' }}>
                <div style={{ backgroundColor: '#fafaf8', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: item.notes ? '4px' : '0' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#7C5CBF', whiteSpace: 'nowrap' }}>{formatTime(item.start_time)} → {formatTime(item.end_time)}</span>
                      {item.role_label && <span style={{ fontSize: '11px', fontWeight: '600', backgroundColor: '#F0EBF9', color: '#7C5CBF', padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap' }}>{item.role_label}</span>}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1A2E' }}>{item.title}</div>
                    {item.notes && <div style={{ fontSize: '12px', color: '#8585A0', marginTop: '3px' }}>{item.notes}</div>}
                  </div>
                  <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#8585A0', flexShrink: 0 }}>✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}