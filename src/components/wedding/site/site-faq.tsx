'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import {
  OwnerSetupPrompt,
  SiteSection,
  usePublishedCopy,
  useSiteItems,
} from '@/components/wedding/site/primitives'

/** Questions are the couple's own FAQ items. No starter questions, no platform contact links. */
export function SiteFaq() {
  const heading = usePublishedCopy('faq', 'heading')
  const subtitle = usePublishedCopy('faq', 'subtitle')
  const items = useSiteItems('faq')
  if (!items.length) {
    return (
      <OwnerSetupPrompt section="faq" message="No questions are published yet, so guests don't see Questions & Answers." />
    )
  }
  return (
    <SiteSection id="faq" eyebrow="Questions" heading={heading || 'Questions & Answers'} subtitle={subtitle || undefined}>
      <Accordion type="single" collapsible className="mx-auto max-w-3xl rounded-2xl border border-gold/20 bg-champagne/30">
        {items.map((item) => (
          <AccordionItem key={item.id} value={item.id} className="border-gold/15 last:border-b-0">
            <AccordionTrigger className="min-h-14 px-5 text-left hover:no-underline sm:px-7">
              <span className="wewed-heading text-lg font-light text-espresso sm:text-xl">{item.title}</span>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-6 sm:px-7">
              <p className="whitespace-pre-line font-sans text-sm leading-7 text-espresso/70 sm:text-base">{item.body}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </SiteSection>
  )
}
