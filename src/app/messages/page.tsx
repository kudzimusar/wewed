'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ChevronLeft,
  CirclePlus,
  Inbox,
  Loader2,
  LockKeyhole,
  MessageCircle,
  Pencil,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import {
  communicationThreadIsNearBottom,
  communicationThreadNeedsReconciliation,
} from '@/lib/communications-client-state'

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

function roleHome(role: DashboardRole | null): string {
  if (role === 'admin') return '/admin'
  if (role === 'couple') return '/couple'
  return '/planner'
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'W'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

function compactTimeLabel(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const difference = now.getTime() - date.getTime()
  if (difference >= 0 && difference < 6 * 24 * 60 * 60 * 1000) {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date)
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function messageTimeLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  return new Intl.DateTimeFormat(undefined, sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
  ).format(date)
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
  const [searchQuery, setSearchQuery] = useState('')
  const [newMessageOpen, setNewMessageOpen] = useState(false)
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messageRequestSequence = useRef(0)
  const threadScrollRef = useRef<HTMLDivElement | null>(null)
  const threadEndRef = useRef<HTMLDivElement | null>(null)
  const followLatestRef = useRef(true)

  const selected = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId],
  )
  const latestMessageId = messages[messages.length - 1]?.id ?? null

  const conversationName = useCallback((conversation: Conversation) => {
    if (conversation.title) return conversation.title
    const others = conversation.participants.filter(
      (participant) => participant.userId !== me?.accessUserId,
    )
    if (others.length === 0) return 'Wewed conversation'
    return others.map((participant) => participant.name).join(', ')
  }, [me?.accessUserId])

  const unreadTotal = useMemo(
    () => conversations.reduce((total, conversation) => total + conversation.unreadCount, 0),
    [conversations],
  )

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return conversations
    return conversations.filter((conversation) => {
      const searchable = [
        conversationName(conversation),
        conversation.lastMessageBody,
        conversation.lastMessageSenderName,
        conversation.type,
      ].filter(Boolean).join(' ').toLowerCase()
      return searchable.includes(query)
    })
  }, [conversationName, conversations, searchQuery])

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
    return next
  }, [])

  const loadMessages = useCallback(async (conversationId: string, silent = false) => {
    const requestId = ++messageRequestSequence.current
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
      const next = payload.data ?? []
      if (requestId !== messageRequestSequence.current) return next

      setMessages(next)
      await fetch(
        `/api/communications/conversations/${encodeURIComponent(conversationId)}/read`,
        { method: 'POST' },
      ).catch(() => undefined)
      return next
    } finally {
      if (!silent && requestId === messageRequestSequence.current) setThreadLoading(false)
    }
  }, [])

  const trackThreadScroll = useCallback(() => {
    const container = threadScrollRef.current
    if (!container) return
    followLatestRef.current = communicationThreadIsNearBottom({
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop,
      clientHeight: container.clientHeight,
    })
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
    followLatestRef.current = true
  }, [selectedId])

  useEffect(() => {
    if (!selectedId || !latestMessageId || !followLatestRef.current) return
    const frame = window.requestAnimationFrame(() => {
      const container = threadScrollRef.current
      if (container) {
        container.scrollTop = container.scrollHeight
        followLatestRef.current = true
        return
      }
      threadEndRef.current?.scrollIntoView({ block: 'end' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [latestMessageId, mobileThreadOpen, selectedId])

  useEffect(() => {
    if (!selectedId) {
      messageRequestSequence.current += 1
      setMessages([])
      return
    }
    setInternalNote(false)
    void loadMessages(selectedId).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load messages.')
    })
  }, [loadMessages, selectedId])

  useEffect(() => {
    const lastVisibleMessageAt = selected?.lastMessageAt ?? null
    if (!selectedId || !communicationThreadNeedsReconciliation(lastVisibleMessageAt, messages)) return

    let cancelled = false
    async function reconcileThread() {
      for (let attempt = 0; attempt < 3 && !cancelled; attempt += 1) {
        try {
          const next = await loadMessages(selectedId, true)
          if (cancelled || !communicationThreadNeedsReconciliation(lastVisibleMessageAt, next)) return
        } catch (loadError) {
          if (!cancelled) {
            setError(loadError instanceof Error ? loadError.message : 'Unable to synchronize messages.')
          }
          return
        }
        await new Promise((resolve) => window.setTimeout(resolve, 200 * (attempt + 1)))
      }
    }

    void reconcileThread()
    return () => { cancelled = true }
  }, [loadMessages, messages, selected?.lastMessageAt, selectedId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void (async () => {
        try {
          await loadConversations(true)
          if (selectedId) await loadMessages(selectedId, true)
        } catch {
          // Polling is best-effort; explicit refresh and send paths surface errors.
        }
      })()
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
      setNewMessageOpen(false)
      await loadConversations(true)
      setSelectedId(payload.data.id)
      followLatestRef.current = true
      setMobileThreadOpen(true)
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
      await Promise.all([loadConversations(true), loadContacts()])
      if (selectedId) await loadMessages(selectedId, true)
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh.')
    }
  }

  function openConversation(conversationId: string) {
    setSelectedId(conversationId)
    followLatestRef.current = true
    setMobileThreadOpen(true)
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ivory px-4 text-espresso">
        <div className="flex items-center gap-3 text-sm font-medium text-espresso/65">
          <Loader2 className="size-5 animate-spin text-gold" />
          Loading messages…
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[100dvh] bg-ivory text-espresso lg:px-5 lg:py-5">
      <div className="mx-auto flex min-h-[100dvh] max-w-[1500px] flex-col lg:h-[calc(100dvh-2.5rem)] lg:min-h-0">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-gold/15 bg-white px-3 sm:px-4 lg:rounded-t-2xl lg:border lg:border-b-0 lg:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href={roleHome(me?.role ?? null)}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-espresso/70 transition hover:bg-champagne/45 hover:text-espresso"
              aria-label="Back to workspace"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <MessageCircle className="size-5 shrink-0 text-gold" />
                <h1 className="truncate font-serif text-xl font-semibold sm:text-2xl">Messages</h1>
              </div>
              <p className="hidden text-xs text-espresso/45 sm:block">Your Wewed conversations</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex size-10 items-center justify-center rounded-full text-espresso/60 transition hover:bg-champagne/45 hover:text-espresso"
            aria-label="Refresh messages"
          >
            <RefreshCw className="size-[18px]" />
          </button>
        </header>

        {error ? (
          <div className="border-x border-t border-clay/25 bg-clay/10 px-4 py-2.5 text-sm text-espresso" role="alert">
            {error}
          </div>
        ) : null}

        <section className="grid min-h-0 flex-1 overflow-hidden bg-white lg:grid-cols-[380px_minmax(0,1fr)] lg:rounded-b-2xl lg:border lg:border-gold/15 lg:shadow-sm">
          <aside
            data-communications-inbox="true"
            className={`${mobileThreadOpen ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col border-gold/15 bg-white lg:border-r`}
          >
            <div className="shrink-0 border-b border-gold/10 px-4 pb-3 pt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold">Inbox</h2>
                    {unreadTotal > 0 ? (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-espresso px-1.5 py-0.5 text-[10px] font-bold text-champagne">
                        {unreadTotal > 99 ? '99+' : unreadTotal}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-espresso/45">{conversations.length} conversation{conversations.length === 1 ? '' : 's'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewMessageOpen((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-full bg-espresso px-3.5 py-2 text-xs font-bold text-champagne transition hover:opacity-90"
                >
                  {newMessageOpen ? <X className="size-4" /> : <Pencil className="size-4" />}
                  {newMessageOpen ? 'Close' : 'New message'}
                </button>
              </div>

              {newMessageOpen ? (
                <div className="mb-3 rounded-xl border border-gold/15 bg-champagne/20 p-2.5">
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-espresso/45">
                    Message someone
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={newContactId}
                      onChange={(event) => setNewContactId(event.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-gold/20 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
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
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-espresso text-champagne disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Start conversation"
                    >
                      {creating ? <Loader2 className="size-4 animate-spin" /> : <CirclePlus className="size-4" />}
                    </button>
                  </div>
                </div>
              ) : null}

              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-espresso/35" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search conversations"
                  aria-label="Search conversations"
                  className="h-10 w-full rounded-xl border border-gold/15 bg-ivory/45 pl-9 pr-3 text-sm outline-none transition placeholder:text-espresso/35 focus:border-gold/45 focus:bg-white"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {conversations.length === 0 ? (
                <div className="flex h-full min-h-72 items-center justify-center p-8 text-center">
                  <div>
                    <Inbox className="mx-auto mb-3 size-8 text-gold/55" />
                    <p className="font-semibold">Your inbox is empty</p>
                    <p className="mt-1 text-sm text-espresso/50">Start a new message when you are ready.</p>
                  </div>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-sm text-espresso/50">No conversations match “{searchQuery}”.</div>
              ) : filteredConversations.map((conversation) => {
                const active = conversation.id === selectedId
                const unread = conversation.unreadCount > 0
                const name = conversationName(conversation)
                return (
                  <button
                    type="button"
                    key={conversation.id}
                    onClick={() => openConversation(conversation.id)}
                    aria-current={active ? 'true' : undefined}
                    className={`group flex w-full gap-3 border-b border-gold/10 px-4 py-3.5 text-left transition ${active ? 'bg-champagne/35' : 'bg-white hover:bg-ivory/55'}`}
                  >
                    <div className={`flex size-11 shrink-0 items-center justify-center rounded-full text-xs font-bold ${active ? 'bg-espresso text-champagne' : 'bg-champagne text-espresso'}`}>
                      {conversation.kind === 'GROUP' ? <Users className="size-4" /> : initials(name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className={`truncate text-sm ${unread ? 'font-extrabold' : 'font-semibold'}`}>{name}</p>
                        <span className={`shrink-0 text-[10px] ${unread ? 'font-bold text-gold' : 'text-espresso/40'}`}>
                          {compactTimeLabel(conversation.lastMessageAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className={`min-w-0 flex-1 truncate text-xs ${unread ? 'font-semibold text-espresso/70' : 'text-espresso/48'}`}>
                          {conversation.lastMessageBody
                            ? `${conversation.lastMessageSenderName ?? 'Wewed'}: ${conversation.lastMessageBody}`
                            : conversation.type.replaceAll('_', ' ').toLowerCase()}
                        </p>
                        {unread ? (
                          <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-extrabold text-espresso">
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

          <div
            data-communications-thread="true"
            className={`${mobileThreadOpen ? 'flex' : 'hidden lg:flex'} min-h-0 min-w-0 flex-col bg-ivory/20`}
          >
            {!selected ? (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-espresso/50">
                <div>
                  <MessageCircle className="mx-auto mb-3 size-10 text-gold/45" />
                  <p className="font-semibold text-espresso/70">Choose a conversation</p>
                  <p className="mt-1 text-sm">Your messages will open here.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-gold/10 bg-white px-2.5 sm:px-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setMobileThreadOpen(false)}
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-espresso/70 transition hover:bg-champagne/45 lg:hidden"
                      aria-label="Back to inbox"
                    >
                      <ChevronLeft className="size-6" />
                    </button>
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-champagne text-xs font-bold text-espresso">
                      {selected.kind === 'GROUP' ? <Users className="size-4" /> : initials(conversationName(selected))}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-extrabold sm:text-base">{conversationName(selected)}</h2>
                      <p className="truncate text-[11px] text-espresso/45 sm:text-xs">
                        {selected.participants.length} participant{selected.participants.length === 1 ? '' : 's'} · {selected.type.replaceAll('_', ' ').toLowerCase()}
                      </p>
                    </div>
                  </div>
                  <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sage/10 px-2.5 py-1.5 text-[10px] font-bold text-sage-dark sm:text-xs">
                    <ShieldCheck className="size-3.5" />
                    <span className="hidden sm:inline">Wewed protected</span>
                    <span className="sm:hidden">Protected</span>
                  </div>
                </div>

                <div
                  ref={threadScrollRef}
                  onScroll={trackThreadScroll}
                  data-communications-thread-scroll="true"
                  className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain bg-champagne/15 px-3 py-4 sm:px-5 sm:py-5"
                >
                  {threadLoading ? (
                    <div className="flex justify-center py-12 text-sm text-espresso/50">
                      <Loader2 className="mr-2 size-4 animate-spin" /> Loading conversation…
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex min-h-64 items-center justify-center text-center text-sm text-espresso/50">
                      <div>
                        <MessageCircle className="mx-auto mb-2 size-7 text-gold/45" />
                        <p className="font-semibold text-espresso/65">No messages yet</p>
                        <p className="mt-1">Say hello to start the conversation.</p>
                      </div>
                    </div>
                  ) : messages.map((message) => {
                    const mine = message.senderUserId === me?.accessUserId
                    const staffOnly = message.visibility === 'STAFF_ONLY'
                    return (
                      <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <article
                          className={`max-w-[86%] rounded-[18px] px-3.5 py-2.5 text-sm shadow-sm sm:max-w-[72%] ${staffOnly
                            ? 'border border-gold/35 bg-gold/10 text-espresso'
                            : mine
                              ? 'rounded-br-md bg-espresso text-champagne'
                              : 'rounded-bl-md border border-gold/10 bg-white text-espresso'
                          }`}
                        >
                          {staffOnly ? (
                            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-espresso/55">
                              <LockKeyhole className="size-3" /> Staff note
                            </div>
                          ) : !mine ? (
                            <div className="mb-1 text-[11px] font-bold text-espresso/55">
                              {message.senderName ?? 'Wewed'}
                            </div>
                          ) : null}
                          <p className="whitespace-pre-wrap break-words leading-relaxed">{message.body}</p>
                          <p className={`mt-1 text-right text-[10px] ${mine && !staffOnly ? 'text-champagne/55' : 'text-espresso/40'}`}>
                            {messageTimeLabel(message.createdAt)}
                          </p>
                        </article>
                      </div>
                    )
                  })}
                  <div ref={threadEndRef} aria-hidden="true" className="h-px" />
                </div>

                <form onSubmit={sendMessage} className="shrink-0 border-t border-gold/10 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 sm:px-4 sm:pb-3">
                  {me?.role === 'admin' ? (
                    <label className={`mb-2 inline-flex cursor-pointer items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${internalNote ? 'bg-gold/15 text-espresso' : 'text-espresso/48 hover:bg-champagne/35'}`}>
                      <input
                        type="checkbox"
                        checked={internalNote}
                        onChange={(event) => setInternalNote(event.target.checked)}
                        className="sr-only"
                      />
                      <LockKeyhole className="size-3.5" />
                      {internalNote ? 'Staff-only note enabled' : 'Add staff-only note'}
                    </label>
                  ) : null}
                  <div className="flex items-end gap-2">
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      maxLength={4000}
                      rows={1}
                      placeholder={internalNote ? 'Write a staff-only note…' : 'Message…'}
                      className={`min-h-12 max-h-32 flex-1 resize-none rounded-2xl border px-4 py-3 text-sm outline-none transition ${internalNote ? 'border-gold/35 bg-gold/5 focus:border-gold' : 'border-gold/15 bg-ivory/45 focus:border-gold/45 focus:bg-white'}`}
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim() || sending || selected.status !== 'OPEN'}
                      className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-espresso text-champagne transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Send message"
                    >
                      {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
                    </button>
                  </div>
                  <div className="mt-1.5 flex min-h-4 justify-end text-[10px] text-espresso/35">
                    {draft.length >= 3600 ? <span>{draft.length}/4000</span> : null}
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
