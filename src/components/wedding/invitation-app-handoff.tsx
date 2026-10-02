'use client'

import { useEffect, useRef, useState } from 'react'
import { ExternalLink, LoaderCircle, Smartphone } from 'lucide-react'
import {
  ANDROID_PACKAGE,
  PLAY_STORE_URL,
  buildAndroidInvitationIntentUrl,
  buildInvitationContinuePath,
  isValidInvitationHandoffSecret,
} from '@/lib/invitation-links'

type RelatedApplication = { id?: string; platform?: string; url?: string }
type NavigatorWithRelatedApps = Navigator & {
  getInstalledRelatedApps?: () => Promise<RelatedApplication[]>
}
type InstallHandoffResponse = {
  playStoreUrl?: unknown
  appResumePath?: unknown
  expiresAt?: unknown
  message?: unknown
}
type PreparedHandoff = {
  playStoreUrl: string
  appResumePath: string
  androidIntentUrl: string
  expiresAt: string | null
}
type ClientPlatform = 'checking' | 'android' | 'ios' | 'web'

const INSTALL_PREPARATION_TIMEOUT_MS = 20_000
const GOOGLE_PLAY_BADGE = 'https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png'
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
}: {
  weddingSlug: string
  weddingTitle: string
  deferredInstallEnabled: boolean
}) {
  const [platform, setPlatform] = useState<ClientPlatform>('checking')
  const [installed, setInstalled] = useState(false)
  const [checking, setChecking] = useState(true)
  const [preparing, setPreparing] = useState(false)
  const [preparedHandoff, setPreparedHandoff] = useState<PreparedHandoff | null>(null)
  const [handoffError, setHandoffError] = useState<string | null>(null)
  const preparationInFlightRef = useRef(false)
  const continueInBrowser = buildInvitationContinuePath({ weddingSlug, source: 'browser' })
  const continueInApp = buildInvitationContinuePath({ weddingSlug, source: 'app' })

  useEffect(() => {
    const androidClient = /Android/i.test(navigator.userAgent)

    // A standalone PWA must not swallow an Android personal invitation before the native-app
    // adoption gate has a chance to run. On Android, Verified App Links/native Play remain the
    // preferred journey; non-Android standalone clients may continue inside their installed web app.
    if (window.matchMedia('(display-mode: standalone)').matches && !androidClient) {
      window.location.replace(continueInApp)
      return
    }

    if (androidClient) {
      // If Android reaches the web at all, Wewed should still make installation the primary
      // journey. Verified App Links will normally intercept the personal invitation when the
      // Play app is already installed. If secure deferred continuity has been emergency-disabled,
      // keep Google Play primary and browser continuation secondary instead of silently pushing
      // the guest into the PWA.
      setPlatform('android')
    } else if (isAppleMobileClient()) {
      setPlatform('ios')
      setChecking(false)
      return
    } else {
      setPlatform('web')
      setChecking(false)
      return
    }

    const nav = navigator as NavigatorWithRelatedApps
    const fn = nav.getInstalledRelatedApps
    if (typeof fn !== 'function') {
      setChecking(false)
      return
    }

    let cancelled = false
    void fn.call(nav)
      .then((apps) => {
        if (cancelled) return
        setInstalled(
          apps.some(
            (app) =>
              app.platform === 'play' &&
              (app.id === ANDROID_PACKAGE || app.url?.includes(ANDROID_PACKAGE)),
          ),
        )
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => { cancelled = true }
  }, [continueInApp, continueInBrowser, deferredInstallEnabled])

  async function prepareSecureHandoff(): Promise<PreparedHandoff | null> {
    if (!deferredInstallEnabled || platform !== 'android') {
      return null
    }
    if (preparedHandoff) return preparedHandoff
    if (preparationInFlightRef.current) return null

    preparationInFlightRef.current = true
    setPreparing(true)
    setHandoffError(null)

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), INSTALL_PREPARATION_TIMEOUT_MS)

    try {
      const response = await fetch('/api/invitations/install-handoff', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'android-prepared-entry' }),
        signal: controller.signal,
      })
      const data = (await response.json().catch(() => ({}))) as InstallHandoffResponse
      if (
        !response.ok ||
        typeof data.playStoreUrl !== 'string' ||
        !data.playStoreUrl.startsWith(
          `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&referrer=`,
        ) ||
        typeof data.appResumePath !== 'string'
      ) {
        throw new Error(
          typeof data.message === 'string' ? data.message : 'handoff unavailable',
        )
      }

      const resumeUrl = new URL(data.appResumePath, window.location.origin)
      const handoff = resumeUrl.searchParams.get('h') || ''
      if (
        resumeUrl.origin !== window.location.origin ||
        resumeUrl.pathname !== '/invite/resume' ||
        !isValidInvitationHandoffSecret(handoff) ||
        resumeUrl.searchParams.has('rsvp')
      ) {
        throw new Error('invalid handoff response')
      }

      const appResumePath = `${resumeUrl.pathname}${resumeUrl.search}`
      const prepared: PreparedHandoff = {
        playStoreUrl: data.playStoreUrl,
        appResumePath,
        androidIntentUrl: buildAndroidInvitationIntentUrl({
          origin: window.location.origin,
          appResumePath,
          fallbackUrl: window.location.href,
        }),
        expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : null,
      }
      setPreparedHandoff(prepared)
      return prepared
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'AbortError'
      setHandoffError(
        timedOut
          ? 'The connection took too long. Check your internet connection and try again.'
          : 'We could not securely prepare your invitation. You can still install Wewed from Google Play and reopen this same invitation link.',
      )
      return null
    } finally {
      window.clearTimeout(timeout)
      preparationInFlightRef.current = false
      setPreparing(false)
    }
  }

  async function startAndroidPlayInstall() {
    setHandoffError(null)
    const prepared = await prepareSecureHandoff()
    if (!prepared) return
    window.location.assign(prepared.playStoreUrl)
  }

  useEffect(() => {
    // For an already-installed app, prepare the opaque handoff only after Android confirms the
    // Play app is present. The final intent remains a literal href so the external-app launch
    // happens from a genuine user gesture in Chrome/WhatsApp rather than after an async fetch.
    if (
      platform !== 'android' ||
      !deferredInstallEnabled ||
      !installed ||
      preparedHandoff ||
      handoffError ||
      preparationInFlightRef.current
    ) {
      return
    }
    void prepareSecureHandoff()
    // prepareSecureHandoff is intentionally gated by the stable state above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, deferredInstallEnabled, installed, preparedHandoff, handoffError])

  if (platform === 'web' && !checking) {
    return (
      <main className="min-h-screen bg-[#17130f] px-4 py-8 text-[#f8f1e7] sm:px-6 sm:py-10">
        <section className="mx-auto max-w-xl rounded-[2rem] border border-[#b89155]/45 bg-[#211b16] p-5 shadow-2xl sm:p-9">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.24em] text-[#c8a56b]">Wewed · Private invitation</p>
          <h1 className="mt-4 text-center font-serif text-3xl leading-tight sm:text-4xl">Your invitation is ready</h1>
          <p className="mx-auto mt-4 max-w-md text-center text-sm leading-6 text-[#d6cec5]">Open {weddingTitle} securely in your browser.</p>
          <a href={continueInBrowser} className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#c6a061] px-5 py-3.5 text-center font-semibold text-[#21170d]">
            <ExternalLink className="size-5" /> Open wedding invitation
          </a>
        </section>
      </main>
    )
  }

  if (platform === 'ios' && !checking) {
    return (
      <main data-testid="personal-invitation-ios-gate" className="min-h-screen bg-[#17130f] px-4 py-7 text-[#f8f1e7] sm:px-6 sm:py-10">
        <section className="mx-auto max-w-md rounded-[1.75rem] border border-[#b89155]/45 bg-[#211b16] p-5 text-center shadow-2xl sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c8a56b]">Wewed · Private invitation</p>
          <h1 className="mt-3 font-serif text-3xl leading-tight">Your invitation is ready</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#d6cec5]">
            Continue {weddingTitle} securely in your browser. A direct App Store handoff is not configured for this invitation yet.
          </p>
          <button
            type="button"
            onClick={() => window.location.assign(continueInBrowser)}
            className="mt-3 min-h-12 w-full rounded-2xl bg-[#c6a061] px-5 py-3 font-semibold text-[#21170d]"
          >
            Continue in browser
          </button>
          <p className="mt-4 text-xs leading-5 text-[#9f958a]">
            Your private invitation remains with Wewed. Browser continuation stays available until an authoritative App Store destination is configured.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main data-testid="personal-invitation-android-gate" className="min-h-screen bg-[#17130f] px-4 py-7 text-[#f8f1e7] sm:px-6 sm:py-10">
      <section className="mx-auto max-w-md rounded-[1.75rem] border border-[#b89155]/45 bg-[#211b16] p-5 text-center shadow-2xl sm:p-8">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-[#b89155]/45 bg-[#2a2119] text-[#d8b477]">
          <Smartphone className="size-6" aria-hidden="true" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-[#c8a56b]">Wewed · Private invitation</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight">Your invitation is waiting in Wewed</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#d6cec5]">
          Download Wewed from Google Play to reveal {weddingTitle} and RSVP. Your invitation identity is already recognised.
        </p>

        <div className="mt-6 space-y-3">
          {!deferredInstallEnabled ? (
            <>
              <a
                data-testid="android-google-play-install-fallback"
                href={PLAY_STORE_URL}
                aria-label="Get Wewed on Google Play"
                className="mx-auto inline-flex min-h-16 items-center justify-center rounded-lg bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d8b477]"
              >
                <img src={GOOGLE_PLAY_BADGE} alt="Get it on Google Play" width={646} height={192} className="h-16 w-auto max-w-full object-contain" />
              </a>
              <p className="rounded-2xl border border-[#b89155]/25 bg-[#2a2119] px-4 py-3 text-xs leading-5 text-[#cfc4b7]">
                Install Wewed, then reopen this same personal invitation link. You do not need a new link from the Planner.
              </p>
            </>
          ) : checking ? (
            <div
              data-testid="android-install-checking"
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#b89155]/45 text-[#d6cec5]"
            >
              <LoaderCircle className="size-5 animate-spin" /> Checking Wewed…
            </div>
          ) : installed ? (
            preparedHandoff ? (
              <a
                data-testid="android-open-installed-wewed"
                href={preparedHandoff.androidIntentUrl}
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#c6a061] px-5 py-4 font-semibold text-[#21170d]"
              >
                <ExternalLink className="size-5" /> Open invitation in Wewed
              </a>
            ) : (
              <div
                data-testid="android-installed-handoff-preparing"
                className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#b89155]/45 text-[#d6cec5]"
              >
                <LoaderCircle className="size-5 animate-spin" /> Preparing invitation…
              </div>
            )
          ) : (
            <button
              type="button"
              data-testid="android-google-play-install"
              disabled={preparing}
              onClick={() => { void startAndroidPlayInstall() }}
              aria-label="Get Wewed on Google Play and reveal my invitation"
              className="mx-auto inline-flex min-h-16 items-center justify-center rounded-lg bg-transparent p-0 disabled:cursor-wait disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d8b477]"
            >
              {preparing ? (
                <span className="flex min-h-16 items-center gap-2 rounded-2xl border border-[#b89155]/45 px-5 text-[#d6cec5]">
                  <LoaderCircle className="size-5 animate-spin" /> Preparing Google Play…
                </span>
              ) : (
                <img src={GOOGLE_PLAY_BADGE} alt="Get it on Google Play" width={646} height={192} className="h-16 w-auto max-w-full object-contain" />
              )}
            </button>
          )}

          {handoffError && (
            <>
              <p role="alert" className="rounded-2xl border border-[#c97866]/50 bg-[#3a201c] px-4 py-3 text-sm leading-6 text-[#f3d8d1]">
                {handoffError}
              </p>
              <button
                type="button"
                onClick={() => {
                  setHandoffError(null)
                  if (installed) void prepareSecureHandoff()
                  else void startAndroidPlayInstall()
                }}
                className="min-h-12 w-full rounded-2xl border border-[#b89155]/55 px-5 py-3 font-semibold text-[#f8f1e7]"
              >
                Retry secure preparation
              </button>
              {!installed && (
                <a
                  data-testid="android-google-play-install-direct-recovery"
                  href={PLAY_STORE_URL}
                  className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-[#b89155]/35 px-5 py-3 text-sm font-semibold text-[#d6cec5]"
                >
                  Install from Google Play without automatic return
                </a>
              )}
            </>
          )}

          <a
            data-testid="android-continue-in-browser"
            href={continueInBrowser}
            className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-[#b89155]/35 px-5 py-3 text-sm font-semibold text-[#d6cec5]"
          >
            Continue in browser instead
          </a>
        </div>

        <p className="mt-5 text-center text-xs leading-5 text-[#9f958a]">
          Wewed is preferred on Android. Your personal invitation link remains reusable unless the Planner explicitly rotates it. When secure handoff is available, Google Play receives only a temporary opaque handoff — never the RSVP token or guest details — and browser continuation remains secondary.
        </p>
      </section>
    </main>
  )
}
