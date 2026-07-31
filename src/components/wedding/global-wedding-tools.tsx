'use client'

import { usePathname } from 'next/navigation'
import { PWARegister } from '@/components/wedding/pwa-register'
import { InstallPrompt } from '@/components/wedding/install-prompt'
import { AdminTrigger } from '@/components/wedding/admin-trigger'
import { ProgressTrigger } from '@/components/wedding/progress-trigger'
import { AiTrigger } from '@/components/wedding/ai-trigger'
import { WhatsAppRSVP } from '@/components/wedding/whatsapp-rsvp'
import { CoupleLogin } from '@/components/wedding/couple-login'
import { ContributionTrigger } from '@/components/wedding/contribution-trigger'
import { HelpPopups } from '@/components/wedding/help-popups'
import { OnboardingTrigger } from '@/components/wedding/onboarding-trigger'
import { StoreRehydrator } from '@/components/wedding/store-rehydrator'
import { ScrollProgressBackToTop } from '@/components/wedding/scroll-progress'
import { AmbientMusicPlayer } from '@/components/wedding/ambient-music-player'
import { SectionTracker } from '@/components/wedding/section-tracker'
import { KeyboardSectionNav } from '@/components/wedding/keyboard-section-nav'
import { KeyboardShortcutsHelp } from '@/components/wedding/keyboard-shortcuts-help'
import { PublicRegistrationTrigger } from '@/components/public/public-registration-trigger'

export function GlobalWeddingTools() {
  const pathname = usePathname()
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')

  if (isAdminRoute) return null

  return (
    <>
      <StoreRehydrator />
      <PWARegister />
      <InstallPrompt />
      <AdminTrigger />
      <ProgressTrigger />
      <AiTrigger />
      <WhatsAppRSVP />
      <CoupleLogin />
      <ContributionTrigger />
      <HelpPopups />
      <OnboardingTrigger />
      <ScrollProgressBackToTop />
      <AmbientMusicPlayer />
      <SectionTracker />
      <KeyboardSectionNav />
      <KeyboardShortcutsHelp />
      <PublicRegistrationTrigger />
    </>
  )
}
