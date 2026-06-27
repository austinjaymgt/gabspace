import { useEffect } from 'react'

const COLORS = {
  cosmicPlum:     '#7F5793',
  electricOrchid: '#09ACEF',
  tropicalGlow:   '#6EFFFF',
  pacificBlue:    '#09ACEF',
  graphiteGray:   '#414042',
  lavenderBlue:   '#B8B0E8',
  bodyDark:       '#5C3B6E',
  white:          '#FFFFFF',
}

const themes = {
  light: { shadowColor: 'rgba(127,87,147,0.25)', bgHint: 'transparent' },
  dark:  { shadowColor: 'rgba(110,255,255,0.2)',  bgHint: 'transparent' },
}

const ANIMATIONS = `
@keyframes gabi-float {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-6px); }
}
@keyframes gabi-pulse {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.02); }
}
@keyframes gabi-sway {
  0%, 100% { transform: translateX(0px) rotate(0deg); }
  25%       { transform: translateX(-4px) rotate(-1.5deg); }
  75%       { transform: translateX(4px) rotate(1.5deg); }
}
@keyframes gabi-bounce {
  0%, 100% { transform: translateY(0px); }
  35%       { transform: translateY(-10px); }
  55%       { transform: translateY(-8px); }
}
@keyframes gabi-shadow-float {
  0%, 100% { transform: scaleX(1); opacity: 0.55; }
  50%       { transform: scaleX(0.82); opacity: 0.28; }
}
@keyframes gabi-shadow-sway {
  0%, 100% { transform: scaleX(1) translateX(0); opacity: 0.55; }
  25%       { transform: scaleX(0.94) translateX(-3px); opacity: 0.38; }
  75%       { transform: scaleX(0.94) translateX(3px); opacity: 0.38; }
}
@keyframes gabi-shadow-bounce {
  0%, 100% { transform: scaleX(1); opacity: 0.55; }
  35%       { transform: scaleX(0.72); opacity: 0.18; }
  55%       { transform: scaleX(0.76); opacity: 0.22; }
}
`

function injectAnimations() {
  if (window.__gabiAnimationsInjected) return
  window.__gabiAnimationsInjected = true
  const style = document.createElement('style')
  style.textContent = ANIMATIONS
  document.head.appendChild(style)
}

