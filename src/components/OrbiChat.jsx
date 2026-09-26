import { useEffect, useRef, useState } from 'react'
import { theme as t } from '../theme'
import Orb from './Orb'
import { Icon } from './Icon'
import { sendOrbiTurn, TOOL_LABELS } from '../lib/orbiAgent'

const SUGGESTIONS = [
  "What's due this week?",
  'Any unpaid invoices?',
  'What should I focus on today?',
]

// Turns the raw conversation (Anthropic message format, owned by the
// server) into what the panel shows: user bubbles, Orbi's text, and a
// quiet "checked X" line for each tool call, marked if it failed or the
// user cancelled it.
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
        const declined = result?.is_error && typeof result.content === 'string' && result.content.startsWith('The user declined')
        items.push({
          key: `t${i}-${j}`,
          kind: 'activity',
          text: TOOL_LABELS[b.name] || b.name,
          state: !result ? 'pending' : declined ? 'declined' : result.is_error ? 'failed' : 'ok',
        })
      }
    })
  })
  return items
}

export default function OrbiChat({ isMobile }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [pending, setPending] = useState(null) // [{ id, tool, summary }] awaiting Confirm/Cancel
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleKey(e) { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handleKey)
    inputRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, pending, busy, open])

  async function runTurn(nextMessages, approval) {
    setBusy(true)
    setError(null)
    setMessages(nextMessages)
    try {
      const data = await sendOrbiTurn(nextMessages, approval)
      setMessages(data.messages)
      setPending(data.pending?.length ? data.pending : null)
    } catch (err) {
      setError(err.message)
      // Roll back a just-typed message so it can be retried; keep history
      // as the server last returned it.
      if (!approval) {
        setMessages(nextMessages.slice(0, -1))
        setInput(typeof nextMessages.at(-1)?.content === 'string' ? nextMessages.at(-1).content : '')
      }
    } finally {
      setBusy(false)
    }
  }

  function send(text) {
    const trimmed = text.trim()
    if (!trimmed || busy || pending) return
    setInput('')
    runTurn([...messages, { role: 'user', content: trimmed }])
  }

  function decide(approved) {
    if (busy) return
    setPending(null)
    runTurn(messages, { approved })
  }

  function newChat() {
    setMessages([])
    setPending(null)
    setError(null)
    setInput('')
    inputRef.current?.focus()
  }

  const transcript = toTranscript(messages)
  const bottom = isMobile ? 'calc(76px + env(safe-area-inset-bottom))' : '24px'

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Ask Orbi" title="Ask Orbi" style={{ ...s.launcher, bottom }}>
          <Orb size={40} animate={false} />
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Orbi"
          style={{
            ...s.panel,
            bottom,
            ...(isMobile ? { left: '12px', right: '12px', height: 'min(560px, calc(100vh - 160px))' } : { right: '24px', width: '380px', height: 'min(600px, calc(100vh - 120px))' }),
          }}
        >
          <div style={s.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Orb size={28} animate={false} />
              <span style={{ fontWeight: 700, color: t.colors.textPrimary, fontSize: t.fontSizes.base }}>Orbi</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {messages.length > 0 && (
                <button onClick={newChat} disabled={busy} style={s.textButton}>New chat</button>
              )}
              <button onClick={() => setOpen(false)} aria-label="Close" style={s.iconButton}>
                <Icon name="close" size="sm" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} style={s.body}>
            {transcript.length === 0 && !busy && (
              <div style={{ padding: '8px 4px' }}>
                <p style={{ margin: '0 0 14px', color: t.colors.textSecondary, fontSize: t.fontSizes.sm, lineHeight: 1.5 }}>
                  Hi! Ask me about your clients, projects, tasks or money — or have me add a task, draft an invoice, or schedule a post. I'll check with you before changing anything.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                  {SUGGESTIONS.map(q => (
                    <button key={q} onClick={() => send(q)} style={s.suggestion}>{q}</button>
                  ))}
                </div>
              </div>
            )}

            {transcript.map(item => {
              if (item.kind === 'user') return <div key={item.key} style={s.userBubble}>{item.text}</div>
              if (item.kind === 'orbi') return <div key={item.key} style={s.orbiBubble}>{item.text}</div>
              const color = item.state === 'failed' ? t.colors.danger : t.colors.textTertiary
              const suffix = item.state === 'declined' ? ' — cancelled' : item.state === 'failed' ? " — didn't work" : ''
              return (
                <div key={item.key} style={{ fontSize: t.fontSizes.xs, color, padding: '0 4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                  {item.text}{suffix}
                </div>
              )
            })}

            {pending && (
              <div style={s.pendingCard}>
                <div style={{ fontSize: t.fontSizes.sm, fontWeight: 600, color: t.colors.textPrimary, marginBottom: '8px' }}>
                  Okay to make {pending.length === 1 ? 'this change' : 'these changes'}?
                </div>
                <ul style={{ margin: '0 0 12px', paddingLeft: '18px', fontSize: t.fontSizes.sm, color: t.colors.textSecondary, lineHeight: 1.5 }}>
                  {pending.map(p => <li key={p.id}>{p.summary}</li>)}
                </ul>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => decide(false)} disabled={busy} style={s.secondaryButton}>Cancel</button>
                  <button onClick={() => decide(true)} disabled={busy} style={s.primaryButton}>Confirm</button>
                </div>
              </div>
            )}

            {busy && <div style={{ ...s.orbiBubble, color: t.colors.textTertiary, fontStyle: 'italic' }}>Thinking…</div>}
            {error && <div style={{ fontSize: t.fontSizes.sm, color: t.colors.danger, padding: '0 4px' }}>{error}</div>}
          </div>

          <form
            onSubmit={e => { e.preventDefault(); send(input) }}
            style={s.inputRow}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
              placeholder={pending ? 'Confirm or cancel above first' : 'Ask Orbi…'}
              disabled={!!pending}
              rows={1}
              maxLength={4000}
              style={s.textarea}
            />
            <button type="submit" disabled={busy || !!pending || !input.trim()} aria-label="Send" style={{ ...s.sendButton, opacity: busy || pending || !input.trim() ? 0.5 : 1 }}>
              <Icon name="send" size="sm" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}

