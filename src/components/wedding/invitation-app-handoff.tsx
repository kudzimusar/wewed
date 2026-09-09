'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, ExternalLink, Smartphone } from 'lucide-react'
import { buildInvitationContinuePath } from '@/lib/invitation-links'

const ANDROID_PACKAGE = 'pro.wewed.app'
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`

type RelatedApplication = {
  id?: string
  platform?: string
  url?: string
}

type NavigatorWithRelatedApps = Navigator & {
  getInstalledRelatedApps?: () => Promise<RelatedApplication[]>
}

export function InvitationAppHandoff({
  weddingSlug,
  weddingTitle,
}: {
  weddingSlug: string
  weddingTitle: string
}) {
  const [installed, setInstalled] = useState(false)
  const [checking, setChecking] = useState(true)

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

  return (
    <main className="min-h-screen bg-[#17130f] px-4 py-10 text-[#f8f1e7] sm:px-6">
      <section className="mx-auto max-w-xl rounded-[2rem] border border-[#b89155]/45 bg-[#211b16] p-6 shadow-2xl sm:p-9">
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
          {installed ? (
            <a
              href={androidIntent}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#c6a061] px-5 py-4 font-semibold text-[#21170d] transition hover:bg-[#d5b477]"
            >
              <ExternalLink className="size-5" aria-hidden="true" />
              Open invitation in Wewed
            </a>
          ) : (
            <a
              href={PLAY_STORE_URL}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#c6a061] px-5 py-4 font-semibold text-[#21170d] transition hover:bg-[#d5b477]"
            >
              <Download className="size-5" aria-hidden="true" />
              Install Wewed & keep my invitation
            </a>
          )}

          {!installed && (
            <a
              href={androidIntent}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#b89155]/55 px-5 py-4 font-semibold text-[#f8f1e7] transition hover:bg-[#2b231c]"
            >
              <ExternalLink className="size-5" aria-hidden="true" />
              Already installed? Open Wewed
            </a>
          )}

          <a
            href={continueInBrowser}
            className="block w-full rounded-2xl px-5 py-3 text-center text-sm text-[#d6cec5] underline decoration-[#b89155]/60 underline-offset-4 hover:text-white"
          >
            Continue to invitation in browser
          </a>
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-[#9f958a]">
          {checking
            ? 'Checking whether Wewed is already installed…'
            : 'If you install Wewed, launch it from Google Play or tap this invitation link again. Wewed will resume this invitation when browser storage is shared with the app.'}
        </p>
      </section>
    </main>
  )
}
