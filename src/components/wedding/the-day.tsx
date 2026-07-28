'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { CalendarPlus, MapPin, Download, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InlineEditButton } from '@/components/wedding/inline-edit-button';
import { SectionEyebrow } from '@/components/wedding/section-eyebrow';
import { useInlineContent } from '@/lib/inline-content';
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider';

interface ProgrammeItem {
  time: string;
  event: string;
  description?: string;
  highlight?: boolean;
}

const PROGRAMME: ProgrammeItem[] = [
  { time: '13:00', event: 'Guests Arrive', description: 'Welcome drinks & mingling' },
  { time: '14:00', event: 'Ceremony Begins', description: 'The procession starts' },
  { time: '14:45', event: '"I Do" — The Vows', description: 'The moment we say forever', highlight: true },
  { time: '15:00', event: 'Confetti & Celebrations', description: 'Joy, tears & photographs' },
  { time: '15:30', event: 'Cocktail Hour & Canapés', description: 'Sip, savour & celebrate' },
  { time: '16:30', event: 'Reception & First Dance', description: 'Mr & Mrs Musarurwa take the floor' },
  { time: '17:00', event: 'Dinner is Served', description: 'A feast to remember' },
  { time: '18:30', event: 'Speeches & Toasts', description: 'Words from the heart' },
  { time: '19:30', event: 'Cutting the Cake', description: 'Sweet beginnings' },
  { time: '20:00', event: 'Dance Floor Opens', description: 'Let the celebration begin!' },
  { time: '22:00', event: 'Last Dance & Sparkler Exit', description: 'A magical farewell', highlight: true },
];

