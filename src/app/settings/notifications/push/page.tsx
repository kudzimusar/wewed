'use client'

import { useCallback, useEffect, useState } from 'react'
import { BellRing, CheckCircle2, Loader2, Smartphone, XCircle } from 'lucide-react'
import { NotificationSectionNavigation } from '@/components/notifications/notification-section-navigation'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)))
}

interface IOSNavigator extends Navigator {
  standalone?: boolean
}

function deviceContext() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return { ios: false, standalone: false }
  }
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as IOSNavigator).standalone)
  return { ios, standalone }
}

export default function PushNotificationSettingsPage() {
  const [supported, setSupported] = useState(false)
  const [transportConfigured, setTransportConfigured] = useState(false)
  const [transportMode, setTransportMode] = useState<'direct' | 'gateway' | 'none'>('none')
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const [subscribed, setSubscribed] = useState(false)
  const [activeDeviceCount, setActiveDeviceCount] = useState(0)
  const [ios, setIos] = useState(false)
  const [standalone, setStandalone] = useState(false)
  const [working, setWorking] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const loadCapabilities = useCallback(async () => {
    const response = await fetch('/api/notifications/capabilities', {
      credentials: 'same-origin',
      cache: 'no-store',
    })
    if (response.status === 401) {
      window.location.href = '/sign-in'
      return null
    }
    const payload = (await response.json()) as {
      success?: boolean
      data?: { push?: { transportConfigured?: boolean; activeSubscriptionCount?: number; mode?: 'direct' | 'gateway' | 'none' } }
    }
    if (payload.success && payload.data?.push) {
      setTransportConfigured(Boolean(payload.data.push.transportConfigured))
      setActiveDeviceCount(Math.max(0, Number(payload.data.push.activeSubscriptionCount ?? 0)))
      setTransportMode(payload.data.push.mode ?? 'none')
      return payload.data.push
    }
    return null
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const context = deviceContext()
      setIos(context.ios)
      setStandalone(context.standalone)

      const browserSupported =
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
      if (cancelled) return
      setSupported(browserSupported)
      setPermission(browserSupported ? Notification.permission : 'unsupported')

      try {
        await loadCapabilities()
        if (!browserSupported) return
        const registration = await navigator.serviceWorker.ready
        const existing = await registration.pushManager.getSubscription()
        if (!cancelled) setSubscribed(Boolean(existing))
      } finally {
        if (!cancelled) setWorking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadCapabilities])

  async function updatePushPreference(enabled: boolean) {
    const response = await fetch('/api/notifications/preferences', { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) throw new Error('Unable to load notification preferences.')
    const payload = (await response.json()) as { success?: boolean; data?: Record<string, unknown> }
    if (!payload.success || !payload.data) throw new Error('Unable to load notification preferences.')
    const update = await fetch('/api/notifications/preferences', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...payload.data,
        inAppEnabled: true,
        digestMode: 'none',
        pushEnabled: enabled,
      }),
    })
    const updatePayload = (await update.json()) as { success?: boolean; error?: string }
    if (!update.ok || !updatePayload.success) {
      throw new Error(updatePayload.error || 'Unable to update push preference.')
    }
  }

  async function enablePush() {
    setWorking(true)
    setMessage(null)
    try {
      if (ios && !standalone) {
        throw new Error('On iPhone or iPad, add Wewed to your Home Screen, open the installed Wewed app, then enable push here.')
      }
      if (!supported) throw new Error('Push notifications are not supported by this browser or installation mode.')
      if (!transportConfigured) throw new Error('Wewed push delivery is not configured in this environment yet.')
      const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY
      if (!publicKey) throw new Error('Wewed Web Push subscription is not configured in this environment yet.')

      const nextPermission = await Notification.requestPermission()
      setPermission(nextPermission)
      if (nextPermission !== 'granted') {
        throw new Error('Notification permission was not granted. You can change this later in browser settings.')
      }

      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
      }

      const json = subscription.toJSON()
      const response = await fetch('/api/notifications/push-subscriptions', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(json),
      })
      const payload = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to register this device.')
      await updatePushPreference(true)
      setSubscribed(true)
      await loadCapabilities()
      setMessage('Push is enabled on this device. Wewed will keep one shared notification state across your subscribed devices.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to enable push.')
    } finally {
      setWorking(false)
    }
  }

  async function disablePush() {
    setWorking(true)
    setMessage(null)
    try {
      if (supported) {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          const disableResponse = await fetch('/api/notifications/push-subscriptions', {
            method: 'DELETE',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          })
          const disablePayload = (await disableResponse.json()) as { success?: boolean; error?: string }
          if (!disableResponse.ok || !disablePayload.success) {
            throw new Error(disablePayload.error || 'Unable to disable this Wewed push subscription.')
          }
          await subscription.unsubscribe()
        }
      }
      setSubscribed(false)
      const capability = await loadCapabilities()
      const remaining = Math.max(0, Number(capability?.activeSubscriptionCount ?? 0))
      if (remaining === 0) await updatePushPreference(false)
      setMessage(remaining > 0
        ? `Push is disabled on this device. ${remaining} other subscribed device${remaining === 1 ? '' : 's'} remain active.`
        : 'Push is disabled. No subscribed Wewed devices remain for this account.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to disable push.')
    } finally {
      setWorking(false)
    }
  }

  const setupGuidance = ios && !standalone
    ? 'On iPhone or iPad: use Share → Add to Home Screen, open Wewed from the Home Screen, then return here to enable notifications.'
    : supported
      ? 'Enable this device to receive Wewed alerts even when this page is not open. Each device is subscribed separately.'
      : 'This browser or installation mode does not currently expose the Web Push APIs Wewed needs.'

  return (
    <main className="min-h-dvh bg-[#f8f3e9] px-4 py-8 text-[#2a211b] sm:px-6">
      <div className="mx-auto max-w-2xl">
        <NotificationSectionNavigation surface="push" />
        <section className="mt-5 rounded-3xl border border-[#2a211b]/10 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#9a7440]/10 text-[#8a672f]"><Smartphone className="size-5" /></div>
          <h1 className="mt-4 font-serif text-4xl">Push on this device</h1>
          <p className="mt-3 text-sm leading-7 text-[#2a211b]/55">{setupGuidance}</p>

          <div className="mt-6 rounded-2xl border border-[#2a211b]/10 bg-[#faf7f1] p-4">
            <div className="flex items-start gap-3">
              {working ? <Loader2 className="mt-0.5 size-5 animate-spin text-[#8a672f]" /> : subscribed ? <CheckCircle2 className="mt-0.5 size-5 text-emerald-700" /> : <XCircle className="mt-0.5 size-5 text-[#2a211b]/35" />}
              <div>
                <p className="text-sm font-bold">{working ? 'Checking this device…' : subscribed ? 'Subscribed on this device' : supported ? 'Not subscribed on this device' : 'Push not supported here'}</p>
                <p className="mt-0.5 text-xs text-[#2a211b]/45">Browser permission: {permission}</p>
                <p className={`mt-1 text-xs font-semibold ${transportConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {transportConfigured ? `Wewed push transport is configured (${transportMode}).` : 'Wewed push transport is not configured in this environment.'}
                </p>
                <p className="mt-1 text-xs text-[#2a211b]/45">Active devices on this account: {activeDeviceCount}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {!subscribed ? (
              <button type="button" disabled={working || !supported || !transportConfigured || (ios && !standalone)} onClick={() => void enablePush()} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#2a211b] px-5 text-sm font-bold text-[#f8f3e9] disabled:opacity-45"><BellRing className="size-4" /> Enable push</button>
            ) : (
              <button type="button" disabled={working} onClick={() => void disablePush()} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#2a211b]/20 bg-white px-5 text-sm font-bold disabled:opacity-45">Disable on this device</button>
            )}
          </div>

          {message && <p role="status" className="mt-4 rounded-xl bg-[#f4ecde] px-4 py-3 text-sm text-[#2a211b]/65">{message}</p>}
        </section>
      </div>
    </main>
  )
}
