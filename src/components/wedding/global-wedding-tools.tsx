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
 * Ordinary guests receive the wedding itself, not an owner/admin control dock.
 * Private AI/edit/dashboard/admin/keyboard affordances are mounted only after a
 * signed server session resolves the active wedding role.
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
  const showOwnerUtilities = isCoupleOwner || isAdmin

  return (
    <>
      <StoreRehydrator />
      <PWARegister />
      <SectionTracker />
      {showOwnerUtilities && <AiTrigger />}
      {isAdmin && <AdminTrigger />}
      {isCoupleOwner && <CoupleLogin accessKind={accessKind} />}
      {showOwnerUtilities && <KeyboardSectionNav />}
      {showOwnerUtilities && <KeyboardShortcutsHelp />}
    </>
  )
}
