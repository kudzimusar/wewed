'use client'

import { useId, useState } from 'react'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { editorRequest, EditorRequestError } from '@/components/wedding/site-editor/api'
import type { EditorSiteItem, EditorSiteProjection, SiteItemKind, SiteSectionKey } from '@/lib/wedding-site/model'

type Media = EditorSiteProjection['media'][number]

export const ITEM_KIND_COPY: Record<SiteItemKind, { label: string; titleLabel: string; bodyLabel: string; metadata: Array<{ key: string; label: string }>; url: boolean; media: boolean }> = {
  story_milestone: { label: 'Story moment', titleLabel: 'Title', bodyLabel: 'Story', metadata: [{ key: 'date', label: 'When (e.g. June 2019)' }], url: false, media: true },
  party_profile: { label: 'Wedding party member', titleLabel: 'Name', bodyLabel: 'A few words', metadata: [{ key: 'role', label: 'Role (e.g. Best man)' }], url: false, media: true },
  venue_feature: { label: 'Venue highlight', titleLabel: 'Highlight', bodyLabel: 'Details', metadata: [], url: false, media: false },
  venue_moment: { label: 'Venue moment', titleLabel: 'Moment', bodyLabel: 'Details', metadata: [], url: false, media: false },
  travel_card: { label: 'Travel or stay', titleLabel: 'Name', bodyLabel: 'Details for guests', metadata: [{ key: 'category', label: 'Type (e.g. Hotel, Airport)' }, { key: 'detail', label: 'Short detail (e.g. 15 minutes from venue)' }], url: true, media: false },
  guide_entry: { label: 'Guest guide entry', titleLabel: 'Topic', bodyLabel: 'Guidance', metadata: [{ key: 'category', label: 'Category' }], url: true, media: false },
  registry_card: { label: 'Gift card', titleLabel: 'Title', bodyLabel: 'Description', metadata: [], url: true, media: false },
  faq_item: { label: 'Question', titleLabel: 'Question', bodyLabel: 'Answer', metadata: [], url: false, media: false },
}

/** Suggested wedding-party roles; the couple may type any other role. */
export const PARTY_ROLES = ['Best Man', 'Best Woman', 'Maid of Honour', 'Matron of Honour', 'Bridesmaid', 'Groomsman', 'Flower Girl', 'Page Boy', 'Ring Bearer', 'MC']

const field =
  'w-full rounded-xl border border-gold/30 bg-white px-3 py-2.5 font-sans text-sm text-espresso focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30'

function metaValue(item: EditorSiteItem | null, key: string): string {
  const value = item?.metadata?.[key]
  return typeof value === 'string' ? value : ''
}

