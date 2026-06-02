import { useState, useEffect } from 'react'

/*
 * Pixel — the Gabspace mascot.
 *
 * FOR YOUR APP:  import { Pixel } from './Pixel'
 *   <Pixel mood="idle" size={120} />
 *   <Pixel mood="celebrating" size={160} wave sparkles />
 *
 * The default export (PixelShowcase) is just an interactive preview/demo.
 * You can delete it once Pixel is wired in, or keep it around as a living
 * reference. The Pixel component itself has zero external dependencies.
 *
 * Props:
 *   mood      'idle' | 'working' | 'thinking' | 'celebrating'   (default 'idle')
 *   size      total height in px                                 (default 160)
 *   wave      boolean — right arm waves hello                    (default false)
 *   sparkles  boolean — celebratory sparkles                     (default auto-on for 'celebrating')
 *   animated  boolean — toggle all motion                        (default true)
 *   className / style — passed through to the wrapper
 *
 * Pixel reads on any surface, but his body is intentionally dark-tinted,
 * so the glowing eyes / feet / chart bars pop most on a darker panel.
 */

const MOODS = {
  idle: {
    accent: '#7C5CBF',
    accentLight: '#C9B9E8',
    body: '#252140',
    bodyHi: '#2E2950',
    screen: '#1A1730',
    eye: '#C9B9E8',
    glow: 'rgba(124,92,191,0.75)',
  },
  working: {
    accent: '#D4874E',
    accentLight: '#F0C99A',
    body: '#2E2518',
    bodyHi: '#3A2E1E',
    screen: '#221B11',
    eye: '#F0C99A',
    glow: 'rgba(212,135,78,0.75)',
  },
  thinking: {
    accent: '#5B9BBF',
    accentLight: '#A9D2E8',
    body: '#1B2530',
    bodyHi: '#223040',
    screen: '#131C26',
    eye: '#A9D2E8',
    glow: 'rgba(91,155,191,0.75)',
  },
  celebrating: {
    accent: '#6B8F71',
    accentLight: '#8FD996',
    body: '#182A20',
    bodyHi: '#1F3528',
    screen: '#112018',
    eye: '#8FD996',
    glow: 'rgba(107,143,113,0.8)',
  },
}

const BORDER = '1.5px solid rgba(255,255,255,0.07)'

// Base canvas the figure is drawn at; the whole thing scales from here.
const BASE_W = 150
const BASE_H = 210

const KEYFRAMES = `
@keyframes px-float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
@keyframes px-antenna { 0%,100%{transform:scale(1);   box-shadow:0 0 6px var(--px-glow)} 50%{transform:scale(1.18); box-shadow:0 0 15px var(--px-glow)} }
@keyframes px-bar     { 0%,100%{transform:scaleY(0.45)} 50%{transform:scaleY(1)} }
@keyframes px-blink   { 0%,90%,100%{transform:scaleY(1)} 95%{transform:scaleY(0.08)} }
@keyframes px-dot     { 0%,100%{opacity:0.25} 50%{opacity:1} }
@keyframes px-arm-l   { 0%,100%{transform:rotate(5deg)}  50%{transform:rotate(-3deg)} }
@keyframes px-arm-r   { 0%,100%{transform:rotate(-5deg)} 50%{transform:rotate(3deg)} }
@keyframes px-wave    { 0%,100%{transform:rotate(-32deg)} 50%{transform:rotate(12deg)} }
@keyframes px-sparkle { 0%,100%{opacity:0; transform:scale(0.5) rotate(0deg)} 50%{opacity:1; transform:scale(1) rotate(20deg)} }
`

function useKeyframes() {
  useEffect(() => {
    if (document.getElementById('pixel-keyframes')) return
    const tag = document.createElement('style')
    tag.id = 'pixel-keyframes'
    tag.textContent = KEYFRAMES
    document.head.appendChild(tag)
  }, [])
}

