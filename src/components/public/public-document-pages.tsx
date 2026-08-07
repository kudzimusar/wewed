import Link from 'next/link'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, ExternalLink, ShieldCheck } from 'lucide-react'
import { PublicInfoPage } from '@/components/public/public-info-page'
import {
  CATEGORY_META,
  WEWED_DOMAIN,
  getPublicDocuments,
  type PublicDocument,
  type PublicDocumentCategory,
} from '@/lib/public-site-documents'

const CATEGORY_PATH: Record<PublicDocumentCategory, string> = {
  company: '/company',
  trust: '/trust',
  legal: '/legal',
  vendors: '/vendors/resources',
  developers: '/developers',
  help: '/help',
}

function asPublishedDocument(document: PublicDocument): PublicDocument {
  if (document.category === 'vendors' && document.slug === 'how-ranking-works') {
    return {
      ...document,
      summary: 'How Wewed currently filters and orders planner marketplace results, including the signals that do not affect ranking today.',
      sections: [
        {
          heading: 'Who is eligible to appear',
          paragraphs: [
            'The current planner marketplace returns profiles whose planner profile is published, whose planning-company business account is active and whose business onboarding is complete. Profiles that do not meet those publication and account conditions are not included in the public planner result set.',
          ],
        },
        {
          heading: 'Search and filters',
          paragraphs: [
            'People can narrow planner results using free-text search and supported marketplace filters. Current filtering covers planner display name or headline, service area, service, wedding style, price band and availability status.',
          ],
        },
        {
          heading: 'Current default ordering',
          bullets: [
            'Availability status first: accepting planners, then limited availability, then other availability states.',
            'Within those groups, more recently published profiles appear before older published profiles.',
            'Display name is used as the final stable alphabetical tie-breaker.',
            'The current planner query returns up to 100 matching profiles.',
          ],
        },
        {
          heading: 'Signals that do not currently change planner order',
          paragraphs: [
            'The current planner marketplace ordering query does not rank profiles by review score, verification badge, response time, subscription payment or sponsored-placement status. Wewed should update this explanation before relying on any additional ranking signal in production.',
            'If paid or sponsored placement is introduced, it should be clearly distinguishable from ordinary marketplace ordering rather than silently changing the meaning of an organic result.',
          ],
        },
      ],
    }
  }

  if ((document.category === 'vendors' && document.slug === 'reviews') || (document.category === 'trust' && document.slug === 'review-integrity')) {
    return {
      ...document,
      sections: [
        {
          heading: 'Current product status',
          paragraphs: [
            'This guidance defines the integrity standard Wewed applies to review functionality where it is available. It does not mean that every current marketplace profile exposes public reviews, ratings or a review-dispute workflow. Product pages should only display review capabilities that are actually enabled for that surface.',
          ],
        },
        ...document.sections,
      ],
    }
  }

  return document
}

export function PublicDocumentHub({ category }: { category: PublicDocumentCategory }) {
  const meta = CATEGORY_META[category]
  const documents = getPublicDocuments(category).map(asPublishedDocument)

  return (
    <PublicInfoPage eyebrow={meta.eyebrow} title={meta.title} description={meta.description}>
      <div className="mb-10 rounded-3xl border border-gold/20 bg-white/70 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-muted">Official domain</p>
            <p className="mt-2 font-serif text-3xl">{WEWED_DOMAIN}</p>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-espresso/65">
            Wewed keeps company information, trust guidance, legal terms, professional resources, developer standards and role-specific help discoverable from one public framework.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {documents.map((document) => (
          <Link
            key={document.slug}
            href={`${CATEGORY_PATH[category]}/${document.slug}`}
            className="group rounded-3xl border border-gold/20 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-gold/45 hover:shadow-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <ShieldCheck className="size-5 text-gold-muted" aria-hidden="true" />
              <ArrowRight className="size-4 text-espresso/35 transition group-hover:translate-x-1 group-hover:text-gold-muted" aria-hidden="true" />
            </div>
            <h2 className="mt-6 font-serif text-2xl leading-tight">{document.title}</h2>
            <p className="mt-3 text-sm leading-6 text-espresso/60">{document.summary}</p>
            {document.effectiveDate && <p className="mt-5 text-xs text-espresso/40">Effective {document.effectiveDate}</p>}
          </Link>
        ))}
      </div>
    </PublicInfoPage>
  )
}

