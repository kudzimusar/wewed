'use client'

import { FormEvent, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Loader2, Pencil, Send, X } from 'lucide-react'

type DashboardRole = 'admin' | 'couple' | 'planner' | 'vendor'

interface Contact {
  id: string
  name: string
  email: string
  role: DashboardRole
  defaultType: string
  context: 'wedding' | 'wewed'
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as T | null
  if (!payload) throw new Error('Wewed returned an unreadable response.')
  return payload
}

function roleLabel(contact: Contact): string {
  if (contact.role === 'admin') return 'Wewed'
  return contact.role.charAt(0).toUpperCase() + contact.role.slice(1)
}

export default function MessagesNewMessageLauncher() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactId, setContactId] = useState('')
  const [message, setMessage] = useState('')
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isMessagesInbox = pathname === '/messages'

  useEffect(() => {
    if (!open || !isMessagesInbox) return

    const controller = new AbortController()
    setLoadingContacts(true)
    setError(null)

    void (async () => {
      try {
        const response = await fetch('/api/communications/contacts', {
          cache: 'no-store',
          signal: controller.signal,
        })
        const payload = await readJson<{
          success: boolean
          data?: Contact[]
          error?: string
        }>(response)
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Unable to load people you can message.')
        }
        setContacts(payload.data ?? [])
      } catch (loadError) {
        if (controller.signal.aborted) return
        setContacts([])
        setError(loadError instanceof Error ? loadError.message : 'Unable to load contacts.')
      } finally {
        if (!controller.signal.aborted) setLoadingContacts(false)
      }
    })()

    return () => controller.abort()
  }, [isMessagesInbox, open])

  useEffect(() => {
    if (isMessagesInbox) return
    setOpen(false)
    setContactId('')
    setMessage('')
    setError(null)
  }, [isMessagesInbox])

  function closeComposer() {
    if (sending) return
    setOpen(false)
    setContactId('')
    setMessage('')
    setError(null)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const contact = contacts.find((candidate) => candidate.id === contactId)
    const body = message.trim()
    if (!contact || !body || sending) return

    setSending(true)
    setError(null)
    try {
      const response = await fetch('/api/communications/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantIds: [contact.id],
          type: contact.defaultType,
          initialMessage: body,
        }),
      })
      const payload = await readJson<{
        success: boolean
        data?: { id: string; reused: boolean }
        error?: string
      }>(response)
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || 'Unable to start this conversation.')
      }

      setOpen(false)
      setContactId('')
      setMessage('')
      window.location.assign('/messages')
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to start this conversation.')
    } finally {
      setSending(false)
    }
  }

  if (!isMessagesInbox) return null

  return (
    <>
      <button
        type="button"
        data-communications-new-message-cta="true"
        onClick={() => setOpen(true)}
        className="fixed right-[6.25rem] top-3 z-[80] inline-flex h-10 items-center gap-2 rounded-full bg-espresso px-3 text-xs font-bold text-champagne shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:px-3.5 lg:right-[7.5rem] lg:top-8"
        aria-label="New message"
        aria-haspopup="dialog"
      >
        <Pencil className="size-4 shrink-0" />
        <span className="hidden min-[430px]:inline">New message</span>
        <span className="min-[430px]:hidden">New</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-espresso/45 p-3 backdrop-blur-[2px] sm:items-center sm:p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeComposer()
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-message-title"
            className="w-full max-w-lg rounded-[24px] border border-gold/20 bg-white p-4 text-espresso shadow-2xl sm:p-5"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Wewed messages</p>
                <h2 id="new-message-title" className="mt-1 font-serif text-2xl font-semibold">New message</h2>
                <p className="mt-1 text-sm text-espresso/55">Choose an available Wewed contact and send the first message.</p>
              </div>
              <button
                type="button"
                onClick={closeComposer}
                disabled={sending}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-espresso/55 transition hover:bg-champagne/45 hover:text-espresso disabled:opacity-40"
                aria-label="Close new message"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-3.5">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-espresso/50">To</span>
                {loadingContacts ? (
                  <div className="flex h-11 items-center rounded-xl border border-gold/15 bg-ivory/40 px-3 text-sm text-espresso/50">
                    <Loader2 className="mr-2 size-4 animate-spin" /> Loading contacts…
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="rounded-xl border border-gold/15 bg-ivory/40 px-3 py-3 text-sm text-espresso/55">
                    No available contacts yet.
                  </div>
                ) : (
                  <select
                    value={contactId}
                    onChange={(event) => setContactId(event.target.value)}
                    className="h-11 w-full rounded-xl border border-gold/20 bg-white px-3 text-sm outline-none transition focus:border-gold"
                    aria-label="Choose someone to message"
                  >
                    <option value="">Choose a person…</option>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name} · {roleLabel(contact)}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-espresso/50">Message</span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={4000}
                  rows={4}
                  placeholder="Write your message…"
                  className="w-full resize-none rounded-xl border border-gold/20 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-espresso/35 focus:border-gold"
                />
                <div className="mt-1 min-h-4 text-right text-[10px] text-espresso/35">
                  {message.length >= 3600 ? `${message.length}/4000` : ''}
                </div>
              </label>

              {error ? (
                <div className="rounded-xl border border-clay/25 bg-clay/10 px-3 py-2.5 text-sm" role="alert">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={!contactId || !message.trim() || loadingContacts || sending}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-espresso px-4 text-sm font-bold text-champagne transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {sending ? 'Sending…' : 'Send message'}
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  )
}
