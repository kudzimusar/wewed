/**
 * wewed — Import/Export Engine — Module Schemas
 * ============================================================
 * The 10 worksheet modules, each fully described as a
 * `ModuleSchema`. The engine (parser → mapper → validator →
 * preview → executor → exporter → template) is data-driven over
 * these schemas — adding a new module means appending one here.
 *
 * Persistence layer (Prisma models):
 *   guests          → Guest
 *   budget          → BudgetItem
 *   checklist       → PlannerTask
 *   seating         → SeatingTable + Guest (table upsert + guest link)
 *   vendors         → Vendor
 *   timeline        → ProgrammeItem
 *   songs           → Song
 *   wedding-party   → Guest (role = 'bridal_party')
 *   travel          → Guest (travel info encoded in roleDetail JSON)
 *   media           → MediaItem
 *
 * NOTE: The engine writes to whatever Prisma models exist at the
 * time of execution. Fields not present on a model are silently
 * dropped — so the schemas are forward-compatible with future
 * schema additions (e.g. when Guest gains explicit travel fields,
 * the travel schema can be updated to write them directly).
 *
 * SECURITY: All cell content is treated as untrusted input.
 * `rowToRecord` strips control characters, trims whitespace,
 * caps absurd lengths, and NEVER evaluates formulas. Strings
 * are stored verbatim; consumers must escape on render.
 */

import { db } from '@/lib/db'
import type { FieldDefinition, ModuleSchema } from './types'

// ============================================================
// Shared parsing helpers — robust against spreadsheet "string-ness"
// ============================================================

/** Trim + collapse internal whitespace + strip null bytes. */
function clean(v: string | undefined | null): string {
  if (v == null) return ''
  const s = String(v).replace(/\u0000/g, '').replace(/\r/g, '')
  return s.trim()
}

/** Parse a number that might be "1,234.56", "$100", "100.50 USD", "" */
function parseNumber(v: string | undefined | null): number | null {
  const s = clean(v)
  if (!s) return null
  // Strip currency symbols, thousands separators, "USD", spaces.
  const normalized = s
    .replace(/[$€£¥₹ZWL\s]/gi, '')
    .replace(/,/g, '')
    .replace(/[A-Z]{3}$/i, '') // trailing currency code
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

/** Parse a currency value (alias of parseNumber for clarity). */
function parseCurrency(v: string | undefined | null): number | null {
  return parseNumber(v)
}

/**
 * Parse a date — accepts ISO strings, dd/mm/yyyy, mm/dd/yyyy
 * (prefers dd/mm when ambiguous because weddings are international),
 * and Excel serial numbers (days since 1899-12-30).
 */
function parseDate(v: string | undefined | null): Date | null {
  const s = clean(v)
  if (!s) return null

  // Excel serial date
  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    const serial = Number(s)
    // Excel epoch: 1899-12-30 (handles the famous 1900 leap bug)
    const ms = Math.round((serial - 25569) * 86400 * 1000)
    const d = new Date(ms)
    if (!Number.isNaN(d.getTime())) return d
  }

  // dd/mm/yyyy or yyyy-mm-dd
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (m) {
    let [, a, b, y] = m
    let year = Number(y)
    if (year < 100) year += year < 50 ? 2000 : 1900
    const day = Number(a)
    const month = Number(b)
    // If first > 12, it must be dd/mm
    let d2: Date
    if (day > 12) d2 = new Date(year, month - 1, day)
    else if (month > 12) d2 = new Date(year, day - 1, month)
    // Ambiguous ≤12/≤12 — prefer dd/mm (international weddings)
    else d2 = new Date(year, month - 1, day)
    if (!Number.isNaN(d2.getTime())) return d2
  }

  const fallback = new Date(s)
  if (!Number.isNaN(fallback.getTime())) return fallback
  return null
}

