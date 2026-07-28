'use client'

import { useState, useEffect } from 'react'
import { GuestContributionEditor } from '@/components/wedding/guest-contribution-editor'

/**
 * ContributionTrigger — detects ?contribute=TOKEN in the URL
 * and renders the GuestContributionEditor as a full-screen overlay.
 *
 * Same pattern as AdminTrigger and ProgressTrigger.
 * Added to layout.tsx alongside other triggers.
 */
export function ContributionTrigger() {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const id = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search)
      const t = params.get('contribute')
      if (t) setToken(t)
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  if (!token) return null

  return <GuestContributionEditor />
}
