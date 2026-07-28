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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  BRIDAL_PARTY,
  getNextBridalIndex,
  getPrevBridalIndex,
  type BridalPartyMember,
} from '@/lib/bridal-party-data'
import { BridalProfileModal } from '@/components/wedding/bridal-profile-modal'
import { SectionEyebrow } from '@/components/wedding/section-eyebrow'

/* ── Cultural Guide Data ── */
interface CulturalEntry {
  id: string
  icon: React.ReactNode
  title: string
  content: string
}

const culturalGuide: CulturalEntry[] = [
  {
    id: 'traditions',
    icon: <BookOpen className="size-4 text-gold" />,
    title: 'Shona Wedding Traditions',
    content:
      'A traditional Shona wedding includes the roora (bridewealth) process, where the groom\'s family presents gifts to the bride\'s family as a sign of respect and gratitude. The magumo (gifts) are negotiated between families and symbolise the joining of two families, not just two people. The ceremony often includes traditional dancing, singing, and the sharing of food as a communal celebration of love and unity.',
  },
  {
    id: 'dress',
    icon: <Shirt className="size-4 text-gold" />,
    title: 'What to Wear',
    content:
      'The dress code is Formal / Black Tie Optional. Traditional Zimbabwean attire is warmly welcomed — for women, this might include elegant African-print dresses or wraps; for men, a smart safari suit or traditional shirt. Harare weddings tend to be stylish affairs — think bold colours, beautiful fabrics, and expressive personal style. Comfortable shoes are recommended as there will be dancing!',
  },
  {
    id: 'cuisine',
    icon: <Utensils className="size-4 text-gold" />,
    title: 'Zimbabwean Cuisine',
    content:
      'The menu will feature a blend of traditional and contemporary dishes. Expect sadza (maize meal porridge, a Zimbabwean staple) served with nyama (meat — beef, chicken, or goat), madora (dried caterpillars, a local delicacy), muriwo (leafy green vegetables), and peanut butter dishes. Vegetarian and international options will also be available. The wedding cake is a centrepiece — often a rich fruit cake symbolising prosperity and fertility.',
  },
  {
    id: 'phrases',
    icon: <MessageSquare className="size-4 text-gold" />,
    title: 'Useful Shona Phrases',
    content:
      'Mangwanani — Good morning | Masikati — Good afternoon | Maita basa — Thank you for the work (a deep expression of gratitude) | Makorokoto — Congratulations | Munhu wese munhu — Every person is a person (unity) | Tine base — We have work/a role (encouragement) | Kumbirai ruregerero — Please forgive me | Ndatenda — Thank you. Don\'t worry about perfect pronunciation — your effort to try will be deeply appreciated!',
  },
]

/* ── Card Animation Variants ── */
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.08,
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
}

/* ── Side badge helper (uses new 'bride' | 'groom' | 'family' values) ── */
function sideBadgeLabel(side: BridalPartyMember['side']): string {
  if (side === 'bride') return "Charity's Side"
  if (side === 'groom') return "Kudzie's Side"
  return 'Our Family'
}

