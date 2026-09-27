'use client'

import { useCallback, useState } from 'react'
import { ArrowDown, ArrowUp, ExternalLink } from 'lucide-react'
import { AnnouncementsPanel } from '@/components/wedding/site-editor/announcements-panel'
import { CopyField } from '@/components/wedding/site-editor/copy-field'
import { EssentialsForm } from '@/components/wedding/site-editor/essentials-form'
import { ItemList } from '@/components/wedding/site-editor/item-list'
import { editorRequest, loadEditorProjection } from '@/components/wedding/site-editor/api'
import {
  SITE_ITEM_KINDS,
  SITE_SECTION_LABELS,
  type EditorSiteProjection,
  type SiteItemKind,
  type SiteSectionKey,
} from '@/lib/wedding-site/model'

type CopySpec = { section: string; field: string; label: string; multiline?: boolean; hint?: string }

/** Editable public copy per website section. Mirrors PUBLIC_SCALAR_FIELDS exactly. */
const SECTION_COPY: Partial<Record<SiteSectionKey, CopySpec[]>> = {
  story: [
    { section: 'story', field: 'heading', label: 'Section heading' },
    { section: 'story', field: 'subtitle', label: 'Subtitle' },
    { section: 'story', field: 'title', label: 'Story title' },
    { section: 'story', field: 'introduction', label: 'Introduction', multiline: true },
    { section: 'story', field: 'body', label: 'Your story', multiline: true },
  ],
  party: [
    { section: 'party', field: 'heading', label: 'Section heading' },
    { section: 'party', field: 'subtitle', label: 'Subtitle' },
  ],
  venue: [
    { section: 'venue', field: 'heading', label: 'Section heading', hint: 'Leave empty to use the venue name.' },
    { section: 'venue', field: 'subtitle', label: 'Subtitle' },
    { section: 'venue', field: 'description', label: 'About the venue', multiline: true },
    { section: 'venue', field: 'imageUrl', label: 'Venue photo URL (https://…)' },
  ],
  theday: [
    { section: 'theday', field: 'heading', label: 'Section heading' },
    { section: 'theday', field: 'dressCode', label: 'Dress code' },
    { section: 'theday', field: 'dressCodeNote', label: 'Dress code note', multiline: true },
    { section: 'theday', field: 'venueDescription', label: 'Arrival information', multiline: true },
  ],
  travel: [
    { section: 'travel', field: 'heading', label: 'Section heading' },
    { section: 'travel', field: 'subtitle', label: 'Subtitle' },
  ],
  guide: [{ section: 'guide', field: 'heading', label: 'Guest guide heading' }],
  gifts: [
    { section: 'registry', field: 'heading', label: 'Section heading (gift cards)' },
    { section: 'registry', field: 'subtitle', label: 'Subtitle (gift cards)' },
  ],
  gallery: [
    { section: 'gallery', field: 'heading', label: 'Section heading' },
    { section: 'gallery', field: 'subtitle', label: 'Subtitle' },
  ],
  songbook: [
    { section: 'songbook', field: 'heading', label: 'Section heading' },
    { section: 'songbook', field: 'subtitle', label: 'Subtitle' },
  ],
  faq: [
    { section: 'faq', field: 'heading', label: 'Section heading' },
    { section: 'faq', field: 'subtitle', label: 'Subtitle' },
  ],
}

const SECTION_NOTES: Partial<Record<SiteSectionKey, string>> = {
  venue: 'The venue name and location come from Wedding details above.',
  theday: 'The programme comes from the planner’s wedding-day programme — the same one the apps show.',
  rsvp: 'RSVP is personal to each invited guest and is managed from guest invitations.',
  gifts: 'Contribution campaigns are managed in the planner. Gift cards below show only when no campaign is active.',
  gallery: 'Photos come from this wedding’s media library.',
  songbook: 'Songs come from the planner’s songbook.',
  share: 'Guests can share the website link. No settings needed.',
}

const HERO_COPY: CopySpec[] = [{ section: 'hero', field: 'imageUrl', label: 'Cover photo URL (https://…)' }]

