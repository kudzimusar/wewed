'use client'

import { useState } from 'react'
import { editorRequest, EditorRequestError } from '@/components/wedding/site-editor/api'
import type { CoreFacts } from '@/lib/wedding-site/model'

const field =
  'w-full rounded-xl border border-gold/30 bg-white px-3 py-2.5 font-sans text-sm text-espresso focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30'

/**
 * Core facts live on Couple/Wedding — the single authority read by the website, the invitation,
 * iOS and Android. The date input edits the calendar day and preserves the stored time of day.
 */
export function EssentialsForm({
  slug,
  core,
  onChanged,
  onStatus,
}: {
  slug: string
  core: CoreFacts
  onChanged: () => Promise<void>
  onStatus: (message: string) => void
}) {
  const [values, setValues] = useState({
    partner1: core.partner1,
    partner2: core.partner2,
    day: core.date.slice(0, 10),
    venue: core.venue,
    venueCity: core.venueCity,
    venueCountry: core.venueCountry,
    venueMapUrl: core.venueMapUrl ?? '',
    tagline: core.tagline ?? '',
    monogram: core.monogram ?? '',
  })
  const [busy, setBusy] = useState(false)
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues({ ...values, [key]: event.target.value })

  async function save() {
    const patch: Record<string, unknown> = {
      expectedWeddingUpdatedAt: core.weddingUpdatedAt,
      expectedCoupleUpdatedAt: core.coupleUpdatedAt,
    }
    if (values.partner1 !== core.partner1) patch.partner1 = values.partner1
    if (values.partner2 !== core.partner2) patch.partner2 = values.partner2
    if (values.day !== core.date.slice(0, 10)) patch.date = `${values.day}${core.date.slice(10)}`
    if (values.venue !== core.venue) patch.venue = values.venue
    if (values.venueCity !== core.venueCity) patch.venueCity = values.venueCity
    if (values.venueCountry !== core.venueCountry) patch.venueCountry = values.venueCountry
    if (values.venueMapUrl !== (core.venueMapUrl ?? '')) patch.venueMapUrl = values.venueMapUrl || null
    if (values.tagline !== (core.tagline ?? '')) patch.tagline = values.tagline
    if (values.monogram !== (core.monogram ?? '')) patch.monogram = values.monogram
    if (Object.keys(patch).length === 2) {
      onStatus('No changes to save.')
      return
    }
    if (patch.date && !window.confirm('Change the wedding date? It updates the website, invitations and the apps.')) return
    setBusy(true)
    try {
      await editorRequest(slug, '/site/core', { method: 'PATCH', body: patch })
      onStatus('Wedding details saved — the website, invitation and apps now show them.')
      await onChanged()
    } catch (error) {
      onStatus(
        error instanceof EditorRequestError && error.conflict
          ? 'These details were changed on another device. Reload the editor to see the latest version.'
          : error instanceof Error
            ? error.message
            : 'Something went wrong.',
      )
    } finally {
      setBusy(false)
    }
  }

  const row = (label: string, key: keyof typeof values, props: Record<string, unknown> = {}) => (
    <label className="grid gap-1 font-sans text-xs text-espresso/70">
      {label}
      <input value={values[key]} onChange={set(key)} className={field} {...props} />
    </label>
  )

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      {row('First partner', 'partner1', { required: true })}
      {row('Second partner', 'partner2', { required: true })}
      {row('Wedding date', 'day', { type: 'date', required: true })}
      {row('Monogram', 'monogram', { maxLength: 12 })}
      {row('Venue', 'venue', { required: true })}
      {row('City', 'venueCity')}
      {row('Country', 'venueCountry')}
      {row('Map link (https://…)', 'venueMapUrl', { type: 'url' })}
      <div className="sm:col-span-2">{row('Tagline', 'tagline', { maxLength: 200 })}</div>
      <div className="sm:col-span-2">
        <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-espresso px-5 font-sans text-xs uppercase tracking-[0.14em] text-champagne disabled:opacity-40">
          Save wedding details
        </button>
      </div>
    </form>
  )
}
