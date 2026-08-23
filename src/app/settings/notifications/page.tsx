'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { BellRing, CheckCircle2, ExternalLink, Loader2, MailCheck, Save } from 'lucide-react'
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

function Toggle({ checked, disabled, label, onChange }: { checked: boolean; disabled?: boolean; label: string; onChange?: (checked: boolean) => void }) {
  return (
    <label className={`relative inline-flex h-7 w-12 shrink-0 ${disabled ? 'opacity-40' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        aria-label={label}
      />
      <span className="absolute inset-0 rounded-full border border-[#2a211b]/15 bg-[#2a211b]/10 transition peer-checked:border-[#8a672f] peer-checked:bg-[#bf9b5f] peer-focus-visible:ring-2 peer-focus-visible:ring-[#bf9b5f]/55" />
      <span className="pointer-events-none absolute left-1 top-1 size-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
    </label>
  )
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

        if (!cancelled && capabilityPayload.success && capabilityPayload.data) setCapabilities(capabilityPayload.data)
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
            setEmailMessage('Account email verified. Allow Email delivery, then enable Email notifications.')
            setMessage('Account email verified successfully.')
          }
          if (verification === 'invalid') {
            setEmailMessage('That email verification link is invalid or expired. Request a new one here.')
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
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

  function readinessText(key: keyof Capabilities) {
    const capability = capabilities[key]
    if (capability.ready) {
      if (key === 'push') return `${capability.activeSubscriptionCount} active ${capability.activeSubscriptionCount === 1 ? 'device' : 'devices'}`
      if (key === 'whatsapp' && !capability.exactActionLinkConfigured) return 'Ready · source button pending template approval'
      return 'Ready'
    }
    if (!capability.transportConfigured) return 'Unavailable'
    if (key === 'push') return 'No active Push device'
    if (!capability.endpointVerified) return `Needs ${key === 'email' ? 'email' : 'WhatsApp'} verification`
    if (!capability.communicationConsentEnabled) return 'Delivery permission required'
    return 'Not ready'
  }

  const channelRows: Array<{
    key: keyof Pick<Preferences, 'pushEnabled' | 'emailEnabled' | 'whatsAppEnabled'>
    capabilityKey: keyof Capabilities
    title: string
  }> = [
    { key: 'pushEnabled', capabilityKey: 'push', title: 'Push' },
    { key: 'emailEnabled', capabilityKey: 'email', title: 'Email' },
    { key: 'whatsAppEnabled', capabilityKey: 'whatsapp', title: 'WhatsApp' },
  ]

  return (
    <main className="min-h-dvh bg-[#f8f3e9] px-3 pb-10 pt-16 text-[#2a211b] sm:px-6 sm:pt-8">
      <div className="mx-auto max-w-3xl">
        <NotificationSectionNavigation surface="settings" />

        <header className="mb-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a672f]">
            <BellRing className="size-3.5" /> Notifications
          </div>
          <h1 className="mt-1 font-serif text-3xl leading-tight sm:text-4xl">Notification settings</h1>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-[#2a211b]/55">Choose delivery channels and quiet hours for this account.</p>
        </header>

        <section className="overflow-hidden rounded-2xl border border-[#2a211b]/10 bg-white shadow-sm" aria-labelledby="delivery-title">
          <div className="border-b border-[#2a211b]/10 px-3 py-3 sm:px-4">
            <h2 id="delivery-title" className="text-sm font-semibold">Delivery</h2>
          </div>

          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#2a211b]/10 px-3 py-3 sm:px-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#bf9b5f]/10 text-[#8a672f]"><CheckCircle2 className="size-4" /></div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">In-app</p>
              <p className="text-xs text-[#2a211b]/50">Canonical Wewed notification history · always on</p>
            </div>
            <Toggle checked disabled label="In-app notifications are always on" />
          </div>

          {channelRows.map((channel) => {
            const capability = capabilities[channel.capabilityKey]
            const ready = capability.ready
            const enabled = form[channel.key]
            return (
              <div key={channel.key} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#2a211b]/10 px-3 py-3 last:border-b-0 sm:px-4">
                <div className="flex size-8 items-center justify-center rounded-lg bg-[#bf9b5f]/10 text-[#8a672f]"><BellRing className="size-4" /></div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{channel.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{readinessText(channel.capabilityKey)}</span>
                  </div>

                  {channel.key === 'pushEnabled' ? (
                    <Link href="/settings/notifications/push" className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#725329] underline underline-offset-2">Manage devices <ExternalLink className="size-3" /></Link>
                  ) : null}

                  {channel.key === 'emailEnabled' && capabilities.email.transportConfigured && !capabilities.email.endpointVerified ? (
                    <button type="button" disabled={channelAction !== null} onClick={() => void requestEmailVerification()} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#725329] underline underline-offset-2 disabled:opacity-50">
                      {channelAction === 'email-verification' ? <Loader2 className="size-3 animate-spin" /> : <MailCheck className="size-3" />} Verify account email
                    </button>
                  ) : null}

                  {channel.key === 'emailEnabled' && capabilities.email.endpointVerified && !capabilities.email.communicationConsentEnabled ? (
                    <button type="button" disabled={channelAction !== null} onClick={() => void allowCommunication('EMAIL')} className="mt-1 text-[11px] font-semibold text-[#725329] underline underline-offset-2 disabled:opacity-50">Allow Email delivery</button>
                  ) : null}

                  {channel.key === 'whatsAppEnabled' && capabilities.whatsapp.endpointVerified && !capabilities.whatsapp.communicationConsentEnabled ? (
                    <button type="button" disabled={channelAction !== null} onClick={() => void allowCommunication('WHATSAPP')} className="mt-1 text-[11px] font-semibold text-[#725329] underline underline-offset-2 disabled:opacity-50">Allow WhatsApp delivery</button>
                  ) : null}

                  {channel.key === 'emailEnabled' && emailMessage ? <p role="status" className="mt-1 text-[11px] leading-4 text-[#2a211b]/55">{emailMessage}</p> : null}
                </div>
                <Toggle
                  checked={Boolean(enabled && ready)}
                  disabled={!ready}
                  label={`Enable ${channel.title} notifications`}
                  onChange={(checked) => setForm((current) => ({ ...current, [channel.key]: checked }))}
                />
              </div>
            )
          })}
        </section>

        <section className="mt-4 rounded-2xl border border-[#2a211b]/10 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[190px] flex-1 text-[11px] font-semibold text-[#2a211b]/60">Timezone
              <input value={form.timezone} onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))} className="mt-1 block min-h-10 w-full rounded-xl border border-[#2a211b]/15 px-3 text-sm font-normal" />
            </label>
            <label className="min-w-[130px] flex-1 text-[11px] font-semibold text-[#2a211b]/60">Quiet from
              <input type="time" value={form.quietStart || ''} onChange={(event) => setForm((current) => ({ ...current, quietStart: event.target.value || null }))} className="mt-1 block min-h-10 w-full rounded-xl border border-[#2a211b]/15 px-3 text-sm font-normal" />
            </label>
            <label className="min-w-[130px] flex-1 text-[11px] font-semibold text-[#2a211b]/60">Quiet until
              <input type="time" value={form.quietEnd || ''} onChange={(event) => setForm((current) => ({ ...current, quietEnd: event.target.value || null }))} className="mt-1 block min-h-10 w-full rounded-xl border border-[#2a211b]/15 px-3 text-sm font-normal" />
            </label>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-[#2a211b]/45">Set both quiet-hour times or leave both blank. Instant delivery remains active; digest mode is not yet available.</p>
        </section>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#2a211b] px-4 text-sm font-bold text-[#f8f3e9] disabled:opacity-50">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
          </button>
          {message ? <p className="text-xs text-[#2a211b]/55" role="status">{message}</p> : null}
        </div>
      </div>
    </main>
  )
}
