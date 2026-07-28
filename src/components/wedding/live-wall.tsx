'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Heart, Camera, Users, Sparkles, WifiOff } from 'lucide-react'
import { useWewedStore } from '@/lib/store'
import { useWewedLive, type LiveMessage } from '@/lib/useWewedLive'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

/* ── Helpers ── */

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.max(0, Date.now() - then)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'G'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/* ── Single Message Row ── */

function MessageRow({ msg, index }: { msg: LiveMessage; index: number }) {
  if (msg.type === 'applause') {
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
          aria-hidden
        >
          👏
        </motion.span>
        <span className="font-sans text-xs text-gold-muted">
          {msg.authorName} applauded &middot; {timeAgo(msg.timestamp)}
        </span>
      </motion.div>
    )
  }

  if (msg.type === 'photo') {
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
            <span className="wewed-heading text-sm text-espresso truncate">
              {msg.authorName}
            </span>
            <span className="font-sans text-[10px] text-muted-foreground">
              {timeAgo(msg.timestamp)}
            </span>
          </div>
          <div className="relative overflow-hidden rounded-lg border border-gold/20 bg-espresso">
            {/* Stylized photo placeholder */}
            <div className="aspect-video w-full bg-gradient-to-br from-plum/40 via-espresso to-clay/30" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Camera className="size-8 text-champagne/40" />
            </div>
            {msg.content && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-espresso/90 to-transparent p-3">
                <p className="font-sans text-xs text-champagne/90 line-clamp-2">
                  {msg.content}
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  // Default: text message
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
      <div className="min-w-0 flex-1 rounded-lg border border-gold/15 bg-white/70 px-3 py-2">
        <div className="mb-0.5 flex items-baseline gap-2">
          <span className="wewed-heading text-sm text-espresso truncate">
            {msg.authorName}
          </span>
          <span className="font-sans text-[10px] text-muted-foreground">
            {timeAgo(msg.timestamp)}
          </span>
        </div>
        <p className="font-sans text-sm text-espresso/80 leading-relaxed break-words">
          {msg.content}
        </p>
      </div>
    </motion.div>
  )
}

/* ── Main Live Wall ── */

