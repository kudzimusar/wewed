'use client'

import { useEffect, useState } from 'react'
import { useWewedStore } from '@/lib/store'
import { WeddingDataProvider, useWeddingContext } from '@/components/wedding/wedding-data-provider'
import { Navbar } from '@/components/wedding/navbar'
import { WeddingPlatformNav } from '@/components/wedding/wedding-platform-nav'
import { GlobalWeddingTools } from '@/components/wedding/global-wedding-tools'
import { HeroSection } from '@/components/wedding/hero-section'
import { CountdownBanner } from '@/components/wedding/countdown-banner'
import { OurStory } from '@/components/wedding/our-story'
import { VenueSection } from '@/components/wedding/venue-section'
import { TheDay } from '@/components/wedding/the-day'
import { RsvpSection } from '@/components/wedding/rsvp-section'
import { TravelStay } from '@/components/wedding/travel-stay'
import { SongbookEnhanced } from '@/components/wedding/songbook-enhanced'
import { IntroductionsBanner } from '@/components/wedding/introductions-banner'
import { Guests } from '@/components/wedding/guests'
import { WewedPricingCatalog } from '@/components/public/wewed-pricing-catalog'
import { PlatformVision } from '@/components/wedding/platform-vision'
import { MerchTeaser } from '@/components/wedding/merch-teaser'
import { FaqSection } from '@/components/wedding/faq-section'
import { GiftRegistryCampaignBridge } from '@/components/wedding/gift-registry-campaign-bridge'
import { QrCheckin } from '@/components/wedding/qr-checkin'
import { MemoryCapsule } from '@/components/wedding/memory-capsule'
import { LiveWall } from '@/components/wedding/live-wall'
import { MediaUpload } from '@/components/wedding/media-upload'
import { PhotoGallery } from '@/components/wedding/photo-gallery'
import { VendorMarketplace } from '@/components/wedding/vendor-marketplace'
import { ShareSection } from '@/components/wedding/share-section'
import { TelegramWidget } from '@/components/wedding/telegram-widget'
import { AfterSections } from '@/components/wedding/after-sections'
import { Footer } from '@/components/wedding/footer'
import { ContributionGallery } from '@/components/wedding/contribution-gallery'
import { ThemeApplier } from '@/components/wedding/theme-applier'
import { InvitationRsvpDialog } from '@/components/wedding/invitation-rsvp-dialog'
import { PremiumInvitationExperience } from '@/components/wedding/invitation-experience/premium-invitation-experience'
import { PlannerMarketplaceInvitation } from '@/components/marketplace/planner-marketplace-invitation'
import type { WeddingData } from '@/lib/wedding-data'
import type { InvitationCardStyle } from '@/lib/digital-invitation-card'
import type {
  PublicWeddingAccessKind,
  WeddingViewerRole,
} from '@/lib/wedding-access-kind'

export type { PublicWeddingAccessKind } from '@/lib/wedding-access-kind'

export function WeddingHome({
  slug,
  accessKind = null,
  viewerRole = null,
  initialData = null,
  invitationMode = false,
  invitationCardStyle = null,
}: {
  slug?: string
  accessKind?: PublicWeddingAccessKind
  viewerRole?: WeddingViewerRole
  initialData?: WeddingData | null
  invitationMode?: boolean
  invitationCardStyle?: InvitationCardStyle | null
}) {
  return (
    <WeddingDataProvider slug={slug} initialData={initialData}>
      <WeddingHomeContent
        accessKind={accessKind}
        viewerRole={viewerRole}
        invitationMode={invitationMode}
        invitationCardStyle={invitationCardStyle}
      />
    </WeddingDataProvider>
  )
}

