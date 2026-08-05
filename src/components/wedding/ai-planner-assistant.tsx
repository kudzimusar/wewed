'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { LucideIcon } from 'lucide-react'
import {
  Bot,
  CalendarDays,
  ClipboardList,
  Copy,
  DollarSign,
  FileText,
  Heart,
  ListTodo,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  AiProductArea,
  PlannerAiOperation,
} from '@/lib/ai/remediation'

type MessageKind = 'chat' | 'analysis' | 'template' | 'draft' | 'speech'

interface ChatSource {
  citation: string
  title: string
  sourceUrl: string | null
  visibility: 'private' | 'public'
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  kind: MessageKind
  sources?: ChatSource[]
  provider?: string
  model?: string
  fallback?: boolean
}

interface AreaConfig {
  label: string
  description: string
  boundary: string
  placeholder: string
  icon: LucideIcon
}

interface QuickAction {
  id: PlannerAiOperation | 'speech_vows'
  label: string
  description: string
  icon: LucideIcon
  kind: MessageKind
}

const AREA_ORDER: AiProductArea[] = [
  'guest_concierge',
  'planner_copilot',
  'template_intelligence',
  'communication_assistant',
]

const AREA_CONFIG: Record<AiProductArea, AreaConfig> = {
  guest_concierge: {
    label: 'Guest Concierge',
    description: 'Test answers built only from published guest information.',
    boundary: 'Published information only',
    placeholder: 'Test a guest question…',
    icon: MessageCircle,
  },
  planner_copilot: {
    label: 'Planner Copilot',
    description:
      'Analyse server-built tasks, RSVPs, budget, vendors and timeline context.',
    boundary: 'Read-only; active wedding and permissions enforced',
    placeholder: 'Ask what needs attention or what is at risk…',
    icon: ListTodo,
  },
  template_intelligence: {
    label: 'Template Intelligence',
    description: 'Create and audit reusable planning templates.',
    boundary: 'Draft only; save, review and apply separately',
    placeholder: 'Describe a reusable template or gap analysis…',
    icon: FileText,
  },
  communication_assistant: {
    label: 'Communication Assistant',
    description: 'Draft vendor, guest, couple and wedding-party communication.',
    boundary: 'Draft only; nothing is sent automatically',
    placeholder: 'Describe the audience, channel, tone and message…',
    icon: Mail,
  },
}

