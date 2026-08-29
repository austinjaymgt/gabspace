import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import Toggle from '../components/Toggle'

const PLAN_LABELS = { business: 'Business', duo: 'Duo', studio: 'Studio', enterprise: 'Enterprise' }

function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function slugify(title) {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

const BLANK_POST = { id: null, slug: '', title: '', excerpt: '', content: '', cover_image_url: '', seo_title: '', seo_description: '', status: 'draft' }

export default function AdminPanel() {
  const [settings, setSettings] = useState(null)
  const [waitlist, setWaitlist] = useState([])
  const [users, setUsers] = useState([])
  const [capInput, setCapInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingToggle, setSavingToggle] = useState(false)
  const [savingCap, setSavingCap] = useState(false)
  const [savingPlanFor, setSavingPlanFor] = useState(null)
  const [error, setError] = useState(null)
  const [posts, setPosts] = useState([])
  const [editingPost, setEditingPost] = useState(null)
  const [savingPost, setSavingPost] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [settingsRes, waitlistRes, usersRes, postsRes] = await Promise.all([
      supabase.from('platform_settings').select('*').single(),
      supabase.from('waitlist').select('id, email, created_at, name, creative_type, social_link, how_heard').order('created_at', { ascending: false }),
      supabase.rpc('admin_list_users'),
      supabase.from('blog_posts').select('*').order('created_at', { ascending: false }),
    ])
    if (settingsRes.data) {
      setSettings(settingsRes.data)
      setCapInput(settingsRes.data.founding_member_cap ?? '')
    }
    setWaitlist(waitlistRes.data || [])
    setUsers(usersRes.data || [])
    setPosts(postsRes.data || [])
    setLoading(false)
  }

  function openNewPost() {
    setError(null)
    setEditingPost({ ...BLANK_POST })
  }

  function openEditPost(post) {
    setError(null)
    setEditingPost({ ...post })
  }

  async function handleSavePost(nextStatus) {
    if (!editingPost) return
    setSavingPost(true)
    setError(null)
    const slug = editingPost.slug.trim() || slugify(editingPost.title)
    const payload = {
      slug,
      title: editingPost.title.trim(),
      excerpt: editingPost.excerpt?.trim() || null,
      content: editingPost.content,
      cover_image_url: editingPost.cover_image_url?.trim() || null,
      seo_title: editingPost.seo_title?.trim() || null,
      seo_description: editingPost.seo_description?.trim() || null,
      status: nextStatus,
      published_at: nextStatus === 'published' ? (editingPost.published_at || new Date().toISOString()) : editingPost.published_at,
    }

    let result
    if (editingPost.id) {
      result = await supabase.from('blog_posts').update(payload).eq('id', editingPost.id).select().single()
    } else {
      result = await supabase.from('blog_posts').insert(payload).select().single()
    }

    if (result.error) {
      setError(result.error.message)
    } else {
      setPosts(prev => {
        const exists = prev.some(p => p.id === result.data.id)
        return exists ? prev.map(p => (p.id === result.data.id ? result.data : p)) : [result.data, ...prev]
      })
      setEditingPost(null)
    }
    setSavingPost(false)
  }

  async function handleCoverUpload(file) {
    if (!file) return
    setUploadingCover(true)
    setError(null)
    const ext = file.name.split('.').pop()
    const path = `${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('blog-images').upload(path, file)
    if (uploadError) {
      setError(uploadError.message)
    } else {
      const { data } = supabase.storage.from('blog-images').getPublicUrl(path)
      setEditingPost(prev => ({ ...prev, cover_image_url: data.publicUrl }))
    }
    setUploadingCover(false)
  }

  async function handleDeletePost(postId) {
    if (!confirm('Delete this post? This cannot be undone.')) return
    setError(null)
    const { error: deleteError } = await supabase.from('blog_posts').delete().eq('id', postId)
    if (deleteError) setError(deleteError.message)
    else setPosts(prev => prev.filter(p => p.id !== postId))
  }

  async function handleToggleSignups() {
    if (!settings) return
    setSavingToggle(true)
    setError(null)
    const nextValue = !settings.signups_open
    const { error: toggleError } = await supabase
      .from('platform_settings')
      .update({ signups_open: nextValue, updated_at: new Date().toISOString() })
      .eq('id', true)
    if (toggleError) setError(toggleError.message)
    else setSettings(prev => ({ ...prev, signups_open: nextValue }))
    setSavingToggle(false)
  }

  async function handleSaveCap() {
    setSavingCap(true)
    setError(null)
    const capValue = capInput === '' ? null : parseInt(capInput, 10)
    const { error: capError } = await supabase
      .from('platform_settings')
      .update({ founding_member_cap: capValue, updated_at: new Date().toISOString() })
      .eq('id', true)
    if (capError) setError(capError.message)
    else setSettings(prev => ({ ...prev, founding_member_cap: capValue }))
    setSavingCap(false)
  }

  async function handlePlanChange(userId, newPlan) {
    setSavingPlanFor(userId)
    setError(null)
    const { error: planError } = await supabase.rpc('admin_set_user_plan', {
      target_user_id: userId,
      new_plan: newPlan,
    })
    if (planError) setError(planError.message)
    else setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, plan: newPlan } : u))
    setSavingPlanFor(null)
  }

  async function handleFounderToggle(userId, nextIsFounder) {
    setSavingPlanFor(userId)
    setError(null)
    const { error: founderError } = await supabase.rpc('admin_set_founder_status', {
      target_user_id: userId,
      new_is_founder: nextIsFounder,
    })
    if (founderError) setError(founderError.message)
    else setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_founder: nextIsFounder } : u))
    setSavingPlanFor(null)
  }

  function exportWaitlist() {
    downloadCsv(
      `waitlist-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ['email', 'name', 'creative_type', 'social_link', 'how_heard', 'captured_at'],
        ...waitlist.map(w => [w.email, w.name, w.creative_type, w.social_link, w.how_heard, w.created_at]),
      ]
    )
  }

  const founderCount = users.filter(u => u.is_founder).length

  const cardStyle = { backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.borderLight}`, overflow: 'hidden', marginBottom: '24px' }
  const headerStyle = { padding: '20px 24px', borderBottom: `1px solid ${t.colors.borderLight}` }
  const titleStyle = { fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 4px' }
  const descStyle = { fontSize: t.fontSizes.sm, color: t.colors.textTertiary, margin: 0 }

  if (loading) {
    return <div style={{ padding: '32px', fontFamily: t.fonts.sans, color: t.colors.textTertiary }}>Loading…</div>
  }

  return (
    <div style={{ padding: '32px', maxWidth: '720px', fontFamily: t.fonts.sans }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 4px' }}>Admin</h2>
        <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: 0 }}>Platform-wide controls — not scoped to any one business.</p>
      </div>

      {error && (
        <div style={{ marginBottom: '20px', padding: '10px 14px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.sm }}>
          {error}
        </div>
      )}

      {/* ── Signups ── */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>Signups</h3>
          <p style={descStyle}>Turn new self-service signups on or off. When off, the signup page shows a waitlist form instead.</p>
        </div>
        <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>
              Signups are {settings?.signups_open ? 'open' : 'closed'}
            </div>
            <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>
              {settings?.signups_open ? 'Anyone can create an account.' : 'New visitors are shown the waitlist form.'}
            </div>
          </div>
          <Toggle checked={!!settings?.signups_open} onChange={handleToggleSignups} disabled={savingToggle} />
        </div>
      </div>

      {/* ── Founding members ── */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>Founding members</h3>
          <p style={descStyle}>Informational only — set a cap to know when to stop offering founder pricing, nothing blocks automatically.</p>
        </div>
        <div style={{ padding: '24px', display: 'flex', alignItems: 'flex-end', gap: '24px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: t.fontSizes['2xl'], fontWeight: '700', color: settings?.founding_member_cap != null && founderCount >= settings.founding_member_cap ? t.colors.warning : t.colors.textPrimary }}>
              {founderCount}{settings?.founding_member_cap != null ? ` / ${settings.founding_member_cap}` : ''}
            </div>
            <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>on founder pricing</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary }}>Cap (blank = uncapped)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number"
                min="0"
                value={capInput}
                onChange={e => setCapInput(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.md, outline: 'none', color: t.colors.textPrimary, fontFamily: t.fonts.sans, width: '120px' }}
              />
              <button
                onClick={handleSaveCap}
                disabled={savingCap}
                style={{ padding: '8px 16px', borderRadius: t.radius.full, border: 'none', backgroundColor: t.colors.primary, color: t.colors.textInverse, fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Waitlist ── */}
      <div style={cardStyle}>
        <div style={{ ...headerStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={titleStyle}>Waitlist ({waitlist.length})</h3>
            <p style={descStyle}>Captured while signups were closed, plus Founders Circle applications from gabspace.io.</p>
          </div>
          <button
            onClick={exportWaitlist}
            disabled={waitlist.length === 0}
            style={{ padding: '8px 16px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textPrimary, fontSize: t.fontSizes.sm, fontWeight: '600', cursor: waitlist.length === 0 ? 'not-allowed' : 'pointer', fontFamily: t.fonts.sans }}
          >
            Export CSV
          </button>
        </div>
        {waitlist.length > 0 && (
          <div style={{ padding: '8px 24px 20px', maxHeight: '320px', overflowY: 'auto' }}>
            {waitlist.map(w => (
              <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: `1px solid ${t.colors.borderLight}`, fontSize: t.fontSizes.sm }}>
                <div>
                  <div style={{ color: t.colors.textPrimary }}>{w.name ? `${w.name} · ${w.email}` : w.email}</div>
                  {w.creative_type && (
                    <div style={{ color: t.colors.textTertiary, fontSize: t.fontSizes.xs, marginTop: '2px' }}>
                      {w.creative_type}{w.social_link ? ` · ${w.social_link}` : ''}
                    </div>
                  )}
                </div>
                <span style={{ color: t.colors.textTertiary, whiteSpace: 'nowrap', marginLeft: '12px' }}>{new Date(w.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Users ── */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>Users ({users.length})</h3>
          <p style={descStyle}>Everyone with an account, across every business.</p>
        </div>
        <div style={{ padding: '8px 24px 20px', maxHeight: '420px', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '8px', padding: '8px 0', fontSize: t.fontSizes.xs, fontWeight: '600', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <span>Email</span>
            <span>Signed up</span>
            <span>Confirmed</span>
            <span>Plan</span>
            <span>Founder</span>
          </div>
          {users.map(u => (
            <div key={u.user_id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '8px', padding: '10px 0', borderTop: `1px solid ${t.colors.borderLight}`, fontSize: t.fontSizes.sm, alignItems: 'center' }}>
              <span style={{ color: t.colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</span>
              <span style={{ color: t.colors.textTertiary }}>{new Date(u.created_at).toLocaleDateString()}</span>
              <span style={{ color: u.confirmed ? t.colors.success : t.colors.textTertiary }}>{u.confirmed ? 'Yes' : 'No'}</span>
              <select
                value={u.plan || ''}
                onChange={e => handlePlanChange(u.user_id, e.target.value)}
                disabled={savingPlanFor === u.user_id}
                style={{ padding: '4px 8px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, color: t.colors.textSecondary, fontFamily: t.fonts.sans, backgroundColor: t.colors.bgCard, cursor: savingPlanFor === u.user_id ? 'not-allowed' : 'pointer' }}
              >
                {Object.entries(PLAN_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <Toggle checked={!!u.is_founder} onChange={() => handleFounderToggle(u.user_id, !u.is_founder)} disabled={savingPlanFor === u.user_id} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Blog ── */}
      <div style={cardStyle}>
        <div style={{ ...headerStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={titleStyle}>Blog ({posts.length})</h3>
            <p style={descStyle}>Posts published here go live on gabspace.io within a few minutes.</p>
          </div>
          <button
            onClick={openNewPost}
            style={{ padding: '8px 16px', borderRadius: t.radius.full, border: 'none', backgroundColor: t.colors.primary, color: t.colors.textInverse, fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans }}
          >
            New post
          </button>
        </div>
        {posts.length > 0 && (
          <div style={{ padding: '8px 24px 20px' }}>
            {posts.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${t.colors.borderLight}`, fontSize: t.fontSizes.sm, gap: '12px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: t.colors.textPrimary, fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title || '(untitled)'}</div>
                  <div style={{ color: t.colors.textTertiary, fontSize: t.fontSizes.xs, marginTop: '2px' }}>
                    /{p.slug} · {p.status === 'published' ? `Published ${new Date(p.published_at).toLocaleDateString()}` : 'Draft'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    onClick={() => openEditPost(p)}
                    style={{ padding: '6px 12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textPrimary, fontSize: t.fontSizes.xs, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeletePost(p.id)}
                    style={{ padding: '6px 12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.danger, fontSize: t.fontSizes.xs, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingPost && (
        <div
          onClick={() => !savingPost && setEditingPost(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', zIndex: 1000, overflowY: 'auto' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.borderLight}`, width: '100%', maxWidth: '640px', padding: '24px' }}
          >
            <h3 style={{ ...titleStyle, marginBottom: '16px' }}>{editingPost.id ? 'Edit post' : 'New post'}</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Field label="Title">
                <input
                  type="text"
                  value={editingPost.title}
                  onChange={e => setEditingPost(prev => ({ ...prev, title: e.target.value }))}
                  style={inputStyle}
                />
              </Field>
              <Field label="Slug (blank = generated from title)">
                <input
                  type="text"
                  value={editingPost.slug}
                  placeholder={slugify(editingPost.title) || 'my-post-title'}
                  onChange={e => setEditingPost(prev => ({ ...prev, slug: e.target.value }))}
                  style={inputStyle}
                />
              </Field>
              <Field label="Excerpt">
                <textarea
                  rows={2}
                  value={editingPost.excerpt}
                  onChange={e => setEditingPost(prev => ({ ...prev, excerpt: e.target.value }))}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </Field>
              <Field label="Cover image">
                {editingPost.cover_image_url && (
                  <img
                    src={editingPost.cover_image_url}
                    alt=""
                    style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: t.radius.md, border: `1px solid ${t.colors.borderLight}` }}
                  />
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Paste a URL, or upload a file"
                    value={editingPost.cover_image_url}
                    onChange={e => setEditingPost(prev => ({ ...prev, cover_image_url: e.target.value }))}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <label
                    style={{
                      padding: '8px 16px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`,
                      backgroundColor: t.colors.bgCard, color: t.colors.textPrimary, fontSize: t.fontSizes.sm,
                      fontWeight: '600', cursor: uploadingCover ? 'not-allowed' : 'pointer', fontFamily: t.fonts.sans,
                      whiteSpace: 'nowrap', display: 'flex', alignItems: 'center',
                    }}
                  >
                    {uploadingCover ? 'Uploading…' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingCover}
                      onChange={e => { handleCoverUpload(e.target.files[0]); e.target.value = '' }}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </Field>
              <Field label="Content (Markdown)">
                <textarea
                  rows={12}
                  value={editingPost.content}
                  onChange={e => setEditingPost(prev => ({ ...prev, content: e.target.value }))}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'ui-monospace, monospace' }}
                />
              </Field>
              <Field label="SEO title (blank = post title)">
                <input
                  type="text"
                  value={editingPost.seo_title}
                  onChange={e => setEditingPost(prev => ({ ...prev, seo_title: e.target.value }))}
                  style={inputStyle}
                />
              </Field>
              <Field label="SEO description (blank = excerpt)">
                <textarea
                  rows={2}
                  value={editingPost.seo_description}
                  onChange={e => setEditingPost(prev => ({ ...prev, seo_description: e.target.value }))}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </Field>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => setEditingPost(null)}
                disabled={savingPost}
                style={{ padding: '8px 16px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textPrimary, fontSize: t.fontSizes.sm, fontWeight: '600', cursor: savingPost ? 'not-allowed' : 'pointer', fontFamily: t.fonts.sans }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSavePost('draft')}
                disabled={savingPost || !editingPost.title.trim()}
                style={{ padding: '8px 16px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textPrimary, fontSize: t.fontSizes.sm, fontWeight: '600', cursor: savingPost || !editingPost.title.trim() ? 'not-allowed' : 'pointer', fontFamily: t.fonts.sans }}
              >
                Save draft
              </button>
              <button
                onClick={() => handleSavePost('published')}
                disabled={savingPost || !editingPost.title.trim() || !editingPost.content.trim()}
                style={{ padding: '8px 16px', borderRadius: t.radius.full, border: 'none', backgroundColor: t.colors.primary, color: t.colors.textInverse, fontSize: t.fontSizes.sm, fontWeight: '600', cursor: savingPost || !editingPost.title.trim() || !editingPost.content.trim() ? 'not-allowed' : 'pointer', fontFamily: t.fonts.sans }}
              >
                {editingPost.status === 'published' ? 'Save & keep published' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary }}>{label}</span>
      {children}
    </label>
  )
}

const inputStyle = {
  padding: '8px 12px',
  borderRadius: t.radius.md,
  border: `1px solid ${t.colors.border}`,
  fontSize: t.fontSizes.md,
  outline: 'none',
  color: t.colors.textPrimary,
  fontFamily: t.fonts.sans,
  width: '100%',
}
