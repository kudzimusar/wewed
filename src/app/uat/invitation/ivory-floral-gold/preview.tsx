'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { IvoryFloralGoldTriFold, type IvoryInvitationView } from '@/components/wedding/invitation-experience/ivory-floral-gold-trifold'

const CHARITY_KUDZIE_UAT_DATA = {
  title: 'Charity & Kudzie',
  monogram: 'C · S',
  tagline: 'Your presence will make our day complete.',
  date: '2026-12-23T00:00:00.000Z',
  venue: 'Imba Manor',
  venueAddress: '1 Worplestone Way',
  venueCity: 'Glen Lorne, Harare',
  venueCountry: 'Zimbabwe',
  venueMapUrl: 'https://www.google.com/maps/search/?api=1&query=Imba%20Manor%2C%201%20Worplestone%20Way%2C%20Glen%20Lorne%2C%20Harare%2C%20Zimbabwe',
  guestName: null,
  message: 'Request the pleasure of your company as we celebrate our marriage.',
  rsvpDeadline: null,
  primaryColor: '#b3833f',
  accentColor: '#d6b77c',
  backgroundColor: '#fbf5e9',
} as const

export function IvoryFloralGoldUatPreview() {
  const [open, setOpen] = useState(false)
  const [previewView, setPreviewView] = useState<IvoryInvitationView | undefined>()
  const [reference, setReference] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [run, setRun] = useState(0)
  useEffect(() => { const media=window.matchMedia('(prefers-reduced-motion: reduce)');const sync=()=>setReducedMotion(media.matches);sync();media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync) }, [])
  const [rsvpPreviewOpen, setRsvpPreviewOpen] = useState(false)

  useEffect(() => {
    const handler = () => setRsvpPreviewOpen(true)
    window.addEventListener('wewed:open-premium-rsvp', handler)
    return () => window.removeEventListener('wewed:open-premium-rsvp', handler)
  }, [])

  return (
    <main
      data-testid="ivory-uat-preview"
      data-personal-invitation="1"
      className="relative flex min-h-svh w-full flex-col items-center gap-10 overflow-x-hidden bg-[radial-gradient(circle_at_50%_24%,#fffaf1_0%,#eee2d0_52%,#d9c6ab_100%)] py-3"
    >
      <nav aria-label="UAT artwork controls" className="flex max-w-full flex-wrap justify-center gap-2 text-xs text-[#70501f]">
        {(['closed','opening','open','details'] as const).map(state=><button className="border p-2" key={state} onClick={()=>{setPreviewView(state);setRun(v=>v+1)}}>{state==='opening'?'Freeze / midpoint':state==='open'?'Fully opened':state==='details'?'Interactive':'Closed'}</button>)}
        <button className="border p-2" onClick={()=>{setPreviewView(undefined);setOpen(true);setRun(v=>v+1)}}>Play opening</button>
        <button className="border p-2" aria-pressed={reference} onClick={()=>setReference(v=>!v)}>Reference / live</button>
      </nav>
      {reference ? <div style={{width:'min(100%,430px,46.153846svh)',aspectRatio:'9/19.5',position:'relative'}}><img alt="Approved artwork reference" src={'/invitation-art/ivory/'+(previewView || 'closed')+'-master.webp'} style={{width:'100%',height:'100%'}} /></div> : <IvoryFloralGoldTriFold
        key={run}
        previewView={previewView}
        freezeOpening={previewView==='opening'}
        data={CHARITY_KUDZIE_UAT_DATA}
        open={open}
        reducedMotion={reducedMotion}
        onOpen={() => {setPreviewView(undefined);setOpen(true)}}
        previewMode
      />}

      <section
        id="registry"
        data-registry-configured="true"
        data-testid="uat-registry-preview"
        className="mx-auto mb-10 w-[min(92vw,410px)] rounded-[1.3rem] border border-[#b88d50]/35 bg-[#fffaf2]/90 p-6 text-center text-[#604a36] shadow-[0_16px_38px_rgba(77,54,31,.12)]"
      >
        <p className="text-[9px] font-semibold uppercase tracking-[0.26em] text-[#9a6d28]">UAT contribution destination</p>
        <h2 className="mt-3 font-serif text-2xl italic text-[#8f672c]">Gift / Contributions</h2>
        <p className="mt-3 text-xs leading-5 text-[#75604d]">
          This preview confirms where the invitation CTA lands. Final guest invitations use the wedding&apos;s configured Wewed contribution or registry information and hide this action when nothing is configured.
        </p>
      </section>

      {rsvpPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/35 p-3 backdrop-blur-[2px] sm:items-center">
          <section
            data-testid="uat-rsvp-preview"
            className="relative w-full max-w-md rounded-[1.5rem] border border-[#b88d50]/40 bg-[#fffaf2] p-6 text-[#554331] shadow-[0_28px_80px_rgba(41,27,15,.30)]"
          >
            <button
              type="button"
              aria-label="Close RSVP preview"
              onClick={() => setRsvpPreviewOpen(false)}
              className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full border border-[#b88d50]/35 bg-white/70"
            >
              <X className="size-4" />
            </button>
            <CheckCircle2 className="size-6 text-[#9a6d28]" />
            <p className="mt-4 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#9a6d28]">Secure RSVP preview</p>
            <h2 className="mt-2 font-serif text-3xl italic text-[#8f672c]">Your private RSVP</h2>
            <p className="mt-3 text-sm leading-6 text-[#75604d]">
              In the real personal invitation this opens the existing guest-session RSVP form for the invited guest, including attendance, meal choice, plus-one, children, dietary notes and a message to the couple.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#b88d50]/30 bg-white/60 px-4 py-3 text-center text-xs">Joyfully accept</div>
              <div className="rounded-xl border border-[#b88d50]/30 bg-white/60 px-4 py-3 text-center text-xs">Regretfully decline</div>
            </div>
            <p className="mt-4 text-[10px] leading-4 text-[#876f5a]">UAT only — this preview does not save an RSVP.</p>
          </section>
        </div>
      )}
    </main>
  )
}
