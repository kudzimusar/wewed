'use client'

import { useState, useEffect } from 'react'
import { OnboardingWizard } from '@/components/wedding/onboarding-wizard'

/**
 * OnboardingTrigger — detects ?create=1 in the URL
 * and renders the OnboardingWizard full-screen.
 *
 * Same pattern as ContributionTrigger and AdminTrigger.
 */
export function OnboardingTrigger() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search)
      if (params.get('create') === '1') setShow(true)
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  if (!show) return null

  return <OnboardingWizard />
}
