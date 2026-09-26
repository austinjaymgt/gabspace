import { useEffect, useRef, useState } from 'react'
import { theme as t } from '../theme'
import Orb from './Orb'
import { Icon } from './Icon'
import QuickAddPreviewCard from './QuickAddPreviewCard'
import { sendOrbiTurn, TOOL_LABELS } from '../lib/orbiAgent'
import { saveQuickAddItems } from '../lib/quickAddSave'

const INPUT_MAX_LEN = 2000

// Turns the raw conversation (Anthropic message format, owned by the
// server) into what the card shows: the user's messages, Orbi's text, and
// a quiet "checked X" line per tool call, marked if it failed or was
// cancelled.
function toTranscript(messages) {
  const results = {}
  for (const m of messages) {
    if (m.role === 'user' && Array.isArray(m.content)) {
      for (const b of m.content) if (b.type === 'tool_result') results[b.tool_use_id] = b
    }
  }

  const items = []
  messages.forEach((m, i) => {
    if (m.role === 'user') {
      const text = typeof m.content === 'string'
        ? m.content
        : m.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
      if (text.trim()) items.push({ key: `u${i}`, kind: 'user', text })
      return
    }
    const blocks = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content
    blocks.forEach((b, j) => {
      if (b.type === 'text' && b.text.trim()) {
        items.push({ key: `a${i}-${j}`, kind: 'orbi', text: b.text })
      } else if (b.type === 'tool_use') {
        const result = results[b.id]
        const text = typeof result?.content === 'string' ? result.content : ''
        const cancelled = result?.is_error && /^The user (declined|cancelled)/.test(text)
        items.push({
          key: `t${i}-${j}`,
          kind: 'activity',
          text: TOOL_LABELS[b.name] || b.name,
          state: !result ? 'pending' : cancelled ? 'cancelled' : result.is_error ? 'failed' : 'ok',
        })
      }
    })
  })
  return items
}

