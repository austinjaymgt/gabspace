import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function ContentCalendar() {
  const [items, setItems] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [view, setView] = useState('calendar')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [form, setForm] = useState({
    title: '',
    platform: '',
    status: 'idea',
    scheduled_date: '',
    notes: '',
    campaign_id: '',
    project_id: '',
    media_url: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({})

  const platforms = [
    'Instagram', 'TikTok', 'Facebook', 'LinkedIn',
    'Email', 'YouTube', 'Pinterest', 'Blog', 'Other'
  ]

  const statuses = [
    { value: 'idea', label: 'Idea', color: '#888', bg: '#f5f5f0' },
    { value: 'in-production', label: 'In Production', color: '#cc7700', bg: '#fff8f0' },
    { value: 'scheduled', label: 'Scheduled', color: '#4466cc', bg: '#f0f4ff' },
    { value: 'published', label: 'Published', color: '#1D9E75', bg: '#f0faf6' },
  ]

  const platformColors = {
    'Instagram': '#E1306C',
    'TikTok': '#000000',
    'Facebook': '#1877F2',
    'LinkedIn': '#0A66C2',
    'Email': '#FF6B35',
    'YouTube': '#FF0000',
    'Pinterest': '#E60023',
    'Blog': '#1D9E75',
    'Other': '#888',
  }

  useEffect(() => {
    fetchItems()
    fetchCampaigns()
    fetchProjects()
  }, [])

  async function fetchItems() {
    setLoading(true)
    const { data, error } = await supabase
      .from('content_calendar')
      .select('*, campaigns(name), projects(title)')
      .order('scheduled_date', { ascending: true })
    if (!error) setItems(data)
    setLoading(false)
  }

  async function fetchCampaigns() {
    const { data } = await supabase.from('campaigns').select('id, name')
    if (data) setCampaigns(data)
  }

  async function fetchProjects() {
    const { data } = await supabase.from('projects').select('id, title')
    if (data) setProjects(data)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('content_calendar').insert({
      title: form.title,
      platform: form.platform || null,
      status: form.status,
      scheduled_date: form.scheduled_date || null,
      notes: form.notes || null,
      campaign_id: form.campaign_id || null,
      project_id: form.project_id || null,
      media_url: form.media_url || null,
      user_id: user.id,
    })
    if (error) setError(error.message)
    else {
      setShowForm(false)
      setForm({ title: '', platform: '', status: 'idea', scheduled_date: '', notes: '', campaign_id: '', project_id: '', media_url: '' })
      fetchItems()
    }
    setSaving(false)
  }

  async function handleUpdate(id, fields) {
    await supabase.from('content_calendar').update(fields).eq('id', id)
    fetchItems()
    setSelectedItem(prev => ({ ...prev, ...fields }))
  }

  async function handleEditSave() {
    await supabase.from('content_calendar').update({
      title: editForm.title,
      platform: editForm.platform || null,
      status: editForm.status,
      scheduled_date: editForm.scheduled_date || null,
      notes: editForm.notes || null,
      media_url: editForm.media_url || null,
      campaign_id: editForm.campaign_id || null,
      project_id: editForm.project_id || null,
    }).eq('id', selectedItem.id)
    fetchItems()
    setSelectedItem(prev => ({ ...prev, ...editForm }))
    setEditMode(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this content item?')) return
    await supabase.from('content_calendar').delete().eq('id', id)
    fetchItems()
    setSelectedItem(null)
  }

  async function updateStatus(id, status) {
    await supabase.from('content_calendar').update({ status }).eq('id', id)
    fetchItems()
    if (selectedItem?.id === id) setSelectedItem({ ...selectedItem, status })
  }

  function getDaysInMonth(date) {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    return { firstDay, daysInMonth }
  }

  function getItemsForDay(day) {
    const year = currentMonth.getFullYear()
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    const dateStr = `${year}-${month}-${dayStr}`
    return items.filter(item => item.scheduled_date === dateStr)
  }

  const { firstDay, daysInMonth } = getDaysInMonth(currentMonth)
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const statusCounts = statuses.map(s => ({
    ...s,
    count: items.filter(i => i.status === s.value).length
  }))

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Content Calendar</h2>
          <p style={styles.subtitle}>{items.length} total content items</p>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.viewToggle}>
            <button onClick={() => setView('calendar')} style={{ ...styles.viewBtn, ...(view === 'calendar' ? styles.viewBtnActive : {}) }}>Calendar</button>
            <button onClick={() => setView('list')} style={{ ...styles.viewBtn, ...(view === 'list' ? styles.viewBtnActive : {}) }}>List</button>
            <button onClick={() => setView('kanban')} style={{ ...styles.viewBtn, ...(view === 'kanban' ? styles.viewBtnActive : {}) }}>Kanban</button>
          </div>
          <button onClick={() => setShowForm(true)} style={styles.addBtn}>+ Add Content</button>
        </div>
      </div>

      <div style={styles.statusRow}>
        {statusCounts.map(s => (
          <div key={s.value} style={styles.statusCard}>
            <div style={{ ...styles.statusDot, backgroundColor: s.color }} />
            <div style={styles.statusInfo}>
              <div style={styles.statusLabel}>{s.label}</div>
              <div style={styles.statusCount}>{s.count}</div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>New Content</h3>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.formGrid}>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Title *</label>
              <input style={styles.input} placeholder="e.g. Spring wedding BTS reel" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Platform</label>
              <select style={styles.input} value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}>
                <option value="">Select platform</option>
                {platforms.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Status</label>
              <select style={styles.input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Scheduled date</label>
              <input style={styles.input} type="date" value={form.scheduled_date} onChange={e => setForm({ ...form, scheduled_date: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Campaign</label>
              <select style={styles.input} value={form.campaign_id} onChange={e => setForm({ ...form, campaign_id: e.target.value })}>
                <option value="">No campaign</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Project</label>
              <select style={styles.input} value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Media link</label>
              <input style={styles.input} placeholder="https://drive.google.com/..." value={form.media_url} onChange={e => setForm({ ...form, media_url: e.target.value })} />
            </div>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Notes</label>
              <input style={styles.input} placeholder="Caption ideas, hashtags, links..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div style={styles.formActions}>
            <button onClick={() => { setShowForm(false); setError(null) }} style={styles.cancelBtn}>Cancel</button>
            <button onClick={handleSave} style={styles.saveBtn} disabled={saving || !form.title}>{saving ? 'Saving...' : 'Save Content'}</button>
          </div>
        </div>
      )}

      {selectedItem && (
        <div style={styles.detailOverlay} onClick={() => { setSelectedItem(null); setEditMode(false) }}>
          <div style={styles.detailPanel} onClick={e => e.stopPropagation()}>
            <div style={styles.detailPanelHeader}>
              {editMode ? (
                <input
                  style={{ ...styles.input, fontSize: '16px', fontWeight: '700', flex: 1, marginRight: '12px' }}
                  value={editForm.title || ''}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                />
              ) : (
                <h3 style={styles.detailPanelTitle}>{selectedItem.title}</h3>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                {!editMode && (
                  <button onClick={() => { setEditMode(true); setEditForm({ ...selectedItem }) }} style={styles.editBtn}>
                    Edit
                  </button>
                )}
                <button onClick={() => { setSelectedItem(null); setEditMode(false) }} style={styles.closeBtn}>✕</button>
              </div>
            </div>

            {editMode ? (
              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Platform</label>
                  <select style={styles.input} value={editForm.platform || ''} onChange={e => setEditForm({ ...editForm, platform: e.target.value })}>
                    <option value="">No platform</option>
                    {platforms.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Status</label>
                  <select style={styles.input} value={editForm.status || 'idea'} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                    {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Scheduled date</label>
                  <input style={styles.input} type="date" value={editForm.scheduled_date || ''} onChange={e => setEditForm({ ...editForm, scheduled_date: e.target.value })} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Campaign</label>
                  <select style={styles.input} value={editForm.campaign_id || ''} onChange={e => setEditForm({ ...editForm, campaign_id: e.target.value })}>
                    <option value="">No campaign</option>
                    {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ ...styles.field, gridColumn: 'span 2' }}>
                  <label style={styles.label}>Media link</label>
                  <input style={styles.input} placeholder="https://..." value={editForm.media_url || ''} onChange={e => setEditForm({ ...editForm, media_url: e.target.value })} />
                </div>
                <div style={{ ...styles.field, gridColumn: 'span 2' }}>
                  <label style={styles.label}>Notes</label>
                  <textarea style={{ ...styles.input, resize: 'vertical', fontFamily: 'sans-serif' }} rows={3} value={editForm.notes || ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
                </div>
                <div style={{ ...styles.formActions, gridColumn: 'span 2' }}>
                  <button onClick={() => setEditMode(false)} style={styles.cancelBtn}>Cancel</button>
                  <button onClick={handleEditSave} style={styles.saveBtn}>Save changes</button>
                </div>
              </div>
            ) : (
              <>
                {selectedItem.platform && (
                  <div style={{
                    ...styles.platformTag,
                    backgroundColor: platformColors[selectedItem.platform] + '20',
                    color: platformColors[selectedItem.platform],
                  }}>
                    {selectedItem.platform}
                  </div>
                )}
                <div style={styles.statusButtons}>
                  {statuses.map(s => (
                    <button
                      key={s.value}
                      onClick={() => updateStatus(selectedItem.id, s.value)}
                      style={{
                        ...styles.statusBtn,
                        backgroundColor: selectedItem.status === s.value ? s.bg : '#fff',
                        color: selectedItem.status === s.value ? s.color : '#888',
                        border: `1px solid ${selectedItem.status === s.value ? s.color : '#e0e0e0'}`,
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {selectedItem.scheduled_date && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailRowLabel}>📅 Scheduled</span>
                    <span style={styles.detailRowValue}>
                      {new Date(selectedItem.scheduled_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                )}
                {selectedItem.campaigns && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailRowLabel}>📣 Campaign</span>
                    <span style={styles.detailRowValue}>{selectedItem.campaigns.name}</span>
                  </div>
                )}
                {selectedItem.projects && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailRowLabel}>📋 Project</span>
                    <span style={styles.detailRowValue}>{selectedItem.projects.title}</span>
                  </div>
                )}
                {selectedItem.media_url && (
                  <a href={selectedItem.media_url} target="_blank" rel="noopener noreferrer" style={styles.mediaLink}>
                    🔗 View media
                  </a>
                )}
                <div style={styles.detailNotes}>
                  <div style={styles.detailRowLabel}>Notes</div>
                  <textarea
                    style={{ ...styles.input, resize: 'vertical', fontFamily: 'sans-serif', marginTop: '6px', width: '100%', boxSizing: 'border-box' }}
                    rows={3}
                    value={selectedItem.notes || ''}
                    onChange={e => setSelectedItem({ ...selectedItem, notes: e.target.value })}
                    onBlur={e => handleUpdate(selectedItem.id, { notes: e.target.value })}
                    placeholder="Add notes..."
                  />
                </div>
              </>
            )}

            <button onClick={() => handleDelete(selectedItem.id)} style={styles.deleteBtnFull}>
              Delete content
            </button>
          </div>
        </div>
      )}

      {view === 'calendar' && (
        <div style={styles.calendarCard}>
          <div style={styles.calendarNav}>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} style={styles.navBtn}>←</button>
            <h3 style={styles.monthTitle}>{monthName}</h3>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} style={styles.navBtn}>→</button>
          </div>
          <div style={styles.calendarGrid}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} style={styles.dayHeader}>{d}</div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} style={styles.emptyDay} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayItems = getItemsForDay(day)
              const isToday = new Date().getDate() === day &&
                new Date().getMonth() === currentMonth.getMonth() &&
                new Date().getFullYear() === currentMonth.getFullYear()
              return (
                <div key={day} style={{ ...styles.dayCell, ...(isToday ? styles.todayCell : {}) }}>
                  <div style={{ ...styles.dayNumber, ...(isToday ? styles.todayNumber : {}) }}>{day}</div>
                  {dayItems.map(item => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      style={{
                        ...styles.calendarItem,
                        backgroundColor: item.platform ? platformColors[item.platform] + '20' : '#f0faf6',
                        borderLeft: `3px solid ${item.platform ? platformColors[item.platform] : '#1D9E75'}`,
                      }}
                    >
                      {item.title}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {view === 'list' && (
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span>Title</span>
            <span>Platform</span>
            <span>Status</span>
            <span>Date</span>
            <span>Campaign</span>
            <span></span>
          </div>
          {items.length === 0 ? (
            <div style={styles.emptyList}>No content yet — add your first item!</div>
          ) : items.map(item => {
            const s = statuses.find(s => s.value === item.status) || statuses[0]
            return (
              <div key={item.id} style={styles.tableRow} onClick={() => setSelectedItem(item)}>
                <span style={styles.itemTitle}>{item.title}</span>
                <span style={styles.tableCell}>
                  {item.platform ? (
                    <span style={{ ...styles.platformPill, backgroundColor: platformColors[item.platform] + '20', color: platformColors[item.platform] }}>
                      {item.platform}
                    </span>
                  ) : '—'}
                </span>
                <span>
                  <span style={{ ...styles.statusPill, backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                </span>
                <span style={styles.tableCell}>{item.scheduled_date ? new Date(item.scheduled_date).toLocaleDateString() : '—'}</span>
                <span style={styles.tableCell}>{item.campaigns ? item.campaigns.name : '—'}</span>
                <span style={styles.tableCell}>→</span>
              </div>
            )
          })}
        </div>
      )}

      {view === 'kanban' && (
        <div style={styles.kanban}>
          {statuses.map(s => (
            <div key={s.value} style={styles.kanbanCol}>
              <div style={styles.kanbanColHeader}>
                <div style={{ ...styles.kanbanDot, backgroundColor: s.color }} />
                <span style={styles.kanbanColTitle}>{s.label}</span>
                <span style={styles.kanbanCount}>{items.filter(i => i.status === s.value).length}</span>
              </div>
              <div style={styles.kanbanItems}>
                {items.filter(i => i.status === s.value).map(item => (
                  <div key={item.id} style={styles.kanbanCard} onClick={() => setSelectedItem(item)}>
                    {item.platform && (
                      <div style={{ ...styles.kanbanPlatform, backgroundColor: platformColors[item.platform] + '20', color: platformColors[item.platform] }}>
                        {item.platform}
                      </div>
                    )}
                    <div style={styles.kanbanCardTitle}>{item.title}</div>
                    {item.scheduled_date && <div style={styles.kanbanDate}>📅 {new Date(item.scheduled_date).toLocaleDateString()}</div>}
                    {item.campaigns && <div style={styles.kanbanCampaign}>📣 {item.campaigns.name}</div>}
                  </div>
                ))}
                {items.filter(i => i.status === s.value).length === 0 && (
                  <div style={styles.kanbanEmpty}>No items</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  page: { padding: '32px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  title: { fontSize: '20px', fontWeight: '700', color: '#1a1a1a', margin: 0 },
  subtitle: { fontSize: '13px', color: '#999', margin: '4px 0 0' },
  headerRight: { display: 'flex', gap: '12px', alignItems: 'center' },
  viewToggle: { display: 'flex', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' },
  viewBtn: { padding: '8px 14px', border: 'none', backgroundColor: '#fff', color: '#666', fontSize: '13px', cursor: 'pointer' },
  viewBtnActive: { backgroundColor: '#1D9E75', color: '#fff' },
  addBtn: { padding: '10px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#1D9E75', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  statusRow: { display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' },
  statusCard: { backgroundColor: '#fff', borderRadius: '10px', padding: '14px 18px', border: '1px solid #f0f0eb', display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '120px' },
  statusDot: { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  statusInfo: {},
  statusLabel: { fontSize: '11px', color: '#999', marginBottom: '2px' },
  statusCount: { fontSize: '20px', fontWeight: '700', color: '#1a1a1a' },
  formCard: { backgroundColor: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #f0f0eb', marginBottom: '24px' },
  formTitle: { fontSize: '16px', fontWeight: '600', color: '#1a1a1a', margin: '0 0 20px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '500', color: '#666' },
  input: { padding: '9px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '13px', color: '#1a1a1a', outline: 'none', backgroundColor: '#fff' },
  formActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  cancelBtn: { padding: '9px 16px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff', color: '#666', fontSize: '13px', cursor: 'pointer' },
  saveBtn: { padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#1D9E75', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  error: { padding: '10px 14px', borderRadius: '8px', backgroundColor: '#fff0f0', color: '#cc3333', fontSize: '13px', marginBottom: '16px' },
  calendarCard: { backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #f0f0eb', overflow: 'hidden' },
  calendarNav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f0f0eb' },
  monthTitle: { fontSize: '16px', fontWeight: '600', color: '#1a1a1a', margin: 0 },
  navBtn: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #e0e0e0', backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px' },
  calendarGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' },
  dayHeader: { padding: '10px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#999', textTransform: 'uppercase', borderBottom: '1px solid #f0f0eb' },
  emptyDay: { borderRight: '1px solid #f9f9f7', borderBottom: '1px solid #f9f9f7', minHeight: '80px' },
  dayCell: { borderRight: '1px solid #f9f9f7', borderBottom: '1px solid #f9f9f7', minHeight: '80px', padding: '6px' },
  todayCell: { backgroundColor: '#f0faf6' },
  dayNumber: { fontSize: '12px', fontWeight: '500', color: '#999', marginBottom: '4px' },
  todayNumber: { color: '#1D9E75', fontWeight: '700' },
  calendarItem: { fontSize: '10px', padding: '2px 5px', borderRadius: '3px', marginBottom: '2px', cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: '#333' },
  detailOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  detailPanel: { backgroundColor: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '90vh', overflowY: 'auto' },
  detailPanelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  detailPanelTitle: { fontSize: '18px', fontWeight: '700', color: '#1a1a1a', margin: 0, flex: 1, paddingRight: '12px' },
  editBtn: { padding: '6px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff', color: '#555', fontSize: '12px', cursor: 'pointer' },
  closeBtn: { background: 'none', border: 'none', fontSize: '16px', color: '#aaa', cursor: 'pointer', padding: '2px' },
  platformTag: { display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', alignSelf: 'flex-start' },
  statusButtons: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  statusBtn: { padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' },
  detailRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#fafaf8', borderRadius: '8px' },
  detailRowLabel: { fontSize: '12px', color: '#888' },
  detailRowValue: { fontSize: '13px', fontWeight: '500', color: '#1a1a1a' },
  detailNotes: { backgroundColor: '#fafaf8', borderRadius: '8px', padding: '12px 14px' },
  detailNotesText: { fontSize: '13px', color: '#555', margin: '6px 0 0', lineHeight: '1.5' },
  mediaLink: { display: 'inline-block', padding: '8px 14px', borderRadius: '8px', backgroundColor: '#f0f4ff', color: '#4466cc', fontSize: '13px', fontWeight: '500', textDecoration: 'none' },
  deleteBtnFull: { padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#fff0f0', color: '#cc3333', fontSize: '13px', cursor: 'pointer', width: '100%' },
  table: { backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #f0f0eb', overflow: 'hidden' },
  tableHeader: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr 0.3fr', padding: '12px 20px', backgroundColor: '#fafaf8', borderBottom: '1px solid #f0f0eb', fontSize: '12px', fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' },
  tableRow: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr 0.3fr', padding: '14px 20px', borderBottom: '1px solid #f9f9f7', alignItems: 'center', cursor: 'pointer' },
  itemTitle: { fontSize: '13px', fontWeight: '500', color: '#1a1a1a' },
  tableCell: { fontSize: '13px', color: '#666' },
  platformPill: { display: 'inline-block', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' },
  statusPill: { display: 'inline-block', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' },
  emptyList: { padding: '40px', textAlign: 'center', fontSize: '13px', color: '#bbb' },
  kanban: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', alignItems: 'start' },
  kanbanCol: { backgroundColor: '#fafaf8', borderRadius: '12px', padding: '16px', border: '1px solid #f0f0eb' },
  kanbanColHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' },
  kanbanDot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  kanbanColTitle: { fontSize: '13px', fontWeight: '600', color: '#1a1a1a', flex: 1 },
  kanbanCount: { fontSize: '12px', color: '#aaa', backgroundColor: '#fff', padding: '2px 7px', borderRadius: '10px', border: '1px solid #f0f0eb' },
  kanbanItems: { display: 'flex', flexDirection: 'column', gap: '8px' },
  kanbanCard: { backgroundColor: '#fff', borderRadius: '8px', padding: '12px', border: '1px solid #f0f0eb', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px' },
  kanbanPlatform: { display: 'inline-block', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '600', alignSelf: 'flex-start' },
  kanbanCardTitle: { fontSize: '13px', fontWeight: '500', color: '#1a1a1a' },
  kanbanDate: { fontSize: '11px', color: '#aaa' },
  kanbanCampaign: { fontSize: '11px', color: '#aaa' },
  kanbanEmpty: { fontSize: '12px', color: '#ccc', textAlign: 'center', padding: '20px 0' },
}