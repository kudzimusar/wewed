'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { ChevronDown, Mail, HelpCircle } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { SectionEyebrow } from '@/components/wedding/section-eyebrow';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'What time should I arrive?',
    answer:
      "Guests should arrive by 13:00 to allow time for parking and seating. The ceremony begins promptly at 14:00.",
  },
  {
    question: 'Is there parking at Imba Manor?',
    answer:
      'Yes, complimentary valet parking is available at the venue. Follow the signs upon arrival.',
  },
  {
    question: 'Can I bring my children?',
    answer:
      "Children are most welcome! Charity and Kudzie's own little ones, Norioshona and Narasora, will be there. Please indicate the number of children on your RSVP.",
  },
  {
    question: 'What should I wear?',
    answer:
      'Formal or Black Tie Optional. Traditional Zimbabwean attire is warmly welcomed. We kindly ask guests to avoid white and ivory — those shades are reserved for the bride.',
  },
  {
    question: 'Will there be vegetarian/vegan options?',
    answer:
      "Yes, please indicate your dietary preference on your RSVP. We'll have beef, chicken, vegetarian, vegan, and traditional Zimbabwean options.",
  },
  {
    question: 'Can I take photos during the ceremony?',
    answer:
      "We're having an unplugged ceremony — please keep phones and cameras away during the vows. Our photographer will capture every moment, and you'll see all the photos in the gallery afterward. Feel free to snap away during the reception!",
  },
  {
    question: 'Is there a gift registry?',
    answer:
      'Your presence is our greatest gift. For those who wish, a contribution to our honeymoon fund or a donation to the Musarurwa Family Foundation would be deeply appreciated. See the Registry section below.',
  },
  {
    question: 'What if I have a food allergy?',
    answer:
      'Please note any allergies in the dietary requirements field on your RSVP, and speak to our coordinator on the day. We want everyone to enjoy the feast safely.',
  },
];

function GoldChevron() {
  return (
    <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/5 transition-all duration-300 group-hover:border-gold/60 group-hover:bg-gold/10">
      <ChevronDown
        className="h-3.5 w-3.5 text-gold transition-transform duration-300 [[data-state=open]>&]:rotate-180"
        strokeWidth={2}
      />
    </span>
  );
}

function FaqRow({
  item,
  index,
}: {
  item: FaqItem;
  index: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
        delay: 0.05 * (index % 4),
      }}
    >
      <AccordionItem
        value={`faq-${index}`}
        className="group border-gold/15 transition-colors duration-300 hover:border-gold/30"
      >
        <AccordionTrigger className="hover:no-underline px-5 sm:px-7 py-5">
          <span className="flex w-full items-center justify-between gap-4 text-left">
            <span className="wewed-heading flex-1 text-lg font-light text-espresso sm:text-xl">
              {item.question}
            </span>
            <GoldChevron />
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-5 sm:px-7 pb-5">
          <div className="relative pl-5 sm:pl-6">
            <span className="absolute left-0 top-1.5 h-[calc(100%-0.75rem)] w-px bg-gradient-to-b from-gold/50 to-transparent" />
            <p className="font-sans text-sm leading-relaxed text-espresso/70 sm:text-[0.95rem]">
              {item.answer}
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>
    </motion.div>
  );
}

export function FaqSection() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  return (
    <section id="faq" className="wewed-section bg-ivory py-20 md:py-32">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Section heading */}
        <motion.div
          ref={sectionRef}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-14 text-center md:mb-20"
        >
          <SectionEyebrow>Good to Know</SectionEyebrow>
          <div className="mb-5 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 bg-gold/5">
              <HelpCircle className="h-5 w-5 text-gold" strokeWidth={1.25} />
            </span>
          </div>
          <h2 className="wewed-heading wewed-heading-accent text-3xl font-light text-espresso sm:text-4xl md:text-5xl">
            Questions &amp; Answers
          </h2>
          <p className="mt-6 font-sans text-sm tracking-wide text-espresso/60 sm:text-base">
            Everything you might be wondering about the day
          </p>
        </motion.div>

        {/* FAQ accordion */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="overflow-hidden rounded-2xl border border-gold/20 bg-champagne/60 shadow-sm backdrop-blur-sm"
        >
          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map((item, i) => (
              <FaqRow key={item.question} item={item} index={i} />
            ))}
          </Accordion>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 flex flex-col items-center gap-4 text-center"
        >
          <div className="wewed-divider w-24" />
          <p className="font-sans text-sm text-espresso/70 sm:text-base">
            Still have questions?
          </p>
          <a
            href="mailto:hello@wewed.app"
            className="group inline-flex items-center gap-2 font-sans text-sm tracking-wide text-gold-muted transition-colors hover:text-gold"
          >
            <Mail className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
            <span className="border-b border-gold/30 pb-0.5 transition-colors group-hover:border-gold">
              hello@wewed.app
            </span>
          </a>
          <p className="mt-4 wewed-monogram text-xs">C&amp;K &middot; 23.12.26</p>
        </motion.div>
      </div>
    </section>
  );
}
