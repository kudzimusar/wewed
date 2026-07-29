'use client'

import { useEffect, useState } from 'react'
import { SecureAdminDashboard } from '@/components/wedding/secure-admin-dashboard'

export function AdminTrigger() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        (event.key === 'A' || event.key === 'a')
      ) {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false

    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('admin') === '1') {
        const url = new URL(window.location.href)
        url.searchParams.delete('admin')
        window.history.replaceState({}, '', url.toString())

        window.setTimeout(() => {
          if (!cancelled) setOpen(true)
        }, 0)
      }
    } catch {
      // Ignore malformed browser URLs.
    }

    return () => {
      cancelled = true
    }
  }, [])

  if (!open) return null

  return <SecureAdminDashboard onClose={() => setOpen(false)} />
}
