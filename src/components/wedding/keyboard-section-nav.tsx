'use client'

import { useEffect, useCallback, useRef } from 'react'

/**
 * KeyboardSectionNav — arrow-key navigation between page sections.
 *
 * Lets keyboard users jump between the major sections of the long single-page
 * site using ArrowDown / ArrowUp (and PageDown / PageUp for good measure).
 * This is a genuine accessibility + power-user feature: on a very long page,
 * a single keypress moves focus to the next section's heading instead of
 * requiring many scrolls or precise navbar clicks.
 *
 * Behavior:
 *  - ArrowDown / PageDown → scroll to the NEXT section below the current
 *    viewport center.
 *  - ArrowUp / PageUp → scroll to the PREVIOUS section above the current
 *    viewport center.
 *  - Home → scroll to the very top (hero).
 *  - End → scroll to the very bottom (footer).
 *
 * Guards:
 *  - Only fires when no form input/textarea/contenteditable is focused (so
 *    typing in the RSVP form isn't hijacked).
 *  - Only fires when no modifier key (Ctrl/Meta/Alt/Shift) is held, so browser
 *    and OS shortcuts still work.
 *  - Respects prefers-reduced-motion for the scroll behavior.
 *  - Does NOT preventDefault on keys it doesn't handle, so normal scrolling
 *    and all other keyboard interactions are unaffected.
 *
 * The list of sections is derived from the navbar's PRIMARY_NAV + SECONDARY_NAV
 * IDs (kept in sync manually here). Sections that don't exist in the DOM are
 * skipped. The component renders nothing — it's a pure side-effect hook.
 */

// Section IDs in the order they appear on the page (top → bottom).
// This mirrors the navbar's PRIMARY_NAV + SECONDARY_NAV, sorted by DOM order.
// Keeping it static avoids runtime coupling to the navbar component.
const SECTION_IDS = [
  'home',
  'story',
  'venue',
  'theday',
  'rsvp',
  'travel',
  'registry',
  'songbook',
  'guests',
  'vendors',
  'checkin',
  'gallery-enhanced',
  'share',
  'capsule',
  'livewall',
  'village',
  'faq',
  'share-wedding',
  'pricing',
  'vision',
  'merch',
] as const

function isTypingTarget(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (el.isContentEditable) return true
  // Also bail if focus is inside a [role="textbox"] (rich text editors).
  if (el.closest('[role="textbox"]')) return true
  return false
}

export function KeyboardSectionNav() {
  const sectionsRef = useRef<HTMLElement[]>([])

  // Refresh the list of actually-present sections whenever the DOM might have
  // changed (e.g. BEFORE/AFTER toggle swaps the section list).
  useEffect(() => {
    const refresh = () => {
      sectionsRef.current = SECTION_IDS
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => el !== null)
    }
    refresh()
    // Re-check on a delay to catch client-side section swaps (lifecycle toggle).
    const t = window.setTimeout(refresh, 500)
    return () => window.clearTimeout(t)
  }, [])

  const findCurrentIndex = useCallback((): number => {
    const sections = sectionsRef.current
    if (sections.length === 0) return -1
    const viewportCenter = window.scrollY + window.innerHeight / 2
    // Find the last section whose top is above the viewport center.
    let currentIdx = 0
    for (let i = 0; i < sections.length; i++) {
      const top = sections[i].offsetTop
      if (top <= viewportCenter) {
        currentIdx = i
      } else {
        break
      }
    }
    return currentIdx
  }, [])

  const scrollToSection = useCallback((idx: number) => {
    const sections = sectionsRef.current
    if (idx < 0 || idx >= sections.length) return
    const target = sections[idx]
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    target.scrollIntoView({
      behavior: prefersReduced ? 'auto' : 'smooth',
      block: 'start',
    })
    // Move focus to the section's heading (if it has one) for screen readers.
    const heading = target.querySelector('h1, h2, h3')
    if (heading instanceof HTMLElement) {
      // Make it focusable temporarily without adding a visible focus ring.
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Bail if the user is typing in a form field.
      if (isTypingTarget(document.activeElement)) return
      // Bail if any modifier is held — let browser/OS shortcuts work.
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return

      const key = e.key
      // Only handle the keys we care about.
      if (
        key !== 'ArrowDown' &&
        key !== 'ArrowUp' &&
        key !== 'PageDown' &&
        key !== 'PageUp' &&
        key !== 'Home' &&
        key !== 'End'
      ) {
        return
      }

      const sections = sectionsRef.current
      if (sections.length === 0) return

      const currentIdx = findCurrentIndex()

      if (key === 'ArrowDown' || key === 'PageDown') {
        e.preventDefault()
        scrollToSection(Math.min(currentIdx + 1, sections.length - 1))
      } else if (key === 'ArrowUp' || key === 'PageUp') {
        e.preventDefault()
        scrollToSection(Math.max(currentIdx - 1, 0))
      } else if (key === 'Home') {
        e.preventDefault()
        scrollToSection(0)
      } else if (key === 'End') {
        e.preventDefault()
        scrollToSection(sections.length - 1)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [findCurrentIndex, scrollToSection])

  // Renders nothing — pure side-effect.
  return null
}