// The Dashboard's Orbi box: ask questions or jot things down in one place.
// Questions become a conversation in the card; notes come back as editable
// Quick Add drafts that are saved from here on "Add all".
export default function OrbiCard({ session, onItemsAdded }) {
  const [messages, setMessages] = useState([])
  const [pending, setPending] = useState(null) // server's pending entries awaiting review
  const [drafts, setDrafts] = useState({}) // editable copies of quick_add items, by pending id
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showInfo, setShowInfo] = useState(false)
  const inputRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
    el.style.overflowY = el.scrollHeight > 220 ? 'auto' : 'hidden'
  }, [input])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  function receive(data) {
    setMessages(data.messages)
    const next = data.pending?.length ? data.pending : null
    setPending(next)
    setDrafts(Object.fromEntries((next || [])
      .filter(p => p.kind === 'quick_add')
      .map(p => [p.id, p.items.map(item => ({ ...item, fields: { ...item.fields } }))])))
  }

  async function runTurn(nextMessages, approval) {
    setBusy(true)
    setError(null)
    setMessages(nextMessages)
    try {
      receive(await sendOrbiTurn(nextMessages, approval))
    } catch (err) {
      setError(err.message)
      if (!approval) {
        // Put a just-typed message back so it can be retried.
        setMessages(nextMessages.slice(0, -1))
        const last = nextMessages.at(-1)?.content
        setInput(typeof last === 'string' ? last : '')
      }
    } finally {
      setBusy(false)
    }
  }

  function send() {
    const text = input.trim()
    if (!text || busy || pending) return
    setInput('')
    runTurn([...messages, { role: 'user', content: text }])
  }

  async function confirm() {
    if (busy || saving || !pending) return
    const quickAdds = pending.filter(p => p.kind === 'quick_add')
    let result = ''
    if (quickAdds.length) {
      setSaving(true)
      setError(null)
      try {
        const parts = []
        for (const p of quickAdds) {
          const items = drafts[p.id] || []
          if (items.length) parts.push(await saveQuickAddItems(items, { businessSpaceId: p.business_space_id, userId: session.user.id }))
        }
        result = parts.filter(Boolean).join(', ') || 'nothing (they removed every draft)'
        onItemsAdded?.()
      } catch (err) {
        setSaving(false)
        setError(err.message || 'Something went wrong saving those.')
        return
      }
      setSaving(false)
    }
    setPending(null)
    runTurn(messages, { approved: true, result })
  }

  function cancel() {
    if (busy || saving) return
    setPending(null)
    runTurn(messages, { approved: false })
  }

  // Ends the conversation and returns the card to its empty state. Any
  // unreviewed drafts are simply dropped - nothing is saved until "Add all".
  function closeChat() {
    setMessages([])
    setPending(null)
    setDrafts({})
    setError(null)
    setInput('')
    inputRef.current?.blur()
  }

  function updateDraft(pendingId, index, field, value) {
    setDrafts(prev => ({ ...prev, [pendingId]: prev[pendingId].map((item, i) => i === index ? { ...item, fields: { ...item.fields, [field]: value } } : item) }))
  }

  function removeDraft(pendingId, index) {
    setDrafts(prev => ({ ...prev, [pendingId]: prev[pendingId].filter((_, i) => i !== index) }))
  }

  const transcript = toTranscript(messages)
  const draftCount = Object.values(drafts).reduce((n, list) => n + list.length, 0)
  const hasQuickAdd = pending?.some(p => p.kind === 'quick_add')

  return (
    <div style={{ backgroundColor: t.colors.bgCard, border: `1px solid ${t.colors.borderLight}`, borderRadius: t.radius.card, padding: '28px 32px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Orb size={18} />
          <span style={{ fontSize: t.fontSizes.sm, fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', color: t.colors.textTertiary }}>
            Orbi
          </span>
          <button
            onClick={() => setShowInfo(v => !v)}
            aria-label="How Orbi works"
            style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: t.colors.textTertiary }}
          >
            <Icon name="info" size="sm" />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {(busy || saving) && (
            <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>{saving ? 'Adding…' : 'Thinking…'}</span>
          )}
          {messages.length > 0 && !busy && !saving && (
            <button
              onClick={closeChat}
              aria-label="Close chat"
              title="Close chat (Esc)"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: t.radius.full, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: t.colors.textTertiary }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = t.colors.bg}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Icon name="close" size="sm" />
            </button>
          )}
        </div>
      </div>
      {showInfo && (
        <div style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, marginBottom: '14px', marginTop: '-6px' }}>
          Ask about your clients, projects, tasks or money, or jot something down naturally and Orbi will draft the right items — client, task, project, event, goal, income, expense or invoice. You confirm before anything is created or changed.
        </div>
      )}

      {transcript.length > 0 && (
        <div ref={scrollRef} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto', marginBottom: '16px', paddingRight: '4px' }}>
          {transcript.map(item => {
            if (item.kind === 'user') return <div key={item.key} style={s.userBubble}>{item.text}</div>
            if (item.kind === 'orbi') return <div key={item.key} style={s.orbiBubble}>{item.text}</div>
            const color = item.state === 'failed' ? '#B3453D' : t.colors.textTertiary
            const suffix = item.state === 'cancelled' ? ' — cancelled' : item.state === 'failed' ? " — didn't work" : ''
            return (
              <div key={item.key} style={{ fontSize: t.fontSizes.xs, color, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                {item.text}{suffix}
              </div>
            )
          })}
        </div>
      )}

      {pending && (
        <div style={{ backgroundColor: t.colors.bg, border: `1px solid ${t.colors.borderLight}`, borderRadius: t.radius.lg, padding: '16px', marginBottom: '16px' }}>
          {pending.map(p => p.kind === 'quick_add' ? (
            <div key={p.id} style={{ marginBottom: '12px' }}>
              {p.business_name && (
                <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginBottom: '8px' }}>Adding to {p.business_name}</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                {(drafts[p.id] || []).map((item, i) => (
                  <QuickAddPreviewCard
                    key={i}
                    item={item}
                    onChange={(field, value) => updateDraft(p.id, i, field, value)}
                    onRemove={() => removeDraft(p.id, i)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div key={p.id} style={{ fontSize: t.fontSizes.sm, color: t.colors.textPrimary, marginBottom: '12px', display: 'flex', gap: '8px' }}>
              <Icon name="info" size="sm" />
              <span>{p.summary}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={confirm} disabled={busy || saving} style={{ ...s.primaryButton, opacity: busy || saving ? 0.6 : 1 }}>
              {saving ? 'Adding…' : hasQuickAdd ? `Add all (${draftCount})` : 'Confirm'}
            </button>
            <button onClick={cancel} disabled={busy || saving} style={s.secondaryButton}>Cancel</button>
          </div>
        </div>
      )}

      <textarea
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
          else if (e.key === 'Escape' && messages.length && !busy && !saving) closeChat()
        }}
        disabled={busy || !!pending}
        placeholder={pending ? 'Review the drafts above first…' : messages.length ? 'Reply to Orbi…' : "Ask me anything, or jot it down — met Sarah from Bloom Events, need to send her a proposal by Friday…"}
        maxLength={INPUT_MAX_LEN}
        rows={1}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '18px 24px', borderRadius: t.radius.xl,
          border: `1px solid ${t.colors.border}`,
          backgroundColor: t.colors.bg, color: t.colors.textPrimary,
          fontSize: t.fontSizes.md, fontFamily: t.fonts.sans,
          outline: 'none', opacity: busy || pending ? 0.6 : 1,
          resize: 'none', overflow: 'hidden', maxHeight: '220px',
          lineHeight: 1.5,
        }}
      />
      {input.length > INPUT_MAX_LEN * 0.8 && (
        <div style={{ textAlign: 'right', marginTop: '4px', fontSize: t.fontSizes.xs, color: input.length >= INPUT_MAX_LEN ? '#B3453D' : t.colors.textTertiary }}>
          {input.length} / {INPUT_MAX_LEN}
        </div>
      )}
      {error && (
        <div style={{ marginTop: '10px', fontSize: t.fontSizes.sm, color: '#B3453D' }}>{error}</div>
      )}
    </div>
  )
}

const s = {
  userBubble: { alignSelf: 'flex-end', maxWidth: '80%', padding: '10px 14px', borderRadius: '16px 16px 4px 16px', backgroundColor: t.colors.primary, color: t.colors.textInverse, fontSize: t.fontSizes.sm, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  orbiBubble: { alignSelf: 'flex-start', maxWidth: '85%', padding: '10px 14px', borderRadius: '16px 16px 16px 4px', backgroundColor: t.colors.bg, color: t.colors.textPrimary, fontSize: t.fontSizes.sm, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  primaryButton: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: t.radius.full, border: 'none', backgroundColor: t.colors.primary, color: t.colors.textInverse, fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans },
  secondaryButton: { padding: '9px 18px', borderRadius: t.radius.full, border: `1px solid ${t.colors.borderLight}`, backgroundColor: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans },
}
