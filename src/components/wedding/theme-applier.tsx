'use client'

import { useEffect } from 'react'
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider'

/**
 * ThemeApplier — reads the wedding's theme colors from the context
 * and applies them as CSS custom properties on :root.
 *
 * This enables per-couple theming: each wedding can have different
 * primary, accent, memory, and background colors.
 *
 * The Wedding model already stores:
 *   primaryColor    (default #BF9B5F — gold)
 *   accentColor     (default #C0633F — clay)
 *   memoryColor     (default #6B2D3A — plum)
 *   backgroundColor (default #FBF6EE — champagne)
 *
 * These are set during onboarding (the theme picker) and can be
 * changed by the couple in the admin dashboard.
 *
 * Mount this inside <WeddingDataProvider> (e.g. in page.tsx).
 */
export function ThemeApplier() {
  const ctx = useWeddingContextSafe()

  useEffect(() => {
    if (!ctx?.wedding?.theme) return

    const { primaryColor, accentColor, memoryColor, backgroundColor } = ctx.wedding.theme
    const root = document.documentElement

    // Apply theme colors as CSS variables
    root.style.setProperty('--color-gold', primaryColor)
    root.style.setProperty('--color-clay', accentColor)
    root.style.setProperty('--color-plum', memoryColor)
    root.style.setProperty('--color-champagne', backgroundColor)
    root.style.setProperty('--color-ivory', backgroundColor)

    // Also set the shadcn theme tokens so all components inherit
    root.style.setProperty('--primary', primaryColor)
    root.style.setProperty('--accent', accentColor)
    root.style.setProperty('--background', backgroundColor)
    root.style.setProperty('--ring', primaryColor)
  }, [ctx?.wedding?.theme])

  return null
}
