'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Heart, MessageSquare, Loader2 } from 'lucide-react'
import { useWewedStore } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider'
import { coupleNames, formatWeddingDate } from '@/lib/wedding-template-defaults'

interface WallMessage {
  id: string
  authorName: string
  content: string
  createdAt: string
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

export function LiveWall() {
  const { lifecycle } = useWewedStore()
  const ctx = useWeddingContextSafe()
  const wedding = ctx?.wedding
  const [messages, setMessages] = useState<WallMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftMsg, setDraftMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const loadMessages = useCallback(async () => {
    if (!ctx?.slug) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/messages?slug=${encodeURIComponent(ctx.slug)}`, { cache: 'no-store' })
      const body = (await response.json().catch(() => null)) as { success?: boolean; data?: WallMessage[]; error?: string } | null
      if (!response.ok || !body?.success) throw new Error(body?.error || 'Unable to load wedding messages.')
      setMessages(Array.isArray(body.data) ? [...body.data].reverse() : [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load wedding messages.')
    } finally {
      setLoading(false)
    }
  }, [ctx?.slug])

  useEffect(() => { void loadMessages() }, [loadMessages])
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault()
    const content = draftMsg.trim()
    if (!content || !ctx?.slug) return
    setSending(true)
    setError(null)
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: ctx.slug,
          type: 'wall',
          content,
          authorName: draftName.trim() || 'Guest',
        }),
      })
      const body = (await response.json().catch(() => null)) as { success?: boolean; data?: WallMessage; error?: string } | null
      if (!response.ok || !body?.success || !body.data) throw new Error(body?.error || 'Unable to add your message.')
      setMessages((current) => [...current, body.data as WallMessage])
      setDraftMsg('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to add your message.')
    } finally {
      setSending(false)
    }
  }

  const isBeforeMode = lifecycle === 'before'
  const dateLabel = wedding?.date ? formatWeddingDate(wedding.date) : 'the wedding day'
  const locationLabel = wedding?.venue || 'the wedding'

  return (
    <section id="livewall" className="wewed-section py-20 md:py-32">
      <div className="mx-auto max-w-3xl px-4">
        <motion.div className="mb-10 text-center" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.7 }}>
          <div className="mb-3 flex items-center justify-center gap-2">
            <span className="inline-block size-2.5 rounded-full bg-gold" />
            <span className="font-sans text-xs uppercase tracking-[0.25em] text-gold-muted">Wedding wall · {locationLabel}</span>
          </div>
          <h2 className="wewed-heading wewed-heading-accent text-4xl text-espresso md:text-5xl">Messages for {coupleNames(wedding)}</h2>
          <p className="mx-auto mt-4 max-w-xl font-sans text-sm leading-relaxed text-muted-foreground md:text-base">
            {isBeforeMode
              ? `Share a note as everyone counts down to ${dateLabel}. Public messages stay scoped to this wedding.`
              : 'Leave a message or memory for the couple after the celebration. Only public wedding-wall messages appear here.'}
          </p>
        </motion.div>

        <Card className="overflow-hidden border border-gold/30 bg-champagne shadow-sm">
          <div className="flex items-center justify-between border-b border-gold/15 bg-white/40 px-4 py-3">
            <div className="flex items-center gap-2"><MessageSquare className="size-4 text-gold" /><span className="font-sans text-xs text-espresso/80">Wedding messages</span></div>
            <span className="font-sans text-xs text-muted-foreground">{messages.length} public</span>
          </div>

          <CardContent className="p-4 sm:p-6">
            <div ref={scrollRef} className="mb-5 max-h-[26rem] space-y-1 overflow-y-auto wewed-scroll pr-1">
              {loading ? (
                <div className="flex min-h-28 items-center justify-center"><Loader2 className="size-6 animate-spin text-gold" /></div>
              ) : messages.length > 0 ? (
                <AnimatePresence initial={false}>{messages.map((msg, index) => <MessageRow key={msg.id} msg={msg} index={index} />)}</AnimatePresence>
              ) : (
                <div className="rounded-xl border border-dashed border-gold/25 bg-white/40 p-6 text-center">
                  <Heart className="mx-auto size-6 text-gold/60" />
                  <p className="mt-3 font-sans text-sm text-muted-foreground">No public messages yet. Be the first to leave a note for the couple.</p>
                </div>
              )}
            </div>

            <form onSubmit={(event) => void handleSend(event)} className="space-y-3 border-t border-gold/15 pt-5">
              <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
                <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Your name" className="border-gold/25 bg-white/70" />
                <div className="flex gap-2">
                  <Input value={draftMsg} onChange={(event) => setDraftMsg(event.target.value)} placeholder="Write a message for the couple…" maxLength={1000} className="border-gold/25 bg-white/70" />
                  <Button type="submit" disabled={sending || !draftMsg.trim()} className="bg-gold text-espresso hover:bg-gold-light">
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </Button>
                </div>
              </div>
              {error && <p role="alert" className="font-sans text-xs text-clay">{error}</p>}
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
