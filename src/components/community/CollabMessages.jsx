import { useState, useEffect, useRef } from 'react'
import { theme as t } from '../../theme'
import { Icon } from '../Icon'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { fetchThreadMessages, sendMessage, markThreadRead, friendlyError } from '../../utils/community'
import { Avatar, EmptyState, ErrorText } from './CommunityUI'
import { cardStyle, textareaStyle, primaryButtonStyle } from './communityStyles'

const POLL_MS = 10000

function timeLabel(value) {
  const d = new Date(value)
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Messages tab on My Collabs: thread list + open thread. One thread per
// accepted response; `threads` comes from the page so the tab badge and the
// list share one fetch.
export default function CollabMessages({ threads, selectedId, onSelect, onThreadsChanged, onOpen }) {
  const isMobile = useIsMobile()
  const selected = threads.find(th => th.response_id === selectedId) || null

  if (!threads.length) {
    return <EmptyState icon="message">No conversations yet. A thread opens here when a response is accepted — on your requests or on ones you've responded to.</EmptyState>
  }

  const list = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...(isMobile ? {} : { width: '300px', flexShrink: 0 }) }}>
      {threads.map(th => {
        const active = th.response_id === selectedId
        return (
          <button
            key={th.response_id}
            className="gs-cm-card gs-cm-card--link"
            onClick={() => onSelect(th.response_id)}
            style={{
              ...cardStyle,
              padding: '12px 14px',
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: t.fonts.sans,
              borderColor: active ? t.colors.primary : t.colors.borderLight,
              backgroundColor: active ? t.colors.primaryLight : t.colors.bgCard,
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
            }}
          >
            <Avatar name={th.counterpart_name} id={th.counterpart_business_space_id} size={36} />
            <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: t.fontSizes.sm, fontWeight: th.unread ? 700 : 600, color: t.colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{th.counterpart_name}</span>
              {th.unread > 0 && (
                <span style={{ background: t.colors.primary, color: '#fff', fontSize: '10px', fontWeight: 700, borderRadius: t.radius.full, minWidth: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', flexShrink: 0 }}>{th.unread}</span>
              )}
            </div>
            <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {th.role === 'poster' ? 'Responded to your request' : 'Your response'} · {th.request_title}
            </span>
            <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {th.last_message ? th.last_message.body : 'No messages yet — say hello'}
            </span>
            </div>
          </button>
        )
      })}
    </div>
  )

  if (isMobile) {
    return selected
      ? <Thread key={selected.response_id} thread={selected} onBack={() => onSelect(null)} onSent={onThreadsChanged} onRead={onThreadsChanged} onOpen={onOpen} />
      : list
  }

  return (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
      {list}
      <div style={{ flex: 1, minWidth: 0 }}>
        {selected
          ? <Thread key={selected.response_id} thread={selected} onSent={onThreadsChanged} onRead={onThreadsChanged} onOpen={onOpen} />
          : <div className="gs-cm-card" style={{ ...cardStyle, padding: '48px 24px', textAlign: 'center', color: t.colors.textTertiary, fontSize: t.fontSizes.sm }}>Pick a conversation.</div>}
      </div>
    </div>
  )
}

function Thread({ thread, onBack, onSent, onRead, onOpen }) {
  const [messages, setMessages] = useState(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  // Load, mark read, then poll while the thread is open (no realtime yet).
  useEffect(() => {
    let cancelled = false
    const load = () => fetchThreadMessages(thread.response_id)
      .then(rows => { if (!cancelled) setMessages(rows) })
      .catch(err => { if (!cancelled) setError(err.message) })
    load()
    if (thread.unread) markThreadRead(thread.response_id).then(onRead)
    const id = setInterval(load, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.response_id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages?.length])

  async function handleSend(e) {
    e.preventDefault()
    if (!draft.trim() || sending) return
    setSending(true)
    setError('')
    try {
      await sendMessage({ responseId: thread.response_id, businessSpaceId: thread.my_business_space_id, body: draft })
      setDraft('')
      setMessages(await fetchThreadMessages(thread.response_id))
      onSent?.()
    } catch (err) {
      setError(friendlyError(err))
    }
    setSending(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) handleSend(e)
  }

  return (
    <div className="gs-cm-card" style={{ ...cardStyle, padding: 0, display: 'flex', flexDirection: 'column', height: 'min(560px, calc(100dvh - 260px))', minHeight: '360px', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.colors.borderLight}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
        {onBack && (
          <button onClick={onBack} aria-label="Back to conversations" style={{ background: 'none', border: 'none', padding: 0, color: t.colors.textTertiary, cursor: 'pointer', display: 'flex' }}>
            <Icon name="back" size="sm" />
          </button>
        )}
        <Avatar name={thread.counterpart_name} id={thread.counterpart_business_space_id} size={36} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <button onClick={() => onOpen('community-listing', thread.counterpart_business_space_id)} style={{ background: 'none', border: 'none', padding: 0, fontSize: t.fontSizes.md, fontWeight: 600, color: t.colors.textPrimary, fontFamily: t.fonts.sans, cursor: 'pointer' }}>
            {thread.counterpart_name}
          </button>
          <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Re:{' '}
            <button onClick={() => onOpen('community-request', thread.request_id)} style={{ background: 'none', border: 'none', padding: 0, color: t.colors.primary, fontSize: 'inherit', fontFamily: t.fonts.sans, cursor: 'pointer' }}>
              {thread.request_title}
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages === null ? (
          <div style={{ color: t.colors.textTertiary, fontSize: t.fontSizes.sm, textAlign: 'center' }}>Loading…</div>
        ) : messages.length === 0 ? (
          <div style={{ color: t.colors.textTertiary, fontSize: t.fontSizes.sm, textAlign: 'center', margin: 'auto 0' }}>
            You're connected with {thread.counterpart_name}. Say hello to get the collab started.
          </div>
        ) : messages.map(m => {
          const fromMe = m.sender_business_space_id === thread.my_business_space_id
          return (
            <div key={m.id} style={{ alignSelf: fromMe ? 'flex-end' : 'flex-start', maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: fromMe ? 'flex-end' : 'flex-start', gap: '2px' }}>
              <div className={fromMe ? 'gs-cm-bubble-mine' : undefined} style={{
                padding: '9px 14px',
                borderRadius: fromMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                backgroundColor: fromMe ? t.colors.primary : t.colors.bgHover,
                color: fromMe ? '#fff' : t.colors.textPrimary,
                fontSize: t.fontSizes.sm,
                lineHeight: 1.45,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {m.body}
              </div>
              <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary }}>
                {fromMe ? 'You' : m.sender_display_name} · {timeLabel(m.created_at)}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={{ padding: '12px', borderTop: `1px solid ${t.colors.borderLight}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <ErrorText>{error}</ErrorText>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={2000}
            rows={1}
            placeholder="Write a message… (Enter to send, Shift+Enter for a new line)"
            style={{ ...textareaStyle, minHeight: '40px', maxHeight: '120px', flex: 1 }}
          />
          <button className="gs-cm-button" type="submit" disabled={!draft.trim() || sending} style={primaryButtonStyle(!draft.trim() || sending)}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}
