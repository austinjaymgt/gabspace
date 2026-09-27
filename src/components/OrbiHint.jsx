import { useMemo } from 'react'
import OrbiSpotlight, { SpotlightButton, SpotlightLink } from './OrbiSpotlight'
import { PAGE_HINTS } from '../lib/pageHints'

// One Orbi bubble the first time someone opens a page (see lib/pageHints).
export default function OrbiHint({ page, onDismiss, onTurnOff }) {
  const hint = PAGE_HINTS[page]
  const steps = useMemo(() => [{ id: page, ...hint }], [page, hint])

  return (
    <OrbiSpotlight
      steps={steps}
      label={`${hint.title} tip`}
      currentPage={page}
      onNavigate={() => {}}
      onClose={onDismiss}
      renderFooter={() => (
        <>
          <SpotlightLink onClick={onTurnOff} style={{ marginRight: 'auto', paddingLeft: 0 }}>Turn off tips</SpotlightLink>
          <SpotlightButton primary onClick={onDismiss}>Got it</SpotlightButton>
        </>
      )}
    />
  )
}