export function LiveWall() {
  const { lifecycle } = useWewedStore()
  const {
    isConnected,
    connectedGuests,
    liveMessages,
    sendMessage,
    sendApplause,
  } = useWewedLive()

  const [draftName, setDraftName] = useState('')
  const [draftMsg, setDraftMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [bursting, setBursting] = useState(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [liveMessages.length])

  const isBeforeMode = lifecycle === 'before'

  const teaserMessages: LiveMessage[] = useMemo(
    () => [
      {
        id: 'teaser-1',
        authorName: 'Charity & Kudzie',
        content:
          "We can't wait to celebrate with you at Imba Manor. The live wall opens on the day — see you December 23rd! 🥂",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        type: 'message',
      },
      {
        id: 'teaser-2',
        authorName: 'Tendai M.',
        content: 'Counting down the days! Bringing my dancing shoes 👠',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        type: 'message',
      },
    ],
    []
  )

  const messagesToShow = isBeforeMode
    ? liveMessages.length > 0
      ? liveMessages
      : teaserMessages
    : liveMessages

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    const author = draftName.trim() || 'Anonymous Guest'
    const content = draftMsg.trim()
    if (!content) return
    setSending(true)
    sendMessage(author, content)
    setDraftMsg('')
    setTimeout(() => setSending(false), 400)
  }

  const handleApplause = () => {
    const author = draftName.trim() || undefined
    sendApplause(author)
    setBursting(true)
    setTimeout(() => setBursting(false), 900)
  }

  return (
    <section id="livewall" className="wewed-section py-20 md:py-32">
      <div className="mx-auto max-w-3xl px-4">
        {/* Heading */}
        <motion.div
          className="mb-10 text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
        >
          <div className="mb-3 flex items-center justify-center gap-2">
            <span className="wewed-pulse-dot inline-block size-2.5 rounded-full bg-gold" />
            <span className="font-sans text-xs uppercase tracking-[0.25em] text-gold-muted">
              Live · Imba Manor
            </span>
          </div>
          <h2 className="wewed-heading wewed-heading-accent text-4xl md:text-5xl text-espresso">
            Live from Imba Manor
          </h2>
          <p className="mt-4 font-sans text-sm md:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {isBeforeMode
              ? 'A glimpse of the celebration to come. The live wall awakens on December 23, 2026.'
              : 'Messages, applause, and photos from our loved ones — happening right now at the reception.'}
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Card className="overflow-hidden border border-gold/30 bg-champagne shadow-sm">
            {/* Card Header: status bar */}
            <div className="flex items-center justify-between border-b border-gold/15 bg-white/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5">
                  {isConnected && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/60" />
                  )}
                  <span
                    className={`relative inline-flex size-2.5 rounded-full ${
                      isConnected ? 'bg-gold' : 'bg-muted-foreground/40'
                    }`}
                  />
                </span>
                <span className="font-sans text-xs text-espresso/80">
                  {isConnected ? 'Live' : 'Reconnecting…'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="border-gold/20 bg-white/60 font-sans text-[10px] text-espresso/80"
                >
                  <Users className="mr-1 size-3 text-gold" />
                  {connectedGuests} guest{connectedGuests === 1 ? '' : 's'} online
                </Badge>
                <Badge
                  className="border-gold/30 bg-gold/15 font-sans text-[10px] text-gold-muted"
                  variant="outline"
                >
                  <span className="wewed-pulse-dot mr-1 inline-block size-1.5 rounded-full bg-gold" />
                  LIVE
                </Badge>
              </div>
            </div>

            {/* Disconnected banner */}
            {!isConnected && (
              <div className="flex items-center justify-center gap-2 bg-clay/10 px-4 py-2 text-clay">
                <WifiOff className="size-3.5" />
                <span className="font-sans text-xs">
                  Reconnecting to Imba Manor…
                </span>
              </div>
            )}

            {/* Messages */}
            <CardContent className="p-0">
              <div
                ref={scrollRef}
                className="wewed-scroll max-h-96 overflow-y-auto px-4 py-3"
              >
                <AnimatePresence initial={false}>
                  {messagesToShow.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Sparkles className="mb-2 size-6 text-gold/40" />
                      <p className="font-sans text-sm text-muted-foreground">
                        {isBeforeMode
                          ? 'Be the first to leave a note for the couple.'
                          : 'The celebration is about to begin…'}
                      </p>
                    </div>
                  ) : (
                    messagesToShow.map((msg, i) => (
                      <MessageRow key={msg.id} msg={msg} index={i} />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </CardContent>

            {/* Composer */}
            <div className="border-t border-gold/15 bg-white/40 p-3">
              <div className="mb-2">
                <Input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Your name (optional)"
                  className="border-gold/20 bg-white/70 font-sans text-sm placeholder:text-muted-foreground/60 focus:border-gold focus:ring-gold/20"
                  maxLength={40}
                />
              </div>
              <form
                onSubmit={handleSend}
                className="flex flex-col gap-2 sm:flex-row sm:items-center"
              >
                <Input
                  value={draftMsg}
                  onChange={(e) => setDraftMsg(e.target.value)}
                  placeholder={
                    isBeforeMode
                      ? 'Leave a note for the couple…'
                      : 'Send a message to the live wall…'
                  }
                  className="flex-1 border-gold/20 bg-white/70 font-sans text-sm placeholder:text-muted-foreground/60 focus:border-gold focus:ring-gold/20"
                  maxLength={500}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={handleApplause}
                    variant="outline"
                    className="border-gold/30 bg-white/60 font-sans text-xs text-gold hover:bg-gold/10 hover:text-gold"
                    aria-label="Send applause"
                    disabled={!isConnected && !isBeforeMode}
                  >
                    <motion.span
                      animate={
                        bursting
                          ? { scale: [1, 1.4, 1], rotate: [0, -10, 10, 0] }
                          : { scale: 1 }
                      }
                      transition={{ duration: 0.6 }}
                      className="inline-flex items-center"
                    >
                      👏
                    </motion.span>
                    <span className="ml-1 hidden sm:inline">Applaud</span>
                  </Button>
                  <Button
                    type="submit"
                    disabled={sending || !draftMsg.trim()}
                    className="bg-gold font-sans text-xs text-espresso hover:bg-gold-light"
                  >
                    <Send className="size-3.5" />
                    <span className="ml-1">Send</span>
                  </Button>
                </div>
              </form>
              <div className="mt-2 flex items-center justify-between">
                <p className="font-sans text-[10px] text-muted-foreground">
                  Be kind. Be joyful. Messages appear instantly.
                </p>
                <div className="flex items-center gap-1 text-gold-muted">
                  <Heart className="size-3" />
                  <span className="font-sans text-[10px]">
                    {liveMessages.length} live
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Footer monogram */}
        <motion.div
          className="mt-10 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="wewed-divider w-32 mx-auto" />
          <p className="mt-6 wewed-monogram text-xs tracking-widest">
            C&amp;K &middot; 23.12.26
          </p>
        </motion.div>
      </div>
    </section>
  )
}
