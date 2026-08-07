import Link from 'next/link'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, ExternalLink, ShieldCheck } from 'lucide-react'
import { PublicInfoPage } from '@/components/public/public-info-page'
import {
  CATEGORY_META,
  WEWED_DOMAIN,
  getPublicDocuments,
  type PublicDocument,
  type PublicDocumentCategory,
} from '@/lib/public-documents'

const CATEGORY_PATH: Record<PublicDocumentCategory, string> = {
  legal: '/legal',
  trust: '/trust',
  developers: '/developers',
}

export function PublicDocumentHub({ category }: { category: PublicDocumentCategory }) {
  const meta = CATEGORY_META[category]
  const documents = getPublicDocuments(category)

  return (
    <PublicInfoPage eyebrow={meta.eyebrow} title={meta.title} description={meta.description}>
      <div className="mb-10 rounded-3xl border border-gold/20 bg-white/70 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-muted">Official domain</p>
            <p className="mt-2 font-serif text-3xl">{WEWED_DOMAIN}</p>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-espresso/65">
            Wewed keeps public policies and trust guidance together so couples, planners, providers and partners can understand the rules that apply before sharing data or making commitments.
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

export function PublicDocumentDetail({ document }: { document: PublicDocument }) {
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
            Product-specific notices, checkout terms or signed business agreements may add to this document. Mandatory rights under applicable law remain unaffected.
          </p>
          <a href={`https://${WEWED_DOMAIN}`} className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-gold-muted hover:text-espresso">
            Visit {WEWED_DOMAIN}<ExternalLink className="size-3.5" />
          </a>
        </aside>
      </div>
    </PublicInfoPage>
  )
}
