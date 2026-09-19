'use client'

import { useEffect, useMemo, useState } from 'react'
import { useWewedStore } from '@/lib/store'
import { WeddingDataProvider, useWeddingContext } from '@/components/wedding/wedding-data-provider'
import { Navbar } from '@/components/wedding/navbar'
import { GlobalWeddingTools } from '@/components/wedding/global-wedding-tools'
import { HeroSection } from '@/components/wedding/hero-section'
import { CountdownBanner } from '@/components/wedding/countdown-banner'
import { InvitationCountdown } from '@/components/wedding/invitation-countdown'
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
import { PremiumInvitationRsvpDialog } from '@/components/wedding/invitation-experience/premium-invitation-rsvp-dialog'
import { WeddingGuestPassDialog } from '@/components/wedding/invitation-experience/wedding-guest-pass-dialog'
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
  invitationGuestPresentation = false,
  invitationGuestName = null,
  invitationArrivalMode = false,
  sharedPhysicalInvitation = false,
}: {
  slug?: string
  accessKind?: PublicWeddingAccessKind
  viewerRole?: WeddingViewerRole
  initialData?: WeddingData | null
  invitationMode?: boolean
  invitationCardStyle?: InvitationCardStyle | null
  invitationGuestPresentation?: boolean
  invitationGuestName?: string | null
  invitationArrivalMode?: boolean
  sharedPhysicalInvitation?: boolean
}) {
  return (
    <WeddingDataProvider slug={slug} initialData={initialData}>
      <WeddingHomeContent
        accessKind={accessKind}
        viewerRole={viewerRole}
        invitationMode={invitationMode}
        invitationCardStyle={invitationCardStyle}
        invitationGuestPresentation={invitationGuestPresentation}
        invitationGuestName={invitationGuestName}
        invitationArrivalMode={invitationArrivalMode}
        sharedPhysicalInvitation={sharedPhysicalInvitation}
      />
    </WeddingDataProvider>
  )
}

