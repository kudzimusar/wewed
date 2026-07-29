export type ReminderAudience = 'all' | 'pending' | 'attending' | 'declined'

export interface ReminderGuestInput {
  id: string
  name: string
  email: string | null
  rsvp: { token: string; attending: boolean | null } | null
}

export interface ReminderRecipient {
  guestId: string
  name: string
  email: string
  token: string | null
}

export interface SeatingGuestInput {
  id: string
  name: string
  seatingTableId: string | null
  headcount: number
}

export interface SeatingTableInput {
  id: string
  name: string
  capacity: number
  occupied: number
}

export interface SeatingAssignment {
  guestId: string
  tableId: string
  headcount: number
}

export type PlannerTemplateItem = {
  type: 'task' | 'timeline' | 'reminder'
  title: string
  description?: string
  category?: string
  priority?: 'low' | 'medium' | 'high'
  offsetDays?: number
  assignee?: string
  time?: string
  duration?: string
  location?: string
  audience?: ReminderAudience
  subject?: string
  body?: string
}

export interface PlannerTemplateDefinition {
  id: string
  name: string
  description: string
  version: number
  source: 'system' | 'wedding'
  items: PlannerTemplateItem[]
}

export function normalizeTitle(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function dateFromOffset(weddingDate: Date | string, offsetDays = 0): Date {
  const result = new Date(weddingDate)
  if (Number.isNaN(result.getTime())) throw new Error('Invalid wedding date.')
  result.setUTCDate(result.getUTCDate() + offsetDays)
  return result
}

export function selectReminderRecipients(
  guests: ReminderGuestInput[],
  audience: ReminderAudience,
): ReminderRecipient[] {
  const selected = guests.filter((guest) => {
    if (!guest.email?.trim()) return false
    if (audience === 'all') return true
    if (audience === 'pending') return !guest.rsvp || guest.rsvp.attending === null
    if (audience === 'attending') return guest.rsvp?.attending === true
    return guest.rsvp?.attending === false
  })

  const seen = new Set<string>()
  return selected.flatMap((guest) => {
    const email = guest.email!.trim().toLowerCase()
    if (seen.has(email)) return []
    seen.add(email)
    return [{ guestId: guest.id, name: guest.name, email, token: guest.rsvp?.token ?? null }]
  })
}

export function renderReminderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => values[key] ?? '')
}

export function buildAutoAssignments(
  tables: SeatingTableInput[],
  guests: SeatingGuestInput[],
): { assignments: SeatingAssignment[]; unassignedGuestIds: string[] } {
  const available = tables
    .map((table) => ({ ...table, remaining: Math.max(0, table.capacity - table.occupied) }))
    .sort((a, b) => b.remaining - a.remaining || a.name.localeCompare(b.name))
  const unseated = guests
    .filter((guest) => !guest.seatingTableId)
    .map((guest) => ({ ...guest, headcount: Math.max(1, Math.floor(guest.headcount || 1)) }))
    .sort((a, b) => b.headcount - a.headcount || a.name.localeCompare(b.name))
  const assignments: SeatingAssignment[] = []
  const unassignedGuestIds: string[] = []

  for (const guest of unseated) {
    const table = available
      .filter((candidate) => candidate.remaining >= guest.headcount)
      .sort((a, b) => a.remaining - b.remaining || a.name.localeCompare(b.name))[0]
    if (!table) {
      unassignedGuestIds.push(guest.id)
      continue
    }
    assignments.push({ guestId: guest.id, tableId: table.id, headcount: guest.headcount })
    table.remaining -= guest.headcount
  }
  return { assignments, unassignedGuestIds }
}

