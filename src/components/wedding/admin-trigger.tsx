'use client'

import { useEffect, useState } from 'react'
import { AdminDashboard } from '@/components/wedding/admin-dashboard'

/* ============================================================
   AdminTrigger — invisible keyboard / URL gate
   ------------------------------------------------------------
   Renders nothing visible. Listens for:
     • Ctrl+Shift+A keyboard shortcut
     • ?admin=1 query param on mount

   When triggered, mounts <AdminDashboard /> as a full-screen
   overlay. The dashboard manages its own auth gate internally.

   The gear icon is intentionally omitted to keep the admin
   entry discreet — only the couple knows the shortcut.
   ============================================================ */

export function AdminTrigger() {
  const [open, setOpen] = useState(false)

  // ── Listen for Ctrl+Shift+A ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key === 'A' || e.key === 'a')
      ) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // ── Check for ?admin=1 on mount ──
  // Defer setState via setTimeout to avoid synchronous setState in effect
  // (cascading renders) and to keep SSR/hydration stable.
  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('admin') === '1') {
        // Strip the param so refresh / share doesn't auto-open
        const url = new URL(window.location.href)
        url.searchParams.delete('admin')
        window.history.replaceState({}, '', url.toString())
        window.setTimeout(() => {
          if (!cancelled) setOpen(true)
        }, 0)
      }
    } catch {
      /* ignore */
    }
    return () => {
      cancelled = true
    }
  }, [])

  // ── Body scroll lock when open ──
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [open])

  if (!open) return null

  return <AdminDashboard onClose={() => setOpen(false)} />
}