const QUICK_ACTIONS: Record<AiProductArea, QuickAction[]> = {
  guest_concierge: [
    {
      id: 'guest_answer_preview',
      label: 'Test ceremony answer',
      description: 'Preview the published ceremony-time answer.',
      icon: MessageCircle,
      kind: 'chat',
    },
    {
      id: 'guest_faq_gaps',
      label: 'Find FAQ gaps',
      description: 'Identify useful unanswered public questions.',
      icon: Search,
      kind: 'analysis',
    },
    {
      id: 'guest_travel_draft',
      label: 'Draft travel guidance',
      description: 'Use published venue and transport details only.',
      icon: MapPin,
      kind: 'draft',
    },
    {
      id: 'guest_privacy_review',
      label: 'Review privacy boundary',
      description: 'Check what the public assistant must not reveal.',
      icon: Lock,
      kind: 'analysis',
    },
  ],
  planner_copilot: [
    {
      id: 'daily_attention_brief',
      label: 'Daily attention brief',
      description: 'Combine authorised operational signals.',
      icon: CalendarDays,
      kind: 'analysis',
    },
    {
      id: 'rsvp_summary',
      label: 'Summarise RSVPs',
      description: 'Highlight attendance, meals and follow-ups.',
      icon: Users,
      kind: 'analysis',
    },
    {
      id: 'task_priorities',
      label: 'Prioritise tasks',
      description: 'Identify urgent, overdue and blocked work.',
      icon: ListTodo,
      kind: 'analysis',
    },
    {
      id: 'budget_review',
      label: 'Review budget',
      description: 'Analyse authorised amounts and payment pressure.',
      icon: DollarSign,
      kind: 'analysis',
    },
  ],
  template_intelligence: [
    {
      id: 'template_starter',
      label: 'Create starter template',
      description: 'Generate reusable structured items.',
      icon: Sparkles,
      kind: 'template',
    },
    {
      id: 'template_gap_analysis',
      label: 'Audit current plan',
      description: 'Compare the active wedding with a complete plan.',
      icon: ClipboardList,
      kind: 'template',
    },
    {
      id: 'template_timeline',
      label: 'Draft timeline template',
      description: 'Build dependency-aware phases.',
      icon: CalendarDays,
      kind: 'template',
    },
    {
      id: 'template_anonymization_review',
      label: 'Prepare for reuse',
      description: 'Identify information that must be removed.',
      icon: Lock,
      kind: 'template',
    },
  ],
  communication_assistant: [
    {
      id: 'vendor_followup_draft',
      label: 'Vendor follow-up',
      description: 'Draft a firm but warm confirmation request.',
      icon: Mail,
      kind: 'draft',
    },
    {
      id: 'guest_announcement_draft',
      label: 'Guest announcement',
      description: 'Draft a concise published-logistics update.',
      icon: Users,
      kind: 'draft',
    },
    {
      id: 'couple_progress_update',
      label: 'Couple progress update',
      description: 'Draft a weekly planning summary.',
      icon: ClipboardList,
      kind: 'draft',
    },
    {
      id: 'speech_vows',
      label: 'Speech or vows',
      description: 'Generate a wedding-scoped first draft.',
      icon: Heart,
      kind: 'speech',
    },
  ],
}

const AREA_WELCOME: Record<AiProductArea, string> = {
  guest_concierge:
    'Test the **public Guest Concierge** here. It can use only published information for the active wedding.',
  planner_copilot:
    'Use **Planner Copilot** for priorities, RSVP analysis, budget pressure, vendor gaps and timeline risks. It cannot change records.',
  template_intelligence:
    'Use **Template Intelligence** to create and audit reusable plans. Save and apply results through the separate review workflow.',
  communication_assistant:
    'Use the **Communication Assistant** to prepare drafts. Nothing is sent or published automatically.',
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function initialConversations(): Record<AiProductArea, ChatMessage[]> {
  return AREA_ORDER.reduce(
    (result, area) => {
      result[area] = [
        {
          id: `welcome-${area}`,
          role: 'assistant',
          content: AREA_WELCOME[area],
          kind: 'chat',
        },
      ]
      return result
    },
    {} as Record<AiProductArea, ChatMessage[]>,
  )
}

function safeHref(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value, window.location.origin)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : null
  } catch {
    return null
  }
}

