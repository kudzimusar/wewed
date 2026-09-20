'use client'

import { useEffect, useRef, useState } from 'react'
import { ExternalLink, LoaderCircle, Smartphone } from 'lucide-react'
import type { DigitalInvitationCardData } from '@/components/wedding/digital-invitation-card'
import { PhysicalInvitationClaim } from '@/components/wedding/physical-invitation-claim'
import type { InvitationCardStyle } from '@/lib/digital-invitation-card'
import {
  ANDROID_INTENT_PACKAGE,
  ANDROID_PACKAGE,
  isValidPhysicalInvitationHandoff,
} from '@/lib/invitation-links'

type RelatedApplication = { id?: string; platform?: string; url?: string }
type NavigatorWithRelatedApps = Navigator & {
  getInstalledRelatedApps?: () => Promise<RelatedApplication[]>
}
type HandoffResponse = {
  playStoreUrl?: unknown
  appResumePath?: unknown
  message?: unknown
}
type EntryMode = 'checking' | 'app' | 'android-web' | 'ios-web' | 'web'

const GOOGLE_PLAY_BADGE = 'https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png'
const APP_STORE_BADGE = 'https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg'
const APPLE_MOBILE_RE = /iPad|iPhone|iPod/i

function isAppleMobileClient() {
  return (
    APPLE_MOBILE_RE.test(navigator.userAgent) ||
    (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  )
}

export function PhysicalInvitationEntry({
  slug,
  weddingTitle,
  invitation,
  style,
  allowNameOnlyClaim = false,
  deferredInstallEnabled,
  insideWewed = false,
}: {
  slug: string
  weddingTitle: string
  invitation: DigitalInvitationCardData
  style: InvitationCardStyle
  allowNameOnlyClaim?: boolean
  deferredInstallEnabled: boolean
  insideWewed?: boolean
}) {
  const [mode, setMode] = useState<EntryMode>(insideWewed ? 'app' : 'checking')
  const [installed, setInstalled] = useState(false)
  const [preparing, setPreparing] = useState<'install' | 'open' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const preparingRef = useRef(false)

  useEffect(() => {
    if (insideWewed) {
      setMode('app')
      return
    }
    if (/Android/i.test(navigator.userAgent)) {
      setMode('android-web')
    } else if (isAppleMobileClient()) {
      setMode('ios-web')
      return
    } else {
      setMode('web')
      return
    }

    const nav = navigator as NavigatorWithRelatedApps
    const fn = nav.getInstalledRelatedApps
    if (typeof fn !== 'function') return
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
    return () => { cancelled = true }
  }, [insideWewed])

  async function prepare(action: 'install' | 'open') {
    if (!deferredInstallEnabled || preparingRef.current) return null
    preparingRef.current = true
    setPreparing(action)
    setError(null)
    try {
      const response = await fetch('/api/invitations/physical-install-handoff', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: action }),
      })
      const data = (await response.json().catch(() => ({}))) as HandoffResponse
      if (
        !response.ok ||
        typeof data.playStoreUrl !== 'string' ||
        typeof data.appResumePath !== 'string'
      ) {
        throw new Error(typeof data.message === 'string' ? data.message : 'handoff unavailable')
      }
      const resume = new URL(data.appResumePath, window.location.origin)
      const token = resume.searchParams.get('h') || ''
      if (
        resume.pathname !== '/invite/physical-resume' ||
        !isValidPhysicalInvitationHandoff(token) ||
        resume.searchParams.has('rsvp')
      ) {
        throw new Error('invalid handoff')
      }
      if (
        !data.playStoreUrl.startsWith(
          `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&referrer=`,
        )
      ) {
        throw new Error('invalid Play handoff')
      }
      return {
        playStoreUrl: data.playStoreUrl,
        appResumePath: `${resume.pathname}${resume.search}`,
      }
    } catch {
      setError('We could not securely prepare this invitation. Please try again.')
      return null
    } finally {
      preparingRef.current = false
      setPreparing(null)
    }
  }

  async function downloadFromGooglePlay() {
    const handoff = await prepare('install')
    if (handoff) window.location.assign(handoff.playStoreUrl)
  }

  async function openApp() {
    const handoff = await prepare('open')
    if (!handoff) return
    const target = handoff.appResumePath.replace(/^\//, '')
    const fallback = encodeURIComponent(window.location.href)
    window.location.assign(
      `intent://wewed.pro/${target}#Intent;scheme=https;package=${ANDROID_INTENT_PACKAGE};S.browser_fallback_url=${fallback};end`,
    )
  }

  if (mode === 'app' || mode === 'web') {
    return (
      <PhysicalInvitationClaim
        slug={slug}
        invitation={invitation}
        style={style}
        allowNameOnlyClaim={allowNameOnlyClaim}
      />
    )
  }

  if (mode === 'ios-web') {
    return (
      <main
        data-testid="physical-invitation-ios-gate"
        className="min-h-screen bg-[#17130f] px-4 py-7 text-[#f8f1e7] sm:px-6 sm:py-10"
      >
        <section className="mx-auto max-w-md rounded-[1.75rem] border border-[#b89155]/45 bg-[#211b16] p-5 text-center shadow-2xl sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c8a56b]">Wewed · Printed invitation</p>
          <h1 className="mt-3 font-serif text-3xl leading-tight">Your invitation is ready</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#d6cec5]">
            Wewed for iPhone is coming soon. For now, continue {weddingTitle} securely in your browser.
          </p>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-[#d8b477]">Coming Soon</p>
          <button
            type="button"
            onClick={() => setMode('web')}
            aria-label="App Store coming soon — continue invitation in browser"
            className="mx-auto mt-2 inline-flex items-center justify-center rounded-lg bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d8b477]"
          >
            <img src={APP_STORE_BADGE} alt="Download on the App Store" width={196} height={66} className="h-12 w-auto max-w-full" />
          </button>
          <button
            type="button"
            onClick={() => setMode('web')}
            className="mt-3 min-h-12 w-full rounded-2xl bg-[#c6a061] px-5 py-3 font-semibold text-[#21170d]"
          >
            Continue in browser
          </button>
          <p className="mt-4 text-xs leading-5 text-[#9f958a]">
            Wewed keeps the printed invitation connected to this wedding while you continue in the browser.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main
      data-testid="physical-invitation-android-gate"
      className="min-h-screen bg-[#17130f] px-4 py-7 text-[#f8f1e7] sm:px-6 sm:py-10"
    >
      <section className="mx-auto max-w-md rounded-[1.75rem] border border-[#b89155]/45 bg-[#211b16] p-5 text-center shadow-2xl sm:p-8">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-[#b89155]/45 bg-[#2a2119] text-[#d8b477]">
          <Smartphone className="size-6" aria-hidden="true" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-[#c8a56b]">
          Wewed · Printed invitation
        </p>
        <h1 className="mt-3 font-serif text-3xl leading-tight">
          Your invitation is waiting in Wewed
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#d6cec5]">
          Download Wewed from Google Play to reveal {weddingTitle}, RSVP securely and continue to the couple&apos;s wedding site.
        </p>

        <div className="mt-6 space-y-3">
          {mode === 'checking' ? (
            <div className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#b89155]/45 text-[#d6cec5]">
              <LoaderCircle className="size-5 animate-spin" /> Checking Wewed…
            </div>
          ) : installed ? (
            <button
              type="button"
              onClick={openApp}
              disabled={preparing !== null || !deferredInstallEnabled}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#c6a061] px-5 py-4 font-semibold text-[#21170d] disabled:opacity-60"
            >
              {preparing === 'open' ? <LoaderCircle className="size-5 animate-spin" /> : <ExternalLink className="size-5" />}
              {preparing === 'open' ? 'Opening Wewed…' : 'Open invitation in Wewed'}
            </button>
          ) : (
            <button
              type="button"
              onClick={downloadFromGooglePlay}
              disabled={preparing !== null || !deferredInstallEnabled}
              aria-label="Get Wewed on Google Play and reveal my invitation"
              className="mx-auto inline-flex min-h-16 items-center justify-center rounded-lg bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d8b477]"
            >
              {preparing === 'install' ? (
                <span className="flex items-center gap-2 px-3 text-sm font-semibold"><LoaderCircle className="size-5 animate-spin" /> Preparing your invitation…</span>
              ) : (
                <img src={GOOGLE_PLAY_BADGE} alt="Get it on Google Play" width={646} height={192} className="h-16 w-auto max-w-full object-contain" />
              )}
            </button>
          )}

          {!installed && mode === 'android-web' && deferredInstallEnabled && (
            <button
              type="button"
              onClick={openApp}
              disabled={preparing !== null}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#b89155]/55 px-5 py-3 font-semibold text-[#f8f1e7] disabled:opacity-60"
            >
              <ExternalLink className="size-5" /> Already downloaded? Open Wewed
            </button>
          )}

          {!deferredInstallEnabled && mode === 'android-web' && (
            <p role="alert" className="rounded-2xl border border-[#c97866]/50 bg-[#3a201c] px-4 py-3 text-sm leading-6 text-[#f3d8d1]">
              Secure Android invitation handoff is not available yet. Your private invitation remains locked until the production Wewed release is available.
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-2xl border border-[#c97866]/50 bg-[#3a201c] px-4 py-3 text-sm leading-6 text-[#f3d8d1]">
              {error}
            </p>
          )}
        </div>

        <p className="mt-5 text-center text-xs leading-5 text-[#9f958a]">
          The floral invitation is revealed only after Wewed opens. Google Play receives only a short-lived encrypted handoff; no guest name or RSVP token is placed in the download referrer.
        </p>
      </section>
    </main>
  )
}