/** Format a date back to ISO yyyy-mm-dd */
function formatDate(d: Date | string | null | undefined): string {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

/** Parse a boolean from yes/no/true/false/1/0/x/✓ */
function parseBool(v: string | undefined | null): boolean {
  const s = clean(v).toLowerCase()
  return ['yes', 'y', 'true', '1', 'x', '✓', 'confirmed'].includes(s)
}

/** Format a boolean back to "Yes" / "No" */
function formatBool(b: boolean | null | undefined): string {
  if (b == null) return ''
  return b ? 'Yes' : 'No'
}

/** Parse a CSV list ("a, b, c" → ["a","b","c"]). */
function parseList(v: string | undefined | null): string[] {
  const s = clean(v)
  if (!s) return []
  return s
    .split(/[,;|]/)
    .map((x) => x.trim())
    .filter(Boolean)
}

/** Hard cap on string length to avoid DB storage abuse. */
const MAX_STR = 4096
function cap(v: string): string {
  return v.length > MAX_STR ? v.slice(0, MAX_STR) : v
}

/**
 * Strip any leading characters that would make Excel treat the
 * cell as a formula (=, +, -, @, Tab, CR). This is the security
 * boundary against formula injection.
 */
function neuterFormula(v: string): string {
  let s = v
  while (s.length > 0 && '=+-@\t\r'.includes(s[0])) {
    s = s.slice(1)
  }
  return s
}

// ============================================================
// Shared allowed-value sets — kept in sync with the codebase
// ============================================================

const GUEST_ROLES = ['guest', 'bridal_party', 'family', 'officiant', 'vip']
const GUEST_SIDES = ['bride', 'groom', 'family', 'neutral']
const TASK_CATEGORIES = [
  'venue', 'catering', 'attire', 'roora', 'magumo', 'transport',
  'stationery', 'decor', 'photo_video', 'music', 'other',
]
const TASK_STATUSES = ['todo', 'in_progress', 'done', 'blocked']
const TASK_PRIORITIES = ['low', 'medium', 'high']
const BUDGET_CATEGORIES = [
  'venue', 'catering', 'attire', 'roora', 'decor', 'photo_video',
  'music', 'transport', 'stationery', 'miscellaneous',
]
const BUDGET_PAYMENT_STATUSES = ['unpaid', 'partial', 'paid', 'overdue']
const VENDOR_CATEGORIES = [
  'venue', 'caterer', 'photographer', 'florist', 'dj', 'decor',
  'videographer', 'transport', 'stationery', 'beauty', 'officiant', 'other',
]
const VENDOR_CONTRACT_STATUSES = ['draft', 'sent', 'signed', 'cancelled', 'expired']
const VENDOR_SERVICE_STATUSES = ['booked', 'in_progress', 'completed', 'cancelled']
const SONG_MOMENTS = [
  'ceremony', 'processional', 'recessional', 'first_dance', 'reception', 'requested',
]
const SONG_PRIORITIES = ['low', 'medium', 'high', 'must_play']
const PROGRAMME_STATUSES = ['scheduled', 'in_progress', 'completed', 'delayed', 'cancelled']
const PROGRAMME_VISIBILITY = ['public', 'private', 'internal']
const MEDIA_TYPES = ['photo', 'video', 'document']
const MEDIA_CATEGORIES = ['ceremony', 'reception', 'candid', 'preparation', 'group_photo', 'engagement', 'other']
const MEDIA_APPROVAL = ['pending', 'approved', 'rejected', 'featured']
const WEDDING_PARTY_SIDES = ['bride', 'groom', 'family', 'neutral']

// ============================================================
// 1. GUESTS
// ============================================================
const guestsFields: FieldDefinition[] = [
  { key: 'guestId', label: 'Guest ID', required: false, type: 'string', description: 'Internal ID. Leave blank for new guests; used to update existing.' },
  { key: 'firstName', label: 'First Name', required: true, type: 'string', example: 'Tendai', description: 'Given name' },
  { key: 'lastName', label: 'Last Name', required: false, type: 'string', example: 'Moyo', description: 'Family name' },
  { key: 'displayName', label: 'Display Name', required: false, type: 'string', example: 'Tendai Moyo', description: 'Full name as shown publicly' },
  { key: 'email', label: 'Email', required: false, type: 'email', sensitive: true, example: 'tendai@example.com' },
  { key: 'phone', label: 'Phone', required: false, type: 'phone', sensitive: true, example: '+263 77 123 4567' },
  { key: 'group', label: 'Family/Group', required: false, type: 'string', example: "Bride's Family", description: 'Grouping for seating/filtering' },
  { key: 'invitationStatus', label: 'Invitation Status', required: false, type: 'enum', allowedValues: ['pending', 'sent', 'confirmed', 'declined'], example: 'sent' },
  { key: 'rsvpStatus', label: 'RSVP Status', required: false, type: 'enum', allowedValues: ['pending', 'attending', 'declined', 'maybe'], example: 'pending' },
  { key: 'numberAttending', label: 'Number Attending', required: false, type: 'number', example: '1' },
  { key: 'plusOneName', label: 'Plus-One Name', required: false, type: 'string', example: 'Chipo Moyo' },
  { key: 'numberOfChildren', label: 'Number of Children', required: false, type: 'number', example: '0' },
  { key: 'dietary', label: 'Dietary', required: false, type: 'string', sensitive: true, example: 'Vegetarian', description: 'Dietary requirements' },
  { key: 'accessibility', label: 'Accessibility', required: false, type: 'string', sensitive: true, example: 'Wheelchair access' },
  { key: 'transport', label: 'Transport', required: false, type: 'string', example: 'Shuttle from Meikles' },
  { key: 'accommodation', label: 'Accommodation', required: false, type: 'string', example: 'Rainbow Towers' },
  { key: 'tableAssignment', label: 'Table Assignment', required: false, type: 'string', example: 'Table 1' },
  { key: 'seatAssignment', label: 'Seat Assignment', required: false, type: 'string', example: 'A1' },
  { key: 'publicNotes', label: 'Public Notes', required: false, type: 'string', description: 'Visible to guest' },
  { key: 'privateNotes', label: 'Private Notes', required: false, type: 'string', sensitive: true, description: 'Couple-only notes' },
]

function guestsRowToRecord(row: Record<string, string>): any {
  const firstName = clean(row.firstName)
  const lastName = clean(row.lastName)
  const displayName = clean(row.displayName) || [firstName, lastName].filter(Boolean).join(' ')
  const name = displayName || firstName || 'Unnamed Guest'
  const role = GUEST_ROLES.includes(clean(row.invitationStatus)) ? 'guest' : 'guest' // guests import = role 'guest'
  const side = GUEST_SIDES.includes(clean(row.groupSide)) ? clean(row.groupSide) : 'neutral'
  // Table assignment: try to look up by name later in upsert; here just store the desired table name.
  return {
    name: cap(name),
    email: cap(clean(row.email)) || null,
    phone: cap(clean(row.phone)) || null,
    role,
    roleDetail: cap(clean(row.roleDetail)) || null,
    side,
    tableNumber: parseNumber(row.tableNumber) ?? null,
    // Extra import-only metadata encoded in a JSON string on the
    // `roleDetail` field — survives today, can be migrated to real
    // columns when the Guest model grows (Phase 5+).
    _importMeta: {
      firstName,
      lastName,
      displayName,
      group: clean(row.group),
      invitationStatus: clean(row.invitationStatus),
      rsvpStatus: clean(row.rsvpStatus),
      numberAttending: parseNumber(row.numberAttending),
      plusOneName: clean(row.plusOneName),
      numberOfChildren: parseNumber(row.numberOfChildren),
      dietary: clean(row.dietary),
      accessibility: clean(row.accessibility),
      transport: clean(row.transport),
      accommodation: clean(row.accommodation),
      tableAssignment: clean(row.tableAssignment),
      seatAssignment: clean(row.seatAssignment),
      publicNotes: clean(row.publicNotes),
      privateNotes: clean(row.privateNotes),
    },
  }
}

function guestsRecordToRow(r: any): Record<string, string> {
  const meta = r._importMeta || {}
  return {
    guestId: r.id || '',
    firstName: meta.firstName || (r.name || '').split(' ')[0] || '',
    lastName: meta.lastName || (r.name || '').split(' ').slice(1).join(' ') || '',
    displayName: meta.displayName || r.name || '',
    email: r.email || '',
    phone: r.phone || '',
    group: meta.group || '',
    invitationStatus: meta.invitationStatus || '',
    rsvpStatus: meta.rsvpStatus || (r.rsvp?.attending === true ? 'attending' : r.rsvp?.attending === false ? 'declined' : 'pending'),
    numberAttending: meta.numberAttending != null ? String(meta.numberAttending) : (r.rsvp?.plusOne ? '2' : '1'),
    plusOneName: meta.plusOneName || r.rsvp?.plusOneName || '',
    numberOfChildren: meta.numberOfChildren != null ? String(meta.numberOfChildren) : (r.rsvp?.kidsCount ? String(r.rsvp.kidsCount) : '0'),
    dietary: meta.dietary || r.rsvp?.dietaryNotes || '',
    accessibility: meta.accessibility || '',
    transport: meta.transport || '',
    accommodation: meta.accommodation || '',
    tableAssignment: meta.tableAssignment || r.seatingTable?.name || '',
    seatAssignment: meta.seatAssignment || '',
    publicNotes: meta.publicNotes || '',
    privateNotes: meta.privateNotes || '',
  }
}

function guestsValidateRow(row: Record<string, string>): string[] {
  const errs: string[] = []
  if (!clean(row.firstName) && !clean(row.displayName)) {
    errs.push('Either "First Name" or "Display Name" is required')
  }
  if (clean(row.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(row.email))) {
    errs.push('Invalid email format')
  }
  const ia = clean(row.invitationStatus)
  if (ia && !['pending', 'sent', 'confirmed', 'declined'].includes(ia)) {
    errs.push(`Invitation Status "${ia}" is not a valid value`)
  }
  const rs = clean(row.rsvpStatus)
  if (rs && !['pending', 'attending', 'declined', 'maybe'].includes(rs)) {
    errs.push(`RSVP Status "${rs}" is not a valid value`)
  }
  if (clean(row.numberOfChildren) && parseNumber(row.numberOfChildren) == null) {
    errs.push('Number of Children must be a number')
  }
  return errs
}

// ============================================================
// 2. BUDGET
// ============================================================
const budgetFields: FieldDefinition[] = [
  { key: 'budgetItemId', label: 'Budget Item ID', required: false, type: 'string' },
  { key: 'category', label: 'Category', required: true, type: 'enum', allowedValues: BUDGET_CATEGORIES, example: 'venue' },
  { key: 'item', label: 'Item/Service', required: true, type: 'string', example: 'Imba Manor venue hire' },
  { key: 'description', label: 'Description', required: false, type: 'string', example: 'Full-day hire, ceremony + reception' },
  { key: 'estimatedCost', label: 'Estimated Cost', required: true, type: 'currency', example: '5000' },
  { key: 'quotedAmount', label: 'Quoted Amount', required: false, type: 'currency', example: '4800' },
  { key: 'finalCost', label: 'Final Cost', required: false, type: 'currency', example: '4800' },
  { key: 'depositPaid', label: 'Deposit Paid', required: false, type: 'currency', example: '1500' },
  { key: 'balanceRemaining', label: 'Balance Remaining', required: false, type: 'currency', example: '3300' },
  { key: 'currency', label: 'Currency', required: false, type: 'string', example: 'USD' },
  { key: 'paymentStatus', label: 'Payment Status', required: false, type: 'enum', allowedValues: BUDGET_PAYMENT_STATUSES, example: 'partial' },
  { key: 'paymentDeadline', label: 'Payment Deadline', required: false, type: 'date', example: '2026-12-01' },
  { key: 'vendor', label: 'Vendor', required: false, type: 'string', example: 'Imba Manor' },
  { key: 'responsiblePerson', label: 'Responsible Person', required: false, type: 'string', example: 'Charity' },
  { key: 'notes', label: 'Notes', required: false, type: 'string' },
]

function budgetRowToRecord(row: Record<string, string>): any {
  const category = BUDGET_CATEGORIES.includes(clean(row.category))
    ? clean(row.category)
    : 'miscellaneous'
  const description = cap(neuterFormula(clean(row.item) || clean(row.description) || 'Untitled item'))
  const estimatedCost = parseCurrency(row.estimatedCost) ?? 0
  const actualCost = parseCurrency(row.finalCost) ?? parseCurrency(row.quotedAmount) ?? null
  const paidAmount = parseCurrency(row.depositPaid) ?? 0
  const currency = clean(row.currency) || 'USD'
  const dueDate = parseDate(row.paymentDeadline)
  return {
    category,
    description,
    estimatedCost,
    actualCost,
    paidAmount,
    currency,
    dueDate,
    _importMeta: {
      item: clean(row.item),
      detail: clean(row.description),
      quotedAmount: parseCurrency(row.quotedAmount),
      balanceRemaining: parseCurrency(row.balanceRemaining),
      paymentStatus: clean(row.paymentStatus),
      vendor: clean(row.vendor),
      responsiblePerson: clean(row.responsiblePerson),
      notes: clean(row.notes),
    },
  }
}

function budgetRecordToRow(r: any): Record<string, string> {
  const meta = r._importMeta || {}
  return {
    budgetItemId: r.id || '',
    category: r.category || '',
    item: meta.item || r.description || '',
    description: meta.detail || r.description || '',
    estimatedCost: r.estimatedCost != null ? String(r.estimatedCost) : '',
    quotedAmount: meta.quotedAmount != null ? String(meta.quotedAmount) : '',
    finalCost: r.actualCost != null ? String(r.actualCost) : '',
    depositPaid: r.paidAmount != null ? String(r.paidAmount) : '',
    balanceRemaining: meta.balanceRemaining != null ? String(meta.balanceRemaining) :
      (r.actualCost != null && r.paidAmount != null ? String(Math.max(0, r.actualCost - r.paidAmount)) : ''),
    currency: r.currency || 'USD',
    paymentStatus: meta.paymentStatus ||
      (r.actualCost && r.paidAmount >= r.actualCost ? 'paid' :
       r.paidAmount > 0 ? 'partial' : 'unpaid'),
    paymentDeadline: formatDate(r.dueDate),
    vendor: meta.vendor || '',
    responsiblePerson: meta.responsiblePerson || '',
    notes: meta.notes || '',
  }
}

function budgetValidateRow(row: Record<string, string>): string[] {
  const errs: string[] = []
  if (!clean(row.item)) errs.push('Item/Service is required')
  if (!clean(row.category)) {
    errs.push('Category is required')
  } else if (!BUDGET_CATEGORIES.includes(clean(row.category))) {
    errs.push(`Category "${row.category}" not in: ${BUDGET_CATEGORIES.join(', ')}`)
  }
  if (clean(row.estimatedCost) && parseCurrency(row.estimatedCost) == null) {
    errs.push('Estimated Cost must be a number')
  }
  if (clean(row.paymentDeadline) && parseDate(row.paymentDeadline) == null) {
    errs.push('Payment Deadline is not a valid date')
  }
  const ps = clean(row.paymentStatus)
  if (ps && !BUDGET_PAYMENT_STATUSES.includes(ps)) {
    errs.push(`Payment Status "${ps}" not in: ${BUDGET_PAYMENT_STATUSES.join(', ')}`)
  }
  return errs
}

// ============================================================
// 3. CHECKLIST
// ============================================================
const checklistFields: FieldDefinition[] = [
  { key: 'taskId', label: 'Task ID', required: false, type: 'string' },
  { key: 'task', label: 'Task', required: true, type: 'string', example: 'Confirm venue booking' },
  { key: 'category', label: 'Category', required: true, type: 'enum', allowedValues: TASK_CATEGORIES, example: 'venue' },
  { key: 'description', label: 'Description', required: false, type: 'string' },
  { key: 'assignedPerson', label: 'Assigned Person', required: false, type: 'string', example: 'Charity' },
  { key: 'dueDate', label: 'Due Date', required: false, type: 'date', example: '2026-10-01' },
  { key: 'priority', label: 'Priority', required: false, type: 'enum', allowedValues: TASK_PRIORITIES, example: 'high' },
  { key: 'status', label: 'Status', required: false, type: 'enum', allowedValues: TASK_STATUSES, example: 'todo' },
  { key: 'dependency', label: 'Dependency', required: false, type: 'string', example: 'Venue confirmed' },
  { key: 'completionPct', label: 'Completion %', required: false, type: 'number', example: '0' },
  { key: 'notes', label: 'Notes', required: false, type: 'string' },
]

function checklistRowToRecord(row: Record<string, string>): any {
  const status = TASK_STATUSES.includes(clean(row.status)) ? clean(row.status) : 'todo'
  const priority = TASK_PRIORITIES.includes(clean(row.priority)) ? clean(row.priority) : 'medium'
  const category = TASK_CATEGORIES.includes(clean(row.category)) ? clean(row.category) : 'other'
  const pct = parseNumber(row.completionPct) ?? 0
  // If completion % = 100, force status = done
  const finalStatus = pct >= 100 ? 'done' : status
  return {
    title: cap(neuterFormula(clean(row.task) || 'Untitled task')),
    description: cap(clean(row.description)) || null,
    category,
    status: finalStatus,
    priority,
    dueDate: parseDate(row.dueDate),
    assignee: cap(clean(row.assignedPerson)) || null,
    order: 0,
    _importMeta: {
      dependency: clean(row.dependency),
      completionPct: pct,
      notes: clean(row.notes),
    },
  }
}

function checklistRecordToRow(r: any): Record<string, string> {
  const meta = r._importMeta || {}
  return {
    taskId: r.id || '',
    task: r.title || '',
    category: r.category || '',
    description: r.description || '',
    assignedPerson: r.assignee || '',
    dueDate: formatDate(r.dueDate),
    priority: r.priority || 'medium',
    status: r.status || 'todo',
    dependency: meta.dependency || '',
    completionPct: meta.completionPct != null ? String(meta.completionPct) :
      (r.status === 'done' ? '100' : '0'),
    notes: meta.notes || '',
  }
}

function checklistValidateRow(row: Record<string, string>): string[] {
  const errs: string[] = []
  if (!clean(row.task)) errs.push('Task is required')
  if (!clean(row.category)) {
    errs.push('Category is required')
  } else if (!TASK_CATEGORIES.includes(clean(row.category))) {
    errs.push(`Category "${row.category}" not in: ${TASK_CATEGORIES.join(', ')}`)
  }
  const st = clean(row.status)
  if (st && !TASK_STATUSES.includes(st)) errs.push(`Status "${st}" not in: ${TASK_STATUSES.join(', ')}`)
  const pr = clean(row.priority)
  if (pr && !TASK_PRIORITIES.includes(pr)) errs.push(`Priority "${pr}" not in: ${TASK_PRIORITIES.join(', ')}`)
  const pct = parseNumber(row.completionPct)
  if (pct != null && (pct < 0 || pct > 100)) errs.push('Completion % must be between 0 and 100')
  return errs
}

// ============================================================
// 4. SEATING
// ============================================================
const seatingFields: FieldDefinition[] = [
  { key: 'seatingRecordId', label: 'Seating Record ID', required: false, type: 'string' },
  { key: 'tableName', label: 'Table Number/Name', required: true, type: 'string', example: 'Table 1' },
  { key: 'tableCapacity', label: 'Table Capacity', required: false, type: 'number', example: '8' },
  { key: 'guestId', label: 'Guest ID', required: false, type: 'string', description: 'Reference to existing Guest record' },
  { key: 'guestName', label: 'Guest Name', required: true, type: 'string', example: 'Tendai Moyo' },
  { key: 'guestGroup', label: 'Guest Group', required: false, type: 'string', example: "Bride's Family" },
  { key: 'seatNumber', label: 'Seat Number', required: false, type: 'string', example: 'A1' },
  { key: 'relationship', label: 'Relationship', required: false, type: 'string', example: "Charity's sister" },
  { key: 'dietaryNotes', label: 'Dietary Notes', required: false, type: 'string', sensitive: true },
  { key: 'accessibilityNotes', label: 'Accessibility Notes', required: false, type: 'string', sensitive: true },
  { key: 'seatingRestrictions', label: 'Seating Restrictions', required: false, type: 'string', example: 'Not next to ex-partner' },
  { key: 'internalNotes', label: 'Internal Notes', required: false, type: 'string' },
]

function seatingRowToRecord(row: Record<string, string>): any {
  // The seating import's "record" is really two operations: ensure the
  // table exists, then link/update the guest. We pack both into the
  // record object; the upsert function unpacks it.
  return {
    tableName: cap(clean(row.tableName)),
    tableCapacity: parseNumber(row.tableCapacity) ?? 8,
    guestId: clean(row.guestId),
    guestName: cap(clean(row.guestName)),
    _importMeta: {
      guestGroup: clean(row.guestGroup),
      seatNumber: clean(row.seatNumber),
      relationship: clean(row.relationship),
      dietaryNotes: clean(row.dietaryNotes),
      accessibilityNotes: clean(row.accessibilityNotes),
      seatingRestrictions: clean(row.seatingRestrictions),
      internalNotes: clean(row.internalNotes),
    },
  }
}

function seatingRecordToRow(r: any): Record<string, string> {
  const meta = r._importMeta || {}
  return {
    seatingRecordId: r.id || '',
    tableName: r.tableName || r.seatingTable?.name || '',
    tableCapacity: r.tableCapacity != null ? String(r.tableCapacity) : (r.seatingTable?.capacity ? String(r.seatingTable.capacity) : '8'),
    guestId: r.id || '',
    guestName: r.name || '',
    guestGroup: meta.guestGroup || r.side || '',
    seatNumber: meta.seatNumber || '',
    relationship: meta.relationship || r.roleDetail || '',
    dietaryNotes: meta.dietaryNotes || r.rsvp?.dietaryNotes || '',
    accessibilityNotes: meta.accessibilityNotes || '',
    seatingRestrictions: meta.seatingRestrictions || '',
    internalNotes: meta.internalNotes || '',
  }
}

function seatingValidateRow(row: Record<string, string>): string[] {
  const errs: string[] = []
  if (!clean(row.tableName)) errs.push('Table Number/Name is required')
  if (!clean(row.guestName) && !clean(row.guestId)) {
    errs.push('Either Guest Name or Guest ID is required')
  }
  if (clean(row.tableCapacity) && parseNumber(row.tableCapacity) == null) {
    errs.push('Table Capacity must be a number')
  }
  return errs
}

// ============================================================
// 5. VENDORS
// ============================================================
const vendorsFields: FieldDefinition[] = [
  { key: 'vendorId', label: 'Vendor ID', required: false, type: 'string' },
  { key: 'vendorName', label: 'Vendor Name', required: true, type: 'string', example: 'Imba Manor' },
  { key: 'category', label: 'Category', required: true, type: 'enum', allowedValues: VENDOR_CATEGORIES, example: 'venue' },
  { key: 'contactPerson', label: 'Contact Person', required: false, type: 'string', example: 'Tariro Banda' },
  { key: 'phone', label: 'Phone', required: false, type: 'phone', sensitive: true, example: '+263 77 123 4567' },
  { key: 'email', label: 'Email', required: false, type: 'email', sensitive: true, example: 'events@imbamanor.co.zw' },
  { key: 'website', label: 'Website', required: false, type: 'string', example: 'https://imbamanor.co.zw' },
  { key: 'socialMedia', label: 'Social Media', required: false, type: 'string', example: '@imbamanor' },
  { key: 'quotedPrice', label: 'Quoted Price', required: false, type: 'currency', example: '5000' },
  { key: 'depositPaid', label: 'Deposit Paid', required: false, type: 'currency', example: '1500' },
  { key: 'balance', label: 'Balance', required: false, type: 'currency', example: '3500' },
  { key: 'paymentDeadline', label: 'Payment Deadline', required: false, type: 'date', example: '2026-12-01' },
  { key: 'contractStatus', label: 'Contract Status', required: false, type: 'enum', allowedValues: VENDOR_CONTRACT_STATUSES, example: 'signed' },
  { key: 'serviceStatus', label: 'Service Status', required: false, type: 'enum', allowedValues: VENDOR_SERVICE_STATUSES, example: 'booked' },
  { key: 'responsiblePerson', label: 'Responsible Person', required: false, type: 'string', example: 'Charity' },
  { key: 'notes', label: 'Notes', required: false, type: 'string' },
]

function vendorsRowToRecord(row: Record<string, string>): any {
  const category = VENDOR_CATEGORIES.includes(clean(row.category)) ? clean(row.category) : 'other'
  return {
    name: cap(neuterFormula(clean(row.vendorName) || 'Unnamed Vendor')),
    category,
    description: cap(clean(row.notes)) || null,
    website: cap(clean(row.website)) || null,
    phone: cap(clean(row.phone)) || null,
    imageUrl: null,
    rating: null,
    featured: false,
    _importMeta: {
      contactPerson: clean(row.contactPerson),
      email: clean(row.email),
      socialMedia: clean(row.socialMedia),
      quotedPrice: parseCurrency(row.quotedPrice),
      depositPaid: parseCurrency(row.depositPaid),
      balance: parseCurrency(row.balance),
      paymentDeadline: parseDate(row.paymentDeadline),
      contractStatus: clean(row.contractStatus),
      serviceStatus: clean(row.serviceStatus),
      responsiblePerson: clean(row.responsiblePerson),
    },
  }
}

function vendorsRecordToRow(r: any): Record<string, string> {
  const meta = r._importMeta || {}
  return {
    vendorId: r.id || '',
    vendorName: r.name || '',
    category: r.category || '',
    contactPerson: meta.contactPerson || '',
    phone: r.phone || '',
    email: meta.email || '',
    website: r.website || '',
    socialMedia: meta.socialMedia || '',
    quotedPrice: meta.quotedPrice != null ? String(meta.quotedPrice) : '',
    depositPaid: meta.depositPaid != null ? String(meta.depositPaid) : '',
    balance: meta.balance != null ? String(meta.balance) : '',
    paymentDeadline: formatDate(meta.paymentDeadline),
    contractStatus: meta.contractStatus || '',
    serviceStatus: meta.serviceStatus || '',
    responsiblePerson: meta.responsiblePerson || '',
    notes: r.description || '',
  }
}

function vendorsValidateRow(row: Record<string, string>): string[] {
  const errs: string[] = []
  if (!clean(row.vendorName)) errs.push('Vendor Name is required')
  if (!clean(row.category)) {
    errs.push('Category is required')
  } else if (!VENDOR_CATEGORIES.includes(clean(row.category))) {
    errs.push(`Category "${row.category}" not in: ${VENDOR_CATEGORIES.join(', ')}`)
  }
  if (clean(row.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(row.email))) {
    errs.push('Invalid email format')
  }
  const cs = clean(row.contractStatus)
  if (cs && !VENDOR_CONTRACT_STATUSES.includes(cs)) errs.push(`Contract Status "${cs}" not valid`)
  const ss = clean(row.serviceStatus)
  if (ss && !VENDOR_SERVICE_STATUSES.includes(ss)) errs.push(`Service Status "${ss}" not valid`)
  return errs
}

// ============================================================
// 6. TIMELINE
// ============================================================
const timelineFields: FieldDefinition[] = [
  { key: 'timelineItemId', label: 'Timeline Item ID', required: false, type: 'string' },
  { key: 'date', label: 'Date', required: false, type: 'date', example: '2026-12-23' },
  { key: 'startTime', label: 'Start Time', required: true, type: 'string', example: '14:00' },
  { key: 'endTime', label: 'End Time', required: false, type: 'string', example: '14:30' },
  { key: 'activity', label: 'Activity', required: true, type: 'string', example: 'Guest arrival' },
  { key: 'description', label: 'Description', required: false, type: 'string' },
  { key: 'location', label: 'Location', required: false, type: 'string', example: 'Imba Manor — Main Lawn' },
  { key: 'responsiblePerson', label: 'Responsible Person', required: false, type: 'string', example: 'Tariro (Coordinator)' },
  { key: 'participants', label: 'Participants', required: false, type: 'string', example: 'All guests' },
  { key: 'vendorInvolved', label: 'Vendor Involved', required: false, type: 'string', example: 'Imba Manor' },
  { key: 'status', label: 'Status', required: false, type: 'enum', allowedValues: PROGRAMME_STATUSES, example: 'scheduled' },
  { key: 'guestFacingVisibility', label: 'Guest-Facing Visibility', required: false, type: 'enum', allowedValues: PROGRAMME_VISIBILITY, example: 'public' },
  { key: 'internalNotes', label: 'Internal Notes', required: false, type: 'string' },
]

function timelineRowToRecord(row: Record<string, string>): any {
  // Combine date + startTime into the `time` field that ProgrammeItem expects.
  const date = parseDate(row.date)
  const startTime = clean(row.startTime)
  const endTime = clean(row.endTime)
  // ProgrammeItem.time is a string like "14:00" — keep it simple.
  let timeStr = startTime
  if (startTime && endTime) timeStr = `${startTime}–${endTime}`
  return {
    time: cap(timeStr || '00:00'),
    title: cap(neuterFormula(clean(row.activity) || 'Untitled item')),
    description: cap(clean(row.description)) || null,
    icon: null,
    order: 0,
    _importMeta: {
      date: date ? formatDate(date) : '',
      startTime,
      endTime,
      location: clean(row.location),
      responsiblePerson: clean(row.responsiblePerson),
      participants: clean(row.participants),
      vendorInvolved: clean(row.vendorInvolved),
      status: PROGRAMME_STATUSES.includes(clean(row.status)) ? clean(row.status) : 'scheduled',
      guestFacingVisibility: PROGRAMME_VISIBILITY.includes(clean(row.guestFacingVisibility))
        ? clean(row.guestFacingVisibility)
        : 'public',
      internalNotes: clean(row.internalNotes),
    },
  }
}

function timelineRecordToRow(r: any): Record<string, string> {
  const meta = r._importMeta || {}
  // Split "14:00–14:30" back into start/end
  let startTime = ''
  let endTime = ''
  if (meta.startTime) {
    startTime = meta.startTime
    endTime = meta.endTime || ''
  } else if (r.time) {
    const parts = r.time.split(/[–-]/).map((s: string) => s.trim())
    startTime = parts[0] || r.time
    endTime = parts[1] || ''
  }
  return {
    timelineItemId: r.id || '',
    date: meta.date || '',
    startTime,
    endTime,
    activity: r.title || '',
    description: r.description || '',
    location: meta.location || '',
    responsiblePerson: meta.responsiblePerson || '',
    participants: meta.participants || '',
    vendorInvolved: meta.vendorInvolved || '',
    status: meta.status || 'scheduled',
    guestFacingVisibility: meta.guestFacingVisibility || 'public',
    internalNotes: meta.internalNotes || '',
  }
}

function timelineValidateRow(row: Record<string, string>): string[] {
  const errs: string[] = []
  if (!clean(row.startTime)) errs.push('Start Time is required')
  if (!clean(row.activity)) errs.push('Activity is required')
  if (clean(row.startTime) && !/^\d{1,2}:\d{2}\s*(am|pm)?$/i.test(clean(row.startTime))) {
    errs.push('Start Time should be HH:MM (24h) or H:MMam/pm')
  }
  if (clean(row.endTime) && !/^\d{1,2}:\d{2}\s*(am|pm)?$/i.test(clean(row.endTime))) {
    errs.push('End Time should be HH:MM (24h) or H:MMam/pm')
  }
  const st = clean(row.status)
  if (st && !PROGRAMME_STATUSES.includes(st)) errs.push(`Status "${st}" not valid`)
  const vis = clean(row.guestFacingVisibility)
  if (vis && !PROGRAMME_VISIBILITY.includes(vis)) errs.push(`Visibility "${vis}" not valid`)
  return errs
}

// ============================================================
// 7. SONGS
// ============================================================
const songsFields: FieldDefinition[] = [
  { key: 'songId', label: 'Song ID', required: false, type: 'string' },
  { key: 'title', label: 'Song Title', required: true, type: 'string', example: 'Neria' },
  { key: 'artist', label: 'Artist', required: true, type: 'string', example: 'Oliver Mtukudzi' },
  { key: 'weddingMoment', label: 'Wedding Moment', required: true, type: 'enum', allowedValues: SONG_MOMENTS, example: 'first_dance' },
  { key: 'requestedBy', label: 'Requested By', required: false, type: 'string', example: 'Charity' },
  { key: 'category', label: 'Category', required: false, type: 'string', example: 'Afro Jazz' },
  { key: 'priority', label: 'Priority', required: false, type: 'enum', allowedValues: SONG_PRIORITIES, example: 'must_play' },
  { key: 'approved', label: 'Approved', required: false, type: 'boolean', example: 'Yes' },
  { key: 'explicitContent', label: 'Explicit Content', required: false, type: 'boolean', example: 'No' },
  { key: 'doNotPlay', label: 'Do-Not-Play', required: false, type: 'boolean', example: 'No' },
  { key: 'djNotes', label: 'DJ Notes', required: false, type: 'string', example: 'Fade out at 3:30' },
  { key: 'publicVisibility', label: 'Public Visibility', required: false, type: 'enum', allowedValues: ['public', 'private'], example: 'public' },
]

function songsRowToRecord(row: Record<string, string>): any {
  const phase = SONG_MOMENTS.includes(clean(row.weddingMoment)) ? clean(row.weddingMoment) : 'requested'
  return {
    title: cap(neuterFormula(clean(row.title) || 'Untitled Song')),
    artist: cap(neuterFormula(clean(row.artist) || 'Unknown Artist')),
    phase,
    moment: cap(clean(row.weddingMoment)) || null,
    order: 0,
    votes: 0,
    spotifyUrl: null,
    appleUrl: null,
    playedAt: null,
    notes: cap(clean(row.djNotes)) || null,
    _importMeta: {
      requestedBy: clean(row.requestedBy),
      category: clean(row.category),
      priority: SONG_PRIORITIES.includes(clean(row.priority)) ? clean(row.priority) : 'medium',
      approved: parseBool(row.approved),
      explicitContent: parseBool(row.explicitContent),
      doNotPlay: parseBool(row.doNotPlay),
      djNotes: clean(row.djNotes),
      publicVisibility: clean(row.publicVisibility) === 'private' ? 'private' : 'public',
    },
  }
}

function songsRecordToRow(r: any): Record<string, string> {
  const meta = r._importMeta || {}
  return {
    songId: r.id || '',
    title: r.title || '',
    artist: r.artist || '',
    weddingMoment: r.phase || r.moment || '',
    requestedBy: meta.requestedBy || '',
    category: meta.category || '',
    priority: meta.priority || 'medium',
    approved: formatBool(meta.approved ?? true),
    explicitContent: formatBool(meta.explicitContent),
    doNotPlay: formatBool(meta.doNotPlay),
    djNotes: meta.djNotes || r.notes || '',
    publicVisibility: meta.publicVisibility || 'public',
  }
}

function songsValidateRow(row: Record<string, string>): string[] {
  const errs: string[] = []
  if (!clean(row.title)) errs.push('Song Title is required')
  if (!clean(row.artist)) errs.push('Artist is required')
  const m = clean(row.weddingMoment)
  if (!m) errs.push('Wedding Moment is required')
  else if (!SONG_MOMENTS.includes(m)) errs.push(`Wedding Moment "${m}" not in: ${SONG_MOMENTS.join(', ')}`)
  const p = clean(row.priority)
  if (p && !SONG_PRIORITIES.includes(p)) errs.push(`Priority "${p}" not valid`)
  return errs
}

// ============================================================
// 8. WEDDING-PARTY
// ============================================================
const weddingPartyFields: FieldDefinition[] = [
  { key: 'memberId', label: 'Member ID', required: false, type: 'string' },
  { key: 'name', label: 'Name', required: true, type: 'string', example: 'Tendai Moyo' },
  { key: 'role', label: 'Role', required: true, type: 'string', example: 'Maid of Honor' },
  { key: 'side', label: 'Side of Wedding', required: true, type: 'enum', allowedValues: WEDDING_PARTY_SIDES, example: 'bride' },
  { key: 'relationship', label: 'Relationship', required: false, type: 'string', example: "Charity's childhood best friend" },
  { key: 'biography', label: 'Biography', required: false, type: 'string', description: '2-3 sentence bio' },
  { key: 'phone', label: 'Phone', required: false, type: 'phone', sensitive: true },
  { key: 'email', label: 'Email', required: false, type: 'email', sensitive: true },
  { key: 'photoReference', label: 'Photo Reference', required: false, type: 'string', example: 'tendai-m.jpg' },
  { key: 'displayOrder', label: 'Display Order', required: false, type: 'number', example: '1' },
  { key: 'publicVisibility', label: 'Public Visibility', required: false, type: 'enum', allowedValues: ['public', 'private'], example: 'public' },
]

function weddingPartyRowToRecord(row: Record<string, string>): any {
  return {
    name: cap(neuterFormula(clean(row.name) || 'Unnamed Member')),
    email: cap(clean(row.email)) || null,
    phone: cap(clean(row.phone)) || null,
    role: 'bridal_party',
    roleDetail: cap(clean(row.role)) || null,
    side: WEDDING_PARTY_SIDES.includes(clean(row.side)) ? clean(row.side) : 'neutral',
    tableNumber: null,
    seatingTableId: null,
    _importMeta: {
      role: clean(row.role),
      relationship: clean(row.relationship),
      biography: clean(row.biography),
      photoReference: clean(row.photoReference),
      displayOrder: parseNumber(row.displayOrder) ?? 0,
      publicVisibility: clean(row.publicVisibility) === 'private' ? 'private' : 'public',
    },
  }
}

function weddingPartyRecordToRow(r: any): Record<string, string> {
  const meta = r._importMeta || {}
  return {
    memberId: r.id || '',
    name: r.name || '',
    role: meta.role || r.roleDetail || '',
    side: r.side || 'neutral',
    relationship: meta.relationship || '',
    biography: meta.biography || '',
    phone: r.phone || '',
    email: r.email || '',
    photoReference: meta.photoReference || '',
    displayOrder: meta.displayOrder != null ? String(meta.displayOrder) : '0',
    publicVisibility: meta.publicVisibility || 'public',
  }
}

function weddingPartyValidateRow(row: Record<string, string>): string[] {
  const errs: string[] = []
  if (!clean(row.name)) errs.push('Name is required')
  if (!clean(row.role)) errs.push('Role is required')
  if (!clean(row.side)) {
    errs.push('Side of Wedding is required')
  } else if (!WEDDING_PARTY_SIDES.includes(clean(row.side))) {
    errs.push(`Side "${row.side}" not in: ${WEDDING_PARTY_SIDES.join(', ')}`)
  }
  if (clean(row.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(row.email))) {
    errs.push('Invalid email format')
  }
  return errs
}

// ============================================================
// 9. TRAVEL
// (uses Guest model — travel info encoded in roleDetail JSON)
// ============================================================
const travelFields: FieldDefinition[] = [
  { key: 'recordId', label: 'Record ID', required: false, type: 'string' },
  { key: 'guestId', label: 'Guest ID', required: false, type: 'string', description: 'Reference to existing Guest record' },
  { key: 'guestName', label: 'Guest Name', required: true, type: 'string', example: 'Tendai Moyo' },
  { key: 'arrivalDate', label: 'Arrival Date', required: false, type: 'date', example: '2026-12-22' },
  { key: 'departureDate', label: 'Departure Date', required: false, type: 'date', example: '2026-12-25' },
  { key: 'flightDetails', label: 'Flight/Transport Details', required: false, type: 'string', example: 'ET 873 JNB-HRE, 22 Dec 14:00' },
  { key: 'hotel', label: 'Hotel', required: false, type: 'string', example: 'Rainbow Towers' },
  { key: 'roomAssignment', label: 'Room Assignment', required: false, type: 'string', example: 'Room 204' },
  { key: 'airportPickup', label: 'Airport Pickup', required: false, type: 'boolean', example: 'Yes' },
  { key: 'shuttleRequirement', label: 'Shuttle Requirement', required: false, type: 'boolean', example: 'Yes' },
  { key: 'contactNumber', label: 'Contact Number', required: false, type: 'phone', sensitive: true, example: '+263 77 123 4567' },
  { key: 'specialInstructions', label: 'Special Instructions', required: false, type: 'string' },
  { key: 'privateNotes', label: 'Private Notes', required: false, type: 'string', sensitive: true },
]

function travelRowToRecord(row: Record<string, string>): any {
  const guestName = cap(neuterFormula(clean(row.guestName) || 'Unnamed Guest'))
  const meta = {
    guestId: clean(row.guestId),
    arrivalDate: parseDate(row.arrivalDate) ? formatDate(parseDate(row.arrivalDate)) : '',
    departureDate: parseDate(row.departureDate) ? formatDate(parseDate(row.departureDate)) : '',
    flightDetails: clean(row.flightDetails),
    hotel: clean(row.hotel),
    roomAssignment: clean(row.roomAssignment),
    airportPickup: parseBool(row.airportPickup),
    shuttleRequirement: parseBool(row.shuttleRequirement),
    specialInstructions: clean(row.specialInstructions),
    privateNotes: clean(row.privateNotes),
  }
  // Encode travel meta into roleDetail JSON for persistence on Guest.
  return {
    name: guestName,
    phone: cap(clean(row.contactNumber)) || null,
    role: 'guest',
    roleDetail: cap(`Travel: ${meta.arrivalDate || 'TBD'} → ${meta.departureDate || 'TBD'} @ ${meta.hotel || 'TBD'}`),
    side: 'neutral',
    _importMeta: meta,
  }
}

function travelRecordToRow(r: any): Record<string, string> {
  const meta = r._importMeta || {}
  return {
    recordId: r.id || '',
    guestId: meta.guestId || r.id || '',
    guestName: r.name || '',
    arrivalDate: meta.arrivalDate || '',
    departureDate: meta.departureDate || '',
    flightDetails: meta.flightDetails || '',
    hotel: meta.hotel || '',
    roomAssignment: meta.roomAssignment || '',
    airportPickup: formatBool(meta.airportPickup),
    shuttleRequirement: formatBool(meta.shuttleRequirement),
    contactNumber: r.phone || '',
    specialInstructions: meta.specialInstructions || '',
    privateNotes: meta.privateNotes || '',
  }
}

function travelValidateRow(row: Record<string, string>): string[] {
  const errs: string[] = []
  if (!clean(row.guestName) && !clean(row.guestId)) {
    errs.push('Either Guest Name or Guest ID is required')
  }
  if (clean(row.arrivalDate) && parseDate(row.arrivalDate) == null) {
    errs.push('Arrival Date is not a valid date')
  }
  if (clean(row.departureDate) && parseDate(row.departureDate) == null) {
    errs.push('Departure Date is not a valid date')
  }
  if (
    clean(row.arrivalDate) &&
    clean(row.departureDate) &&
    parseDate(row.arrivalDate) &&
    parseDate(row.departureDate) &&
    parseDate(row.arrivalDate)! > parseDate(row.departureDate)!
  ) {
    errs.push('Arrival Date must be before Departure Date')
  }
  return errs
}

// ============================================================
// 10. MEDIA
// ============================================================
const mediaFields: FieldDefinition[] = [
  { key: 'mediaId', label: 'Media ID', required: false, type: 'string' },
  { key: 'fileName', label: 'File Name', required: true, type: 'string', example: 'first-dance-01.jpg' },
  { key: 'cloudUrl', label: 'Cloud URL', required: true, type: 'string', example: 'https://cdn.wewed.app/first-dance-01.jpg' },
  { key: 'caption', label: 'Caption', required: false, type: 'string', example: 'The first dance' },
  { key: 'description', label: 'Description', required: false, type: 'string' },
  { key: 'dateTaken', label: 'Date Taken', required: false, type: 'date', example: '2026-12-23' },
  { key: 'photographer', label: 'Photographer', required: false, type: 'string', example: 'Nyarai Photography' },
  { key: 'category', label: 'Category', required: false, type: 'enum', allowedValues: MEDIA_CATEGORIES, example: 'reception' },
  { key: 'relatedStorySection', label: 'Related Story Section', required: false, type: 'string', example: 'first-dance' },
  { key: 'displayOrder', label: 'Display Order', required: false, type: 'number', example: '1' },
  { key: 'publicVisibility', label: 'Public Visibility', required: false, type: 'enum', allowedValues: ['public', 'private'], example: 'public' },
  { key: 'approvalStatus', label: 'Approval Status', required: false, type: 'enum', allowedValues: MEDIA_APPROVAL, example: 'approved' },
]

function mediaRowToRecord(row: Record<string, string>): any {
  const url = cap(neuterFormula(clean(row.cloudUrl) || ''))
  const fileName = cap(clean(row.fileName))
  // Infer type from extension
  const ext = fileName.toLowerCase().split('.').pop() || ''
  const type =
    ['mp4', 'mov', 'avi', 'webm', 'm4v'].includes(ext) ? 'video' :
    ['pdf', 'doc', 'docx', 'txt'].includes(ext) ? 'document' : 'photo'
  const category = MEDIA_CATEGORIES.includes(clean(row.category)) ? clean(row.category) : 'other'
  const approval = MEDIA_APPROVAL.includes(clean(row.approvalStatus)) ? clean(row.approvalStatus) : 'pending'
  return {
    type,
    url,
    thumbnailUrl: null,
    caption: cap(clean(row.caption)) || null,
    moment: category,
    isCurated: approval === 'approved' || approval === 'featured',
    isHero: approval === 'featured',
    uploaderId: null,
    uploadedAt: parseDate(row.dateTaken),
    _importMeta: {
      fileName,
      description: clean(row.description),
      dateTaken: parseDate(row.dateTaken) ? formatDate(parseDate(row.dateTaken)) : '',
      photographer: clean(row.photographer),
      category,
      relatedStorySection: clean(row.relatedStorySection),
      displayOrder: parseNumber(row.displayOrder) ?? 0,
      publicVisibility: clean(row.publicVisibility) === 'private' ? 'private' : 'public',
      approvalStatus: approval,
    },
  }
}

function mediaRecordToRow(r: any): Record<string, string> {
  const meta = r._importMeta || {}
  return {
    mediaId: r.id || '',
    fileName: meta.fileName || r.url?.split('/').pop() || '',
    cloudUrl: r.url || '',
    caption: r.caption || '',
    description: meta.description || '',
    dateTaken: meta.dateTaken || (r.uploadedAt ? formatDate(r.uploadedAt) : ''),
    photographer: meta.photographer || '',
    category: meta.category || r.moment || '',
    relatedStorySection: meta.relatedStorySection || '',
    displayOrder: meta.displayOrder != null ? String(meta.displayOrder) : '0',
    publicVisibility: meta.publicVisibility || 'public',
    approvalStatus: meta.approvalStatus || (r.isHero ? 'featured' : r.isCurated ? 'approved' : 'pending'),
  }
}

function mediaValidateRow(row: Record<string, string>): string[] {
  const errs: string[] = []
  if (!clean(row.fileName)) errs.push('File Name is required')
  if (!clean(row.cloudUrl)) errs.push('Cloud URL is required')
  if (clean(row.cloudUrl) && !/^https?:\/\//i.test(clean(row.cloudUrl))) {
    errs.push('Cloud URL must start with http:// or https://')
  }
  if (clean(row.dateTaken) && parseDate(row.dateTaken) == null) {
    errs.push('Date Taken is not a valid date')
  }
  const c = clean(row.category)
  if (c && !MEDIA_CATEGORIES.includes(c)) errs.push(`Category "${c}" not in: ${MEDIA_CATEGORIES.join(', ')}`)
  const a = clean(row.approvalStatus)
  if (a && !MEDIA_APPROVAL.includes(a)) errs.push(`Approval Status "${a}" not in: ${MEDIA_APPROVAL.join(', ')}`)
  return errs
}

// ============================================================
// Schema registry — exported for the engine + API routes
// ============================================================

export const MODULE_SCHEMAS: Record<string, ModuleSchema> = {
  guests: {
    key: 'guests',
    name: 'Guests',
    description: 'Master guest list with RSVP, dietary, accessibility, and seating info.',
    version: '1.0.0',
    fields: guestsFields,
    rowToRecord: guestsRowToRecord,
    recordToRow: guestsRecordToRow,
    validateRow: guestsValidateRow,
    uniqueKey: 'email',
    fetchExisting: async (weddingId: string) => {
      return db.guest.findMany({
        where: { weddingId, role: 'guest' },
        include: { rsvp: true, seatingTable: { select: { id: true, name: true, capacity: true } } },
        orderBy: { name: 'asc' },
      })
    },
    upsert: async (weddingId, record, existing) => {
      if (existing) {
        return db.guest.update({ where: { id: existing.id }, data: { ...record, _importMeta: undefined, weddingId } })
      }
      return db.guest.create({ data: { ...record, _importMeta: undefined, weddingId } })
    },
  },

  budget: {
    key: 'budget',
    name: 'Budget',
    description: 'Line-item budget with estimates, actuals, deposits, and payment status.',
    version: '1.0.0',
    fields: budgetFields,
    rowToRecord: budgetRowToRecord,
    recordToRow: budgetRecordToRow,
    validateRow: budgetValidateRow,
    uniqueKey: 'item',
    fetchExisting: async (weddingId: string) => {
      return db.budgetItem.findMany({ where: { weddingId }, orderBy: { category: 'asc' } })
    },
    upsert: async (weddingId, record, existing) => {
      if (existing) {
        return db.budgetItem.update({ where: { id: existing.id }, data: { ...record, _importMeta: undefined, weddingId } })
      }
      return db.budgetItem.create({ data: { ...record, _importMeta: undefined, weddingId } })
    },
  },

  checklist: {
    key: 'checklist',
    name: 'Checklist',
    description: 'Planning tasks with assignee, due date, priority, status, dependencies.',
    version: '1.0.0',
    fields: checklistFields,
    rowToRecord: checklistRowToRecord,
    recordToRow: checklistRecordToRow,
    validateRow: checklistValidateRow,
    uniqueKey: 'task',
    fetchExisting: async (weddingId: string) => {
      return db.plannerTask.findMany({ where: { weddingId }, orderBy: { order: 'asc' } })
    },
    upsert: async (weddingId, record, existing) => {
      if (existing) {
        return db.plannerTask.update({ where: { id: existing.id }, data: { ...record, _importMeta: undefined, weddingId } })
      }
      return db.plannerTask.create({ data: { ...record, _importMeta: undefined, weddingId } })
    },
  },

  seating: {
    key: 'seating',
    name: 'Seating',
    description: 'Table assignments with guest lookup, dietary flags, and restrictions.',
    version: '1.0.0',
    fields: seatingFields,
    rowToRecord: seatingRowToRecord,
    recordToRow: seatingRecordToRow,
    validateRow: seatingValidateRow,
    uniqueKey: 'guestName',
    fetchExisting: async (weddingId: string) => {
      const [tables, guests] = await Promise.all([
        db.seatingTable.findMany({ where: { weddingId }, include: { guests: true }, orderBy: { name: 'asc' } }),
        db.guest.findMany({ where: { weddingId }, include: { seatingTable: true, rsvp: true }, orderBy: { name: 'asc' } }),
      ])
      // Return a flattened list: one entry per guest with their table info.
      return guests.map((g) => ({
        ...g,
        tableName: g.seatingTable?.name || '',
        tableCapacity: g.seatingTable?.capacity ?? 8,
      }))
    },
    upsert: async (weddingId, record, _existing) => {
      // 1. Ensure the table exists
      let table = await db.seatingTable.findFirst({
        where: { weddingId, name: record.tableName },
      })
      if (!table) {
        table = await db.seatingTable.create({
          data: { weddingId, name: record.tableName, capacity: record.tableCapacity || 8 },
        })
      }
      // 2. Find or create the guest
      let guest: any = null
      if (record.guestId) {
        guest = await db.guest.findUnique({ where: { id: record.guestId } })
      }
      if (!guest && record.guestName) {
        guest = await db.guest.findFirst({ where: { weddingId, name: record.guestName } })
      }
      if (guest) {
        guest = await db.guest.update({
          where: { id: guest.id },
          data: { seatingTableId: table.id },
        })
      } else {
        guest = await db.guest.create({
          data: {
            weddingId,
            name: record.guestName || 'Unknown Guest',
            role: 'guest',
            side: 'neutral',
            seatingTableId: table.id,
          },
        })
      }
      return { id: guest.id, ...record }
    },
  },

  vendors: {
    key: 'vendors',
    name: 'Vendors',
    description: 'Vendor directory with contact, contract status, payment tracking.',
    version: '1.0.0',
    fields: vendorsFields,
    rowToRecord: vendorsRowToRecord,
    recordToRow: vendorsRecordToRow,
    validateRow: vendorsValidateRow,
    uniqueKey: 'vendorName',
    fetchExisting: async (weddingId: string) => {
      return db.vendor.findMany({ where: { weddingId }, orderBy: { name: 'asc' } })
    },
    upsert: async (weddingId, record, existing) => {
      if (existing) {
        return db.vendor.update({ where: { id: existing.id }, data: { ...record, _importMeta: undefined, weddingId } })
      }
      return db.vendor.create({ data: { ...record, _importMeta: undefined, weddingId } })
    },
  },

  timeline: {
    key: 'timeline',
    name: 'Timeline',
    description: 'Day-of programme with times, locations, responsibility, and visibility.',
    version: '1.0.0',
    fields: timelineFields,
    rowToRecord: timelineRowToRecord,
    recordToRow: timelineRecordToRow,
    validateRow: timelineValidateRow,
    uniqueKey: 'activity',
    fetchExisting: async (weddingId: string) => {
      return db.programmeItem.findMany({ where: { weddingId }, orderBy: { order: 'asc' } })
    },
    upsert: async (weddingId, record, existing) => {
      if (existing) {
        return db.programmeItem.update({ where: { id: existing.id }, data: { ...record, _importMeta: undefined, weddingId } })
      }
      return db.programmeItem.create({ data: { ...record, _importMeta: undefined, weddingId } })
    },
  },

  songs: {
    key: 'songs',
    name: 'Songs',
    description: 'Music list with moments, priority, approval, do-not-play flags.',
    version: '1.0.0',
    fields: songsFields,
    rowToRecord: songsRowToRecord,
    recordToRow: songsRecordToRow,
    validateRow: songsValidateRow,
    uniqueKey: 'title',
    fetchExisting: async (weddingId: string) => {
      return db.song.findMany({ where: { weddingId }, orderBy: { order: 'asc' } })
    },
    upsert: async (weddingId, record, existing) => {
      if (existing) {
        return db.song.update({ where: { id: existing.id }, data: { ...record, _importMeta: undefined, weddingId } })
      }
      return db.song.create({ data: { ...record, _importMeta: undefined, weddingId } })
    },
  },

  'wedding-party': {
    key: 'wedding-party',
    name: 'Wedding Party',
    description: 'Bridal party members with role, side, bio, photo, display order.',
    version: '1.0.0',
    fields: weddingPartyFields,
    rowToRecord: weddingPartyRowToRecord,
    recordToRow: weddingPartyRecordToRow,
    validateRow: weddingPartyValidateRow,
    uniqueKey: 'name',
    fetchExisting: async (weddingId: string) => {
      return db.guest.findMany({
        where: { weddingId, role: 'bridal_party' },
        orderBy: { name: 'asc' },
      })
    },
    upsert: async (weddingId, record, existing) => {
      if (existing) {
        return db.guest.update({ where: { id: existing.id }, data: { ...record, _importMeta: undefined, weddingId } })
      }
      return db.guest.create({ data: { ...record, _importMeta: undefined, weddingId } })
    },
  },

  travel: {
    key: 'travel',
    name: 'Travel & Accommodation',
    description: 'Guest travel logistics — flights, hotels, airport pickup, shuttle needs.',
    version: '1.0.0',
    fields: travelFields,
    rowToRecord: travelRowToRecord,
    recordToRow: travelRecordToRow,
    validateRow: travelValidateRow,
    uniqueKey: 'guestName',
    fetchExisting: async (weddingId: string) => {
      // Travel records are stored as Guest rows whose roleDetail starts with "Travel:"
      return db.guest.findMany({
        where: { weddingId, roleDetail: { startsWith: 'Travel:' } },
        orderBy: { name: 'asc' },
      })
    },
    upsert: async (weddingId, record, existing) => {
      if (existing) {
        return db.guest.update({ where: { id: existing.id }, data: { ...record, _importMeta: undefined, weddingId } })
      }
      // For travel: if a guest with the same name already exists, attach travel meta
      const byName = await db.guest.findFirst({ where: { weddingId, name: record.name } })
      if (byName) {
        return db.guest.update({
          where: { id: byName.id },
          data: { ...record, _importMeta: undefined, weddingId, id: undefined },
        })
      }
      return db.guest.create({ data: { ...record, _importMeta: undefined, weddingId } })
    },
  },

  media: {
    key: 'media',
    name: 'Media Manifest',
    description: 'Photo/video manifest with cloud URLs, captions, photographer credit, approval.',
    version: '1.0.0',
    fields: mediaFields,
    rowToRecord: mediaRowToRecord,
    recordToRow: mediaRecordToRow,
    validateRow: mediaValidateRow,
    uniqueKey: 'fileName',
    fetchExisting: async (weddingId: string) => {
      return db.mediaItem.findMany({ where: { weddingId }, orderBy: { uploadedAt: 'desc' } })
    },
    upsert: async (weddingId, record, existing) => {
      if (existing) {
        return db.mediaItem.update({ where: { id: existing.id }, data: { ...record, _importMeta: undefined, weddingId } })
      }
      return db.mediaItem.create({ data: { ...record, _importMeta: undefined, weddingId } })
    },
  },
}

/** List of all 10 module keys — useful for the UI to iterate. */
export const MODULE_KEYS = Object.keys(MODULE_SCHEMAS) as Array<keyof typeof MODULE_SCHEMAS>

/** Safe accessor — throws a helpful error for unknown module keys. */
export function getModuleSchema(key: string): ModuleSchema {
  const s = MODULE_SCHEMAS[key]
  if (!s) {
    throw new Error(`Unknown module key "${key}". Valid: ${MODULE_KEYS.join(', ')}`)
  }
  return s
}

/** Check whether a module key is known. */
export function isModuleKey(key: string): boolean {
  return key in MODULE_SCHEMAS
}
