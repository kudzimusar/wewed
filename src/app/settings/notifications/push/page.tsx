'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, BellRing, CheckCircle2, Loader2, Smartphone, XCircle } from 'lucide-react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)))
}

export default function PushNotificationSettingsPage() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const [subscribed, setSubscribed] = useState(false)
  const [working, setWorking] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const browserSupported =
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
      if (cancelled) return
      setSupported(browserSupported)
      setPermission(browserSupported ? Notification.permission : 'unsupported')
      if (!browserSupported) {
        setWorking(false)
        return
      }
      try {
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
  }, [])

  async function updatePushPreference(enabled: boolean) {
    const response = await fetch('/api/notifications/preferences', { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) return
    const payload = (await response.json()) as { success?: boolean; data?: Record<string, unknown> }
    if (!payload.success || !payload.data) return
    await fetch('/api/notifications/preferences', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload.data, pushEnabled: enabled }),
    })
  }

  async function enablePush() {
    setWorking(true)
    setMessage(null)
    try {
      if (!supported) throw new Error('Push notifications are not supported by this browser.')
      const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY
      if (!publicKey) throw new Error('Wewed web push is not configured for this environment yet.')

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
      setMessage('Push is enabled for this device.')
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
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await fetch('/api/notifications/push-subscriptions', {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }
      await updatePushPreference(false)
      setSubscribed(false)
      setMessage('Push is disabled for this device.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to disable push.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <main className="min-h-dvh bg-[#f8f3e9] px-4 py-8 text-[#2a211b] sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link href="/settings/notifications" className="inline-flex items-center gap-2 text-sm font-semibold text-[#725329]"><ArrowLeft className="size-4" /> Notification settings</Link>
        <section className="mt-5 rounded-3xl border border-[#2a211b]/10 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#9a7440]/10 text-[#8a672f]"><Smartphone className="size-5" /></div>
          <h1 className="mt-4 font-serif text-4xl">Push on this device</h1>
          <p className="mt-3 text-sm leading-7 text-[#2a211b]/55">Wewed asks for browser notification permission only here, after you choose to enable it. The in-app Notification Center remains the canonical history even if device delivery fails.</p>

          <div className="mt-6 rounded-2xl border border-[#2a211b]/10 bg-[#faf7f1] p-4">
            <div className="flex items-center gap-3">
              {working ? <Loader2 className="size-5 animate-spin text-[#8a672f]" /> : subscribed ? <CheckCircle2 className="size-5 text-emerald-700" /> : <XCircle className="size-5 text-[#2a211b]/35" />}
              <div>
                <p className="text-sm font-bold">{working ? 'Checking this device…' : subscribed ? 'Subscribed' : supported ? 'Not subscribed' : 'Push not supported'}</p>
                <p className="mt-0.5 text-xs text-[#2a211b]/45">Browser permission: {permission}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {!subscribed ? (
              <button type="button" disabled={working || !supported} onClick={() => void enablePush()} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#2a211b] px-5 text-sm font-bold text-[#f8f3e9] disabled:opacity-45"><BellRing className="size-4" /> Enable push</button>
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
