'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { BellRing, CheckCircle2, Loader2, MailCheck, Save } from 'lucide-react'
import { NotificationSectionNavigation } from '@/components/notifications/notification-section-navigation'

interface Preferences {
  scopeKey: string
  inAppEnabled: true
  pushEnabled: boolean
  emailEnabled: boolean
  whatsAppEnabled: boolean
  timezone: string
  quietStart: string | null
  quietEnd: string | null
  digestMode: 'none'
}

interface ChannelCapability {
  transportConfigured: boolean
  ready: boolean
}

interface Capabilities {
  email: ChannelCapability & {
    endpointVerified: boolean
    communicationConsentEnabled: boolean
  }
  whatsapp: ChannelCapability & {
    endpointVerified: boolean
    communicationConsentEnabled: boolean
    exactActionLinkConfigured: boolean
  }
  push: ChannelCapability & {
    activeSubscriptionCount: number
    mode: 'direct' | 'gateway' | 'none'
  }
}

const DEFAULTS: Preferences = {
  scopeKey: 'global',
  inAppEnabled: true,
  pushEnabled: false,
  emailEnabled: false,
  whatsAppEnabled: false,
  timezone: 'UTC',
  quietStart: null,
  quietEnd: null,
  digestMode: 'none',
}

const EMPTY_CAPABILITIES: Capabilities = {
  email: { transportConfigured: false, endpointVerified: false, communicationConsentEnabled: false, ready: false },
  whatsapp: { transportConfigured: false, endpointVerified: false, communicationConsentEnabled: false, exactActionLinkConfigured: false, ready: false },
  push: { transportConfigured: false, activeSubscriptionCount: 0, mode: 'none', ready: false },
}

