'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, BellRing, CheckCircle2, Loader2, Save } from 'lucide-react'

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

export default function NotificationSettingsPage() {
  const [form, setForm] = useState<Preferences>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch('/api/notifications/preferences', { credentials: 'same-origin', cache: 'no-store' })
        if (response.status === 401) {
          window.location.href = '/sign-in'
          return
        }
        const payload = (await response.json()) as {
          success?: boolean
          data?: Omit<Preferences, 'inAppEnabled' | 'digestMode'> & {
            inAppEnabled: boolean
            digestMode: 'none' | 'daily' | 'weekly'
          }
        }
        if (!cancelled && payload.success && payload.data) {
          setForm({
            ...payload.data,
            inAppEnabled: true,
            digestMode: 'none',
            timezone: payload.data.timezone === 'UTC'
              ? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
              : payload.data.timezone,
          })
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

  if (loading) {
    return <main className="flex min-h-dvh items-center justify-center bg-[#f8f3e9] text-[#2a211b]/45"><Loader2 className="mr-2 size-5 animate-spin" /> Loading notification settings…</main>
  }

  const channels: Array<{
    key: keyof Pick<Preferences, 'pushEnabled' | 'emailEnabled' | 'whatsAppEnabled'>
    title: string
    description: string
  }> = [
    { key: 'pushEnabled', title: 'Push', description: 'Browser/PWA push when a device is subscribed.' },
    { key: 'emailEnabled', title: 'Email', description: 'Requires a verified email endpoint and enabled Wewed communication consent.' },
    { key: 'whatsAppEnabled', title: 'WhatsApp', description: 'Requires a verified WhatsApp endpoint, communication consent, and Wewed routing policy.' },
  ]

  return (
    <main className="min-h-dvh bg-[#f8f3e9] px-4 py-8 text-[#2a211b] sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/notifications" className="inline-flex items-center gap-2 text-sm font-semibold text-[#725329]"><ArrowLeft className="size-4" /> Notifications</Link>
        <header className="mt-5 rounded-3xl border border-[#2a211b]/10 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#9a7440]/10 text-[#8a672f]"><BellRing className="size-5" /></div>
          <h1 className="mt-4 font-serif text-4xl sm:text-5xl">Notification settings</h1>
          <p className="mt-3 text-sm leading-7 text-[#2a211b]/55">These preferences apply to your Wewed account across Admin, Planner, Couple or Vendor context. Source permissions still decide what you are allowed to receive.</p>
        </header>

        <section className="mt-6 rounded-3xl border border-[#2a211b]/10 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-2xl">Delivery channels</h2>
          <div className="mt-4 rounded-2xl border border-[#2a211b]/10 bg-[#f8f3e9]/60 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#8a672f]" />
              <div>
                <strong className="block text-sm">In-app — always on</strong>
                <p className="mt-1 text-xs leading-5 text-[#2a211b]/50">Wewed keeps an in-app notification history as the canonical attention record, even if an external channel fails.</p>
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-3">
            {channels.map((channel) => (
              <label key={channel.key} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#2a211b]/10 p-4">
                <input
                  type="checkbox"
                  checked={form[channel.key]}
                  onChange={(event) => setForm((current) => ({ ...current, [channel.key]: event.target.checked }))}
                  className="mt-1 size-4 accent-[#8a672f]"
                />
                <span>
                  <strong className="block text-sm">{channel.title}</strong>
                  <span className="mt-1 block text-xs leading-5 text-[#2a211b]/50">{channel.description}</span>
                  {channel.key === 'pushEnabled' && (
                    <Link href="/settings/notifications/push" className="mt-2 inline-flex text-xs font-semibold text-[#725329] underline underline-offset-2">
                      Manage this device for push
                    </Link>
                  )}
                </span>
              </label>
            ))}
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
            <p className="mt-1 text-xs leading-5 text-[#2a211b]/50">Instant delivery policy is active. Daily and weekly digests are intentionally unavailable until Wewed’s digest generator is implemented and certified, so choosing a digest can never silently suppress notifications.</p>
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
