'use client'

import { motion, type Variants } from 'framer-motion'
import { MapPin, Hotel, Info, Plane, Car, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SectionEyebrow } from '@/components/wedding/section-eyebrow'

const EASE_T = [0.25, 0.46, 0.45, 0.94] as const
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.15,
      duration: 0.6,
      ease: EASE_T,
    },
  }),
}

const hotels = [
  {
    name: 'Meikles Hotel',
    stars: '5-star',
    location: 'City center',
    price: '$180',
    link: '#',
  },
  {
    name: 'Rainbow Towers Hotel',
    stars: '4-star',
    location: 'Central Harare',
    price: '$120',
    link: '#',
  },
  {
    name: 'Crowne Plaza Harare',
    stars: '4-star',
    location: 'Borrowdale area',
    price: '$140',
    link: '#',
  },
  {
    name: 'Airbnbs in Borrowdale',
    stars: 'Self-catering',
    location: 'Borrowdale area',
    price: '$60',
    link: '#',
  },
]

export function TravelStay() {
  return (
    <section id="travel" className="wewed-section py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-4">
        {/* Header */}
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
        >
          <SectionEyebrow>Getting There</SectionEyebrow>
          <h2 className="wewed-heading wewed-heading-accent text-4xl md:text-5xl text-espresso">
            Travel &amp; Stay
          </h2>
          <p className="mt-4 font-sans text-muted-foreground">
            Everything you need to plan your journey to Imba Manor.
          </p>
        </motion.div>

        {/* Cards Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Getting There */}
          <motion.div
            custom={0}
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
          >
            <Card className="h-full border-gold/20 bg-champagne shadow-md transition-shadow duration-300 hover:shadow-lg">
              <CardHeader className="items-center text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-gold/15">
                  <MapPin className="size-6 text-gold" strokeWidth={1.5} />
                </div>
                <CardTitle className="wewed-heading text-2xl text-espresso mt-2">
                  Getting There
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 font-sans text-sm">
                {/* Venue Address */}
                <div className="space-y-1">
                  <p className="font-medium text-espresso">Imba Manor</p>
                  <p className="text-muted-foreground">Harare, Zimbabwe</p>
                </div>

                {/* Directions */}
                <div className="space-y-2 rounded-lg border border-gold/15 bg-white/50 p-3">
                  <p className="font-medium text-espresso text-xs uppercase tracking-wider">
                    Directions
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    From Harare city center, head northeast on Samora Machel Ave, then follow signs to Borrowdale. Imba Manor is approximately 20 minutes from the center.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 border-gold/30 text-gold hover:bg-gold/10 font-sans"
                    asChild
                  >
                    <a
                      href="https://maps.google.com/?q=Imba+Manor+Harare+Zimbabwe"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-3.5" />
                      Get Directions
                    </a>
                  </Button>
                </div>

                {/* Airport */}
                <div className="flex items-start gap-3">
                  <Plane className="mt-0.5 size-4 shrink-0 text-gold" />
                  <div>
                    <p className="font-medium text-espresso">Robert Gabriel Mugabe International Airport (HRE)</p>
                    <p className="text-muted-foreground text-xs">20 min drive to Imba Manor</p>
                  </div>
                </div>

                {/* Shuttle */}
                <div className="flex items-start gap-3">
                  <Car className="mt-0.5 size-4 shrink-0 text-gold" />
                  <div>
                    <p className="font-medium text-espresso">Complimentary Shuttle</p>
                    <p className="text-muted-foreground text-xs">From Meikles Hotel at 12:30 on the day</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Where to Stay */}
          <motion.div
            custom={1}
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
          >
            <Card className="h-full border-gold/20 bg-champagne shadow-md transition-shadow duration-300 hover:shadow-lg">
              <CardHeader className="items-center text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-gold/15">
                  <Hotel className="size-6 text-gold" strokeWidth={1.5} />
                </div>
                <CardTitle className="wewed-heading text-2xl text-espresso mt-2">
                  Where to Stay
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 font-sans text-sm">
                {hotels.map((hotel) => (
                  <div
                    key={hotel.name}
                    className="flex items-start justify-between gap-3 rounded-lg border border-gold/15 bg-white/50 p-3 transition-colors hover:bg-white/80"
                  >
                    <div className="space-y-0.5">
                      <p className="font-medium text-espresso">{hotel.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {hotel.stars} &middot; {hotel.location}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="font-medium text-gold">
                        from {hotel.price}
                      </span>
                      <span className="text-muted-foreground text-xs">/night</span>
                    </div>
                  </div>
                ))}
                <p className="pt-2 text-center text-xs text-muted-foreground">
                  Prices are approximate and may vary by season.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* What to Know */}
          <motion.div
            custom={2}
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
          >
            <Card className="h-full border-gold/20 bg-champagne shadow-md transition-shadow duration-300 hover:shadow-lg">
              <CardHeader className="items-center text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-gold/15">
                  <Info className="size-6 text-gold" strokeWidth={1.5} />
                </div>
                <CardTitle className="wewed-heading text-2xl text-espresso mt-2">
                  What to Know
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 font-sans text-sm">
                {/* Dress Code */}
                <div className="space-y-1.5">
                  <p className="font-medium text-espresso flex items-center gap-2">
                    <span className="inline-block size-2 rounded-full bg-clay" />
                    Dress Code
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Formal / Black Tie Optional — Traditional Zimbabwean attire warmly welcomed.
                  </p>
                </div>

                {/* Weather */}
                <div className="space-y-1.5">
                  <p className="font-medium text-espresso flex items-center gap-2">
                    <span className="inline-block size-2 rounded-full bg-gold" />
                    Weather
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    December in Harare is warm (25–30°C / 77–86°F) with possible afternoon showers. Light layers recommended.
                  </p>
                </div>

                {/* Gifts */}
                <div className="space-y-1.5">
                  <p className="font-medium text-espresso flex items-center gap-2">
                    <span className="inline-block size-2 rounded-full bg-sage" />
                    Gifts
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Your presence is our greatest gift. A registry link will be shared soon.
                  </p>
                </div>

                {/* Cultural Note */}
                <div className="space-y-1.5">
                  <p className="font-medium text-espresso flex items-center gap-2">
                    <span className="inline-block size-2 rounded-full bg-plum" />
                    Cultural Note
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    In Shona tradition, it is customary to bring a small gift for the families. This is entirely optional — your presence is what matters most.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