/* ── Main Component ── */
export function Guests() {
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null)
  const [modalOpen, setModalOpen] = React.useState(false)

  const handleOpen = (index: number) => {
    setSelectedIndex(index)
    setModalOpen(true)
  }

  const handleClose = () => {
    setModalOpen(false)
  }

  const handlePrev = React.useCallback(() => {
    setSelectedIndex((curr) =>
      curr === null ? 0 : getPrevBridalIndex(curr),
    )
  }, [])

  const handleNext = React.useCallback(() => {
    setSelectedIndex((curr) =>
      curr === null ? 0 : getNextBridalIndex(curr),
    )
  }, [])

  const selectedMember =
    selectedIndex !== null ? BRIDAL_PARTY[selectedIndex] ?? null : null

  return (
    <section id="guests" className="wewed-section py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-4">
        {/* Header */}
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
        >
          <SectionEyebrow>Who&rsquo;s Who</SectionEyebrow>
          <h2 className="wewed-heading wewed-heading-accent text-4xl md:text-5xl text-espresso">
            The Wedding Party
          </h2>
          <p className="mt-4 font-sans text-muted-foreground">
            The cherished people standing beside us on our day.
          </p>
          <p className="mt-1 font-sans text-xs uppercase tracking-[0.18em] text-gold-muted">
            Tap any face to learn their story
          </p>
        </motion.div>

        {/* Party Grid */}
        <div className="mb-16 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
          {BRIDAL_PARTY.map((member, i) => (
            <motion.div
              key={member.id}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-30px' }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card
                    role="button"
                    tabIndex={0}
                    aria-label={`View ${member.name}'s profile`}
                    onClick={() => handleOpen(i)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleOpen(i)
                      }
                    }}
                    className={`wewed-photo-frame group relative cursor-pointer text-center outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-champagne ${
                      member.isKid
                        ? 'border-2 border-gold/50 bg-champagne shadow-md hover:border-gold hover:ring-2 hover:ring-gold/40'
                        : 'border-gold/15 bg-champagne hover:border-gold/40 hover:ring-2 hover:ring-gold/40'
                    }`}
                  >
                    <CardContent className="flex flex-col items-center gap-3 pt-6 pb-4">
                      {/* Avatar */}
                      <Avatar
                        className={`size-16 shadow-md transition-transform duration-300 group-hover:scale-105 ${
                          member.isKid
                            ? 'ring-2 ring-gold/60 ring-offset-2 ring-offset-champagne'
                            : ''
                        }`}
                      >
                        <AvatarFallback
                          className={`wewed-heading text-lg ${
                            member.isKid
                              ? 'bg-gold/20 text-gold'
                              : member.side === 'bride'
                                ? 'bg-clay/15 text-clay'
                                : member.side === 'groom'
                                  ? 'bg-sage/15 text-sage'
                                  : 'bg-gold/20 text-gold'
                          }`}
                        >
                          {member.initials}
                        </AvatarFallback>
                      </Avatar>

                      {/* Name */}
                      <div className="space-y-1 text-center">
                        <p className="wewed-heading text-lg text-espresso">
                          {member.name}
                        </p>
                        <p className="font-sans text-xs text-muted-foreground">
                          {member.role}
                        </p>
                      </div>

                      {/* Side Badge */}
                      {member.isKid ? (
                        <Badge className="border-gold/40 bg-gold/15 font-sans text-xs text-gold">
                          <Star className="size-3" />
                          Our Little Stars
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className={`font-sans text-xs ${
                            member.side === 'bride'
                              ? 'border-clay/30 text-clay'
                              : member.side === 'groom'
                                ? 'border-sage/30 text-sage'
                                : 'border-gold/30 text-gold'
                          }`}
                        >
                          {sideBadgeLabel(member.side)}
                        </Badge>
                      )}

                      {/* "Learn more" hint — revealed on hover */}
                      <span className="mt-1 inline-flex items-center gap-1 font-sans text-[0.65rem] uppercase tracking-[0.15em] text-gold-muted opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        Learn more
                        <ChevronRight className="size-3" />
                      </span>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="border border-gold/30 bg-espresso text-champagne"
                >
                  Click to learn more about {member.name}
                </TooltipContent>
              </Tooltip>
            </motion.div>
          ))}
        </div>

        {/* Cultural Guide Accordion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-8 text-center">
            <h3 className="wewed-heading text-2xl md:text-3xl text-espresso">
              Cultural Guide
            </h3>
            <p className="mt-2 font-sans text-sm text-muted-foreground">
              For our guests joining from near and far — a warm introduction to Zimbabwean wedding traditions.
            </p>
          </div>

          <Card className="border-gold/20 bg-champagne shadow-md max-w-3xl mx-auto">
            <CardContent className="p-0">
              <Accordion type="single" collapsible className="w-full">
                {culturalGuide.map((entry) => (
                  <AccordionItem
                    key={entry.id}
                    value={entry.id}
                    className="border-gold/15 px-6"
                  >
                    <AccordionTrigger className="font-sans text-sm font-medium text-espresso hover:no-underline hover:text-gold">
                      <span className="flex items-center gap-2">
                        {entry.icon}
                        {entry.title}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="font-sans text-sm text-muted-foreground leading-relaxed">
                      {entry.content}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer monogram */}
        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="wewed-divider w-32 mx-auto" />
          <p className="mt-6 wewed-monogram text-xs tracking-widest">
            C&amp;K &middot; 23.12.26
          </p>
        </motion.div>
      </div>

      {/* ── Bridal Profile Modal ── */}
      <BridalProfileModal
        member={selectedMember}
        isOpen={modalOpen}
        onClose={handleClose}
        onPrev={handlePrev}
        onNext={handleNext}
      />
    </section>
  )
}