export default function NotificationSettingsPage() {
  const [form, setForm] = useState<Preferences>(DEFAULTS)
  const [capabilities, setCapabilities] = useState<Capabilities>(EMPTY_CAPABILITIES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [channelAction, setChannelAction] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [emailMessage, setEmailMessage] = useState<string | null>(null)

  const refreshCapabilities = useCallback(async () => {
    const response = await fetch('/api/notifications/capabilities', { credentials: 'same-origin', cache: 'no-store' })
    if (response.status === 401) {
      window.location.href = '/sign-in'
      return null
    }
    const payload = (await response.json()) as { success?: boolean; data?: Capabilities }
    if (payload.success && payload.data) {
      setCapabilities(payload.data)
      setForm((current) => ({
        ...current,
        pushEnabled: current.pushEnabled && payload.data!.push.ready,
        emailEnabled: current.emailEnabled && payload.data!.email.ready,
        whatsAppEnabled: current.whatsAppEnabled && payload.data!.whatsapp.ready,
      }))
      return payload.data
    }
    return null
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [preferenceResponse, capabilityResponse] = await Promise.all([
          fetch('/api/notifications/preferences', { credentials: 'same-origin', cache: 'no-store' }),
          fetch('/api/notifications/capabilities', { credentials: 'same-origin', cache: 'no-store' }),
        ])
        if (preferenceResponse.status === 401 || capabilityResponse.status === 401) {
          window.location.href = '/sign-in'
          return
        }

        const preferencePayload = (await preferenceResponse.json()) as {
          success?: boolean
          data?: Omit<Preferences, 'inAppEnabled' | 'digestMode'> & {
            inAppEnabled: boolean
            digestMode: 'none' | 'daily' | 'weekly'
          }
        }
        const capabilityPayload = (await capabilityResponse.json()) as {
          success?: boolean
          data?: Capabilities
        }

        if (!cancelled && capabilityPayload.success && capabilityPayload.data) {
          setCapabilities(capabilityPayload.data)
        }
        if (!cancelled && preferencePayload.success && preferencePayload.data) {
          const capability = capabilityPayload.success && capabilityPayload.data
            ? capabilityPayload.data
            : EMPTY_CAPABILITIES
          setForm({
            ...preferencePayload.data,
            inAppEnabled: true,
            digestMode: 'none',
            pushEnabled: Boolean(preferencePayload.data.pushEnabled && capability.push.ready),
            emailEnabled: Boolean(preferencePayload.data.emailEnabled && capability.email.ready),
            whatsAppEnabled: Boolean(preferencePayload.data.whatsAppEnabled && capability.whatsapp.ready),
            timezone: preferencePayload.data.timezone === 'UTC'
              ? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
              : preferencePayload.data.timezone,
          })
        }
        if (!cancelled) {
          const verification = new URLSearchParams(window.location.search).get('emailVerification')
          if (verification === 'success') {
            setEmailMessage('Account email verified. Allow Email delivery below, then enable Email notifications.')
            setMessage('Account email verified successfully.')
          }
          if (verification === 'invalid') {
            setEmailMessage('That email verification link is invalid or has expired. Request a new one here.')
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const payload = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to save preferences.')
      setMessage('Notification preferences saved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save preferences.')
    } finally {
      setSaving(false)
    }
  }

  async function requestEmailVerification() {
    setChannelAction('email-verification')
    setMessage(null)
    setEmailMessage('Sending a verification email to your external Wewed account mailbox…')
    try {
      const response = await fetch('/api/notifications/email-verification', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ returnTo: '/settings/notifications' }),
      })
      const payload = (await response.json()) as {
        success?: boolean
        error?: string
        data?: { address?: string; message?: string; alreadyVerified?: boolean }
      }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to send the verification email.')
      if (payload.data?.message) {
        setEmailMessage(payload.data.message)
      } else {
        const address = payload.data?.address?.trim()
        setEmailMessage(address
          ? `Verification email sent to ${address}. Check that external inbox and spam. It will not appear in Wewed Messages.`
          : 'Verification email sent to your external account mailbox. Check its inbox and spam; it will not appear in Wewed Messages.')
      }
      await refreshCapabilities()
    } catch (error) {
      setEmailMessage(error instanceof Error ? error.message : 'Unable to send the verification email.')
    } finally {
      setChannelAction(null)
    }
  }

  async function allowCommunication(channel: 'EMAIL' | 'WHATSAPP') {
    setChannelAction(`consent-${channel}`)
    setMessage(null)
    if (channel === 'EMAIL') setEmailMessage('Enabling email delivery consent…')
    try {
      const response = await fetch('/api/communications/channels', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'preference', channel, enabled: true }),
      })
      const payload = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to allow channel delivery.')
      await refreshCapabilities()
      const successText = `${channel === 'EMAIL' ? 'Email' : 'WhatsApp'} delivery consent enabled.`
      setMessage(successText)
      if (channel === 'EMAIL') setEmailMessage('Email delivery consent enabled. You can now enable the Email checkbox.')
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to update channel delivery consent.'
      setMessage(text)
      if (channel === 'EMAIL') setEmailMessage(text)
    } finally {
      setChannelAction(null)
    }
  }

  if (loading) {
    return <main className="flex min-h-dvh items-center justify-center bg-[#f8f3e9] text-[#2a211b]/45"><Loader2 className="mr-2 size-5 animate-spin" /> Loading notification settings…</main>
  }

  const channels: Array<{
    key: keyof Pick<Preferences, 'pushEnabled' | 'emailEnabled' | 'whatsAppEnabled'>
    capabilityKey: keyof Capabilities
    title: string
    description: string
  }> = [
    { key: 'pushEnabled', capabilityKey: 'push', title: 'Push', description: 'Browser/PWA push to every device you subscribe to Wewed.' },
    { key: 'emailEnabled', capabilityKey: 'email', title: 'Email', description: 'Requires Wewed email delivery, your verified account email, and communication consent.' },
    { key: 'whatsAppEnabled', capabilityKey: 'whatsapp', title: 'WhatsApp', description: 'Requires a verified WhatsApp endpoint, communication consent, and an approved Wewed notification route.' },
  ]

  function readinessText(key: keyof Capabilities) {
    const capability = capabilities[key]
    if (capability.ready) {
      if (key === 'push') return `Ready on ${capability.activeSubscriptionCount} subscribed device${capability.activeSubscriptionCount === 1 ? '' : 's'}.`
      if (key === 'whatsapp' && !capability.exactActionLinkConfigured) return 'Ready for delivery. Exact source button awaits the approved Wewed action template.'
      return 'Ready for delivery.'
    }
    if (!capability.transportConfigured) return 'Wewed transport is not configured in this environment.'
    if (key === 'push') return 'No active push subscription is registered yet. Manage Push devices to subscribe this browser.'
    if (!capability.endpointVerified) return `No verified ${key === 'email' ? 'account email' : 'WhatsApp'} endpoint is available.`
    if (!capability.communicationConsentEnabled) return 'Communication consent for this channel is disabled.'
    return 'This channel is not ready.'
  }

  return (
    <main className="min-h-dvh bg-[#f8f3e9] px-4 py-8 pb-32 text-[#2a211b] sm:px-6 sm:pb-8">
      <div className="mx-auto max-w-3xl">
        <NotificationSectionNavigation surface="settings" />
        <header className="mt-5 rounded-3xl border border-[#2a211b]/10 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#9a7440]/10 text-[#8a672f]"><BellRing className="size-5" /></div>
          <h1 className="mt-4 font-serif text-4xl sm:text-5xl">Notification settings</h1>
          <p className="mt-3 text-sm leading-7 text-[#2a211b]/55">These preferences belong to this Wewed account. You only receive notifications for sources your current role, assignments and permissions authorize.</p>
        </header>

        <section className="mt-6 rounded-3xl border border-[#2a211b]/10 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-2xl">Delivery channels</h2>
          <div className="mt-4 rounded-2xl border border-[#2a211b]/10 bg-[#f8f3e9]/60 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#8a672f]" />
              <div>
                <strong className="block text-sm">In-app — always on</strong>
                <p className="mt-1 text-xs leading-5 text-[#2a211b]/50">Wewed keeps one canonical account-level notification history. Opening or acknowledging on one device is reflected on the same account elsewhere.</p>
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-3">
            {channels.map((channel) => {
              const ready = capabilities[channel.capabilityKey].ready
              const enabled = form[channel.key]
              return (
                <div key={channel.key} className={`rounded-2xl border border-[#2a211b]/10 p-4 ${ready ? '' : 'bg-[#faf7f1]'}`}>
                  <label className={`flex items-start gap-3 ${ready ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}>
                    <input
                      type="checkbox"
                      checked={enabled && ready}
                      disabled={!ready}
                      onChange={(event) => setForm((current) => ({ ...current, [channel.key]: event.target.checked }))}
                      className="mt-1 size-4 accent-[#8a672f]"
                    />
                    <span>
                      <strong className="block text-sm">{channel.title}</strong>
                      <span className="mt-1 block text-xs leading-5 text-[#2a211b]/50">{channel.description}</span>
                      <span className={`mt-1 block text-xs font-semibold ${ready ? 'text-emerald-700' : 'text-amber-700'}`}>{readinessText(channel.capabilityKey)}</span>
                    </span>
                  </label>
                  {channel.key === 'pushEnabled' && (
                    <Link href="/settings/notifications/push" className="mt-3 inline-flex text-xs font-semibold text-[#725329] underline underline-offset-2">
                      Manage Push devices
                    </Link>
                  )}
                  {channel.key === 'emailEnabled' && capabilities.email.transportConfigured && !capabilities.email.endpointVerified && (
                    <button
                      type="button"
                      disabled={channelAction !== null}
                      onClick={() => void requestEmailVerification()}
                      className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full border border-[#8a672f]/25 px-3 text-xs font-semibold text-[#725329] disabled:opacity-50"
                    >
                      {channelAction === 'email-verification' ? <Loader2 className="size-3.5 animate-spin" /> : <MailCheck className="size-3.5" />}
                      Verify account email
                    </button>
                  )}
                  {channel.key === 'emailEnabled' && capabilities.email.endpointVerified && !capabilities.email.communicationConsentEnabled && (
                    <button type="button" disabled={channelAction !== null} onClick={() => void allowCommunication('EMAIL')} className="mt-3 inline-flex min-h-9 rounded-full border border-[#8a672f]/25 px-3 text-xs font-semibold text-[#725329] disabled:opacity-50">Allow Email delivery</button>
                  )}
                  {channel.key === 'emailEnabled' && emailMessage && (
                    <p role="status" className="mt-3 rounded-xl border border-[#8a672f]/15 bg-[#f8f3e9] px-3 py-2 text-xs leading-5 text-[#2a211b]/65">{emailMessage}</p>
                  )}
                  {channel.key === 'whatsAppEnabled' && capabilities.whatsapp.endpointVerified && !capabilities.whatsapp.communicationConsentEnabled && (
                    <button type="button" disabled={channelAction !== null} onClick={() => void allowCommunication('WHATSAPP')} className="mt-3 inline-flex min-h-9 rounded-full border border-[#8a672f]/25 px-3 text-xs font-semibold text-[#725329] disabled:opacity-50">Allow WhatsApp delivery</button>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-[#2a211b]/10 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-2xl">Time and quiet hours</h2>
          <p className="mt-2 text-xs leading-5 text-[#2a211b]/50">Use a valid IANA timezone such as Africa/Harare, Europe/London or Asia/Tokyo. Set both quiet-hour times, or leave both blank.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="text-xs font-semibold text-[#2a211b]/60">Timezone
              <input value={form.timezone} onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))} className="mt-1 block min-h-10 w-full rounded-xl border border-[#2a211b]/15 px-3 text-sm" />
            </label>
            <label className="text-xs font-semibold text-[#2a211b]/60">Quiet from
              <input type="time" value={form.quietStart || ''} onChange={(event) => setForm((current) => ({ ...current, quietStart: event.target.value || null }))} className="mt-1 block min-h-10 w-full rounded-xl border border-[#2a211b]/15 px-3 text-sm" />
            </label>
            <label className="text-xs font-semibold text-[#2a211b]/60">Quiet until
              <input type="time" value={form.quietEnd || ''} onChange={(event) => setForm((current) => ({ ...current, quietEnd: event.target.value || null }))} className="mt-1 block min-h-10 w-full rounded-xl border border-[#2a211b]/15 px-3 text-sm" />
            </label>
          </div>
          <div className="mt-4 rounded-2xl border border-dashed border-[#2a211b]/15 p-4">
            <strong className="block text-xs">Digest delivery</strong>
            <p className="mt-1 text-xs leading-5 text-[#2a211b]/50">Instant delivery policy is active. Daily and weekly digests remain unavailable until Wewed’s digest generator is implemented and certified, so choosing a digest can never silently suppress notifications.</p>
          </div>
        </section>

        <div className="mt-6 flex items-center gap-3">
          <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#2a211b] px-5 text-sm font-bold text-[#f8f3e9] disabled:opacity-50">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save preferences</button>
          {message && <p className="text-sm text-[#2a211b]/55" role="status">{message}</p>}
        </div>
      </div>
    </main>
  )
}
