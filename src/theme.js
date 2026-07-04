export const taskStatusConfig = {
  'todo':        { label: 'To do',       color: '#999',    bg: '#F3F3F3' },
  'in-progress': { label: 'In progress', color: '#D4874E', bg: '#FBF0E6' },
  'done':        { label: 'Done',        color: '#6B8F71', bg: '#EAF2EA' },
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

  // Typography
  fonts: {
    heading: '"Big Shoulders Display", sans-serif',
    sans: '"Source Sans 3", -apple-system, BlinkMacSystemFont, sans-serif',
  },

  fontSizes: {
    xs: '11px',
    sm: '12px',
    base: '13px',
    md: '14px',
    lg: '16px',
    xl: '18px',
    '2xl': '20px',
    '3xl': '24px',
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

  // Borders
  radius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
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