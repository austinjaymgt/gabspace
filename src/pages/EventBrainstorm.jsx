import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'

const VIBES = [
  'Intimate & curated', 'Large & theatrical', 'Luxury & editorial',
  'Playful & unexpected', 'Raw & underground', 'Tech-forward',
  'Nature & organic', 'Nostalgic & retro', 'Cultural & community',
  'Minimal & architectural',
]

const EVENT_TYPES = [
  'Brand activation', 'Product launch', 'Immersive pop-up',
  'Community gathering', 'Gala / fundraiser', 'Workshop / masterclass',
  'Corporate experience', 'Art or cultural event', 'Wellness event',
  'Seasonal / holiday event',
]

const BUDGETS = [
  'Under $5K', '$5K – $15K', '$15K – $30K',
  '$30K – $75K', '$75K – $150K', '$150K+',
]

const STATUS_COLORS = {
  concept:   { background: '#F0EBF9', color: '#7C5CBF' },
  planning:  { background: '#fff8f0', color: '#cc7700' },
  confirmed: { background: '#f0faf6', color: '#1D9E75' },
  live:      { background: '#e8f4ff', color: '#1a6ecc' },
  wrapped:   { background: '#f5f5f5', color: '#888' },
}

function ConceptSection({ label, children }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{
        fontSize: '11px', fontWeight: '500', letterSpacing: '0.1em',
        textTransform: 'uppercase', color: '#7C5CBF', marginBottom: '10px',
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

const s = {
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    border: '0.5px solid rgba(0,0,0,0.09)',
    padding: '22px 24px',
    marginBottom: '16px',
  },
  sectionLabel: {
    fontSize: '11px', fontWeight: '500', letterSpacing: '0.1em',
    textTransform: 'uppercase', color: '#8585A0', marginBottom: '12px',
  },
  grid2: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '500', color: '#3D3D5C' },
  input: {
    fontFamily: 'inherit', fontSize: '14px', color: '#1A1A2E',
    background: '#F7F5F0', border: '0.5px solid rgba(0,0,0,0.15)',
    borderRadius: '8px', padding: '10px 12px', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  },
  chip: {
    fontSize: '12px', fontWeight: '500', padding: '6px 14px',
    borderRadius: '100px', border: '0.5px solid', cursor: 'pointer',
    fontFamily: 'inherit',
  },
  primaryBtn: {
    fontFamily: 'inherit', fontSize: '14px', fontWeight: '500',
    background: '#1A1A2E', color: '#fff', border: 'none',
    borderRadius: '100px', padding: '13px 24px', cursor: 'pointer',
  },
  promoteBtn: {
    fontFamily: 'inherit', fontSize: '12px', fontWeight: '500',
    background: '#7C5CBF', color: '#fff', border: 'none',
    borderRadius: '100px', padding: '8px 16px', cursor: 'pointer',
  },
  deleteBtn: {
    fontFamily: 'inherit', fontSize: '12px',
    background: '#fff0f0', color: '#cc3333', border: 'none',
    borderRadius: '8px', padding: '8px 12px', cursor: 'pointer',
  },
  metaPill: {
    fontSize: '11px', fontWeight: '500', padding: '4px 12px',
    borderRadius: '100px', border: '0.5px solid rgba(255,255,255,0.2)',
    color: 'rgba(255,255,255,0.7)',
  },
  divider: { border: 'none', borderTop: '0.5px solid rgba(0,0,0,0.08)', margin: '18px 0' },
  bodyText: { fontSize: '14px', color: '#3D3D5C', lineHeight: '1.65', margin: 0 },
  tag: { fontSize: '12px', padding: '4px 11px', borderRadius: '100px', fontWeight: '500' },
  tagViolet: { background: '#F0EBF9', color: '#7C5CBF' },
  tagSage:   { background: '#EAF2EA', color: '#6B8F71' },
  tagAmber:  { background: '#FBF0E6', color: '#D4874E' },
  tagRose:   { background: '#FAF0F2', color: '#C06B7A' },
  statusBadge: {
    fontSize: '11px', fontWeight: '500', padding: '4px 10px',
    borderRadius: '100px', letterSpacing: '0.04em',
  },
  errorMsg: {
    background: '#FAF0F2', color: '#C06B7A', borderRadius: '8px',
    padding: '10px 14px', fontSize: '13px', marginBottom: '12px',
  },
  successMsg: {
    background: '#EAF2EA', color: '#6B8F71', borderRadius: '8px',
    padding: '12px 16px', fontSize: '13px', fontWeight: '500',
  },
}

