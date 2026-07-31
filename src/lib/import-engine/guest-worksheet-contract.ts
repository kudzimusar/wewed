import type { FieldDefinition, ModuleSchema } from './types'

export const INVITATION_STATUSES = ['pending', 'sent', 'confirmed', 'declined'] as const
export const RESPONSE_STATUSES = ['pending', 'attending', 'declined', 'maybe'] as const

export interface GuestWorksheetDataRow {
  guestId: string
  weddingId: string
  firstName: string | null
  lastName: string | null
  displayName: string | null
  guestGroup: string | null
  invitationStatus: string
  responseStatus: string
  partySize: number
  accessibilityNotes: string | null
  transportDetails: string | null
  accommodationDetails: string | null
  seatAssignment: string | null
  publicNotes: string | null
  privateNotes: string | null
  createdAt?: Date
  updatedAt?: Date
}

export interface GuestWorksheetRecord {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
  roleDetail: string | null
  side: string | null
  tableNumber: number | null
  seatingTableId: string | null
  weddingId: string
  rsvp: {
    id: string
    token: string
    attending: boolean | null
    mealChoice: string | null
    plusOne: boolean
    plusOneName: string | null
    plusOneMeal: string | null
    kidsAttending: boolean
    kidsCount: number
    songRequests: string | null
    dietaryNotes: string | null
    message: string | null
    checkedIn: boolean
    checkedInAt: Date | null
    guestId: string
    createdAt: Date
    updatedAt: Date
  } | null
  seatingTable: { id: string; name: string; capacity: number } | null
  worksheet: GuestWorksheetDataRow | null
}

export interface GuestWorksheetInput {
  guestId: string
  firstName: string
  lastName: string
  displayName: string
  email: string
  phone: string
  group: string
  invitationStatus: string
  rsvpStatus: string
  numberAttending: number | null
  plusOneName: string
  numberOfChildren: number | null
  dietary: string
  accessibility: string
  transport: string
  accommodation: string
  tableAssignment: string
  seatAssignment: string
  publicNotes: string
  privateNotes: string
}

export const guestWorksheetFields: FieldDefinition[] = [
  { key: 'guestId', label: 'Guest ID', required: false, type: 'string', description: 'Internal ID. Leave blank for new guests; used first for updates.' },
  { key: 'firstName', label: 'First Name', required: false, type: 'string', example: 'Tendai' },
  { key: 'lastName', label: 'Last Name', required: false, type: 'string', example: 'Moyo' },
  { key: 'displayName', label: 'Display Name', required: false, type: 'string', example: 'Tendai Moyo' },
  { key: 'email', label: 'Email', required: false, type: 'email', sensitive: true, example: 'tendai@example.com' },
  { key: 'phone', label: 'Phone', required: false, type: 'phone', sensitive: true, example: '+263 77 123 4567' },
  { key: 'group', label: 'Family/Group', required: false, type: 'string', example: "Bride's Family" },
  { key: 'invitationStatus', label: 'Invitation Status', required: false, type: 'enum', allowedValues: [...INVITATION_STATUSES], example: 'sent' },
  { key: 'rsvpStatus', label: 'RSVP Status', required: false, type: 'enum', allowedValues: [...RESPONSE_STATUSES], example: 'pending' },
  { key: 'numberAttending', label: 'Number Attending', required: false, type: 'number', example: '1' },
  { key: 'plusOneName', label: 'Plus-One Name', required: false, type: 'string', example: 'Chipo Moyo' },
  { key: 'numberOfChildren', label: 'Number of Children', required: false, type: 'number', example: '0' },
  { key: 'dietary', label: 'Dietary', required: false, type: 'string', sensitive: true, example: 'Vegetarian' },
  { key: 'accessibility', label: 'Accessibility', required: false, type: 'string', sensitive: true, example: 'Wheelchair access' },
  { key: 'transport', label: 'Transport', required: false, type: 'string', example: 'Shuttle from Meikles' },
  { key: 'accommodation', label: 'Accommodation', required: false, type: 'string', example: 'Rainbow Towers' },
  { key: 'tableAssignment', label: 'Table Assignment', required: false, type: 'string', example: 'Table 1' },
  { key: 'seatAssignment', label: 'Seat Assignment', required: false, type: 'string', example: 'A1' },
  { key: 'publicNotes', label: 'Public Notes', required: false, type: 'string' },
  { key: 'privateNotes', label: 'Private Notes', required: false, type: 'string', sensitive: true },
]

export function cleanGuestValue(value: unknown): string {
  return String(value ?? '').replace(/\u0000/g, '').replace(/\r/g, '').trim()
}

function cap(value: string): string {
  return value.length > 4096 ? value.slice(0, 4096) : value
}

export function normGuestValue(value: unknown): string {
  return cleanGuestValue(value).toLocaleLowerCase('en')
}

export function parseGuestInteger(value: string, minimum: number): number | null {
  const raw = cleanGuestValue(value).replace(/,/g, '')
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : null
}

