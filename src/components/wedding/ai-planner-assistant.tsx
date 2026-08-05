'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import type { LucideIcon } from 'lucide-react'
import {
  Bot,
  CalendarDays,
  Check,
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
  Save,
  Search,
  Send,
  Sparkles,
  Users,
  Wand2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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

type AiProductArea =
  | 'guest_concierge'
  | 'planner_copilot'
  | 'template_intelligence'
  | 'communication_assistant'

type MessageKind = 'chat' | 'analysis' | 'template' | 'draft' | 'speech'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts: number
  area: AiProductArea
  kind: MessageKind
}

interface PlannerGuest {
  id: string
  name: string
  rsvp?: {
    attending: boolean | null
    mealChoice: string | null
    plusOne: boolean
    dietaryNotes?: string | null
    message?: string | null
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

interface AreaConfig {
  label: string
  shortLabel: string
  description: string
  boundary: string
  placeholder: string
  icon: LucideIcon
}

interface QuickAction {
  id: string
  label: string
  description: string
  icon: LucideIcon
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
    shortLabel: 'Guests',
    description:
      'Test approved guest answers and identify missing public information.',
    boundary: 'Published guest information only',
    placeholder: 'Test a guest question or ask for an FAQ gap review…',
    icon: MessageCircle,
  },
  planner_copilot: {
    label: 'Planner Copilot',
    shortLabel: 'Planner',
    description:
      'Analyse tasks, RSVPs, budget pressure and operational priorities.',
    boundary: 'Read-only analysis; confirmation required for changes',
    placeholder: 'Ask what needs attention, what is overdue, or what is at risk…',
    icon: ListTodo,
  },
  template_intelligence: {
    label: 'Template Intelligence',
    shortLabel: 'Templates',
    description:
      'Create, adapt and audit reusable wedding-planning templates.',
    boundary: 'Drafts only; no template is applied automatically',
    placeholder: 'Describe the wedding or template you want to create or audit…',
    icon: FileText,
  },
  communication_assistant: {
    label: 'Communication Assistant',
    shortLabel: 'Comms',
    description:
      'Draft vendor, guest, couple and wedding-party communications.',
    boundary: 'Drafts only; nothing is sent or published automatically',
    placeholder: 'Describe the audience, channel, tone and message you need…',
    icon: Mail,
  },
}

const QUICK_ACTIONS: Record<AiProductArea, QuickAction[]> = {
  guest_concierge: [
    {
      id: 'test_guest_answer',
      label: 'Test a guest answer',
      description: 'Preview the approved ceremony-time response.',
      icon: MessageCircle,
    },
    {
      id: 'guest_faq_gaps',
      label: 'Find FAQ gaps',
      description: 'Suggest missing public guest questions.',
      icon: Search,
    },
    {
      id: 'guest_travel_guide',
      label: 'Draft travel guidance',
      description: 'Create concise venue and shuttle guidance.',
      icon: MapPin,
    },
    {
      id: 'guest_privacy_review',
      label: 'Review privacy boundary',
      description: 'Check what the concierge must not reveal.',
      icon: Lock,
    },
  ],
  planner_copilot: [
    {
      id: 'daily_brief',
      label: 'Daily attention brief',
      description: 'Combine current tasks and RSVP signals.',
      icon: CalendarDays,
    },
    {
      id: 'rsvp_summary',
      label: 'Summarise RSVPs',
      description: 'Highlight attendance, meals and follow-ups.',
      icon: Users,
    },
    {
      id: 'task_priorities',
      label: 'Prioritise open tasks',
      description: 'Identify urgent and blocked work.',
      icon: ListTodo,
    },
    {
      id: 'budget_review',
      label: 'Budget review',
      description: 'Get practical Zimbabwean wedding savings ideas.',
      icon: DollarSign,
    },
  ],
  template_intelligence: [
    {
      id: 'starter_template',
      label: 'Create starter template',
      description: 'Draft a reusable plan for this wedding type.',
      icon: Wand2,
    },
    {
      id: 'template_gap_analysis',
      label: 'Audit current checklist',
      description: 'Compare live tasks with a complete template.',
      icon: ClipboardList,
    },
    {
      id: 'timeline_template',
      label: 'Adapt timeline template',
      description: 'Draft dependency-aware planning phases.',
      icon: CalendarDays,
    },
    {
      id: 'anonymise_template',
      label: 'Prepare for reuse',
      description: 'Define what must be removed before reuse.',
      icon: Lock,
    },
  ],
  communication_assistant: [
    {
      id: 'vendor_followup',
      label: 'Vendor follow-up',
      description: 'Draft a firm but warm confirmation request.',
      icon: Mail,
    },
    {
      id: 'guest_announcement',
      label: 'Guest announcement',
      description: 'Draft a concise logistics update.',
      icon: Users,
    },
    {
      id: 'progress_update',
      label: 'Couple progress update',
      description: 'Draft a clear weekly planning summary.',
      icon: ClipboardList,
    },
    {
      id: 'speech_vows',
      label: 'Speech or vows',
      description: 'Generate a structured first draft.',
      icon: Heart,
    },
  ],
}

const AREA_WELCOME: Record<AiProductArea, string> = {
  guest_concierge:
    'Use this area to test the **public Guest Concierge** and improve approved guest information. It may answer only from published wedding details.',
  planner_copilot:
    'Use **Planner Copilot** for daily priorities, RSVP analysis, task risks and operational recommendations. It analyses data but does not change records.',
  template_intelligence:
    'Use **Template Intelligence** to create and audit reusable plans. Every result is a draft; no template is saved or applied automatically.',
  communication_assistant:
    'Use the **Communication Assistant** to prepare vendor, guest and couple messages. Every result is a draft; nothing is sent or published automatically.',
}

const SPEECH_TYPES: { value: SpeechType; label: string }[] = [
  { value: 'groom', label: 'Groom' },
  { value: 'bride', label: 'Bride' },
  { value: 'best_man', label: 'Best Man' },
  { value: 'maid_of_honor', label: 'Maid of Honor' },
  { value: 'father_bride', label: 'Father of the Bride' },
  { value: 'mother_groom', label: 'Mother of the Groom' },
]

const SPEECH_TONES: { value: SpeechTone; label: string }[] = [
  { value: 'heartfelt', label: 'Heartfelt and sincere' },
  { value: 'funny', label: 'Light and funny' },
  { value: 'traditional', label: 'Traditional' },
]

const SPEECH_LENGTHS: {
  value: SpeechLength
  label: string
  hint: string
}[] = [
  { value: 'short', label: 'Short', hint: 'about 2 minutes' },
  { value: 'medium', label: 'Medium', hint: 'about 4 minutes' },
  { value: 'long', label: 'Long', hint: 'about 6 minutes' },
]

const NOTES_STORAGE_KEY = 'wewed:ai-planner-notes'

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function createInitialConversations(): Record<AiProductArea, ChatMessage[]> {
  return AREA_ORDER.reduce(
    (result, area) => {
      result[area] = [
        {
          id: `welcome-${area}`,
          role: 'assistant',
          content: AREA_WELCOME[area],
          ts: 0,
          area,
          kind: 'chat',
        },
      ]
      return result
    },
    {} as Record<AiProductArea, ChatMessage[]>,
  )
}

function formatTask(task: PlannerTask): string {
  const due = task.dueDate ? task.dueDate.split('T')[0] : 'no due date'
  return `- [${task.priority.toUpperCase()}] ${task.title} — ${task.status}, ${task.category}, ${due}`
}

function formatGuest(guest: PlannerGuest): string {
  const rsvp = guest.rsvp
  if (!rsvp) return `- ${guest.name}: no RSVP recorded`
  const attendance =
    rsvp.attending === true
      ? 'attending'
      : rsvp.attending === false
        ? 'not attending'
        : 'pending'
  return `- ${guest.name}: ${attendance}; meal ${rsvp.mealChoice ?? 'not selected'}; plus-one ${rsvp.plusOne ? 'yes' : 'no'}; dietary ${rsvp.dietaryNotes ?? 'none recorded'}`
}

export function AiPlannerAssistant() {
  const { toast } = useToast()
  const [activeArea, setActiveArea] =
    useState<AiProductArea>('planner_copilot')
  const [conversations, setConversations] = useState(createInitialConversations)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [speechModalOpen, setSpeechModalOpen] = useState(false)
  const [speechType, setSpeechType] = useState<SpeechType>('groom')
  const [speechTone, setSpeechTone] = useState<SpeechTone>('heartfelt')
  const [speechLength, setSpeechLength] = useState<SpeechLength>('medium')
  const [speechResult, setSpeechResult] = useState('')
  const [speechLoading, setSpeechLoading] = useState(false)
  const [speechCopied, setSpeechCopied] = useState(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const activeMessages = conversations[activeArea]
  const activeConfig = AREA_CONFIG[activeArea]
  const activeActions = QUICK_ACTIONS[activeArea]

  useEffect(() => {
    const element = scrollRef.current
    if (element) {
      element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
    }
  }, [activeMessages, activeArea, isLoading])

  useEffect(() => {
    setInput('')
    const timeout = setTimeout(() => inputRef.current?.focus(), 100)
    return () => clearTimeout(timeout)
  }, [activeArea])

  const addMessage = useCallback(
    (
      area: AiProductArea,
      role: ChatMessage['role'],
      content: string,
      kind: MessageKind,
    ) => {
      setConversations((current) => ({
        ...current,
        [area]: [
          ...current[area],
          { id: uid(), role, content, ts: Date.now(), area, kind },
        ],
      }))
    },
    [],
  )

  const sendToAI = useCallback(
    async (
      text: string,
      area: AiProductArea = activeArea,
      kind: MessageKind = 'chat',
    ) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      const existingMessages = conversations[area]
      const userMessage: ChatMessage = {
        id: uid(),
        role: 'user',
        content: trimmed,
        ts: Date.now(),
        area,
        kind,
      }
      const nextMessages = [...existingMessages, userMessage]

      setConversations((current) => ({
        ...current,
        [area]: nextMessages,
      }))
      setInput('')
      setIsLoading(true)

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: 'couple',
            area,
            messages: nextMessages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
          }),
        })

        if (response.status === 401) {
          addMessage(
            area,
            'assistant',
            'Please sign in to the planner to use this Wewed AI area.',
            'chat',
          )
          return
        }

        const data = (await response.json()) as {
          reply?: string
          error?: string
        }

        addMessage(
          area,
          'assistant',
          data.reply ??
            'I could not prepare a response just now. Please try again; no records were changed.',
          kind,
        )
      } catch {
        addMessage(
          area,
          'assistant',
          'I could not reach Wewed AI just now. Please try again; no records were changed and nothing was sent.',
          kind,
        )
      } finally {
        setIsLoading(false)
      }
    },
    [activeArea, addMessage, conversations, isLoading],
  )

  const fetchPlannerData = useCallback(async () => {
    const [taskResponse, guestResponse] = await Promise.all([
      fetch('/api/planner/tasks', { cache: 'no-store' }),
      fetch('/api/planner/guests', { cache: 'no-store' }),
    ])

    if (!taskResponse.ok || !guestResponse.ok) {
      throw new Error('Planner data unavailable')
    }

    const taskPayload = (await taskResponse.json()) as
      | { data?: PlannerTask[] }
      | PlannerTask[]
    const guestPayload = (await guestResponse.json()) as {
      data?: PlannerGuest[]
    }

    return {
      tasks: Array.isArray(taskPayload)
        ? taskPayload
        : (taskPayload.data ?? []),
      guests: guestPayload.data ?? [],
    }
  }, [])

  const runDataAction = useCallback(
    async (
      userLabel: string,
      buildPrompt: (data: {
        tasks: PlannerTask[]
        guests: PlannerGuest[]
      }) => string,
      area: AiProductArea,
      kind: MessageKind,
    ) => {
      if (isLoading) return
      setIsLoading(true)
      addMessage(area, 'user', userLabel, kind)

      try {
        const data = await fetchPlannerData()
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: 'couple',
            area,
            messages: [{ role: 'user', content: buildPrompt(data) }],
          }),
        })

        if (response.status === 401) {
          addMessage(
            area,
            'assistant',
            'Please sign in to the planner to use live wedding data.',
            kind,
          )
          return
        }

        const result = (await response.json()) as { reply?: string }
        addMessage(
          area,
          'assistant',
          result.reply ??
            'I could not analyse the planner data just now. No records were changed.',
          kind,
        )
      } catch {
        addMessage(
          area,
          'assistant',
          'I could not load the planner data just now. Please try again; no records were changed.',
          kind,
        )
      } finally {
        setIsLoading(false)
      }
    },
    [addMessage, fetchPlannerData, isLoading],
  )

  const handleQuickAction = useCallback(
    (actionId: string) => {
      switch (actionId) {
        case 'test_guest_answer':
          void sendToAI(
            'A guest asks: “What time is the wedding ceremony?” Give the exact concise response the public Guest Concierge should show.',
            'guest_concierge',
          )
          break
        case 'guest_faq_gaps':
          void sendToAI(
            'Review the approved guest information in your instructions. Suggest the eight most useful missing FAQ questions that the couple should answer before public testing. Do not invent the answers.',
            'guest_concierge',
            'analysis',
          )
          break
        case 'guest_travel_guide':
          void sendToAI(
            'Draft a compact guest travel note using only the approved public venue and shuttle information. Include a clear reminder to verify anything not provided.',
            'guest_concierge',
            'draft',
          )
          break
        case 'guest_privacy_review':
          void sendToAI(
            'Create a short privacy checklist showing what the public Guest Concierge may answer and what it must never reveal.',
            'guest_concierge',
            'analysis',
          )
          break
        case 'daily_brief':
          void runDataAction(
            'Prepare my daily attention brief.',
            ({ tasks, guests }) => {
              const openTasks = tasks.filter((task) => task.status !== 'done')
              const guestLines = guests.slice(0, 80).map(formatGuest).join('\n')
              const taskLines = openTasks.slice(0, 80).map(formatTask).join('\n')
              return `Prepare a daily planner attention brief from this authorised snapshot. Separate facts from recommendations. Prioritise overdue/high-priority tasks, RSVP follow-ups, dietary risks and the next three actions.\n\nOPEN TASKS (${openTasks.length})\n${taskLines || '- none'}\n\nGUEST/RSVP SNAPSHOT (${guests.length})\n${guestLines || '- none'}`
            },
            'planner_copilot',
            'analysis',
          )
          break
        case 'rsvp_summary':
          void runDataAction(
            'Summarise the current RSVPs.',
            ({ guests }) => {
              const guestLines = guests.slice(0, 100).map(formatGuest).join('\n')
              return `Summarise this authorised RSVP snapshot. Count attending, declined and pending responses; flag missing meal choices, plus-ones and dietary follow-ups. Do not expose contact details.\n\n${guestLines || '- no guest records'}`
            },
            'planner_copilot',
            'analysis',
          )
          break
        case 'task_priorities':
          void runDataAction(
            'Prioritise my open tasks.',
            ({ tasks }) => {
              const openTasks = tasks.filter((task) => task.status !== 'done')
              return `Prioritise these authorised open wedding tasks. Identify the top five actions, overdue or blocked work, dependencies and anything that can safely wait. Do not claim to update tasks.\n\n${openTasks.slice(0, 100).map(formatTask).join('\n') || '- no open tasks'}`
            },
            'planner_copilot',
            'analysis',
          )
          break
        case 'budget_review':
          void sendToAI(
            'Give a practical budget review framework for a Zimbabwean wedding at Imba Manor. Cover where to protect quality, where to save, family/traditional cost considerations, payment timing and questions to ask vendors. Do not invent our actual budget figures.',
            'planner_copilot',
            'analysis',
          )
          break
        case 'starter_template':
          void sendToAI(
            'Create a draft reusable planning template for a Zimbabwean wedding with a formal ceremony, traditional family elements and a hotel or manor reception. Organise it by phase, include dependencies and mark fields that must be customised.',
            'template_intelligence',
            'template',
          )
          break
        case 'template_gap_analysis':
          void runDataAction(
            'Audit my current checklist against a complete template.',
            ({ tasks }) =>
              `Audit this authorised task list against a complete wedding-planning template. Identify likely missing categories, duplicates, weak dependencies and timing risks. Return a draft gap report only; do not create or apply tasks.\n\n${tasks.slice(0, 120).map(formatTask).join('\n') || '- no tasks available'}`,
            'template_intelligence',
            'template',
          )
          break
        case 'timeline_template':
          void sendToAI(
            'Draft a dependency-aware wedding planning timeline from twelve months before the wedding through thirty days after it. Include Zimbabwean cultural and family coordination milestones and label all dates as template guidance.',
            'template_intelligence',
            'template',
          )
          break
        case 'anonymise_template':
          void sendToAI(
            'Create an anonymisation checklist for converting a completed wedding into a reusable Wewed template. Cover names, contact data, private notes, vendor pricing, contracts, messages, media and culturally sensitive details.',
            'template_intelligence',
            'template',
          )
          break
        case 'vendor_followup':
          void sendToAI(
            'Draft a professional vendor follow-up asking them to confirm arrival time, final deliverables, outstanding payment status and the on-the-day contact. Use placeholders for vendor-specific details and make the draft status clear.',
            'communication_assistant',
            'draft',
          )
          break
        case 'guest_announcement':
          void sendToAI(
            'Draft a concise guest announcement confirming ceremony time, arrival guidance, dress code and shuttle details using only approved public information. Make it suitable for WhatsApp and label it as a draft.',
            'communication_assistant',
            'draft',
          )
          break
        case 'progress_update':
          void sendToAI(
            'Draft a weekly planning update to the couple with sections for completed work, decisions needed, risks, payments due and next-week priorities. Use placeholders where live data is not supplied.',
            'communication_assistant',
            'draft',
          )
          break
        case 'speech_vows':
          setSpeechResult('')
          setSpeechCopied(false)
          setSpeechModalOpen(true)
          break
      }
    },
    [runDataAction, sendToAI],
  )

  const handleGenerateSpeech = useCallback(async () => {
    if (speechLoading) return
    setSpeechLoading(true)
    setSpeechResult('')
    setSpeechCopied(false)

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

      if (response.status === 401) {
        toast({
          title: 'Sign-in required',
          description: 'Please sign in to the planner to generate a speech draft.',
          variant: 'destructive',
        })
        return
      }

      const data = (await response.json()) as {
        speech?: string
        error?: string
      }

      if (!data.speech) {
        toast({
          title: 'Draft unavailable',
          description: data.error ?? 'Please try again in a moment.',
          variant: 'destructive',
        })
        return
      }

      const labelledDraft = data.speech.startsWith('Draft')
        ? data.speech
        : `## Draft speech or vows\n\n${data.speech}`
      setSpeechResult(labelledDraft)
      addMessage(
        'communication_assistant',
        'assistant',
        labelledDraft,
        'speech',
      )
    } catch {
      toast({
        title: 'Network error',
        description: 'Wewed AI could not prepare the draft just now.',
        variant: 'destructive',
      })
    } finally {
      setSpeechLoading(false)
    }
  }, [addMessage, speechLength, speechLoading, speechTone, speechType, toast])

  const handleCopySpeech = useCallback(async () => {
    if (!speechResult) return
    try {
      await navigator.clipboard.writeText(speechResult)
      setSpeechCopied(true)
      toast({ title: 'Draft copied', description: 'Review it before sharing.' })
      setTimeout(() => setSpeechCopied(false), 2000)
    } catch {
      toast({
        title: 'Could not copy',
        description: 'Please select and copy the text manually.',
        variant: 'destructive',
      })
    }
  }, [speechResult, toast])

  const handleSaveNote = useCallback(
    (message: ChatMessage) => {
      try {
        const raw = localStorage.getItem(NOTES_STORAGE_KEY)
        const notes = raw
          ? (JSON.parse(raw) as Array<{
              id: string
              content: string
              area: string
              kind: string
              ts: number
            }>)
          : []
        notes.unshift({
          id: message.id,
          content: message.content,
          area: message.area,
          kind: message.kind,
          ts: message.ts,
        })
        localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes.slice(0, 50)))
        toast({
          title: 'Saved to notes',
          description: 'The AI output was saved in this browser.',
        })
      } catch {
        toast({
          title: 'Could not save',
          description: 'Browser storage may be unavailable.',
          variant: 'destructive',
        })
      }
    },
    [toast],
  )

  const handleSendInput = () => {
    void sendToAI(
      input,
      activeArea,
      activeArea === 'template_intelligence'
        ? 'template'
        : activeArea === 'communication_assistant'
          ? 'draft'
          : 'chat',
    )
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSendInput()
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 bg-espresso p-3 sm:p-4">
      <header className="shrink-0 rounded-xl border border-gold/20 bg-gradient-to-br from-espresso via-espresso to-plum/15 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-muted ring-1 ring-gold-light/30">
            <Sparkles className="size-5 text-espresso" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="wewed-heading text-base text-champagne sm:text-lg">
              Wewed AI Workspace
            </h2>
            <p className="truncate font-sans text-[11px] text-champagne/50">
              Four focused product areas · private routing · human review before action
            </p>
          </div>
          <div className="hidden items-center gap-1.5 rounded-full border border-gold/20 bg-gold/5 px-3 py-1 sm:flex">
            <span className="size-1.5 rounded-full bg-gold wewed-pulse-dot" />
            <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-gold-light/80">
              Powered by Wewed AI
            </span>
          </div>
        </div>
      </header>

      <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
        {AREA_ORDER.map((area) => {
          const config = AREA_CONFIG[area]
          const Icon = config.icon
          const active = activeArea === area
          return (
            <button
              type="button"
              key={area}
              onClick={() => setActiveArea(area)}
              className={cn(
                'rounded-xl border px-3 py-3 text-left transition-all',
                active
                  ? 'border-gold/60 bg-gold/10 shadow-[0_10px_30px_-24px_rgba(191,155,95,0.8)]'
                  : 'border-gold/15 bg-champagne/[0.025] hover:border-gold/35 hover:bg-gold/5',
              )}
            >
              <div className="flex items-center gap-2">
                <Icon
                  className={cn(
                    'size-4',
                    active ? 'text-gold' : 'text-champagne/55',
                  )}
                />
                <span
                  className={cn(
                    'font-sans text-xs font-medium',
                    active ? 'text-champagne' : 'text-champagne/70',
                  )}
                >
                  {config.label}
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 font-sans text-[10px] leading-relaxed text-champagne/40">
                {config.description}
              </p>
            </button>
          )
        })}
      </div>

      <section className="shrink-0 rounded-xl border border-gold/15 bg-champagne/[0.025] p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-sans text-sm font-medium text-champagne">
              {activeConfig.label}
            </p>
            <p className="mt-0.5 font-sans text-[11px] text-champagne/50">
              {activeConfig.description}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-gold/20 bg-espresso/40 px-2 py-1 font-sans text-[9px] uppercase tracking-[0.12em] text-gold-light/75">
            <Lock className="size-3" />
            {activeConfig.boundary}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {activeActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                type="button"
                key={action.id}
                onClick={() => handleQuickAction(action.id)}
                disabled={isLoading}
                className="group rounded-lg border border-gold/15 bg-espresso/30 px-3 py-2.5 text-left transition-all hover:border-gold/40 hover:bg-gold/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon className="size-4 text-gold transition-transform group-hover:scale-110" />
                <p className="mt-1.5 font-sans text-[11px] font-medium leading-tight text-champagne/85">
                  {action.label}
                </p>
                <p className="mt-1 line-clamp-2 font-sans text-[9px] leading-relaxed text-champagne/40">
                  {action.description}
                </p>
              </button>
            )
          })}
        </div>
      </section>

      <div
        ref={scrollRef}
        className="wewed-scroll min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-gold/10 bg-espresso/40 p-3"
        role="log"
        aria-live="polite"
        aria-label={`${activeConfig.label} messages`}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {activeMessages.map((message) => (
            <PlannerMessageBubble
              key={message.id}
              message={message}
              onSaveNote={() => handleSaveNote(message)}
            />
          ))}
        </AnimatePresence>

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

      <div className="shrink-0 rounded-xl border border-gold/20 bg-champagne/[0.03] p-2.5">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={activeConfig.placeholder}
            aria-label={`Ask ${activeConfig.label}`}
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 font-sans text-sm text-champagne placeholder:text-champagne/30 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
          />
          <button
            type="button"
            onClick={handleSendInput}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-gold-muted text-espresso shadow-sm transition-all hover:from-gold-light hover:to-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </div>
        <p className="mt-1.5 px-1 font-sans text-[9px] uppercase tracking-[0.14em] text-champagne/25">
          Enter to send · Shift+Enter for new line · AI output requires human review
        </p>
      </div>

      <SpeechDraftDialog
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
      />
    </div>
  )
}

