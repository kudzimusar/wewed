'use client'

import { useState, useEffect } from 'react'
import { OnboardingWizard } from '@/components/wedding/onboarding-wizard'

/**
 * OnboardingTrigger — detects ?create=1 in the URL
 * and renders the OnboardingWizard full-screen.
 *
 * Same pattern as ContributionTrigger and AdminTrigger.
 *
 * Master plan Phase 7: this component is not mounted anywhere in the current app tree (confirmed
 * by repo-wide search), so it has no reachable production entry point today. Do not mount it
 * without first routing OnboardingWizard through the canonical Supabase/User/UserProfile/
 * BusinessAccount pipeline (`/api/auth/register` + admin completion) — its current `/api/onboarding`
 * target creates an incompatible legacy graph that `resolveProductionAuthority` grants nothing for,
 * and that route now fails closed in real production for exactly that reason.
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
