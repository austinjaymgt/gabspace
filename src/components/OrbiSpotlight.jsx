import { useState, useEffect, useCallback } from 'react'
import { theme as t } from '../theme'
import Orb from './Orb'
import { useIsMobile } from '../hooks/useMediaQuery'

// The dimmed spotlight + Orbi speech bubble shared by the Orbi tour and
// the first-visit page hints. Each step points at an element tagged with
// data-tour="<target>"; steps without a target (or whose target never
// shows up) get a centered bubble. `page` switches the app there before
// the step's target is looked up; `largeOrb` gives a step the bigger,
// drifting Orbi. The caller owns the buttons via renderFooter.
const BUBBLE_WIDTH = 340
const BUBBLE_EST_HEIGHT = 230
const GAP = 14
const PAD = 6
const MAX_WAIT_FRAMES = 90

function findTarget(target) {
  return document.querySelector(`[data-tour="${target}"]`)
}

export default function OrbiSpotlight({ steps, label, currentPage, onNavigate, onClose, renderBody, renderFooter }) {
  const isMobile = useIsMobile()
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [rect, setRect] = useState(null)
  const step = steps[Math.min(index, steps.length - 1)]
  const isFirst = index === 0
  const isLast = index === steps.length - 1

  const goTo = useCallback((next, dir) => {
    if (next < 0 || next >= steps.length) return
    const nextStep = steps[next]
    if (nextStep.page && nextStep.page !== currentPage) onNavigate(nextStep.page)
    setDirection(dir)
    setIndex(next)
  }, [steps, currentPage, onNavigate])

  // Find the step's target (it may only mount after a page switch), bring
  // it into view and track its position. A target that never shows up —
  // e.g. hidden by the current layout — is skipped in the travel direction.
  useEffect(() => {
    let frame = 0
    let raf
    let el = null

    function measure() {
      if (!el) return
      const r = el.getBoundingClientRect()
      setRect({ stepId: step.id, top: r.top, left: r.left, width: r.width, height: r.height })
    }

    function look() {
      if (!step.target) { setRect(null); return }
      el = findTarget(step.target)
      if (el) {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        measure()
        return
      }
      if (++frame < MAX_WAIT_FRAMES) { raf = requestAnimationFrame(look); return }
      const next = index + direction
      if (next >= 0 && next < steps.length) goTo(next, direction)
      else setRect(null)
    }

    raf = requestAnimationFrame(look)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step, index, direction, steps.length, goTo])

  const next = useCallback(() => goTo(index + 1, 1), [goTo, index])
  const back = useCallback(() => goTo(index - 1, -1), [goTo, index])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' && !isLast) next()
      else if (e.key === 'ArrowLeft' && index > 1) back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, isLast, next, back, onClose])

  // A rect measured for the previous step is ignored until this one's target is found.
  const spot = step.target && rect?.stepId === step.id ? clipToViewport(rect) : null
  const bubblePos = placeBubble(spot, isMobile)
  const nav = { index, isFirst, isLast, next, back, stepCount: steps.length }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={e => e.stopPropagation()}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, fontFamily: t.fonts.sans }}
    >
      {spot ? (
        <div style={{
          position: 'fixed',
          top: spot.top - PAD,
          left: spot.left - PAD,
          width: spot.width + PAD * 2,
          height: spot.height + PAD * 2,
          borderRadius: t.radius.lg,
          boxShadow: '0 0 0 9999px rgba(20, 12, 32, 0.55)',
          outline: '2px solid rgba(255,255,255,0.7)',
          transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
          pointerEvents: 'none',
        }} />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20, 12, 32, 0.55)' }} />
      )}

      <div
        key={step.id}
        style={{
          position: 'fixed',
          ...bubblePos,
          width: isMobile ? 'auto' : BUBBLE_WIDTH,
          background: t.colors.bgCard,
          borderRadius: t.radius.card,
          boxShadow: t.shadows.lg,
          padding: '20px 22px 18px',
          animation: 'orbi-tour-in 0.25s ease-out',
        }}
      >
        <style>{`@keyframes orbi-tour-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }`}</style>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
          <Orb size={step.largeOrb ? 44 : 32} animate={!!step.largeOrb} />
          <h3 style={{
            margin: 0,
            fontFamily: t.fonts.heading,
            fontSize: '18px',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: t.colors.textPrimary,
          }}>
            {step.title}
          </h3>
        </div>

        <p style={{ margin: 0, fontSize: t.fontSizes.md, lineHeight: 1.5, color: t.colors.textSecondary }}>
          {renderBody ? renderBody(step) : step.body}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '18px' }}>
          {renderFooter(nav)}
        </div>
      </div>
    </div>
  )
}

// Quiet text button for secondary actions (Skip, Turn off tips).
export function SpotlightLink({ onClick, children, style }) {
  return (
    <button
      onClick={onClick}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.colors.textTertiary, fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, padding: '8px 6px', ...style }}
    >
      {children}
    </button>
  )
}

export function SpotlightButton({ primary, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '9px 16px',
        borderRadius: t.radius.full,
        border: primary ? 'none' : `1px solid ${t.colors.border}`,
        background: primary ? t.colors.primary : 'transparent',
        color: primary ? '#fff' : t.colors.textPrimary,
        fontSize: t.fontSizes.sm,
        fontWeight: 600,
        fontFamily: t.fonts.sans,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

// Tall targets (the sidebar nav) can run past the viewport — only
// spotlight the visible part.
function clipToViewport(r) {
  const top = Math.max(r.top, PAD)
  const left = Math.max(r.left, PAD)
  const bottom = Math.min(r.top + r.height, window.innerHeight - PAD)
  const right = Math.min(r.left + r.width, window.innerWidth - PAD)
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
}

// Right of the target if it fits (sidebar items), otherwise below, then
// above; when nothing fits (a target filling the screen) it sits at the
// bottom of the viewport. On phones the bubble spans the width.
function placeBubble(spot, isMobile) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const edge = 16

  if (!spot) {
    return isMobile
      ? { left: edge, right: edge, top: '50%', transform: 'translateY(-50%)' }
      : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  }

  const horizontal = isMobile
    ? { left: edge, right: edge }
    : { left: clamp(spot.left + spot.width / 2 - BUBBLE_WIDTH / 2, edge, vw - BUBBLE_WIDTH - edge) }

  if (!isMobile && spot.left + spot.width + PAD + GAP + BUBBLE_WIDTH + edge <= vw && spot.width < vw / 3) {
    const left = spot.left + spot.width + PAD + GAP
    const inLowerHalf = spot.top + spot.height / 2 > vh / 2
    return inLowerHalf
      ? { left, bottom: clamp(vh - (spot.top + spot.height), edge, vh - BUBBLE_EST_HEIGHT - edge) }
      : { left, top: clamp(spot.top, edge, vh - BUBBLE_EST_HEIGHT - edge) }
  }
  if (vh - (spot.top + spot.height) >= BUBBLE_EST_HEIGHT + PAD + GAP + edge) {
    return { ...horizontal, top: spot.top + spot.height + PAD + GAP }
  }
  if (spot.top >= BUBBLE_EST_HEIGHT + PAD + GAP + edge) {
    return { ...horizontal, bottom: vh - spot.top + PAD + GAP }
  }
  return { ...horizontal, bottom: edge }
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), Math.max(min, max))
}
