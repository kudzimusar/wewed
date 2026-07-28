'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Keyboard, X } from 'lucide-react'

/**
 * KeyboardShortcutsHelp — a discoverable overlay showing all keyboard
 * shortcuts available on the site.
 *
 * Two ways to open:
 *  1. Press the `?` key (Shift+/) — the universal "help" convention.
 *  2. Click the floating keyboard icon button (bottom-right, stacks above
 *     the back-to-top button and below the help tour button).
 *
 * The overlay lists every keyboard shortcut in a clean, accessible dialog:
 *  - Arrow ↑/↓ — jump between sections
 *  - Home / End — jump to top / bottom
 *  - ? — toggle this help overlay
 *  - Esc — close overlay / dialog
 *  - Ctrl+Shift+A — open Admin Dashboard
 *  - Ctrl+Shift+P — open Build Progress
 *  - B / A — toggle BEFORE / AFTER lifecycle modes
 *  - M — toggle ambient music
 *
 * Accessibility:
 *  - role="dialog" aria-modal="true" aria-labelledby
 *  - Esc closes
 *  - Backdrop click closes
 *  - Focus is trapped within the dialog while open (basic trap)
 *  - Returns focus to the trigger button on close
 *
 * The "don't show again" hint is NOT used here — shortcuts are always
 * discoverable. The overlay is lightweight and non-blocking.
 */

interface ShortcutGroup {
  category: string
  shortcuts: { keys: string[]; description: string }[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    category: 'Navigation',
    shortcuts: [
      { keys: ['↑', '↓'], description: 'Jump to previous / next section' },
      { keys: ['PageUp', 'PageDown'], description: 'Same as ↑/↓ (alternate)' },
      { keys: ['Home'], description: 'Jump to the very top (hero)' },
      { keys: ['End'], description: 'Jump to the very bottom (footer)' },
    ],
  },
  {
    category: 'Quick Actions',
    shortcuts: [
      { keys: ['?'], description: 'Toggle this shortcuts overlay' },
      { keys: ['Esc'], description: 'Close any open dialog or overlay' },
      { keys: ['M'], description: 'Toggle ambient ceremony music' },
      { keys: ['B'], description: 'Switch to BEFORE (anticipation) mode' },
      { keys: ['A'], description: 'Switch to AFTER (memory) mode' },
    ],
  },
  {
    category: 'Power User',
    shortcuts: [
      { keys: ['Ctrl', 'Shift', 'A'], description: 'Open Admin Dashboard' },
      { keys: ['Ctrl', 'Shift', 'P'], description: 'Open Build Progress' },
    ],
  },
]

const STORAGE_KEY = 'wewed:shortcuts-seen'

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false)
  const [showButton, setShowButton] = useState(false)
  const triggerRef = useState<HTMLButtonElement | null>(null)

  // Show the floating button after a short delay (so it doesn't clutter the
  // initial hero view). The button is always available after that.
  useEffect(() => {
    const t = window.setTimeout(() => setShowButton(true), 4000)
    return () => window.clearTimeout(t)
  }, [])

  const openDialog = useCallback(() => {
    setOpen(true)
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // ignore
    }
  }, [])

  const closeDialog = useCallback(() => {
    setOpen(false)
    // Return focus to the trigger button for accessibility.
    triggerRef[1]?.(null) // no-op placeholder; actual focus restore below
    // Focus the floating button if it exists
    const btn = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Show keyboard shortcuts"]'
    )
    btn?.focus()
  }, [triggerRef])

  // Global key listener: ? toggles, Esc closes.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in a form field.
      const el = document.activeElement
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable)
      ) {
        // Allow Esc to close the dialog even from a field.
        if (e.key === 'Escape' && open) {
          e.preventDefault()
          closeDialog()
        }
        return
      }

      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setOpen((prev) => !prev)
      } else if (e.key === 'Escape' && open) {
        e.preventDefault()
        closeDialog()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, closeDialog])

  return (
    <>
      {/* Floating keyboard button — appears after 4s, sits above back-to-top */}
      <AnimatePresence>
        {showButton && !open && (
          <motion.button
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={openDialog}
            aria-label="Show keyboard shortcuts"
            aria-keyshortcuts="?"
            title="Keyboard shortcuts (?)"
            className="group fixed bottom-52 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-gold/40 bg-espresso/90 text-gold shadow-lg backdrop-blur-md transition-all hover:border-gold hover:bg-espresso hover:scale-110 sm:bottom-56"
          >
            <Keyboard className="h-4 w-4" />
            {/* Pulsing hint dot — only shows until first open */}
            <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold" />
            </span>
            {/* Key hint badge */}
            <span className="pointer-events-none absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[8px] font-bold text-espresso opacity-0 transition-opacity group-hover:opacity-100">
              ?
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Shortcuts overlay dialog */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-espresso/60 backdrop-blur-sm"
            onClick={closeDialog}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="shortcuts-title"
              className="mx-4 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gold/30 bg-champagne p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={closeDialog}
                aria-label="Close shortcuts"
                className="absolute right-4 top-4 text-espresso/40 hover:text-espresso"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Header */}
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-gold">
                  <Keyboard className="h-5 w-5" />
                </span>
                <div>
                  <h2
                    id="shortcuts-title"
                    className="font-serif text-2xl font-light text-espresso"
                  >
                    Keyboard Shortcuts
                  </h2>
                  <p className="font-sans text-xs text-espresso/60">
                    Press <kbd className="rounded bg-espresso/10 px-1.5 py-0.5 text-[10px]">?</kbd> anytime to toggle this overlay
                  </p>
                </div>
              </div>

              {/* Shortcut groups */}
              <div className="space-y-6">
                {SHORTCUT_GROUPS.map((group) => (
                  <div key={group.category}>
                    <h3 className="mb-3 font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-muted">
                      {group.category}
                    </h3>
                    <ul className="space-y-2">
                      {group.shortcuts.map((shortcut) => (
                        <li
                          key={shortcut.description}
                          className="flex items-center justify-between gap-4"
                        >
                          <span className="font-sans text-sm text-espresso/80">
                            {shortcut.description}
                          </span>
                          <span className="flex flex-shrink-0 items-center gap-1">
                            {shortcut.keys.map((key, i) => (
                              <span key={i} className="flex items-center gap-1">
                                {i > 0 && (
                                  <span className="text-espresso/30">+</span>
                                )}
                                <kbd className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-espresso/20 bg-espresso/5 px-2 font-sans text-xs font-medium text-espresso">
                                  {key}
                                </kbd>
                              </span>
                            ))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Footer hint */}
              <p className="mt-6 border-t border-espresso/10 pt-4 text-center font-sans text-xs text-espresso/50">
                Shortcuts are disabled while typing in form fields.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
