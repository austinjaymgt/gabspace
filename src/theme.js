export const theme = {
  colors: {
    // Core brand
    primary: '#7C5CBF',         // Studio Violet (v2)
    primaryLight: '#F0EBF9',    // Violet pale (v2)
    primaryDark: '#5E3F9C',     // Darker violet for hover/active
    accent: '#6B8F71',          // Soft-retired: was Lime, now Sage
    accentLight: '#EAF2EA',     // Sage pale
    accentDark: '#577559',      // Darker sage for hover/active
    danger: '#C06B7A',          // Dusty Rose (v2)
    dangerLight: '#FAF0F2',     // Rose pale
    success: '#6B8F71',          // Sage (v2)
    successLight: '#EAF2EA',    // Sage pale
    warning: '#D4874E',          // Warm Amber (v2)
    warningLight: '#FBF0E6',    // Amber pale

    // Neutrals
    bg: '#F7F5F0',              // Canvas cream (v2) — was cool grey
    bgCard: '#FFFFFF',
    bgHover: '#F0EDE6',         // Warm hover to match Canvas
    border: '#E8E8E8',
    borderLight: '#F2F2F2',

    // Nav (dark sidebar)
    nav: '#1A1A2E',             // Deep Ink (v2) — navy, not pure black
    navHover: 'rgba(255,255,255,0.07)',
    navActive: '#7C5CBF',       // Studio Violet (v2)
    navText: 'rgba(255,255,255,0.5)',
    navTextActive: '#FFFFFF',
    navAccent: '#6B8F71',       // Soft-retired: was Lime, now Sage

    // Text
    textPrimary: '#1A1A2E',     // Deep Ink (v2)
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    textInverse: '#FFFFFF',
  },

  // Typography
  fonts: {
    heading: '"Syne", sans-serif',
    sans: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
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
}