const s = {
  launcher: { position: 'fixed', right: '24px', zIndex: 90, width: '56px', height: '56px', borderRadius: '50%', border: 'none', padding: 0, background: t.colors.bgCard, boxShadow: t.shadows.lg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  panel: { position: 'fixed', zIndex: 90, display: 'flex', flexDirection: 'column', backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, border: `1px solid ${t.colors.borderLight}`, boxShadow: t.shadows.lg, fontFamily: t.fonts.sans, overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 10px 14px', borderBottom: `1px solid ${t.colors.borderLight}` },
  body: { flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '10px' },
  userBubble: { alignSelf: 'flex-end', maxWidth: '85%', padding: '8px 12px', borderRadius: '14px 14px 4px 14px', backgroundColor: t.colors.primary, color: '#FFFFFF', fontSize: t.fontSizes.sm, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  orbiBubble: { alignSelf: 'flex-start', maxWidth: '90%', padding: '8px 12px', borderRadius: '14px 14px 14px 4px', backgroundColor: t.colors.bg, color: t.colors.textPrimary, fontSize: t.fontSizes.sm, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  pendingCard: { padding: '12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.primaryLight}`, backgroundColor: t.colors.bgCard },
  suggestion: { padding: '6px 12px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, background: 'transparent', color: t.colors.textPrimary, fontFamily: t.fonts.sans, fontSize: t.fontSizes.sm, cursor: 'pointer', textAlign: 'left' },
  inputRow: { display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '10px 12px', borderTop: `1px solid ${t.colors.borderLight}` },
  textarea: { flex: 1, resize: 'none', maxHeight: '120px', padding: '9px 12px', borderRadius: '18px', border: `1px solid ${t.colors.border}`, fontFamily: t.fonts.sans, fontSize: t.fontSizes.sm, color: t.colors.textPrimary, backgroundColor: t.colors.bgCard, outline: 'none', lineHeight: 1.4 },
  sendButton: { width: '36px', height: '36px', borderRadius: '50%', border: 'none', backgroundColor: t.colors.primary, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  primaryButton: { flex: 1, padding: '8px', borderRadius: t.radius.full, border: 'none', backgroundColor: t.colors.primary, color: '#FFFFFF', fontSize: t.fontSizes.sm, fontWeight: 600, cursor: 'pointer', fontFamily: t.fonts.sans },
  secondaryButton: { flex: 1, padding: '8px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, backgroundColor: 'transparent', color: t.colors.textPrimary, fontSize: t.fontSizes.sm, fontWeight: 600, cursor: 'pointer', fontFamily: t.fonts.sans },
  textButton: { padding: '6px 10px', borderRadius: t.radius.full, border: 'none', background: 'transparent', color: t.colors.textSecondary, fontSize: t.fontSizes.xs, fontWeight: 600, cursor: 'pointer', fontFamily: t.fonts.sans },
  iconButton: { width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: 'transparent', color: t.colors.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
}
