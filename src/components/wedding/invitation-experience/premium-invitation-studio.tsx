'use client'

import { useMemo, useState } from 'react'
import { Check, Monitor, Save, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DigitalInvitationCard, type DigitalInvitationCardData } from '@/components/wedding/digital-invitation-card'
import { PremiumInvitationExperience } from '@/components/wedding/invitation-experience/premium-invitation-experience'
import {
  INVITATION_CARD_STYLES,
  type InvitationCardStyle,
} from '@/lib/digital-invitation-card'

export function PremiumInvitationStudio({
  data,
  style,
  message,
  deadline,
  saved,
  busy,
  onStyleChange,
  onMessageChange,
  onDeadlineChange,
  onSave,
}: {
  data: DigitalInvitationCardData
  style: InvitationCardStyle
  message: string
  deadline: string
  saved: boolean
  busy: boolean
  onStyleChange: (style: InvitationCardStyle) => void
  onMessageChange: (message: string) => void
  onDeadlineChange: (deadline: string) => void
  onSave: () => void
}) {
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile')
  const [reducedMotion, setReducedMotion] = useState(false)
  const [previewGuest, setPreviewGuest] = useState('Alex Morgan')
  const selected = INVITATION_CARD_STYLES.find((item) => item.id === style) ?? INVITATION_CARD_STYLES[0]
  const previewData = useMemo(
    () => ({ ...data, guestName: previewGuest.trim() || 'Invited guest', message, rsvpDeadline: deadline || null }),
    [data, deadline, message, previewGuest],
  )

  return (
    <section className="mt-7 overflow-hidden rounded-[2rem] border border-gold/20 bg-champagne/50" aria-labelledby="premium-card-studio-heading">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-gold/15 p-4 sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-muted">Invitation studio</p>
          <h3 id="premium-card-studio-heading" className="mt-1 font-serif text-2xl sm:text-3xl">Choose how your invitation comes to life</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-espresso/55">Guests receive a personalised interactive invitation. The selected design controls the opening motion, atmosphere and visual language without changing RSVP security.</p>
        </div>
        <Button type="button" onClick={onSave} disabled={busy} className="bg-gold text-espresso hover:bg-gold-light">
          <Save className={`size-4 ${busy ? 'animate-pulse' : ''}`} />
          Save card design
        </Button>
      </div>

      {saved && (
        <p className="mx-4 mt-4 flex items-center gap-2 rounded-xl border border-sage/30 bg-sage/10 p-3 text-sm sm:mx-6">
          <Check className="size-4" /> Invitation experience saved. New personal links and QR values use this design.
        </p>
      )}

      <div className="grid gap-0 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="border-b border-gold/15 p-4 xl:border-b-0 xl:border-r sm:p-5" aria-label="Invitation design library">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-muted">Premium collection</p>
              <p className="mt-1 text-xs text-espresso/50">{INVITATION_CARD_STYLES.length} experiences</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
            {INVITATION_CARD_STYLES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                data-testid={`invitation-style-${theme.id}`}
                aria-pressed={style === theme.id}
                onClick={() => onStyleChange(theme.id)}
                className={`group rounded-2xl border p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${style === theme.id ? 'border-gold bg-white shadow-md ring-2 ring-gold/25' : 'border-gold/15 bg-white/55 hover:border-gold/45 hover:bg-white'}`}
              >
                <DigitalInvitationCard data={{ ...data, guestName: null, message: null, rsvpDeadline: null }} style={theme.id} compact />
                <span className="mt-2 block truncate px-1 text-[11px] font-semibold text-espresso">{theme.name}</span>
                <span className="mt-0.5 block px-1 pb-1 text-[9px] uppercase tracking-[0.12em] text-espresso/40">{theme.motion.replaceAll('-', ' ')}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-muted">Interactive guest preview</p>
              <h4 className="mt-1 font-serif text-2xl">{selected.name}</h4>
              <p className="mt-1 max-w-xl text-xs leading-5 text-espresso/50">{selected.description}</p>
            </div>
            <div className="flex rounded-xl border border-gold/20 bg-white p-1" aria-label="Preview device">
              <button type="button" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')} className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-medium ${device === 'mobile' ? 'bg-espresso text-white' : 'text-espresso/60'}`}>
                <Smartphone className="size-4" /> Mobile
              </button>
              <button type="button" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')} className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-medium ${device === 'desktop' ? 'bg-espresso text-white' : 'text-espresso/60'}`}>
                <Monitor className="size-4" /> Desktop
              </button>
            </div>
          </div>

          <div className={`mx-auto mt-5 overflow-hidden rounded-[1.5rem] border border-black/10 bg-black/5 shadow-inner transition-all ${device === 'mobile' ? 'max-w-[430px]' : 'max-w-[1100px]'}`} data-testid="invitation-preview-frame" data-preview-device={device}>
            <PremiumInvitationExperience
              key={`${style}-${device}-${reducedMotion}-${previewGuest}`}
              data={previewData}
              style={style}
              previewMode
              previewDevice={device}
              reducedMotionOverride={reducedMotion}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
            <div className="space-y-2">
              <Label htmlFor="invitation-card-message">Invitation message</Label>
              <Textarea id="invitation-card-message" value={message} maxLength={500} onChange={(event) => onMessageChange(event.target.value)} placeholder="Add a personal welcome shown on every digital invitation." />
              <p className="text-right text-[10px] text-espresso/45">{message.length}/500</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invitation-preview-guest">Preview guest</Label>
                <Input id="invitation-preview-guest" value={previewGuest} maxLength={80} onChange={(event) => setPreviewGuest(event.target.value)} />
                <p className="text-[10px] leading-4 text-espresso/45">Preview only. Sent invitations use the real guest record.</p>
              </div>
              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-gold/20 bg-white px-3 py-2 text-xs">
                <span><strong className="block text-espresso">Reduced motion</strong><span className="text-espresso/45">Preview the accessible reveal</span></span>
                <input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} className="size-4 accent-espresso" />
              </label>
            </div>
          </div>

          <div className="mt-4 max-w-[15rem] space-y-2">
            <Label htmlFor="invitation-rsvp-deadline">RSVP deadline</Label>
            <Input id="invitation-rsvp-deadline" type="date" value={deadline} max={String(data.date).slice(0, 10)} onChange={(event) => onDeadlineChange(event.target.value)} />
            <p className="text-[10px] leading-4 text-espresso/45">Optional. It cannot be later than the wedding date.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
