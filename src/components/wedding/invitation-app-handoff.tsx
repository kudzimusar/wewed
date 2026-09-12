'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, ExternalLink, LoaderCircle, Smartphone } from 'lucide-react'
import {
  ANDROID_PACKAGE,
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
type PreparingAction = 'install' | 'open-app'
const INSTALL_PREPARATION_TIMEOUT_MS = 20_000

export function InvitationAppHandoff({
  weddingSlug,
  weddingTitle,
  deferredInstallEnabled,
}: {
  weddingSlug: string
  weddingTitle: string
  deferredInstallEnabled: boolean
}) {
  const [isAndroid, setIsAndroid] = useState<boolean | null>(null)
  const [installed, setInstalled] = useState(false)
  const [checking, setChecking] = useState(true)
  const [preparing, setPreparing] = useState<PreparingAction | null>(null)
  const [handoffError, setHandoffError] = useState<string | null>(null)
  const preparingRef = useRef(false)
  const continueInBrowser = buildInvitationContinuePath({ weddingSlug, source: 'browser' })
  const continueInApp = buildInvitationContinuePath({ weddingSlug, source: 'app' })

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      window.location.replace(continueInApp)
      return
    }

    const androidClient = /Android/i.test(navigator.userAgent)
    setIsAndroid(androidClient)
    if (!androidClient) {
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
  }, [continueInApp])

  function resetPreparation() {
    preparingRef.current = false
    setPreparing(null)
  }

  async function requestSecureHandoff(action: PreparingAction, source: string) {
    if (!deferredInstallEnabled || preparingRef.current) return null
    preparingRef.current = true
    setPreparing(action)
    setHandoffError(null)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), INSTALL_PREPARATION_TIMEOUT_MS)
    try {
      const response = await fetch('/api/invitations/install-handoff', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
        signal: controller.signal,
      })
      const data = (await response.json().catch(() => ({}))) as InstallHandoffResponse
      if (
        !response.ok ||
        typeof data.playStoreUrl !== 'string' ||
        !data.playStoreUrl.startsWith(`https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&referrer=`) ||
        typeof data.appResumePath !== 'string'
      ) {
        throw new Error(typeof data.message === 'string' ? data.message : 'handoff unavailable')
      }
      const resumeUrl = new URL(data.appResumePath, 'https://wewed.pro')
      const handoff = resumeUrl.searchParams.get('h') || ''
      if (
        resumeUrl.pathname !== '/invite/resume' ||
        !isValidInvitationHandoffSecret(handoff) ||
        resumeUrl.searchParams.has('rsvp')
      ) {
        throw new Error('invalid handoff response')
      }
      return { playStoreUrl: data.playStoreUrl, appResumePath: `${resumeUrl.pathname}${resumeUrl.search}` }
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'AbortError'
      setHandoffError(
        timedOut
          ? 'The connection took too long. Check your internet connection and try again.'
          : 'We could not securely prepare your invitation. Please try again.',
      )
      return null
    } finally {
      window.clearTimeout(timeout)
      resetPreparation()
    }
  }

  async function installAndKeepInvitation() {
    const handoff = await requestSecureHandoff('install', 'android-install-cta')
    if (handoff) window.location.assign(handoff.playStoreUrl)
  }

  async function openInstalledWewed() {
    const handoff = await requestSecureHandoff('open-app', 'android-installed-app')
    if (!handoff) return
    const target = handoff.appResumePath.replace(/^\//, '')
    const fallback = encodeURIComponent(window.location.href)
    window.location.assign(`intent://wewed.pro/${target}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`)
  }

  if (isAndroid === false && !checking) {
    return (
      <main className="min-h-screen bg-[#17130f] px-4 py-8 text-[#f8f1e7] sm:px-6 sm:py-10">
        <section className="mx-auto max-w-xl rounded-[2rem] border border-[#b89155]/45 bg-[#211b16] p-5 shadow-2xl sm:p-9">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.24em] text-[#c8a56b]">Wewed · Private invitation</p>
          <h1 className="mt-4 text-center font-serif text-4xl leading-tight sm:text-5xl">Your invitation is ready</h1>
          <p className="mx-auto mt-4 max-w-md text-center text-sm leading-6 text-[#d6cec5]">Open {weddingTitle} securely in your browser.</p>
          <a href={continueInBrowser} className="mt-8 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#c6a061] px-5 py-4 text-center font-semibold text-[#21170d]">
            <ExternalLink className="size-5" /> Open wedding invitation
          </a>
        </section>
      </main>
    )
  }

  return (
    <main data-testid="personal-invitation-android-gate" className="min-h-screen bg-[#17130f] px-4 py-8 text-[#f8f1e7] sm:px-6 sm:py-10">
      <section className="mx-auto max-w-xl rounded-[2rem] border border-[#b89155]/45 bg-[#211b16] p-5 shadow-2xl sm:p-9">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-[#b89155]/45 bg-[#2a2119] text-[#d8b477]">
          <Smartphone className="size-7" />
        </div>
        <p className="mt-7 text-center text-xs font-semibold uppercase tracking-[0.24em] text-[#c8a56b]">Wewed · Private invitation</p>
        <h1 className="mt-4 text-center font-serif text-4xl leading-tight sm:text-5xl">Your invitation is waiting in Wewed</h1>
        <p className="mx-auto mt-4 max-w-md text-center text-sm leading-6 text-[#d6cec5] sm:text-base">
          Open {weddingTitle} in Wewed to reveal your private invitation and RSVP. Your invitation identity is already recognised.
        </p>

        <div className="mt-8 space-y-3">
          {checking ? (
            <div className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#b89155]/45 text-[#d6cec5]">
              <LoaderCircle className="size-5 animate-spin" /> Checking Wewed…
            </div>
          ) : !deferredInstallEnabled ? (
            <p role="alert" className="rounded-2xl border border-[#c97866]/50 bg-[#3a201c] px-4 py-3 text-sm leading-6 text-[#f3d8d1]">
              Secure Android invitation resume is not enabled on this build. The invitation stays locked rather than falling back to the browser.
            </p>
          ) : installed ? (
            <button type="button" onClick={openInstalledWewed} disabled={preparing !== null} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#c6a061] px-5 py-4 font-semibold text-[#21170d] disabled:opacity-60">
              {preparing === 'open-app' ? <LoaderCircle className="size-5 animate-spin" /> : <ExternalLink className="size-5" />}
              {preparing === 'open-app' ? 'Opening Wewed…' : 'Open invitation in Wewed'}
            </button>
          ) : (
            <>
              <button type="button" onClick={installAndKeepInvitation} disabled={preparing !== null} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#c6a061] px-5 py-4 font-semibold text-[#21170d] disabled:opacity-60">
                {preparing === 'install' ? <LoaderCircle className="size-5 animate-spin" /> : <Download className="size-5" />}
                {preparing === 'install' ? 'Preparing your invitation…' : 'Install Wewed & reveal my invitation'}
              </button>
              <button type="button" onClick={openInstalledWewed} disabled={preparing !== null} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-[#b89155]/55 px-5 py-4 font-semibold text-[#f8f1e7] disabled:opacity-60">
                <ExternalLink className="size-5" /> Already installed? Open Wewed
              </button>
            </>
          )}
          {handoffError && <p role="alert" className="rounded-2xl border border-[#c97866]/50 bg-[#3a201c] px-4 py-3 text-sm leading-6 text-[#f3d8d1]">{handoffError}</p>}
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-[#9f958a]">
          On Android the invitation is revealed only inside Wewed. Google Play receives only a temporary one-time handoff, never the RSVP token or guest details.
        </p>
      </section>
    </main>
  )
}
