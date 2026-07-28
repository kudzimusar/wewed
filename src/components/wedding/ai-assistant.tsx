'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Send, X, Heart, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ============================================================
   AiAssistant — floating guest AI chat bubble
   ------------------------------------------------------------
   Renders a small pulsing gold button (bottom-right) that opens
   an elegant chat panel. Guests ask questions about the wedding;
   replies come from /api/ai/chat (context: 'guest') which calls
   GLM 5.2 via z-ai-web-dev-sdk.

   Design:
   • Bubble: gold circle with Sparkles, subtle pulse + float
   • Panel: champagne bg, gold hairline border, serif header
   • Messages: user (espresso bubble, right-aligned) + AI (gold
     avatar circle with Sparkles, left-aligned champagne bubble)
   • Quick chips: 6 suggested questions (visible when convo empty)
   • Typing indicator: 3 bouncing gold dots
   • "Powered by GLM 5.2" badge in footer
   • Mobile: panel goes full-width minus margins; desktop fixed
     380px wide panel
   • Ephemeral messages (in-memory only — no persistence)
   • Auto-scroll to bottom on new message

   Optional onDismiss callback lets the parent (AiTrigger) hide
   the bubble for 24h via localStorage.
   ============================================================ */

// ─── Types ──────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  ts: number
}

interface AiAssistantProps {
  /** Called when the guest clicks the small "hide" affordance. */
  onDismiss?: () => void
  /** Optional className override for the floating bubble. */
  className?: string
}

// ─── Static data ────────────────────────────────────────────────
const QUICK_SUGGESTIONS: { label: string; query: string }[] = [
  { label: 'What time should I arrive?', query: "What time should I arrive at the wedding?" },
  { label: "What's the dress code?", query: "What's the dress code for the wedding?" },
  { label: 'How do I get there?', query: 'How do I get to Imba Manor? Is there a shuttle?' },
  { label: 'What food will be served?', query: 'What food will be served? Any dietary options?' },
  { label: 'Can I bring my kids?', query: 'Can I bring my children to the wedding?' },
  { label: 'Tell me about Shona traditions', query: 'Tell me about Shona wedding traditions I should know.' },
]

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    "Mhoro! 👋 I'm wewed AI — here to help with anything about Charity & Kudzie's wedding on Dec 23, 2026 at Imba Manor, Harare. Ask me about timing, dress code, transport, the menu, or Zimbabwean wedding traditions. 💛",
  ts: Date.now(),
}

// ─── Sub-components ─────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1.5" aria-label="wewed AI is typing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-2 rounded-full bg-gold/70"
          animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  )
}

