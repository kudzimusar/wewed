'use client'

import { useEffect, useState } from 'react'
import { ProgressTracker } from '@/components/wedding/progress-tracker'

/* ============================================================
   ProgressTrigger — invisible keyboard / URL gate
   ------------------------------------------------------------
   Renders nothing visible. Listens for:
     • Ctrl+Shift+P (or Cmd+Shift+P on Mac) keyboard shortcut
     • ?progress=1 query param on mount

   When triggered, mounts <ProgressTracker /> as a full-screen
   overlay. The tracker manages its own data refresh + health
   checks; this component only owns open/close state.

   Mirrors the established pattern from /src/components/wedding/
   admin-trigger.tsx (Task 4) so the two hidden overlays behave
   consistently. Body scroll is locked while open.

   Lead agent wires <ProgressTrigger /> into src/app/layout.tsx
   alongside the existing <AdminTrigger />.
   ============================================================ */

export function ProgressTrigger() {
  const [open, setOpen] = useState(false)

  // ── Listen for Ctrl+Shift+P (and Cmd+Shift+P on macOS) ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key === 'P' || e.key === 'p')
      ) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // ── Check for ?progress=1 on mount ──
  // Defer setState via setTimeout(0) to avoid the
  // react-hooks/set-state-in-effect rule (cascading renders) and
  // to keep SSR/hydration stable.
  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('progress') === '1') {
        // Strip the param so refresh / share doesn't auto-reopen.
        const url = new URL(window.location.href)
        url.searchParams.delete('progress')
        window.history.replaceState({}, '', url.toString())
        window.setTimeout(() => {
          if (!cancelled) setOpen(true)
        }, 0)
      }
    } catch {
      /* ignore — URL parsing should never throw in a browser */
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

  return <ProgressTracker onClose={() => setOpen(false)} />
}

export default ProgressTrigger
