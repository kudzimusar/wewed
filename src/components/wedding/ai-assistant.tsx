'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, MessageCircle, Send, Sparkles, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  ts: number
}

interface AiAssistantProps {
  onDismiss?: () => void
  className?: string
}

const QUICK_SUGGESTIONS: { label: string; query: string }[] = [
  {
    label: 'What time should I arrive?',
    query: 'What time should I arrive at the wedding?',
  },
  {
    label: "What's the dress code?",
    query: "What's the dress code for the wedding?",
  },
  {
    label: 'How do I get there?',
    query: 'How do I get to Imba Manor? Is there a shuttle?',
  },
  {
    label: 'What food will be served?',
    query: 'What food will be served? Are dietary options available?',
  },
  {
    label: 'Can I bring my kids?',
    query: 'Can I bring my children to the wedding?',
  },
  {
    label: 'Shona wedding etiquette',
    query: 'What respectful Shona wedding traditions should guests know?',
  },
]

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    "Mhoro! 👋 I'm **Wewed AI** — here to help with Charity & Kudzie's wedding on Dec 23, 2026 at Imba Manor, Harare. Ask me about timing, dress code, transport, the menu, or Zimbabwean wedding traditions. 💛",
  ts: Date.now(),
}

function TypingDots() {
  return (
    <div
      className="flex items-center gap-1.5 px-1 py-1.5"
      aria-label="Wewed AI is typing"
    >
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="size-2 rounded-full bg-gold/70"
          animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: index * 0.15,
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
      <Sparkles
        className="text-espresso"
        style={{ width: size * 0.55, height: size * 0.55 }}
      />
    </div>
  )
}

function GuestMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children: content }) => (
          <p className="leading-relaxed not-first:mt-2">{content}</p>
        ),
        ul: ({ children: content }) => (
          <ul className="ml-4 mt-2 list-disc space-y-1">{content}</ul>
        ),
        ol: ({ children: content }) => (
          <ol className="ml-4 mt-2 list-decimal space-y-1">{content}</ol>
        ),
        li: ({ children: content }) => (
          <li className="leading-relaxed">{content}</li>
        ),
        strong: ({ children: content }) => (
          <strong className="font-semibold text-espresso">{content}</strong>
        ),
        em: ({ children: content }) => <em>{content}</em>,
        a: ({ href, children: content }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gold underline underline-offset-2 hover:text-gold-muted"
          >
            {content}
          </a>
        ),
        h1: ({ children: content }) => (
          <p className="font-semibold text-espresso">{content}</p>
        ),
        h2: ({ children: content }) => (
          <p className="font-semibold text-espresso">{content}</p>
        ),
        h3: ({ children: content }) => (
          <p className="font-semibold text-espresso">{content}</p>
        ),
        code: ({ children: content }) => (
          <code className="rounded bg-espresso/5 px-1 py-0.5 font-mono text-[11px]">
            {content}
          </code>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

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
          'max-w-[82%] rounded-2xl px-3 py-2 font-sans text-[13px] leading-relaxed',
          isUser
            ? 'whitespace-pre-wrap rounded-br-sm bg-espresso text-champagne'
            : 'rounded-bl-sm border border-gold/20 bg-white/75 text-espresso',
        )}
      >
        {isUser ? message.content : <GuestMarkdown>{message.content}</GuestMarkdown>}
      </div>
    </motion.div>
  )
}

