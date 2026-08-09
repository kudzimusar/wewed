'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CirclePlus,
  Inbox,
  Loader2,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react'

type DashboardRole = 'admin' | 'couple' | 'planner'

interface Participant {
  userId: string
  name: string
  email: string
  role: string
}

interface Conversation {
  id: string
  kind: 'DIRECT' | 'GROUP'
  type: string
  title: string | null
  weddingId: string | null
  status: string
  createdAt: string
  lastMessageAt: string | null
  lastMessageBody: string | null
  lastMessageSenderName: string | null
  lastReadAt: string | null
  unreadCount: number
  participants: Participant[]
}

interface ThreadMessage {
  id: string
  conversationId: string
  senderUserId: string | null
  senderName: string | null
  senderRole: string | null
  messageType: string
  visibility: 'PARTICIPANTS' | 'STAFF_ONLY'
  body: string
  replyToMessageId: string | null
  createdAt: string
  editedAt: string | null
}

interface Contact {
  id: string
  name: string
  email: string
  role: DashboardRole
  defaultType: string
  context: 'wedding' | 'wewed'
}

interface CurrentUser {
  accessUserId: string
  displayName: string | null
  email: string
  role: DashboardRole
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as T | null
  if (!body) throw new Error('Wewed returned an unreadable response.')
  return body
}