function ItemForm({
  kind,
  item,
  media,
  busy,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  kind: SiteItemKind
  item: EditorSiteItem | null
  media: Media[]
  busy: boolean
  onSubmit: (values: { title: string; body: string; url: string; mediaId: string; metadata: Record<string, string> }) => void
  onCancel?: () => void
  submitLabel: string
}) {
  const copy = ITEM_KIND_COPY[kind]
  const id = useId()
  const [title, setTitle] = useState(item?.title ?? '')
  const [body, setBody] = useState(item?.body ?? '')
  const [url, setUrl] = useState(item?.url ?? '')
  const [mediaId, setMediaId] = useState(item?.media?.id ?? '')
  const [metadata, setMetadata] = useState<Record<string, string>>(
    Object.fromEntries(copy.metadata.map((entry) => [entry.key, metaValue(item, entry.key)])),
  )
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({ title, body, url, mediaId, metadata })
      }}
    >
      <label className="grid gap-1 font-sans text-xs text-espresso/70" htmlFor={`${id}-title`}>
        {copy.titleLabel}
        <input id={`${id}-title`} required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} className={field} />
      </label>
      {copy.metadata.map((entry) => (
        <label key={entry.key} className="grid gap-1 font-sans text-xs text-espresso/70" htmlFor={`${id}-${entry.key}`}>
          {entry.label}
          <input
            id={`${id}-${entry.key}`}
            list={kind === 'party_profile' && entry.key === 'role' ? `${id}-roles` : undefined}
            value={metadata[entry.key] ?? ''}
            onChange={(event) => setMetadata({ ...metadata, [entry.key]: event.target.value })}
            className={field}
          />
          {kind === 'party_profile' && entry.key === 'role' ? (
            <datalist id={`${id}-roles`}>
              {PARTY_ROLES.map((role) => (
                <option key={role} value={role} />
              ))}
            </datalist>
          ) : null}
        </label>
      ))}
      <label className="grid gap-1 font-sans text-xs text-espresso/70" htmlFor={`${id}-body`}>
        {copy.bodyLabel}
        <textarea id={`${id}-body`} rows={4} value={body} onChange={(event) => setBody(event.target.value)} className={field} />
      </label>
      {copy.url ? (
        <label className="grid gap-1 font-sans text-xs text-espresso/70" htmlFor={`${id}-url`}>
          Link (optional, https://…)
          <input id={`${id}-url`} type="url" value={url} onChange={(event) => setUrl(event.target.value)} className={field} />
        </label>
      ) : null}
      {copy.media ? (
        <label className="grid gap-1 font-sans text-xs text-espresso/70" htmlFor={`${id}-media`}>
          Photo from this wedding&apos;s media (optional)
          <select id={`${id}-media`} value={mediaId} onChange={(event) => setMediaId(event.target.value)} className={field}>
            <option value="">No photo</option>
            {media.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.caption || entry.url.split('/').pop() || entry.id}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !title.trim()} className="min-h-11 rounded-full bg-espresso px-4 font-sans text-xs uppercase tracking-[0.14em] text-champagne disabled:opacity-40">
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="min-h-11 rounded-full px-4 font-sans text-xs uppercase tracking-[0.14em] text-espresso/70">
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  )
}

