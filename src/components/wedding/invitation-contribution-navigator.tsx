'use client'

import { useEffect } from 'react'

function weddingSlugFromPath(): string | null {
  const match = window.location.pathname.match(/^\/w\/([^/]+)$/)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export function InvitationContributionNavigator() {
  useEffect(() => {
    const openContributions = () => {
      const slug = weddingSlugFromPath()
      if (!slug) {
        document.getElementById('registry')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }

      const physicalInvitation = document.querySelector(
        '[data-testid="physical-invitation-claim"]',
      )
      if (physicalInvitation) {
        window.location.assign(
          `/w/${encodeURIComponent(slug)}?site=1#registry`,
        )
        return
      }

      const personalInvitation = document.querySelector(
        '[data-personal-invitation="1"]',
      )
      if (personalInvitation) {
        window.sessionStorage.setItem(
          `wewed:skip-invitation-once:${slug}`,
          '1',
        )
        window.location.assign(`/w/${encodeURIComponent(slug)}#registry`)
        return
      }

      document.getElementById('registry')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }

    window.addEventListener('wewed:open-contributions', openContributions)
    return () =>
      window.removeEventListener('wewed:open-contributions', openContributions)
  }, [])

  return null
}
