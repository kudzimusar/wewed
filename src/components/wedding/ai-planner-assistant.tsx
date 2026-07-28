'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import {
  Sparkles,
  Send,
  X,
  Bot,
  Wand2,
  FileText,
  DollarSign,
  ListTodo,
  Users,
  Copy,
  Check,
  Heart,
  Save,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

/* ============================================================
   AiPlannerAssistant — Couple's AI tab (inside Wedding Planner)
   ------------------------------------------------------------
   NOT visible to guests — only renders inside the planner
   dashboard. The lead agent wires this into a new "AI" tab in
   wedding-planner.tsx.

   Features:
   • Chat interface (context: 'couple') — calls /api/ai/chat
   • 5 quick actions:
       1. Summarize my RSVPs   → /api/ai/summary
       2. Write my vows        → speech generator (groom/bride)
       3. Budget advice        → AI chat prompt
       4. What's due next?     → AI chat prompt + checklist fetch
       5. Help with my speech  → speech generator (all speaker types)
   • Speech generator modal: type/tone/length → generate → copy
   • AI responses render with markdown (react-markdown)
   • "Save to notes" button on AI responses (localStorage)
   • Espresso/gold theme to match the planner dashboard
   ============================================================ */

// ─── Types ──────────────────────────────────────────────────────
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts: number
  kind?: 'chat' | 'summary' | 'speech' | 'task'
  meta?: Record<string, unknown>
}

interface PlannerGuest {
  id: string
  name: string
  rsvp?: {
    attending: boolean | null
    mealChoice: string | null
    plusOne: boolean
    message: string | null
    dietaryNotes: string | null
  } | null
}

interface PlannerTask {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string | null
  category: string
}

type SpeechType =
  | 'groom'
  | 'bride'
  | 'best_man'
  | 'maid_of_honor'
  | 'father_bride'
  | 'mother_groom'
type SpeechTone = 'heartfelt' | 'funny' | 'traditional'
type SpeechLength = 'short' | 'medium' | 'long'

// ─── Static data ────────────────────────────────────────────────
const SPEECH_TYPES: { value: SpeechType; label: string }[] = [
  { value: 'groom', label: "Groom (Kudzie)" },
  { value: 'bride', label: "Bride (Charity)" },
  { value: 'best_man', label: 'Best Man' },
  { value: 'maid_of_honor', label: 'Maid of Honor' },
  { value: 'father_bride', label: "Father of the Bride" },
  { value: 'mother_groom', label: 'Mother of the Groom' },
]

const SPEECH_TONES: { value: SpeechTone; label: string }[] = [
  { value: 'heartfelt', label: 'Heartfelt & Sincere' },
  { value: 'funny', label: 'Light & Funny' },
  { value: 'traditional', label: 'Traditional' },
]

const SPEECH_LENGTHS: { value: SpeechLength; label: string; hint: string }[] = [
  { value: 'short', label: 'Short', hint: '≈ 2 min' },
  { value: 'medium', label: 'Medium', hint: '≈ 4 min' },
  { value: 'long', label: 'Long', hint: '≈ 6 min' },
]

const QUICK_ACTIONS = [
  {
    id: 'summary',
    label: 'Summarize my RSVPs',
    icon: Users,
    accent: 'text-gold',
  },
  {
    id: 'vows',
    label: 'Write my vows',
    icon: Heart,
    accent: 'text-clay-light',
  },
  {
    id: 'budget',
    label: 'Budget advice',
    icon: DollarSign,
    accent: 'text-sage-light',
  },
  {
    id: 'due',
    label: "What's due next?",
    icon: ListTodo,
    accent: 'text-gold-light',
  },
  {
    id: 'speech',
    label: 'Help with my speech',
    icon: FileText,
    accent: 'text-plum-light',
  },
] as const

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  kind: 'chat',
  content:
    "Mhoro Charity & Kudzie! 👋 I'm your **wewed AI planning concierge** — here to help you finalize every detail for Dec 23, 2026 at Imba Manor. Ask me about budget, the checklist, vendor questions, vows, speeches, or Zimbabwean wedding customs (roora, magumo). Try a quick action above, or just type your question below. 💛",
  ts: Date.now(),
}