function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children: value }) => (
          <p className="mb-2 leading-relaxed last:mb-0">{value}</p>
        ),
        ul: ({ children: value }) => (
          <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{value}</ul>
        ),
        ol: ({ children: value }) => (
          <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{value}</ol>
        ),
        li: ({ children: value }) => <li className="leading-relaxed">{value}</li>,
        strong: ({ children: value }) => (
          <strong className="font-semibold text-gold-light">{value}</strong>
        ),
        h1: ({ children: value }) => (
          <h3 className="wewed-heading mb-1 mt-2 text-sm text-gold">{value}</h3>
        ),
        h2: ({ children: value }) => (
          <h3 className="wewed-heading mb-1 mt-2 text-sm text-gold">{value}</h3>
        ),
        h3: ({ children: value }) => (
          <h3 className="wewed-heading mb-1 mt-2 text-sm text-gold">{value}</h3>
        ),
        code: ({ children: value }) => (
          <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[11px] text-gold-light">
            {value}
          </code>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

export function AiPlannerAssistant() {
  const [activeArea, setActiveArea] =
    useState<AiProductArea>('planner_copilot')
  const [conversations, setConversations] = useState(initialConversations)
  const [input, setInput] = useState('')
  const [loadingArea, setLoadingArea] = useState<AiProductArea | null>(null)
  const [speechType, setSpeechType] = useState('groom')
  const [speechTone, setSpeechTone] = useState('heartfelt')
  const [speechLength, setSpeechLength] = useState('medium')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const activeMessages = conversations[activeArea]
  const config = AREA_CONFIG[activeArea]
  const actions = QUICK_ACTIONS[activeArea]
  const isLoading = loadingArea !== null

  useEffect(() => {
    const element = scrollRef.current
    if (element) {
      element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
    }
  }, [activeMessages, loadingArea])

  useEffect(() => {
    setInput('')
    const timeout = setTimeout(() => inputRef.current?.focus(), 100)
    return () => clearTimeout(timeout)
  }, [activeArea])

  const append = useCallback(
    (area: AiProductArea, message: Omit<ChatMessage, 'id'>) => {
      setConversations((current) => ({
        ...current,
        [area]: [...current[area], { id: uid(), ...message }],
      }))
    },
    [],
  )

  const requestAi = useCallback(
    async (inputRequest: {
      area: AiProductArea
      userLabel: string
      kind: MessageKind
      operation?: PlannerAiOperation
      text?: string
    }) => {
      if (loadingArea) return
      const { area, userLabel, kind, operation, text } = inputRequest
      append(area, { role: 'user', content: userLabel, kind })
      setLoadingArea(area)
      setInput('')

      try {
        const existing = conversations[area]
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: 'couple',
            area,
            operation,
            messages: operation
              ? [{ role: 'user', content: userLabel }]
              : [
                  ...existing.map((message) => ({
                    role: message.role,
                    content: message.content,
                  })),
                  { role: 'user', content: text ?? userLabel },
                ],
          }),
        })
        const payload = (await response.json()) as {
          reply?: string
          error?: string
          provider?: string
          model?: string
          fallback?: boolean
          sources?: ChatSource[]
        }
        if (!response.ok) {
          throw new Error(payload.error || `HTTP ${response.status}`)
        }
        append(area, {
          role: 'assistant',
          content:
            payload.reply ??
            'Wewed AI did not return a response. No records were changed.',
          kind,
          sources: payload.sources ?? [],
          provider: payload.provider,
          model: payload.model,
          fallback: payload.fallback,
        })
      } catch (error) {
        append(area, {
          role: 'assistant',
          content: `${error instanceof Error ? error.message : 'Wewed AI is temporarily unavailable.'}\n\nNo records were changed and nothing was sent.`,
          kind,
          fallback: true,
        })
      } finally {
        setLoadingArea(null)
      }
    },
    [append, conversations, loadingArea],
  )

  const runQuickAction = useCallback(
    (action: QuickAction) => {
      if (action.id === 'speech_vows') return
      void requestAi({
        area: activeArea,
        userLabel: action.label,
        kind: action.kind,
        operation: action.id,
      })
    },
    [activeArea, requestAi],
  )

  const generateSpeech = useCallback(async () => {
    if (loadingArea) return
    const label = `Generate ${speechTone} ${speechType.replaceAll('_', ' ')} ${speechLength} speech or vows`
    append('communication_assistant', {
      role: 'user',
      content: label,
      kind: 'speech',
    })
    setLoadingArea('communication_assistant')
    try {
      const response = await fetch('/api/ai/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: speechType,
          tone: speechTone,
          length: speechLength,
        }),
      })
      const payload = (await response.json()) as {
        speech?: string
        error?: string
        provider?: string
        model?: string
      }
      if (!response.ok || !payload.speech) {
        throw new Error(payload.error || `HTTP ${response.status}`)
      }
      append('communication_assistant', {
        role: 'assistant',
        content: payload.speech.startsWith('Draft')
          ? payload.speech
          : `## Draft speech or vows\n\n${payload.speech}`,
        kind: 'speech',
        provider: payload.provider,
        model: payload.model,
      })
    } catch (error) {
      append('communication_assistant', {
        role: 'assistant',
        content: `${error instanceof Error ? error.message : 'Speech generation failed.'}\n\nNothing was sent or published.`,
        kind: 'speech',
        fallback: true,
      })
    } finally {
      setLoadingArea(null)
    }
  }, [append, loadingArea, speechLength, speechTone, speechType])

  const sendFreeForm = () => {
    const value = input.trim()
    if (!value || isLoading) return
    const kind: MessageKind =
      activeArea === 'template_intelligence'
        ? 'template'
        : activeArea === 'communication_assistant'
          ? 'draft'
          : 'chat'
    void requestAi({
      area: activeArea,
      userLabel: value,
      text: value,
      kind,
    })
  }

  const areaStatus = useMemo(
    () => `${config.boundary} · AI output requires human review`,
    [config.boundary],
  )

  return (
    <div className="flex h-full flex-col gap-3 bg-espresso p-3 sm:p-4">
      <header className="shrink-0 rounded-xl border border-gold/20 bg-gradient-to-br from-espresso via-espresso to-plum/15 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-muted">
            <Sparkles className="size-5 text-espresso" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="wewed-heading text-base text-champagne sm:text-lg">
              Wewed AI Workspace
            </h2>
            <p className="truncate font-sans text-[11px] text-champagne/50">
              Four wedding-scoped areas · server-built context · controlled actions
            </p>
          </div>
          <span className="hidden rounded-full border border-gold/20 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-gold sm:inline-flex">
            Powered by Wewed AI
          </span>
        </div>
      </header>

      <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
        {AREA_ORDER.map((area) => {
          const item = AREA_CONFIG[area]
          const Icon = item.icon
          const active = area === activeArea
          return (
            <button
              type="button"
              key={area}
              onClick={() => setActiveArea(area)}
              className={cn(
                'rounded-xl border px-3 py-3 text-left transition-colors',
                active
                  ? 'border-gold/60 bg-gold/10'
                  : 'border-gold/15 bg-champagne/[0.025] hover:border-gold/35',
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className={cn('size-4', active ? 'text-gold' : 'text-champagne/50')} />
                <span className="text-xs font-medium text-champagne">{item.label}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-champagne/40">
                {item.description}
              </p>
            </button>
          )
        })}
      </div>

      <section className="shrink-0 rounded-xl border border-gold/15 bg-champagne/[0.025] p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-champagne">{config.label}</p>
            <p className="mt-0.5 text-[11px] text-champagne/50">{config.description}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-gold/20 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-gold-light/75">
            <Lock className="size-3" /> {areaStatus}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <button
                type="button"
                key={action.id}
                onClick={() => runQuickAction(action)}
                disabled={isLoading || action.id === 'speech_vows'}
                className="rounded-lg border border-gold/15 bg-espresso/30 px-3 py-2.5 text-left transition-colors hover:border-gold/40 disabled:opacity-50"
              >
                <Icon className="size-4 text-gold" />
                <p className="mt-1.5 text-[11px] font-medium text-champagne/85">
                  {action.label}
                </p>
                <p className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-champagne/40">
                  {action.description}
                </p>
              </button>
            )
          })}
        </div>

        {activeArea === 'communication_assistant' && (
          <div className="mt-3 grid gap-2 rounded-lg border border-gold/10 bg-black/10 p-3 sm:grid-cols-4">
            <select
              value={speechType}
              onChange={(event) => setSpeechType(event.target.value)}
              className="rounded-lg border border-gold/20 bg-espresso px-2 py-2 text-xs text-champagne"
            >
              <option value="groom">Groom</option>
              <option value="bride">Bride</option>
              <option value="best_man">Best man</option>
              <option value="maid_of_honor">Maid of honor</option>
              <option value="father_bride">Father of the bride</option>
              <option value="mother_groom">Mother of the groom</option>
            </select>
            <select
              value={speechTone}
              onChange={(event) => setSpeechTone(event.target.value)}
              className="rounded-lg border border-gold/20 bg-espresso px-2 py-2 text-xs text-champagne"
            >
              <option value="heartfelt">Heartfelt</option>
              <option value="funny">Light and funny</option>
              <option value="traditional">Traditional</option>
            </select>
            <select
              value={speechLength}
              onChange={(event) => setSpeechLength(event.target.value)}
              className="rounded-lg border border-gold/20 bg-espresso px-2 py-2 text-xs text-champagne"
            >
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
            <button
              type="button"
              onClick={() => void generateSpeech()}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-espresso disabled:opacity-50"
            >
              <Heart className="size-4" /> Generate draft
            </button>
          </div>
        )}
      </section>

      <div
        ref={scrollRef}
        className="wewed-scroll min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-gold/10 bg-espresso/40 p-3"
        role="log"
        aria-live="polite"
        aria-label={`${config.label} messages`}
      >
        {activeMessages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {loadingArea === activeArea && (
          <div className="flex items-center gap-2 text-xs text-champagne/50">
            <Bot className="size-4 text-gold" /> Wewed AI is preparing a response…
          </div>
        )}
      </div>

      <div className="shrink-0 rounded-xl border border-gold/20 bg-champagne/[0.03] p-2.5">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                sendFreeForm()
              }
            }}
            rows={1}
            placeholder={config.placeholder}
            aria-label={`Ask ${config.label}`}
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm text-champagne placeholder:text-champagne/30 focus:border-gold focus:outline-none"
          />
          <button
            type="button"
            onClick={sendFreeForm}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
            className="inline-flex size-10 items-center justify-center rounded-lg bg-gold text-espresso disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[9px] uppercase tracking-[0.14em] text-champagne/25">
          Quick actions send only an operation ID; wedding data is loaded on the server
        </p>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
    } catch {
      // Manual selection remains available.
    }
  }

  return (
    <div className={cn('flex items-end gap-2', isUser && 'flex-row-reverse')}>
      {!isUser && (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold text-espresso">
          <Bot className="size-4" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
          isUser
            ? 'rounded-br-sm bg-gold text-espresso'
            : 'rounded-bl-sm border border-gold/20 bg-champagne/[0.04] text-champagne/90',
        )}
      >
        {isUser ? <p className="whitespace-pre-wrap">{message.content}</p> : <Markdown>{message.content}</Markdown>}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-3 border-t border-gold/10 pt-2">
            <p className="mb-1 text-[9px] uppercase tracking-[0.14em] text-gold/60">
              Retrieved sources
            </p>
            {message.sources.map((source) => {
              const href = safeHref(source.sourceUrl)
              return href ? (
                <a
                  key={`${source.citation}-${source.title}`}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[10px] text-gold underline underline-offset-2"
                >
                  [{source.citation}] {source.title} · {source.visibility}
                </a>
              ) : (
                <p
                  key={`${source.citation}-${source.title}`}
                  className="text-[10px] text-champagne/50"
                >
                  [{source.citation}] {source.title} · {source.visibility}
                </p>
              )
            })}
          </div>
        )}
        {!isUser && message.id !== `welcome-${message.kind}` && (
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-gold/10 pt-1.5">
            <p className="text-[8px] uppercase tracking-[0.12em] text-champagne/30">
              {message.fallback
                ? 'Fallback response'
                : [message.provider, message.model].filter(Boolean).join(' · ') || 'Wewed AI'}
            </p>
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex items-center gap-1 text-[9px] text-gold"
            >
              <Copy className="size-3" /> Copy
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AiPlannerAssistant
