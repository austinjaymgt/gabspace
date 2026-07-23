// The Gabspace mascot: a soft asymmetric blob with the brand's radial
// gradient, used anywhere a compact mark or loading moment is needed
// (Home hero, corner badge, splash screens). Two gradient layers cross-fade
// between calm (default) and urgent (overdue/attention-needed) states —
// see brand guide section 5.
export default function Orb({ size = 80, urgent = false, halo = false, animate = true, onClick, style, className }) {
  const coreAnim = animate
    ? 'orb-enter 0.8s cubic-bezier(0.16,1,0.3,1) backwards, orb-drift 7s ease-in-out infinite'
    : 'none'
  const overlayAnim = animate ? 'orb-drift 7s ease-in-out infinite' : 'none'

  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        flexShrink: 0,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {halo && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: `${size * 1.7}px`,
          height: `${size * 1.7}px`,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(183,111,224,0.55) 0%, rgba(107,26,122,0.25) 55%, rgba(107,26,122,0) 75%)',
          filter: `blur(${Math.max(8, size * 0.18)}px)`,
          animation: animate ? 'orb-halo-pulse 3.4s ease-in-out infinite' : 'none',
          pointerEvents: 'none',
        }} />
      )}

      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 35% 30%, #7fd8ff 0%, #4fa8e8 55%, #6a5cd0 100%)',
        boxShadow: '0 0 60px rgba(79,168,232,0.5), 0 0 120px rgba(106,92,208,0.35)',
        animation: coreAnim,
      }} />

      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 35% 30%, #f7c3cf 0%, #c0506e 55%, #7a2f45 100%)',
        boxShadow: '0 0 60px rgba(192,80,110,0.55), 0 0 120px rgba(122,47,69,0.35)',
        animation: overlayAnim,
        opacity: urgent ? 1 : 0,
        transition: 'opacity 0.6s ease',
      }} />
    </div>
  )
}