function AiAvatar({ size = 28 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold via-gold to-gold-muted shadow-sm ring-1 ring-gold-light/30"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Sparkles className="text-espresso" style={{ width: size * 0.55, height: size * 0.55 }} />
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────
export function AiAssistant({ onDismiss, className }: AiAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  // Auto-scroll to bottom on new message / typing
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, isLoading])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 280)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  // Lock body scroll when panel is open on mobile (defensive)
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      const userMsg: ChatMessage = { role: 'user', content: trimmed, ts: Date.now() }
      const nextMessages = [...messages, userMsg]
      setMessages(nextMessages)
      setInput('')
      setIsLoading(true)

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: 'guest',
            messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          }),
        })
        const data = (await res.json()) as { reply?: string }
        const reply =
          data.reply ??
          "I'm having a brief moment of trouble. Please try again in a moment. 💛"
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: reply, ts: Date.now() },
        ])
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              "I couldn't reach the AI just now. Please try again — your question matters. 💛",
            ts: Date.now(),
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, messages],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const showQuickChips = messages.length <= 1

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-end p-3 sm:p-5',
        className,
      )}
    >
      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto absolute bottom-20 right-3 left-3 top-auto sm:left-auto sm:bottom-24 sm:right-5 sm:w-[380px]"
          >
            <div className="flex h-[min(72vh,560px)] flex-col overflow-hidden rounded-2xl border border-gold/30 bg-champagne shadow-[0_24px_64px_-20px_rgba(26,20,16,0.45)] ring-1 ring-gold/10">
              {/* Header */}
              <header className="relative shrink-0 overflow-hidden bg-espresso px-4 py-3 text-champagne">
                <div className="absolute inset-0 bg-gradient-to-br from-plum/30 via-transparent to-gold/15" aria-hidden="true" />
                <div className="relative flex items-center gap-3">
                  <AiAvatar size={36} />
                  <div className="min-w-0 flex-1">
                    <h2 className="wewed-heading truncate text-base text-champagne">
                      wewed AI
                      <span className="ml-2 align-middle text-[10px] font-sans uppercase tracking-[0.18em] text-gold-light/70">
                        Guest Concierge
                      </span>
                    </h2>
                    <p className="truncate font-sans text-[11px] text-champagne/60">
                      Ask me anything about the wedding
                    </p>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    aria-label="Close chat"
                    className="inline-flex size-8 items-center justify-center rounded-full text-champagne/60 transition-colors hover:bg-gold/10 hover:text-gold"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </header>

              {/* Messages */}
              <div
                ref={scrollRef}
                className="wewed-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4"
                role="log"
                aria-live="polite"
                aria-label="Chat messages"
              >
                {messages.map((m, i) => (
                  <MessageBubble key={i} message={m} />
                ))}

                {isLoading && (
                  <div className="flex items-end gap-2">
                    <AiAvatar size={24} />
                    <div className="rounded-2xl rounded-bl-sm border border-gold/20 bg-white/70 px-2 py-1">
                      <TypingDots />
                    </div>
                  </div>
                )}

                {showQuickChips && !isLoading && (
                  <div className="space-y-2 pt-2">
                    <p className="px-1 font-sans text-[10px] uppercase tracking-[0.16em] text-espresso/40">
                      Suggested questions
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_SUGGESTIONS.map((s) => (
                        <button
                          key={s.label}
                          onClick={() => sendMessage(s.query)}
                          className="rounded-full border border-gold/30 bg-white/60 px-3 py-1.5 font-sans text-[11px] text-espresso/70 transition-all hover:border-gold hover:bg-gold/10 hover:text-espresso"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="shrink-0 border-t border-gold/15 bg-white/50 px-3 py-2.5">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder="Type your question…"
                    aria-label="Type your question"
                    className="max-h-24 min-h-[36px] flex-1 resize-none rounded-lg border border-gold/20 bg-white px-3 py-2 font-sans text-sm text-espresso placeholder:text-espresso/30 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || isLoading}
                    aria-label="Send message"
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-gold-muted text-espresso shadow-sm transition-all hover:from-gold-light hover:to-gold disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Send className="size-4" />
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between px-1">
                  <p className="font-sans text-[9px] uppercase tracking-[0.16em] text-espresso/30">
                    Press Enter to send · Shift+Enter for new line
                  </p>
                  <p className="font-sans text-[9px] text-espresso/30">
                    Powered by <span className="font-semibold text-gold">GLM 5.2</span>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating bubble */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            key="bubble"
            onClick={() => setIsOpen(true)}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            role="button"
            tabIndex={0}
            aria-label="Open wewed AI assistant"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(true) } }}
            className="pointer-events-auto group relative inline-flex size-14 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-gold via-gold to-gold-muted text-espresso shadow-[0_12px_32px_-8px_rgba(191,155,95,0.6)] ring-2 ring-gold-light/30 sm:size-16"
          >
            {/* Pulsing halo */}
            <motion.span
              className="absolute inset-0 rounded-full bg-gold/50"
              animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
              aria-hidden="true"
            />
            {/* Gentle float */}
            <motion.span
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              className="relative"
            >
              <MessageCircle className="size-6 sm:size-7" strokeWidth={1.75} />
            </motion.span>
            {/* Heart accent */}
            <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-clay text-champagne ring-2 ring-champagne">
              <Heart className="size-2.5 fill-current" />
            </span>

            {/* Dismiss (hide for 24h) — small X bottom-left */}
            {onDismiss && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDismiss()
                }}
                aria-label="Hide assistant for 24 hours"
                title="Hide for 24 hours"
                className="absolute -bottom-1 -left-1 flex size-5 items-center justify-center rounded-full bg-espresso/80 text-champagne opacity-0 transition-opacity group-hover:opacity-100 hover:bg-espresso"
              >
                <X className="size-3" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Message bubble ─────────────────────────────────────────────
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={cn('flex items-end gap-2', isUser && 'flex-row-reverse')}
    >
      {!isUser && <AiAvatar size={24} />}
      <div
        className={cn(
          'max-w-[78%] whitespace-pre-wrap rounded-2xl px-3 py-2 font-sans text-[13px] leading-relaxed',
          isUser
            ? 'rounded-br-sm bg-espresso text-champagne'
            : 'rounded-bl-sm border border-gold/20 bg-white/70 text-espresso',
        )}
      >
        {message.content}
      </div>
    </motion.div>
  )
}

export default AiAssistant