export default function EventBrainstorm({ workspaceId, session }) {
  const [vibes, setVibes] = useState([])
  const [form, setForm] = useState({
    eventName: '', clientName: '', eventType: '', audience: '',
    budget: '', headcount: '', goal: '', context: '',
  })
  const [generating, setGenerating] = useState(false)
  const [concept, setConcept] = useState(null)
  const [genError, setGenError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [concepts, setConcepts] = useState([])
  const [loadingConcepts, setLoadingConcepts] = useState(true)
  const [promoting, setPromoting] = useState(null)

  useEffect(() => { fetchConcepts() }, [workspaceId])

  async function fetchConcepts() {
    if (!workspaceId) return
    setLoadingConcepts(true)
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('type', 'event')
      .eq('event_status', 'concept')
      .order('created_at', { ascending: false })
    if (data) setConcepts(data)
    setLoadingConcepts(false)
  }

  function toggleVibe(v) {
    setVibes(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  }

  async function handleGenerate() {
    if (!form.eventType && !form.goal && !form.eventName) {
      setGenError('Fill in at least the event type and goal to get started.')
      return
    }
    setGenError('')
    setGenerating(true)
    setConcept(null)
    setSaveSuccess(false)

    const prompt = `You are an expert experiential marketing and event strategist. Generate a detailed, original event concept based on this brief:

Event name/title: ${form.eventName || 'TBD'}
Client/Brand: ${form.clientName || 'TBD'}
Event type: ${form.eventType || 'Not specified'}
Target audience: ${form.audience || 'Not specified'}
Budget range: ${form.budget || 'Not specified'}
Expected headcount: ${form.headcount || 'Not specified'}
Primary goal: ${form.goal || 'Not specified'}
Aesthetic/vibe direction: ${vibes.join(', ') || 'Open'}
Additional context: ${form.context || 'None'}

Respond ONLY with a valid JSON object. No markdown, no backticks, no preamble. Use exactly these keys:

{
  "conceptName": "A compelling specific name for this event concept",
  "tagline": "A short evocative one-line tagline",
  "coreConcept": "2-3 sentence description of the core concept and big idea",
  "why": "2-3 sentences explaining why this concept works for this brand, audience, and goal",
  "experienceDesign": [
    {"moment": "Moment name", "description": "What happens and why it creates impact"},
    {"moment": "Moment name", "description": "What happens and why it creates impact"},
    {"moment": "Moment name", "description": "What happens and why it creates impact"},
    {"moment": "Moment name", "description": "What happens and why it creates impact"}
  ],
  "runOfShow": [
    {"time": "Time block", "beat": "What happens"},
    {"time": "Time block", "beat": "What happens"},
    {"time": "Time block", "beat": "What happens"},
    {"time": "Time block", "beat": "What happens"},
    {"time": "Time block", "beat": "What happens"},
    {"time": "Time block", "beat": "What happens"}
  ],
  "venueConsiderations": "2-3 sentences on ideal venue type and spatial design",
  "productionNotes": "2-3 sentences on key production elements",
  "pressAndContent": "2-3 sentences on earned media and content strategy",
  "successMetrics": [
    {"label": "Metric", "value": "Target"},
    {"label": "Metric", "value": "Target"},
    {"label": "Metric", "value": "Target"}
  ],
  "vendorCategories": ["type1", "type2", "type3", "type4", "type5"],
  "aestheticKeywords": ["word1", "word2", "word3", "word4", "word5"],
  "budgetAllocation": [
    {"line": "Category", "pct": "Suggested %"},
    {"line": "Category", "pct": "Suggested %"},
    {"line": "Category", "pct": "Suggested %"},
    {"line": "Category", "pct": "Suggested %"}
  ]
}`

    try {
      const res = await supabase.functions.invoke('generate-event-concept', {
        body: { prompt },
    })
      const data = res.data
console.log('Edge function response:', JSON.stringify(data))
const raw = data.content?.map(b => b.text || '').join('')
      const clean = raw.replace(/```json|```/g, '').trim()
      setConcept(JSON.parse(clean))
    } catch (err) {
      console.error('Generation error:', err)
      setGenError(err?.message || JSON.stringify(err) || 'Something went wrong. Try again.')
    }
    setGenerating(false)
  }

  async function handleSaveConcept() {
    if (!concept || !workspaceId) return
    setSaving(true)
    const { error } = await supabase.from('projects').insert({
      workspace_id: workspaceId,
      user_id: session.user.id,
      title: concept.conceptName,
      type: 'event',
      event_status: 'concept',
      headcount: form.headcount ? parseInt(form.headcount) : null,
      budget: form.budget || null,
      description: concept.tagline,
      notes: concept.coreConcept,
      concept_data: { ...concept, brief: { ...form, vibes } },
    })
    if (!error) {
      setSaveSuccess(true)
      fetchConcepts()
    }
    setSaving(false)
  }

  async function handlePromote(id) {
    setPromoting(id)
    await supabase.from('projects').update({ event_status: 'planning' }).eq('id', id)
    fetchConcepts()
    setPromoting(null)
  }

  async function handleDeleteConcept(id) {
    if (!confirm('Delete this concept?')) return
    await supabase.from('projects').delete().eq('id', id)
    fetchConcepts()
  }

  const tagStyles = [s.tagViolet, s.tagSage, s.tagAmber, s.tagRose]

  return (
    <div style={{ padding: '32px', maxWidth: '860px' }}>

      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 4px' }}>
          Event Brainstorm
        </h2>
        <p style={{ fontSize: '13px', color: t.colors.textTertiary, margin: 0 }}>
          Describe your brief and generate a full experiential concept
        </p>
      </div>

      {/* Brief form */}
      <div style={s.card}>
        <div style={s.sectionLabel}>Event Brief</div>
        <div style={s.grid2}>
          <div style={s.field}>
            <label style={s.label}>Event name or working title</label>
            <input style={s.input} placeholder="e.g. Spring Gala, Brand Launch…"
              value={form.eventName} onChange={e => setForm({ ...form, eventName: e.target.value })} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Client / brand</label>
            <input style={s.input} placeholder="e.g. Solis Studio"
              value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Event type</label>
            <select style={s.input} value={form.eventType} onChange={e => setForm({ ...form, eventType: e.target.value })}>
              <option value="">Select a type…</option>
              {EVENT_TYPES.map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Audience</label>
            <input style={s.input} placeholder="e.g. Gen Z creatives, luxury consumers"
              value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Estimated budget</label>
            <select style={s.input} value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })}>
              <option value="">Select range…</option>
              {BUDGETS.map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Expected headcount</label>
            <input style={s.input} placeholder="e.g. 50, 200–500"
              value={form.headcount} onChange={e => setForm({ ...form, headcount: e.target.value })} />
          </div>
          <div style={{ ...s.field, gridColumn: 'span 2' }}>
            <label style={s.label}>Brand or event goal</label>
            <input style={s.input} placeholder="e.g. Drive awareness, generate press, reward loyal customers"
              value={form.goal} onChange={e => setForm({ ...form, goal: e.target.value })} />
          </div>
          <div style={{ ...s.field, gridColumn: 'span 2' }}>
            <label style={s.label}>Additional context or must-haves</label>
            <textarea style={{ ...s.input, minHeight: '72px', resize: 'vertical', lineHeight: '1.55' }}
              placeholder="Location ideas, themes, constraints, inspiration, specific moments you want to create…"
              value={form.context} onChange={e => setForm({ ...form, context: e.target.value })} />
          </div>
        </div>

        <div style={s.sectionLabel}>Vibe & aesthetic direction</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
          {VIBES.map(v => (
            <button key={v} onClick={() => toggleVibe(v)} style={{
              ...s.chip,
              backgroundColor: vibes.includes(v) ? '#7C5CBF' : '#fff',
              color: vibes.includes(v) ? '#fff' : t.colors.textSecondary,
              borderColor: vibes.includes(v) ? '#7C5CBF' : t.colors.border,
            }}>
              {v}
            </button>
          ))}
        </div>

        {genError && <div style={s.errorMsg}>{genError}</div>}

        <button onClick={handleGenerate} disabled={generating}
          style={{ ...s.primaryBtn, width: '100%', opacity: generating ? 0.6 : 1 }}>
          {generating ? 'Generating concept…' : 'Generate Event Concept'}
        </button>
      </div>

      {/* Loading state */}
      {generating && (
        <div style={{ ...s.card, textAlign: 'center', padding: '48px', color: t.colors.textTertiary }}>
          Building your concept…
        </div>
      )}

      {/* Generated concept */}
      {concept && !generating && (
        <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ background: '#1A1A2E', padding: '24px 28px' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#fff', marginBottom: '4px', letterSpacing: '-0.3px' }}>
              {concept.conceptName}
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
              {concept.tagline}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
              {form.eventType && <span style={s.metaPill}>{form.eventType}</span>}
              {form.budget && <span style={s.metaPill}>{form.budget}</span>}
              {form.headcount && <span style={s.metaPill}>{form.headcount} guests</span>}
            </div>
          </div>

          <div style={{ padding: '24px 28px' }}>
            <ConceptSection label="The Big Idea">
              <p style={s.bodyText}>{concept.coreConcept}</p>
            </ConceptSection>
            <ConceptSection label="Why It Works">
              <p style={s.bodyText}>{concept.why}</p>
            </ConceptSection>

            <hr style={s.divider} />

            <ConceptSection label="Experience Design — Key Moments">
              {concept.experienceDesign.map((m, i) => (
                <div key={i} style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: t.colors.textPrimary, marginBottom: '2px' }}>{m.moment}</div>
                  <div style={{ fontSize: '13px', color: t.colors.textTertiary, lineHeight: '1.55' }}>{m.description}</div>
                </div>
              ))}
            </ConceptSection>

            <hr style={s.divider} />

            <ConceptSection label="Run of Show">
              {concept.runOfShow.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '500', color: '#7C5CBF', minWidth: '80px', paddingTop: '2px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{r.time}</span>
                  <span style={{ fontSize: '13px', color: t.colors.textSecondary, lineHeight: '1.55', flex: 1 }}>{r.beat}</span>
                </div>
              ))}
            </ConceptSection>

            <hr style={s.divider} />

            <ConceptSection label="Venue & Space">
              <p style={s.bodyText}>{concept.venueConsiderations}</p>
            </ConceptSection>
            <ConceptSection label="Production Notes">
              <p style={s.bodyText}>{concept.productionNotes}</p>
            </ConceptSection>
            <ConceptSection label="Press & Content Strategy">
              <p style={s.bodyText}>{concept.pressAndContent}</p>
            </ConceptSection>

            <hr style={s.divider} />

            <ConceptSection label="Success Metrics">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {concept.successMetrics.map((m, i) => (
                  <div key={i} style={{ background: '#F7F5F0', borderRadius: '8px', padding: '12px 14px', border: '0.5px solid rgba(0,0,0,0.07)' }}>
                    <div style={{ fontSize: '11px', color: t.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{m.label}</div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: t.colors.textPrimary }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </ConceptSection>

            <hr style={s.divider} />

            <ConceptSection label="Vendor Categories">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {concept.vendorCategories.map((v, i) => (
                  <span key={i} style={{ ...s.tag, ...tagStyles[i % tagStyles.length] }}>{v}</span>
                ))}
              </div>
            </ConceptSection>
            <ConceptSection label="Aesthetic Keywords">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {concept.aestheticKeywords.map((k, i) => (
                  <span key={i} style={{ ...s.tag, ...s.tagViolet }}>{k}</span>
                ))}
              </div>
            </ConceptSection>
            <ConceptSection label="Budget Allocation">
              {concept.budgetAllocation.map((b, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span style={{ color: t.colors.textSecondary }}>{b.line}</span>
                  <span style={{ fontWeight: '500', color: '#7C5CBF' }}>{b.pct}</span>
                </div>
              ))}
            </ConceptSection>

            <hr style={s.divider} />

            {saveSuccess ? (
              <div style={s.successMsg}>✓ Concept saved — find it in your Saved Concepts below</div>
            ) : (
              <button onClick={handleSaveConcept} disabled={saving}
                style={{ ...s.primaryBtn, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save Concept to Events'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Saved concepts */}
      <div style={{ marginTop: '40px' }}>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '15px', fontWeight: '600', color: t.colors.textPrimary }}>Saved Concepts</div>
          <div style={{ fontSize: '12px', color: t.colors.textTertiary, marginTop: '2px' }}>
            Promote a concept to move it into active event planning
          </div>
        </div>

        {loadingConcepts ? (
          <div style={{ fontSize: '13px', color: t.colors.textTertiary, padding: '24px 0' }}>Loading…</div>
        ) : concepts.length === 0 ? (
          <div style={{ ...s.card, textAlign: 'center', padding: '40px', color: t.colors.textTertiary, fontSize: '13px' }}>
            No saved concepts yet. Generate one above and save it.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {concepts.map(c => (
              <div key={c.id} style={{ ...s.card, marginBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: t.colors.textPrimary, marginBottom: '3px' }}>{c.title}</div>
                  <div style={{ fontSize: '12px', color: t.colors.textTertiary }}>{c.description}</div>
                  {c.concept_data?.brief?.eventType && (
                    <div style={{ fontSize: '11px', color: '#7C5CBF', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {c.concept_data.brief.eventType}
                      {c.concept_data.brief.budget ? ` · ${c.concept_data.brief.budget}` : ''}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ ...s.statusBadge, ...STATUS_COLORS.concept }}>Concept</span>
                  <button onClick={() => handlePromote(c.id)} disabled={promoting === c.id}
                    style={{ ...s.promoteBtn, opacity: promoting === c.id ? 0.6 : 1 }}>
                    {promoting === c.id ? 'Moving…' : 'Move to Planning →'}
                  </button>
                  <button onClick={() => handleDeleteConcept(c.id)} style={s.deleteBtn}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
