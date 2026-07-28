'use client'

import { useSyncExternalStore } from 'react'
import { AiAssistant } from '@/components/wedding/ai-assistant'
import { useWewedStore } from '@/lib/store'

/* ============================================================
   AiTrigger — invisible wrapper for the floating guest AI
   ------------------------------------------------------------
   Renders the AiAssistant bubble. Manages a 24-hour dismissal:
   if the guest clicks the small "hide" affordance, the bubble
   is suppressed for 24 hours (timestamp stored in localStorage).
   After 24h the bubble re-appears so guests can find it again.

   Uses useSyncExternalStore to read localStorage — the React-
   blessed pattern for external state. This avoids both the
   set-state-in-effect anti-pattern AND any SSR hydration
   mismatch (server snapshot is always `false`, so the bubble
   renders null during SSR and appears only after hydration).

   Exported as `AiTrigger` (named) and default. Drop this once
   somewhere high in the tree (e.g. in layout or page) — it
   renders null when dismissed.
   ============================================================ */

const DISMISS_KEY = 'wewed:ai-assistant-dismissed'
const DISMISS_MS = 24 * 60 * 60 * 1000 // 24 hours
const CHANGE_EVENT = 'wewed:ai-dismiss-change'

// ─── External store wiring ──────────────────────────────────────
function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('storage', callback)
  window.addEventListener(CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(CHANGE_EVENT, callback)
  }
}

function getSnapshot(): boolean {
  // Returns true when the bubble should be visible
  // (i.e. NOT dismissed within the last 24h).
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    if (!raw) return true
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) return true
    // If 24h have elapsed, the dismissal is stale — show again.
    if (Date.now() - n >= DISMISS_MS) {
      // Best-effort cleanup of the stale timestamp
      try {
        window.localStorage.removeItem(DISMISS_KEY)
      } catch {
        /* ignore */
      }
      return true
    }
    return false
  } catch {
    return true
  }
}

function getServerSnapshot(): boolean {
  // SSR / initial hydration: always render null.
  // After hydration the client snapshot takes over.
  return false
}

// ─── Component ──────────────────────────────────────────────────
export function AiTrigger() {
  const visible = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  // Hide the floating AI bubble whenever the full-screen WeddingPlanner
  // dialog is mounted. The planner has its own scroll-lock and focus
  // management; layering a second floating button on top causes focus
  // conflicts and (in some flows) inadvertent logout. Reading this
  // transient flag from the store is cheap and SSR-safe (defaults to
  // false on the server and after hydration, since it is not persisted).
  const plannerOpen = useWewedStore((s) => s.plannerOpen)

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
      // Notify this tab (storage event only fires for OTHER tabs)
      window.dispatchEvent(new Event(CHANGE_EVENT))
    } catch {
      /* ignore (private mode, etc.) */
    }
  }

  if (!visible) return null
  if (plannerOpen) return null
  return <AiAssistant onDismiss={handleDismiss} />
}

export default AiTrigger
