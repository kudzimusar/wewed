'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * useInlineContentDB — DB-backed inline editing hook.
 *
 * This is the DB-backed successor to `useInlineContent` (which only saves to
 * localStorage). It:
 *
 *  1. Reads the initial value from the DB (via /api/wedding-content?slug=...)
 *     on mount, falling back to `defaultValue` if the API fails or the field
 *     isn't in the DB yet.
 *  2. On edit, writes to the DB via POST /api/wedding-content (admin-gated).
 *  3. ALSO writes to localStorage as a fallback / optimistic cache, so the
 *     UI updates instantly even if the POST is slow.
 *  4. Dispatches the same `wewed:content-change` CustomEvent so other
 *     components on the page update in real-time.
 *
 * This hook is backward-compatible with useInlineContent — same signature:
 *   [value, setValue, reset]
 *
 * Requires the couple to be logged in (admin auth cookie) for POST to work.
 * If not logged in, edits are saved to localStorage only (graceful fallback).
 */

const PREFIX = 'wewed:content'
const EVENT_NAME = 'wewed:content-change'

function key(weddingSlug: string, section: string, field: string): string {
  return `${PREFIX}:${weddingSlug || 'global'}:${section}:${field}`
}

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage
  } catch {
    return false
  }
}

function getLocal(weddingSlug: string, section: string, field: string): string {
  if (!hasStorage()) return ''
  try {
    return window.localStorage.getItem(key(weddingSlug, section, field)) ?? ''
  } catch {
    return ''
  }
}

function setLocal(weddingSlug: string, section: string, field: string, value: string): void {
  if (!hasStorage()) return
  try {
    window.localStorage.setItem(key(weddingSlug, section, field), value)
  } catch {
    /* ignore */
  }
}

function clearLocal(weddingSlug: string, section: string, field: string): void {
  if (!hasStorage()) return
  try {
    window.localStorage.removeItem(key(weddingSlug, section, field))
  } catch {
    /* ignore */
  }
}

function notify(weddingSlug: string, section: string, field: string, value: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, { detail: { weddingSlug, section, field, value } })
  )
}

/**
 * Save a content edit to the DB via POST /api/wedding-content.
 * Returns true on success, false on failure (e.g. not authenticated).
 */
async function saveToDB(
  weddingSlug: string,
  section: string,
  field: string,
  value: string
): Promise<boolean> {
  if (!weddingSlug) return false
  try {
    const res = await fetch('/api/wedding-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: weddingSlug,
        section,
        field,
        value,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Fetch a single content field from the DB.
 * Returns the value or '' if not found.
 */
async function fetchFromDB(
  weddingSlug: string,
  section: string,
  field: string
): Promise<string> {
  if (!weddingSlug) return ''
  try {
    const res = await fetch(
      `/api/wedding-content?slug=${encodeURIComponent(weddingSlug)}`
    )
    if (!res.ok) return ''
    const data = await res.json()
    if (!data.success || !data.content?.[section]?.[field]) return ''
    return String(data.content[section][field])
  } catch {
    return ''
  }
}

export function useInlineContentDB(
  section: string,
  field: string,
  defaultValue: string = '',
  weddingSlug: string = ''
): [string, (value: string) => void, () => void] {
  const [value, setValueState] = useState<string>(defaultValue)
  const [, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    // 1. First, check localStorage for an immediate optimistic value
    const local = getLocal(weddingSlug, section, field)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValueState(local || defaultValue)

    // 2. Then fetch from DB (authoritative source) if weddingSlug provided
    if (weddingSlug) {
      fetchFromDB(weddingSlug, section, field).then((dbValue) => {
        if (!active) return
        if (dbValue) {
          setValueState(dbValue)
          // Cache in localStorage for next mount
          setLocal(weddingSlug, section, field, dbValue)
        }
        setLoaded(true)
      })
    } else {
      setLoaded(true)
    }

    // 3. Listen for cross-component changes (from other useInlineContentDB hooks)
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail) return
      if (
        detail.weddingSlug === weddingSlug &&
        detail.section === section &&
        detail.field === field
      ) {
        setValueState(detail.value || defaultValue)
      }
    }
    window.addEventListener(EVENT_NAME, handler)
    return () => {
      active = false
      window.removeEventListener(EVENT_NAME, handler)
    }
  }, [weddingSlug, section, field, defaultValue])

  const setValue = useCallback(
    (next: string) => {
      setValueState(next) // immediate UI feedback
      setLocal(weddingSlug, section, field, next) // localStorage cache
      notify(weddingSlug, section, field, next) // cross-component sync
      // Fire-and-forget DB save (async, non-blocking)
      if (weddingSlug) {
        void saveToDB(weddingSlug, section, field, next)
      }
    },
    [weddingSlug, section, field]
  )

  const reset = useCallback(() => {
    setValueState(defaultValue)
    clearLocal(weddingSlug, section, field)
    notify(weddingSlug, section, field, '')
    // Note: we don't DELETE from DB, just reset to defaultValue
    // (deleting content rows would break the multi-couple data layer)
  }, [weddingSlug, section, field, defaultValue])

  return [value, setValue, reset]
}
