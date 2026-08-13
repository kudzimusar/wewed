'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Heart, Camera, Users, Sparkles, Lock, Loader2 } from 'lucide-react'
import { useWewedStore } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider'
import {
  compactWeddingDate,
  coupleNames,
  formatWeddingDate,
} from '@/lib/wedding-template-defaults'

interface WallMessage {
  id: string
  authorName: string
  content: string
  createdAt: string
  type?: string | null
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.max(0, Date.now() - then)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'G'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function MessageRow({ msg, index }: { msg: WallMessage; index: number }) {
  const applause = msg.type === 'applause' || msg.content.trim() === '👏'
  const photo = msg.type === 'photo'

  if (applause) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.6, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="flex flex-col items-center gap-1 py-3"
      >
        <motion.span
          className="text-4xl"
          animate={{ scale: [1, 1.18, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
        >
          👏
        </motion.span>
        <span className="font-sans text-xs text-gold-muted">
          {msg.authorName} applauded &middot; {timeAgo(msg.createdAt)}
        </span>
      </motion.div>
    )
  }

  if (photo) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: Math.min(index * 0.02, 0.2) }}
        className="flex gap-3 py-2"
      >
        <Avatar className="size-8 shrink-0 border border-gold/30">
          <AvatarFallback className="bg-gold/10 font-sans text-xs text-gold">
            {initials(msg.authorName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-baseline gap-2">
            <span className="wewed-heading truncate text-sm text-espresso">{msg.authorName}</span>
            <span className="font-sans text-[10px] text-muted-foreground">{timeAgo(msg.createdAt)}</span>
          </div>
          <div className="relative overflow-hidden rounded-lg border border-gold/20 bg-espresso">
            <div className="aspect-video w-full bg-gradient-to-br from-plum/40 via-espresso to-clay/30" />
            <div className="absolute inset-0 flex items-center justify-center"><Camera className="size-8 text-champagne/40" /></div>
            {msg.content && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-espresso/90 to-transparent p-3">
                <p className="line-clamp-2 font-sans text-xs text-champagne/90">{msg.content}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.02, 0.2) }}
      className="flex gap-3 py-2"
    >
      <Avatar className="size-8 shrink-0 border border-gold/30">
        <AvatarFallback className="bg-gold/10 font-sans text-xs text-gold">{initials(msg.authorName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 rounded-lg border border-gold/15 bg-white/70 px-3 py-2">
        <div className="mb-0.5 flex items-baseline gap-2">
          <span className="wewed-heading truncate text-sm text-espresso">{msg.authorName}</span>
          <span className="font-sans text-[10px] text-muted-foreground">{timeAgo(msg.createdAt)}</span>
        </div>
        <p className="break-words font-sans text-sm leading-relaxed text-espresso/80">{msg.content}</p>
      </div>
    </motion.div>
  )
}

export function LiveWall({ canPost = false }: { canPost?: boolean }) {
  const { lifecycle } = useWewedStore()
  const ctx = useWeddingContextSafe()
  const wedding = ctx?.wedding
  const names = coupleNames(wedding)
  const [messages, setMessages] = useState<WallMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftMsg, setDraftMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [bursting, setBursting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const loadMessages = useCallback(async () => {
    if (!ctx?.slug) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/messages?slug=${encodeURIComponent(ctx.slug)}`, { cache: 'no-store' })
      const body = (await response.json().catch(() => null)) as {
        success?: boolean
        data?: WallMessage[]
        error?: string
      } | null
      if (!response.ok || !body?.success) throw new Error(body?.error || 'Unable to load wedding messages.')
      setMessages(Array.isArray(body.data) ? [...body.data].reverse() : [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load wedding messages.')
    } finally {
      setLoading(false)
    }
  }, [ctx?.slug])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  const sendWallMessage = async (content: string, type: 'wall' | 'applause' = 'wall') => {
    if (!canPost || !ctx?.slug || !content.trim()) return
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: ctx.slug,
        type,
        content: content.trim(),
        authorName: draftName.trim() || 'Guest',
      }),
    })
    const body = (await response.json().catch(() => null)) as {
      success?: boolean
      data?: WallMessage
      error?: string
    } | null
    if (!response.ok || !body?.success || !body.data) {
      throw new Error(body?.error || 'Unable to add your message.')
    }
    setMessages((current) => [...current, body.data as WallMessage])
  }

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canPost || !draftMsg.trim()) return
    setSending(true)
    setError(null)
    try {
      await sendWallMessage(draftMsg, 'wall')
      setDraftMsg('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to add your message.')
    } finally {
      setSending(false)
    }
  }

  const handleApplause = async () => {
    if (!canPost) return
    setBursting(true)
    setError(null)
    try {
      await sendWallMessage('👏', 'applause')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send applause.')
    } finally {
      window.setTimeout(() => setBursting(false), 900)
    }
  }

  const isBeforeMode = lifecycle === 'before'
  const venue = wedding?.venue || 'the wedding venue'
  const dateLabel = wedding?.date ? formatWeddingDate(wedding.date) : 'the wedding day'
  const teaserMessages = useMemo<WallMessage[]>(() => {
    if (messages.length > 0) return []
    const note = ctx?.getContent('wall', 'welcomeMessage', '') ?? ''
    if (!note) return []
    return [{
      id: `welcome-${ctx?.slug || 'wedding'}`,
      authorName: names,
      content: note,
      createdAt: new Date().toISOString(),
      type: 'wall',
    }]
  }, [ctx, messages.length, names])
  const messagesToShow = messages.length > 0 ? messages : teaserMessages
  const footerMark = [wedding?.monogram || names, compactWeddingDate(wedding?.date)].filter(Boolean).join(' · ')

  return (
    <section id="livewall" data-classic-section="live-wall" className="wewed-section py-20 md:py-32">
      <div className="mx-auto max-w-3xl px-4">
        <motion.div
          className="mb-10 text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
        >
          <div className="mb-3 flex items-center justify-center gap-2">
            <span className="wewed-pulse-dot inline-block size-2.5 rounded-full bg-gold" />
            <span className="font-sans text-xs uppercase tracking-[0.25em] text-gold-muted">Live · {venue}</span>
          </div>
          <h2 className="wewed-heading wewed-heading-accent text-4xl text-espresso md:text-5xl">Live from {venue}</h2>
          <p className="mx-auto mt-4 max-w-xl font-sans text-sm leading-relaxed text-muted-foreground md:text-base">
            {isBeforeMode
              ? `A glimpse of the celebration to come. The wedding wall grows as everyone counts down to ${dateLabel}.`
              : `Messages and applause from ${names}' loved ones — gathered in one wedding-scoped wall.`}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Card className="overflow-hidden border border-gold/30 bg-champagne shadow-sm">
            <div className="flex items-center justify-between border-b border-gold/15 bg-white/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/50" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-gold" />
                </span>
                <span className="font-sans text-xs text-espresso/80">Wedding wall</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="border-gold/20 bg-white/60 font-sans text-[10px] text-espresso/80">
                  <Users className="mr-1 size-3 text-gold" />
                  {messages.length} contribution{messages.length === 1 ? '' : 's'}
                </Badge>
                <Badge className="border-gold/30 bg-gold/15 font-sans text-[10px] text-gold-muted" variant="outline">
                  <span className="wewed-pulse-dot mr-1 inline-block size-1.5 rounded-full bg-gold" />
                  LIVE
                </Badge>
              </div>
            </div>

            <CardContent className="p-0">
              <div ref={scrollRef} className="wewed-scroll max-h-96 overflow-y-auto px-4 py-3">
                {loading ? (
                  <div className="flex min-h-32 items-center justify-center"><Loader2 className="size-6 animate-spin text-gold" /></div>
                ) : (
                  <AnimatePresence initial={false}>
                    {messagesToShow.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Sparkles className="mb-2 size-6 text-gold/40" />
                        <p className="font-sans text-sm text-muted-foreground">
                          {isBeforeMode ? 'Be the first invited guest to leave a note for the couple.' : 'The first wedding memory is waiting to be shared.'}
                        </p>
                      </div>
                    ) : (
                      messagesToShow.map((message, index) => <MessageRow key={message.id} msg={message} index={index} />)
                    )}
                  </AnimatePresence>
                )}
              </div>
            </CardContent>

            <div className="border-t border-gold/15 bg-white/40 p-3" data-testid="classic-live-wall-composer">
              {!canPost && (
                <div
                  data-testid="live-wall-locked-notice"
                  className="mb-3 flex items-center gap-2 rounded-lg border border-gold/20 bg-gold/5 px-3 py-2 font-sans text-xs text-espresso/60"
                >
                  <Lock className="size-3.5 shrink-0 text-gold" />
                  The wall stays visible, but posting is reserved for a verified wedding invitation or authorised wedding member.
                </div>
              )}

              <div className="mb-2">
                <Input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder={canPost ? 'Your name (optional)' : 'Guest name — invitation required to post'}
                  disabled={!canPost}
                  className="border-gold/20 bg-white/70 font-sans text-sm placeholder:text-muted-foreground/60 focus:border-gold focus:ring-gold/20 disabled:cursor-not-allowed disabled:opacity-70"
                  maxLength={40}
                />
              </div>
              <form onSubmit={(event) => void handleSend(event)} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={draftMsg}
                  onChange={(event) => setDraftMsg(event.target.value)}
                  placeholder={canPost
                    ? isBeforeMode
                      ? 'Leave a note for the couple…'
                      : 'Send a message to the live wall…'
                    : 'A verified guest can leave a note here…'}
                  disabled={!canPost}
                  className="flex-1 border-gold/20 bg-white/70 font-sans text-sm placeholder:text-muted-foreground/60 focus:border-gold focus:ring-gold/20 disabled:cursor-not-allowed disabled:opacity-70"
                  maxLength={500}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => void handleApplause()}
                    variant="outline"
                    disabled={!canPost}
                    className="border-gold/30 bg-white/60 font-sans text-xs text-gold hover:bg-gold/10 hover:text-gold"
                    aria-label="Send applause"
                  >
                    <motion.span
                      animate={bursting ? { scale: [1, 1.4, 1], rotate: [0, -10, 10, 0] } : { scale: 1 }}
                      transition={{ duration: 0.6 }}
                      className="inline-flex items-center"
                    >
                      👏
                    </motion.span>
                    <span className="ml-1 hidden sm:inline">Applaud</span>
                  </Button>
                  <Button
                    type="submit"
                    disabled={!canPost || sending || !draftMsg.trim()}
                    className="bg-gold font-sans text-xs text-espresso hover:bg-gold-light"
                  >
                    {sending ? <Loader2 className="size-3.5 animate-spin" /> : canPost ? <Send className="size-3.5" /> : <Lock className="size-3.5" />}
                    <span className="ml-1">Send</span>
                  </Button>
                </div>
              </form>
              <div className="mt-2 flex items-center justify-between">
                <p className="font-sans text-[10px] text-muted-foreground">
                  {canPost ? 'Be kind. Be joyful. Messages stay with this wedding.' : 'Read-only preview · guest identity is verified server-side before posting.'}
                </p>
                <div className="flex items-center gap-1 text-gold-muted"><Heart className="size-3" /><span className="font-sans text-[10px]">{messages.length} live</span></div>
              </div>
              {error && <p role="alert" className="mt-2 font-sans text-xs text-clay">{error}</p>}
            </div>
          </Card>
        </motion.div>

        <motion.div
          className="mt-10 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="wewed-divider mx-auto w-32" />
          {footerMark && <p className="mt-6 wewed-monogram text-xs tracking-widest">{footerMark}</p>}
        </motion.div>
      </div>
    </section>
  )
}
