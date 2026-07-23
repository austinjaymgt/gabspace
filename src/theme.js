export const taskStatusConfig = {
  'todo':        { label: 'To do',       color: '#7d6b86', bg: '#F3EEF3' },
  'in-progress': { label: 'In progress', color: '#2e7fb8', bg: '#E3F1FC' },
  'done':        { label: 'Done',        color: '#1f9c8f', bg: '#E1FBF6' },
}

// Gabspace brand palette (see brand guide section 2) — the source of truth
// for the app's dark/plum identity. Referenced directly where a component
// needs the brand hue itself rather than a semantic (light/dark-aware) token.
export const brand = {
  bgDeep: '#160814',
  bgPlum: '#2b0f2a',
  accentMagenta: '#e0399b',
  orbBlue: '#4fa8e8',
  orbTeal: '#3fd6c8',
  ink: '#f3eaf1',
  inkDim: '#c9b8c6',
  warningGradient: ['#ffe0a8', '#e89a4f', '#c0507a'],
  radialBg: 'radial-gradient(circle at 50% 0%, #2b0f2a 0%, #160814 70%)',
}

export const theme = {
  colors: {
    // Core brand
    primary: 'var(--color-primary)',
    primaryLight: 'var(--color-primary-light)',
    primaryDark: 'var(--color-primary-dark)',
    accent: 'var(--color-accent)',
    accentLight: 'var(--color-accent-light)',
    accentDark: 'var(--color-accent-dark)',
    highlight: 'var(--color-highlight)',
    highlightLight: 'var(--color-highlight-light)',
    cyan: 'var(--color-cyan)',
    danger: 'var(--color-danger)',
    dangerLight: 'var(--color-danger-light)',
    success: 'var(--color-success)',
    successLight: 'var(--color-success-light)',
    warning: 'var(--color-warning)',
    warningLight: 'var(--color-warning-light)',

    // Neutrals
    bg: 'var(--color-bg)',
    bgCard: 'var(--color-bg-card)',
    bgHover: 'var(--color-bg-hover)',
    border: 'var(--color-border)',
    borderLight: 'var(--color-border-light)',

    // Nav (dark sidebar)
    nav: 'var(--color-nav)',
    navHover: 'var(--color-nav-hover)',
    navActive: 'var(--color-nav-active)',
    navText: 'var(--color-nav-text)',
    navTextActive: 'var(--color-nav-text-active)',
    navAccent: 'var(--color-nav-accent)',

    // Text
    textPrimary: 'var(--color-text-primary)',
    textSecondary: 'var(--color-text-secondary)',
    textTertiary: 'var(--color-text-tertiary)',
    textInverse: 'var(--color-text-inverse)',

    // Gradient
    gradient: 'var(--gradient)',
    gradientDiag: 'var(--gradient-diag)',
  },

  // Typography — Quicksand for display/headings (rounded, geometric warmth),
  // Manrope for body/UI text (density + readability at small sizes).
  fonts: {
    heading: '"Quicksand", sans-serif',
    sans: '"Manrope", -apple-system, BlinkMacSystemFont, sans-serif',
  },

  // Brand type scale (guide section 3): H1 40/Quicksand 700, H2 28/Quicksand 600,
  // body 16/Manrope 400, caption 13/Manrope 500. Existing sm/base/md steps are
  // kept for density-sensitive UI (tables, badges) that predates this scale.
  fontSizes: {
    xs: '11px',
    sm: '12px',
    base: '13px',
    caption: '13px',
    md: '14px',
    lg: '16px',
    body: '16px',
    xl: '18px',
    '2xl': '20px',
    h2: '28px',
    '3xl': '24px',
    h1: '40px',
  },

  // Spacing
  space: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
    '3xl': '48px',
  },

  // Borders — pill/capsule for inputs, buttons, tabs (radius.full); the
  // larger 20-28px scale is for cards/panels holding multiple items.
  radius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '24px',
    card: '24px',
    full: '9999px',
  },

  // Shadows
  shadows: {
    sm: '0 1px 3px rgba(0,0,0,0.06)',
    md: '0 4px 12px rgba(0,0,0,0.08)',
    lg: '0 8px 24px rgba(0,0,0,0.12)',
  },
  // Responsive breakpoints (pixel values)
  breakpoints: {
    mobile: 767,   //   0 - 767px
    tablet: 1023,  // 768 - 1023px
    desktop: 1024, // 1024px and up
  },
  // Pre-built media query strings, keyed by semantic name.
  // Used by the useMediaQuery hook.
  mediaQueries: {
    mobile: '(max-width: 767px)',
    tablet: '(min-width: 768px) and (max-width: 1023px)',
    desktop: '(min-width: 1024px)',
    notDesktop: '(max-width: 1023px)',
  },
}