export function toGuestWorksheetInput(row: Record<string, string>): GuestWorksheetInput {
  return {
    guestId: cleanGuestValue(row.guestId),
    firstName: cap(cleanGuestValue(row.firstName)),
    lastName: cap(cleanGuestValue(row.lastName)),
    displayName: cap(cleanGuestValue(row.displayName)),
    email: cap(cleanGuestValue(row.email)),
    phone: cap(cleanGuestValue(row.phone)),
    group: cap(cleanGuestValue(row.group)),
    invitationStatus: cleanGuestValue(row.invitationStatus),
    rsvpStatus: cleanGuestValue(row.rsvpStatus),
    numberAttending: parseGuestInteger(row.numberAttending, 1),
    plusOneName: cap(cleanGuestValue(row.plusOneName)),
    numberOfChildren: parseGuestInteger(row.numberOfChildren, 0),
    dietary: cap(cleanGuestValue(row.dietary)),
    accessibility: cap(cleanGuestValue(row.accessibility)),
    transport: cap(cleanGuestValue(row.transport)),
    accommodation: cap(cleanGuestValue(row.accommodation)),
    tableAssignment: cap(cleanGuestValue(row.tableAssignment)),
    seatAssignment: cap(cleanGuestValue(row.seatAssignment)),
    publicNotes: cap(cleanGuestValue(row.publicNotes)),
    privateNotes: cap(cleanGuestValue(row.privateNotes)),
  }
}

export function inputDisplayName(input: Pick<GuestWorksheetInput, 'firstName' | 'lastName' | 'displayName'>): string {
  return input.displayName || [input.firstName, input.lastName].filter(Boolean).join(' ')
}

export function statusFromAttending(attending: boolean | null | undefined): string {
  return attending === true ? 'attending' : attending === false ? 'declined' : 'pending'
}

export function attendingFromStatus(status: string): boolean | null {
  return status === 'attending' ? true : status === 'declined' ? false : null
}

export function guestRecordToRow(record: GuestWorksheetRecord): Record<string, string> {
  const x = record.worksheet
  return {
    guestId: record.id,
    firstName: x?.firstName || '',
    lastName: x?.lastName || '',
    displayName: x?.displayName || record.name || '',
    email: record.email || '',
    phone: record.phone || '',
    group: x?.guestGroup || '',
    invitationStatus: x?.invitationStatus || 'pending',
    rsvpStatus: x?.responseStatus || statusFromAttending(record.rsvp?.attending),
    numberAttending: String(Math.max(1, x?.partySize ?? (record.rsvp?.plusOne ? 2 : 1))),
    plusOneName: record.rsvp?.plusOneName || '',
    numberOfChildren: String(record.rsvp?.kidsCount ?? 0),
    dietary: record.rsvp?.dietaryNotes || '',
    accessibility: x?.accessibilityNotes || '',
    transport: x?.transportDetails || '',
    accommodation: x?.accommodationDetails || '',
    tableAssignment: record.seatingTable?.name || '',
    seatAssignment: x?.seatAssignment || '',
    publicNotes: x?.publicNotes || '',
    privateNotes: x?.privateNotes || '',
  }
}

export function validateGuestWorksheetRow(row: Record<string, string>): string[] {
  const errors: string[] = []
  if (!cleanGuestValue(row.firstName) && !cleanGuestValue(row.displayName)) errors.push('Either "First Name" or "Display Name" is required')
  if (cleanGuestValue(row.numberAttending) && parseGuestInteger(row.numberAttending, 1) == null) errors.push('Number Attending must be a whole number of at least 1')
  if (cleanGuestValue(row.numberOfChildren) && parseGuestInteger(row.numberOfChildren, 0) == null) errors.push('Number of Children must be a whole number of 0 or more')
  return errors
}

export function guestRowIdentity(row: Record<string, string>): string | null {
  const input = toGuestWorksheetInput(row)
  if (input.guestId) return `id:${input.guestId}`
  if (input.email) return `email:${normGuestValue(input.email)}`
  const name = normGuestValue(inputDisplayName(input))
  return name ? (input.phone ? `name-phone:${name}|${normGuestValue(input.phone)}` : `name:${name}`) : null
}

export function matchGuestRow(row: Record<string, string>, records: any[]) {
  const input = toGuestWorksheetInput(row)
  const existing = records as GuestWorksheetRecord[]
  if (input.guestId) {
    const record = existing.find((guest) => guest.id === input.guestId)
    return record ? { record } : { error: 'Guest ID was not found in the selected wedding. Cross-wedding IDs cannot be imported.' }
  }
  if (input.email) {
    const matches = existing.filter((guest) => normGuestValue(guest.email) === normGuestValue(input.email))
    if (matches.length > 1) return { error: 'Email matches more than one guest in this wedding.' }
    if (matches.length === 1) return { record: matches[0] }
  }
  const name = normGuestValue(inputDisplayName(input))
  if (name && input.phone) {
    const matches = existing.filter((guest) => normGuestValue(guestRecordToRow(guest).displayName) === name && normGuestValue(guest.phone) === normGuestValue(input.phone))
    if (matches.length > 1) return { error: 'Name and phone match more than one guest in this wedding.' }
    if (matches.length === 1) return { record: matches[0] }
  }
  if (name) {
    const matches = existing.filter((guest) => normGuestValue(guestRecordToRow(guest).displayName) === name)
    if (matches.length > 1) return { error: 'Guest name is ambiguous. Add Guest ID, email, or phone.' }
    if (matches.length === 1) return { record: matches[0], warning: 'Matched by unique display name because Guest ID and email were blank.' }
  }
  return {}
}

export function buildGuestWorksheetSchema(fetchExisting: (weddingId: string) => Promise<any[]>): ModuleSchema {
  return {
    key: 'guests',
    name: 'Guests',
    description: 'Master guest list with RSVP, dietary, accessibility, transport, accommodation and seating data.',
    version: '1.1.0',
    fields: guestWorksheetFields,
    rowToRecord: toGuestWorksheetInput,
    recordToRow: guestRecordToRow,
    validateRow: validateGuestWorksheetRow,
    rowIdentity: guestRowIdentity,
    matchExisting: matchGuestRow,
    fetchExisting,
    upsert: async () => { throw new Error('Guests worksheets require the transactional guest executor.') },
  }
}
