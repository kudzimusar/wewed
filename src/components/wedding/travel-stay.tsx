'use client'

import { motion, type Variants } from 'framer-motion'
import { MapPin, Hotel, Info, Plane, Car, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SectionEyebrow } from '@/components/wedding/section-eyebrow'
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider'
import { weddingLocation } from '@/lib/wedding-template-defaults'

const EASE_T = [0.25, 0.46, 0.45, 0.94] as const
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: EASE_T },
  }),
}

interface HotelRow {
  name: string
  stars?: string
  location?: string
  price?: string
}

interface TipRow {
  label: string
  text: string
  color?: string
}

function metaString(meta: Record<string, unknown>, key: string, fallback = ''): string {
  return typeof meta[key] === 'string' ? String(meta[key]) : fallback
}

function tipDotClass(color?: string): string {
  if (color === 'clay') return 'bg-clay'
  if (color === 'sage') return 'bg-sage'
  if (color === 'plum') return 'bg-plum'
  return 'bg-gold'
}

export function TravelStay() {
  const ctx = useWeddingContextSafe()
  const wedding = ctx?.wedding
  const cards = ctx?.getOrdered('travel', 'card-') ?? []
  const getCard = (index: number) => cards.find((card) => card.index === index)
  const travelCard = getCard(0)
  const stayCard = getCard(1)
  const knowCard = getCard(2)

  const heading = ctx?.getContent('travel', 'heading', 'Travel & Stay') ?? 'Travel & Stay'
  const subtitle = ctx?.getContent(
    'travel',
    'subtitle',
    wedding
      ? `Everything guests need to plan their journey to ${wedding.venue}.`
      : 'Add travel, accommodation and arrival information for your guests.',
  ) ?? 'Add travel, accommodation and arrival information for your guests.'

  const travelMeta = travelCard?.metadata ?? {}
  const venueName = metaString(travelMeta, 'venue', wedding?.venue || 'Add your venue')
  const venueLocation = metaString(
    travelMeta,
    'location',
    wedding ? [wedding.venueCity, wedding.venueCountry].filter(Boolean).join(', ') : 'Add location',
  )
  const directions = metaString(
    travelMeta,
    'directions',
    'Example guidance: add the easiest route, landmarks, parking entrance and expected travel time.',
  )
  const airport = metaString(
    travelMeta,
    'airport',
    'Nearest airport / station — add the best arrival point for out-of-town guests.',
  )
  const airportNote = metaString(
    travelMeta,
    'airportNote',
    'Add approximate travel time from the arrival point to the venue.',
  )
  const shuttle = metaString(travelMeta, 'shuttle', 'Wedding transport')
  const shuttleNote = metaString(
    travelMeta,
    'shuttleNote',
    'Add shuttle, taxi, parking or pickup details when confirmed.',
  )

  const rawHotels = Array.isArray(stayCard?.metadata.hotels)
    ? stayCard?.metadata.hotels
    : []
  const hotels: HotelRow[] = rawHotels.length > 0
    ? rawHotels.filter((row): row is HotelRow => Boolean(row && typeof row === 'object' && 'name' in row))
    : [
        { name: 'Example Hotel One', stars: 'Hotel', location: 'Near the venue', price: 'Add rate' },
        { name: 'Example Guesthouse', stars: 'Guesthouse', location: 'Nearby area', price: 'Add rate' },
        { name: 'Example Self-Catering Stay', stars: 'Self-catering', location: 'Nearby area', price: 'Add rate' },
      ]
  const hotelNote = metaString(
    stayCard?.metadata ?? {},
    'note',
    'Example accommodation shown — replace this with verified nearby options, booking links and rates.',
  )

  const rawTips = Array.isArray(knowCard?.metadata.tips) ? knowCard?.metadata.tips : []
  const tips: TipRow[] = rawTips.length > 0
    ? rawTips.filter((row): row is TipRow => Boolean(row && typeof row === 'object' && 'label' in row && 'text' in row))
    : [
        { label: 'Dress Code', text: 'Formal — edit this to match your celebration.', color: 'clay' },
        { label: 'Weather', text: 'Add seasonal weather advice and anything guests should bring.', color: 'gold' },
        { label: 'Gifts', text: 'Add your preferred gift or registry guidance.', color: 'sage' },
        { label: 'Good to Know', text: 'Add cultural, accessibility, family or venue guidance here.', color: 'plum' },
      ]

  const mapUrl = wedding?.venueMapUrl || (wedding
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(weddingLocation(wedding))}`
    : '#venue')

  return (
    <section id="travel" data-classic-section="travel-stay" className="wewed-section py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
        >
          <SectionEyebrow>Getting There</SectionEyebrow>
          <h2 className="wewed-heading wewed-heading-accent text-4xl text-espresso md:text-5xl">{heading}</h2>
          <p className="mt-4 font-sans text-muted-foreground">{subtitle}</p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          <motion.div custom={0} variants={cardVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}>
            <Card className="h-full border-gold/20 bg-champagne shadow-md transition-shadow duration-300 hover:shadow-lg">
              <CardHeader className="items-center text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-gold/15">
                  <MapPin className="size-6 text-gold" strokeWidth={1.5} />
                </div>
                <CardTitle className="wewed-heading mt-2 text-2xl text-espresso">{travelCard?.value || 'Getting There'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 font-sans text-sm">
                <div className="space-y-1"><p className="font-medium text-espresso">{venueName}</p><p className="text-muted-foreground">{venueLocation}</p></div>
                <div className="space-y-2 rounded-lg border border-gold/15 bg-white/50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-espresso">Directions</p>
                  <p className="leading-relaxed text-muted-foreground">{directions}</p>
                  <Button variant="outline" size="sm" className="mt-2 border-gold/30 font-sans text-gold hover:bg-gold/10" asChild>
                    <a href={mapUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-3.5" /> Get Directions</a>
                  </Button>
                </div>
                <div className="flex items-start gap-3"><Plane className="mt-0.5 size-4 shrink-0 text-gold" /><div><p className="font-medium text-espresso">{airport}</p><p className="text-xs text-muted-foreground">{airportNote}</p></div></div>
                <div className="flex items-start gap-3"><Car className="mt-0.5 size-4 shrink-0 text-gold" /><div><p className="font-medium text-espresso">{shuttle}</p><p className="text-xs text-muted-foreground">{shuttleNote}</p></div></div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div custom={1} variants={cardVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}>
            <Card className="h-full border-gold/20 bg-champagne shadow-md transition-shadow duration-300 hover:shadow-lg">
              <CardHeader className="items-center text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-gold/15"><Hotel className="size-6 text-gold" strokeWidth={1.5} /></div>
                <CardTitle className="wewed-heading mt-2 text-2xl text-espresso">{stayCard?.value || 'Where to Stay'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 font-sans text-sm">
                {hotels.map((hotel, index) => (
                  <div key={`${hotel.name}-${index}`} className="flex items-start justify-between gap-3 rounded-lg border border-gold/15 bg-white/50 p-3 transition-colors hover:bg-white/80">
                    <div className="space-y-0.5">
                      <p className="font-medium text-espresso">{hotel.name}</p>
                      <p className="text-xs text-muted-foreground">{[hotel.stars, hotel.location].filter(Boolean).join(' · ')}</p>
                    </div>
                    {hotel.price && (
                      <div className="shrink-0 text-right">
                        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">from</span>
                        <span className="block font-medium text-gold">{hotel.price}</span>
                        {!/rate|add/i.test(hotel.price) && <span className="block text-[10px] text-muted-foreground">/night</span>}
                      </div>
                    )}
                  </div>
                ))}
                <p className="pt-2 text-center text-xs text-muted-foreground">{hotelNote}</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div custom={2} variants={cardVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}>
            <Card className="h-full border-gold/20 bg-champagne shadow-md transition-shadow duration-300 hover:shadow-lg">
              <CardHeader className="items-center text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-gold/15"><Info className="size-6 text-gold" strokeWidth={1.5} /></div>
                <CardTitle className="wewed-heading mt-2 text-2xl text-espresso">{knowCard?.value || 'What to Know'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 font-sans text-sm">
                {tips.map((tip, index) => (
                  <div key={`${tip.label}-${index}`} className="space-y-1.5">
                    <p className="flex items-center gap-2 font-medium text-espresso">
                      <span className={`inline-block size-2 rounded-full ${tipDotClass(tip.color)}`} />
                      {tip.label}
                    </p>
                    <p className="leading-relaxed text-muted-foreground">{tip.text}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