export default function Gabi({ mood = 'idle', size = 56, theme = 'light' }) {
  useEffect(() => { injectAnimations() }, [])

  const th = themes[theme] || themes.light
  const s = size

  // --- Proportions (all relative to total height `s`) ---
  // Head: wide boxy rectangle, dominant element
  const headH     = s * 0.38
  const headW     = s * 0.64
  const headRx    = headH * 0.22
  const borderPx  = Math.max(1.5, s * 0.028)   // gradient border thickness

  // Body: smaller, sits below head with overlap
  const bodyH     = s * 0.40
  const bodyW     = s * 0.50
  const bodyRx    = bodyW * 0.22
  const overlap   = s * 0.05

  // Arms
  const armW      = s * 0.085
  const armH      = s * 0.18
  const armRx     = armW * 0.48

  // Total canvas dimensions
  const totalW    = headW + armW * 2 + s * 0.02
  const totalH    = s

  const cx = totalW / 2

  // Y layout (top to bottom)
  const headY     = s * 0.02
  const headX     = cx - headW / 2
  const bodyY     = headY + headH - overlap
  const bodyX     = cx - bodyW / 2
  const armY      = bodyY + bodyH * 0.08
  const leftArmX  = bodyX - armW + s * 0.008
  const rightArmX = bodyX + bodyW - s * 0.008
  const shadowCY  = totalH - s * 0.025
  const shadowRX  = bodyW * 0.48
  const shadowRY  = s * 0.032

  // Face center (in head)
  const faceCX    = cx
  const faceCY    = headY + headH * 0.52

  // Eye geometry
  const eyeSpan   = headW * 0.20
  const leftEyeX  = faceCX - eyeSpan
  const rightEyeX = faceCX + eyeSpan
  const eyeY      = faceCY - headH * 0.10
  const eyeW      = headW * 0.12
  const eyeH      = headH * 0.16
  const eyeRx     = eyeH * 0.25
  const eyeThk    = Math.max(1.5, s * 0.032)

  // Mouth geometry
  const mouthY    = faceCY + headH * 0.18
  const mouthW    = headW * 0.18

  // Chest "G" panel
  const panelW    = bodyW * 0.68
  const panelH    = bodyH * 0.58
  const panelX    = cx - panelW / 2
  const panelY    = bodyY + bodyH * 0.18
  const gSize     = panelH * 0.62

  // Unique gradient IDs per instance (mood differentiates to avoid conflicts)
  const uid       = `gabi_${mood}`
  const sigGradId = `${uid}_sig`
  const headFillId= `${uid}_hf`
  const shadowId  = `${uid}_sh`

  const moodAnims = {
    idle:        { body: 'gabi-float 3s ease-in-out infinite',   shadow: 'gabi-shadow-float 3s ease-in-out infinite' },
    working:     { body: 'gabi-pulse 1.5s ease-in-out infinite', shadow: 'none' },
    thinking:    { body: 'gabi-sway 2.5s ease-in-out infinite',  shadow: 'gabi-shadow-sway 2.5s ease-in-out infinite' },
    celebrating: { body: 'gabi-bounce 0.6s ease-in-out infinite',shadow: 'gabi-shadow-bounce 0.6s ease-in-out infinite' },
  }
  const anim = moodAnims[mood] || moodAnims.idle

  // --- Eye renderers ---
  function Eyes() {
    if (mood === 'idle' || mood === 'celebrating') {
      // ^^ caret shapes — celebrating is slightly larger
      const scale   = mood === 'celebrating' ? 1.25 : 1
      const cW      = eyeW * 0.85 * scale
      const cH      = eyeH * 0.75 * scale
      const thick   = eyeThk * (mood === 'celebrating' ? 1.1 : 1)
      return (
        <>
          <polyline
            points={`${leftEyeX - cW},${eyeY + cH * 0.45} ${leftEyeX},${eyeY - cH * 0.55} ${leftEyeX + cW},${eyeY + cH * 0.45}`}
            fill="none" stroke={COLORS.white} strokeWidth={thick}
            strokeLinecap="round" strokeLinejoin="round"
          />
          <polyline
            points={`${rightEyeX - cW},${eyeY + cH * 0.45} ${rightEyeX},${eyeY - cH * 0.55} ${rightEyeX + cW},${eyeY + cH * 0.45}`}
            fill="none" stroke={COLORS.white} strokeWidth={thick}
            strokeLinecap="round" strokeLinejoin="round"
          />
        </>
      )
    }

    if (mood === 'working') {
      // Flat horizontal bars angled inward — determined brow
      const barW  = eyeW * 1.0
      const tilt  = eyeH * 0.32
      const thick = eyeThk * 1.4
      return (
        <>
          <line
            x1={leftEyeX - barW * 0.5} y1={eyeY + tilt}
            x2={leftEyeX + barW * 0.5} y2={eyeY - tilt}
            stroke={COLORS.white} strokeWidth={thick} strokeLinecap="round"
          />
          <line
            x1={rightEyeX - barW * 0.5} y1={eyeY - tilt}
            x2={rightEyeX + barW * 0.5} y2={eyeY + tilt}
            stroke={COLORS.white} strokeWidth={thick} strokeLinecap="round"
          />
        </>
      )
    }

    if (mood === 'thinking') {
      // ╮╭ droopy downward arcs — pensive
      const r    = eyeW * 0.9
      const thick = eyeThk
      return (
        <>
          <path
            d={`M ${leftEyeX - r},${eyeY - r * 0.25} Q ${leftEyeX},${eyeY + r * 0.75} ${leftEyeX + r},${eyeY - r * 0.25}`}
            fill="none" stroke={COLORS.white} strokeWidth={thick} strokeLinecap="round"
          />
          <path
            d={`M ${rightEyeX - r},${eyeY - r * 0.25} Q ${rightEyeX},${eyeY + r * 0.75} ${rightEyeX + r},${eyeY - r * 0.25}`}
            fill="none" stroke={COLORS.white} strokeWidth={thick} strokeLinecap="round"
          />
        </>
      )
    }

    return null
  }

  function Mouth() {
    if (mood === 'idle') {
      return (
        <path
          d={`M ${faceCX - mouthW},${mouthY} Q ${faceCX},${mouthY + mouthW * 0.75} ${faceCX + mouthW},${mouthY}`}
          fill="none" stroke={COLORS.white} strokeWidth={eyeThk * 0.85} strokeLinecap="round"
        />
      )
    }
    if (mood === 'celebrating') {
      const bw = mouthW * 1.5
      return (
        <path
          d={`M ${faceCX - bw},${mouthY} Q ${faceCX},${mouthY + bw * 1.05} ${faceCX + bw},${mouthY}`}
          fill="none" stroke={COLORS.white} strokeWidth={eyeThk * 0.95} strokeLinecap="round"
        />
      )
    }
    if (mood === 'working') {
      return (
        <line
          x1={faceCX - mouthW * 0.65} y1={mouthY}
          x2={faceCX + mouthW * 0.65} y2={mouthY}
          stroke={COLORS.white} strokeWidth={eyeThk * 0.85} strokeLinecap="round"
        />
      )
    }
    if (mood === 'thinking') {
      return (
        <line
          x1={faceCX - mouthW * 0.55} y1={mouthY - s * 0.008}
          x2={faceCX + mouthW * 0.55} y2={mouthY + s * 0.012}
          stroke={COLORS.white} strokeWidth={eyeThk * 0.85} strokeLinecap="round"
        />
      )
    }
    return null
  }

  return (
    <svg
      width={totalW}
      height={totalH}
      viewBox={`0 0 ${totalW} ${totalH}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible', display: 'block' }}
    >
      <defs>
        {/* Signature gradient: Electric Orchid → Tropical Glow → Pacific Blue */}
        <linearGradient id={sigGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor={COLORS.electricOrchid} />
          <stop offset="50%"  stopColor={COLORS.tropicalGlow} />
          <stop offset="100%" stopColor={COLORS.pacificBlue} />
        </linearGradient>

        {/* Head fill: Cosmic Plum top → lavender/blue bottom */}
        <linearGradient id={headFillId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor={COLORS.cosmicPlum} />
          <stop offset="100%" stopColor={COLORS.lavenderBlue} />
        </linearGradient>

        {/* Drop shadow gradient */}
        <radialGradient id={shadowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={th.shadowColor} stopOpacity="1" />
          <stop offset="100%" stopColor={th.shadowColor} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Drop shadow — animates independently */}
      <ellipse
        cx={cx} cy={shadowCY}
        rx={shadowRX} ry={shadowRY}
        fill={`url(#${shadowId})`}
        style={{
          transformOrigin: `${cx}px ${shadowCY}px`,
          animation: anim.shadow,
        }}
      />

      {/* Main animated group */}
      <g style={{ transformOrigin: `${cx}px ${totalH * 0.45}px`, animation: anim.body }}>

        {/* Body */}
        <rect
          x={bodyX} y={bodyY}
          width={bodyW} height={bodyH}
          rx={bodyRx} ry={bodyRx}
          fill={COLORS.bodyDark}
        />

        {/* Left arm nub */}
        <rect
          x={leftArmX} y={armY}
          width={armW} height={armH}
          rx={armRx} ry={armRx}
          fill={COLORS.bodyDark}
        />

        {/* Right arm nub */}
        <rect
          x={rightArmX} y={armY}
          width={armW} height={armH}
          rx={armRx} ry={armRx}
          fill={COLORS.bodyDark}
        />

        {/* Chest panel — signature gradient */}
        <rect
          x={panelX} y={panelY}
          width={panelW} height={panelH}
          rx={panelH * 0.22} ry={panelH * 0.22}
          fill={`url(#${sigGradId})`}
          opacity={0.9}
        />

        {/* Chest "G" */}
        <text
          x={cx} y={panelY + panelH * 0.73}
          textAnchor="middle"
          fontFamily="'Georgia', 'Times New Roman', serif"
          fontWeight="bold"
          fontSize={gSize}
          fill={COLORS.white}
          opacity={0.95}
        >
          G
        </text>

        {/* Head gradient border — slightly larger rect in signature gradient */}
        <rect
          x={headX - borderPx} y={headY - borderPx}
          width={headW + borderPx * 2} height={headH + borderPx * 2}
          rx={headRx + borderPx} ry={headRx + borderPx}
          fill={`url(#${sigGradId})`}
        />

        {/* Head fill on top of border */}
        <rect
          x={headX} y={headY}
          width={headW} height={headH}
          rx={headRx} ry={headRx}
          fill={`url(#${headFillId})`}
        />

        {/* Face */}
        <Eyes />
        <Mouth />
      </g>
    </svg>
  )
}
