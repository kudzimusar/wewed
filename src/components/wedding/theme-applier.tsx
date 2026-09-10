'use client'

import { useEffect } from 'react'
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider'
import {
  getInvitationCardStyleDefinition,
  type InvitationCardStyle,
} from '@/lib/digital-invitation-card'

/**
 * ThemeApplier — reads the wedding's theme colors from the context
 * and applies them as CSS custom properties on :root.
 *
 * A personal premium invitation may temporarily supply an invitation card
 * style. In that case the wedding-details surface inherits the invitation's
 * palette so the reveal and the content that follows feel like one coherent
 * experience. Ordinary wedding visits continue to use the wedding's saved
 * theme unchanged.
 */
export function ThemeApplier({
  invitationCardStyle = null,
}: {
  invitationCardStyle?: InvitationCardStyle | null
}) {
  const ctx = useWeddingContextSafe()

  useEffect(() => {
    if (!ctx?.wedding?.theme) return

    const weddingTheme = ctx.wedding.theme
    const invitationPalette = invitationCardStyle
      ? getInvitationCardStyleDefinition(invitationCardStyle).palette
      : null
    const primaryColor = invitationPalette?.primary ?? weddingTheme.primaryColor
    const accentColor = invitationPalette?.accent ?? weddingTheme.accentColor
    const memoryColor = invitationPalette?.muted ?? weddingTheme.memoryColor
    const backgroundColor = invitationPalette?.paper ?? weddingTheme.backgroundColor
    const root = document.documentElement

    root.style.setProperty('--color-gold', primaryColor)
    root.style.setProperty('--color-clay', accentColor)
    root.style.setProperty('--color-plum', memoryColor)
    root.style.setProperty('--color-champagne', backgroundColor)
    root.style.setProperty('--color-ivory', backgroundColor)

    root.style.setProperty('--primary', primaryColor)
    root.style.setProperty('--accent', accentColor)
    root.style.setProperty('--background', backgroundColor)
    root.style.setProperty('--ring', primaryColor)
  }, [ctx?.wedding?.theme, invitationCardStyle])

  return null
}