function timeLabel(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function roleHome(role: DashboardRole | null): string {
  if (role === 'admin') return '/admin'
  if (role === 'couple') return '/couple'
  return '/planner'
}

export default function MessagesPage() {
  const [me, setMe] = useState<CurrentUser | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [draft, setDraft] = useState('')
  const [internalNote, setInternalNote] = useState(false)
  const [newContactId, setNewContactId] = useState('')
  const [loading, setLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId],
  )

  const conversationName = useCallback((conversation: Conversation) => {
    if (conversation.title) return conversation.title
    const others = conversation.participants.filter(
      (participant) => participant.userId !== me?.accessUserId,
    )
    if (others.length === 0) return 'Wewed conversation'
    return others.map((participant) => participant.name).join(', ')
  }, [me?.accessUserId])

  const loadMe = useCallback(async () => {
    const response = await fetch('/api/auth/me', { cache: 'no-store' })
    const payload = await readJson<{
      authorized?: boolean
      user?: CurrentUser | null
    }>(response)
    if (!response.ok || !payload.authorized || !payload.user) {
      throw new Error('Sign in to use Wewed Messages.')
    }
    setMe(payload.user)
  }, [])

  const loadContacts = useCallback(async () => {
    const response = await fetch('/api/communications/contacts', { cache: 'no-store' })
    const payload = await readJson<{ success: boolean; data?: Contact[]; error?: string }>(response)
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Unable to load people you can message.')
    }
    setContacts(payload.data ?? [])
  }, [])

  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setError(null)
    const response = await fetch('/api/communications/conversations', { cache: 'no-store' })
    const payload = await readJson<{ success: boolean; data?: Conversation[]; error?: string }>(response)
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Unable to load conversations.')
    }
    const next = payload.data ?? []
    setConversations(next)
    setSelectedId((current) => current ?? next[0]?.id ?? null)
  }, [])

  const loadMessages = useCallback(async (conversationId: string, silent = false) => {
    if (!silent) setThreadLoading(true)
    try {
      const response = await fetch(
        `/api/communications/conversations/${encodeURIComponent(conversationId)}/messages`,
        { cache: 'no-store' },
      )
      const payload = await readJson<{ success: boolean; data?: ThreadMessage[]; error?: string }>(response)
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to load messages.')
      }
      setMessages(payload.data ?? [])
      await fetch(
        `/api/communications/conversations/${encodeURIComponent(conversationId)}/read`,
        { method: 'POST' },
      ).catch(() => undefined)
    } finally {
      if (!silent) setThreadLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function initialLoad() {
      setLoading(true)
      try {
        await Promise.all([loadMe(), loadContacts(), loadConversations()])
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load Wewed Messages.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void initialLoad()
    return () => { cancelled = true }
  }, [loadContacts, loadConversations, loadMe])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }
    setInternalNote(false)
    void loadMessages(selectedId).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load messages.')
    })
  }, [loadMessages, selectedId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void loadConversations(true).catch(() => undefined)
      if (selectedId) void loadMessages(selectedId, true).catch(() => undefined)
    }, 8000)
    return () => window.clearInterval(timer)
  }, [loadConversations, loadMessages, selectedId])

  async function createConversation() {
    if (!newContactId) return
    const contact = contacts.find((item) => item.id === newContactId)
    if (!contact) return
    setCreating(true)
    setError(null)
    try {
      const response = await fetch('/api/communications/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantIds: [contact.id],
          type: contact.defaultType,
        }),
      })
      const payload = await readJson<{
        success: boolean
        data?: { id: string; reused: boolean }
        error?: string
      }>(response)
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || 'Unable to start conversation.')
      }
      setNewContactId('')
      await loadConversations(true)
      setSelectedId(payload.data.id)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to start conversation.')
    } finally {
      setCreating(false)
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault()
    const body = draft.trim()
    if (!selectedId || !body || sending) return
    setSending(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/communications/conversations/${encodeURIComponent(selectedId)}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body, internalNote }),
        },
      )
      const payload = await readJson<{ success: boolean; error?: string }>(response)
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to send message.')
      }
      setDraft('')
      setInternalNote(false)
      await Promise.all([loadMessages(selectedId, true), loadConversations(true)])
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send message.')
    } finally {
      setSending(false)
    }
  }

  async function refresh() {
    setError(null)
    try {
      await Promise.all([
        loadConversations(true),
        loadContacts(),
        selectedId ? loadMessages(selectedId, true) : Promise.resolve(),
      ])
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh.')
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-ivory px-6 py-16 text-espresso">
        <div className="mx-auto flex max-w-6xl items-center justify-center rounded-3xl border border-gold/20 bg-white/80 p-16 shadow-sm">
          <Loader2 className="mr-3 size-5 animate-spin text-gold" />
          Loading Wewed Messages…
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-ivory px-3 py-4 text-espresso sm:px-6 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={roleHome(me?.role ?? null)}
              className="inline-flex size-10 items-center justify-center rounded-full border border-gold/25 bg-white text-espresso hover:border-gold"
              aria-label="Back to workspace"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <MessageCircle className="size-5 text-gold" />
                <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Messages</h1>
              </div>
              <p className="text-xs text-espresso/55 sm:text-sm">
                Conversations stay connected to Wewed. External channels are optional delivery layers.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-white px-4 py-2 text-sm font-semibold hover:border-gold"
          >
            <RefreshCw className="size-4" /> Refresh
          </button>
        </header>

        {error ? (
          <div className="mb-4 rounded-2xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-espresso" role="alert">
            {error}
          </div>
        ) : null}

        <section className="grid min-h-[72vh] overflow-hidden rounded-3xl border border-gold/20 bg-white shadow-sm lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="border-b border-gold/15 bg-champagne/20 lg:border-b-0 lg:border-r">
            <div className="border-b border-gold/15 p-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-espresso/50">
                Start a conversation
              </label>
              <div className="flex gap-2">
                <select
                  value={newContactId}
                  onChange={(event) => setNewContactId(event.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-gold/20 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
                  aria-label="Choose someone to message"
                >
                  <option value="">Choose a person…</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name} · {contact.role === 'admin' ? 'Wewed' : contact.role}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void createConversation()}
                  disabled={!newContactId || creating}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-espresso text-champagne disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Start conversation"
                >
                  {creating ? <Loader2 className="size-4 animate-spin" /> : <CirclePlus className="size-4" />}
                </button>
              </div>
            </div>

            <div className="max-h-[64vh] overflow-y-auto lg:max-h-[calc(72vh-92px)]">
              {conversations.length === 0 ? (
                <div className="p-8 text-center text-sm text-espresso/55">
                  <Inbox className="mx-auto mb-3 size-8 text-gold/60" />
                  No conversations yet. Choose someone above to start one.
                </div>
              ) : conversations.map((conversation) => {
                const active = conversation.id === selectedId
                return (
                  <button
                    type="button"
                    key={conversation.id}
                    onClick={() => setSelectedId(conversation.id)}
                    className={`w-full border-b border-gold/10 px-4 py-4 text-left transition ${active ? 'bg-white' : 'hover:bg-white/70'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {conversation.kind === 'GROUP' ? <Users className="size-4 shrink-0 text-gold" /> : null}
                          <p className="truncate font-semibold">{conversationName(conversation)}</p>
                        </div>
                        <p className="mt-1 truncate text-xs text-espresso/55">
                          {conversation.lastMessageBody
                            ? `${conversation.lastMessageSenderName ?? 'Wewed'}: ${conversation.lastMessageBody}`
                            : conversation.type.replaceAll('_', ' ').toLowerCase()}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-espresso/40">{timeLabel(conversation.lastMessageAt)}</p>
                        {conversation.unreadCount > 0 ? (
                          <span className="mt-1 inline-flex min-w-5 items-center justify-center rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-espresso">
                            {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>

          <div className="flex min-h-[56vh] flex-col">
            {!selected ? (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-espresso/50">
                <div>
                  <MessageCircle className="mx-auto mb-3 size-10 text-gold/50" />
                  Select or start a conversation.
                </div>
              </div>
            ) : (
              <>
                <div className="border-b border-gold/15 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-serif text-xl font-semibold">{conversationName(selected)}</h2>
                      <p className="text-xs text-espresso/50">
                        {selected.type.replaceAll('_', ' ').toLowerCase()} · {selected.participants.length} participant{selected.participants.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-sage/10 px-3 py-1.5 text-xs font-semibold text-sage-dark">
                      <ShieldCheck className="size-3.5" /> Wewed protected
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto bg-ivory/35 p-4 sm:p-6">
                  {threadLoading ? (
                    <div className="flex justify-center py-12 text-sm text-espresso/50">
                      <Loader2 className="mr-2 size-4 animate-spin" /> Loading thread…
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="py-12 text-center text-sm text-espresso/50">
                      This conversation is ready. Send the first message.
                    </div>
                  ) : messages.map((message) => {
                    const mine = message.senderUserId === me?.accessUserId
                    const staffOnly = message.visibility === 'STAFF_ONLY'
                    return (
                      <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <article
                          className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[72%] ${staffOnly ? 'border border-gold/30 bg-gold/10' : mine ? 'bg-espresso text-champagne' : 'border border-gold/10 bg-white text-espresso'}`}
                        >
                          <div className="mb-1 flex items-center gap-2 text-[11px] opacity-65">
                            <span className="font-semibold">{message.senderName ?? 'Wewed'}</span>
                            {staffOnly ? (
                              <span className="inline-flex items-center gap-1 font-semibold">
                                <LockKeyhole className="size-3" /> Staff only
                              </span>
                            ) : null}
                          </div>
                          <p className="whitespace-pre-wrap break-words leading-relaxed">{message.body}</p>
                          <p className="mt-1.5 text-right text-[10px] opacity-50">{timeLabel(message.createdAt)}</p>
                        </article>
                      </div>
                    )
                  })}
                </div>

                <form onSubmit={sendMessage} className="border-t border-gold/15 bg-white p-4">
                  {me?.role === 'admin' ? (
                    <label className="mb-2 inline-flex cursor-pointer items-center gap-2 text-xs text-espresso/60">
                      <input
                        type="checkbox"
                        checked={internalNote}
                        onChange={(event) => setInternalNote(event.target.checked)}
                        className="accent-espresso"
                      />
                      <LockKeyhole className="size-3.5" /> Internal note — visible only to Wewed staff in this conversation
                    </label>
                  ) : null}
                  <div className="flex items-end gap-2">
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      maxLength={4000}
                      rows={2}
                      placeholder={internalNote ? 'Write a staff-only note…' : 'Write a message…'}
                      className="min-h-12 flex-1 resize-y rounded-2xl border border-gold/20 bg-ivory/40 px-4 py-3 text-sm outline-none focus:border-gold"
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim() || sending || selected.status !== 'OPEN'}
                      className="inline-flex h-12 items-center gap-2 rounded-2xl bg-espresso px-5 text-sm font-semibold text-champagne disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      <span className="hidden sm:inline">Send</span>
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-espresso/40">
                    <span>Messages are stored in Wewed; polling refreshes the thread without paid realtime infrastructure.</span>
                    <span>{draft.length}/4000</span>
                  </div>
                </form>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
