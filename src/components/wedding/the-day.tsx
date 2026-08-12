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
import {
  STARTER_PROGRAMME,
  compactWeddingDate,
  formatWeddingDate,
  googleCalendarUrl,
  weddingIcsContent,
  weddingIcsFilename,
  weddingLocation,
} from '@/lib/wedding-template-defaults';

interface ProgrammeItem {
  time: string;
  event: string;
  description?: string;
  highlight?: boolean;
}

function TimelineItem({
  item,
  index,
  count,
}: {
  item: ProgrammeItem;
  index: number;
  count: number;
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
      <div className="flex flex-col items-center">
        <div
          className={`mt-1.5 flex h-3 w-3 shrink-0 items-center justify-center rounded-full ${
            item.highlight
              ? 'border-2 border-gold bg-gold/20'
              : 'border-2 border-gold/40 bg-champagne'
          }`}
        >
          {item.highlight && <div className="h-1 w-1 rounded-full bg-gold" />}
        </div>
        {index < count - 1 && (
          <div className="w-px flex-1 bg-gradient-to-b from-gold/30 to-gold/10" />
        )}
      </div>

      <div className="pb-8">
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
          <p className="mt-1 font-sans text-xs text-espresso/55 sm:pl-[4.5rem] sm:text-sm">
            {item.description}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function downloadIcsForWedding(
  wedding: NonNullable<ReturnType<typeof useWeddingContextSafe>>['wedding'],
) {
  if (!wedding) return;
  const blob = new Blob([weddingIcsContent(wedding)], {
    type: 'text/calendar;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = weddingIcsFilename(wedding);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function TheDay() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });
  const ctx = useWeddingContextSafe();
  const wedding = ctx?.wedding;

  const dateLineDefault = wedding
    ? `${formatWeddingDate(wedding.date)} · ${weddingLocation(wedding)}`
    : 'Add your wedding date and venue';
  const venueNameDefault = wedding?.venue || 'Add your venue';
  const venueLocationDefault = wedding
    ? [wedding.venueCity, wedding.venueCountry].filter(Boolean).join(', ')
    : 'Add the city and country';
  const venueDescriptionDefault =
    'Add a short venue note with arrival, parking and accessibility information your guests should know.';

  const dbHeading = ctx?.getContent('theday', 'heading', 'The Day') ?? 'The Day';
  const dbDateLine = ctx?.getContent('theday', 'dateLine', dateLineDefault) ?? dateLineDefault;
  const dbVenueName = ctx?.getContent('theday', 'venueName', venueNameDefault) ?? venueNameDefault;
  const dbVenueLocation = ctx?.getContent('theday', 'venueLocation', venueLocationDefault) ?? venueLocationDefault;
  const dbVenueDescription = ctx?.getContent(
    'theday',
    'venueDescription',
    venueDescriptionDefault,
  ) ?? venueDescriptionDefault;
  const dbDressCode = ctx?.getContent(
    'theday',
    'dressCode',
    'Formal — edit this to match your celebration.',
  ) ?? 'Formal — edit this to match your celebration.';
  const dbDressCodeNote = ctx?.getContent(
    'theday',
    'dressCodeNote',
    'Add any colour, footwear, weather or cultural guidance your guests need.',
  ) ?? 'Add any colour, footwear, weather or cultural guidance your guests need.';

  const canonicalProgramme: ProgrammeItem[] =
    ctx?.programmeItems && ctx.programmeItems.length > 0
      ? ctx.programmeItems.map((item) => ({
          time: item.time,
          event: item.title,
          description: item.description ?? undefined,
          highlight: /ceremony|vow|entrance|exit|first dance/i.test(item.title),
        }))
      : STARTER_PROGRAMME;

  const [heading] = useInlineContent('theday', 'heading', dbHeading);
  const [dateVenue] = useInlineContent('theday', 'dateLine', dbDateLine);
  const [venueName] = useInlineContent('theday', 'venueName', dbVenueName);
  const [venueLocation] = useInlineContent('theday', 'venueLocation', dbVenueLocation);
  const [venueDescription] = useInlineContent('theday', 'venueDescription', dbVenueDescription);
  const [dressCode] = useInlineContent('theday', 'dressCode', dbDressCode);
  const [dressCodeNote] = useInlineContent('theday', 'dressCodeNote', dbDressCodeNote);

  const mapUrl =
    wedding?.venueMapUrl ||
    (wedding
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(weddingLocation(wedding))}`
      : '#venue');

  return (
    <section id="theday" className="wewed-section bg-ivory py-20 md:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={sectionRef}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-16 text-center md:mb-20"
        >
          <SectionEyebrow>{compactWeddingDate(wedding?.date) || 'The Celebration'}</SectionEyebrow>
          <div className="inline-flex items-center gap-2">
            <h2 className="wewed-heading wewed-heading-accent text-3xl font-light text-espresso sm:text-4xl md:text-5xl">
              {heading}
            </h2>
            <InlineEditButton
              section="theday"
              field="heading"
              label="section heading"
              defaultValue={dbHeading}
              size="md"
            />
          </div>
          <div className="mt-6 flex items-center justify-center gap-2">
            <p className="font-sans text-sm tracking-wide text-espresso/60 sm:text-base">
              {dateVenue}
            </p>
            <InlineEditButton
              section="theday"
              field="dateLine"
              label="date & venue line"
              defaultValue={dbDateLine}
            />
          </div>
        </motion.div>

        <div className="grid gap-10 lg:grid-cols-5 lg:gap-12">
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
                  {canonicalProgramme.map((item, i) => (
                    <TimelineItem
                      key={`${item.time}-${item.event}-${i}`}
                      item={item}
                      index={i}
                      count={canonicalProgramme.length}
                    />
                  ))}
                </div>
                {(!ctx?.programmeItems || ctx.programmeItems.length === 0) && (
                  <p className="mt-2 rounded-xl border border-dashed border-gold/30 bg-ivory/60 p-4 text-xs leading-5 text-espresso/55">
                    Example programme shown. The couple or authorised planner can replace these times with the confirmed wedding schedule.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-6 lg:col-span-2">
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
                    <a href={googleCalendarUrl(wedding)} target="_blank" rel="noopener noreferrer">
                      <CalendarPlus className="mr-2 h-4 w-4" />
                      Google Calendar
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => downloadIcsForWedding(wedding)}
                    disabled={!wedding}
                    className="border-gold/30 bg-transparent font-sans text-xs uppercase tracking-wider text-espresso hover:bg-gold/10 hover:text-gold"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download .ics
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-gold/15 bg-champagne/50 backdrop-blur-sm">
              <CardContent className="p-5 sm:p-6">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="wewed-heading text-lg font-light text-espresso">{venueName}</h3>
                  <InlineEditButton
                    section="theday"
                    field="venueName"
                    label="venue name"
                    defaultValue={dbVenueName}
                  />
                </div>
                <div className="mb-1 flex items-center gap-2">
                  <p className="font-sans text-sm text-espresso/60">{venueLocation}</p>
                  <InlineEditButton
                    section="theday"
                    field="venueLocation"
                    label="venue location"
                    defaultValue={dbVenueLocation}
                  />
                </div>
                <div className="mb-4 flex items-start gap-2">
                  <p className="font-sans text-xs leading-5 text-espresso/45">{venueDescription}</p>
                  <InlineEditButton
                    section="theday"
                    field="venueDescription"
                    label="venue description"
                    defaultValue={dbVenueDescription}
                  />
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="border-gold/30 bg-transparent font-sans text-xs uppercase tracking-wider text-espresso hover:bg-gold/10 hover:text-gold"
                >
                  <a href={mapUrl} target="_blank" rel="noopener noreferrer">
                    <MapPin className="mr-2 h-4 w-4" />
                    Get Directions
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-gold/15 bg-champagne/50 backdrop-blur-sm">
              <CardContent className="p-5 sm:p-6">
                <h3 className="wewed-heading mb-2 text-lg font-light text-espresso">
                  Dress Code
                </h3>
                <div className="flex items-center gap-2">
                  <p className="font-sans text-sm text-espresso/60">{dressCode}</p>
                  <InlineEditButton
                    section="theday"
                    field="dressCode"
                    label="dress code"
                    defaultValue={dbDressCode}
                  />
                </div>
                <div className="mt-2 flex items-start gap-2">
                  <p className="font-sans text-xs italic leading-5 text-espresso/45">{dressCodeNote}</p>
                  <InlineEditButton
                    section="theday"
                    field="dressCodeNote"
                    label="dress code note"
                    defaultValue={dbDressCodeNote}
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
