'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { InlineEditButton } from '@/components/wedding/inline-edit-button';
import { SectionEyebrow } from '@/components/wedding/section-eyebrow';
import { useInlineContent } from '@/lib/inline-content';
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider';

interface Milestone {
  title: string;
  body: string;
  icon: string;
}

const MILESTONES: Milestone[] = [
  {
    title: 'When Two Worlds Met',
    body: 'Some stories begin with a glance across a crowded room. Others begin with a quiet certainty — the kind that settles in your bones before you even know its name. Charity and Kudzie met in the way all great love stories begin: unexpectedly, inevitably, as though the universe had been plotting this moment since before time began.',
    icon: '✦',
  },
  {
    title: 'The First Dance',
    body: 'Their early days were filled with the kind of laughter that makes your sides ache and the comfortable silences that only happen between two people who have found their home in each other. Every date felt like unwrapping a gift they didn\'t know they needed. Harare\'s golden sunsets became their backdrop, and its warm evenings their witness.',
    icon: '✦',
  },
  {
    title: 'Growing Together',
    body: 'Love deepened into family. Norioshona arrived with his mother\'s fire and his father\'s quiet strength — a boy who lights up every room. Then came Narasora, their daughter, carrying the best of both of them in her smile. Together, the four of them built a life rooted in faith, laughter, and the kind of love that doesn\'t just endure — it expands.',
    icon: '✦',
  },
  {
    title: 'The Question',
    body: 'When Kudzie asked Charity to be his wife, it wasn\'t a question at all — it was a promise already written in the stars. On bended knee, with the Zimbabwean sky stretching endlessly above them, he offered her not just a ring but a forever. And she, who had already given him her heart, said yes before the words had fully left his lips.',
    icon: '✦',
  },
  {
    title: 'Forever Begins',
    body: 'And so the countdown began — not to an end, but to a beginning. On December 23, 2026, beneath the baobabs and the wide African sky, Charity and Kudzie will stand before the people they love most and promise what their hearts have known all along: that this love is for keeps. Forever begins at Imba Manor.',
    icon: '✦',
  },
];

function TimelineItem({
  milestone,
  index,
}: {
  milestone: Milestone;
  index: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const isLeft = index % 2 === 0;

  // Inline-editable content — falls back to the original milestone copy
  // when the couple hasn't edited it. Edits persist in localStorage and
  // update the display instantly via the inline-content hook.
  const [title] = useInlineContent(
    'story',
    `milestone-${index}-title`,
    milestone.title,
  );
  const [body] = useInlineContent(
    'story',
    `milestone-${index}-body`,
    milestone.body,
  );

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: isLeft ? -40 : 40 }}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: isLeft ? -40 : 40 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      className={`relative flex w-full items-start gap-6 md:gap-10 ${
        isLeft ? 'md:flex-row' : 'md:flex-row-reverse'
      } flex-col md:flex-row`}
    >
      {/* Timeline dot — desktop only, centered */}
      <div className="absolute left-6 top-4 hidden md:left-1/2 md:block md:-translate-x-1/2">
        <div className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-gold bg-champagne">
          <div className="h-1.5 w-1.5 rounded-full bg-gold" />
        </div>
      </div>

      {/* Content card */}
      <div
        className={`w-full md:w-[calc(50%-2rem)] ${
          isLeft ? 'md:pr-8 md:text-right' : 'md:pl-8 md:text-left'
        }`}
      >
        <Card className="border-gold/15 bg-champagne/50 backdrop-blur-sm transition-shadow duration-300 hover:shadow-lg">
          <CardContent className="p-5 sm:p-6">
            <div
              className={`mb-2 flex items-center gap-2 ${
                isLeft ? 'md:justify-end' : 'md:justify-start'
              } justify-start`}
            >
              <span className="text-gold">{milestone.icon}</span>
              <h3 className="wewed-heading text-xl font-light text-espresso sm:text-2xl">
                {title}
              </h3>
              <InlineEditButton
                section="story"
                field={`milestone-${index}-title`}
                label={`Milestone ${index + 1} title`}
                defaultValue={milestone.title}
              />
            </div>
            <p className="font-sans text-sm leading-relaxed text-espresso/75 sm:text-base">
              {body}
            </p>
            <div
              className={`mt-3 flex ${
                isLeft ? 'md:justify-end' : 'md:justify-start'
              } justify-start`}
            >
              <InlineEditButton
                section="story"
                field={`milestone-${index}-body`}
                label={`Milestone ${index + 1} story`}
                defaultValue={milestone.body}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Spacer for opposite side */}
      <div className="hidden md:block md:w-[calc(50%-2rem)]" />
    </motion.div>
  );
}

