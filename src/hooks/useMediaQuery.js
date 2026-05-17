import { useState, useEffect } from 'react'
import { theme } from '../theme'

/**
 * Subscribes to a CSS media query and re-renders when match state changes.
 *
 * Pass either a key from theme.mediaQueries ('mobile', 'tablet', 'desktop',
 * 'notDesktop') or a raw media query string.
 *
 * @example
 *   const isMobile = useMediaQuery('mobile')
 *   const isWide = useMediaQuery('(min-width: 1400px)')
 */
export function useMediaQuery(query) {
  const resolved = theme.mediaQueries[query] || query

  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(resolved).matches
  })

  useEffect(() => {
    const mql = window.matchMedia(resolved)
    const handler = (e) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    setMatches(mql.matches) // sync in case the query string changed
    return () => mql.removeEventListener('change', handler)
  }, [resolved])

  return matches
}

// Convenience wrappers — what most components will use.
export function useIsMobile() {
  return useMediaQuery('mobile')
}

export function useIsTablet() {
  return useMediaQuery('tablet')
}

export function useIsDesktop() {
  return useMediaQuery('desktop')
}

// True for both mobile and tablet. Useful for "should this be a drawer?" checks.
export function useIsNotDesktop() {
  return useMediaQuery('notDesktop')
}
