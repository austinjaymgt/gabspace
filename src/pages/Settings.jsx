import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import { Icon } from '../components/Icon'
import Toggle from '../components/Toggle'
import { MODULE_DEFS, MODULE_DATA_TABLES, getModules, setModules as persistModules, toggleModuleState } from '../utils/businessModules'
import RoleBadge from '../components/RoleBadge'

const PLAN_LABELS = {
  free: 'Free (1 business)',
  founding: 'Founders Circle (3 businesses)',
  duo: 'Duo (2 businesses)',
  studio: 'Studio (3 businesses)',
  enterprise: 'Enterprise (uncapped)',
}

function SectionCard({ title, subtitle, titleColor, borderColor, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${borderColor || t.colors.borderLight}`, overflow: 'hidden', marginBottom: '24px' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
          padding: '20px 24px',
          background: 'none',
          border: 'none',
          borderBottom: open ? `1px solid ${t.colors.borderLight}` : 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: t.fonts.sans,
        }}
      >
        <div>
          <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: titleColor || t.colors.textPrimary, margin: '0 0 4px' }}>{title}</h3>
          {subtitle && <p style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, margin: 0 }}>{subtitle}</p>}
        </div>
        <span style={{ color: t.colors.textTertiary, flexShrink: 0, display: 'flex', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>
          <Icon name="expand" size="sm" />
        </span>
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

export default function Settings({ session, businessSpaceId, userRole, onBusinessIdentityChange, onArchiveBusiness }) {
  const [settings, setSettings] = useState(null)
  const [form, setForm] = useState({
    first_name: '',
    business_name: '',
    logo_url: '',
    display_name: '',
    job_title: '',
    plan: 'free',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

// Delete account
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [blockedWorkspaces, setBlockedWorkspaces] = useState(null)

  const isOwnerOrAdmin = ['owner', 'co-owner'].includes(userRole)
  const isOwner = userRole === 'owner'

  // Archive business
  const [archiving, setArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState(null)

  // Modules
  const [modules, setModulesState] = useState(getModules(businessSpaceId))
  const [moduleDataCounts, setModuleDataCounts] = useState({})
  const [moduleNote, setModuleNote] = useState(null)

  async function fetchModuleDataCounts() {
    const counts = {}
    await Promise.all(Object.entries(MODULE_DATA_TABLES).map(async ([key, table]) => {
      const { count } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('business_space_id', businessSpaceId)
      counts[key] = count || 0
    }))
    setModuleDataCounts(counts)
  }

  useEffect(() => { fetchSettings() }, [])
  useEffect(() => { if (businessSpaceId) fetchBusinessIdentity() }, [businessSpaceId])
  useEffect(() => {
    setModulesState(getModules(businessSpaceId))
    setModuleNote(null)
    if (businessSpaceId) fetchModuleDataCounts()
  }, [businessSpaceId])

  function handleToggleModule(key) {
    const wasOn = modules[key]
    const { modules: next, note } = toggleModuleState(modules, key)
    setModulesState(next)
    persistModules(businessSpaceId, next)
    onBusinessIdentityChange?.()

    const dataCount = moduleDataCounts[key] || 0
    if (wasOn && !next[key] && dataCount > 0) {
      const label = MODULE_DEFS.find(m => m.key === key).label
      setModuleNote(`${label} turned off — its ${dataCount} existing ${dataCount === 1 ? 'entry stays' : 'entries stay'} put, just hidden.`)
    } else {
      setModuleNote(note)
    }
  }

  async function fetchSettings() {
    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (data) {
      setSettings(data)
      setForm(prev => ({ ...prev, first_name: data.first_name || '', plan: data.plan || 'free' }))
    }
  }

  async function fetchBusinessIdentity() {
    const { data: business } = await supabase
      .from('business_spaces')
      .select('name, logo_url')
      .eq('id', businessSpaceId)
      .single()

    const { data: membership } = await supabase
      .from('business_space_members')
      .select('display_name, job_title')
      .eq('business_space_id', businessSpaceId)
      .eq('user_id', session.user.id)
      .maybeSingle()

    setForm(prev => ({
      ...prev,
      business_name: business?.name || '',
      logo_url: business?.logo_url || '',
      display_name: membership?.display_name || '',
      job_title: membership?.job_title || '',
    }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const personalPayload = { first_name: form.first_name }
    if (settings) {
      await supabase.from('user_settings').update(personalPayload).eq('user_id', session.user.id)
    } else {
      await supabase.from('user_settings').insert({ user_id: session.user.id, ...personalPayload })
    }

    await supabase.rpc('update_my_business_profile', {
      target_business_space_id: businessSpaceId,
      new_display_name: form.display_name,
      new_job_title: form.job_title,
    })

    if (isOwnerOrAdmin) {
      const { error: identityError } = await supabase.rpc('update_business_identity', {
        target_business_space_id: businessSpaceId,
        new_name: form.business_name,
        new_logo_url: form.logo_url,
      })
      if (identityError) setError(identityError.message)
      else onBusinessIdentityChange?.()
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    fetchSettings()
    fetchBusinessIdentity()
  }

  async function handleLogoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setError('Logo must be under 2MB.'); return }
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
    const newLogoUrl = `${urlData.publicUrl}?t=${Date.now()}`
    setForm(prev => ({ ...prev, logo_url: newLogoUrl }))
    const { error: identityError } = await supabase.rpc('update_business_identity', {
      target_business_space_id: businessSpaceId,
      new_name: form.business_name,
      new_logo_url: newLogoUrl,
    })
    if (identityError) setError(identityError.message)
    else onBusinessIdentityChange?.()
    setUploading(false)
  }

  async function handleArchive() {
    if (!window.confirm("Archive this business? Everyone loses access until it's restored — nothing is deleted, and you can restore it anytime from the business switcher.")) return
    setArchiving(true)
    setArchiveError(null)
    const { error } = await onArchiveBusiness?.() || {}
    setArchiving(false)
    if (error) setArchiveError(error.message || 'Something went wrong.')
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    setDeleteError(null)
    setBlockedWorkspaces(null)

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({}),
      })

      const result = await res.json()

      if (result.status === 'deleted') {
        await supabase.auth.signOut()
        window.location.href = 'https://gabspace.io'
        return
      }

      if (result.status === 'blocked') {
        setBlockedWorkspaces(result.blocking_workspaces || [])
        setDeleting(false)
        return
      }

      setDeleteError(result.error || 'Something went wrong. Please try again or contact support.')
      setDeleting(false)
    } catch (err) {
      setDeleteError(err.message || 'Network error. Please try again.')
      setDeleting(false)
    }
  }

  function closeDeleteModal() {
    setDeleteModalOpen(false)
    setDeleteConfirmText('')
    setDeleteError(null)
    setBlockedWorkspaces(null)
  }

  const inputStyle = {
    padding: '10px 14px',
    borderRadius: t.radius.full,
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
    <div style={{ padding: '32px', maxWidth: '640px', fontFamily: t.fonts.sans }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 4px' }}>
          Settings
        </h2>
        <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: 0 }}>
          Customize your gabspace experience
        </p>
      </div>

      {/* ── Business Identity ── */}
      <SectionCard title="Business identity" subtitle="Shows in the sub-header across all pages">
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Your first name</label>
            <input style={inputStyle} placeholder="e.g. Alex" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Business name</label>
            <input
              style={{ ...inputStyle, ...(isOwnerOrAdmin ? {} : { backgroundColor: t.colors.bg, color: t.colors.textTertiary, cursor: 'not-allowed' }) }}
              placeholder="e.g. Wildflower Creative Co."
              value={form.business_name}
              onChange={e => setForm({ ...form, business_name: e.target.value })}
              disabled={!isOwnerOrAdmin}
            />
            {!isOwnerOrAdmin && (
              <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>Only owners and admins can change the business name</span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Display name</label>
              <input style={inputStyle} placeholder="e.g. Alex Rivera" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} />
              <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>Used on proposals and documents</span>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Job title</label>
              <input style={inputStyle} placeholder="e.g. Founder & Creative Director" value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} />
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
                {isOwnerOrAdmin ? (
                  <>
                    <label style={{ padding: '8px 16px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: t.fontSizes.sm, fontWeight: '500', cursor: 'pointer', fontFamily: t.fonts.sans, display: 'inline-block' }}>
                      {uploading ? 'Uploading...' : 'Upload logo'}
                      <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                    </label>
                    <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>PNG, JPG up to 2MB</span>
                    {form.logo_url && (
                      <button onClick={async () => {
                        setForm(prev => ({ ...prev, logo_url: '' }))
                        const { error: identityError } = await supabase.rpc('update_business_identity', {
                          target_business_space_id: businessSpaceId,
                          new_name: form.business_name,
                          new_logo_url: '',
                        })
                        if (identityError) setError(identityError.message)
                        else onBusinessIdentityChange?.()
                      }} style={{ fontSize: t.fontSizes.xs, color: t.colors.danger, background: 'none', border: 'none', cursor: 'pointer', fontFamily: t.fonts.sans, textAlign: 'left', padding: 0 }}>
                        Remove logo
                      </button>
                    )}
                  </>
                ) : (
                  <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>Only owners and admins can change the business logo</span>
                )}
              </div>
            </div>
            {error && (
              <div style={{ padding: '8px 12px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.sm }}>{error}</div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── Modules ── */}
      {isOwnerOrAdmin && (
        <SectionCard title="Modules" subtitle="Turn features on or off for this business — the sidebar updates to match">
          <div style={{ padding: '8px 24px 24px' }}>
            {MODULE_DEFS.map(m => (
              <div key={m.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '14px 0', borderBottom: `1px solid ${t.colors.borderLight}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0 }}>
                  <span style={{ color: t.colors.textTertiary, marginTop: '2px', flexShrink: 0 }}>
                    <Icon name={m.icon} size="sm" />
                  </span>
                  <div>
                    <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>{m.label}</div>
                    <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, marginTop: '2px' }}>{m.description}</div>
                    {m.note && (
                      <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '2px', fontStyle: 'italic' }}>{m.note}</div>
                    )}
                  </div>
                </div>
                <Toggle checked={!!modules[m.key]} onChange={() => handleToggleModule(m.key)} />
              </div>
            ))}
            {moduleNote && (
              <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: t.radius.md, backgroundColor: t.colors.primaryLight, color: t.colors.primary, fontSize: t.fontSizes.sm, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <Icon name="info" size="sm" />
                <span>{moduleNote}</span>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* ── Account ── */}
      <SectionCard title="Account">
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', backgroundColor: t.colors.bg, borderRadius: t.radius.md }}>
            <div>
              <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>Email</div>
              <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>{session?.user?.email}</div>
            </div>
            <RoleBadge role={userRole} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Plan</label>
            <div style={{ fontSize: t.fontSizes.base, fontWeight: '600', color: t.colors.textPrimary }}>
              {PLAN_LABELS[form.plan] || form.plan}
            </div>
            <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
              Controls how many business spaces you can create. Contact support to change your plan.
            </span>
          </div>
        </div>
      </SectionCard>

      {/* ── Danger Zone ── */}
      <SectionCard title="Danger zone" subtitle="Permanent actions that can't be undone" titleColor={t.colors.danger} borderColor={t.colors.dangerLight} defaultOpen={false}>
        {isOwner && (
          <div style={{ padding: '24px', borderBottom: `1px solid ${t.colors.borderLight}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary, marginBottom: '4px' }}>Archive this business</div>
                <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, maxWidth: '380px' }}>
                  Hides this business for everyone and nothing is deleted. Restore it anytime from the business switcher.
                </div>
              </div>
              <button
                onClick={handleArchive}
                disabled={archiving}
                style={{
                  padding: '10px 20px', borderRadius: t.radius.full,
                  border: `1px solid ${t.colors.danger}`,
                  backgroundColor: t.colors.bgCard, color: t.colors.danger,
                  fontSize: t.fontSizes.sm, fontWeight: '500',
                  cursor: archiving ? 'not-allowed' : 'pointer', fontFamily: t.fonts.sans, whiteSpace: 'nowrap',
                  opacity: archiving ? 0.6 : 1,
                }}
              >
                {archiving ? 'Archiving…' : 'Archive business'}
              </button>
            </div>
            {archiveError && (
              <div style={{ marginTop: '12px', padding: '8px 12px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.sm }}>
                {archiveError}
              </div>
            )}
          </div>
        )}
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary, marginBottom: '4px' }}>Delete account</div>
            <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, maxWidth: '380px' }}>
              Permanently delete your account, your data, and any workspace you solely own. This cannot be undone.
            </div>
          </div>
          <button
            onClick={() => setDeleteModalOpen(true)}
            style={{
              padding: '10px 20px', borderRadius: t.radius.full,
              border: `1px solid ${t.colors.danger}`,
              backgroundColor: t.colors.bgCard, color: t.colors.danger,
              fontSize: t.fontSizes.sm, fontWeight: '500',
              cursor: 'pointer', fontFamily: t.fonts.sans, whiteSpace: 'nowrap',
            }}
          >
            Delete account
          </button>
        </div>
      </SectionCard>

      {/* ── Actions ── */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.reload() }}
          style={{ padding: '12px 24px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.danger, fontSize: t.fontSizes.md, fontWeight: '500', cursor: 'pointer', fontFamily: t.fonts.sans }}
        >
          Sign out
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '12px 24px', borderRadius: t.radius.full, border: 'none', backgroundColor: saved ? t.colors.success : t.colors.primary, color: t.colors.textInverse, fontSize: t.fontSizes.md, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans, transition: 'background 0.2s' }}
        >
          {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save settings'}
        </button>
      </div>

    {/* ── Delete confirmation modal ── */}
      {deleteModalOpen && (
        <div
          onClick={closeDeleteModal}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(26, 26, 46, 0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: t.colors.bgCard,
              borderRadius: t.radius.card,
              maxWidth: '480px', width: '100%',
              maxHeight: '90vh', overflow: 'auto',
              border: `1px solid ${t.colors.borderLight}`,
            }}
          >
            <div style={{ padding: '24px 28px 20px', borderBottom: `1px solid ${t.colors.borderLight}` }}>
              <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '600', color: t.colors.danger, margin: '0 0 4px' }}>
                Delete account
              </h3>
              <p style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, margin: 0 }}>
                This action is permanent and cannot be undone.
              </p>
            </div>

            <div style={{ padding: '24px 28px' }}>
              {blockedWorkspaces ? (
                <>
                  <div style={{ padding: '14px 16px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight, marginBottom: '20px' }}>
                    <div style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.danger, marginBottom: '6px' }}>
                      You own {blockedWorkspaces.length === 1 ? 'a workspace' : 'workspaces'} with other members
                    </div>
                    <div style={{ fontSize: t.fontSizes.sm, color: t.colors.danger, lineHeight: 1.55 }}>
                      Before you can delete your account, you'll need to transfer ownership or remove the other members from:
                    </div>
                    <ul style={{ margin: '10px 0 0 18px', padding: 0, fontSize: t.fontSizes.sm, color: t.colors.danger }}>
                      {blockedWorkspaces.map(ws => (
                        <li key={ws.id} style={{ marginBottom: '4px' }}>
                          <strong>{ws.name}</strong> ({ws.other_member_count} other {ws.other_member_count === 1 ? 'member' : 'members'})
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={closeDeleteModal}
                      style={{ padding: '10px 20px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: t.fontSizes.sm, fontWeight: '500', cursor: 'pointer', fontFamily: t.fonts.sans }}
                    >
                      Got it
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: t.fontSizes.base, color: t.colors.textPrimary, lineHeight: 1.6, margin: '0 0 16px' }}>
                    Deleting your account will permanently remove:
                  </p>
                  <ul style={{ margin: '0 0 20px 18px', padding: 0, fontSize: t.fontSizes.sm, color: t.colors.textSecondary, lineHeight: 1.8 }}>
                    <li>Your profile and login</li>
                    <li>Any workspace where you're the only member</li>
                    <li>All clients, projects, invoices, files, and other data in those workspaces</li>
                    <li>Your membership in workspaces owned by others</li>
                  </ul>
                  <p style={{ fontSize: t.fontSizes.sm, color: t.colors.textSecondary, marginBottom: '20px' }}>
                    To confirm, type <strong style={{ color: t.colors.textPrimary, fontFamily: 'monospace' }}>DELETE MY ACCOUNT</strong> below.
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE MY ACCOUNT"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '10px 14px', borderRadius: t.radius.full,
                      border: `1px solid ${t.colors.border}`,
                      fontSize: t.fontSizes.md, outline: 'none',
                      color: t.colors.textPrimary, fontFamily: 'monospace',
                      marginBottom: '20px',
                    }}
                    autoFocus
                  />
                  {deleteError && (
                    <div style={{ padding: '10px 14px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.sm, marginBottom: '16px' }}>
                      {deleteError}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      onClick={closeDeleteModal}
                      disabled={deleting}
                      style={{ padding: '10px 20px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: t.fontSizes.sm, fontWeight: '500', cursor: 'pointer', fontFamily: t.fonts.sans }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleting || deleteConfirmText !== 'DELETE MY ACCOUNT'}
                      style={{
                        padding: '10px 20px', borderRadius: t.radius.full, border: 'none',
                        backgroundColor: t.colors.danger, color: t.colors.textInverse,
                        fontSize: t.fontSizes.sm, fontWeight: '600',
                        cursor: deleting || deleteConfirmText !== 'DELETE MY ACCOUNT' ? 'not-allowed' : 'pointer',
                        opacity: deleting || deleteConfirmText !== 'DELETE MY ACCOUNT' ? 0.5 : 1,
                        fontFamily: t.fonts.sans,
                      }}
                    >
                      {deleting ? 'Deleting…' : 'Delete my account'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