function WeddingHomeContent({
  accessKind,
  viewerRole,
  invitationMode,
  invitationCardStyle,
}: {
  accessKind: PublicWeddingAccessKind
  viewerRole: WeddingViewerRole
  invitationMode: boolean
  invitationCardStyle: InvitationCardStyle | null
}) {
  const lifecycle = useWewedStore((state) => state.lifecycle)
  const setLifecycle = useWewedStore((state) => state.setLifecycle)
  const [mounted, setMounted] = useState(false)
  const { wedding, slug } = useWeddingContext()

  useEffect(() => {
    const id = window.setTimeout(() => {
      setMounted(true)
      useWewedStore.persist.rehydrate()
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!wedding) return
    if (wedding.lifecycle === 'before' || wedding.lifecycle === 'after') {
      setLifecycle(wedding.lifecycle)
    }
  }, [wedding, setLifecycle])

  const activeLifecycle = mounted
    ? lifecycle
    : wedding?.lifecycle === 'after'
      ? 'after'
      : 'before'
  const names = wedding ? `${wedding.couple.partner1} & ${wedding.couple.partner2}` : 'Wewed couple'
  const date = wedding ? new Date(wedding.date).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' }) : ''
  const place = wedding ? [wedding.venue, wedding.venueCity, wedding.venueCountry].filter(Boolean).join(', ') : ''
  const isCoupleOwner = accessKind === 'couple_owner' && viewerRole === 'couple'
  const canContribute = accessKind !== 'public' && accessKind !== null
  const showPersonalInvitation = Boolean(invitationMode && invitationCardStyle && accessKind === 'invited_guest' && wedding)

  const invitationData = wedding ? {
    title: names,
    monogram: wedding.monogram,
    tagline: wedding.tagline,
    date: wedding.date,
    venue: wedding.venue,
    venueCity: wedding.venueCity,
    venueCountry: wedding.venueCountry,
    guestName: null,
    message: null,
    rsvpDeadline: null,
    primaryColor: wedding.theme.primaryColor,
    accentColor: wedding.theme.accentColor,
    backgroundColor: wedding.theme.backgroundColor,
  } : null

  return (
    <div className="min-h-screen flex flex-col bg-background" data-personal-invitation={showPersonalInvitation ? '1' : '0'}>
      <div className="wewed-print-header" aria-hidden="true">
        <h1>{names}</h1>
        <p>{date}{place ? ` · ${place}` : ''}</p>
      </div>
      <ThemeApplier />

      {showPersonalInvitation && invitationData && invitationCardStyle && (
        <PremiumInvitationExperience
          slug={slug}
          data={invitationData}
          style={invitationCardStyle}
          personalizeFromGuestSession
        />
      )}

      <div id="wedding-details" className="scroll-mt-4">
        <Navbar accessKind={accessKind} viewerRole={viewerRole} />
        <WeddingPlatformNav slug={slug} />
        <main id="main-content" className="flex-1" data-canonical-template="classic" data-invitation-theme={showPersonalInvitation ? invitationCardStyle ?? undefined : undefined}>
          <HeroSection />
          {isCoupleOwner && <PlannerMarketplaceInvitation />}
          {activeLifecycle === 'before' ? (
            <>
              <OurStory />
              <VenueSection />
              <TheDay />
              <CountdownBanner />
              <RsvpSection />
              <TravelStay />
              <GiftRegistryCampaignBridge />
              <SongbookEnhanced />
              <IntroductionsBanner />
              <Guests />
              <VendorMarketplace />
              <QrCheckin />
              <PhotoGallery />
              {canContribute && <MediaUpload />}
              <MemoryCapsule />
              <LiveWall canPost={canContribute} />
              {mounted && <ContributionGallery />}
              <FaqSection />
              <ShareSection />
              <TelegramWidget />
              <WewedPricingCatalog />
              <PlatformVision />
              <MerchTeaser />
            </>
          ) : (
            <>
              <AfterSections canPost={canContribute} />
              <PhotoGallery />
              {canContribute && <MediaUpload />}
              <LiveWall canPost={canContribute} />
              {mounted && <ContributionGallery />}
              <MemoryCapsule />
              <VendorMarketplace />
              <GiftRegistryCampaignBridge />
              <FaqSection />
              <ShareSection />
              <TelegramWidget />
              <WewedPricingCatalog />
              <PlatformVision />
              <MerchTeaser />
            </>
          )}
        </main>
      </div>
      {mounted && !showPersonalInvitation && <InvitationRsvpDialog />}
      <Footer />
      <GlobalWeddingTools accessKind={accessKind} viewerRole={viewerRole} />
      <div className="wewed-print-footer" aria-hidden="true">
        Printed from wewed.pro/w/{slug} · {names} · {date}
      </div>
    </div>
  )
}
