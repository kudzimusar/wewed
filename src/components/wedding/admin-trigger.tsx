'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SecureAdminDashboard } from '@/components/wedding/secure-admin-dashboard'

/**
 * This component must only be mounted after the server has resolved an admin
 * application session for the active wedding. It is intentionally a compact
 * owner control rather than part of the guest navigation surface.
 */
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

  return (
    <>
      <div className="fixed bottom-6 left-6 z-40" data-testid="admin-console-control">
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-11 rounded-full border border-gold/40 bg-espresso/95 px-4 text-champagne shadow-lg backdrop-blur-md hover:border-gold hover:bg-espresso"
          aria-label="Open admin console"
        >
          <ShieldCheck className="mr-2 h-4 w-4 text-gold" />
          <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em]">
            Admin console
          </span>
        </Button>
      </div>
      {open && <SecureAdminDashboard onClose={() => setOpen(false)} />}
    </>
  )
}