function kindsFor(section: SiteSectionKey): SiteItemKind[] {
  return (Object.keys(SITE_ITEM_KINDS) as SiteItemKind[]).filter((kind) => SITE_ITEM_KINDS[kind] === section)
}

export function SiteEditor({ slug, initial }: { slug: string; initial: EditorSiteProjection }) {
  const [data, setData] = useState(initial)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setData(await loadEditorProjection(slug))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not reload the editor.')
    }
  }, [slug])

  const published = (section: string, field: string) => {
    const row = data.scalars.find((entry) => entry.section === section && entry.field === field)
    return row ? { value: row.value, updatedAt: row.updatedAt } : null
  }
  const draft = (section: string, field: string) => {
    const row = data.drafts.find((entry) => entry.section === section && entry.field === field)
    return row ? { value: row.value, updatedAt: row.updatedAt } : null
  }

  async function saveSections(next: EditorSiteProjection['sections'], message: string) {
    setBusy(true)
    try {
      await editorRequest(slug, '/site/sections', {
        method: 'PATCH',
        body: { sections: next.map((section, index) => ({ key: section.key, enabled: section.enabled, order: index * 10 })) },
      })
      setStatus(message)
      await refresh()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  function moveSection(index: number, delta: number) {
    const next = [...data.sections]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    void saveSections(next, 'Section order saved.')
  }

  const renderCopy = (specs: CopySpec[]) =>
    specs.map((spec) => (
      <CopyField
        key={`${spec.section}.${spec.field}`}
        slug={slug}
        section={spec.section}
        field={spec.field}
        label={spec.label}
        hint={spec.hint}
        multiline={spec.multiline}
        published={published(spec.section, spec.field)}
        draft={draft(spec.section, spec.field)}
        onChanged={refresh}
        onStatus={setStatus}
      />
    ))

  const panel = 'scroll-mt-24 rounded-3xl border border-gold/20 bg-ivory p-5 sm:p-7'

  return (
    <div className="min-h-screen bg-champagne/40">
      <header className="sticky top-0 z-30 border-b border-gold/20 bg-espresso/95 px-4 py-3 text-champagne backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-sans text-[10px] uppercase tracking-[0.28em] text-gold/80">Website editor</p>
            <h1 className="truncate font-serif text-xl">
              {data.core.partner1} &amp; {data.core.partner2}
            </h1>
          </div>
          <a href={`/w/${encodeURIComponent(slug)}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gold/40 px-4 font-sans text-xs uppercase tracking-[0.14em] hover:text-gold">
            View website <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
        <p role="status" aria-live="polite" className="mx-auto mt-2 min-h-5 max-w-5xl font-sans text-xs text-champagne/85" data-testid="editor-status">
          {status}
        </p>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-8">
        <section id="essentials" className={panel} aria-labelledby="essentials-heading">
          <h2 id="essentials-heading" className="wewed-heading text-2xl font-light text-espresso">Wedding details</h2>
          <p className="mt-1 mb-5 font-sans text-sm text-espresso/60">Names, date and venue — shared by the website, invitation and apps.</p>
          <EssentialsForm key={`${data.core.weddingUpdatedAt}|${data.core.coupleUpdatedAt}`} slug={slug} core={data.core} onChanged={refresh} onStatus={setStatus} />
          <div className="mt-6 grid gap-3">{renderCopy(HERO_COPY)}</div>
        </section>

        <section id="announcements" className={panel} aria-labelledby="announcements-heading">
          <h2 id="announcements-heading" className="wewed-heading text-2xl font-light text-espresso">Announcements</h2>
          <p className="mt-1 mb-5 font-sans text-sm text-espresso/60">Published announcements appear on the website and in the Wedding Day view of the apps.</p>
          <AnnouncementsPanel slug={slug} announcements={data.announcements} onChanged={refresh} onStatus={setStatus} />
        </section>

        <section id="earlier-content" className={panel} aria-labelledby="earlier-content-heading">
          <h2 id="earlier-content-heading" className="wewed-heading text-2xl font-light text-espresso">Earlier content</h2>
          <p className="mt-1 mb-4 font-sans text-sm text-espresso/60">
            Bring list content saved by the previous website (story moments, questions, travel cards and similar) into the
            editor below. Imported items stay hidden from guests until you review and publish each one.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                const result = await editorRequest<{ created: number }>(slug, '/site/import-legacy', { method: 'POST' })
                setStatus(result.created ? `${result.created} earlier item(s) imported as hidden drafts.` : 'Nothing new to import.')
                await refresh()
              } catch (error) {
                setStatus(error instanceof Error ? error.message : 'Something went wrong.')
              } finally {
                setBusy(false)
              }
            }}
            className="min-h-11 rounded-full border border-gold/40 px-5 font-sans text-xs uppercase tracking-[0.14em] text-espresso disabled:opacity-40"
          >
            Import earlier content (hidden)
          </button>
        </section>

        <section id="sections" className={panel} aria-labelledby="sections-heading">
          <h2 id="sections-heading" className="wewed-heading text-2xl font-light text-espresso">Sections</h2>
          <p className="mt-1 mb-5 font-sans text-sm text-espresso/60">
            Choose which sections your website shows and in what order. Sections with nothing published stay hidden from guests.
          </p>
          <ol className="grid gap-2">
            {data.sections.map((section, index) => (
              <li key={section.key} className="flex items-center gap-2 rounded-xl border border-gold/15 bg-white/70 px-3 py-1">
                <a href={`#${section.key}`} className="min-w-0 flex-1 truncate font-sans text-sm text-espresso hover:text-gold">
                  {SITE_SECTION_LABELS[section.key]}
                </a>
                <label className="flex min-h-11 items-center gap-2 font-sans text-xs text-espresso/70">
                  <input
                    type="checkbox"
                    checked={section.enabled}
                    disabled={busy}
                    onChange={() =>
                      void saveSections(
                        data.sections.map((row) => (row.key === section.key ? { ...row, enabled: !row.enabled } : row)),
                        `${SITE_SECTION_LABELS[section.key]} ${section.enabled ? 'hidden' : 'shown'}.`,
                      )
                    }
                    className="h-4 w-4 accent-[#8b6f47]"
                  />
                  Show
                </label>
                <button type="button" disabled={busy || index === 0} onClick={() => moveSection(index, -1)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-gold/10 disabled:opacity-30" aria-label={`Move ${SITE_SECTION_LABELS[section.key]} up`}>
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button" disabled={busy || index === data.sections.length - 1} onClick={() => moveSection(index, 1)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-gold/10 disabled:opacity-30" aria-label={`Move ${SITE_SECTION_LABELS[section.key]} down`}>
                  <ArrowDown className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ol>
        </section>

        {data.sections.map((section) => {
          const copy = SECTION_COPY[section.key] ?? []
          const kinds = kindsFor(section.key)
          const note = SECTION_NOTES[section.key]
          if (!copy.length && !kinds.length && !note) return null
          return (
            <section key={section.key} id={section.key} className={panel} aria-labelledby={`${section.key}-editor-heading`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`${section.key}-editor-heading`} className="wewed-heading text-2xl font-light text-espresso">
                  {SITE_SECTION_LABELS[section.key]}
                </h2>
                <span className="font-sans text-[11px] uppercase tracking-[0.14em] text-espresso/50">
                  {section.enabled ? 'Shown' : 'Hidden'}
                </span>
              </div>
              {note ? <p className="mt-1 font-sans text-sm text-espresso/60">{note}</p> : null}
              {copy.length ? <div className="mt-5 grid gap-3">{renderCopy(copy)}</div> : null}
              {kinds.length ? (
                <div className="mt-6">
                  <ItemList
                    slug={slug}
                    sectionKey={section.key}
                    kinds={kinds}
                    items={data.items.filter((item) => item.sectionKey === section.key)}
                    media={data.media}
                    onChanged={refresh}
                    onStatus={setStatus}
                  />
                </div>
              ) : null}
            </section>
          )
        })}
      </main>
    </div>
  )
}
