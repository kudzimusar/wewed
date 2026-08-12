'use client'

import { PWARegister } from '@/components/wedding/pwa-register'
import { AdminTrigger } from '@/components/wedding/admin-trigger'
import { AiTrigger } from '@/components/wedding/ai-trigger'
import { CoupleLogin } from '@/components/wedding/couple-login'
import { StoreRehydrator } from '@/components/wedding/store-rehydrator'
import { SectionTracker } from '@/components/wedding/section-tracker'
import { KeyboardSectionNav } from '@/components/wedding/keyboard-section-nav'
import { KeyboardShortcutsHelp } from '@/components/wedding/keyboard-shortcuts-help'
import type {
  PublicWeddingAccessKind,
  WeddingViewerRole,
} from '@/lib/wedding-access-kind'

/**
 * Role-aware global wedding chrome.
 *
 * Guests receive only the guest-safe AI entry point. RSVP, contributions,
 * share/QR, help and other social actions remain available inside their
 * relevant sections or the top navigation instead of competing as floating
 * controls. Private owner/admin tools are mounted only from server-resolved
 * access state.
 */
export function GlobalWeddingTools({
  accessKind,
  viewerRole,
}: {
  accessKind: PublicWeddingAccessKind
  viewerRole: WeddingViewerRole
}) {
  const isCoupleOwner = accessKind === 'couple_owner' && viewerRole === 'couple'
  const isAdmin = viewerRole === 'admin'
  const showKeyboardTools = isCoupleOwner || isAdmin

  return (
    <>
      <StoreRehydrator />
      <PWARegister />
      <SectionTracker />
      <AiTrigger />
      {isAdmin && <AdminTrigger />}
      {isCoupleOwner && <CoupleLogin accessKind={accessKind} />}
      {showKeyboardTools && <KeyboardSectionNav />}
      {showKeyboardTools && <KeyboardShortcutsHelp />}
    </>
  )
}