export function Pixel({
  mood = 'idle',
  size = 160,
  wave = false,
  sparkles,
  animated = true,
  className,
  style,
}) {
  useKeyframes()

  const m = MOODS[mood] || MOODS.idle
  const scale = size / BASE_H
  const showSparkles = sparkles ?? mood === 'celebrating'
  const anim = (a) => (animated ? a : 'none')

  const limbBase = { background: m.body, border: BORDER, transition: 'all 0.45s ease' }

  return (
    <div
      className={className}
      style={{
        width: BASE_W * scale,
        height: BASE_H * scale,
        position: 'relative',
        // expose mood glow to the keyframes
        '--px-glow': m.glow,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: BASE_W,
          height: BASE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: anim('px-float 3.4s ease-in-out infinite'),
        }}
      >
        {/* Antenna */}
        <div style={{ width: 4, height: 22, background: m.body, borderRadius: 2 }} />
        <div
          style={{
            width: 13,
            height: 13,
            borderRadius: '50%',
            background: m.accent,
            marginTop: -2,
            marginBottom: 4,
            animation: anim('px-antenna 2.2s ease-in-out infinite'),
          }}
        />

        {/* Head */}
        <div style={{ position: 'relative' }}>
          {/* ears */}
          <div style={{ ...limbBase, position: 'absolute', left: -8, top: 26, width: 11, height: 26, borderRadius: 5 }} />
          <div style={{ ...limbBase, position: 'absolute', right: -8, top: 26, width: 11, height: 26, borderRadius: 5 }} />
          {/* head shell */}
          <div
            style={{
              width: 96,
              height: 78,
              borderRadius: 24,
              background: `linear-gradient(160deg, ${m.bodyHi}, ${m.body})`,
              border: BORDER,
              transition: 'all 0.45s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {/* visor */}
            <div
              style={{
                width: 70,
                height: 34,
                borderRadius: 13,
                background: m.screen,
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                transition: 'all 0.45s ease',
              }}
            >
              {[0, 1].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 15,
                    height: 15,
                    borderRadius: 5,
                    background: m.eye,
                    boxShadow: `0 0 8px ${m.glow}`,
                    transition: 'all 0.45s ease',
                    animation: anim('px-blink 4.5s ease-in-out infinite'),
                  }}
                />
              ))}
            </div>
            {/* cheeks — the "warm" in techy-but-warm */}
            <div style={{ display: 'flex', gap: 44 }}>
              {[0, 1].map((i) => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: m.accent, opacity: 0.55, transition: 'all 0.45s ease' }} />
              ))}
            </div>
          </div>
        </div>

        {/* neck */}
        <div style={{ width: 18, height: 7, background: m.body, borderRadius: 3, marginTop: 2 }} />

        {/* Torso + arms */}
        <div style={{ position: 'relative', marginTop: 1 }}>
          {/* left arm */}
          <div
            style={{
              ...limbBase,
              position: 'absolute',
              left: -20,
              top: 6,
              width: 15,
              height: 46,
              borderRadius: 8,
              transformOrigin: 'top center',
              animation: anim('px-arm-l 3s ease-in-out infinite'),
            }}
          >
            <div style={{ width: 13, height: 13, borderRadius: 4, background: m.bodyHi, border: BORDER, position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)' }} />
          </div>
          {/* right arm (waves) */}
          <div
            style={{
              ...limbBase,
              position: 'absolute',
              right: -20,
              top: 6,
              width: 15,
              height: 46,
              borderRadius: 8,
              transformOrigin: 'top center',
              animation: anim(wave ? 'px-wave 0.6s ease-in-out infinite' : 'px-arm-r 3s ease-in-out infinite'),
            }}
          >
            <div style={{ width: 13, height: 13, borderRadius: 4, background: m.bodyHi, border: BORDER, position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)' }} />
          </div>

          {/* torso shell */}
          <div
            style={{
              width: 84,
              height: 82,
              borderRadius: 20,
              background: `linear-gradient(160deg, ${m.bodyHi}, ${m.body})`,
              border: BORDER,
              transition: 'all 0.45s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* chest dashboard */}
            <div
              style={{
                position: 'relative',
                width: 60,
                height: 56,
                borderRadius: 11,
                background: m.screen,
                border: '1px solid rgba(255,255,255,0.05)',
                padding: '8px 7px 7px',
                transition: 'all 0.45s ease',
              }}
            >
              {/* status dots */}
              <div style={{ position: 'absolute', top: 5, left: 7, display: 'flex', gap: 3 }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: m.accentLight,
                      animation: anim(`px-dot 1.4s ease-in-out infinite ${i * 0.3}s`),
                    }}
                  />
                ))}
              </div>
              {/* animated bar chart */}
              <div style={{ position: 'absolute', bottom: 7, left: 7, right: 7, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 30 }}>
                {[0.55, 0.85, 0.4, 1, 0.7].map((h, i) => (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      height: 30 * h,
                      borderRadius: '3px 3px 1px 1px',
                      background: i % 2 ? m.accentLight : m.accent,
                      transformOrigin: 'bottom',
                      transition: 'all 0.45s ease',
                      animation: anim(`px-bar 1.8s ease-in-out infinite ${i * 0.25}s`),
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Legs + feet */}
        <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
          {[0, 1].map((i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 18, height: 22, borderRadius: 6, ...limbBase }} />
              <div style={{ width: 28, height: 11, borderRadius: 6, background: m.accent, marginTop: -2, transition: 'all 0.45s ease' }} />
            </div>
          ))}
        </div>

        {/* Sparkles */}
        {showSparkles && (
          <>
            {[
              { top: 8, left: -2, s: 14, d: 0 },
              { top: 30, right: -4, s: 10, d: 0.4 },
              { bottom: 40, left: -6, s: 11, d: 0.8 },
            ].map((sp, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: sp.top,
                  bottom: sp.bottom,
                  left: sp.left,
                  right: sp.right,
                  color: m.accentLight,
                  fontSize: sp.s,
                  animation: anim(`px-sparkle 1.6s ease-in-out infinite ${sp.d}s`),
                }}
              >
                ✦
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

export default Pixel

/* ------------------------------------------------------------------ *
 *  Interactive preview — safe to delete once Pixel is wired into app  *
 * ------------------------------------------------------------------ */

const PILLS = [
  { key: 'idle', label: 'Idle', sub: 'violet', caption: '"Ready when you are."' },
  { key: 'working', label: 'Working', sub: 'amber', caption: '"On it — crunching the numbers."' },
  { key: 'thinking', label: 'Thinking', sub: 'blue', caption: '"Hmm, let me figure this out for you…"' },
  { key: 'celebrating', label: 'Celebrating', sub: 'sage', caption: '"Look at you go! Another one in the books. 🎉"' },
]

function PixelShowcase() {
  const [mood, setMood] = useState('idle')
  const active = PILLS.find((p) => p.key === mood)
  const accent = MOODS[mood].accent

  return (
    <div
      style={{
        fontFamily: "'DM Sans', system-ui, sans-serif",
        background: '#F7F5F0',
        minHeight: '100%',
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
      }}
    >
      <style>{"@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;800&family=DM+Sans:ital,wght@0,400;0,500;1,300&display=swap');"}</style>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 30, color: '#1A1A2E', letterSpacing: '-0.02em' }}>
          meet pixel
        </div>
        <div style={{ fontStyle: 'italic', fontWeight: 300, color: '#8585A0', fontSize: 14, marginTop: 4 }}>
          your gabspace companion — click a mood
        </div>
      </div>

      {/* dark studio panel so the glow reads */}
      <div
        style={{
          background: '#1A1A2E',
          borderRadius: 24,
          padding: '36px 56px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          boxShadow: '0 24px 60px rgba(26,26,46,0.25)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: accent, opacity: 0.14, top: -70, right: -70, transition: 'background 0.45s ease' }} />
        <Pixel mood={mood} size={200} wave={mood === 'idle' || mood === 'celebrating'} sparkles={mood === 'celebrating'} />
        <div
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.85)',
            fontStyle: 'italic',
            fontWeight: 300,
            fontSize: 13,
            padding: '8px 16px',
            borderRadius: 100,
            position: 'relative',
            transition: 'all 0.3s ease',
          }}
        >
          {active.caption}
        </div>
      </div>

      {/* mood pills */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {PILLS.map((p) => {
          const on = p.key === mood
          const c = MOODS[p.key].accent
          return (
            <button
              key={p.key}
              onClick={() => setMood(p.key)}
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 500,
                fontSize: 13,
                cursor: 'pointer',
                padding: '9px 18px',
                borderRadius: 100,
                border: `2px solid ${on ? c : 'rgba(0,0,0,0.12)'}`,
                background: on ? c : 'transparent',
                color: on ? '#fff' : '#3D3D5C',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: on ? '#fff' : c }} />
              {p.label}
            </button>
          )
        })}
      </div>

      <div style={{ fontSize: 12, color: '#8585A0', maxWidth: 360, textAlign: 'center', lineHeight: 1.6 }}>
        Drop-in usage: <code style={{ background: '#EFEDE7', padding: '2px 6px', borderRadius: 5 }}>{'<Pixel mood="idle" size={120} />'}</code>
      </div>
    </div>
  )
}

export { PixelShowcase }