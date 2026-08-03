'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CheckCircle2, Globe2, KeyRound, Loader2, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'

type PrivacyValue = 'public' | 'link_only' | 'private'

const options: Array<{
  id: PrivacyValue
  title: string
  detail: string
  icon: typeof Globe2
}> = [
  { id: 'public', title: 'Public', detail: 'Anyone with the wedding URL may view. Choose this deliberately only when the couple wants public visibility.', icon: Globe2 },
  { id: 'link_only', title: 'Invitation only', detail: 'Guests enter using their unique invitation QR or credential. Anonymous visitors receive no wedding payload.', icon: KeyRound },
  { id: 'private', title: 'Private', detail: 'Only the signed-in couple owner may view the wedding site.', icon: LockKeyhole },
]

export function CouplePrivacyCentre() {
  return (
    <DashboardAuthGate
      allowedRoles={['couple']}
      wrongRoleMessage="Sign in with the couple account that owns this wedding."
      title="Wedding privacy"
      description="Control who can view the active wedding site."
      onClose={() => { window.location.href = '/couple' }}
    >
      <CouplePrivacyContent />
    </DashboardAuthGate>
  )
}

function CouplePrivacyContent() {
  const [privacy, setPrivacy] = useState<PrivacyValue>('link_only')
  const [saved, setSaved] = useState<PrivacyValue>('link_only')
  const [wedding, setWedding] = useState<{ slug: string; title: string } | null>(null)
  const [busy, setBusy] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetch('/api/couple/wedding-privacy', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load privacy.')
        const value = payload.wedding.privacy as PrivacyValue
        setPrivacy(value)
        setSaved(value)
        setWedding(payload.wedding)
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load privacy.'))
      .finally(() => setBusy(false))
  }, [])

  async function save() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/couple/wedding-privacy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privacy }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to save privacy.')
      setSaved(payload.wedding.privacy)
      setNotice('Wedding privacy was updated and now applies to the page and wedding-data APIs.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save privacy.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-ivory text-espresso">
      <header className="border-b border-gold/20 bg-espresso px-4 py-8 text-champagne sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Privacy & access</p><h1 className="mt-2 font-serif text-4xl">{wedding?.title || 'Active wedding'}</h1><p className="mt-2 text-sm text-champagne/60">Choose the audience for the wedding site independently from the public planner marketplace.</p></div>
          <div className="flex gap-2"><Link href="/couple" className="rounded-full border border-gold/30 px-4 py-2 text-xs text-gold hover:bg-gold/10">Couple dashboard</Link>{wedding && <Link href={`/w/${wedding.slug}`} className="rounded-full border border-gold/30 px-4 py-2 text-xs text-champagne/70 hover:bg-gold/10">View wedding</Link>}</div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {busy && !wedding ? <Loader2 className="mx-auto size-7 animate-spin text-gold-muted" /> : (
          <>
            {(notice || error) && <p role={error ? 'alert' : 'status'} className={`mb-6 rounded-xl border p-3 text-sm ${error ? 'border-clay/30 bg-clay/10' : 'border-sage/30 bg-sage/10'}`}>{error || notice}</p>}
            <div className="grid gap-5 md:grid-cols-3">
              {options.map(({ id, title, detail, icon: Icon }) => {
                const selected = privacy === id
                return (
                  <button key={id} type="button" onClick={() => setPrivacy(id)} className={`rounded-3xl border p-6 text-left transition ${selected ? 'border-gold bg-champagne ring-2 ring-gold/25' : 'border-gold/20 bg-white hover:border-gold/45'}`}>
                    <div className="flex items-center justify-between"><span className="flex size-11 items-center justify-center rounded-full bg-gold/10"><Icon className="size-5 text-gold-muted" /></span>{selected && <CheckCircle2 className="size-5 text-sage" />}</div>
                    <h2 className="mt-5 font-serif text-2xl">{title}</h2><p className="mt-3 text-sm leading-6 text-espresso/60">{detail}</p>
                  </button>
                )
              })}
            </div>
            <div className="mt-8 rounded-2xl border border-gold/20 bg-white p-6"><h2 className="font-semibold">What this setting does not change</h2><p className="mt-2 text-sm leading-6 text-espresso/60">It does not publish planner accounts, grant planner authority, alter guest records, change billing or transfer ownership. It only controls delivery of the wedding site and its public-content APIs.</p></div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-espresso/55">Current saved setting: <strong>{saved.replace('_', ' ')}</strong></p><Button onClick={() => void save()} disabled={busy || privacy === saved} className="bg-espresso text-champagne">{busy ? <Loader2 className="size-4 animate-spin" /> : null}Save privacy</Button></div>
          </>
        )}
      </section>
    </main>
  )
}
