'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Heart,
  Music,
  Quote,
  Star,
  X,
  ChevronLeft,
  ChevronRight,
  AtSign,
  Sparkles,
  Users,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { BridalPartyMember } from '@/lib/bridal-party-data'

/* ── Props ── */
export interface BridalProfileModalProps {
  member: BridalPartyMember | null
  isOpen: boolean
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}

/* ── Side badge label helper ── */
function sideLabel(side: BridalPartyMember['side']): string {
  switch (side) {
    case 'bride':
      return "Charity's Side"
    case 'groom':
      return "Kudzie's Side"
    case 'family':
      return 'Our Family'
  }
}

function sideBadgeClasses(side: BridalPartyMember['side']): string {
  switch (side) {
    case 'bride':
      return 'border-clay/40 text-clay bg-clay/10'
    case 'groom':
      return 'border-sage/40 text-sage bg-sage/10'
    case 'family':
      return 'border-gold/50 text-gold bg-gold/10'
  }
}

/* ── Main Component ── */
export function BridalProfileModal({
  member,
  isOpen,
  onClose,
  onPrev,
  onNext,
}: BridalProfileModalProps) {
  // Keyboard navigation: arrow keys to move between members.
  // (Escape is handled by Radix Dialog automatically.)
  React.useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        onNext()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onPrev, onNext])

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[92vh] overflow-hidden rounded-2xl border-gold/30 bg-champagne p-0 shadow-2xl sm:max-w-2xl md:max-w-3xl"
      >
        {/* Accessible title + description (visually hidden, but read by screen readers) */}
        {member && (
          <>
            <DialogTitle className="sr-only">
              {member.name} — {member.role}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Profile of {member.name}, {member.role}. {member.bio}
            </DialogDescription>
          </>
        )}

        {/* ── Custom close button (top-right, espresso on champagne) ── */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close profile"
          className="absolute right-4 top-4 z-30 flex size-9 items-center justify-center rounded-full border border-gold/30 bg-champagne/80 text-espresso shadow-sm backdrop-blur-sm transition-all hover:bg-gold/15 hover:text-clay focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        >
          <X className="size-4" />
        </button>

        {/* ── Prev / Next nav (sits just under the close, vertically centered on desktop) ── */}
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous party member"
          className="absolute left-2 top-1/2 z-30 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-gold/30 bg-champagne/80 text-espresso shadow-sm backdrop-blur-sm transition-all hover:bg-gold/15 hover:text-clay focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 md:flex"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label="Next party member"
          className="absolute right-2 top-1/2 z-30 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-gold/30 bg-champagne/80 text-espresso shadow-sm backdrop-blur-sm transition-all hover:bg-gold/15 hover:text-clay focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 md:flex"
        >
          <ChevronRight className="size-5" />
        </button>

        {/* ── Body (animated when member changes) ── */}
        <div className="max-h-[92vh] overflow-y-auto wewed-scroll">
          <AnimatePresence mode="wait">
            {member && (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -8 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="grid grid-cols-1 gap-0 md:grid-cols-[200px_1fr]"
              >
                {/* ── LEFT / TOP: Avatar panel ── */}
                <div className="relative flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-ivory via-champagne to-gold/10 px-6 py-8 md:border-r border-gold/15">
                  {/* decorative gold ring behind avatar */}
                  <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(circle_at_50%_38%,rgba(191,155,95,0.18),transparent_60%)]" />

                  <div className="relative">
                    {/* Avatar — large circle with gradient + serif initials */}
                    <div
                      className={cn(
                        'flex size-28 items-center justify-center rounded-full bg-gradient-to-br shadow-lg ring-1 ring-gold/30 md:size-32',
                        member.avatarColor,
                      )}
                    >
                      <span className="wewed-heading text-4xl text-espresso md:text-5xl drop-shadow-sm">
                        {member.initials}
                      </span>
                    </div>

                    {/* Kids: star overlay on the avatar corner */}
                    {member.isKid && (
                      <div className="absolute -bottom-1 -right-1 flex size-10 items-center justify-center rounded-full bg-champagne shadow-md ring-2 ring-gold/40">
                        <Star className="size-5 fill-gold text-gold" />
                      </div>
                    )}
                  </div>

                  {/* Side / family badge under avatar */}
                  <Badge
                    variant="outline"
                    className={cn(
                      'mt-1 font-sans text-[0.7rem] uppercase tracking-wider',
                      sideBadgeClasses(member.side),
                    )}
                  >
                    {sideLabel(member.side)}
                  </Badge>

                  {/* Gold role badge */}
                  <div className="rounded-full bg-gradient-to-r from-gold-muted via-gold to-gold-light px-4 py-1 text-center shadow-sm">
                    <span className="font-sans text-xs font-medium uppercase tracking-wider text-espresso">
                      {member.role}
                    </span>
                  </div>
                </div>

                {/* ── RIGHT / BOTTOM: Content panel ── */}
                <div className="flex flex-col gap-5 px-5 py-6 md:px-7 md:py-7">
                  {/* Name */}
                  <div>
                    <h3 className="wewed-heading text-3xl text-espresso md:text-4xl">
                      {member.name}
                    </h3>
                    <p className="mt-1 font-sans text-xs uppercase tracking-[0.18em] text-gold-muted">
                      {member.role}
                    </p>
                  </div>

                  {/* Bio */}
                  <p className="font-sans text-sm leading-relaxed text-espresso/80">
                    {member.bio}
                  </p>

                  {/* Relationship to the couple */}
                  <div className="flex items-start gap-2 rounded-md border border-clay/20 bg-clay/5 px-3 py-2">
                    <Heart className="mt-0.5 size-4 shrink-0 fill-clay/30 text-clay" />
                    <p className="font-sans text-sm text-espresso/85">
                      <span className="font-medium text-clay">Relationship:</span>{' '}
                      {member.relationshipToCouple}
                    </p>
                  </div>

                  {/* Likes — chips with gold border */}
                  <div>
                    <p className="mb-2 font-sans text-[0.7rem] font-medium uppercase tracking-[0.18em] text-gold-muted">
                      Loves
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {member.likes.map((like) => (
                        <span
                          key={like}
                          className="rounded-full border border-gold/40 bg-gold/5 px-3 py-1 font-sans text-xs text-espresso/80 transition-colors hover:border-gold/70 hover:bg-gold/10"
                        >
                          {like}
                        </span>
                      ))}
                    </div>
                  </div>

                  <Separator className="bg-gold/20" />

                  {/* Favorite Memory — italic serif quote block with gold left border */}
                  <div className="border-l-2 border-gold/60 pl-4">
                    <p className="mb-1 font-sans text-[0.7rem] font-medium uppercase tracking-[0.18em] text-gold-muted">
                      Favorite Memory
                    </p>
                    <p className="font-serif text-base italic leading-relaxed text-espresso/85">
                      &ldquo;{member.favoriteMemory}&rdquo;
                    </p>
                  </div>

                  {/* Dance Floor Anthem */}
                  <div className="flex items-center gap-3 rounded-md border border-plum/20 bg-plum/5 px-3 py-2.5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-plum/15">
                      <Music className="size-4 text-plum" />
                    </div>
                    <div>
                      <p className="font-sans text-[0.7rem] font-medium uppercase tracking-[0.18em] text-plum/80">
                        Dance Floor Anthem
                      </p>
                      <p className="font-serif text-sm italic text-espresso/85">
                        {member.favoriteSong}
                      </p>
                    </div>
                  </div>

                  {/* A Word for the Couple — larger serif italic, plum accent */}
                  <div className="relative rounded-md bg-gradient-to-br from-plum/8 via-champagne to-gold/5 px-4 py-4">
                    <Quote className="absolute right-3 top-3 size-6 text-plum/20" />
                    <p className="mb-1 font-sans text-[0.7rem] font-medium uppercase tracking-[0.18em] text-plum/80">
                      A Word for the Couple
                    </p>
                    <p className="font-serif text-lg italic leading-relaxed text-plum md:text-xl">
                      &ldquo;{member.quote}&rdquo;
                    </p>
                  </div>

                  {/* Social handle OR kid fun fact */}
                  {member.isKid && member.kidFunFact ? (
                    <div className="flex items-start gap-3 rounded-md border border-gold/40 bg-gradient-to-r from-gold/10 to-clay/5 px-3 py-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold/20">
                        <Sparkles className="size-4 text-gold" />
                      </div>
                      <div>
                        <p className="font-sans text-[0.7rem] font-medium uppercase tracking-[0.18em] text-gold-muted">
                          Fun Fact
                        </p>
                        <p className="font-sans text-sm leading-relaxed text-espresso/85">
                          {member.kidFunFact}
                        </p>
                      </div>
                    </div>
                  ) : (
                    member.socialHandle && (
                      <div className="flex items-center gap-2">
                        <AtSign className="size-4 text-gold-muted" />
                        <span className="font-sans text-sm text-espresso/70">
                          {member.socialHandle}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Footer: prev/next on mobile (desktop uses side buttons) ── */}
        <div className="flex items-center justify-between gap-3 border-t border-gold/20 bg-champagne px-4 py-3 md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onPrev}
            className="font-sans text-xs text-espresso/70 hover:bg-gold/10 hover:text-clay"
          >
            <ChevronLeft className="size-4" />
            Prev
          </Button>
          <span className="flex items-center gap-1.5 font-sans text-[0.7rem] uppercase tracking-[0.15em] text-gold-muted">
            <Users className="size-3" />
            Tap arrows to browse
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onNext}
            className="font-sans text-xs text-espresso/70 hover:bg-gold/10 hover:text-clay"
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default BridalProfileModal
