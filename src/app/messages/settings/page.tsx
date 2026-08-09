'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Loader2, Mail, MessageCircle, Phone, Smartphone, XCircle } from 'lucide-react'

type Channel = 'EMAIL' | 'WHATSAPP' | 'SMS' | 'PUSH'
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

export default function MessageChannelSettingsPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [preferences, setPreferences] = useState<Preference[]>([])
  const [channel, setChannel] = useState<Channel>('EMAIL')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await fetch('/api/communications/channels', { cache: 'no-store' })
    const payload = await readPayload(response)
    if (!response.ok || !payload?.success || !payload.data || typeof payload.data !== 'object') {
      throw new Error(payload?.error || 'Unable to load communication channels.')
    }
    const data = payload.data as { endpoints?: Endpoint[]; preferences?: Preference[] }
    setEndpoints(data.endpoints ?? [])
    setPreferences(data.preferences ?? [])
  }, [])

  useEffect(() => {
    void load()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load channels.'))
      .finally(() => setLoading(false))
  }, [load])

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
        body: JSON.stringify({ channel, address }),
      })
      const payload = await readPayload(response)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to add endpoint.')
      setAddress('')
      setNotice(`${labels[channel]} endpoint saved. It stays pending until ownership is verified by the connected provider flow.`)
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save endpoint.')
    } finally {
      setSaving(false)
    }
  }

  async function updatePreference(target: Channel, enabled: boolean) {
    setError(null)
    const response = await fetch('/api/communications/channels', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'preference', channel: target, enabled }),
    })
    const payload = await readPayload(response)
    if (!response.ok || !payload?.success) {
      setError(payload?.error || 'Unable to update preference.')
      return
    }
    await load()
  }

  async function disableEndpoint(endpointId: string) {
    setError(null)
    const response = await fetch('/api/communications/channels', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disable', endpointId }),
    })
    const payload = await readPayload(response)
    if (!response.ok || !payload?.success) {
      setError(payload?.error || 'Unable to disable endpoint.')
      return
    }
    await load()
  }

  return (
    <main className="min-h-screen bg-ivory px-4 py-8 text-espresso sm:px-6">
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
              Wewed remains the conversation record. These channels only deliver copies and replies.
            </p>
          </div>
        </header>

        {error ? <div className="mb-4 rounded-2xl border border-clay/30 bg-clay/10 p-4 text-sm" role="alert">{error}</div> : null}
        {notice ? <div className="mb-4 rounded-2xl border border-gold/25 bg-champagne/30 p-4 text-sm">{notice}</div> : null}

        <section className="mb-6 rounded-3xl border border-gold/20 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-xl font-semibold">Add an endpoint</h2>
          <p className="mt-1 text-sm text-espresso/55">
            Email addresses, WhatsApp/SMS numbers and push endpoints are private and must be verified before Wewed can fan out messages.
          </p>
          <form onSubmit={addEndpoint} className="mt-4 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
            <select
              value={channel}
              onChange={(event) => setChannel(event.target.value as Channel)}
              className="rounded-xl border border-gold/20 bg-white px-3 py-2 text-sm"
              aria-label="Delivery channel"
            >
              {(Object.keys(labels) as Channel[]).map((item) => <option key={item} value={item}>{labels[item]}</option>)}
            </select>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder={channel === 'EMAIL' ? 'you@example.com' : channel === 'PUSH' ? 'Push subscription endpoint' : '+263…'}
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
            Enabling a channel does not bypass verification. In-app messaging always stays on.
          </p>

          {loading ? (
            <div className="flex items-center justify-center p-10 text-sm text-espresso/55"><Loader2 className="mr-2 size-4 animate-spin" /> Loading channels…</div>
          ) : (
            <div className="mt-4 space-y-4">
              {(Object.keys(labels) as Channel[]).map((item) => {
                const preference = preferences.find((entry) => entry.channel === item)
                const itemEndpoints = endpoints.filter((endpoint) => endpoint.channel === item)
                const verified = itemEndpoints.some((endpoint) => endpoint.status === 'VERIFIED')
                return (
                  <div key={item} className="rounded-2xl border border-gold/15 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 font-semibold"><ChannelIcon channel={item} /> {labels[item]}</div>
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={preference?.enabled ?? false}
                          onChange={(event) => void updatePreference(item, event.target.checked)}
                        />
                        Deliver through {labels[item]}
                      </label>
                    </div>
                    <div className="mt-3 space-y-2">
                      {itemEndpoints.length === 0 ? <p className="text-xs text-espresso/45">No endpoint saved.</p> : itemEndpoints.map((endpoint) => (
                        <div key={endpoint.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-champagne/20 px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <p className="truncate">{endpoint.address}</p>
                            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-espresso/50">
                              {endpoint.status === 'VERIFIED' ? <CheckCircle2 className="size-3 text-gold" /> : <XCircle className="size-3" />}
                              {endpoint.status.toLowerCase()}
                            </p>
                          </div>
                          {endpoint.status !== 'DISABLED' ? (
                            <button type="button" onClick={() => void disableEndpoint(endpoint.id)} className="text-xs font-semibold underline underline-offset-2">Disable</button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    {preference?.enabled && !verified ? (
                      <p className="mt-2 text-xs text-clay">Enabled, but no verified endpoint exists yet. Nothing will leave Wewed until provider verification succeeds.</p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}