import { useMemo } from 'react'
import { theme as t } from '../theme'
import OrbiSpotlight, { SpotlightButton, SpotlightLink } from './OrbiSpotlight'
import { getModules } from '../utils/businessModules'
import { useIsMobile } from '../hooks/useMediaQuery'

// The walkthrough narrated by Orbi. Step fields are described in
// OrbiSpotlight; `desktop`/`mobile` limit a step to one layout and
// `module` hides it when that module is off.
const STEPS = [
  { id: 'intro', largeOrb: true, title: "Hi, I'm Orbi.", body: "Want a quick look around your space? It takes about a minute." },
  { id: 'nav', target: 'sidebar-nav', page: 'dashboard', desktop: true, title: 'Your tools', body: "Everything lives here, grouped into modules. Open a section to see what's inside — you can switch modules on or off in Settings." },
  { id: 'tabs', target: 'mobile-tabs', page: 'dashboard', mobile: true, title: 'Your tools', body: 'Your most-used spots sit right down here.' },
  { id: 'more', target: 'mobile-more', mobile: true, title: 'Everything else', body: 'Clients, tasks, money and everything else live under More.' },
  { id: 'switcher', target: 'business-switcher', title: 'Your businesses', body: 'Running more than one? Switch between them — or add a new one — from here.' },
  { id: 'orbi', target: 'orbi-card', page: 'dashboard', title: "That's me", body: 'Ask me anything, or just tell me what happened — "add a client named Maya" — and I\'ll file it for you.' },
  { id: 'notifications', target: 'notifications', title: 'Heads up', body: "When a client does something in their portal or the community has news for you, I'll flag it here." },
  { id: 'favorites', target: 'subheader', desktop: true, title: 'Favorites', body: 'Pin up to five pages you use most to this bar for one-click access.' },
  { id: 'search', target: 'search', desktop: true, title: 'Search', body: 'Find any client, project or task from here.' },
  { id: 'community', target: 'nav-community', desktop: true, title: 'Community', body: 'Meet other creative businesses, post on The Board and find people to collab with.' },
  { id: 'profile', target: 'profile', title: 'Settings & more', body: "Settings, tutorials and dark mode are in here — and this tour, if you ever want it again." },
  { id: 'outro', title: "That's the lay of the land.", body: null },
]

export default function OrbiTour({ currentPage, businessSpaceId, hasChecklist, onNavigate, onFinish }) {
  const isMobile = useIsMobile()
  // Keyed on the module flags' values — getModules returns a fresh object
  // each call, and a new steps array every render would re-run the
  // spotlight's target-tracking effect in a loop.
  const modulesKey = JSON.stringify(getModules(businessSpaceId))
  const steps = useMemo(() => {
    const modules = JSON.parse(modulesKey)
    return STEPS.filter(s =>
      (isMobile ? !s.desktop : !s.mobile) && (!s.module || modules[s.module]))
  }, [isMobile, modulesKey])

  return (
    <OrbiSpotlight
      steps={steps}
      label="Orbi tour"
      currentPage={currentPage}
      onNavigate={onNavigate}
      onClose={onFinish}
      renderBody={step => step.id === 'outro'
        ? (hasChecklist
          ? "Next up: a few quick steps to get your space set up."
          : "You can replay this anytime from your profile menu. Go make something great.")
        : step.body}
      renderFooter={({ index, isFirst, isLast, next, back, stepCount }) => isFirst ? (
        <>
          <SpotlightButton primary onClick={next}>Show me around</SpotlightButton>
          <SpotlightButton onClick={onFinish}>Maybe later</SpotlightButton>
        </>
      ) : isLast ? (
        <SpotlightButton primary onClick={onFinish}>{hasChecklist ? "Let's go" : 'Done'}</SpotlightButton>
      ) : (
        <>
          {/* Intro and outro don't count toward "3 of 8". */}
          <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginRight: 'auto' }}>
            {index} of {stepCount - 2}
          </span>
          <SpotlightLink onClick={onFinish}>Skip</SpotlightLink>
          {index > 1 && <SpotlightButton onClick={back}>Back</SpotlightButton>}
          <SpotlightButton primary onClick={next}>Next</SpotlightButton>
        </>
      )}
    />
  )
}
