import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import { Icon } from '../components/Icon'
import Toggle from '../components/Toggle'
import { MODULE_DEFS, MODULE_DATA_TABLES, getModules, loadModules, setModules as persistModules, toggleModuleState } from '../utils/businessModules'
import RoleBadge from '../components/RoleBadge'
import { cancelSubscription, resumeSubscription } from '../utils/checkout'
import PasswordRequirements, { unmetPasswordRequirement } from '../components/PasswordRequirements'
import { DirectoryListingSettings, TagAlertsSettings } from '../components/community/CommunitySettings'
import ConnectedApps from '../components/ConnectedApps'

const PLAN_LABELS = {
  business: 'Business (1 business)',
  duo: 'Duo (2 businesses)',
  studio: 'Studio (3 businesses)',
  enterprise: 'Enterprise (uncapped)',
}

function SectionCard({ title, subtitle, titleColor, borderColor, defaultOpen = false, children }) {
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

async function fetchUserSettings(userId) {
  const { data } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

async function fetchSubscription(userId) {
  const { data } = await supabase
    .from('subscriptions')
    .select('status, cancel_at_period_end, current_period_end')
    .eq('owner_id', userId)
    .maybeSingle()
  return data || null
}

async function fetchBusinessIdentity(businessSpaceId, userId) {
  const [{ data: business }, { data: membership }] = await Promise.all([
    supabase
      .from('business_spaces')
      .select('name, logo_url')
      .eq('id', businessSpaceId)
      .maybeSingle(),
    supabase
      .from('business_space_members')
      .select('display_name, job_title')
      .eq('business_space_id', businessSpaceId)
      .eq('user_id', userId)
      .maybeSingle(),
  ])
  return {
    business_name: business?.name || '',
    logo_url: business?.logo_url || '',
    display_name: membership?.display_name || '',
    job_title: membership?.job_title || '',
  }
}

async function fetchModuleDataCounts(businessSpaceId) {
  const counts = {}
  await Promise.all(Object.entries(MODULE_DATA_TABLES).map(async ([key, table]) => {
    const { count } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('business_space_id', businessSpaceId)
    counts[key] = count || 0
  }))
  return counts
}

export default function Settings({ session, businessSpaceId, userRole, onBusinessIdentityChange, onArchiveBusiness, onNavigate }) {
  const userId = session.user.id
  const [settings, setSettings] = useState(null)
  const [form, setForm] = useState({
    first_name: '',
    business_name: '',
    logo_url: '',
    display_name: '',
    job_title: '',
    plan: 'business',
    orbi_window_days: 3,
  })
  // Business name as last saved — logo changes save this, not whatever is
  // currently typed in the (unsaved) name field.
  const [savedBusinessName, setSavedBusinessName] = useState('')
  const [isFounder, setIsFounder] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

// Delete account
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [blockedWorkspaces, setBlockedWorkspaces] = useState(null)

  // Settings is open to every role; business-level sections are limited to
  // owners/co-owners, and community sections to staff (clients don't see
  // Community).
  const isOwnerOrAdmin = ['owner', 'co-owner'].includes(userRole)
  const isOwner = userRole === 'owner'
  const isStaff = ['owner', 'co-owner', 'employee'].includes(userRole)

  // Archive business
  const [archiving, setArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState(null)

  // Subscription (cancel / resume)
  const [subscription, setSubscription] = useState(null)
  const [canceling, setCanceling] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [subscriptionError, setSubscriptionError] = useState(null)

  // Modules
  const [modules, setModulesState] = useState(getModules(businessSpaceId))
  const [moduleDataCounts, setModuleDataCounts] = useState({})
  const [moduleNote, setModuleNote] = useState(null)

  // Change password
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showChangePasswordFields, setShowChangePasswordFields] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [changeNewPassword, setChangeNewPassword] = useState('')
  const [changeConfirmPassword, setChangeConfirmPassword] = useState('')
  const [changePasswordError, setChangePasswordError] = useState(null)
  const [changePasswordLoading, setChangePasswordLoading] = useState(false)
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false)

  async function handleChangePassword(e) {
    e.preventDefault()
    setChangePasswordError(null)
    if (!currentPassword) return setChangePasswordError('Enter your current password.')
    const unmet = unmetPasswordRequirement(changeNewPassword)
    if (unmet) return setChangePasswordError(`New password needs: ${unmet.toLowerCase()}.`)
    if (changeNewPassword !== changeConfirmPassword) return setChangePasswordError("New passwords don't match.")

    setChangePasswordLoading(true)

    // Verify the current password before allowing the change — protects
    // against someone using an unattended, already-logged-in device.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    })
    if (verifyError) {
      setChangePasswordLoading(false)
      return setChangePasswordError('Current password is incorrect.')
    }

    const { data: updateData, error: updateError } = await supabase.auth.updateUser({ password: changeNewPassword })
    setChangePasswordLoading(false)

    if (updateError) return setChangePasswordError(updateError.message)

    const token = updateData?.session?.access_token || session?.access_token
    if (token) {
      fetch('/api/send-password-changed-email', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }

    setCurrentPassword('')
    setChangeNewPassword('')
    setChangeConfirmPassword('')
    setShowChangePasswordFields(false)
    setChangePasswordSuccess(true)
    setTimeout(() => {
      setChangePasswordSuccess(false)
      setShowChangePassword(false)
    }, 2000)
  }

  function applySettings(data) {
    if (!data) return
    setSettings(data)
    setForm(prev => ({ ...prev, first_name: data.first_name || '', plan: data.plan || 'business', orbi_window_days: data.orbi_window_days || 3 }))
    setIsFounder(!!data.is_founder)
  }

  function applyBusinessIdentity(identity) {
    setForm(prev => ({ ...prev, ...identity }))
    setSavedBusinessName(identity.business_name)
  }

  const refreshSettings = () => fetchUserSettings(userId).then(applySettings)
  const refreshSubscription = () => fetchSubscription(userId).then(setSubscription)
  const refreshBusinessIdentity = () => fetchBusinessIdentity(businessSpaceId, userId).then(applyBusinessIdentity)

  useEffect(() => {
    let cancelled = false
    fetchUserSettings(userId).then(data => { if (!cancelled) applySettings(data) })
    fetchSubscription(userId).then(data => { if (!cancelled) setSubscription(data) })
    return () => { cancelled = true }
  }, [userId])

  // App remounts Settings per business (key={businessSpaceId}), so state
  // starts fresh on a switch; the cancel flag drops late responses.
  useEffect(() => {
    if (!businessSpaceId) return
    let cancelled = false
    fetchBusinessIdentity(businessSpaceId, userId).then(identity => { if (!cancelled) applyBusinessIdentity(identity) })
    loadModules(businessSpaceId).then(m => { if (!cancelled) setModulesState(m) })
    fetchModuleDataCounts(businessSpaceId).then(counts => { if (!cancelled) setModuleDataCounts(counts) })
    return () => { cancelled = true }
  }, [businessSpaceId, userId])

  async function handleToggleModule(key) {
    const wasOn = modules[key]
    const previous = modules
    const { modules: next, note } = toggleModuleState(modules, key)
    setModulesState(next)
    const { error } = await persistModules(businessSpaceId, next)
    if (error) {
      setModulesState(previous)
      setModuleNote("Couldn't save that change — try again.")
      return
    }
    onBusinessIdentityChange?.()

    const dataCount = moduleDataCounts[key] || 0
    if (wasOn && !next[key] && dataCount > 0) {
      const label = MODULE_DEFS.find(m => m.key === key).label
      setModuleNote(`${label} turned off — its ${dataCount} existing ${dataCount === 1 ? 'entry stays' : 'entries stay'} put, just hidden.`)
    } else {
      setModuleNote(note)
    }
  }

  async function handleCancelSubscription() {
    if (!window.confirm("Cancel your subscription? You'll keep access through the end of your current billing period, then it stops — nothing is deleted.")) return
    setCanceling(true)
    setSubscriptionError(null)
    try {
      await cancelSubscription({ userId })
      await refreshSubscription()
    } catch (err) {
      setSubscriptionError(err.message)
    }
    setCanceling(false)
  }

  async function handleResumeSubscription() {
    setResuming(true)
    setSubscriptionError(null)
    try {
      await resumeSubscription({ userId })
      await refreshSubscription()
    } catch (err) {
      setSubscriptionError(err.message)
    }
    setResuming(false)
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setSaveError(null)
    const errors = []

    const personalPayload = { first_name: form.first_name, orbi_window_days: form.orbi_window_days }
    const { error: settingsError } = settings
      ? await supabase.from('user_settings').update(personalPayload).eq('user_id', userId)
      : await supabase.from('user_settings').insert({ user_id: userId, ...personalPayload })
    if (settingsError) errors.push(`Personal settings: ${settingsError.message}`)

    if (businessSpaceId) {
      const { error: profileError } = await supabase.rpc('update_my_business_profile', {
        target_business_space_id: businessSpaceId,
        new_display_name: form.display_name,
        new_job_title: form.job_title,
      })
      if (profileError) errors.push(`Display name / job title: ${profileError.message}`)
    }

    if (isOwnerOrAdmin && businessSpaceId) {
      const { error: identityError } = await supabase.rpc('update_business_identity', {
        target_business_space_id: businessSpaceId,
        new_name: form.business_name,
        new_logo_url: form.logo_url,
      })
      if (identityError) errors.push(`Business name: ${identityError.message}`)
      else onBusinessIdentityChange?.()
    }

    setSaving(false)
    if (errors.length) {
      setSaveError(`Some changes didn't save — ${errors.join(' · ')}`)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    refreshSettings()
    if (businessSpaceId) refreshBusinessIdentity()
  }

  // Saves a logo change with the business name as last saved, so an
  // in-progress name edit isn't committed by a logo upload/removal.
  async function saveLogo(newLogoUrl) {
    const previousLogoUrl = form.logo_url
    setForm(prev => ({ ...prev, logo_url: newLogoUrl }))
    const { error: identityError } = await supabase.rpc('update_business_identity', {
      target_business_space_id: businessSpaceId,
      new_name: savedBusinessName,
      new_logo_url: newLogoUrl,
    })
    if (identityError) {
      setForm(prev => ({ ...prev, logo_url: previousLogoUrl }))
      setError(identityError.message)
    } else {
      onBusinessIdentityChange?.()
    }
  }

  async function handleLogoUpload(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setError('Logo must be under 2MB.'); return }
    setUploading(true)
    setError(null)
    // One file per business (not per user), so owners of several businesses
    // don't overwrite one business's logo when uploading another's.
    const fileExt = file.name.split('.').pop().toLowerCase()
    const fileName = `${businessSpaceId}/logo.${fileExt}`
    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(fileName, file, { upsert: true })
    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName)
    await saveLogo(`${urlData.publicUrl}?t=${Date.now()}`)
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
      <SectionCard title="Account Information" subtitle="Shows in the sub-header across all pages">
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
              <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>Only owners and co-owners can change the business name</span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Display name</label>
              <input style={inputStyle} placeholder="e.g. Alex Rivera" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} />
              <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>Shown next to your name in Team members</span>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Job title</label>
              <input style={inputStyle} placeholder="e.g. Founder & Creative Director" value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} />
              <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>Shown under your name in Team members</span>
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
                      <button onClick={() => { setError(null); saveLogo('') }} style={{ fontSize: t.fontSizes.xs, color: t.colors.danger, background: 'none', border: 'none', cursor: 'pointer', fontFamily: t.fonts.sans, textAlign: 'left', padding: 0 }}>
                        Remove logo
                      </button>
                    )}
                  </>
                ) : (
                  <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>Only owners and co-owners can change the business logo</span>
                )}
              </div>
            </div>
            {error && (
              <div style={{ padding: '8px 12px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.sm }}>{error}</div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── Team ── */}
      {isOwnerOrAdmin && onNavigate && (
        <SectionCard title="Team" subtitle="Manage who's on this business and their roles">
          <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary, marginBottom: '4px' }}>Team members</div>
              <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, maxWidth: '380px' }}>
                Invite people, change roles, or remove members from this business.
              </div>
            </div>
            <button
              onClick={() => onNavigate('team-members')}
              style={{ padding: '10px 20px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textPrimary, fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans, whiteSpace: 'nowrap' }}
            >
              Manage team members
            </button>
          </div>
        </SectionCard>
      )}

      {/* ── Modules ── */}
      {isOwnerOrAdmin && (
        <SectionCard title="Modules" subtitle="Toggle feature on or off for this business">
          <div style={{ padding: '8px 24px 24px' }}>
            {MODULE_DEFS.map((m, i) => (
              // A module that requires another (Portals) sits nested under it,
              // mirroring the sidebar — no divider between parent and child.
              <div key={m.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: m.requires ? '4px 0 14px 28px' : '14px 0', borderBottom: MODULE_DEFS[i + 1]?.requires ? 'none' : `1px solid ${t.colors.borderLight}` }}>
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

      {/* ── Community ── */}
      {isOwnerOrAdmin && (
        <SectionCard title="Directory listing" subtitle="Show this business in the Community directory">
          <DirectoryListingSettings businessSpaceId={businessSpaceId} />
        </SectionCard>
      )}

      {isStaff && (
        <SectionCard title="Board alerts" subtitle="Get notified when a request is posted to The Board in categories or skills you follow">
          <TagAlertsSettings />
        </SectionCard>
      )}

      {/* ── Orbi ── */}
      {isStaff && (
        <SectionCard title="Orbi" subtitle="Your assistant for upcoming deadlines, projects and events across all business profiles">
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Look-ahead window</label>
              <select
                style={{ ...inputStyle, maxWidth: '160px' }}
                value={form.orbi_window_days}
                onChange={e => setForm({ ...form, orbi_window_days: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                  <option key={n} value={n}>{n} {n === 1 ? 'day' : 'days'}</option>
                ))}
              </select>
              <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>How far ahead Orbi looks for upcoming items</span>
            </div>
          </div>
        </SectionCard>
      )}

      {/* ── Connected apps (Claude connector / OAuth grants) ── */}
      {isStaff && (
        <SectionCard title="Connected apps" subtitle="Connect Claude to gabspace and manage apps you've approved">
          <ConnectedApps />
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

          <div style={{ padding: '14px 16px', backgroundColor: t.colors.bg, borderRadius: t.radius.md }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
              <div>
                <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary }}>Password</div>
                <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>••••••••</div>
              </div>
              {!showChangePassword && (
                <button
                  type="button"
                  onClick={() => { setShowChangePassword(true); setChangePasswordError(null) }}
                  style={{ padding: '10px 20px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textPrimary, fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans, whiteSpace: 'nowrap' }}
                >
                  Change password
                </button>
              )}
            </div>

            {showChangePassword && (
              changePasswordSuccess ? (
                <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: t.radius.md, backgroundColor: t.colors.successLight, color: t.colors.success, fontSize: t.fontSizes.sm, textAlign: 'center' }}>
                  ✓ Password updated
                </div>
              ) : (
                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
                  {changePasswordError && (
                    <div style={{ padding: '10px 14px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.sm }}>
                      {changePasswordError}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary }}>Current password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        style={{ padding: '10px 14px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.md, outline: 'none', color: t.colors.textPrimary, fontFamily: t.fonts.sans, width: '100%', boxSizing: 'border-box', paddingRight: '44px' }}
                        type={showChangePasswordFields ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowChangePasswordFields(prev => !prev)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: t.colors.textTertiary, padding: '2px', lineHeight: 1 }}
                      >
                        {showChangePasswordFields ? '🙈' : '👁'}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary }}>New password</label>
                    <input
                      style={{ padding: '10px 14px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.md, outline: 'none', color: t.colors.textPrimary, fontFamily: t.fonts.sans }}
                      type={showChangePasswordFields ? 'text' : 'password'}
                      placeholder="At least 8 characters"
                      value={changeNewPassword}
                      onChange={e => setChangeNewPassword(e.target.value)}
                    />
                    {changeNewPassword && <PasswordRequirements password={changeNewPassword} />}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary }}>Confirm new password</label>
                    <input
                      style={{ padding: '10px 14px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.md, outline: 'none', color: t.colors.textPrimary, fontFamily: t.fonts.sans }}
                      type={showChangePasswordFields ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={changeConfirmPassword}
                      onChange={e => setChangeConfirmPassword(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="submit"
                      disabled={changePasswordLoading}
                      style={{ padding: '10px 20px', borderRadius: t.radius.full, border: 'none', backgroundColor: t.colors.primary, color: t.colors.textInverse, fontSize: t.fontSizes.sm, fontWeight: '600', cursor: changePasswordLoading ? 'not-allowed' : 'pointer', fontFamily: t.fonts.sans, opacity: changePasswordLoading ? 0.6 : 1 }}
                    >
                      {changePasswordLoading ? 'Updating…' : 'Update password'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowChangePassword(false)
                        setChangePasswordError(null)
                        setCurrentPassword('')
                        setChangeNewPassword('')
                        setChangeConfirmPassword('')
                      }}
                      style={{ padding: '10px 20px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, backgroundColor: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )
            )}
          </div>
          {/* The subscription belongs to the signed-in user, not the active
              business — show it whenever they have one, whatever their role here. */}
          {(isOwnerOrAdmin || subscription) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', padding: '14px 16px', backgroundColor: t.colors.bg, borderRadius: t.radius.md }}>
            <div>
              <div style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary, marginBottom: '4px' }}>Plan</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: t.fontSizes.base, fontWeight: '600', color: t.colors.textPrimary }}>
                  {PLAN_LABELS[form.plan] || form.plan}
                </span>
                {isFounder && (
                  <span style={{ fontSize: t.fontSizes.xs, fontWeight: '600', color: t.colors.primary, backgroundColor: t.colors.primaryLight, padding: '2px 8px', borderRadius: t.radius.full }}>
                    Founder pricing
                  </span>
                )}
              </div>
              <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
                Controls how many business spaces you can create.
              </span>
              {subscription?.cancel_at_period_end && (
                <div style={{ fontSize: t.fontSizes.xs, color: t.colors.danger, marginTop: '6px', fontWeight: '500' }}>
                  {subscription.current_period_end
                    ? `Cancels on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                    : 'Cancels at the end of the billing period'}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {subscription?.cancel_at_period_end && (
                <button
                  onClick={handleResumeSubscription}
                  disabled={resuming}
                  style={{
                    padding: '10px 20px', borderRadius: t.radius.full,
                    border: `1px solid ${t.colors.border}`,
                    backgroundColor: t.colors.bgCard, color: t.colors.textPrimary,
                    fontSize: t.fontSizes.sm, fontWeight: '600', cursor: resuming ? 'not-allowed' : 'pointer', fontFamily: t.fonts.sans, whiteSpace: 'nowrap',
                    opacity: resuming ? 0.6 : 1,
                  }}
                >
                  {resuming ? 'Resuming…' : 'Resume subscription'}
                </button>
              )}
              {onNavigate && isOwnerOrAdmin && (
                <button
                  onClick={() => onNavigate('pricing')}
                  style={{
                    padding: '10px 20px', borderRadius: t.radius.full, border: 'none',
                    backgroundColor: t.colors.primary, color: t.colors.textInverse,
                    fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans, whiteSpace: 'nowrap',
                  }}
                >
                  Change plan
                </button>
              )}
            </div>
          </div>
          )}
          {subscriptionError && (
            <div style={{ padding: '10px 14px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.sm }}>
              {subscriptionError}
            </div>
          )}
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
        {subscription && !subscription.cancel_at_period_end && (
          <div style={{ padding: '24px', borderBottom: `1px solid ${t.colors.borderLight}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: t.fontSizes.base, fontWeight: '500', color: t.colors.textPrimary, marginBottom: '4px' }}>Cancel subscription</div>
                <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, maxWidth: '380px' }}>
                  Keep access through the end of your current billing period, then it stops. You can resume anytime before then.
                </div>
              </div>
              <button
                onClick={handleCancelSubscription}
                disabled={canceling}
                style={{
                  padding: '10px 20px', borderRadius: t.radius.full,
                  border: `1px solid ${t.colors.danger}`,
                  backgroundColor: t.colors.bgCard, color: t.colors.danger,
                  fontSize: t.fontSizes.sm, fontWeight: '500',
                  cursor: canceling ? 'not-allowed' : 'pointer', fontFamily: t.fonts.sans, whiteSpace: 'nowrap',
                  opacity: canceling ? 0.6 : 1,
                }}
              >
                {canceling ? 'Canceling…' : 'Cancel subscription'}
              </button>
            </div>
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
      {saveError && (
        <div style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.sm }}>
          {saveError}
        </div>
      )}
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
          style={{ padding: '12px 24px', borderRadius: t.radius.full, border: 'none', backgroundColor: saved ? t.colors.success : t.colors.primary, color: t.colors.textInverse, fontSize: t.fontSizes.md, fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: t.fonts.sans, transition: 'background 0.2s' }}
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
