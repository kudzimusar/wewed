'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
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
  if (channel === 'EMAIL') return <Mail className="size-5" />
  if (channel === 'WHATSAPP') return <MessageCircle className="size-5" />
  if (channel === 'SMS') return <Phone className="size-5" />
  return <Smartphone className="size-5" />
}

async function readPayload(response: Response) {
  return response.json().catch(() => null) as Promise<{
    success?: boolean
    data?: unknown
    error?: string
  } | null>
}

function endpointStatus(endpoint: Endpoint) {
  return (
    <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-espresso/50">
      {endpoint.status === 'VERIFIED'
        ? <CheckCircle2 className="size-3 text-gold" />
        : <XCircle className="size-3" />}
      {endpoint.status.toLowerCase()}
    </p>
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
    const next = payload.data as ChannelSettingsData
    setData(next)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const verification = new URLSearchParams(window.location.search).get('emailVerification')
      if (verification === 'success') {
        setNotice('Account email verified. You can now allow Email delivery for Wewed messages.')
      } else if (verification === 'invalid') {
        setError('That email verification link is invalid or expired. Send a fresh verification email below.')
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
      setNotice(`${labels[manualChannel]} endpoint saved. It remains pending until its provider verification succeeds.`)
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
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Unable to send the verification email.')
      }
      const result = payload.data && typeof payload.data === 'object'
        ? payload.data as { message?: string; address?: string; alreadyVerified?: boolean }
        : {}
      setNotice(
        result.message ||
        (result.alreadyVerified
          ? 'Your Wewed account email is already verified.'
          : `Verification email sent to ${result.address || accountEmail}. Check that external inbox and spam. It will not appear in Wewed Messages.`),
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
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Unable to update delivery preference.')
      }
      setNotice(`${labels[target]} message delivery ${enabled ? 'enabled' : 'disabled'}.`)
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
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Unable to disable endpoint.')
      }
      await load()
    } catch (disableError) {
      setError(disableError instanceof Error ? disableError.message : 'Unable to disable endpoint.')
    } finally {
      setSaving(false)
    }
  }

  function endpointCard(channel: ManualChannel) {
    const state = activation?.[channel]
    const channelEndpoints = endpoints.filter((endpoint) => endpoint.channel === channel)
    const checked = effectiveChecked(channel)
    return (
      <div className="rounded-2xl border border-gold/15 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-semibold"><ChannelIcon channel={channel} /> {labels[channel]}</div>
            <p className="mt-1 text-xs text-espresso/50">
              {state?.transportConfigured ? 'Wewed transport is configured.' : 'Wewed transport is not configured yet.'}
            </p>
          </div>
          <label className={`inline-flex items-center gap-2 text-sm ${state?.canEnable || checked ? '' : 'text-espresso/40'}`}>
            <input
              type="checkbox"
              checked={checked}
              disabled={saving || (!state?.canEnable && !checked)}
              onChange={(event) => void updatePreference(channel, event.target.checked)}
            />
            Deliver through {labels[channel]}
          </label>
        </div>
        <div className="mt-3 space-y-2">
          {channelEndpoints.length === 0
            ? <p className="text-xs text-espresso/45">No endpoint saved.</p>
            : channelEndpoints.map((endpoint) => (
              <div key={endpoint.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-champagne/20 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{endpoint.address}</p>
                  {endpointStatus(endpoint)}
                </div>
                {endpoint.status !== 'DISABLED' ? (
                  <button type="button" disabled={saving} onClick={() => void disableEndpoint(endpoint.id)} className="text-xs font-semibold underline underline-offset-2 disabled:opacity-40">Disable</button>
                ) : null}
              </div>
            ))}
        </div>
        {!state?.endpointVerified ? (
          <p className="mt-2 text-xs text-espresso/55">A verified {labels[channel]} endpoint is required before this channel can be enabled.</p>
        ) : null}
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-ivory px-4 py-8 pb-32 text-espresso sm:px-6 sm:pb-12">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-center gap-3">
          <Link
            href="/messages"
            className="inline-flex size-10 items-center justify-center rounded-full border border-gold/25 bg-white hover:border-gold"
            aria-label="Back to messages"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Message delivery channels</h1>
            <p className="text-sm text-espresso/55">
              Wewed Messages remains the canonical conversation record. External channels deliver a copy when they are verified, configured and enabled.
            </p>
          </div>
        </header>

        <div className="mb-6 rounded-2xl border border-gold/25 bg-champagne/25 p-4 text-sm leading-6">
          <strong>Wewed Messages is not your email inbox.</strong> Email verification is sent to your external account mailbox—for example Gmail—and will not appear in the Wewed Messages conversation list.
        </div>

        {error ? <div className="mb-4 rounded-2xl border border-clay/30 bg-clay/10 p-4 text-sm" role="alert">{error}</div> : null}
        {notice ? <div className="mb-4 rounded-2xl border border-gold/25 bg-champagne/30 p-4 text-sm" role="status">{notice}</div> : null}

        <section className="mb-6 rounded-3xl border border-gold/20 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-xl font-semibold">Add a phone endpoint</h2>
          <p className="mt-1 text-sm text-espresso/55">
            WhatsApp and SMS use verified phone endpoints. Email uses your Wewed account email, while Push uses enrolled browser devices.
          </p>
          <form onSubmit={addEndpoint} className="mt-4 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
            <select
              value={manualChannel}
              onChange={(event) => setManualChannel(event.target.value as ManualChannel)}
              className="rounded-xl border border-gold/20 bg-white px-3 py-2 text-sm"
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
              className="min-w-0 rounded-xl border border-gold/20 px-3 py-2 text-sm outline-none focus:border-gold"
            />
            <button
              type="submit"
              disabled={saving || !address.trim()}
              className="inline-flex items-center justify-center rounded-xl bg-espresso px-4 py-2 text-sm font-semibold text-champagne disabled:opacity-40"
            >
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null} Save
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-gold/20 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-xl font-semibold">Delivery preferences</h2>
          <p className="mt-1 text-sm text-espresso/55">
            A checked channel is operational: its destination is verified, its transport is configured and you have allowed delivery. In-app messaging always stays on.
          </p>

          {loading ? (
            <div className="flex items-center justify-center p-10 text-sm text-espresso/55"><Loader2 className="mr-2 size-4 animate-spin" /> Loading channels…</div>
          ) : !data || !activation ? (
            <p className="p-6 text-sm text-espresso/55">Channel status is unavailable.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-gold/15 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-semibold"><ChannelIcon channel="EMAIL" /> Email</div>
                    <p className="mt-1 break-all text-sm">{accountEmail || 'No account email saved'}</p>
                    <p className="mt-1 text-xs text-espresso/50">
                      {activation.EMAIL.endpointVerified ? 'Account email verified.' : 'Account email verification required.'}
                    </p>
                  </div>
                  <label className={`inline-flex items-center gap-2 text-sm ${activation.EMAIL.canEnable || effectiveChecked('EMAIL') ? '' : 'text-espresso/40'}`}>
                    <input
                      type="checkbox"
                      checked={effectiveChecked('EMAIL')}
                      disabled={saving || (!activation.EMAIL.canEnable && !effectiveChecked('EMAIL'))}
                      onChange={(event) => void updatePreference('EMAIL', event.target.checked)}
                    />
                    Deliver through Email
                  </label>
                </div>

                <div className="mt-3 rounded-xl bg-champagne/20 px-3 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p>{accountEmail}</p>
                      {emailEndpoint ? endpointStatus(emailEndpoint) : <p className="mt-0.5 text-xs text-espresso/50">not verified</p>}
                    </div>
                    {!activation.EMAIL.endpointVerified ? (
                      <button
                        type="button"
                        onClick={() => void requestEmailVerification()}
                        disabled={verifyingEmail || !accountEmail}
                        className="inline-flex items-center rounded-xl bg-espresso px-3 py-2 text-xs font-semibold text-champagne disabled:opacity-40"
                      >
                        {verifyingEmail ? <Loader2 className="mr-2 size-3 animate-spin" /> : <Mail className="mr-2 size-3" />}
                        {emailEndpoint?.status === 'PENDING' ? 'Resend verification email' : 'Verify account email'}
                      </button>
                    ) : null}
                  </div>
                </div>
                {!activation.EMAIL.endpointVerified ? (
                  <p className="mt-2 text-xs text-espresso/55">
                    Verification is sent to the external mailbox above. Check its inbox and spam folder; the link will not appear in Wewed Messages.
                  </p>
                ) : !activation.EMAIL.transportConfigured ? (
                  <p className="mt-2 text-xs text-clay">Your email is verified, but Wewed Email transport is not currently configured.</p>
                ) : null}
              </div>

              {endpointCard('WHATSAPP')}
              {endpointCard('SMS')}

              <div className="rounded-2xl border border-gold/15 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-semibold"><ChannelIcon channel="PUSH" /> Push</div>
                    <p className="mt-1 text-xs text-espresso/50">
                      {activation.PUSH.activeDeviceCount} active {activation.PUSH.activeDeviceCount === 1 ? 'device' : 'devices'} · {activation.PUSH.mode === 'direct' ? 'direct Wewed Web Push' : activation.PUSH.mode === 'gateway' ? 'Push gateway' : 'transport unavailable'}
                    </p>
                  </div>
                  <label className={`inline-flex items-center gap-2 text-sm ${activation.PUSH.canEnable || effectiveChecked('PUSH') ? '' : 'text-espresso/40'}`}>
                    <input
                      type="checkbox"
                      checked={effectiveChecked('PUSH')}
                      disabled={saving || (!activation.PUSH.canEnable && !effectiveChecked('PUSH'))}
                      onChange={(event) => void updatePreference('PUSH', event.target.checked)}
                    />
                    Deliver messages through Push
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-champagne/20 px-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">Push is enrolled per browser/device.</p>
                    <p className="mt-0.5 text-xs text-espresso/50">
                      Wewed sends one message-delivery event to all of your currently active Push devices.
                    </p>
                  </div>
                  <Link
                    href="/settings/notifications/push"
                    className="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2"
                  >
                    Manage Push devices <ExternalLink className="size-3" />
                  </Link>
                </div>
                {!activation.PUSH.activeDeviceCount ? (
                  <p className="mt-2 text-xs text-espresso/55">Enable Push on at least one device before Message Push can be turned on.</p>
                ) : !activation.PUSH.transportConfigured ? (
                  <p className="mt-2 text-xs text-clay">Your device is enrolled, but Wewed Push transport is not configured.</p>
                ) : null}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