function TimelineItem({
  item,
  index,
}: {
  item: ProgrammeItem;
  index: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -20 }}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
      className="relative flex gap-4 sm:gap-6"
    >
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div
          className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full ${
            item.highlight
              ? 'border-2 border-gold bg-gold/20'
              : 'border-2 border-gold/40 bg-champagne'
          } mt-1.5`}
        >
          {item.highlight && (
            <div className="h-1 w-1 rounded-full bg-gold" />
          )}
        </div>
        {index < PROGRAMME.length - 1 && (
          <div className="w-px flex-1 bg-gradient-to-b from-gold/30 to-gold/10" />
        )}
      </div>

      {/* Content */}
      <div className={`pb-8 ${item.highlight ? '' : ''}`}>
        <div className="flex items-baseline gap-3">
          <span className="font-sans text-xs font-medium tabular-nums tracking-wider text-gold sm:text-sm">
            {item.time}
          </span>
          <h3
            className={`wewed-heading text-base sm:text-lg ${
              item.highlight ? 'font-medium text-espresso' : 'font-light text-espresso/85'
            }`}
          >
            {item.event}
          </h3>
        </div>
        {item.description && (
          <p className="mt-1 pl-0 font-sans text-xs text-espresso/55 sm:text-sm sm:pl-[4.5rem]">
            {item.description}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function getGoogleCalendarUrl(): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Charity & Kudzie — Wedding Celebration',
    dates: '20261223T130000/20261223T220000',
    location: 'Imba Manor, Harare, Zimbabwe',
    details:
      'Join us for the celebration of Charity & Kudzie (Mr & Mrs Musarurwa) at Imba Manor, Harare, Zimbabwe. wewed — where love lives forever.',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function getIcsContent(): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//wewed//Charity & Kudzie Wedding//EN',
    'BEGIN:VEVENT',
    'DTSTART:20261223T130000',
    'DTEND:20261223T220000',
    'SUMMARY:Charity & Kudzie — Wedding Celebration',
    'LOCATION:Imba Manor\\, Harare\\, Zimbabwe',
    'DESCRIPTION:Join us for the celebration of Charity & Kudzie (Mr & Mrs Musarurwa) at Imba Manor\\, Harare\\, Zimbabwe.',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function downloadIcs() {
  const blob = new Blob([getIcsContent()], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'charity-and-kudzie-wedding.ics';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function TheDay() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  // Data-driven content from wedding context (multi-couple)
  const ctx = useWeddingContextSafe();
  const dbHeading = ctx?.getContent('theday', 'heading', 'The Day') ?? 'The Day';
  const dbDateLine = ctx?.getContent('theday', 'dateLine', 'Wednesday, December 23, 2026 · Imba Manor, Harare') ?? 'Wednesday, December 23, 2026 · Imba Manor, Harare';
  const dbVenueName = ctx?.getContent('theday', 'venueName', 'Imba Manor') ?? 'Imba Manor';
  const dbVenueLocation = ctx?.getContent('theday', 'venueLocation', 'Harare, Zimbabwe') ?? 'Harare, Zimbabwe';
  const dbVenueDescription = ctx?.getContent('theday', 'venueDescription', 'An exclusive venue nestled in the heart of Harare, offering timeless elegance and breathtaking views for your most cherished moments.') ?? 'An exclusive venue nestled in the heart of Harare, offering timeless elegance and breathtaking views for your most cherished moments.';
  const dbDressCode = ctx?.getContent('theday', 'dressCode', 'Formal / Black Tie Optional') ?? 'Formal / Black Tie Optional';
  const dbDressCodeNote = ctx?.getContent('theday', 'dressCodeNote', 'We kindly ask guests to avoid white and ivory — those shades are reserved for the bride.') ?? 'We kindly ask guests to avoid white and ivory — those shades are reserved for the bride.';

  // Get programme from DB if available
  const dbProgramme = ctx?.getOrdered('theday', 'programme-') ?? [];
  const programmeItems: ProgrammeItem[] = dbProgramme.length > 0
    ? dbProgramme.map((p) => ({
        time: (p.metadata as Record<string, unknown>)?.time as string ?? '',
        event: p.value,
        description: (p.metadata as Record<string, unknown>)?.description as string | undefined,
        highlight: (p.metadata as Record<string, unknown>)?.highlight as boolean | undefined,
      }))
    : PROGRAMME;

  // Inline-editable date / venue heading + sidebar copy.
  const [heading] = useInlineContent('theday', 'heading', dbHeading);
  const [dateVenue] = useInlineContent('theday', 'date-venue', dbDateLine);
  const [venueName] = useInlineContent('theday', 'venue-name', dbVenueName);
  const [venueLocation] = useInlineContent('theday', 'venue-location', dbVenueLocation);
  const [venueDescription] = useInlineContent('theday', 'venue-description', dbVenueDescription);
  const [dressCode] = useInlineContent('theday', 'dress-code', dbDressCode);
  const [dressCodeNote] = useInlineContent('theday', 'dress-code-note', dbDressCodeNote);

  return (
    <section id="theday" className="wewed-section bg-ivory py-20 md:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Section heading */}
        <motion.div
          ref={sectionRef}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-16 text-center md:mb-20"
        >
          <SectionEyebrow>23 · 12 · 26</SectionEyebrow>
          <div className="inline-flex items-center gap-2">
            <h2 className="wewed-heading wewed-heading-accent text-3xl font-light text-espresso sm:text-4xl md:text-5xl">
              {heading}
            </h2>
            <InlineEditButton
              section="theday"
              field="heading"
              label="section heading"
              defaultValue="The Day"
              size="md"
            />
          </div>
          <div className="mt-6 flex items-center justify-center gap-2">
            <p className="font-sans text-sm tracking-wide text-espresso/60 sm:text-base">
              {dateVenue}
            </p>
            <InlineEditButton
              section="theday"
              field="date-venue"
              label="date & venue line"
              defaultValue="Wednesday, December 23, 2026 · Imba Manor, Harare"
            />
          </div>
        </motion.div>

        <div className="grid gap-10 lg:grid-cols-5 lg:gap-12">
          {/* Programme timeline — takes 3 cols */}
          <div className="lg:col-span-3">
            <Card className="border-gold/15 bg-champagne/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 font-sans text-sm font-medium uppercase tracking-[0.15em] text-gold-muted">
                  <Clock className="h-4 w-4" />
                  Programme
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex flex-col">
                  {programmeItems.map((item, i) => (
                    <TimelineItem key={item.time} item={item} index={i} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar — takes 2 cols */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            {/* Add to Calendar */}
            <Card className="border-gold/15 bg-champagne/50 backdrop-blur-sm">
              <CardContent className="p-5 sm:p-6">
                <h3 className="wewed-heading mb-4 text-lg font-light text-espresso">
                  Save the Date
                </h3>
                <div className="flex flex-col gap-3">
                  <Button
                    asChild
                    variant="outline"
                    className="border-gold/30 bg-transparent font-sans text-xs uppercase tracking-wider text-espresso hover:bg-gold/10 hover:text-gold"
                  >
                    <a
                      href={getGoogleCalendarUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <CalendarPlus className="mr-2 h-4 w-4" />
                      Google Calendar
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={downloadIcs}
                    className="border-gold/30 bg-transparent font-sans text-xs uppercase tracking-wider text-espresso hover:bg-gold/10 hover:text-gold"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download .ics
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Venue info */}
            <Card className="border-gold/15 bg-champagne/50 backdrop-blur-sm">
              <CardContent className="p-5 sm:p-6">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="wewed-heading text-lg font-light text-espresso">
                    {venueName}
                  </h3>
                  <InlineEditButton
                    section="theday"
                    field="venue-name"
                    label="venue name"
                    defaultValue="Imba Manor"
                  />
                </div>
                <div className="mb-1 flex items-center gap-2">
                  <p className="font-sans text-sm text-espresso/60">
                    {venueLocation}
                  </p>
                  <InlineEditButton
                    section="theday"
                    field="venue-location"
                    label="venue location"
                    defaultValue="Harare, Zimbabwe"
                  />
                </div>
                <div className="mb-4 flex items-start gap-2">
                  <p className="font-sans text-xs text-espresso/45">
                    {venueDescription}
                  </p>
                  <InlineEditButton
                    section="theday"
                    field="venue-description"
                    label="venue description"
                    defaultValue="An exclusive venue nestled in the heart of Harare, offering timeless elegance and breathtaking views for your most cherished moments."
                  />
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="border-gold/30 bg-transparent font-sans text-xs uppercase tracking-wider text-espresso hover:bg-gold/10 hover:text-gold"
                >
                  <a
                    href="https://www.google.com/maps/search/Imba+Manor+Harare+Zimbabwe"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    Get Directions
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Dress code teaser */}
            <Card className="border-gold/15 bg-champagne/50 backdrop-blur-sm">
              <CardContent className="p-5 sm:p-6">
                <h3 className="wewed-heading mb-2 text-lg font-light text-espresso">
                  Dress Code
                </h3>
                <div className="flex items-center gap-2">
                  <p className="font-sans text-sm text-espresso/60">
                    {dressCode}
                  </p>
                  <InlineEditButton
                    section="theday"
                    field="dress-code"
                    label="dress code"
                    defaultValue="Formal / Black Tie Optional"
                  />
                </div>
                <div className="mt-2 flex items-start gap-2">
                  <p className="font-sans text-xs italic text-espresso/45">
                    {dressCodeNote}
                  </p>
                  <InlineEditButton
                    section="theday"
                    field="dress-code-note"
                    label="dress code note"
                    defaultValue="We kindly ask guests to avoid white and ivory — those shades are reserved for the bride."
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
