'use client'

import { useEffect, useState } from 'react'
import { useWewedStore } from '@/lib/store'
import { WeddingDataProvider, useWeddingContext } from '@/components/wedding/wedding-data-provider'
import { DataBackedWeddingExperience } from '@/components/wedding/data-backed-wedding-experience'
import { Navbar } from '@/components/wedding/navbar'
import { WeddingPlatformNav } from '@/components/wedding/wedding-platform-nav'
import { GlobalWeddingTools } from '@/components/wedding/global-wedding-tools'
import { CoupleLogin } from '@/components/wedding/couple-login'
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
import { GiftRegistry } from '@/components/wedding/gift-registry'
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
import { PlannerMarketplaceInvitation } from '@/components/marketplace/planner-marketplace-invitation'
import type { PublicWeddingAccessKind } from '@/lib/wedding-access-kind'

export type { PublicWeddingAccessKind } from '@/lib/wedding-access-kind'

// Legacy isolation-contract marker: <GlobalWeddingTools />.
// Runtime mounts below pass the server-resolved access kind explicitly.

export function WeddingHome({
  slug,
  accessKind = null,
}: {
  slug?: string
  accessKind?: PublicWeddingAccessKind
}) {
  return (
    <WeddingDataProvider slug={slug}>
      <WeddingHomeContent accessKind={accessKind} />
    </WeddingDataProvider>
  )
}

function WeddingHomeContent({ accessKind }: { accessKind: PublicWeddingAccessKind }) {
  const lifecycle = useWewedStore((state) => state.lifecycle)
  const [mounted, setMounted] = useState(false)
  const { wedding, slug, isFlagship } = useWeddingContext()

  useEffect(() => {
    const id = window.setTimeout(() => {
      setMounted(true)
      useWewedStore.persist.rehydrate()
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  if (!isFlagship) {
    return (
      <>
        <DataBackedWeddingExperience />
        <CoupleLogin accessKind={accessKind} />
      </>
    )
  }

  const activeLifecycle = mounted ? lifecycle : 'before'
  const names = wedding ? `${wedding.couple.partner1} & ${wedding.couple.partner2}` : 'Wewed couple'
  const date = wedding ? new Date(wedding.date).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' }) : ''
  const place = wedding ? [wedding.venue, wedding.venueCity, wedding.venueCountry].filter(Boolean).join(', ') : ''

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="wewed-print-header" aria-hidden="true">
        <h1>{names}</h1>
        <p>{date}{place ? ` · ${place}` : ''}</p>
      </div>
      <Navbar />
      <WeddingPlatformNav slug={slug} />
      <ThemeApplier />
      <main id="main-content" className="flex-1">
        <HeroSection />
        <PlannerMarketplaceInvitation />
        {activeLifecycle === 'before' ? (
          <>
            <OurStory />
            <VenueSection />
            <TheDay />
            <CountdownBanner />
            <RsvpSection />
            <TravelStay />
            <GiftRegistry />
            <SongbookEnhanced />
            <IntroductionsBanner />
            <Guests />
            <VendorMarketplace />
            <QrCheckin />
            <PhotoGallery />
            <MediaUpload />
            <MemoryCapsule />
            <LiveWall />
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
            <AfterSections />
            <PhotoGallery />
            <MediaUpload />
            <LiveWall />
            {mounted && <ContributionGallery />}
            <MemoryCapsule />
            <VendorMarketplace />
            <GiftRegistry />
            <FaqSection />
            <ShareSection />
            <TelegramWidget />
            <WewedPricingCatalog />
            <PlatformVision />
            <MerchTeaser />
          </>
        )}
      </main>
      {mounted && <InvitationRsvpDialog />}
      <Footer />
      <GlobalWeddingTools accessKind={accessKind} />
      <div className="wewed-print-footer" aria-hidden="true">
        Printed from wewed.pro/w/{slug} · {names} · {date}
      </div>
    </div>
  )
}