export function ItemList({
  slug,
  sectionKey,
  kinds,
  items,
  media,
  onChanged,
  onStatus,
}: {
  slug: string
  sectionKey: SiteSectionKey
  kinds: SiteItemKind[]
  items: EditorSiteItem[]
  media: Media[]
  onChanged: () => Promise<void>
  onStatus: (message: string) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState<SiteItemKind | null>(null)
  const [busy, setBusy] = useState(false)

  async function act(label: string, work: () => Promise<unknown>) {
    setBusy(true)
    try {
      await work()
      onStatus(label)
      setEditing(null)
      setAdding(null)
      await onChanged()
    } catch (error) {
      onStatus(
        error instanceof EditorRequestError && error.conflict
          ? 'This item was changed on another device. The latest version is loaded — please review and try again.'
          : error instanceof Error
            ? error.message
            : 'Something went wrong.',
      )
      if (error instanceof EditorRequestError && error.conflict) await onChanged()
    } finally {
      setBusy(false)
    }
  }

  function move(index: number, delta: number) {
    const ids = items.map((item) => item.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    void act('Order saved.', () => editorRequest(slug, '/site/items/reorder', { method: 'POST', body: { section: sectionKey, ids } }))
  }

  return (
    <div className="grid gap-3">
      {items.length === 0 ? (
        <p className="font-sans text-sm text-espresso/60">Nothing added yet.</p>
      ) : (
        <ol className="grid gap-3">
          {items.map((item, index) => (
            <li key={item.id} className="rounded-2xl border border-gold/20 bg-white/70 p-4" data-site-item={item.id}>
              {editing === item.id ? (
                <ItemForm
                  kind={item.kind}
                  item={item}
                  media={media}
                  busy={busy}
                  submitLabel="Save"
                  onCancel={() => setEditing(null)}
                  onSubmit={(values) =>
                    void act(`${ITEM_KIND_COPY[item.kind].label} saved.`, () =>
                      editorRequest(slug, `/site/items/${encodeURIComponent(item.id)}`, {
                        method: 'PATCH',
                        body: {
                          expectedUpdatedAt: item.updatedAt,
                          title: values.title,
                          body: values.body,
                          ...(ITEM_KIND_COPY[item.kind].url ? { url: values.url } : {}),
                          ...(ITEM_KIND_COPY[item.kind].media ? { mediaId: values.mediaId || null } : {}),
                          metadata: { ...item.metadata, ...values.metadata },
                        },
                      }),
                    )
                  }
                />
              ) : (
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-espresso/50">
                      {ITEM_KIND_COPY[item.kind].label} · {item.enabled ? 'Visible to guests' : 'Hidden from guests'}
                    </p>
                    <p className="mt-1 font-serif text-lg text-espresso">{item.title}</p>
                    {item.body ? <p className="mt-1 line-clamp-3 whitespace-pre-line font-sans text-sm text-espresso/65">{item.body}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <button type="button" disabled={busy || index === 0} onClick={() => move(index, -1)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-espresso/70 hover:bg-gold/10 disabled:opacity-30" aria-label={`Move ${item.title} up`}>
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button type="button" disabled={busy || index === items.length - 1} onClick={() => move(index, 1)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-espresso/70 hover:bg-gold/10 disabled:opacity-30" aria-label={`Move ${item.title} down`}>
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void act(item.enabled ? 'Hidden from guests.' : 'Now visible to guests.', () =>
                          editorRequest(slug, `/site/items/${encodeURIComponent(item.id)}`, {
                            method: 'PATCH',
                            body: { expectedUpdatedAt: item.updatedAt, enabled: !item.enabled },
                          }),
                        )
                      }
                      className={`min-h-11 rounded-full px-4 font-sans text-xs uppercase tracking-[0.12em] ${item.enabled ? 'border border-gold/40 text-espresso' : 'bg-espresso text-champagne'}`}
                    >
                      {item.enabled ? 'Hide' : 'Publish'}
                    </button>
                    <button type="button" disabled={busy} onClick={() => setEditing(item.id)} className="min-h-11 rounded-full px-4 font-sans text-xs uppercase tracking-[0.12em] text-espresso/80 hover:bg-gold/10">
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return
                        void act('Deleted.', () => editorRequest(slug, `/site/items/${encodeURIComponent(item.id)}`, { method: 'DELETE' }))
                      }}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-clay hover:bg-clay/10"
                      aria-label={`Delete ${item.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {adding ? (
        <div className="rounded-2xl border border-dashed border-gold/40 bg-champagne/30 p-4">
          <p className="mb-3 font-sans text-sm font-medium text-espresso">New {ITEM_KIND_COPY[adding].label.toLowerCase()} (saved hidden until you publish it)</p>
          <ItemForm
            kind={adding}
            item={null}
            media={media}
            busy={busy}
            submitLabel="Add"
            onCancel={() => setAdding(null)}
            onSubmit={(values) =>
              void act(`${ITEM_KIND_COPY[adding].label} added — publish it when ready.`, () =>
                editorRequest(slug, '/site/items', {
                  method: 'POST',
                  body: {
                    kind: adding,
                    title: values.title,
                    body: values.body,
                    ...(ITEM_KIND_COPY[adding].url ? { url: values.url || null } : {}),
                    ...(ITEM_KIND_COPY[adding].media ? { mediaId: values.mediaId || null } : {}),
                    metadata: Object.fromEntries(Object.entries(values.metadata).filter(([, value]) => value.trim())),
                  },
                }),
              )
            }
          />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {kinds.map((kind) => (
            <button key={kind} type="button" onClick={() => setAdding(kind)} className="min-h-11 rounded-full border border-gold/40 px-4 font-sans text-xs uppercase tracking-[0.12em] text-espresso hover:bg-gold/10">
              + Add {ITEM_KIND_COPY[kind].label.toLowerCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
