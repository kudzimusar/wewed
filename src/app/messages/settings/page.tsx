'use client'

import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Smartphone,
  XCircle,
} from 'lucide-react'

type Channel = 'EMAIL' | 'WHATSAPP' | 'SMS' | 'PUSH'
type ManualChannel = 'WHATSAPP' | 'SMS'
type EndpointStatus = 'PENDING' | 'VERIFIED' | 'DISABLED' | 'BOUNCED'

interface Endpoint {
  id: string
  channel: Channel
  address: string
  normalizedAddress: string
  status: EndpointStatus
  verifiedAt: string | null
  enabled: boolean
}

interface Preference {
  channel: Channel
  enabled: boolean
}

interface ActivationState {
  transportConfigured: boolean
  endpointVerified: boolean
  activeEndpointCount: number
  activeDeviceCount: number
  preferenceEnabled: boolean
  canEnable: boolean
  ready: boolean
  mode?: 'direct' | 'gateway' | 'none'
  exactActionLinkConfigured?: boolean
}

interface ChannelSettingsData {
  endpoints: Endpoint[]
  preferences: Preference[]
  accountEmail: string
  activation: Record<Channel, ActivationState>
}

const labels: Record<Channel, string> = {
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  SMS: 'SMS',
  PUSH: 'Push',
}

function ChannelIcon({ channel }: { channel: Channel }) {
  if (channel === 'EMAIL') return <Mail className="size-4" />
  if (channel === 'WHATSAPP') return <MessageCircle className="size-4" />
  if (channel === 'SMS') return <Phone className="size-4" />
  return <Smartphone className="size-4" />
}

async function readPayload(response: Response) {
  return response.json().catch(() => null) as Promise<{
    success?: boolean
    data?: unknown
    error?: string
  } | null>
}

function StatusPill({ tone, children }: { tone: 'ready' | 'pending' | 'muted'; children: ReactNode }) {
  const classes = tone === 'ready'
    ? 'border-gold/30 bg-gold/10 text-espresso'
    : tone === 'pending'
      ? 'border-clay/25 bg-clay/10 text-clay'
      : 'border-espresso/10 bg-espresso/[0.04] text-espresso/50'

  return (
    <span className={`inline-flex min-h-6 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${classes}`}>
      {children}
    </span>
  )
}

function EndpointStatusLabel({ endpoint }: { endpoint: Endpoint }) {
  const verified = endpoint.status === 'VERIFIED'
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-espresso/50">
      {verified ? <CheckCircle2 className="size-3 text-gold" /> : <XCircle className="size-3" />}
      {endpoint.status.toLowerCase()}
    </span>
  )
}

function PreferenceToggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean
  disabled: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className={`relative inline-flex h-11 w-12 shrink-0 ${disabled ? 'opacity-45' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
        aria-label={label}
      />
      <span className="absolute inset-x-0 top-2 h-7 rounded-full border border-espresso/15 bg-espresso/10 transition peer-checked:border-gold peer-checked:bg-gold peer-focus-visible:ring-2 peer-focus-visible:ring-gold/55 peer-disabled:cursor-not-allowed" />
      <span className="pointer-events-none absolute left-1 top-3 flex size-5 items-center justify-center rounded-full bg-white text-transparent shadow-sm transition-transform peer-checked:translate-x-5 peer-checked:text-gold">
        <Check className="size-3" />
      </span>
    </label>
  )
}

export default function MessageChannelSettingsPage() {
  const [data, setData] = useState<ChannelSettingsData | null>(null)
  const [manualChannel, setManualChannel] = useState<ManualChannel>('WHATSAPP')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [verifyingEmail, setVerifyingEmail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await fetch('/api/communications/channels', { cache: 'no-store' })
    const payload = await readPayload(response)
    if (!response.ok || !payload?.success || !payload.data || typeof payload.data !== 'object') {
      throw new Error(payload?.error || 'Unable to load communication channels.')
    }
    setData(payload.data as ChannelSettingsData)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const verification = new URLSearchParams(window.location.search).get('emailVerification')
      if (verification === 'success') {
        setNotice('Account email verified. Email delivery is ready to use.')
      } else if (verification === 'invalid') {
        setError('That verification link is invalid or expired. Send a fresh verification email below.')
      }
    }

    void load()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load channels.'))
      .finally(() => setLoading(false))
  }, [load])

  const preferences = data?.preferences ?? []
  const endpoints = data?.endpoints ?? []
  const activation = data?.activation
  const accountEmail = data?.accountEmail ?? ''

  const emailEndpoint = useMemo(() => {
    const normalized = accountEmail.trim().toLowerCase()
    return endpoints.find((endpoint) =>
      endpoint.channel === 'EMAIL' && endpoint.normalizedAddress.toLowerCase() === normalized,
    ) ?? null
  }, [accountEmail, endpoints])

  const activePhoneEndpoints = useMemo(
    () => endpoints.filter((endpoint) =>
      (endpoint.channel === 'WHATSAPP' || endpoint.channel === 'SMS') && endpoint.status !== 'DISABLED',
    ),
    [endpoints],
  )

  function preference(channel: Channel): boolean {
    return preferences.find((entry) => entry.channel === channel)?.enabled ?? false
  }

  function effectiveChecked(channel: Channel): boolean {
    const state = activation?.[channel]
    return Boolean(preference(channel) && state?.canEnable)
  }

  async function addEndpoint(event: FormEvent) {
    event.preventDefault()
    if (!address.trim() || saving) return
    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch('/api/communications/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: manualChannel, address }),
      })
      const payload = await readPayload(response)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to add endpoint.')
      setAddress('')
      setNotice(`${labels[manualChannel]} number saved. It will become available after verification.`)
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save endpoint.')
    } finally {
      setSaving(false)
    }
  }

  async function requestEmailVerification() {
    if (verifyingEmail) return
    setVerifyingEmail(true)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch('/api/notifications/email-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnTo: '/messages/settings' }),
      })
      const payload = await readPayload(response)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to send the verification email.')

      const result = payload.data && typeof payload.data === 'object'
        ? payload.data as { message?: string; address?: string; alreadyVerified?: boolean }
        : {}
      setNotice(
        result.message ||
        (result.alreadyVerified
          ? 'Your Wewed account email is already verified.'
          : `Verification sent to ${result.address || accountEmail}. Check that external inbox and spam.`),
      )
      await load()
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : 'Unable to send the verification email.')
    } finally {
      setVerifyingEmail(false)
    }
  }

  async function updatePreference(target: Channel, enabled: boolean) {
    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch('/api/communications/channels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preference', channel: target, enabled }),
      })
      const payload = await readPayload(response)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to update delivery preference.')
      setNotice(`${labels[target]} delivery ${enabled ? 'enabled' : 'disabled'}.`)
      await load()
    } catch (preferenceError) {
      setError(preferenceError instanceof Error ? preferenceError.message : 'Unable to update delivery preference.')
    } finally {
      setSaving(false)
    }
  }

  async function disableEndpoint(endpointId: string) {
    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch('/api/communications/channels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable', endpointId }),
      })
      const payload = await readPayload(response)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to disable endpoint.')
      await load()
    } catch (disableError) {
      setError(disableError instanceof Error ? disableError.message : 'Unable to disable endpoint.')
    } finally {
      setSaving(false)
    }
  }

  function manualChannelRow(channel: ManualChannel) {
    if (!activation) return null
    const state = activation[channel]
    const channelEndpoints = activePhoneEndpoints.filter((endpoint) => endpoint.channel === channel)
    const primary = channelEndpoints.find((endpoint) => endpoint.status === 'VERIFIED') ?? channelEndpoints[0] ?? null
    const checked = effectiveChecked(channel)
    const status = !state.transportConfigured
      ? <StatusPill tone="muted">Unavailable</StatusPill>
      : state.endpointVerified
        ? <StatusPill tone="ready">Verified</StatusPill>
        : <StatusPill tone="pending">Needs verification</StatusPill>

    return (
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-gold/15 px-3 py-3 last:border-b-0 sm:px-4">
        <div className="flex size-9 items-center justify-center rounded-xl bg-champagne/45 text-espresso">
          <ChannelIcon channel={channel} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{labels[channel]}</p>
            {status}
          </div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <p className="max-w-full truncate text-xs text-espresso/55">
              {primary?.address || (channel === 'SMS' ? 'No verified number' : 'No number saved')}
            </p>
            {primary ? <EndpointStatusLabel endpoint={primary} /> : null}
            {channelEndpoints.length > 1 ? <span className="text-[11px] text-espresso/45">+{channelEndpoints.length - 1} more</span> : null}
          </div>
        </div>
        <PreferenceToggle
          checked={checked}
          disabled={saving || (!state.canEnable && !checked)}
          label={`Deliver Wewed messages through ${labels[channel]}`}
          onChange={(enabled) => void updatePreference(channel, enabled)}
        />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-ivory px-3 pb-10 pt-16 text-espresso sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-4 flex items-start gap-3">
          <Link
            href="/messages"
            className="hidden size-9 shrink-0 items-center justify-center rounded-full border border-gold/20 bg-white text-espresso/70 hover:border-gold sm:inline-flex"
            aria-label="Back to messages"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">Messages</p>
            <h1 className="font-serif text-2xl font-semibold leading-tight sm:text-3xl">Delivery channels</h1>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-espresso/55">
              Choose where Wewed can send copies of your messages. Wewed Messages remains the conversation record.
            </p>
          </div>
        </header>

        {error ? (
          <div className="mb-3 rounded-xl border border-clay/25 bg-clay/10 px-3 py-2.5 text-sm" role="alert">{error}</div>
        ) : null}
        {notice ? (
          <div className="mb-3 rounded-xl border border-gold/25 bg-champagne/35 px-3 py-2.5 text-sm" role="status">{notice}</div>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-gold/20 bg-white shadow-sm" aria-labelledby="delivery-preferences-title">
          <div className="border-b border-gold/15 px-3 py-3 sm:px-4">
            <h2 id="delivery-preferences-title" className="text-sm font-semibold">Delivery preferences</h2>
            <p className="mt-0.5 text-xs text-espresso/50">Verified + available + enabled means the channel is ready.</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-espresso/55">
              <Loader2 className="size-4 animate-spin" /> Loading channels…
            </div>
          ) : !data || !activation ? (
            <p className="px-4 py-8 text-sm text-espresso/55">Channel status is unavailable.</p>
          ) : (
            <div>
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-gold/15 px-3 py-3 sm:px-4">
                <div className="flex size-9 items-center justify-center rounded-xl bg-champagne/45 text-espresso">
                  <ChannelIcon channel="EMAIL" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">Email</p>
                    {!activation.EMAIL.transportConfigured
                      ? <StatusPill tone="muted">Unavailable</StatusPill>
                      : activation.EMAIL.endpointVerified
                        ? <StatusPill tone="ready">Verified</StatusPill>
                        : <StatusPill tone="pending">Needs verification</StatusPill>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-espresso/55">{accountEmail || 'No account email saved'}</p>
                  {activation.EMAIL.transportConfigured && !activation.EMAIL.endpointVerified && accountEmail ? (
                    <button
                      type="button"
                      onClick={() => void requestEmailVerification()}
                      disabled={verifyingEmail || saving}
                      className="mt-1 inline-flex min-h-8 items-center gap-1 text-[11px] font-semibold text-espresso underline underline-offset-2 disabled:opacity-40"
                    >
                      {verifyingEmail ? <Loader2 className="size-3 animate-spin" /> : <Mail className="size-3" />}
                      Send verification
                    </button>
                  ) : emailEndpoint ? (
                    <span className="mt-1 inline-flex"><EndpointStatusLabel endpoint={emailEndpoint} /></span>
                  ) : null}
                </div>
                <PreferenceToggle
                  checked={effectiveChecked('EMAIL')}
                  disabled={saving || (!activation.EMAIL.canEnable && !effectiveChecked('EMAIL'))}
                  label="Deliver Wewed messages through Email"
                  onChange={(enabled) => void updatePreference('EMAIL', enabled)}
                />
              </div>

              {manualChannelRow('WHATSAPP')}
              {manualChannelRow('SMS')}

              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:px-4">
                <div className="flex size-9 items-center justify-center rounded-xl bg-champagne/45 text-espresso">
                  <ChannelIcon channel="PUSH" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">Push</p>
                    {activation.PUSH.canEnable
                      ? <StatusPill tone="ready">Ready</StatusPill>
                      : <StatusPill tone="muted">Unavailable</StatusPill>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-espresso/55">
                    <span>{activation.PUSH.activeDeviceCount} active {activation.PUSH.activeDeviceCount === 1 ? 'device' : 'devices'}</span>
                    <Link
                      href="/settings/notifications/push"
                      className="inline-flex min-h-8 items-center gap-1 font-semibold text-espresso underline underline-offset-2"
                    >
                      Manage <ExternalLink className="size-3" />
                    </Link>
                  </div>
                </div>
                <PreferenceToggle
                  checked={effectiveChecked('PUSH')}
                  disabled={saving || (!activation.PUSH.canEnable && !effectiveChecked('PUSH'))}
                  label="Deliver Wewed messages through Push"
                  onChange={(enabled) => void updatePreference('PUSH', enabled)}
                />
              </div>
            </div>
          )}
        </section>

        <p className="mt-3 px-1 text-xs leading-5 text-espresso/50">
          Email verification arrives in your external mailbox (for example Gmail), not in Wewed Messages.
        </p>

        <details className="group mt-4 overflow-hidden rounded-2xl border border-gold/20 bg-white">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold sm:px-4 [&::-webkit-details-marker]:hidden">
            <span>Add or change a phone number</span>
            <ChevronDown className="size-4 text-espresso/55 transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-gold/15 px-3 py-3 sm:px-4">
            <p className="mb-3 text-xs leading-5 text-espresso/50">WhatsApp and SMS require a verified phone endpoint before delivery can be enabled.</p>
            <form onSubmit={addEndpoint} className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
              <select
                value={manualChannel}
                onChange={(event) => setManualChannel(event.target.value as ManualChannel)}
                className="min-h-11 rounded-xl border border-gold/20 bg-white px-3 text-sm outline-none focus:border-gold"
                aria-label="Phone delivery channel"
              >
                <option value="WHATSAPP">WhatsApp</option>
                <option value="SMS">SMS</option>
              </select>
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="+263…"
                inputMode="tel"
                aria-label="Phone number"
                className="min-h-11 min-w-0 rounded-xl border border-gold/20 px-3 text-sm outline-none focus:border-gold"
              />
              <button
                type="submit"
                disabled={saving || !address.trim()}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-espresso px-4 text-sm font-semibold text-champagne disabled:opacity-40"
              >
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Save
              </button>
            </form>

            <div className="mt-4 border-t border-gold/10 pt-3" aria-label="Saved phone numbers">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-espresso/45">Saved numbers</p>
              {activePhoneEndpoints.length === 0 ? (
                <p className="mt-2 text-xs text-espresso/50">No active WhatsApp or SMS numbers saved.</p>
              ) : (
                <div className="mt-2 divide-y divide-gold/10">
                  {activePhoneEndpoints.map((endpoint) => (
                    <div key={endpoint.id} className="flex min-h-11 items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold">{labels[endpoint.channel]}</span>
                          <EndpointStatusLabel endpoint={endpoint} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-espresso/55">{endpoint.address}</p>
                      </div>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void disableEndpoint(endpoint.id)}
                        className="inline-flex min-h-10 shrink-0 items-center px-2 text-[11px] font-semibold text-espresso/55 underline underline-offset-2 hover:text-espresso disabled:opacity-40"
                      >
                        Disable
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </details>
      </div>
    </main>
  )
}
