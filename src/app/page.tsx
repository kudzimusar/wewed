'use client'

import { useState, useEffect } from 'react'
import { useWewedStore } from '@/lib/store'
import { WeddingDataProvider } from '@/components/wedding/wedding-data-provider'
import { Navbar } from '@/components/wedding/navbar'
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
import { PricingSection } from '@/components/wedding/pricing-section'
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
import { OnboardingWizard } from '@/components/wedding/onboarding-wizard'
import { ThemeApplier } from '@/components/wedding/theme-applier'

// SSR-safe: starts as 'before', switches to stored lifecycle after mount

export default function Home() {
  const lifecycle = useWewedStore((s) => s.lifecycle)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => {
      setMounted(true)
      useWewedStore.persist.rehydrate()
    }, 0)
    return () => window.clearTimeout(id)
  }, [])
  // Use 'before' on server + first client render to avoid hydration mismatch
  const activeLifecycle = mounted ? lifecycle : 'before'

  // ── Onboarding wizard handled by trigger in layout ──

  // ── Token-gated contribution editor handled by ContributionTrigger in layout ──

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Print-only header — hidden on screen, visible in print */}
      <div className="wewed-print-header" aria-hidden="true">
        <h1>Charity &amp; Kudzie</h1>
        <p>23 · 12 · 26 · Imba Manor, Harare, Zimbabwe</p>
      </div>
      <Navbar />
      <WeddingDataProvider>
      <ThemeApplier />
      <main id="main-content" className="flex-1">
        <HeroSection />
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
            <PricingSection />
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
            <PricingSection />
            <PlatformVision />
            <MerchTeaser />
          </>
        )}
      </main>
      </WeddingDataProvider>
      <Footer />
      {/* Print-only footer — hidden on screen, visible in print */}
      <div className="wewed-print-footer" aria-hidden="true">
        Printed from wewed.app/charity-and-kudzie · Charity &amp; Kudzie · 23 December 2026
      </div>
    </div>
  )
}
