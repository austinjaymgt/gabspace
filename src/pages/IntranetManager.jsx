import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

const TAGS = ['Leadership', 'HR', 'Benefits', 'New Policy', 'Culture', 'Operations', 'General']

export default function IntranetManager({ workspaceId, userRole }) {
  const [activeTab, setActiveTab] = useState('announcements')

  // Announcements
  const [announcements, setAnnouncements] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ title: '', body: '', tag: 'General', published_at: new Date().toISOString().split('T')[0] })
  const [saving, setSaving] = useState(false)

  // Config (galleries, channels, links, spotlight)
  const [config, setConfig] = useState({})
  const [configLoading, setConfigLoading] = useState(true)

  // Spotlight form
  const [spotlightForm, setSpotlightForm] = useState({ name: '', role: '', quote: '' })
  const [spotlightSaving, setSpotlightSaving] = useState(false)

  // Gallery form
  const [showGalleryForm, setShowGalleryForm] = useState(false)
  const [galleryForm, setGalleryForm] = useState({ name: '', platform: 'Pixieset', count: '', url: '' })
  const [editingGalleryIdx, setEditingGalleryIdx] = useState(null)

  // Channel form
  const [showChannelForm, setShowChannelForm] = useState(false)
  const [channelForm, setChannelForm] = useState({ name: '', description: '', members: '', url: '' })
  const [editingChannelIdx, setEditingChannelIdx] = useState(null)

  // Link form
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [linkForm, setLinkForm] = useState({ label: '', url: '' })
  const [editingLinkIdx, setEditingLinkIdx] = useState(null)

  useEffect(() => { fetchAnnouncements() }, [])
  useEffect(() => { fetchConfig() }, [])

  async function fetchAnnouncements() {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('published_at', { ascending: false })
    setAnnouncements(data || [])
  }

  async function fetchConfig() {
    setConfigLoading(true)
    const { data } = await supabase.from('intranet_config').select('key, value')
    const map = {}
    for (const row of data || []) map[row.key] = row.value
    setConfig(map)
    if (map.staff_spotlight) setSpotlightForm(map.staff_spotlight)
    setConfigLoading(false)
  }

  async function upsertConfig(key, value) {
    await supabase
      .from('intranet_config')
      .upsert({ key, value }, { onConflict: 'key' })
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  // ── Announcements ──────────────────────────────────────

  function resetForm() {
    setForm({ title: '', body: '', tag: 'General', published_at: new Date().toISOString().split('T')[0] })
    setEditingId(null)
    setShowForm(false)
  }

  function startEdit(a) {
    setForm({
      title: a.title,
      body: a.body || '',
      tag: a.tag || 'General',
      published_at: a.published_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    })
    setEditingId(a.id)
    setShowForm(true)
  }

  async function handleSaveAnnouncement() {
    if (!form.title) return
    setSaving(true)
    if (editingId) {
      await supabase.from('announcements').update({
        title: form.title,
        body: form.body,
        tag: form.tag,
        published_at: form.published_at,
      }).eq('id', editingId)
    } else {
      await supabase.from('announcements').insert({
        title: form.title,
        body: form.body,
        tag: form.tag,
        published_at: form.published_at,
      })
    }
    await fetchAnnouncements()
    resetForm()
    setSaving(false)
  }

  async function handleDeleteAnnouncement(id) {
    if (!confirm('Delete this announcement?')) return
    await supabase.from('announcements').delete().eq('id', id)
    fetchAnnouncements()
  }

  // ── Spotlight ──────────────────────────────────────────

  async function handleSaveSpotlight() {
    if (!spotlightForm.name) return
    setSpotlightSaving(true)
    await upsertConfig('staff_spotlight', spotlightForm)
    setSpotlightSaving(false)
  }

  // ── Galleries ──────────────────────────────────────────

  async function handleSaveGallery() {
    if (!galleryForm.name || !galleryForm.url) return
    const galleries = [...(config.photo_galleries || [])]
    if (editingGalleryIdx !== null) {
      galleries[editingGalleryIdx] = { ...galleryForm, count: Number(galleryForm.count) }
    } else {
      galleries.push({ ...galleryForm, count: Number(galleryForm.count) })
    }
    await upsertConfig('photo_galleries', galleries)
    setGalleryForm({ name: '', platform: 'Pixieset', count: '', url: '' })
    setEditingGalleryIdx(null)
    setShowGalleryForm(false)
  }

  async function handleDeleteGallery(idx) {
    if (!confirm('Remove this gallery?')) return
    const galleries = (config.photo_galleries || []).filter((_, i) => i !== idx)
    await upsertConfig('photo_galleries', galleries)
  }

  function startEditGallery(g, idx) {
    setGalleryForm({ ...g, count: String(g.count) })
    setEditingGalleryIdx(idx)
    setShowGalleryForm(true)
  }

  // ── Channels ───────────────────────────────────────────

  async function handleSaveChannel() {
    if (!channelForm.name) return
    const channels = [...(config.slack_channels || [])]
    if (editingChannelIdx !== null) {
      channels[editingChannelIdx] = { ...channelForm, members: Number(channelForm.members) }
    } else {
      channels.push({ ...channelForm, members: Number(channelForm.members) })
    }
    await upsertConfig('slack_channels', channels)
    setChannelForm({ name: '', description: '', members: '', url: '' })
    setEditingChannelIdx(null)
    setShowChannelForm(false)
  }

  async function handleDeleteChannel(idx) {
    if (!confirm('Remove this channel?')) return
    const channels = (config.slack_channels || []).filter((_, i) => i !== idx)
    await upsertConfig('slack_channels', channels)
  }

  function startEditChannel(ch, idx) {
    setChannelForm({ ...ch, members: String(ch.members) })
    setEditingChannelIdx(idx)
    setShowChannelForm(true)
  }

  // ── Links ──────────────────────────────────────────────

  async function handleSaveLink() {
    if (!linkForm.label || !linkForm.url) return
    const links = [...(config.quick_links || [])]
    if (editingLinkIdx !== null) {
      links[editingLinkIdx] = linkForm
    } else {
      links.push(linkForm)
    }
    await upsertConfig('quick_links', links)
    setLinkForm({ label: '', url: '' })
    setEditingLinkIdx(null)
    setShowLinkForm(false)
  }

  async function handleDeleteLink(idx) {
    if (!confirm('Remove this link?')) return
    const links = (config.quick_links || []).filter((_, i) => i !== idx)
    await upsertConfig('quick_links', links)
  }

  function startEditLink(l, idx) {
    setLinkForm(l)
    setEditingLinkIdx(idx)
    setShowLinkForm(true)
  }

  // ── Styles ─────────────────────────────────────────────

  const s = {
    page: { padding: '32px', fontFamily: t.fonts.sans },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
    title: { fontSize: '20px', fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 4px', fontFamily: t.fonts.heading },
    sub: { fontSize: '12px', color: t.colors.textTertiary, margin: 0 },
    tabs: { display: 'flex', gap: '4px', marginBottom: '24px', background: '#fff', borderRadius: '10px', padding: '4px', border: `0.5px solid ${t.colors.border}`, width: 'fit-content' },
    tab: (active) => ({ fontSize: '12px', fontWeight: '500', padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', border: 'none', background: active ? t.colors.nav : 'transparent', color: active ? '#fff' : t.colors.textTertiary, fontFamily: t.fonts.sans }),
    btn: { padding: '9px 18px', borderRadius: t.radius.full, border: 'none', background: t.colors.primary, color: '#fff', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: t.fonts.sans },
    btnGhost: { padding: '9px 18px', borderRadius: t.radius.full, border: `0.5px solid ${t.colors.border}`, background: '#fff', color: t.colors.textSecondary, fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: t.fonts.sans },
    btnSm: { padding: '5px 12px', borderRadius: '6px', border: `0.5px solid ${t.colors.border}`, background: '#fff', color: t.colors.textSecondary, fontSize: '11px', cursor: 'pointer', fontFamily: t.fonts.sans },
    btnDel: { padding: '5px 12px', borderRadius: '6px', border: '0.5px solid #FEE2E2', background: '#FEF2F2', color: '#EF4444', fontSize: '11px', cursor: 'pointer', fontFamily: t.fonts.sans },
    formCard: { background: '#fff', borderRadius: t.radius.lg, border: `1px solid ${t.colors.primary}`, padding: '20px', marginBottom: '16px' },
    card: { background: '#fff', borderRadius: t.radius.lg, border: `0.5px solid ${t.colors.border}`, overflow: 'hidden' },
    row: { display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '16px 20px', borderBottom: `0.5px solid ${t.colors.borderLight}` },
    label: { fontSize: '10px', fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '5px', display: 'block' },
    input: { width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `0.5px solid ${t.colors.border}`, fontSize: '13px', fontFamily: t.fonts.sans, color: t.colors.textPrimary, background: t.colors.bg, boxSizing: 'border-box', outline: 'none' },
    textarea: { width: '100%', padding: '9px 12px', borderRadius: t.radius.md, border: `0.5px solid ${t.colors.border}`, fontSize: '13px', fontFamily: t.fonts.sans, color: t.colors.textPrimary, background: t.colors.bg, boxSizing: 'border-box', outline: 'none', resize: 'vertical', minHeight: '80px' },
    formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
    formActions: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' },
    rowActions: { display: 'flex', gap: '6px', flexShrink: 0 },
    rowTitle: { fontSize: '13px', fontWeight: '500', color: t.colors.textPrimary, marginBottom: '2px' },
    rowSub: { fontSize: '11px', color: t.colors.textTertiary },
    sectionLabel: { fontSize: '10px', fontWeight: '500', letterSpacing: '0.12em', textTransform: 'uppercase', color: t.colors.textTertiary, marginBottom: '10px' },
    topRow: { display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' },
  }

  const tabs = ['announcements', 'spotlight', 'galleries', 'channels', 'links']
  const tabLabels = { announcements: 'Announcements', spotlight: 'Staff spotlight', galleries: 'Photo galleries', channels: 'Slack channels', links: 'Quick links' }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Intranet manager</h2>
          <p style={s.sub}>Changes publish instantly to The Third Spot</p>
        </div>
        {activeTab === 'announcements' && (
          <button style={s.btn} onClick={() => { resetForm(); setShowForm(true) }}>
            + New announcement
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {tabs.map(tab => (
          <button key={tab} style={s.tab(activeTab === tab)} onClick={() => { setActiveTab(tab); setShowForm(false) }}>
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {/* ── Announcements ── */}
      {activeTab === 'announcements' && (
        <div>
          {showForm && (
            <div style={s.formCard}>
              <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '16px' }}>
                {editingId ? 'Edit announcement' : 'New announcement'}
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={s.label}>Title</label>
                <input style={s.input} placeholder="Announcement title..." value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={s.label}>Body</label>
                <textarea style={s.textarea} placeholder="Write your announcement..." value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
              </div>
              <div style={s.formRow}>
                <div>
                  <label style={s.label}>Tag</label>
                  <select style={s.input} value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })}>
                    {TAGS.map(tag => <option key={tag}>{tag}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Publish date</label>
                  <input style={s.input} type="date" value={form.published_at} onChange={e => setForm({ ...form, published_at: e.target.value })} />
                </div>
              </div>
              <div style={s.formActions}>
                <button style={s.btnGhost} onClick={resetForm}>Cancel</button>
                <button style={s.btn} onClick={handleSaveAnnouncement} disabled={saving || !form.title}>
                  {saving ? 'Saving...' : editingId ? 'Save changes' : 'Publish'}
                </button>
              </div>
            </div>
          )}

          <div style={s.card}>
            {announcements.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: t.colors.textTertiary }}>
                No announcements yet — create your first one above
              </div>
            )}
            {announcements.map((a, i) => (
              <div key={a.id} style={{ ...s.row, borderBottom: i < announcements.length - 1 ? `0.5px solid ${t.colors.borderLight}` : 'none' }}>
                <div style={{ flex: 1 }}>
                  <div style={s.rowTitle}>{a.title}</div>
                  {a.body && <div style={{ fontSize: '12px', color: t.colors.textSecondary, margin: '3px 0', lineHeight: 1.5 }}>{a.body.slice(0, 120)}{a.body.length > 120 ? '...' : ''}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    {a.tag && <span style={{ fontSize: '9px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', background: t.colors.primaryLight, color: t.colors.primary, borderRadius: t.radius.full, padding: '2px 8px' }}>{a.tag}</span>}
                    <span style={{ fontSize: '11px', color: t.colors.textTertiary }}>{new Date(a.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
                <div style={s.rowActions}>
                  <button style={s.btnSm} onClick={() => startEdit(a)}>Edit</button>
                  <button style={s.btnDel} onClick={() => handleDeleteAnnouncement(a.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Spotlight ── */}
      {activeTab === 'spotlight' && (
        <div>
          {config.staff_spotlight?.name && (
            <div style={{ marginBottom: '24px' }}>
              <div style={s.sectionLabel}>Currently featured</div>
              <div style={{ background: t.colors.nav, borderRadius: t.radius.lg, padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: t.colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '500', color: '#fff', flexShrink: 0 }}>
                  {config.staff_spotlight.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#ADFF2F', fontWeight: '500', marginBottom: '4px' }}>Staff spotlight</div>
                  <div style={{ fontFamily: t.fonts.heading, fontSize: '14px', fontWeight: '700', color: '#fff' }}>{config.staff_spotlight.name}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{config.staff_spotlight.role}</div>
                </div>
              </div>
            </div>
          )}

          <div style={s.sectionLabel}>{config.staff_spotlight?.name ? 'Update spotlight' : 'Set spotlight'}</div>
          <div style={{ background: '#fff', borderRadius: t.radius.lg, border: `0.5px solid ${t.colors.border}`, padding: '20px' }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={s.label}>Name</label>
              <input style={s.input} placeholder="Full name" value={spotlightForm.name} onChange={e => setSpotlightForm({ ...spotlightForm, name: e.target.value })} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={s.label}>Role + tenure</label>
              <input style={s.input} placeholder="e.g. Senior Events Coordinator · 4 years" value={spotlightForm.role} onChange={e => setSpotlightForm({ ...spotlightForm, role: e.target.value })} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={s.label}>Quote</label>
              <textarea style={s.textarea} placeholder="A short quote from this person..." value={spotlightForm.quote} onChange={e => setSpotlightForm({ ...spotlightForm, quote: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button style={s.btn} onClick={handleSaveSpotlight} disabled={spotlightSaving || !spotlightForm.name}>
                {spotlightSaving ? 'Saving...' : 'Publish spotlight'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Galleries ── */}
      {activeTab === 'galleries' && (
        <div>
          <div style={s.topRow}>
            <button style={s.btn} onClick={() => { setGalleryForm({ name: '', platform: 'Pixieset', count: '', url: '' }); setEditingGalleryIdx(null); setShowGalleryForm(true) }}>+ Add gallery</button>
          </div>
          {showGalleryForm && (
            <div style={{ ...s.formCard, marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '16px' }}>{editingGalleryIdx !== null ? 'Edit gallery' : 'Add gallery'}</div>
              <div style={{ marginBottom: '12px' }}>
                <label style={s.label}>Album name</label>
                <input style={s.input} placeholder="e.g. Spring Summit Recap" value={galleryForm.name} onChange={e => setGalleryForm({ ...galleryForm, name: e.target.value })} />
              </div>
              <div style={s.formRow}>
                <div>
                  <label style={s.label}>Platform</label>
                  <select style={s.input} value={galleryForm.platform} onChange={e => setGalleryForm({ ...galleryForm, platform: e.target.value })}>
                    <option>Pixieset</option>
                    <option>Carousel</option>
                    <option>Google Photos</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label style={s.label}>Photo count</label>
                  <input style={s.input} type="number" placeholder="48" value={galleryForm.count} onChange={e => setGalleryForm({ ...galleryForm, count: e.target.value })} />
                </div>
              </div>
              <div style={{ marginBottom: '12px', marginTop: '12px' }}>
                <label style={s.label}>Gallery URL</label>
                <input style={s.input} placeholder="https://..." value={galleryForm.url} onChange={e => setGalleryForm({ ...galleryForm, url: e.target.value })} />
              </div>
              <div style={s.formActions}>
                <button style={s.btnGhost} onClick={() => setShowGalleryForm(false)}>Cancel</button>
                <button style={s.btn} onClick={handleSaveGallery}>Save gallery</button>
              </div>
            </div>
          )}
          <div style={s.card}>
            {(config.photo_galleries || []).length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: t.colors.textTertiary }}>No galleries yet</div>
            )}
            {(config.photo_galleries || []).map((g, i) => (
              <div key={i} style={{ ...s.row, borderBottom: i < (config.photo_galleries || []).length - 1 ? `0.5px solid ${t.colors.borderLight}` : 'none' }}>
                <div style={{ flex: 1 }}>
                  <div style={s.rowTitle}>{g.name}</div>
                  <div style={s.rowSub}>{g.platform} · {g.count} photos</div>
                </div>
                <div style={s.rowActions}>
                  <button style={s.btnSm} onClick={() => startEditGallery(g, i)}>Edit</button>
                  <button style={s.btnDel} onClick={() => handleDeleteGallery(i)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Channels ── */}
      {activeTab === 'channels' && (
        <div>
          <div style={s.topRow}>
            <button style={s.btn} onClick={() => { setChannelForm({ name: '', description: '', members: '', url: '' }); setEditingChannelIdx(null); setShowChannelForm(true) }}>+ Add channel</button>
          </div>
          {showChannelForm && (
            <div style={{ ...s.formCard, marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '16px' }}>{editingChannelIdx !== null ? 'Edit channel' : 'Add channel'}</div>
              <div style={s.formRow}>
                <div>
                  <label style={s.label}>Channel name</label>
                  <input style={s.input} placeholder="water-cooler" value={channelForm.name} onChange={e => setChannelForm({ ...channelForm, name: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Member count</label>
                  <input style={s.input} type="number" placeholder="214" value={channelForm.members} onChange={e => setChannelForm({ ...channelForm, members: e.target.value })} />
                </div>
              </div>
              <div style={{ margin: '12px 0' }}>
                <label style={s.label}>Description</label>
                <input style={s.input} placeholder="Short description of what this channel is for" value={channelForm.description} onChange={e => setChannelForm({ ...channelForm, description: e.target.value })} />
              </div>
              <div>
                <label style={s.label}>Slack URL</label>
                <input style={s.input} placeholder="https://slack.com/app_redirect?channel=..." value={channelForm.url} onChange={e => setChannelForm({ ...channelForm, url: e.target.value })} />
              </div>
              <div style={s.formActions}>
                <button style={s.btnGhost} onClick={() => setShowChannelForm(false)}>Cancel</button>
                <button style={s.btn} onClick={handleSaveChannel}>Save channel</button>
              </div>
            </div>
          )}
          <div style={s.card}>
            {(config.slack_channels || []).length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: t.colors.textTertiary }}>No channels yet</div>
            )}
            {(config.slack_channels || []).map((ch, i) => (
              <div key={i} style={{ ...s.row, borderBottom: i < (config.slack_channels || []).length - 1 ? `0.5px solid ${t.colors.borderLight}` : 'none' }}>
                <span style={{ fontFamily: t.fonts.heading, fontSize: '16px', fontWeight: '800', color: t.colors.primary, flexShrink: 0, lineHeight: 1 }}>#</span>
                <div style={{ flex: 1 }}>
                  <div style={s.rowTitle}>{ch.name}</div>
                  <div style={s.rowSub}>{ch.members} members · {ch.description}</div>
                </div>
                <div style={s.rowActions}>
                  <button style={s.btnSm} onClick={() => startEditChannel(ch, i)}>Edit</button>
                  <button style={s.btnDel} onClick={() => handleDeleteChannel(i)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Links ── */}
      {activeTab === 'links' && (
        <div>
          <div style={s.topRow}>
            <button style={s.btn} onClick={() => { setLinkForm({ label: '', url: '' }); setEditingLinkIdx(null); setShowLinkForm(true) }}>+ Add link</button>
          </div>
          {showLinkForm && (
            <div style={{ ...s.formCard, marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '16px' }}>{editingLinkIdx !== null ? 'Edit link' : 'Add link'}</div>
              <div style={s.formRow}>
                <div>
                  <label style={s.label}>Label</label>
                  <input style={s.input} placeholder="HR Portal" value={linkForm.label} onChange={e => setLinkForm({ ...linkForm, label: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>URL</label>
                  <input style={s.input} placeholder="https://..." value={linkForm.url} onChange={e => setLinkForm({ ...linkForm, url: e.target.value })} />
                </div>
              </div>
              <div style={s.formActions}>
                <button style={s.btnGhost} onClick={() => setShowLinkForm(false)}>Cancel</button>
                <button style={s.btn} onClick={handleSaveLink}>Save link</button>
              </div>
            </div>
          )}
          <div style={s.card}>
            {(config.quick_links || []).length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: t.colors.textTertiary }}>No links yet</div>
            )}
            {(config.quick_links || []).map((l, i) => (
              <div key={i} style={{ ...s.row, borderBottom: i < (config.quick_links || []).length - 1 ? `0.5px solid ${t.colors.borderLight}` : 'none' }}>
                <div style={{ flex: 1 }}>
                  <div style={s.rowTitle}>{l.label}</div>
                  <div style={s.rowSub}>{l.url}</div>
                </div>
                <div style={s.rowActions}>
                  <button style={s.btnSm} onClick={() => startEditLink(l, i)}>Edit</button>
                  <button style={s.btnDel} onClick={() => handleDeleteLink(i)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}