export function AiAssistant({ onDismiss, className }: AiAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const element = scrollRef.current
    if (element) {
      element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, isLoading])

  useEffect(() => {
    if (!isOpen) return
    const timeout = setTimeout(() => inputRef.current?.focus(), 280)
    return () => clearTimeout(timeout)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [isOpen])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      const userMessage: ChatMessage = {
        role: 'user',
        content: trimmed,
        ts: Date.now(),
      }
      const nextMessages = [...messages, userMessage]

      setMessages(nextMessages)
      setInput('')
      setIsLoading(true)

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: 'guest',
            area: 'guest_concierge',
            messages: nextMessages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
          }),
        })

        const data = (await response.json()) as {
          reply?: string
          error?: string
        }

        const reply =
          data.reply ??
          "I'm having a brief moment of trouble. Please try again in a moment. 💛"

        setMessages((current) => [
          ...current,
          { role: 'assistant', content: reply, ts: Date.now() },
        ])
      } catch {
        setMessages((current) => [
          ...current,
          {
            role: 'assistant',
            content:
              "I couldn't reach Wewed AI just now. Please try again — your question matters. 💛",
            ts: Date.now(),
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, messages],
  )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage(input)
    }
  }

  const showQuickSuggestions = messages.length <= 1

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-end p-3 sm:p-5',
        className,
      )}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto absolute bottom-20 left-3 right-3 sm:bottom-24 sm:left-auto sm:right-5 sm:w-[380px]"
          >
            <div className="flex h-[min(72vh,560px)] flex-col overflow-hidden rounded-2xl border border-gold/30 bg-champagne shadow-[0_24px_64px_-20px_rgba(26,20,16,0.45)] ring-1 ring-gold/10">
              <header className="relative shrink-0 overflow-hidden bg-espresso px-4 py-3 text-champagne">
                <div
                  className="absolute inset-0 bg-gradient-to-br from-plum/30 via-transparent to-gold/15"
                  aria-hidden="true"
                />
                <div className="relative flex items-center gap-3">
                  <AiAvatar size={36} />
                  <div className="min-w-0 flex-1">
                    <h2 className="wewed-heading truncate text-base text-champagne">
                      Wewed AI
                      <span className="ml-2 align-middle text-[10px] font-sans uppercase tracking-[0.18em] text-gold-light/70">
                        Guest Concierge
                      </span>
                    </h2>
                    <p className="truncate font-sans text-[11px] text-champagne/60">
                      Ask me anything about the wedding
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close chat"
                    className="inline-flex size-8 items-center justify-center rounded-full text-champagne/60 transition-colors hover:bg-gold/10 hover:text-gold"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </header>

              <div
                ref={scrollRef}
                className="wewed-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4"
                role="log"
                aria-live="polite"
                aria-label="Chat messages"
              >
                {messages.map((message, index) => (
                  <MessageBubble
                    key={`${message.ts}-${index}`}
                    message={message}
                  />
                ))}

                {isLoading && (
                  <div className="flex items-end gap-2">
                    <AiAvatar size={24} />
                    <div className="rounded-2xl rounded-bl-sm border border-gold/20 bg-white/70 px-2 py-1">
                      <TypingDots />
                    </div>
                  </div>
                )}

                {showQuickSuggestions && !isLoading && (
                  <div className="space-y-2 pt-2">
                    <p className="px-1 font-sans text-[10px] uppercase tracking-[0.16em] text-espresso/40">
                      Suggested questions
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_SUGGESTIONS.map((suggestion) => (
                        <button
                          type="button"
                          key={suggestion.label}
                          onClick={() => void sendMessage(suggestion.query)}
                          className="rounded-full border border-gold/30 bg-white/60 px-3 py-1.5 font-sans text-[11px] text-espresso/70 transition-all hover:border-gold hover:bg-gold/10 hover:text-espresso"
                        >
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-gold/15 bg-white/50 px-3 py-2.5">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder="Type your question…"
                    aria-label="Type your question"
                    className="max-h-24 min-h-[36px] flex-1 resize-none rounded-lg border border-gold/20 bg-white px-3 py-2 font-sans text-sm text-espresso placeholder:text-espresso/30 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                  />
                  <button
                    type="button"
                    onClick={() => void sendMessage(input)}
                    disabled={!input.trim() || isLoading}
                    aria-label="Send message"
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-gold-muted text-espresso shadow-sm transition-all hover:from-gold-light hover:to-gold disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Send className="size-4" />
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-3 px-1">
                  <p className="font-sans text-[9px] uppercase tracking-[0.16em] text-espresso/30">
                    Enter to send · Shift+Enter for new line
                  </p>
                  <p className="shrink-0 font-sans text-[9px] text-espresso/30">
                    Powered by{' '}
                    <span className="font-semibold text-gold">Wewed AI</span>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isOpen && (
          <motion.div
            key="bubble-wrap"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto relative"
          >
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              aria-label="Open Wewed AI Guest Concierge"
              className="group relative inline-flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-gold via-gold to-gold-muted text-espresso shadow-[0_12px_32px_-8px_rgba(191,155,95,0.6)] ring-2 ring-gold-light/30 sm:size-16"
            >
              <motion.span
                className="absolute inset-0 rounded-full bg-gold/50"
                animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
                aria-hidden="true"
              />
              <motion.span
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                className="relative"
              >
                <MessageCircle className="size-6 sm:size-7" strokeWidth={1.75} />
              </motion.span>
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-clay text-champagne ring-2 ring-champagne">
                <Heart className="size-2.5 fill-current" />
              </span>
            </button>

            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Hide assistant for 24 hours"
                title="Hide for 24 hours"
                className="absolute -bottom-1 -left-1 flex size-5 items-center justify-center rounded-full bg-espresso/80 text-champagne opacity-0 transition-opacity hover:bg-espresso focus:opacity-100 group-hover:opacity-100"
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

export default AiAssistant
