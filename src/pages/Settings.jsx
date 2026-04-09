import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

export default function Settings({ session }) {
  const [settings, setSettings] = useState(null)
  const [form, setForm] = useState({
    first_name: '',
    business_name: '',
    logo_url: '',
    display_name: '',
    job_title: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { fetchSettings() }, [])

  async function fetchSettings() {
    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (data) {
      setSettings(data)
      setForm({
        first_name: data.first_name || '',
        business_name: data.business_name || '',
        logo_url: data.logo_url || '',
        display_name: data.display_name || '',
        job_title: data.job_title || '',
      })
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const payload = {
      first_name: form.first_name,
      business_name: form.business_name,
      logo_url: form.logo_url,
      display_name: form.display_name,
      job_title: form.job_title,
    }
    if (settings) {
      await supabase.from('user_settings').update(payload).eq('user_id', session.user.id)
    } else {
      await supabase.from('user_settings').insert({ user_id: session.user.id, ...payload })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    fetchSettings()
  }

  async function handleLogoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setError(null)
    const fileExt = file.name.split('.').pop()
    const fileName = `${session.user.id}.${fileExt}`
    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(fileName, file, { upsert: true })
    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName)
    setForm(prev => ({ ...prev, logo_url: urlData.publicUrl }))
    setUploading(false)
  }

  const inputStyle = {
    padding: '10px 14px',
    borderRadius: t.radius.md,
    border: `1px solid ${t.colors.border}`,
    fontSize: t.fontSizes.md,
    outline: 'none',
    color: t.colors.textPrimary,
    fontFamily: t.fonts.sans,
  }

  const labelStyle = {
    fontSize: t.fontSizes.sm,
    fontWeight: '500',
    color: t.colors.textSecondary,
  }

  const fieldStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  }

  return (
    <div style={{ padding: '32px', maxWidth: '600px', fontFamily: t.fonts.sans }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 4px' }}>
          Settings
        </h2>
        <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: 0 }}>
          Customize your Gabspace experience
        </p>
      </div>

      {/* ── Business Identity ── */}
      <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.borderLight}`, overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${t.colors.borderLight}` }}>
          <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 4px' }}>Business identity</h3>
          <p style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, margin: 0 }}>Shows in the sub-header across all pages</p>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div style={fieldStyle}>
            <label style={labelStyle}>Your first name</label>
            <input style={inputStyle} placeholder="e.g. Ostyn" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Business name</label>
            <input style={inputStyle} placeholder="e.g. Brookwaven Studio" value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Display name</label>
              <input
                style={inputStyle}
                placeholder="e.g. Ostyn McCarty"
                value={form.display_name}
                onChange={e => setForm({ ...form, display_name: e.target.value })}
              />
              <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>Used on proposals and documents</span>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Job title</label>
              <input
                style={inputStyle}
                placeholder="e.g. Director of Events"
                value={form.job_title}
                onChange={e => setForm({ ...form, job_title: e.target.value })}
              />
              <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>Appears under your name on proposals</span>
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Business logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {form.logo_url ? (
                <img src={form.logo_url} alt="logo" style={{ width: '56px', height: '56px', borderRadius: t.radius.md, objectFit: 'cover', border: `1px solid ${t.colors.borderLight}` }} />
              ) : (
                <div style={{ width: '56px', height: '56px', borderRadius: t.radius.md, backgroundColor: t.colors.bg, border: `1px dashed ${t.colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🏢</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ padding: '8px 16px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: t.fontSizes.sm, fontWeight: '500', cursor: 'pointer', fontFamily: t.fonts.sans, display: 'inline-block' }}>
                  {uploading ? 'Uploading...' : 'Upload logo'}
                  <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                </label>
                <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>PNG, JPG up to 2MB</span>
              </div>
            </div>
            {error && (
              <div style={{ padding: '8px 12px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.sm }}>{error}</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Account ── */}
      <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.borderLight}`, overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${t.colors.borderLight}` }}>
          <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 4px' }}>Account</h3>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', backgroundColor: t.colors.bg, borderRadius: t.radius.md }}>
            <div>
              <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>Email</div>
              <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>{session?.user?.email}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.reload() }}
          style={{ padding: '12px 24px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.danger, fontSize: t.fontSizes.md, fontWeight: '500', cursor: 'pointer', fontFamily: t.fonts.sans }}
        >
          Sign out
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '12px 24px', borderRadius: t.radius.md, border: 'none', backgroundColor: saved ? t.colors.success : t.colors.primary, color: t.colors.textInverse, fontSize: t.fontSizes.md, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans, transition: 'background 0.2s' }}
        >
          {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save settings'}
        </button>
      </div>
    </div>
  )
}