export function PublicDocumentDetail({ document: sourceDocument }: { document: PublicDocument }) {
  const document = asPublishedDocument(sourceDocument)
  const categoryPath = CATEGORY_PATH[document.category]
  const categoryMeta = CATEGORY_META[document.category]

  return (
    <PublicInfoPage
      eyebrow={categoryMeta.eyebrow}
      title={document.title}
      description={document.summary}
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article className="min-w-0">
          <Link href={categoryPath} className="inline-flex items-center gap-2 text-sm font-semibold text-gold-muted hover:text-espresso">
            <ArrowLeft className="size-4" /> Back to {categoryMeta.title}
          </Link>

          <div className="mt-7 flex flex-wrap gap-3 text-xs text-espresso/55">
            {document.status && <span className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1.5"><CheckCircle2 className="size-3.5" />{document.status}</span>}
            {document.effectiveDate && <span className="inline-flex items-center gap-2 rounded-full border border-espresso/10 px-3 py-1.5"><Clock3 className="size-3.5" />Effective {document.effectiveDate}</span>}
          </div>

          <div className="mt-10 space-y-10">
            {document.sections.map((section) => (
              <section key={section.heading} className="scroll-mt-24 border-t border-gold/15 pt-7">
                <h2 className="font-serif text-3xl leading-tight">{section.heading}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="mt-4 max-w-3xl text-sm leading-7 text-espresso/70 sm:text-base">{paragraph}</p>
                ))}
                {section.bullets && (
                  <ul className="mt-4 max-w-3xl space-y-3 text-sm leading-7 text-espresso/70 sm:text-base">
                    {section.bullets.map((bullet) => <li key={bullet} className="flex gap-3"><span className="mt-3 size-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" /><span>{bullet}</span></li>)}
                  </ul>
                )}
                {section.links && (
                  <div className="mt-5 flex flex-wrap gap-3">
                    {section.links.map((link) => (
                      <Link key={`${section.heading}-${link.href}`} href={link.href} className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/5 px-4 py-2 text-xs font-semibold text-gold-muted transition hover:border-gold/50 hover:bg-gold/10 hover:text-espresso">
                        {link.label}<ArrowRight className="size-3.5" aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </article>

        <aside className="h-fit rounded-3xl border border-gold/20 bg-white/75 p-6 shadow-sm lg:sticky lg:top-24">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-muted">Document information</p>
          <dl className="mt-5 space-y-4 text-sm">
            <div><dt className="text-espresso/45">Service</dt><dd className="mt-1 font-medium">Wewed</dd></div>
            <div><dt className="text-espresso/45">Official domain</dt><dd className="mt-1 font-medium">{WEWED_DOMAIN}</dd></div>
            {document.effectiveDate && <div><dt className="text-espresso/45">Effective</dt><dd className="mt-1 font-medium">{document.effectiveDate}</dd></div>}
          </dl>
          <p className="mt-6 border-t border-gold/15 pt-5 text-xs leading-5 text-espresso/50">
            Legal documents may be supplemented by product-specific notices, checkout terms or signed business agreements. Public guidance describes Wewed’s current operating expectations and must not be read as a guarantee beyond the feature or check described.
          </p>
          <a href={`https://${WEWED_DOMAIN}`} className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-gold-muted hover:text-espresso">
            Visit {WEWED_DOMAIN}<ExternalLink className="size-3.5" />
          </a>
        </aside>
      </div>
    </PublicInfoPage>
  )
}