export function OurStory() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  // Data-driven content from wedding context (multi-couple)
  const ctx = useWeddingContextSafe();
  const dbHeading = ctx?.getContent('story', 'heading', 'Our Story') ?? 'Our Story';
  const dbSubtitle = ctx?.getContent('story', 'subtitle', 'A love written in the stars, lived under African skies') ?? 'A love written in the stars, lived under African skies';
  const dbFamilyTitle = ctx?.getContent('story', 'familyTitle', 'The Musarurwa Family') ?? 'The Musarurwa Family';
  const dbFamilyNames = ctx?.getContent('story', 'familyNames', 'Charity & Kudzie · Norioshona · Narasora') ?? 'Charity & Kudzie · Norioshona · Narasora';

  // Get milestones from DB if available, otherwise use hardcoded
  const dbMilestones = ctx?.getOrdered('story', 'milestone-') ?? [];
  const milestones: Milestone[] = dbMilestones.length > 0
    ? dbMilestones.map((m) => ({
        title: m.value,
        body: (m.metadata as Record<string, unknown>)?.body as string ?? '',
        icon: (m.metadata as Record<string, unknown>)?.icon as string ?? '✦',
      }))
    : MILESTONES;

  // Inline-editable heading + family-portrait copy.
  const [heading] = useInlineContent('story', 'heading', dbHeading);
  const [subtitle] = useInlineContent('story', 'subtitle', dbSubtitle);
  const [familyTitle] = useInlineContent('story', 'family-title', dbFamilyTitle);
  const [familySubtitle] = useInlineContent('story', 'family-subtitle', dbFamilyNames);

  return (
    <section id="story" className="wewed-section bg-champagne py-20 md:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Section heading */}
        <motion.div
          ref={sectionRef}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-16 text-center md:mb-20"
        >
          <SectionEyebrow>Chapter One</SectionEyebrow>
          <div className="inline-flex items-center gap-2">
            <h2 className="wewed-heading wewed-heading-accent text-3xl font-light text-espresso sm:text-4xl md:text-5xl">
              {heading}
            </h2>
            <InlineEditButton
              section="story"
              field="heading"
              label="section heading"
              defaultValue="Our Story"
              size="md"
            />
          </div>
          <div className="mt-6 flex items-center justify-center gap-2">
            <p className="font-sans text-sm tracking-wide text-espresso/60 sm:text-base">
              {subtitle}
            </p>
            <InlineEditButton
              section="story"
              field="subtitle"
              label="section subtitle"
              defaultValue="A love written in the stars, lived under African skies"
            />
          </div>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Central timeline line — desktop only */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-gold/30 to-transparent md:left-1/2 md:-translate-x-1/2" />

          <div className="flex flex-col gap-8 md:gap-12">
            {milestones.map((milestone, i) => (
              <TimelineItem key={milestone.title} milestone={milestone} index={i} />
            ))}
          </div>
        </div>

        {/* Family portrait */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mt-20 text-center"
        >
          {/* Portrait with generated image */}
          <div className="wewed-photo-frame mx-auto relative h-72 w-56 overflow-hidden rounded-2xl border-2 border-gold/20 sm:h-80 sm:w-64">
            <Image
              src="/couple-silhouette.png"
              alt="Charity & Kudzie — a love under African skies"
              fill
              sizes="(min-width: 640px) 16rem, 14rem"
              className="object-cover object-top"
              quality={85}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-champagne/40 to-transparent" />
          </div>
          <div className="mt-6 flex items-center justify-center gap-2">
            <h3 className="wewed-heading text-2xl font-light text-espresso sm:text-3xl">
              {familyTitle}
            </h3>
            <InlineEditButton
              section="story"
              field="family-title"
              label="family portrait title"
              defaultValue="The Musarurwa Family"
              size="md"
            />
          </div>
          <div className="mt-2 flex items-center justify-center gap-2">
            <p className="font-sans text-sm tracking-wider text-espresso/60 sm:text-base">
              {familySubtitle}
            </p>
            <InlineEditButton
              section="story"
              field="family-subtitle"
              label="family portrait names"
              defaultValue="Charity & Kudzie · Norioshona · Narasora"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