function PlannerMessageBubble({
  message,
  onSaveNote,
}: {
  message: ChatMessage
  onSaveNote: () => void
}) {
  const isUser = message.role === 'user'
  const [saved, setSaved] = useState(false)
  const areaLabel = AREA_CONFIG[message.area].shortLabel

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn('flex items-end gap-2', isUser && 'flex-row-reverse')}
    >
      {!isUser && (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-muted ring-1 ring-gold-light/30">
          <Bot className="size-4 text-espresso" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[88%] rounded-2xl px-3.5 py-2.5 font-sans text-[13px] leading-relaxed',
          isUser
            ? 'rounded-br-sm bg-gradient-to-br from-gold to-gold-muted text-espresso'
            : 'rounded-bl-sm border border-gold/20 bg-champagne/[0.04] text-champagne/90',
        )}
      >
        {!isUser && (
          <p className="mb-1.5 font-sans text-[8px] uppercase tracking-[0.16em] text-gold/60">
            {areaLabel} · {message.kind}
          </p>
        )}

        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <ReactMarkdown
            components={{
              p: ({ children }) => (
                <p className="mb-2 leading-relaxed last:mb-0">{children}</p>
              ),
              ul: ({ children }) => (
                <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">
                  {children}
                </ol>
              ),
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              strong: ({ children }) => (
                <strong className="font-semibold text-gold-light">
                  {children}
                </strong>
              ),
              em: ({ children }) => <em className="text-clay-light">{children}</em>,
              h1: ({ children }) => (
                <h3 className="wewed-heading mb-1 mt-2 text-sm text-gold first:mt-0">
                  {children}
                </h3>
              ),
              h2: ({ children }) => (
                <h3 className="wewed-heading mb-1 mt-2 text-sm text-gold first:mt-0">
                  {children}
                </h3>
              ),
              h3: ({ children }) => (
                <h3 className="wewed-heading mb-1 mt-2 text-sm text-gold first:mt-0">
                  {children}
                </h3>
              ),
              h4: ({ children }) => (
                <h4 className="mb-1 mt-2 font-sans text-xs font-semibold text-gold-light first:mt-0">
                  {children}
                </h4>
              ),
              code: ({ children }) => (
                <code className="rounded bg-espresso/60 px-1 py-0.5 font-mono text-[11px] text-gold-light">
                  {children}
                </code>
              ),
              blockquote: ({ children }) => (
                <blockquote className="my-2 border-l-2 border-gold/40 pl-3 italic text-champagne/70">
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
        )}

        {!isUser && message.id !== `welcome-${message.area}` && (
          <div className="mt-2 flex items-center justify-end border-t border-gold/10 pt-1.5">
            <button
              type="button"
              onClick={() => {
                onSaveNote()
                setSaved(true)
                setTimeout(() => setSaved(false), 2000)
              }}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-sans text-[9px] uppercase tracking-[0.12em] text-champagne/45 transition-colors hover:bg-gold/10 hover:text-gold"
            >
              {saved ? <Check className="size-3" /> : <Save className="size-3" />}
              {saved ? 'Saved' : 'Save note'}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
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

interface SpeechDraftDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: SpeechType
  tone: SpeechTone
  length: SpeechLength
  onTypeChange: (value: SpeechType) => void
  onToneChange: (value: SpeechTone) => void
  onLengthChange: (value: SpeechLength) => void
  result: string
  loading: boolean
  copied: boolean
  onGenerate: () => void
  onCopy: () => void
}

function SpeechDraftDialog({
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
}: SpeechDraftDialogProps) {
  const selectedLength = useMemo(
    () => SPEECH_LENGTHS.find((option) => option.value === length),
    [length],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-gold/30 bg-espresso sm:max-w-2xl">
        <DialogHeader className="text-left">
          <DialogTitle className="wewed-heading flex items-center gap-2 text-lg text-champagne">
            <Wand2 className="size-5 text-gold" />
            Draft speech or vows
          </DialogTitle>
          <DialogDescription className="text-champagne/50">
            Wewed AI creates a first draft for human review. Nothing is sent or published.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-champagne/75">Speaker</Label>
            <Select value={type} onValueChange={(value) => onTypeChange(value as SpeechType)}>
              <SelectTrigger className="border-gold/20 bg-espresso/60 text-champagne">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPEECH_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-champagne/75">Tone</Label>
            <Select value={tone} onValueChange={(value) => onToneChange(value as SpeechTone)}>
              <SelectTrigger className="border-gold/20 bg-espresso/60 text-champagne">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPEECH_TONES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-champagne/75">Length</Label>
            <Select value={length} onValueChange={(value) => onLengthChange(value as SpeechLength)}>
              <SelectTrigger className="border-gold/20 bg-espresso/60 text-champagne">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPEECH_LENGTHS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} · {option.hint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="font-sans text-[10px] text-champagne/40">
            Selected length: {selectedLength?.hint}
          </p>
          <Button
            type="button"
            onClick={onGenerate}
            disabled={loading}
            className="bg-gold text-espresso hover:bg-gold-light"
          >
            <Sparkles className="mr-2 size-4" />
            {loading ? 'Preparing draft…' : 'Generate draft'}
          </Button>
        </div>

        {result && (
          <div className="rounded-xl border border-gold/20 bg-champagne/[0.04] p-4">
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p className="mb-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-champagne/85 last:mb-0">
                    {children}
                  </p>
                ),
                h2: ({ children }) => (
                  <h3 className="wewed-heading mb-2 text-base text-gold">
                    {children}
                  </h3>
                ),
              }}
            >
              {result}
            </ReactMarkdown>
            <div className="mt-3 flex justify-end border-t border-gold/10 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={onCopy}
                className="border-gold/25 text-gold hover:bg-gold/10"
              >
                {copied ? (
                  <Check className="mr-2 size-4" />
                ) : (
                  <Copy className="mr-2 size-4" />
                )}
                {copied ? 'Copied' : 'Copy draft'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default AiPlannerAssistant
