'use client'

import { useState } from 'react'
import { editorRequest, EditorRequestError } from '@/components/wedding/site-editor/api'
import type { AnnouncementAudience, EditorAnnouncement } from '@/lib/wedding-site/model'

const field =
  'w-full rounded-xl border border-gold/30 bg-white px-3 py-2.5 font-sans text-sm text-espresso focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30'

/** Announcements reach the website and native Wedding Day only once published. */
export function AnnouncementsPanel({
  slug,
  announcements,
  onChanged,
  onStatus,
}: {
  slug: string
  announcements: EditorAnnouncement[]
  onChanged: () => Promise<void>
  onStatus: (message: string) => void
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<AnnouncementAudience>('guests')
  const [busy, setBusy] = useState(false)

  async function act(message: string, work: () => Promise<unknown>) {
    setBusy(true)
    try {
      await work()
      onStatus(message)
      await onChanged()
    } catch (error) {
      onStatus(
        error instanceof EditorRequestError && error.conflict
          ? 'This announcement was changed on another device. The latest version is loaded.'
          : error instanceof Error
            ? error.message
            : 'Something went wrong.',
      )
      if (error instanceof EditorRequestError && error.conflict) await onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4">
      {announcements.length ? (
        <ul className="grid gap-3">
          {announcements.map((item) => (
            <li key={item.id} className="rounded-2xl border border-gold/20 bg-white/70 p-4" data-announcement={item.id}>
              <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-espresso/50">
                {item.status === 'published' ? 'Published' : item.status === 'archived' ? 'Archived' : 'Draft'} ·{' '}
                {item.audience === 'attending' ? 'Attending guests only' : 'All guests'}
              </p>
              <p className="mt-1 font-serif text-lg text-espresso">{item.title}</p>
              <p className="mt-1 whitespace-pre-line font-sans text-sm text-espresso/65">{item.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.status !== 'published' ? (
                  <button type="button" disabled={busy} onClick={() => void act('Announcement published.', () => editorRequest(slug, `/announcements/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: { expectedUpdatedAt: item.updatedAt, status: 'published' } }))} className="min-h-11 rounded-full bg-espresso px-4 font-sans text-xs uppercase tracking-[0.12em] text-champagne">
                    Publish
                  </button>
                ) : (
                  <button type="button" disabled={busy} onClick={() => void act('Announcement archived — guests no longer see it.', () => editorRequest(slug, `/announcements/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: { expectedUpdatedAt: item.updatedAt, status: 'archived' } }))} className="min-h-11 rounded-full border border-gold/40 px-4 font-sans text-xs uppercase tracking-[0.12em] text-espresso">
                    Archive
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Delete “${item.title}”?`)) return
                    void act('Announcement deleted.', () => editorRequest(slug, `/announcements/${encodeURIComponent(item.id)}`, { method: 'DELETE' }))
                  }}
                  className="min-h-11 rounded-full px-4 font-sans text-xs uppercase tracking-[0.12em] text-clay"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-sans text-sm text-espresso/60">No announcements yet.</p>
      )}

      <form
        className="grid gap-3 rounded-2xl border border-dashed border-gold/40 bg-champagne/30 p-4"
        onSubmit={(event) => {
          event.preventDefault()
          void act('Announcement saved as a draft.', async () => {
            await editorRequest(slug, '/announcements', { method: 'POST', body: { title, body, audience, status: 'draft' } })
            setTitle('')
            setBody('')
          })
        }}
      >
        <p className="font-sans text-sm font-medium text-espresso">New announcement</p>
        <label className="grid gap-1 font-sans text-xs text-espresso/70">
          Title
          <input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} className={field} />
        </label>
        <label className="grid gap-1 font-sans text-xs text-espresso/70">
          Message
          <textarea required rows={3} value={body} onChange={(event) => setBody(event.target.value)} className={field} />
        </label>
        <label className="grid gap-1 font-sans text-xs text-espresso/70">
          Who sees it
          <select value={audience} onChange={(event) => setAudience(event.target.value as AnnouncementAudience)} className={field}>
            <option value="guests">All guests</option>
            <option value="attending">Guests who have said they&apos;re attending</option>
          </select>
        </label>
        <div>
          <button type="submit" disabled={busy || !title.trim() || !body.trim()} className="min-h-11 rounded-full border border-gold/40 px-4 font-sans text-xs uppercase tracking-[0.14em] text-espresso disabled:opacity-40">
            Save draft
          </button>
        </div>
      </form>
    </div>
  )
}
