'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, ExternalLink, LoaderCircle, Smartphone } from 'lucide-react'
import type { DigitalInvitationCardData } from '@/components/wedding/digital-invitation-card'
import { PhysicalInvitationClaim } from '@/components/wedding/physical-invitation-claim'
import type { InvitationCardStyle } from '@/lib/digital-invitation-card'
import { ANDROID_PACKAGE, isValidInvitationHandoffSecret } from '@/lib/invitation-links'

type RelatedApplication = { id?: string; platform?: string; url?: string }
type NavigatorWithRelatedApps = Navigator & {
  getInstalledRelatedApps?: () => Promise<RelatedApplication[]>
}
type HandoffResponse = { playStoreUrl?: unknown; appResumePath?: unknown; message?: unknown }

export function PhysicalInvitationEntry({
  slug,
  weddingTitle,
  invitation,
  style,
  allowNameOnlyClaim = false,
  deferredInstallEnabled,
}: {
  slug: string
  weddingTitle: string
  invitation: DigitalInvitationCardData
  style: InvitationCardStyle
  allowNameOnlyClaim?: boolean
  deferredInstallEnabled: boolean
}) {
  const [mode, setMode] = useState<'checking' | 'app' | 'android-web' | 'web'>('checking')
  const [installed, setInstalled] = useState(false)
  const [preparing, setPreparing] = useState<'install' | 'open' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const preparingRef = useRef(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setMode('app')
      return
    }
    if (!/Android/i.test(navigator.userAgent)) {
      setMode('web')
      return
    }

    setMode('android-web')
    const nav = navigator as NavigatorWithRelatedApps
    const fn = nav.getInstalledRelatedApps
    if (typeof fn !== 'function') return
    let cancelled = false
    void fn.call(nav).then((apps) => {
      if (cancelled) return
      setInstalled(apps.some((app) => app.platform === 'play' && (app.id === ANDROID_PACKAGE || app.url?.includes(ANDROID_PACKAGE))))
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])

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
        body: JSON.stringify({ source: action === 'install' ? 'physical-android-install' : 'physical-android-open' }),
      })
      const data = (await response.json().catch(() => ({}))) as HandoffResponse
      if (!response.ok || typeof data.playStoreUrl !== 'string' || typeof data.appResumePath !== 'string') {
        throw new Error(typeof data.message === 'string' ? data.message : 'handoff unavailable')
      }
      const resume = new URL(data.appResumePath, window.location.origin)
      const secret = resume.searchParams.get('h') || ''
      if (resume.pathname !== '/invite/physical-resume' || !isValidInvitationHandoffSecret(secret) || resume.searchParams.has('rsvp')) {
        throw new Error('invalid handoff')
      }
      if (!data.playStoreUrl.startsWith(`https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&referrer=`)) {
        throw new Error('invalid Play handoff')
      }
      return { playStoreUrl: data.playStoreUrl, appResumePath: `${resume.pathname}${resume.search}` }
    } catch {
      setError('We could not securely prepare this invitation. Please try again.')
      return null
    } finally {
      preparingRef.current = false
      setPreparing(null)
    }
  }

  async function install() {
    const handoff = await prepare('install')
    if (handoff) window.location.assign(handoff.playStoreUrl)
  }

  async function openApp() {
    const handoff = await prepare('open')
    if (!handoff) return
    const target = handoff.appResumePath.replace(/^\//, '')
    const fallback = encodeURIComponent(window.location.href)
    window.location.assign(`intent://wewed.pro/${target}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`)
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

  return (
    <main data-testid="physical-invitation-android-gate" className="min-h-screen bg-[#17130f] px-4 py-8 text-[#f8f1e7] sm:px-6 sm:py-10">
      <section className="mx-auto max-w-xl rounded-[2rem] border border-[#b89155]/45 bg-[#211b16] p-5 shadow-2xl sm:p-9">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-[#b89155]/45 bg-[#2a2119] text-[#d8b477]">
          <Smartphone className="size-7" aria-hidden="true" />
        </div>
        <p className="mt-7 text-center text-xs font-semibold uppercase tracking-[0.24em] text-[#c8a56b]">Wewed · Printed invitation</p>
        <h1 className="mt-4 text-center font-serif text-4xl leading-tight sm:text-5xl">Your invitation is waiting in Wewed</h1>
        <p className="mx-auto mt-4 max-w-md text-center text-sm leading-6 text-[#d6cec5] sm:text-base">
          Open {weddingTitle} in Wewed to reveal the digital invitation, RSVP securely and continue to the couple's wedding site.
        </p>

        <div className="mt-8 space-y-3">
          {mode === 'checking' ? (
            <div className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#b89155]/45 text-[#d6cec5]">
              <LoaderCircle className="size-5 animate-spin" /> Checking Wewed…
            </div>
          ) : installed ? (
            <button type="button" onClick={openApp} disabled={preparing !== null || !deferredInstallEnabled} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#c6a061] px-5 py-4 font-semibold text-[#21170d] disabled:opacity-60">
              {preparing === 'open' ? <LoaderCircle className="size-5 animate-spin" /> : <ExternalLink className="size-5" />}
              {preparing === 'open' ? 'Opening Wewed…' : 'Open invitation in Wewed'}
            </button>
          ) : (
            <button type="button" onClick={install} disabled={preparing !== null || !deferredInstallEnabled} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#c6a061] px-5 py-4 font-semibold text-[#21170d] disabled:opacity-60">
              {preparing === 'install' ? <LoaderCircle className="size-5 animate-spin" /> : <Download className="size-5" />}
              {preparing === 'install' ? 'Preparing your invitation…' : 'Install Wewed & reveal my invitation'}
            </button>
          )}

          {!installed && mode === 'android-web' && deferredInstallEnabled && (
            <button type="button" onClick={openApp} disabled={preparing !== null} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-[#b89155]/55 px-5 py-4 font-semibold text-[#f8f1e7] disabled:opacity-60">
              <ExternalLink className="size-5" /> Already installed? Open Wewed
            </button>
          )}

          {!deferredInstallEnabled && mode === 'android-web' && (
            <p role="alert" className="rounded-2xl border border-[#c97866]/50 bg-[#3a201c] px-4 py-3 text-sm leading-6 text-[#f3d8d1]">
              Secure install resume is not enabled on this build yet. This invitation will stay locked until the Android handoff is enabled.
            </p>
          )}
          {error && <p role="alert" className="rounded-2xl border border-[#c97866]/50 bg-[#3a201c] px-4 py-3 text-sm leading-6 text-[#f3d8d1]">{error}</p>}
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-[#9f958a]">
          The floral invitation is revealed only after Wewed opens. Google Play receives only a temporary one-time handoff; no guest name or RSVP token is placed in the install referrer.
        </p>
      </section>
    </main>
  )
}
