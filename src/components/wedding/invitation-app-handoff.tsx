'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, ExternalLink, LoaderCircle, Smartphone } from 'lucide-react'
import {
  ANDROID_PACKAGE,
  buildInvitationContinuePath,
  PLAY_STORE_URL,
} from '@/lib/invitation-links'

type RelatedApplication = {
  id?: string
  platform?: string
  url?: string
}

type NavigatorWithRelatedApps = Navigator & {
  getInstalledRelatedApps?: () => Promise<RelatedApplication[]>
}

type InstallHandoffResponse = {
  playStoreUrl?: unknown
  expiresAt?: unknown
  message?: unknown
}

const INSTALL_PREPARATION_TIMEOUT_MS = 20_000

export function InvitationAppHandoff({
  weddingSlug,
  weddingTitle,
}: {
  weddingSlug: string
  weddingTitle: string
}) {
  const [isAndroid, setIsAndroid] = useState<boolean | null>(null)
  const [installed, setInstalled] = useState(false)
  const [checking, setChecking] = useState(true)
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)
  const installingRef = useRef(false)

  const continueInBrowser = useMemo(
    () => buildInvitationContinuePath({ weddingSlug, source: 'browser' }),
    [weddingSlug],
  )
  const continueInApp = useMemo(
    () => buildInvitationContinuePath({ weddingSlug, source: 'app' }),
    [weddingSlug],
  )
  const androidIntent = useMemo(() => {
    const path = continueInApp.replace(/^\//, '')
    const fallback = encodeURIComponent(PLAY_STORE_URL)
    return `intent://wewed.pro/${path}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`
  }, [continueInApp])

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    if (standalone) {
      window.location.replace(continueInApp)
      return
    }

    const androidClient = /Android/i.test(navigator.userAgent)
    setIsAndroid(androidClient)
    if (!androidClient) {
      setChecking(false)
      return
    }

    const navigatorWithApps = navigator as NavigatorWithRelatedApps
    const getInstalledRelatedApps = navigatorWithApps.getInstalledRelatedApps
    if (typeof getInstalledRelatedApps !== 'function') {
      setChecking(false)
      return
    }

    let cancelled = false
    void getInstalledRelatedApps
      .call(navigatorWithApps)
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

    return () => {
      cancelled = true
    }
  }, [continueInApp])

  async function installAndKeepInvitation() {
    if (installingRef.current) return
    installingRef.current = true
    setInstalling(true)
    setInstallError(null)

    const controller = new AbortController()
    const timeout = window.setTimeout(
      () => controller.abort(),
      INSTALL_PREPARATION_TIMEOUT_MS,
    )

    try {
      const response = await fetch('/api/invitations/install-handoff', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'android-install-cta' }),
        signal: controller.signal,
      })
      const data = (await response.json().catch(() => ({}))) as InstallHandoffResponse

      if (
        !response.ok ||
        typeof data.playStoreUrl !== 'string' ||
        !data.playStoreUrl.startsWith(
          'https://play.google.com/store/apps/details?id=pro.wewed.app&referrer=',
        )
      ) {
        throw new Error(
          typeof data.message === 'string' ? data.message : 'handoff unavailable',
        )
      }

      // A top-level navigation is deliberate here. It lets WhatsApp/Facebook hand the
      // guest to Google Play while the opaque Wewed handoff crosses the install boundary.
      window.location.assign(data.playStoreUrl)
    } catch (error) {
      const timedOut =
        error instanceof DOMException && error.name === 'AbortError'
      setInstallError(
        timedOut
          ? 'The connection took too long. Check your internet connection and try again.'
          : 'We could not securely prepare your invitation for installation. Try again, or open the invitation in your browser.',
      )
      installingRef.current = false
      setInstalling(false)
    } finally {
      window.clearTimeout(timeout)
    }
  }

  const browserButton = (
    <a
      href={continueInBrowser}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#c6a061] px-5 py-4 text-center font-semibold text-[#21170d] transition hover:bg-[#d5b477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f8f1e7]"
    >
      <ExternalLink className="size-5 shrink-0" aria-hidden="true" />
      Open wedding invitation
    </a>
  )

  return (
    <main className="min-h-screen bg-[#17130f] px-4 py-8 text-[#f8f1e7] sm:px-6 sm:py-10">
      <section className="mx-auto max-w-xl rounded-[2rem] border border-[#b89155]/45 bg-[#211b16] p-5 shadow-2xl sm:p-9">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-[#b89155]/45 bg-[#2a2119] text-[#d8b477]">
          <Smartphone className="size-7" aria-hidden="true" />
        </div>

        <p className="mt-7 text-center text-xs font-semibold uppercase tracking-[0.24em] text-[#c8a56b]">
          Wewed · Private invitation
        </p>
        <h1 className="mt-4 text-center font-serif text-4xl leading-tight sm:text-5xl">
          Your invitation is ready
        </h1>
        <p className="mx-auto mt-4 max-w-md text-center text-sm leading-6 text-[#d6cec5] sm:text-base">
          Open {weddingTitle} in Wewed. Your private invitation has already been
          recognised, so you will not need to paste a code again.
        </p>

        <div className="mt-8 space-y-3">
          {isAndroid === true ? (
            <>
              {installed ? (
                <a
                  href={androidIntent}
                  className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#c6a061] px-5 py-4 text-center font-semibold text-[#21170d] transition hover:bg-[#d5b477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f8f1e7]"
                >
                  <ExternalLink className="size-5 shrink-0" aria-hidden="true" />
                  Open invitation in Wewed
                </a>
              ) : (
                <button
                  type="button"
                  onClick={installAndKeepInvitation}
                  disabled={installing}
                  aria-busy={installing}
                  className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#c6a061] px-5 py-4 text-center font-semibold text-[#21170d] transition hover:bg-[#d5b477] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f8f1e7] disabled:cursor-wait disabled:opacity-70"
                >
                  {installing ? (
                    <LoaderCircle className="size-5 shrink-0 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="size-5 shrink-0" aria-hidden="true" />
                  )}
                  {installing
                    ? 'Preparing your invitation…'
                    : 'Install Wewed & open my invitation'}
                </button>
              )}

              {!installed && (
                <a
                  href={androidIntent}
                  className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-[#b89155]/55 px-5 py-4 text-center font-semibold text-[#f8f1e7] transition hover:bg-[#2b231c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f8f1e7]"
                >
                  <ExternalLink className="size-5 shrink-0" aria-hidden="true" />
                  Already installed? Open Wewed
                </a>
              )}

              {installError && (
                <div
                  role="alert"
                  className="rounded-2xl border border-[#c97866]/50 bg-[#3a201c] px-4 py-3 text-sm leading-6 text-[#f3d8d1]"
                >
                  {installError}
                </div>
              )}

              <a
                href={continueInBrowser}
                className="block min-h-12 w-full rounded-2xl px-5 py-3 text-center text-sm text-[#d6cec5] underline decoration-[#b89155]/60 underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f8f1e7]"
              >
                Continue to invitation in browser
              </a>
            </>
          ) : (
            browserButton
          )}
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-[#9f958a]" aria-live="polite">
          {checking
            ? 'Checking the safest way to open your invitation…'
            : isAndroid
              ? installed
                ? 'Wewed is already installed. Open it above to continue directly to this invitation.'
                : 'Your private RSVP details stay with Wewed. Google Play receives only a temporary one-time handoff so the installed app can resume this exact invitation.'
              : 'You can open the complete invitation securely in your browser. Wewed app installation is offered on supported Android devices.'}
        </p>
      </section>
    </main>
  )
}
