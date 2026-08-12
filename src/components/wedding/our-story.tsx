'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { InlineEditButton } from '@/components/wedding/inline-edit-button';
import { SectionEyebrow } from '@/components/wedding/section-eyebrow';
import { useInlineContent } from '@/lib/inline-content';
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider';
import {
  STARTER_STORY_MILESTONES,
  coupleNames,
} from '@/lib/wedding-template-defaults';

interface Milestone {
  title: string;
  body: string;
  icon: string;
}

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

  const [title] = useInlineContent(
    'story',
    `milestoneTitle${index}`,
    milestone.title,
  );
  const [body] = useInlineContent(
    'story',
    `milestoneBody${index}`,
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
      <div className="absolute left-6 top-4 hidden md:left-1/2 md:block md:-translate-x-1/2">
        <div className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-gold bg-champagne">
          <div className="h-1.5 w-1.5 rounded-full bg-gold" />
        </div>
      </div>

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
                field={`milestoneTitle${index}`}
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
                field={`milestoneBody${index}`}
                label={`Milestone ${index + 1} story`}
                defaultValue={milestone.body}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="hidden md:block md:w-[calc(50%-2rem)]" />
    </motion.div>
  );
}

export function OurStory() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });
  const ctx = useWeddingContextSafe();
  const wedding = ctx?.wedding;
  const names = coupleNames(wedding);

  const dbHeading = ctx?.getContent('story', 'heading', 'Our Story') ?? 'Our Story';
  const dbSubtitle = ctx?.getContent(
    'story',
    'subtitle',
    'A little about us — replace these examples with the story you want to share.',
  ) ?? 'A little about us — replace these examples with the story you want to share.';
  const dbFamilyTitle = ctx?.getContent('story', 'familyTitle', 'Our People') ?? 'Our People';
  const dbFamilyNames = ctx?.getContent(
    'story',
    'familyNames',
    `${names} · Add family or wedding-party names here`,
  ) ?? `${names} · Add family or wedding-party names here`;
  const familyImageUrl =
    ctx?.getContent('story', 'familyImageUrl', '') ||
    (ctx?.isFlagship ? '/couple-silhouette.png' : '');

  const dbMilestones = ctx?.getOrdered('story', 'milestone-') ?? [];
  const baseMilestones: Milestone[] = dbMilestones.length > 0
    ? dbMilestones.map((m) => ({
        title: m.value,
        body: (m.metadata as Record<string, unknown>)?.body as string ?? '',
        icon: (m.metadata as Record<string, unknown>)?.icon as string ?? '✦',
      }))
    : STARTER_STORY_MILESTONES;
  const milestones = baseMilestones.map((milestone, index) => ({
    title: ctx?.getContent('story', `milestoneTitle${index}`, milestone.title) ?? milestone.title,
    body: ctx?.getContent('story', `milestoneBody${index}`, milestone.body) ?? milestone.body,
    icon: milestone.icon,
  }));

  const [heading] = useInlineContent('story', 'heading', dbHeading);
  const [subtitle] = useInlineContent('story', 'subtitle', dbSubtitle);
  const [familyTitle] = useInlineContent('story', 'familyTitle', dbFamilyTitle);
  const [familySubtitle] = useInlineContent('story', 'familyNames', dbFamilyNames);

  return (
    <section id="story" className="wewed-section bg-champagne py-20 md:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
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
              defaultValue={dbHeading}
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
              defaultValue={dbSubtitle}
            />
          </div>
        </motion.div>

        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-gold/30 to-transparent md:left-1/2 md:-translate-x-1/2" />
          <div className="flex flex-col gap-8 md:gap-12">
            {milestones.map((milestone, i) => (
              <TimelineItem key={`${i}-${milestone.title}`} milestone={milestone} index={i} />
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mt-20 text-center"
        >
          <div className="wewed-photo-frame mx-auto relative flex h-72 w-56 items-center justify-center overflow-hidden rounded-2xl border-2 border-gold/20 bg-gradient-to-br from-espresso via-plum to-clay sm:h-80 sm:w-64">
            {familyImageUrl ? (
              <Image
                src={familyImageUrl}
                alt={`${names} story portrait`}
                fill
                unoptimized={familyImageUrl.startsWith('http')}
                sizes="(min-width: 640px) 16rem, 14rem"
                className="object-cover object-top"
                quality={85}
              />
            ) : (
              <div className="px-6 text-center">
                <p className="font-serif text-3xl text-champagne">{names}</p>
                <p className="mt-3 font-sans text-[10px] uppercase tracking-[0.18em] text-gold">
                  Add your favourite portrait
                </p>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-champagne/30 to-transparent" />
          </div>
          <div className="mt-6 flex items-center justify-center gap-2">
            <h3 className="wewed-heading text-2xl font-light text-espresso sm:text-3xl">
              {familyTitle}
            </h3>
            <InlineEditButton
              section="story"
              field="familyTitle"
              label="family portrait title"
              defaultValue={dbFamilyTitle}
              size="md"
            />
          </div>
          <div className="mt-2 flex items-center justify-center gap-2">
            <p className="font-sans text-sm tracking-wider text-espresso/60 sm:text-base">
              {familySubtitle}
            </p>
            <InlineEditButton
              section="story"
              field="familyNames"
              label="family portrait names"
              defaultValue={dbFamilyNames}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
