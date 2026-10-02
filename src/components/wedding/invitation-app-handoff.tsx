'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Smartphone } from 'lucide-react'
import { buildInvitationContinuePath } from '@/lib/invitation-links'

type ClientPlatform = 'checking' | 'android' | 'ios' | 'web'

const GOOGLE_PLAY_BADGE =
  'https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png'
const APP_STORE_BADGE =
  'https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg'
const APPLE_MOBILE_RE = /iPad|iPhone|iPod/i

function isAppleMobileClient() {
  return (
    APPLE_MOBILE_RE.test(navigator.userAgent) ||
    (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  )
}

export function InvitationAppHandoff({
  weddingSlug,
  weddingTitle,
  deferredInstallEnabled,
  iosDistributionUrl,
}: {
  weddingSlug: string
  weddingTitle: string
  deferredInstallEnabled: boolean
  iosDistributionUrl: string | null
}) {
  const [platform, setPlatform] = useState<ClientPlatform>('checking')
  const continueInBrowser = buildInvitationContinuePath({ weddingSlug, source: 'browser' })
  const continueInApp = buildInvitationContinuePath({ weddingSlug, source: 'app' })
  const encodedSlug = encodeURIComponent(weddingSlug)
  const installPath = `/invite/${encodedSlug}/install`
  const openAppPath = `/invite/${encodedSlug}/app`

  useEffect(() => {
    const androidClient = /Android/i.test(navigator.userAgent)

    // An old installed PWA must not swallow Android guests back into the web shell. Native app
    // adoption stays primary on Android even when the browser is currently running standalone.
    if (window.matchMedia('(display-mode: standalone)').matches && !androidClient) {
      window.location.replace(continueInApp)
      return
    }

    if (androidClient) {
      setPlatform('android')
      return
    }
    if (isAppleMobileClient()) {
      setPlatform('ios')
      return
    }
    setPlatform('web')
  }, [continueInApp])

  if (platform === 'checking') {
    return (
      <main className="min-h-screen bg-[#17130f] px-4 py-8 text-[#f8f1e7]">
        <section className="mx-auto max-w-md rounded-[1.75rem] border border-[#b89155]/45 bg-[#211b16] p-6 text-center shadow-2xl">
          <p className="text-sm text-[#d6cec5]">Preparing your Wewed invitation…</p>
        </section>
      </main>
    )
  }

  if (platform === 'web') {
    return (
      <main className="min-h-screen bg-[#17130f] px-4 py-8 text-[#f8f1e7] sm:px-6 sm:py-10">
        <section className="mx-auto max-w-xl rounded-[2rem] border border-[#b89155]/45 bg-[#211b16] p-5 shadow-2xl sm:p-9">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.24em] text-[#c8a56b]">
            Wewed · Private invitation
          </p>
          <h1 className="mt-4 text-center font-serif text-3xl leading-tight sm:text-4xl">
            Your invitation is ready
          </h1>
          <p className="mx-auto mt-4 max-w-md text-center text-sm leading-6 text-[#d6cec5]">
            Open {weddingTitle} securely in your browser.
          </p>
          <a
            href={continueInBrowser}
            className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#c6a061] px-5 py-3.5 text-center font-semibold text-[#21170d]"
          >
            <ExternalLink className="size-5" /> Open wedding invitation
          </a>
        </section>
      </main>
    )
  }

  if (platform === 'ios') {
    return (
      <main
        data-testid="personal-invitation-ios-gate"
        className="min-h-screen bg-[#17130f] px-4 py-7 text-[#f8f1e7] sm:px-6 sm:py-10"
      >
        <section className="mx-auto max-w-md rounded-[1.75rem] border border-[#b89155]/45 bg-[#211b16] p-5 text-center shadow-2xl sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c8a56b]">
            Wewed · Private invitation
          </p>
          <h1 className="mt-3 font-serif text-3xl leading-tight">Your invitation is ready</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#d6cec5]">
            {iosDistributionUrl
              ? `Install Wewed for iPhone to access your Guest profile, RSVP, wedding updates and Wedding Pass for ${weddingTitle}.`
              : `Continue ${weddingTitle} securely in your browser. A direct App Store or TestFlight destination is not configured yet.`}
          </p>

          {iosDistributionUrl ? (
            <a
              data-testid="ios-install-wewed"
              href={iosDistributionUrl}
              className="mx-auto mt-5 inline-flex items-center justify-center rounded-lg bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d8b477]"
            >
              <img
                src={APP_STORE_BADGE}
                alt="Download on the App Store"
                width={196}
                height={66}
                className="h-12 w-auto max-w-full"
              />
            </a>
          ) : (
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#d8b477]">
              App Store link not configured
            </p>
          )}

          <button
            type="button"
            onClick={() => window.location.assign(continueInBrowser)}
            className="mt-3 min-h-12 w-full rounded-2xl bg-[#c6a061] px-5 py-3 font-semibold text-[#21170d]"
          >
            Continue in browser
          </button>
          <p className="mt-4 text-xs leading-5 text-[#9f958a]">
            {iosDistributionUrl
              ? 'After installation, return to this same invitation link if Wewed does not open automatically. You do not need a replacement invitation.'
              : 'Your private invitation remains with Wewed and browser continuation stays available.'}
          </p>
        </section>
      </main>
    )
  }

  return (
    <main
      data-testid="personal-invitation-android-gate"
      className="min-h-screen bg-[#17130f] px-4 py-7 text-[#f8f1e7] sm:px-6 sm:py-10"
    >
      <section className="mx-auto max-w-md rounded-[1.75rem] border border-[#b89155]/45 bg-[#211b16] p-5 text-center shadow-2xl sm:p-8">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-[#b89155]/45 bg-[#2a2119] text-[#d8b477]">
          <Smartphone className="size-6" aria-hidden="true" />
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-[#c8a56b]">
          Wewed · Private invitation
        </p>
        <h1 className="mt-3 font-serif text-3xl leading-tight">
          Open your invitation in Wewed
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#d6cec5]">
          Install Wewed from Google Play to access your Guest profile, RSVP, wedding updates and
          Wedding Pass. Your original invitation remains your secure way back in.
        </p>

        <div className="mt-6 space-y-3">
          <a
            data-testid="android-google-play-install"
            href={installPath}
            aria-label="Get Wewed on Google Play and continue my invitation"
            className="mx-auto inline-flex min-h-16 items-center justify-center rounded-lg bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d8b477]"
          >
            <img
              src={GOOGLE_PLAY_BADGE}
              alt="Get it on Google Play"
              width={646}
              height={192}
              className="h-16 w-auto max-w-full object-contain"
            />
          </a>

          {deferredInstallEnabled && (
            <a
              data-testid="android-open-existing-wewed"
              href={openAppPath}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#b89155]/55 px-5 py-3 font-semibold text-[#f8f1e7]"
            >
              <ExternalLink className="size-5" /> Already installed? Open Wewed
            </a>
          )}

          <a
            data-testid="android-continue-in-browser"
            href={continueInBrowser}
            className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-[#b89155]/35 px-5 py-3 text-sm font-semibold text-[#d6cec5]"
          >
            Continue in browser instead
          </a>
        </div>

        <div className="mt-5 rounded-2xl border border-[#b89155]/20 bg-[#1b1713] px-4 py-3 text-left text-xs leading-5 text-[#b9afa4]">
          <p>
            <strong className="text-[#e6d6bc]">You do not need a new invitation after installing.</strong>{' '}
            If setup is interrupted, return to the original WhatsApp or email invitation and tap the
            same Wewed link again.
          </p>
          <p className="mt-2">
            The personal invitation does not expire on a timer. It changes only if the couple or
            planner deliberately rotates or removes that Guest invitation.
          </p>
        </div>
      </section>
    </main>
  )
}