function WeddingHomeContent({
  accessKind,
  viewerRole,
  invitationMode,
  invitationCardStyle,
  invitationGuestPresentation,
  invitationGuestName,
  invitationArrivalMode,
  sharedPhysicalInvitation,
}: {
  accessKind: PublicWeddingAccessKind
  viewerRole: WeddingViewerRole
  invitationMode: boolean
  invitationCardStyle: InvitationCardStyle | null
  invitationGuestPresentation: boolean
  invitationGuestName: string | null
  invitationArrivalMode: boolean
  sharedPhysicalInvitation: boolean
}) {
  const lifecycle = useWewedStore((state) => state.lifecycle)
  const setLifecycle = useWewedStore((state) => state.setLifecycle)
  const [mounted, setMounted] = useState(false)
  const [invitationVisible, setInvitationVisible] = useState(invitationMode)
  const [arrivalDismissed, setArrivalDismissed] = useState(false)
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
  const guestInvitationPresentation =
    accessKind === 'invited_guest' || invitationGuestPresentation
  const invitationAvailable = Boolean(
    invitationCardStyle && guestInvitationPresentation && wedding,
  )
  const invitationSkipKey = slug ? `wewed:skip-invitation-once:${slug}` : null

  useEffect(() => {
    let nextVisible = false

    if (invitationAvailable && invitationSkipKey) {
      if (invitationMode) {
        nextVisible = true
      } else {
        const skipOnce = window.sessionStorage.getItem(invitationSkipKey) === '1'
        if (skipOnce) {
          window.sessionStorage.removeItem(invitationSkipKey)
        } else {
          // A full wedding-site entry with an existing invited-guest session is a fresh
          // welcome. Internal scrolling/navigation does not remount this page, while a
          // reload, browser return, or app relaunch presents the invitation again.
          nextVisible = true
        }
      }
    }

    const id = window.setTimeout(() => setInvitationVisible(nextVisible), 0)
    return () => window.clearTimeout(id)
  }, [invitationAvailable, invitationMode, invitationSkipKey])

  // The branded arrival is derived from the invitation state so it is already
  // painted on the first Android resume render; only its timed dismissal is state.
  const arrivalEligible = Boolean(invitationArrivalMode && invitationAvailable && invitationVisible)
  const arrivalVisible = arrivalEligible && !arrivalDismissed

  useEffect(() => {
    if (!arrivalEligible) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const id = window.setTimeout(() => setArrivalDismissed(true), reducedMotion ? 450 : 1550)
    return () => {
      window.clearTimeout(id)
      // Replay the arrival the next time the invitation becomes eligible again.
      setArrivalDismissed(false)
    }
  }, [arrivalEligible])

  useEffect(() => {
    if (!invitationSkipKey) return

    const handleImmediateCoupleSiteTransition = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const siteButton = target.closest('.ivory-site')
      const registryButton = target.closest('[data-testid="invitation-cta-registry"]')
      if (!siteButton && !registryButton) return

      // Keep the invitation-to-site transition entirely inside this mounted wedding
      // page. A same-document assignment such as /w/{slug}#registry is a browser
      // no-op when that hash is already present, which can leave Ivory visible even
      // though the guest tapped Gift / Contributions. Capture the intent before the
      // card handler runs, hide Ivory, clean invitation query state, then scroll only
      // after React has rendered the Couple Website sections.
      event.preventDefault()
      event.stopPropagation()
      window.sessionStorage.removeItem(invitationSkipKey)

      const anchor = registryButton ? '#registry' : ''
      const targetId = registryButton ? 'registry' : 'wedding-details'
      const cleanPath = `${window.location.pathname}${anchor}`

      setInvitationVisible(false)
      window.history.replaceState(window.history.state, '', cleanPath)

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          document.getElementById(targetId)?.scrollIntoView({
            behavior: 'auto',
            block: 'start',
          })
        })
      })
    }

    document.addEventListener('click', handleImmediateCoupleSiteTransition, true)
    return () =>
      document.removeEventListener('click', handleImmediateCoupleSiteTransition, true)
  }, [invitationSkipKey])

  const showPersonalInvitation = Boolean(invitationAvailable && invitationVisible)

  // Derive primitive inputs before memoization so the post-hydration wedding-content
  // revalidation can replace its object without recreating an equivalent invitation.
  // That keeps guest-session personalization (guest, message, RSVP deadline) intact.
  const invitationTitle = wedding ? `${wedding.couple.partner1} & ${wedding.couple.partner2}` : null
  const invitationMonogram = wedding?.monogram ?? null
  const invitationTagline = wedding?.tagline ?? null
  const invitationDate = wedding?.date ?? null
  const invitationVenue = wedding?.venue ?? null
  const invitationVenueCity = wedding?.venueCity ?? null
  const invitationVenueCountry = wedding?.venueCountry ?? null
  const invitationPrimaryColor = wedding?.theme.primaryColor ?? null
  const invitationAccentColor = wedding?.theme.accentColor ?? null
  const invitationBackgroundColor = wedding?.theme.backgroundColor ?? null

  const invitationData = useMemo(() => {
    if (!invitationTitle || !invitationDate || !invitationVenue || !invitationPrimaryColor || !invitationAccentColor || !invitationBackgroundColor) {
      return null
    }
    return {
      title: invitationTitle,
      monogram: invitationMonogram,
      tagline: invitationTagline,
      date: invitationDate,
      venue: invitationVenue,
      venueCity: invitationVenueCity ?? '',
      venueCountry: invitationVenueCountry ?? '',
      guestName: invitationGuestName,
      message: null,
      rsvpDeadline: null,
      primaryColor: invitationPrimaryColor,
      accentColor: invitationAccentColor,
      backgroundColor: invitationBackgroundColor,
    }
  }, [
    invitationTitle,
    invitationMonogram,
    invitationTagline,
    invitationDate,
    invitationVenue,
    invitationVenueCity,
    invitationVenueCountry,
    invitationGuestName,
    invitationPrimaryColor,
    invitationAccentColor,
    invitationBackgroundColor,
  ])

  function continueToCoupleSite() {
    setInvitationVisible(false)
    window.requestAnimationFrame(() => {
      document.getElementById('wedding-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function reopenInvitation() {
    if (invitationAvailable) {
      setInvitationVisible(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (sharedPhysicalInvitation && slug) {
      window.location.assign(`/w/${encodeURIComponent(slug)}`)
    }
  }

  const showWeddingChrome = !showPersonalInvitation
  const showMyWedding = invitationAvailable || sharedPhysicalInvitation

  return (
    <div className="min-h-screen flex flex-col bg-background" data-personal-invitation={showPersonalInvitation ? '1' : '0'}>
      <div className="wewed-print-header" aria-hidden="true">
        <h1>{names}</h1>
        <p>{date}{place ? ` · ${place}` : ''}</p>
      </div>
      <ThemeApplier invitationCardStyle={showPersonalInvitation ? invitationCardStyle : null} />

      {showPersonalInvitation && arrivalVisible && (
        <div
          data-testid="invitation-arrival-sequence"
          className="wewed-invitation-arrival"
          role="status"
          aria-label="Opening your Wewed invitation"
        >
          <div className="wewed-invitation-arrival-orbit" aria-hidden="true">
            <div className="wewed-invitation-arrival-mark">W</div>
          </div>
          <p className="wewed-invitation-arrival-brand">WEWED</p>
          <p className="wewed-invitation-arrival-payoff">
            Everything for a beautifully planned wedding.
          </p>
        </div>
      )}

      {showPersonalInvitation && invitationData && invitationCardStyle && (
        <>
          <div className="bg-[#17130f] px-4 pt-4 sm:pt-6">
            <InvitationCountdown date={invitationData.date} />
          </div>
          <PremiumInvitationExperience
            key={`${slug}:${invitationCardStyle}:${invitationGuestName ?? 'guest'}`}
            slug={slug}
            data={invitationData}
            style={invitationCardStyle}
            personalizeFromGuestSession
            onContinue={continueToCoupleSite}
          />
        </>
      )}

      {showWeddingChrome && (
        <div id="wedding-details" className="scroll-mt-4">
          <Navbar
            slug={slug}
            accessKind={accessKind}
            viewerRole={viewerRole}
            showMyWedding={showMyWedding}
            onMyWedding={reopenInvitation}
          />
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
      )}

      {mounted && invitationAvailable && invitationCardStyle && (
        <>
          <PremiumInvitationRsvpDialog
            key={`rsvp:${slug}:${invitationGuestName ?? 'guest'}`}
            slug={slug}
            style={invitationCardStyle}
          />
          <WeddingGuestPassDialog
            key={`pass:${slug}:${invitationGuestName ?? 'guest'}`}
            slug={slug}
          />
        </>
      )}
      {mounted && !invitationAvailable && <InvitationRsvpDialog />}
      {!showMyWedding && <Footer />}
      {showWeddingChrome && (
        <div className="h-[calc(4.5rem+env(safe-area-inset-bottom))] lg:hidden" aria-hidden="true" />
      )}
      <GlobalWeddingTools accessKind={accessKind} viewerRole={viewerRole} />
      <div className="wewed-print-footer" aria-hidden="true">
        Printed from wewed.pro/w/{slug} · {names} · {date}
      </div>
    </div>
  )
}
