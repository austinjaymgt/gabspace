import { useState, useEffect } from 'react'
import { theme as t } from '../../theme'
import Modal from '../Modal'
import Toggle from '../Toggle'
import CityInput from './CityInput'
import { createRequest, fetchDirectory, fetchOpenRequests, friendlyError } from '../../utils/community'
import { citySuggestions } from '../../utils/communityHelpers'
import { COLLAB_CATEGORIES, COMMUNITY_TAGS, MAX_TAGS, REQUEST_DEFAULT_DAYS } from '../../utils/communityTaxonomy'
import { OptionPicker, ErrorText } from './CommunityUI'
import { inputStyle, textareaStyle, labelStyle, primaryButtonStyle, secondaryButtonStyle } from './communityStyles'

const EXPIRY_OPTIONS = [7, 14, 30, 60, 90]

// Only rendered for members — `businesses` is the caller's can_post list.
export default function PostRequestModal({ isOpen, onClose, businesses, onCreated }) {
  const [form, setForm] = useState(() => ({
    business_space_id: businesses[0]?.business_space_id || '',
    title: '',
    category: '',
    tags: [],
    description: '',
    location: '',
    remote_ok: false,
    needed_by: '',
    expires_in_days: REQUEST_DEFAULT_DAYS,
  }))
  const [knownCities, setKnownCities] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Suggest places already used in listings and on the Board.
  useEffect(() => {
    Promise.all([fetchDirectory(), fetchOpenRequests()])
      .then(([listings, reqs]) => setKnownCities(citySuggestions([...listings, ...reqs.map(r => ({ city: r.location }))])))
      .catch(() => {})
  }, [])

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const canSubmit = form.business_space_id && form.title.trim().length >= 3 && form.category && !saving

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError('')
    try {
      const expiresAt = new Date(Date.now() + form.expires_in_days * 86400000).toISOString()
      const { id } = await createRequest({
        business_space_id: form.business_space_id,
        title: form.title.trim(),
        category: form.category,
        tags: form.tags,
        description: form.description.trim() || null,
        location: form.location.trim() || null,
        remote_ok: form.remote_ok,
        needed_by: form.needed_by || null,
        expires_at: expiresAt,
      })
      onCreated(id)
    } catch (err) {
      setError(friendlyError(err))
      setSaving(false)
    }
  }

  const field = { display: 'flex', flexDirection: 'column', gap: '6px' }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Post a collab request" size="lg">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {businesses.length > 1 && (
          <div style={field}>
            <label style={labelStyle}>Post as</label>
            <select value={form.business_space_id} onChange={e => set('business_space_id', e.target.value)} style={inputStyle}>
              {businesses.map(b => <option key={b.business_space_id} value={b.business_space_id}>{b.name}</option>)}
            </select>
          </div>
        )}

        <div style={field}>
          <label style={labelStyle}>Title</label>
          <input style={inputStyle} maxLength={120} placeholder="e.g. Second shooter for a fall wedding" value={form.title} onChange={e => set('title', e.target.value)} />
        </div>

        <div style={field}>
          <label style={labelStyle}>Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)} style={inputStyle}>
            <option value="">Choose a category…</option>
            {COLLAB_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>

        <div style={field}>
          <label style={labelStyle}>Skills needed <span style={{ color: t.colors.textTertiary, fontWeight: 400 }}>(up to {MAX_TAGS})</span></label>
          <OptionPicker options={COMMUNITY_TAGS} value={form.tags} onChange={v => set('tags', v)} max={MAX_TAGS} />
        </div>

        <div style={field}>
          <label style={labelStyle}>Details</label>
          <textarea style={textareaStyle} maxLength={4000} placeholder="What you need, scope, budget range, anything helpful." value={form.description} onChange={e => set('description', e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ ...field, flex: '1 1 180px' }}>
            <label style={labelStyle}>Location</label>
            <CityInput value={form.location} onChange={v => set('location', v)} suggestions={knownCities} placeholder="e.g. Austin, TX" formatOnBlur />
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: t.fontSizes.sm, color: t.colors.textSecondary, paddingBottom: '10px' }}>
            <Toggle checked={form.remote_ok} onChange={() => set('remote_ok', !form.remote_ok)} /> Remote OK
          </label>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ ...field, flex: '1 1 160px' }}>
            <label style={labelStyle}>Needed by</label>
            <input type="date" style={inputStyle} value={form.needed_by} onChange={e => set('needed_by', e.target.value)} />
          </div>
          <div style={{ ...field, flex: '1 1 160px' }}>
            <label style={labelStyle}>Keep on the board for</label>
            <select value={form.expires_in_days} onChange={e => set('expires_in_days', Number(e.target.value))} style={inputStyle}>
              {EXPIRY_OPTIONS.map(d => <option key={d} value={d}>{d} days</option>)}
            </select>
          </div>
        </div>

        <ErrorText>{error}</ErrorText>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>Cancel</button>
          <button className="gs-cm-button" type="submit" disabled={!canSubmit} style={primaryButtonStyle(!canSubmit)}>{saving ? 'Posting…' : 'Post request'}</button>
        </div>
      </form>
    </Modal>
  )
}
