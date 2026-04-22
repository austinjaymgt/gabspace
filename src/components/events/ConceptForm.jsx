// src/components/events/ConceptForm.jsx
import { useState } from 'react'
import { supabase } from '../../supabaseClient'

const btnStyles = {
  primary:   { padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#7C5CBF', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' },
  secondary: { padding: '7px 14px', borderRadius: '8px', border: '1px solid #f0f0eb', backgroundColor: '#fff', color: '#3D3D5C', fontSize: '13px', fontWeight: '500', cursor: 'pointer' },
  cancel:    { padding: '9px 16px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff', color: '#666', fontSize: '13px', cursor: 'pointer' },
}

export default function ConceptForm({ event, onSave }) {
  const existing = event.concept_data || {}
  const [editMode, setEditMode] = useState(!event.concept_data)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    coreConcept: existing.coreConcept || '',
    goals: existing.goals || '',
    aestheticKeywords: (existing.aestheticKeywords || []).join(', '),
    venueConsiderations: existing.venueConsiderations || '',
    productionNotes: existing.productionNotes || '',
    vendorCategories: (existing.vendorCategories || []).join(', '),
    experienceDesign: existing.experienceDesign || [{ moment: '', description: '' }],
    successMetrics: existing.successMetrics || [{ label: '', value: '' }],
  })

  function addMoment() { setForm(f => ({ ...f, experienceDesign: [...f.experienceDesign, { moment: '', description: '' }] })) }
  function removeMoment(i) { setForm(f => ({ ...f, experienceDesign: f.experienceDesign.filter((_, idx) => idx !== i) })) }
  function updateMoment(i, key, val) { setForm(f => ({ ...f, experienceDesign: f.experienceDesign.map((m, idx) => idx === i ? { ...m, [key]: val } : m) })) }

  function addMetric() { setForm(f => ({ ...f, successMetrics: [...f.successMetrics, { label: '', value: '' }] })) }
  function removeMetric(i) { setForm(f => ({ ...f, successMetrics: f.successMetrics.filter((_, idx) => idx !== i) })) }
  function updateMetric(i, key, val) { setForm(f => ({ ...f, successMetrics: f.successMetrics.map((m, idx) => idx === i ? { ...m, [key]: val } : m) })) }

  async function handleSave() {
    setSaving(true)
    const concept_data = {
      coreConcept: form.coreConcept,
      goals: form.goals,
      aestheticKeywords: form.aestheticKeywords.split(',').map(s => s.trim()).filter(Boolean),
      venueConsiderations: form.venueConsiderations,
      productionNotes: form.productionNotes,
      vendorCategories: form.vendorCategories.split(',').map(s => s.trim()).filter(Boolean),
      experienceDesign: form.experienceDesign.filter(m => m.moment),
      successMetrics: form.successMetrics.filter(m => m.label),
    }
    await supabase.from('projects').update({ concept_data }).eq('id', event.id)
    setSaving(false)
    setSaved(true)
    setEditMode(false)
    onSave(concept_data)
    setTimeout(() => setSaved(false), 2000)
  }

  const sectionLabel = { fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7C5CBF', marginBottom: '10px' }
  const card = { backgroundColor: '#fff', borderRadius: '14px', padding: '22px 24px', border: '1px solid #f0f0eb', marginBottom: '16px' }
  const inp = { padding: '9px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '13px', color: '#1A1A2E', outline: 'none', backgroundColor: '#fff', width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' }

  if (!editMode && event.concept_data) {
    const c = event.concept_data
    const tagViolet = { background: '#F0EBF9', color: '#7C5CBF' }
    const tagSage = { background: '#EAF2EA', color: '#6B8F71' }
    const tagAmber = { background: '#FBF0E6', color: '#D4874E' }
    const tagStyles = [tagViolet, tagSage, tagAmber]
    const tag = { fontSize: '12px', padding: '4px 11px', borderRadius: '100px', fontWeight: '500', display: 'inline-block' }
    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <button onClick={() => setEditMode(true)} style={btnStyles.secondary}>✏️ Edit Concept</button>
        </div>
        {c.coreConcept && (
          <div style={card}>
            <div style={sectionLabel}>Core Concept</div>
            <p style={{ fontSize: '14px', color: '#3D3D5C', lineHeight: '1.65', margin: 0 }}>{c.coreConcept}</p>
            {c.goals && <>
              <hr style={{ border: 'none', borderTop: '1px solid #f0f0eb', margin: '16px 0' }} />
              <div style={sectionLabel}>Goals</div>
              <p style={{ fontSize: '14px', color: '#3D3D5C', lineHeight: '1.65', margin: 0 }}>{c.goals}</p>
            </>}
          </div>
        )}
        {c.experienceDesign?.filter(m => m.moment).length > 0 && (
          <div style={card}>
            <div style={sectionLabel}>Key Moments</div>
            {c.experienceDesign.filter(m => m.moment).map((m, i) => (
              <div key={i} style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1A2E', marginBottom: '2px' }}>{m.moment}</div>
                {m.description && <div style={{ fontSize: '13px', color: '#8585A0', lineHeight: '1.55' }}>{m.description}</div>}
              </div>
            ))}
          </div>
        )}
        <div style={card}>
          {c.aestheticKeywords?.length > 0 && <>
            <div style={sectionLabel}>Aesthetic Keywords</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
              {c.aestheticKeywords.map((k, i) => <span key={i} style={{ ...tag, ...tagStyles[i % tagStyles.length] }}>{k}</span>)}
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #f0f0eb', margin: '0 0 16px' }} />
          </>}
          {c.venueConsiderations && <>
            <div style={sectionLabel}>Venue Considerations</div>
            <p style={{ fontSize: '14px', color: '#3D3D5C', lineHeight: '1.65', margin: '0 0 16px' }}>{c.venueConsiderations}</p>
            <hr style={{ border: 'none', borderTop: '1px solid #f0f0eb', margin: '0 0 16px' }} />
          </>}
          {c.productionNotes && <>
            <div style={sectionLabel}>Production Notes</div>
            <p style={{ fontSize: '14px', color: '#3D3D5C', lineHeight: '1.65', margin: '0 0 16px' }}>{c.productionNotes}</p>
            <hr style={{ border: 'none', borderTop: '1px solid #f0f0eb', margin: '0 0 16px' }} />
          </>}
          {c.vendorCategories?.length > 0 && <>
            <div style={sectionLabel}>Vendor Categories</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {c.vendorCategories.map((v, i) => <span key={i} style={{ ...tag, ...tagStyles[i % tagStyles.length] }}>{v}</span>)}
            </div>
          </>}
        </div>
        {c.successMetrics?.filter(m => m.label).length > 0 && (
          <div style={card}>
            <div style={sectionLabel}>Success Metrics</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {c.successMetrics.filter(m => m.label).map((m, i) => (
                <div key={i} style={{ background: '#F7F5F0', borderRadius: '8px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '11px', color: '#8585A0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{m.label}</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1A2E' }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div>
      {!event.concept_data && (
        <div style={{ ...card, textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>💡</div>
          <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1A2E', marginBottom: '4px' }}>Build your event concept</div>
          <div style={{ fontSize: '13px', color: '#8585A0' }}>Capture the core idea, goals, and experience design — perfect for intake calls and client alignment.</div>
        </div>
      )}

      {/* Core Concept & Goals */}
      <div style={card}>
        <div style={sectionLabel}>Core Concept *</div>
        <textarea value={form.coreConcept} onChange={e => setForm(f => ({ ...f, coreConcept: e.target.value }))} placeholder="The big idea — what is this event about at its core?" rows={3} style={{ ...inp, resize: 'vertical', marginBottom: '16px' }} />
        <div style={sectionLabel}>Goals</div>
        <textarea value={form.goals} onChange={e => setForm(f => ({ ...f, goals: e.target.value }))} placeholder="What does the client want to achieve? What does success look like?" rows={3} style={{ ...inp, resize: 'vertical' }} />
      </div>

      {/* Key Moments */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={sectionLabel}>Key Moments</div>
          <button onClick={addMoment} style={{ fontSize: '12px', color: '#7C5CBF', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ Add moment</button>
        </div>
        {form.experienceDesign.map((m, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '10px', marginBottom: '10px', alignItems: 'start' }}>
            <input value={m.moment} onChange={e => updateMoment(i, 'moment', e.target.value)} placeholder="Moment name" style={inp} />
            <input value={m.description} onChange={e => updateMoment(i, 'description', e.target.value)} placeholder="What happens, how it feels..." style={inp} />
            {form.experienceDesign.length > 1 && <button onClick={() => removeMoment(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8585A0', fontSize: '14px', paddingTop: '8px' }}>✕</button>}
          </div>
        ))}
      </div>

      {/* Aesthetic & Venue */}
      <div style={card}>
        <div style={sectionLabel}>Aesthetic Keywords</div>
        <input value={form.aestheticKeywords} onChange={e => setForm(f => ({ ...f, aestheticKeywords: e.target.value }))} placeholder="e.g. elevated, intimate, high-energy, modern, warm (comma separated)" style={{ ...inp, marginBottom: '16px' }} />
        <div style={sectionLabel}>Venue Considerations</div>
        <textarea value={form.venueConsiderations} onChange={e => setForm(f => ({ ...f, venueConsiderations: e.target.value }))} placeholder="Space requirements, indoor/outdoor, capacity, location preferences..." rows={2} style={{ ...inp, resize: 'vertical', marginBottom: '16px' }} />
        <div style={sectionLabel}>Production Notes</div>
        <textarea value={form.productionNotes} onChange={e => setForm(f => ({ ...f, productionNotes: e.target.value }))} placeholder="A/V needs, staging, lighting, special production requirements..." rows={2} style={{ ...inp, resize: 'vertical', marginBottom: '16px' }} />
        <div style={sectionLabel}>Vendor Categories Needed</div>
        <input value={form.vendorCategories} onChange={e => setForm(f => ({ ...f, vendorCategories: e.target.value }))} placeholder="e.g. Catering, A/V, Photography, Venue (comma separated)" style={inp} />
      </div>

      {/* Success Metrics */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={sectionLabel}>Success Metrics</div>
          <button onClick={addMetric} style={{ fontSize: '12px', color: '#7C5CBF', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ Add metric</button>
        </div>
        {form.successMetrics.map((m, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
            <input value={m.label} onChange={e => updateMetric(i, 'label', e.target.value)} placeholder="Metric (e.g. Attendance)" style={inp} />
            <input value={m.value} onChange={e => updateMetric(i, 'value', e.target.value)} placeholder="Target (e.g. 500 guests)" style={inp} />
            {form.successMetrics.length > 1 && <button onClick={() => removeMetric(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8585A0', fontSize: '14px' }}>✕</button>}
          </div>
        ))}
      </div>

      {/* Save */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        <button onClick={handleSave} disabled={saving || !form.coreConcept} style={btnStyles.primary}>
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Concept'}
        </button>
        {event.concept_data && <button onClick={() => setEditMode(false)} style={btnStyles.cancel}>Cancel</button>}
      </div>
    </div>
  )
}