export const BUILTIN_PLANNER_TEMPLATES: PlannerTemplateDefinition[] = [
  {
    id: 'system-essential-planning',
    name: 'Essential Wedding Plan',
    description: 'A practical checklist with dates calculated from the wedding date.',
    version: 1,
    source: 'system',
    items: [
      { type: 'task', title: 'Confirm total wedding budget', category: 'timeline_12_18', priority: 'high', offsetDays: -365 },
      { type: 'task', title: 'Finalize initial guest list', category: 'timeline_12_18', priority: 'high', offsetDays: -330 },
      { type: 'task', title: 'Book ceremony and reception venue', category: 'venue', priority: 'high', offsetDays: -300 },
      { type: 'task', title: 'Book photographer and videographer', category: 'photo_video', priority: 'high', offsetDays: -270 },
      { type: 'task', title: 'Book caterer and approve menu', category: 'catering', priority: 'high', offsetDays: -240 },
      { type: 'task', title: 'Send save-the-date notices', category: 'timeline_6_9', priority: 'medium', offsetDays: -180 },
      { type: 'task', title: 'Send wedding invitations', category: 'timeline_3_6', priority: 'high', offsetDays: -120 },
      { type: 'task', title: 'Close RSVPs and confirm final numbers', category: 'timeline_1mo', priority: 'high', offsetDays: -30 },
      { type: 'task', title: 'Complete seating plan', category: 'timeline_2wk', priority: 'high', offsetDays: -14 },
      { type: 'task', title: 'Confirm final vendor balances', category: 'timeline_1wk', priority: 'high', offsetDays: -7 },
      { type: 'task', title: 'Prepare wedding-day emergency kit', category: 'wedding_day', priority: 'medium', offsetDays: -1 },
    ],
  },
  {
    id: 'system-day-of-timeline',
    name: 'Wedding Day Run Sheet',
    description: 'A complete starting timeline for ceremony and reception coordination.',
    version: 1,
    source: 'system',
    items: [
      { type: 'timeline', title: 'Supplier access and setup begins', time: '08:00', duration: '120 min', location: 'Venue' },
      { type: 'timeline', title: 'Wedding party preparation', time: '10:00', duration: '180 min', location: 'Preparation rooms' },
      { type: 'timeline', title: 'Guest arrival and seating', time: '13:30', duration: '30 min', location: 'Ceremony' },
      { type: 'timeline', title: 'Ceremony', time: '14:00', duration: '60 min', location: 'Ceremony area' },
      { type: 'timeline', title: 'Cocktail hour and photographs', time: '15:00', duration: '90 min', location: 'Reception garden' },
      { type: 'timeline', title: 'Reception entrance and dinner', time: '16:30', duration: '150 min', location: 'Reception' },
      { type: 'timeline', title: 'Speeches, cake and first dance', time: '19:00', duration: '90 min', location: 'Reception' },
      { type: 'timeline', title: 'Open dance floor', time: '20:30', duration: '180 min', location: 'Reception' },
      { type: 'timeline', title: 'Final song and guest departure', time: '23:30', duration: '30 min', location: 'Reception' },
    ],
  },
  {
    id: 'system-rsvp-reminders',
    name: 'RSVP Reminder Sequence',
    description: 'Three scheduled reminders for guests who have not replied.',
    version: 1,
    source: 'system',
    items: [
      { type: 'reminder', title: 'First RSVP reminder', audience: 'pending', offsetDays: -60, subject: 'A reminder to RSVP for {{wedding_title}}', body: 'Hello {{guest_name}},\n\nPlease submit your RSVP here: {{rsvp_link}}\n\nWedding date: {{wedding_date}}' },
      { type: 'reminder', title: 'RSVP deadline reminder', audience: 'pending', offsetDays: -30, subject: 'RSVP deadline approaching for {{wedding_title}}', body: 'Hello {{guest_name}},\n\nPlease confirm your attendance here: {{rsvp_link}}' },
      { type: 'reminder', title: 'Final RSVP follow-up', audience: 'pending', offsetDays: -14, subject: 'Final RSVP follow-up for {{wedding_title}}', body: 'Hello {{guest_name}},\n\nWe are confirming final numbers. Please respond here: {{rsvp_link}}' },
    ],
  },
  {
    id: 'system-closeout',
    name: 'Post-Wedding Closeout',
    description: 'Tasks for payments, returns, media, thank-yous and archiving.',
    version: 1,
    source: 'system',
    items: [
      { type: 'task', title: 'Confirm all hired items were returned', category: 'other', priority: 'high', offsetDays: 1 },
      { type: 'task', title: 'Reconcile final vendor balances', category: 'other', priority: 'high', offsetDays: 3 },
      { type: 'task', title: 'Collect final photographs and video delivery dates', category: 'photo_video', priority: 'medium', offsetDays: 7 },
      { type: 'task', title: 'Send guest thank-you messages', category: 'other', priority: 'medium', offsetDays: 14 },
      { type: 'task', title: 'Submit vendor reviews and referrals', category: 'other', priority: 'low', offsetDays: 21 },
      { type: 'task', title: 'Export final guest, budget and vendor records', category: 'other', priority: 'medium', offsetDays: 30 },
      { type: 'task', title: 'Archive the wedding workspace', category: 'other', priority: 'low', offsetDays: 45 },
    ],
  },
]

export function getBuiltinTemplate(templateId: string): PlannerTemplateDefinition | null {
  return BUILTIN_PLANNER_TEMPLATES.find((template) => template.id === templateId) ?? null
}
