'use client'

import * as React from 'react'
import { motion, type Variants } from 'framer-motion'
import {
  Star,
  BookOpen,
  Utensils,
  Shirt,
  MessageSquare,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import type { BridalPartyMember } from '@/lib/bridal-party-data'
import { BridalProfileModal } from '@/components/wedding/bridal-profile-modal'
import { SectionEyebrow } from '@/components/wedding/section-eyebrow'
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider'
import { compactWeddingDate, coupleNames } from '@/lib/wedding-template-defaults'

interface CulturalEntry {
  id: string
  icon: React.ReactNode
  title: string
  content: string
}

const STARTER_PARTY: BridalPartyMember[] = [
  {
    id: 'starter-person-1',
    name: 'Example Wedding Party Member',
    role: 'Maid of Honour / Best Person',
    side: 'bride',
    initials: 'EP',
    avatarColor: 'from-clay/30 via-clay/15 to-plum/20',
    bio: 'Example: introduce this person in two or three warm sentences so guests know why they are important to your story.',
    relationshipToCouple: 'Example: childhood friend, sibling, cousin or chosen family',
    likes: ['Add a hobby', 'Add a favourite food', 'Add a fun fact'],
    favoriteMemory: 'Example: add one short memory this person shares with the couple.',
    favoriteSong: 'Example: add their dance-floor song if you would like.',
    quote: 'Example: add a short message or toast to the couple.',
  },
  {
    id: 'starter-person-2',
    name: 'Example Wedding Party Member',
    role: 'Best Man / Best Person',
    side: 'groom',
    initials: 'EP',
    avatarColor: 'from-sage/30 via-sage/15 to-espresso/20',
    bio: 'Example: use this public profile for a person who is happy to be introduced to wedding guests.',
    relationshipToCouple: 'Example: sibling, university friend, colleague or chosen family',
    likes: ['Add a hobby', 'Add a favourite place', 'Add a fun fact'],
    favoriteMemory: 'Example: add one moment that captures your friendship.',
    favoriteSong: 'Example: add their dance-floor song if you would like.',
    quote: 'Example: add a short message or toast to the couple.',
  },
]

const STARTER_GUIDE = [
  {
    title: 'Wedding Traditions',
    content: 'Example: explain any family, religious or cultural traditions guests may see during the celebration.',
  },
  {
    title: 'What to Wear',
    content: 'Example: add the dress code, colours, cultural attire, footwear or weather guidance guests should know.',
  },
  {
    title: 'Food & Hospitality',
    content: 'Example: tell guests what kind of meal to expect and remind them to share allergies through RSVP.',
  },
  {
    title: 'Useful Notes',
    content: 'Example: add greetings, etiquette, accessibility guidance or anything that will help guests feel included.',
  },
]

const GUIDE_ICONS = [BookOpen, Shirt, Utensils, MessageSquare]

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function partyMemberFromRow(
  value: string,
  metadata: Record<string, unknown>,
  index: number,
): BridalPartyMember {
  const side = metadata.side === 'groom' || metadata.side === 'family' ? metadata.side : 'bride'
  const initials = typeof metadata.initials === 'string'
    ? metadata.initials
    : value.split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  return {
    id: typeof metadata.id === 'string' ? metadata.id : `party-${index}`,
    name: value,
    role: typeof metadata.role === 'string' ? metadata.role : 'Wedding Party',
    side,
    initials: initials || 'WP',
    avatarColor: typeof metadata.avatarColor === 'string' ? metadata.avatarColor : 'from-gold/25 via-clay/15 to-plum/20',
    bio: typeof metadata.bio === 'string' ? metadata.bio : 'A cherished person standing beside the couple.',
    relationshipToCouple: typeof metadata.relationshipToCouple === 'string' ? metadata.relationshipToCouple : 'A cherished member of the wedding party',
    likes: strings(metadata.likes),
    favoriteMemory: typeof metadata.favoriteMemory === 'string' ? metadata.favoriteMemory : '',
    favoriteSong: typeof metadata.favoriteSong === 'string' ? metadata.favoriteSong : '',
    quote: typeof metadata.quote === 'string' ? metadata.quote : '',
    socialHandle: typeof metadata.socialHandle === 'string' ? metadata.socialHandle : undefined,
    isKid: metadata.isKid === true,
    kidFunFact: typeof metadata.kidFunFact === 'string' ? metadata.kidFunFact : undefined,
  }
}

function sideBadgeLabel(side: BridalPartyMember['side'], partner1: string, partner2: string): string {
  if (side === 'bride') return `${partner1}'s Side`
  if (side === 'groom') return `${partner2}'s Side`
  return 'Our Family'
}

function sideAvatarClass(member: BridalPartyMember): string {
  if (member.isKid) return 'bg-gold/20 text-gold'
  if (member.side === 'bride') return 'bg-clay/15 text-clay'
  if (member.side === 'groom') return 'bg-sage/15 text-sage'
  return 'bg-gold/20 text-gold'
}

function sideBadgeClass(member: BridalPartyMember): string {
  if (member.side === 'bride') return 'border-clay/30 text-clay'
  if (member.side === 'groom') return 'border-sage/30 text-sage'
  return 'border-gold/30 text-gold'
}

export function Guests() {
  const ctx = useWeddingContextSafe()
  const wedding = ctx?.wedding
  const partner1 = wedding?.couple.partner1 || 'Partner One'
  const partner2 = wedding?.couple.partner2 || 'Partner Two'
  const partyRows = ctx?.getOrdered('guests', 'party-') ?? []
  const party = partyRows.length > 0
    ? partyRows.map((row, index) => partyMemberFromRow(row.value, row.metadata, index))
    : STARTER_PARTY
  const guideRows = ctx?.getOrdered('guests', 'guide-') ?? []
  const guide: CulturalEntry[] = (guideRows.length > 0
    ? guideRows.map((row) => ({
        title: row.value,
        content: typeof row.metadata.content === 'string' ? row.metadata.content : '',
      }))
    : STARTER_GUIDE
  ).map((entry, index) => {
    const Icon = GUIDE_ICONS[index % GUIDE_ICONS.length]
    return { id: `guide-${index}`, icon: <Icon className="size-4 text-gold" />, ...entry }
  })

  const heading = ctx?.getContent('guests', 'heading', 'The Wedding Party') ?? 'The Wedding Party'
  const subtitle = ctx?.getContent('guests', 'subtitle', 'The cherished people standing beside us on our day.') ?? 'The cherished people standing beside us on our day.'
  const guideHeading = ctx?.getContent('guests', 'guideHeading', 'Guest Guide') ?? 'Guest Guide'
  const guideSubtitle = ctx?.getContent('guests', 'guideSubtitle', 'A few notes to help everyone feel at home in the celebration.') ?? 'A few notes to help everyone feel at home in the celebration.'
  const footerMark = [wedding?.monogram || coupleNames(wedding), compactWeddingDate(wedding?.date)].filter(Boolean).join(' · ')

  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null)
  const [modalOpen, setModalOpen] = React.useState(false)
  const selectedMember = selectedIndex !== null ? party[selectedIndex] ?? null : null

  const handleOpen = (index: number) => {
    setSelectedIndex(index)
    setModalOpen(true)
  }

  const handlePrev = React.useCallback(() => {
    setSelectedIndex((curr) => curr === null ? 0 : (curr - 1 + party.length) % party.length)
  }, [party.length])
  const handleNext = React.useCallback(() => {
    setSelectedIndex((curr) => curr === null ? 0 : (curr + 1) % party.length)
  }, [party.length])

  return (
    <section id="guests" data-classic-section="wedding-party" className="wewed-section py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <motion.div className="mb-16 text-center" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 0.7 }}>
          <SectionEyebrow>Who&rsquo;s Who</SectionEyebrow>
          <h2 className="wewed-heading wewed-heading-accent text-4xl text-espresso md:text-5xl">{heading}</h2>
          <p className="mt-4 font-sans text-muted-foreground">{subtitle}</p>
          <p className="mt-1 font-sans text-xs uppercase tracking-[0.18em] text-gold-muted">Tap any public profile to learn their story</p>
        </motion.div>

        <div className="mb-16 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
          {party.map((member, i) => (
            <motion.div key={`${member.id}-${i}`} custom={i} variants={cardVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-30px' }}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card
                    role="button"
                    tabIndex={0}
                    aria-label={`View ${member.name}'s public wedding-party profile`}
                    onClick={() => handleOpen(i)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleOpen(i)
                      }
                    }}
                    className={`wewed-photo-frame group relative cursor-pointer text-center outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-champagne ${
                      member.isKid
                        ? 'border-2 border-gold/50 bg-champagne shadow-md hover:border-gold hover:ring-2 hover:ring-gold/40'
                        : 'border-gold/15 bg-champagne hover:border-gold/40 hover:ring-2 hover:ring-gold/40'
                    }`}
                  >
                    <CardContent className="flex flex-col items-center gap-3 pb-4 pt-6">
                      <Avatar
                        className={`size-16 shadow-md transition-transform duration-300 group-hover:scale-105 ${
                          member.isKid ? 'ring-2 ring-gold/60 ring-offset-2 ring-offset-champagne' : ''
                        }`}
                      >
                        <AvatarFallback className={`wewed-heading text-lg ${sideAvatarClass(member)}`}>
                          {member.initials}
                        </AvatarFallback>
                      </Avatar>

                      <div className="space-y-1 text-center">
                        <p className="wewed-heading text-lg text-espresso">{member.name}</p>
                        <p className="font-sans text-xs text-muted-foreground">{member.role}</p>
                      </div>

                      {member.isKid ? (
                        <Badge className="border-gold/40 bg-gold/15 font-sans text-xs text-gold"><Star className="size-3" />Our Little Stars</Badge>
                      ) : (
                        <Badge variant="outline" className={`font-sans text-xs ${sideBadgeClass(member)}`}>
                          {sideBadgeLabel(member.side, partner1, partner2)}
                        </Badge>
                      )}

                      <span className="mt-1 inline-flex items-center gap-1 font-sans text-[0.65rem] uppercase tracking-[0.15em] text-gold-muted opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        Learn more<ChevronRight className="size-3" />
                      </span>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="top" className="border border-gold/30 bg-espresso text-champagne">
                  Public profile for {member.name}
                </TooltipContent>
              </Tooltip>
            </motion.div>
          ))}
        </div>

        {partyRows.length === 0 && (
          <p className="mx-auto mb-12 max-w-2xl rounded-xl border border-dashed border-gold/30 bg-champagne/40 p-4 text-center text-xs leading-5 text-espresso/55">
            Example public wedding-party profiles are shown. Private guest-list records are never used here; the couple can publish only the people and details they want guests to see.
          </p>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.6 }}>
          <div className="mb-8 text-center">
            <h3 className="wewed-heading text-2xl text-espresso md:text-3xl">{guideHeading}</h3>
            <p className="mt-2 font-sans text-sm text-muted-foreground">{guideSubtitle}</p>
          </div>
          <Card className="mx-auto max-w-3xl border-gold/20 bg-champagne shadow-md">
            <CardContent className="p-0">
              <Accordion type="single" collapsible className="w-full">
                {guide.map((entry) => (
                  <AccordionItem key={entry.id} value={entry.id} className="border-gold/15 px-6">
                    <AccordionTrigger className="font-sans text-sm font-medium text-espresso hover:text-gold hover:no-underline">
                      <span className="flex items-center gap-2">{entry.icon}{entry.title}</span>
                    </AccordionTrigger>
                    <AccordionContent className="font-sans text-sm leading-relaxed text-muted-foreground">{entry.content}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div className="mt-12 text-center" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.3 }}>
          <div className="wewed-divider mx-auto w-32" />
          {footerMark && <p className="mt-6 wewed-monogram text-xs tracking-widest">{footerMark}</p>}
        </motion.div>
      </div>

      <BridalProfileModal member={selectedMember} isOpen={modalOpen} onClose={() => setModalOpen(false)} onPrev={handlePrev} onNext={handleNext} />
    </section>
  )
}
