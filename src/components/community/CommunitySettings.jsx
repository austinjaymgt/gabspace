import { useState, useEffect } from 'react'
import { theme as t } from '../../theme'
import Toggle from '../Toggle'
import CityInput from './CityInput'
import { isValidWebsite, isValidInstagram, citySuggestions } from '../../utils/communityHelpers'
import { fetchDirectory, fetchMyListing, fetchBusinessBasics, saveMyListing, fetchTagSubscriptions, addTagSubscription, removeTagSubscription, friendlyError } from '../../utils/community'
import { COMMUNITY_TAGS, COLLAB_CATEGORIES, MAX_TAGS, PITCH_MAX } from '../../utils/communityTaxonomy'
import { OptionPicker, ErrorText } from './CommunityUI'
import { inputStyle, textareaStyle, labelStyle, primaryButtonStyle } from './communityStyles'

const field = { display: 'flex', flexDirection: 'column', gap: '8px' }

// "List in directory" for the active business space. Rendered inside a
// Settings SectionCard, which is already owner/co-owner-only.
export function DirectoryListingSettings({ businessSpaceId }) {
  const [form, setForm] = useState(null)
  const [slug, setSlug] = useState(null)
  const [knownCities, setKnownCities] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!businessSpaceId) return
    let cancelled = false
    Promise.all([
      fetchMyListing(businessSpaceId),
      fetchBusinessBasics(businessSpaceId),
    ]).then(([listing, business]) => {
      if (cancelled) return
      setSlug(listing?.slug || null)
      setForm({
        is_discoverable: listing?.is_discoverable || false,
        display_name: listing?.display_name || business?.name || '',
        pitch: listing?.pitch || '',
        tags: listing?.tags || [],
        city: listing?.city || '',
        remote_ok: listing?.remote_ok || false,
        website: listing?.website || '',
        instagram: listing?.instagram ? `@${listing.instagram}` : '',
        // Always follow the business's current logo.
        logo_url: business?.logo_url || null,
      })
    }).catch(err => setError(err.message))
    // Suggest cities other listings already use, nudging toward one spelling
    // per city (still free-typed — any value is allowed).
    fetchDirectory().then(rows => { if (!cancelled) setKnownCities(citySuggestions(rows)) }).catch(() => {})
    return () => { cancelled = true }
  }, [businessSpaceId])

  if (!form) return <div style={{ padding: '24px', fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>{error || 'Loading…'}</div>

  const set = (key, value) => { setSaved(false); setForm(f => ({ ...f, [key]: value })) }
  const websiteOk = isValidWebsite(form.website)
  const instagramOk = isValidInstagram(form.instagram)
  const canSave = form.display_name.trim().length > 0 && websiteOk && instagramOk && !saving

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const listing = await saveMyListing(businessSpaceId, form)
      setSlug(listing.slug)
      setForm(f => ({ ...f, website: listing.website || '', instagram: listing.instagram ? `@${listing.instagram}` : '' }))
      setSaved(true)
    } catch (err) {
      setError(friendlyError(err))
    }
    setSaving(false)
  }

  return (
    <div className="gs-community" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div>
          <div style={{ fontSize: t.fontSizes.md, fontWeight: 600, color: t.colors.textPrimary }}>List in directory</div>
          <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>Signed-in gabspace users can find this business in the Community directory.</div>
        </div>
        <Toggle checked={form.is_discoverable} onChange={() => set('is_discoverable', !form.is_discoverable)} />
      </div>

      <div style={field}>
        <label style={labelStyle}>Display name</label>
        <input style={inputStyle} maxLength={80} value={form.display_name} onChange={e => set('display_name', e.target.value)} />
      </div>

      <div style={field}>
        <label style={labelStyle}>Pitch <span style={{ color: t.colors.textTertiary, fontWeight: 400 }}>({form.pitch.length}/{PITCH_MAX})</span></label>
        <textarea style={{ ...textareaStyle, minHeight: '72px' }} maxLength={PITCH_MAX} placeholder="One or two lines on what you do and who you love working with." value={form.pitch} onChange={e => set('pitch', e.target.value)} />
      </div>

      <div style={field}>
        <label style={labelStyle}>Website</label>
        <input
          style={{ ...inputStyle, borderColor: websiteOk ? undefined : t.colors.danger }}
          type="url"
          inputMode="url"
          maxLength={200}
          placeholder="e.g. lumaphoto.com"
          value={form.website}
          onChange={e => set('website', e.target.value)}
        />
        {!websiteOk && <span style={{ fontSize: t.fontSizes.xs, color: t.colors.danger }}>Enter a web address like lumaphoto.com</span>}
      </div>

      <div style={field}>
        <label style={labelStyle}>Instagram</label>
        <input
          style={{ ...inputStyle, borderColor: instagramOk ? undefined : t.colors.danger }}
          maxLength={120}
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="@handle"
          value={form.instagram}
          onChange={e => set('instagram', e.target.value)}
        />
        {!instagramOk && <span style={{ fontSize: t.fontSizes.xs, color: t.colors.danger }}>Use your handle, like @lumaphotoco — letters, numbers, periods, and underscores only</span>}
      </div>

      <div style={field}>
        <label style={labelStyle}>Specialties <span style={{ color: t.colors.textTertiary, fontWeight: 400 }}>(up to {MAX_TAGS})</span></label>
        <OptionPicker options={COMMUNITY_TAGS} value={form.tags} onChange={v => set('tags', v)} max={MAX_TAGS} />
      </div>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ ...field, flex: '1 1 200px' }}>
          <label style={labelStyle}>City</label>
          <CityInput value={form.city} onChange={v => set('city', v)} suggestions={knownCities} placeholder="e.g. Austin, TX" formatOnBlur />
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: t.fontSizes.sm, color: t.colors.textSecondary, paddingBottom: '10px' }}>
          <Toggle checked={form.remote_ok} onChange={() => set('remote_ok', !form.remote_ok)} /> Works remotely
        </label>
      </div>

      <ErrorText>{error}</ErrorText>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
          {saved ? 'Saved.' : slug ? `Listing handle: ${slug}` : ''}
        </span>
        <button className="gs-cm-button" onClick={handleSave} disabled={!canSave} style={primaryButtonStyle(!canSave)}>{saving ? 'Saving…' : 'Save listing'}</button>
      </div>
    </div>
  )
}

// Per-user alerts: get an in-app notification when a request is posted in
// a subscribed category or with a subscribed tag.
export function TagAlertsSettings() {
  const [subs, setSubs] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchTagSubscriptions().then(setSubs).catch(err => setError(err.message))
  }, [])

  async function handleChange(next) {
    const added = next.filter(k => !subs.includes(k))
    const removed = subs.filter(k => !next.includes(k))
    const prev = subs
    setSubs(next)
    setError('')
    try {
      await Promise.all([...added.map(addTagSubscription), ...removed.map(removeTagSubscription)])
    } catch (err) {
      setSubs(prev)
      setError(friendlyError(err))
    }
  }

  if (!subs) return <div style={{ padding: '24px', fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>{error || 'Loading…'}</div>

  return (
    <div className="gs-community" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={field}>
        <label style={labelStyle}>Request categories</label>
        <OptionPicker options={COLLAB_CATEGORIES} value={subs} onChange={handleChange} />
      </div>
      <div style={field}>
        <label style={labelStyle}>Skills</label>
        <OptionPicker options={COMMUNITY_TAGS} value={subs} onChange={handleChange} />
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  )
}
