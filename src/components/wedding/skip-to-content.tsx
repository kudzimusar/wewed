'use client'

/**
 * SkipToContent — accessibility best-practice "skip link".
 *
 * A visually-hidden link at the very top of the page that becomes visible
 * when focused (via Tab key). Screen reader users and keyboard navigators
 * can press Enter to skip past the navbar and jump directly to the main
 * content, avoiding having to tab through every nav link on every page.
 *
 * Behavior:
 *  - Hidden off-screen by default (sr-only + translate).
 *  - On focus: slides into view at top-left, fully visible.
 *  - On click/Enter: moves focus to the <main> element's first heading.
 *  - The target <main> element gets tabIndex={-1} so it can receive focus.
 *
 * This is a WCAG 2.1 Level A requirement (Success Criterion 2.4.1 Bypass
 * Blocks).
 */

export function SkipToContent() {
  const handleSkip = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const main = document.querySelector('main')
    if (main) {
      // Make the main element focusable, then focus it.
      main.setAttribute('tabindex', '-1')
      ;(main as HTMLElement).focus({ preventScroll: false })
      // Smooth-scroll to the top of main (in case the user is deep in the page)
      main.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLAnchorElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleSkip(e as unknown as React.MouseEvent<HTMLAnchorElement>)
    }
  }

  return (
    <a
      href="#main-content"
      onClick={handleSkip}
      onKeyDown={handleKeyDown}
      className="sr-only z-[100] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-full focus:border-gold/40 focus:bg-espresso focus:px-5 focus:py-2.5 focus:font-sans focus:text-xs focus:font-medium focus:uppercase focus:tracking-[0.18em] focus:text-gold focus:shadow-2xl focus:outline-none focus:ring-2 focus:ring-gold/60"
    >
      Skip to content
    </a>
  )
}