const NOTES_STORAGE_KEY = 'wewed:ai-planner-notes'

// ─── Utils ──────────────────────────────────────────────────────
function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ─── Main component ─────────────────────────────────────────────
export function AiPlannerAssistant() {
  const { toast } = useToast()
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Speech generator modal
  const [speechModalOpen, setSpeechModalOpen] = useState(false)
  const [speechType, setSpeechType] = useState<SpeechType>('groom')
  const [speechTone, setSpeechTone] = useState<SpeechTone>('heartfelt')
  const [speechLength, setSpeechLength] = useState<SpeechLength>('medium')
  const [speechResult, setSpeechResult] = useState<string>('')
  const [speechLoading, setSpeechLoading] = useState(false)
  const [speechCopied, setSpeechCopied] = useState(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, isLoading])

  // ── Core chat send ──
  const sendToAI = useCallback(
    async (userText: string, kind: ChatMessage['kind'] = 'chat') => {
      const trimmed = userText.trim()
      if (!trimmed || isLoading) return

      const userMsg: ChatMessage = {
        id: uid(),
        role: 'user',
        content: trimmed,
        ts: Date.now(),
        kind,
      }
      const nextMessages = [...messages, userMsg]
      setMessages(nextMessages)
      setInput('')
      setIsLoading(true)

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: 'couple',
            messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          }),
        })
        if (res.status === 401) {
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: 'assistant',
              kind: 'chat',
              content:
                "I need you to be logged into the planner to use this. Please reopen the planner via the **Plan** button in the navbar.",
              ts: Date.now(),
            },
          ])
          return
        }
        const data = (await res.json()) as { reply?: string }
        const reply =
          data.reply ??
          "I'm having a brief moment of trouble. Please try again in a moment. 💛"
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'assistant',
            content: reply,
            ts: Date.now(),
            kind,
          },
        ])
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'assistant',
            content:
              "I couldn't reach the AI service just now. Please try again — your planning matters. 💛",
            ts: Date.now(),
            kind,
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, messages],
  )

  // ── Quick action: summarize RSVPs ──
  const handleSummarizeRSVPs = useCallback(async () => {
    if (isLoading) return
    setIsLoading(true)
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: 'user',
        content: 'Please summarize my current RSVPs.',
        ts: Date.now(),
        kind: 'summary',
      },
    ])

    try {
      // Fetch real RSVP data from the planner API
      const guestRes = await fetch('/api/planner/guests', { cache: 'no-store' })
      let rsvps: { name: string; attending: boolean | null; meal: string | null; plusOne: boolean; message: string | null }[] = []
      if (guestRes.ok) {
        const data = (await guestRes.json()) as { data?: PlannerGuest[] }
        rsvps = (data.data ?? [])
          .filter((g) => g.rsvp)
          .map((g) => ({
            name: g.name,
            attending: g.rsvp!.attending,
            meal: g.rsvp!.mealChoice,
            plusOne: g.rsvp!.plusOne,
            message: g.rsvp!.message,
          }))
      }

      if (rsvps.length === 0) {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'assistant',
            kind: 'summary',
            content:
              "You don't have any RSVP responses logged yet. Once guests start replying, I'll give you a warm, natural summary of meal counts, dietary notes, plus-ones, and the messages they've sent. Want me to remind you to send a follow-up nudge to pending guests?",
            ts: Date.now(),
          },
        ])
        return
      }

      // Call AI summary endpoint
      const summaryRes = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rsvps }),
      })

      if (summaryRes.status === 401) {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'assistant',
            kind: 'summary',
            content: "I need you to be logged into the planner to use this feature.",
            ts: Date.now(),
          },
        ])
        return
      }

      const summaryData = (await summaryRes.json()) as { summary?: string }
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          kind: 'summary',
          content: summaryData.summary ?? 'Here is your RSVP summary.',
          ts: Date.now(),
          meta: { rsvpCount: rsvps.length },
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          kind: 'summary',
          content:
            "I couldn't fetch your RSVPs just now. Please try again — I want to give you the right picture. 💛",
          ts: Date.now(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [isLoading])

  // ── Quick action: budget advice ──
  const handleBudgetAdvice = useCallback(() => {
    sendToAI(
      "We're planning our wedding at Imba Manor in Harare on Dec 23, 2026. Give me 4-5 practical budget optimization tips specific to Zimbabwean weddings — where to splurge vs. save, and any traditional cost considerations (roora, family contributions).",
      'chat',
    )
  }, [sendToAI])

  // ── Quick action: what's due next ──
  const handleWhatsDue = useCallback(async () => {
    if (isLoading) return
    setIsLoading(true)
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: 'user',
        content: "What's due next on my checklist?",
        ts: Date.now(),
        kind: 'task',
      },
    ])

    try {
      const taskRes = await fetch('/api/planner/tasks', { cache: 'no-store' })
      let tasks: PlannerTask[] = []
      if (taskRes.ok) {
        const data = (await taskRes.json()) as { data?: PlannerTask[] } | PlannerTask[]
        tasks = Array.isArray(data) ? data : (data.data ?? [])
      }

      const open = tasks.filter((t) => t.status !== 'done')
      const taskSummary =
        open.length === 0
          ? 'No open tasks — your checklist is fully complete!'
          : open
              .slice(0, 12)
              .map(
                (t) =>
                  `• [${t.priority.toUpperCase()}] ${t.title}${t.dueDate ? ` (due ${t.dueDate.split('T')[0]})` : ''} — ${t.category}`,
              )
              .join('\n')

      const prompt =
        open.length === 0
          ? "Our wedding checklist shows 0 open tasks. Congratulate us briefly and suggest 3 final-week polish items for a Zimbabwean wedding at Imba Manor (Dec 23, 2026)."
          : `Here are our open wedding tasks (Dec 23, 2026, Imba Manor, Harare):\n\n${taskSummary}\n\nPlease prioritize these for me — tell me the top 3 to focus on next, and flag anything that looks urgent. Keep it warm and practical, under 200 words.`

      // Send to AI as a couple-context chat with the task data baked in
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: 'couple',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      })
      const data = (await res.json()) as { reply?: string }
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          kind: 'task',
          content:
            data.reply ??
            "I pulled your checklist but couldn't quite analyze it just now. Please try again. 💛",
          ts: Date.now(),
          meta: { openTaskCount: open.length },
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          kind: 'task',
          content:
            "I couldn't fetch your checklist just now. Please try again in a moment. 💛",
          ts: Date.now(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [isLoading])

  // ── Quick action: write my vows (opens speech modal preset to bride/groom) ──
  const handleWriteVows = useCallback(() => {
    setSpeechResult('')
    setSpeechTone('heartfelt')
    setSpeechLength('medium')
    setSpeechType('groom')
    setSpeechModalOpen(true)
  }, [])

  // ── Quick action: help with speech (opens modal with broader type) ──
  const handleSpeechHelp = useCallback(() => {
    setSpeechResult('')
    setSpeechTone('heartfelt')
    setSpeechLength('medium')
    setSpeechType('best_man')
    setSpeechModalOpen(true)
  }, [])

  const handleQuickAction = (id: string) => {
    switch (id) {
      case 'summary':
        void handleSummarizeRSVPs()
        break
      case 'vows':
        handleWriteVows()
        break
      case 'budget':
        handleBudgetAdvice()
        break
      case 'due':
        void handleWhatsDue()
        break
      case 'speech':
        handleSpeechHelp()
        break
    }
  }

  // ── Speech generator: generate ──
  const handleGenerateSpeech = useCallback(async () => {
    if (speechLoading) return
    setSpeechLoading(true)
    setSpeechResult('')
    setSpeechCopied(false)

    try {
      const res = await fetch('/api/ai/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: speechType,
          tone: speechTone,
          length: speechLength,
        }),
      })

      if (res.status === 401) {
        toast({
          title: 'Unauthorized',
          description: 'Please log into the planner to use the speech generator.',
          variant: 'destructive',
        })
        return
      }

      const data = (await res.json()) as { speech?: string; error?: string; meta?: { wordCount?: number } }
      if (!data.speech) {
        toast({
          title: 'Generation failed',
          description: data.error ?? 'Please try again in a moment.',
          variant: 'destructive',
        })
        return
      }
      setSpeechResult(data.speech)
    } catch {
      toast({
        title: 'Network error',
        description: "I couldn't reach the AI just now. Please try again.",
        variant: 'destructive',
      })
    } finally {
      setSpeechLoading(false)
    }
  }, [speechLoading, speechType, speechTone, speechLength, toast])

  // ── Speech generator: copy ──
  const handleCopySpeech = useCallback(async () => {
    if (!speechResult) return
    try {
      await navigator.clipboard.writeText(speechResult)
      setSpeechCopied(true)
      toast({ title: 'Copied to clipboard', description: 'Your speech is ready to paste.' })
      setTimeout(() => setSpeechCopied(false), 2000)
    } catch {
      toast({
        title: 'Could not copy',
        description: 'Please select the text and copy manually.',
        variant: 'destructive',
      })
    }
  }, [speechResult, toast])

  // ── Save any AI message to localStorage notes ──
  const handleSaveNote = useCallback(
    (msg: ChatMessage) => {
      try {
        const raw = localStorage.getItem(NOTES_STORAGE_KEY)
        const notes = raw ? (JSON.parse(raw) as Array<{ id: string; content: string; kind: string; ts: number }>) : []
        notes.unshift({ id: msg.id, content: msg.content, kind: msg.kind ?? 'chat', ts: msg.ts })
        localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes.slice(0, 50)))
        toast({
          title: 'Saved to notes',
          description: 'Find it later in your browser’s localStorage (wewed:ai-planner-notes).',
        })
      } catch {
        toast({
          title: 'Could not save',
          description: 'LocalStorage may be disabled in your browser.',
          variant: 'destructive',
        })
      }
    },
    [toast],
  )

  // ── Send chat input ──
  const handleSendInput = () => {
    void sendToAI(input, 'chat')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendInput()
    }
  }

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col gap-3 bg-espresso p-3 sm:p-4">
      {/* Header */}
      <header className="shrink-0 rounded-xl border border-gold/20 bg-gradient-to-br from-espresso via-espresso to-plum/15 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-muted ring-1 ring-gold-light/30">
            <Sparkles className="size-5 text-espresso" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="wewed-heading text-base text-champagne sm:text-lg">
              wewed AI
              <span className="ml-2 align-middle font-sans text-[10px] uppercase tracking-[0.18em] text-gold-light/70">
                Planning Concierge
              </span>
            </h2>
            <p className="truncate font-sans text-[11px] text-champagne/50">
              Your wedding co-pilot for Dec 23, 2026 · Imba Manor, Harare
            </p>
          </div>
          <div className="hidden items-center gap-1.5 rounded-full border border-gold/20 bg-gold/5 px-3 py-1 sm:flex">
            <span className="size-1.5 rounded-full bg-gold wewed-pulse-dot" />
            <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-gold-light/80">
              Powered by GLM 5.2
            </span>
          </div>
        </div>
      </header>

      {/* Quick actions */}
      <div className="shrink-0">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon
            return (
              <button
                key={a.id}
                onClick={() => handleQuickAction(a.id)}
                disabled={isLoading}
                className="group flex flex-col items-start gap-1.5 rounded-lg border border-gold/20 bg-champagne/[0.03] px-3 py-2.5 text-left transition-all hover:border-gold/50 hover:bg-gold/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon className={cn('size-4 transition-transform group-hover:scale-110', a.accent)} />
                <span className="font-sans text-[11px] leading-tight text-champagne/80">
                  {a.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="wewed-scroll min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-gold/10 bg-espresso/40 p-3"
        role="log"
        aria-live="polite"
        aria-label="AI chat messages"
      >
        {messages.map((m) => (
          <PlannerMessageBubble
            key={m.id}
            message={m}
            onSaveNote={() => handleSaveNote(m)}
          />
        ))}

        {isLoading && (
          <div className="flex items-end gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-muted">
              <Bot className="size-4 text-espresso" />
            </div>
            <div className="rounded-2xl rounded-bl-sm border border-gold/20 bg-champagne/5 px-3 py-2">
              <TypingDots />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 rounded-xl border border-gold/20 bg-champagne/[0.03] p-2.5">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Ask about budget, vows, vendors, the checklist, or Zimbabwean wedding customs…"
            aria-label="Ask wewed AI"
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 font-sans text-sm text-champagne placeholder:text-champagne/30 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
          />
          <button
            onClick={handleSendInput}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-gold-muted text-espresso shadow-sm transition-all hover:from-gold-light hover:to-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>

      {/* Speech Generator Modal */}
      <SpeechGeneratorModal
        open={speechModalOpen}
        onOpenChange={setSpeechModalOpen}
        type={speechType}
        tone={speechTone}
        length={speechLength}
        onTypeChange={setSpeechType}
        onToneChange={setSpeechTone}
        onLengthChange={setSpeechLength}
        result={speechResult}
        loading={speechLoading}
        copied={speechCopied}
        onGenerate={handleGenerateSpeech}
        onCopy={handleCopySpeech}
        onSaveToNotes={(text) => {
          handleSaveNote({
            id: uid(),
            role: 'assistant',
            content: text,
            ts: Date.now(),
            kind: 'speech',
          })
        }}
      />
    </div>
  )
}

// ─── Planner message bubble (markdown rendering) ────────────────
function PlannerMessageBubble({
  message,
  onSaveNote,
}: {
  message: ChatMessage
  onSaveNote: () => void
}) {
  const isUser = message.role === 'user'
  const [saved, setSaved] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={cn('flex items-end gap-2', isUser && 'flex-row-reverse')}
    >
      {!isUser && (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-muted ring-1 ring-gold-light/30">
          <Bot className="size-4 text-espresso" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 font-sans text-[13px] leading-relaxed',
          isUser
            ? 'rounded-br-sm bg-gradient-to-br from-gold to-gold-muted text-espresso'
            : 'rounded-bl-sm border border-gold/20 bg-champagne/[0.04] text-champagne/90',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="space-y-1.5">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="leading-relaxed">{children}</p>,
                ul: ({ children }) => (
                  <ul className="ml-4 list-disc space-y-1">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="ml-4 list-decimal space-y-1">{children}</ol>
                ),
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                strong: ({ children }) => (
                  <strong className="font-semibold text-gold-light">{children}</strong>
                ),
                em: ({ children }) => <em className="text-clay-light">{children}</em>,
                h3: ({ children }) => (
                  <h3 className="wewed-heading mt-2 text-sm text-gold">{children}</h3>
                ),
                h4: ({ children }) => (
                  <h4 className="wewed-heading mt-2 text-sm text-gold-light">{children}</h4>
                ),
                code: ({ children }) => (
                  <code className="rounded bg-espresso/60 px-1 py-0.5 font-mono text-[11px] text-gold-light">
                    {children}
                  </code>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-gold/40 pl-3 italic text-champagne/70">
                    {children}
                  </blockquote>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold underline underline-offset-2 hover:text-gold-light"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>

            {/* Save-to-notes footer */}
            {!isUser && message.id !== 'welcome' && (
              <div className="mt-2 flex items-center justify-end gap-1.5 border-t border-gold/10 pt-1.5">
                <button
                  onClick={() => {
                    onSaveNote()
                    setSaved(true)
                    setTimeout(() => setSaved(false), 2000)
                  }}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.14em] text-champagne/50 transition-colors hover:bg-gold/10 hover:text-gold"
                >
                  {saved ? <Check className="size-3" /> : <Save className="size-3" />}
                  {saved ? 'Saved' : 'Save to notes'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Typing dots ────────────────────────────────────────────────
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

// ─── Speech Generator Modal ─────────────────────────────────────
interface SpeechGeneratorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: SpeechType
  tone: SpeechTone
  length: SpeechLength
  onTypeChange: (v: SpeechType) => void
  onToneChange: (v: SpeechTone) => void
  onLengthChange: (v: SpeechLength) => void
  result: string
  loading: boolean
  copied: boolean
  onGenerate: () => void
  onCopy: () => void
  onSaveToNotes: (text: string) => void
}

function SpeechGeneratorModal({
  open,
  onOpenChange,
  type,
  tone,
  length,
  onTypeChange,
  onToneChange,
  onLengthChange,
  result,
  loading,
  copied,
  onGenerate,
  onCopy,
  onSaveToNotes,
}: SpeechGeneratorModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden border-gold/30 bg-espresso p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-gold/15 px-5 py-4 text-left">
          <DialogTitle className="wewed-heading flex items-center gap-2 text-lg text-champagne">
            <Wand2 className="size-5 text-gold" />
            AI Speech & Vows Generator
          </DialogTitle>
          <DialogDescription className="text-champagne/50">
            Crafted for Charity & Kudzie · Dec 23, 2026 · Imba Manor
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[calc(90vh-120px)] flex-col gap-4 overflow-y-auto px-5 py-4">
          {/* Selectors */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="font-sans text-[11px] uppercase tracking-[0.14em] text-gold-light/80">
                Speaker
              </Label>
              <Select value={type} onValueChange={(v) => onTypeChange(v as SpeechType)}>
                <SelectTrigger className="border-gold/20 bg-champagne/[0.04] text-champagne hover:border-gold/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-gold/20 bg-espresso text-champagne">
                  {SPEECH_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="focus:bg-gold/10 focus:text-gold">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-sans text-[11px] uppercase tracking-[0.14em] text-gold-light/80">
                Tone
              </Label>
              <Select value={tone} onValueChange={(v) => onToneChange(v as SpeechTone)}>
                <SelectTrigger className="border-gold/20 bg-champagne/[0.04] text-champagne hover:border-gold/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-gold/20 bg-espresso text-champagne">
                  {SPEECH_TONES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="focus:bg-gold/10 focus:text-gold">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-sans text-[11px] uppercase tracking-[0.14em] text-gold-light/80">
                Length
              </Label>
              <Select value={length} onValueChange={(v) => onLengthChange(v as SpeechLength)}>
                <SelectTrigger className="border-gold/20 bg-champagne/[0.04] text-champagne hover:border-gold/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-gold/20 bg-espresso text-champagne">
                  {SPEECH_LENGTHS.map((l) => (
                    <SelectItem key={l.value} value={l.value} className="focus:bg-gold/10 focus:text-gold">
                      {l.label} <span className="text-champagne/40">· {l.hint}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate button */}
          <Button
            onClick={onGenerate}
            disabled={loading}
            className="bg-gradient-to-br from-gold to-gold-muted text-espresso hover:from-gold-light hover:to-gold"
          >
            <Wand2 className="size-4" />
            {loading ? 'Writing your speech…' : result ? 'Regenerate speech' : 'Generate speech'}
          </Button>

          {/* Result */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-gold-light/80">
                    Draft speech
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onCopy}
                      className="h-7 gap-1.5 px-2 text-[11px] text-champagne/70 hover:bg-gold/10 hover:text-gold"
                    >
                      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onSaveToNotes(result)}
                      className="h-7 gap-1.5 px-2 text-[11px] text-champagne/70 hover:bg-gold/10 hover:text-gold"
                    >
                      <Save className="size-3" />
                      Save
                    </Button>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-gold/20 bg-champagne/[0.04] p-3">
                  <div className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-champagne/90">
                    {result}
                  </div>
                </div>
                <p className="text-right font-sans text-[10px] text-champagne/30">
                  {result.split(/\s+/).length} words · ~
                  {Math.max(1, Math.round(result.split(/\s+/).length / 140))} min spoken
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {!result && !loading && (
            <div className="rounded-lg border border-dashed border-gold/20 bg-champagne/[0.02] p-6 text-center">
              <FileText className="mx-auto mb-2 size-6 text-gold/40" />
              <p className="font-sans text-[12px] text-champagne/40">
                Choose a speaker, tone, and length — then click{' '}
                <span className="text-gold">Generate speech</span>.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AiPlannerAssistant
