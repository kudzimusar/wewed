import { db } from '@/lib/db'
import { normalizePlannerTitle, plannerTitleError } from '@/lib/planner-task-validation'
import { syncVendorPipelineFromNormalizedVendor } from '@/lib/planner-vendor-pipeline-sync'
import type {
  ExistingRecordMatch,
  FieldDefinition,
  ImportExecutionContext,
  ModuleKey,
  ModuleSchema,
} from './types'

const TASK_CATEGORIES = [
  'timeline_12_18', 'timeline_9_12', 'timeline_6_9', 'timeline_3_6',
  'timeline_2mo', 'timeline_1mo', 'timeline_2wk', 'timeline_1wk',
  'wedding_day', 'spiritual', 'venue', 'catering', 'attire', 'roora',
  'magumo', 'transport', 'stationery', 'decor', 'photo_video', 'music', 'other',
]
const TASK_STATUSES = ['todo', 'in_progress', 'done', 'blocked']
const TASK_PRIORITIES = ['low', 'medium', 'high']
const BUDGET_CATEGORIES = [
  'venue', 'catering', 'attire', 'roora', 'decor', 'photo_video',
  'music', 'transport', 'stationery', 'miscellaneous',
]
const VENDOR_CATEGORIES = [
  'venue', 'caterer', 'photographer', 'videographer', 'florist',
  'dj', 'decor', 'transport', 'stationery', 'other',
]
const VENDOR_CONTRACT_STATUSES = ['signed', 'pending', 'negotiating', 'declined']
const VENDOR_PAYMENT_STATUSES = ['paid', 'deposit', 'unpaid']
const TRUE_VALUES = new Set(['yes', 'y', 'true', '1', 'x', '✓'])
const FALSE_VALUES = new Set(['no', 'n', 'false', '0'])

function clean(value: unknown): string {
  if (value == null) return ''
  return String(value).replace(/\u0000/g, '').replace(/\r/g, '').trim()
}

function norm(value: unknown): string {
  return clean(value).replace(/\s+/g, ' ').toLowerCase()
}

function optionalString(value: unknown): string | undefined {
  const result = clean(value)
  return result || undefined
}

function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>
}

function parseNumber(value: unknown): number | null {
  const source = clean(value)
  if (!source) return null
  const normalized = source
    .replace(/[$€£¥₹\s]/g, '')
    .replace(/,/g, '')
    .replace(/[A-Za-z]{3,6}$/g, '')
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseInteger(value: unknown): number | null {
  const parsed = parseNumber(value)
  return parsed != null && Number.isInteger(parsed) ? parsed : null
}

function parseDate(value: unknown): Date | null {
  const source = clean(value)
  if (!source) return null
  const iso = source.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    const year = Number(iso[1])
    const month = Number(iso[2])
    const day = Number(iso[3])
    const parsed = new Date(Date.UTC(year, month - 1, day))
    if (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    ) return parsed
    return null
  }
  const international = source.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/)
  if (international) {
    const day = Number(international[1])
    const month = Number(international[2])
    const year = Number(international[3])
    const parsed = new Date(Date.UTC(year, month - 1, day))
    if (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    ) return parsed
    return null
  }
  const parsed = new Date(source)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDate(value: unknown): string {
  if (!value) return ''
  const parsed = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10)
}

function formatNumber(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function parseBoolean(value: unknown): boolean | null {
  const normalized = norm(value)
  if (!normalized) return null
  if (TRUE_VALUES.has(normalized)) return true
  if (FALSE_VALUES.has(normalized)) return false
  return null
}

function formatBoolean(value: unknown): string {
  return value === true ? 'Yes' : value === false ? 'No' : ''
}

function idOrFallbackIdentity(id: unknown, label: string, fallback: unknown): string | null {
  const normalizedId = clean(id)
  if (normalizedId) return `id:${normalizedId}`
  const normalizedFallback = norm(fallback)
  return normalizedFallback ? `${label}:${normalizedFallback}` : null
}

function matchByIdOrUnique(
  row: Record<string, string>,
  existing: any[],
  options: {
    idKey: string
    label: string
    fallback: (record: any) => string
    rowFallback: () => string
  },
): ExistingRecordMatch {
  const id = clean(row[options.idKey])
  if (id) {
    const record = existing.find((candidate) => candidate.id === id)
    return record
      ? { record }
      : { error: `${options.label} ID "${id}" was not found in the active wedding.` }
  }
  const expected = norm(options.rowFallback())
  if (!expected) return {}
  const matches = existing.filter((candidate) => norm(options.fallback(candidate)) === expected)
  if (matches.length > 1) {
    return { error: `${options.label} match is ambiguous. Add the internal ID and try again.` }
  }
  return { record: matches[0] }
}

function requireScopedMutation(count: number, label: string): void {
  if (count !== 1) throw new Error(`${label} was not found in the active wedding.`)
}

function restoreDate(value: unknown): Date | null {
  if (!value) return null
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) throw new Error('Rollback contains an invalid date.')
  return parsed
}

// ---------------------------------------------------------------------------
// Checklist / Tasks
// ---------------------------------------------------------------------------

const taskFields: FieldDefinition[] = [
  { key: 'taskId', label: 'Task ID', required: false, type: 'string', description: 'Internal ID used to update an existing task.' },
  { key: 'task', label: 'Task', required: true, type: 'string', example: 'Confirm venue booking' },
  { key: 'category', label: 'Category', required: true, type: 'enum', allowedValues: TASK_CATEGORIES, example: 'venue' },
  { key: 'description', label: 'Description', required: false, type: 'string' },
  { key: 'assignedPerson', label: 'Assigned Person', required: false, type: 'string', example: 'Charity' },
  { key: 'dueDate', label: 'Due Date', required: false, type: 'date', example: '2026-10-01' },
  { key: 'priority', label: 'Priority', required: false, type: 'enum', allowedValues: TASK_PRIORITIES, example: 'high' },
  { key: 'status', label: 'Status', required: false, type: 'enum', allowedValues: TASK_STATUSES, example: 'todo' },
  { key: 'order', label: 'Order', required: false, type: 'number', example: '48', description: 'Display order. Leave blank to append a new task.' },
]

function taskRowToRecord(row: Record<string, string>): any {
  return {
    title: normalizePlannerTitle(row.task),
    category: clean(row.category),
    description: optionalString(row.description),
    assignee: optionalString(row.assignedPerson),
    dueDate: clean(row.dueDate) ? parseDate(row.dueDate) : undefined,
    priority: optionalString(row.priority),
    status: optionalString(row.status),
    order: clean(row.order) ? parseInteger(row.order) : undefined,
  }
}

function taskRecordToRow(record: any): Record<string, string> {
  return {
    taskId: record.id || '',
    task: record.title || '',
    category: record.category || '',
    description: record.description || '',
    assignedPerson: record.assignee || '',
    dueDate: formatDate(record.dueDate),
    priority: record.priority || 'medium',
    status: record.status || 'todo',
    order: formatNumber(record.order),
  }
}

function taskValidate(row: Record<string, string>): string[] {
  const errors: string[] = []
  const titleError = plannerTitleError(row.task)
  if (titleError) errors.push(titleError)
  if (!TASK_CATEGORIES.includes(clean(row.category))) errors.push(`Category must be one of: ${TASK_CATEGORIES.join(', ')}`)
  if (clean(row.priority) && !TASK_PRIORITIES.includes(clean(row.priority))) errors.push(`Priority must be one of: ${TASK_PRIORITIES.join(', ')}`)
  if (clean(row.status) && !TASK_STATUSES.includes(clean(row.status))) errors.push(`Status must be one of: ${TASK_STATUSES.join(', ')}`)
  if (clean(row.dueDate) && !parseDate(row.dueDate)) errors.push('Due Date is not a valid date.')
  const order = clean(row.order) ? parseInteger(row.order) : null
  if (clean(row.order) && (order == null || order < 0)) errors.push('Order must be a whole number of zero or greater.')
  return errors
}

const checklistSchema: ModuleSchema = {
  key: 'checklist',
  name: 'Checklist',
  description: 'Planning tasks aligned with the planner Tasks workspace.',
  version: '1.1.0',
  fields: taskFields,
  rowToRecord: taskRowToRecord,
  recordToRow: taskRecordToRow,
  validateRow: taskValidate,
  rowIdentity: (row) => idOrFallbackIdentity(row.taskId, 'task', row.task),
  matchExisting: (row, existing) => matchByIdOrUnique(row, existing, {
    idKey: 'taskId', label: 'Task', fallback: (record) => record.title, rowFallback: () => row.task,
  }),
  fetchExisting: (weddingId) => db.plannerTask.findMany({
    where: { weddingId }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  }),
  upsert: async (weddingId, record, existing, context) => {
    const client = context?.db ?? db
    if (existing) {
      return client.plannerTask.update({ where: { id: existing.id }, data: compact(record) })
    }
    let order = record.order
    if (order === undefined) {
      const last = await client.plannerTask.findFirst({
        where: { weddingId }, orderBy: { order: 'desc' }, select: { order: true },
      })
      order = (last?.order ?? 0) + 1
    }
    return client.plannerTask.create({
      data: {
        weddingId,
        title: record.title,
        category: record.category,
        description: record.description ?? null,
        assignee: record.assignee ?? null,
        dueDate: record.dueDate ?? null,
        priority: record.priority ?? 'medium',
        status: record.status ?? 'todo',
        order,
      },
    })
  },
  captureRollbackSnapshot: async (_weddingId, existing) => ({ record: { ...existing } }),
  deleteCreated: async (weddingId, id, context) => {
    const client = context?.db ?? db
    const result = await client.plannerTask.deleteMany({ where: { id, weddingId } })
    requireScopedMutation(result.count, 'Created task')
  },
  restoreUpdated: async (weddingId, id, snapshot, context) => {
    const client = context?.db ?? db
    const record = snapshot.record
    const result = await client.plannerTask.updateMany({
      where: { id, weddingId },
      data: {
        title: record.title,
        description: record.description,
        category: record.category,
        status: record.status,
        priority: record.priority,
        dueDate: restoreDate(record.dueDate),
        assignee: record.assignee,
        assigneeUserId: record.assigneeUserId,
        order: record.order,
      },
    })
    requireScopedMutation(result.count, 'Task rollback target')
  },
}

// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------

const vendorFields: FieldDefinition[] = [
  { key: 'vendorId', label: 'Vendor ID', required: false, type: 'string', description: 'Internal ID used to update an existing vendor.' },
  { key: 'vendorName', label: 'Vendor Name', required: true, type: 'string', example: 'Imba Manor' },
  { key: 'category', label: 'Category', required: true, type: 'enum', allowedValues: VENDOR_CATEGORIES, example: 'venue' },
  { key: 'description', label: 'Description', required: false, type: 'string' },
  { key: 'contact', label: 'Contact', required: false, type: 'string', example: 'Tariro Banda' },
  { key: 'phone', label: 'Phone', required: false, type: 'phone', sensitive: true, example: '+263 77 123 4567' },
  { key: 'website', label: 'Website', required: false, type: 'string', example: 'https://imbamanor.co.zw' },
  { key: 'contractStatus', label: 'Contract Status', required: false, type: 'enum', allowedValues: VENDOR_CONTRACT_STATUSES, example: 'signed' },
  { key: 'paymentStatus', label: 'Payment Status', required: false, type: 'enum', allowedValues: VENDOR_PAYMENT_STATUSES, example: 'deposit' },
  { key: 'rating', label: 'Rating', required: false, type: 'number', example: '4.5', description: 'Planning rating from 0 to 5.' },
  { key: 'notes', label: 'Notes', required: false, type: 'string' },
  { key: 'featured', label: 'Featured', required: false, type: 'boolean', example: 'No' },
]

function vendorRowToRecord(row: Record<string, string>): any {
  return {
    name: clean(row.vendorName),
    category: clean(row.category),
    description: optionalString(row.description),
    contact: optionalString(row.contact),
    phone: optionalString(row.phone),
    website: optionalString(row.website),
    contractStatus: optionalString(row.contractStatus),
    paymentStatus: optionalString(row.paymentStatus),
    planningRating: clean(row.rating) ? parseNumber(row.rating) : undefined,
    rating: clean(row.rating) ? parseNumber(row.rating) : undefined,
    notes: optionalString(row.notes),
    featured: clean(row.featured) ? parseBoolean(row.featured) : undefined,
  }
}

function vendorRecordToRow(record: any): Record<string, string> {
  return {
    vendorId: record.id || '',
    vendorName: record.name || '',
    category: record.category || '',
    description: record.description || '',
    contact: record.contact || '',
    phone: record.phone || '',
    website: record.website || '',
    contractStatus: record.contractStatus || 'pending',
    paymentStatus: record.paymentStatus || 'unpaid',
    rating: formatNumber(record.planningRating ?? record.rating),
    notes: record.notes || '',
    featured: formatBoolean(record.featured),
  }
}

function vendorValidate(row: Record<string, string>): string[] {
  const errors: string[] = []
  if (!clean(row.vendorName)) errors.push('Vendor Name is required.')
  if (!VENDOR_CATEGORIES.includes(clean(row.category))) errors.push(`Category must be one of: ${VENDOR_CATEGORIES.join(', ')}`)
  if (clean(row.contractStatus) && !VENDOR_CONTRACT_STATUSES.includes(clean(row.contractStatus))) errors.push(`Contract Status must be one of: ${VENDOR_CONTRACT_STATUSES.join(', ')}`)
  if (clean(row.paymentStatus) && !VENDOR_PAYMENT_STATUSES.includes(clean(row.paymentStatus))) errors.push(`Payment Status must be one of: ${VENDOR_PAYMENT_STATUSES.join(', ')}`)
  const rating = clean(row.rating) ? parseNumber(row.rating) : null
  if (clean(row.rating) && (rating == null || rating < 0 || rating > 5)) errors.push('Rating must be between 0 and 5.')
  if (clean(row.featured) && parseBoolean(row.featured) == null) errors.push('Featured must be Yes or No.')
  return errors
}

const vendorsSchema: ModuleSchema = {
  key: 'vendors',
  name: 'Vendors',
  description: 'Vendor records aligned with the planner Vendors workspace and pipeline.',
  version: '1.1.0',
  fields: vendorFields,
  rowToRecord: vendorRowToRecord,
  recordToRow: vendorRecordToRow,
  validateRow: vendorValidate,
  rowIdentity: (row) => idOrFallbackIdentity(row.vendorId, 'vendor', row.vendorName),
  matchExisting: (row, existing) => matchByIdOrUnique(row, existing, {
    idKey: 'vendorId', label: 'Vendor', fallback: (record) => record.name, rowFallback: () => row.vendorName,
  }),
  fetchExisting: (weddingId) => db.vendor.findMany({ where: { weddingId }, orderBy: { name: 'asc' } }),
  upsert: async (weddingId, record, existing, context) => {
    const client = context?.db ?? db
    const data = compact(record)
    const vendor = existing
      ? await client.vendor.update({ where: { id: existing.id }, data })
      : await client.vendor.create({
          data: {
            weddingId,
            name: record.name,
            category: record.category,
            description: record.description ?? null,
            contact: record.contact ?? null,
            phone: record.phone ?? null,
            website: record.website ?? null,
            imageUrl: null,
            rating: record.rating ?? null,
            planningRating: record.planningRating ?? null,
            featured: record.featured ?? false,
            contractStatus: record.contractStatus ?? 'pending',
            paymentStatus: record.paymentStatus ?? 'unpaid',
            notes: record.notes ?? null,
          },
        })
    if (context?.actorId) {
      await syncVendorPipelineFromNormalizedVendor({
        weddingId,
        actorId: context.actorId,
        vendor,
        contractStatusChanged: record.contractStatus !== undefined,
        paymentStatusChanged: record.paymentStatus !== undefined,
      }, client)
    }
    return vendor
  },
  captureRollbackSnapshot: async (weddingId, existing) => {
    const pipeline = await db.contentRevision.findFirst({
      where: { weddingId, section: 'planner_vendor_pipeline', fieldKey: existing.id },
    })
    return { record: { ...existing }, pipeline: pipeline ? { ...pipeline } : null }
  },
  deleteCreated: async (weddingId, id, context) => {
    const client = context?.db ?? db
    await client.contentRevision.deleteMany({
      where: { weddingId, section: 'planner_vendor_pipeline', fieldKey: id },
    })
    const result = await client.vendor.deleteMany({ where: { id, weddingId } })
    requireScopedMutation(result.count, 'Created vendor')
  },
  restoreUpdated: async (weddingId, id, snapshot, context) => {
    const client = context?.db ?? db
    const record = snapshot.record
    const restored = await client.vendor.updateMany({
      where: { id, weddingId },
      data: {
        name: record.name,
        category: record.category,
        description: record.description,
        website: record.website,
        phone: record.phone,
        imageUrl: record.imageUrl,
        rating: record.rating,
        featured: record.featured,
        contact: record.contact,
        contractStatus: record.contractStatus,
        paymentStatus: record.paymentStatus,
        planningRating: record.planningRating,
        notes: record.notes,
      },
    })
    requireScopedMutation(restored.count, 'Vendor rollback target')
    const current = await client.contentRevision.findFirst({
      where: { weddingId, section: 'planner_vendor_pipeline', fieldKey: id },
    })
    if (!snapshot.pipeline) {
      await client.contentRevision.deleteMany({
        where: { weddingId, section: 'planner_vendor_pipeline', fieldKey: id },
      })
    } else {
      const previous = snapshot.pipeline
      const data = {
        section: previous.section,
        fieldKey: previous.fieldKey,
        value: previous.value,
        status: previous.status,
        previousValue: previous.previousValue,
        authorId: previous.authorId,
        publishedAt: previous.publishedAt ? restoreDate(previous.publishedAt) : null,
        scheduledFor: previous.scheduledFor ? restoreDate(previous.scheduledFor) : null,
      }
      if (current) await client.contentRevision.update({ where: { id: current.id }, data })
      else await client.contentRevision.create({ data: { ...data, id: previous.id, weddingId } })
    }
  },
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

const budgetFields: FieldDefinition[] = [
  { key: 'budgetItemId', label: 'Budget Item ID', required: false, type: 'string', description: 'Internal ID used to update an existing budget item.' },
  { key: 'category', label: 'Category', required: true, type: 'enum', allowedValues: BUDGET_CATEGORIES, example: 'venue' },
  { key: 'description', label: 'Description', required: true, type: 'string', example: 'Imba Manor venue hire' },
  { key: 'estimatedCost', label: 'Estimated Cost', required: true, type: 'currency', example: '5000' },
  { key: 'actualCost', label: 'Actual Cost', required: false, type: 'currency', example: '4800' },
  { key: 'paidAmount', label: 'Paid Amount', required: false, type: 'currency', example: '1500' },
  { key: 'currency', label: 'Currency', required: false, type: 'string', example: 'USD' },
  { key: 'vendorId', label: 'Vendor ID', required: false, type: 'string', description: 'Optional active-wedding Vendor ID.' },
  { key: 'vendor', label: 'Vendor', required: false, type: 'string', example: 'Imba Manor' },
  { key: 'notes', label: 'Notes', required: false, type: 'string' },
  { key: 'dueDate', label: 'Due Date', required: false, type: 'date', example: '2026-12-01' },
]

function budgetRowToRecord(row: Record<string, string>): any {
  return {
    category: clean(row.category),
    description: clean(row.description),
    estimatedCost: parseNumber(row.estimatedCost),
    actualCost: clean(row.actualCost) ? parseNumber(row.actualCost) : undefined,
    paidAmount: clean(row.paidAmount) ? parseNumber(row.paidAmount) : undefined,
    currency: optionalString(row.currency)?.toUpperCase(),
    vendorId: optionalString(row.vendorId),
    vendorName: optionalString(row.vendor),
    notes: optionalString(row.notes),
    dueDate: clean(row.dueDate) ? parseDate(row.dueDate) : undefined,
  }
}

function budgetRecordToRow(record: any): Record<string, string> {
  return {
    budgetItemId: record.id || '',
    category: record.category || '',
    description: record.description || '',
    estimatedCost: formatNumber(record.estimatedCost),
    actualCost: formatNumber(record.actualCost),
    paidAmount: formatNumber(record.paidAmount),
    currency: record.currency || 'USD',
    vendorId: record.vendorId || '',
    vendor: record.vendorName || record._resolvedVendorName || '',
    notes: record.notes || '',
    dueDate: formatDate(record.dueDate),
  }
}

function budgetValidate(row: Record<string, string>): string[] {
  const errors: string[] = []
  if (!BUDGET_CATEGORIES.includes(clean(row.category))) errors.push(`Category must be one of: ${BUDGET_CATEGORIES.join(', ')}`)
  if (!clean(row.description)) errors.push('Description is required.')
  for (const [key, label, required] of [
    ['estimatedCost', 'Estimated Cost', true],
    ['actualCost', 'Actual Cost', false],
    ['paidAmount', 'Paid Amount', false],
  ] as const) {
    const value = clean(row[key])
    if (required && !value) errors.push(`${label} is required.`)
    if (value) {
      const amount = parseNumber(value)
      if (amount == null || amount < 0) errors.push(`${label} must be zero or a positive number.`)
    }
  }
  if (clean(row.currency) && !/^[A-Za-z]{3,6}$/.test(clean(row.currency))) errors.push('Currency must be a 3–6 letter code.')
  if (clean(row.dueDate) && !parseDate(row.dueDate)) errors.push('Due Date is not a valid date.')
  return errors
}

async function budgetReferenceErrors(row: Record<string, string>, weddingId: string): Promise<string[]> {
  const errors: string[] = []
  const vendorId = clean(row.vendorId)
  const vendorName = norm(row.vendor)
  if (vendorId) {
    const vendor = await db.vendor.findFirst({ where: { id: vendorId, weddingId } })
    if (!vendor) errors.push(`Vendor ID "${vendorId}" was not found in the active wedding.`)
    else if (vendorName && norm(vendor.name) !== vendorName) errors.push('Vendor ID and Vendor name refer to different records.')
  } else if (vendorName) {
    const vendors = await db.vendor.findMany({ where: { weddingId } })
    if (vendors.filter((vendor) => norm(vendor.name) === vendorName).length > 1) {
      errors.push('Vendor name is ambiguous. Add the Vendor ID and try again.')
    }
  }
  return errors
}

const budgetSchema: ModuleSchema = {
  key: 'budget',
  name: 'Budget',
  description: 'Budget items aligned with the planner Budget workspace.',
  version: '1.1.0',
  fields: budgetFields,
  rowToRecord: budgetRowToRecord,
  recordToRow: budgetRecordToRow,
  validateRow: budgetValidate,
  validateReferences: budgetReferenceErrors,
  rowIdentity: (row) => idOrFallbackIdentity(row.budgetItemId, 'budget', row.description),
  matchExisting: (row, existing) => matchByIdOrUnique(row, existing, {
    idKey: 'budgetItemId', label: 'Budget item', fallback: (record) => record.description, rowFallback: () => row.description,
  }),
  fetchExisting: async (weddingId) => {
    const items = await db.budgetItem.findMany({
      where: { weddingId }, orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
    })
    const vendorIds = [...new Set(items.map((item) => item.vendorId).filter((id): id is string => Boolean(id)))]
    const vendors = vendorIds.length
      ? await db.vendor.findMany({ where: { weddingId, id: { in: vendorIds } } })
      : []
    const names = new Map(vendors.map((vendor) => [vendor.id, vendor.name]))
    return items.map((item) => ({ ...item, _resolvedVendorName: item.vendorId ? names.get(item.vendorId) : '' }))
  },
  upsert: async (weddingId, record, existing, context) => {
    const client = context?.db ?? db
    const data: Record<string, unknown> = compact({
      category: record.category,
      description: record.description,
      estimatedCost: record.estimatedCost,
      actualCost: record.actualCost,
      paidAmount: record.paidAmount,
      currency: record.currency,
      notes: record.notes,
      dueDate: record.dueDate,
    })
    if (record.vendorId !== undefined) {
      const vendor = await client.vendor.findFirst({ where: { id: record.vendorId, weddingId } })
      if (!vendor) throw new Error('Vendor does not belong to the active wedding.')
      data.vendorId = vendor.id
      data.vendorName = record.vendorName ?? vendor.name
    } else if (record.vendorName !== undefined) {
      const vendors = await client.vendor.findMany({ where: { weddingId } })
      const matches = vendors.filter((vendor: any) => norm(vendor.name) === norm(record.vendorName))
      if (matches.length > 1) throw new Error('Vendor name is ambiguous. Add the Vendor ID.')
      data.vendorId = matches[0]?.id ?? null
      data.vendorName = matches[0]?.name ?? record.vendorName
    }
    if (existing) return client.budgetItem.update({ where: { id: existing.id }, data })
    return client.budgetItem.create({
      data: {
        weddingId,
        category: record.category,
        description: record.description,
        estimatedCost: record.estimatedCost,
        actualCost: record.actualCost ?? null,
        paidAmount: record.paidAmount ?? 0,
        currency: record.currency ?? 'USD',
        vendorId: (data.vendorId as string | null | undefined) ?? null,
        vendorName: (data.vendorName as string | null | undefined) ?? null,
        notes: record.notes ?? null,
        dueDate: record.dueDate ?? null,
      },
    })
  },
  captureRollbackSnapshot: async (_weddingId, existing) => ({ record: { ...existing, _resolvedVendorName: undefined } }),
  deleteCreated: async (weddingId, id, context) => {
    const client = context?.db ?? db
    const result = await client.budgetItem.deleteMany({ where: { id, weddingId } })
    requireScopedMutation(result.count, 'Created budget item')
  },
  restoreUpdated: async (weddingId, id, snapshot, context) => {
    const client = context?.db ?? db
    const record = snapshot.record
    const result = await client.budgetItem.updateMany({
      where: { id, weddingId },
      data: {
        category: record.category,
        description: record.description,
        estimatedCost: record.estimatedCost,
        actualCost: record.actualCost,
        paidAmount: record.paidAmount,
        currency: record.currency,
        vendorId: record.vendorId,
        vendorName: record.vendorName,
        notes: record.notes,
        dueDate: restoreDate(record.dueDate),
      },
    })
    requireScopedMutation(result.count, 'Budget rollback target')
  },
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

const timelineFields: FieldDefinition[] = [
  { key: 'timelineItemId', label: 'Timeline Item ID', required: false, type: 'string', description: 'Internal ID used to update an existing timeline item.' },
  { key: 'time', label: 'Time', required: true, type: 'string', example: '14:00' },
  { key: 'activity', label: 'Activity', required: true, type: 'string', example: 'Guest arrival' },
  { key: 'description', label: 'Description', required: false, type: 'string' },
  { key: 'duration', label: 'Duration', required: false, type: 'string', example: '30 minutes' },
  { key: 'location', label: 'Location', required: false, type: 'string', example: 'Main Lawn' },
  { key: 'icon', label: 'Icon', required: false, type: 'string', example: 'rings' },
  { key: 'order', label: 'Order', required: false, type: 'number', example: '13', description: 'Display order. Leave blank to append a new item.' },
]

function timelineRowToRecord(row: Record<string, string>): any {
  const icon = optionalString(row.icon)
  return {
    time: clean(row.time),
    title: clean(row.activity),
    description: optionalString(row.description),
    duration: optionalString(row.duration),
    location: optionalString(row.location),
    icon,
    displayIcon: icon,
    order: clean(row.order) ? parseInteger(row.order) : undefined,
  }
}

function timelineRecordToRow(record: any): Record<string, string> {
  return {
    timelineItemId: record.id || '',
    time: record.time || '',
    activity: record.title || '',
    description: record.description || '',
    duration: record.duration || '',
    location: record.location || '',
    icon: record.displayIcon || record.icon || '',
    order: formatNumber(record.order),
  }
}

function timelineValidate(row: Record<string, string>): string[] {
  const errors: string[] = []
  if (!clean(row.time)) errors.push('Time is required.')
  if (!clean(row.activity)) errors.push('Activity is required.')
  const order = clean(row.order) ? parseInteger(row.order) : null
  if (clean(row.order) && (order == null || order < 0)) errors.push('Order must be a whole number of zero or greater.')
  return errors
}

const timelineSchema: ModuleSchema = {
  key: 'timeline',
  name: 'Timeline',
  description: 'Timeline items aligned with the planner Timeline workspace.',
  version: '1.1.0',
  fields: timelineFields,
  rowToRecord: timelineRowToRecord,
  recordToRow: timelineRecordToRow,
  validateRow: timelineValidate,
  rowIdentity: (row) => {
    const id = clean(row.timelineItemId)
    if (id) return `id:${id}`
    const key = `${norm(row.time)}|${norm(row.activity)}`
    return key === '|' ? null : `timeline:${key}`
  },
  matchExisting: (row, existing) => {
    const id = clean(row.timelineItemId)
    if (id) {
      const record = existing.find((candidate) => candidate.id === id)
      return record ? { record } : { error: `Timeline Item ID "${id}" was not found in the active wedding.` }
    }
    const time = norm(row.time)
    const title = norm(row.activity)
    const matches = existing.filter((record) => norm(record.time) === time && norm(record.title) === title)
    if (matches.length > 1) return { error: 'Timeline match is ambiguous. Add the Timeline Item ID and try again.' }
    return { record: matches[0] }
  },
  fetchExisting: (weddingId) => db.programmeItem.findMany({
    where: { weddingId }, orderBy: [{ order: 'asc' }, { time: 'asc' }, { createdAt: 'asc' }],
  }),
  upsert: async (weddingId, record, existing, context) => {
    const client = context?.db ?? db
    if (existing) return client.programmeItem.update({ where: { id: existing.id }, data: compact(record) })
    let order = record.order
    if (order === undefined) {
      const last = await client.programmeItem.findFirst({
        where: { weddingId }, orderBy: { order: 'desc' }, select: { order: true },
      })
      order = (last?.order ?? 0) + 1
    }
    return client.programmeItem.create({
      data: {
        weddingId,
        time: record.time,
        title: record.title,
        description: record.description ?? null,
        duration: record.duration ?? null,
        location: record.location ?? null,
        icon: record.icon ?? null,
        displayIcon: record.displayIcon ?? null,
        order,
      },
    })
  },
  captureRollbackSnapshot: async (_weddingId, existing) => ({ record: { ...existing } }),
  deleteCreated: async (weddingId, id, context) => {
    const client = context?.db ?? db
    const result = await client.programmeItem.deleteMany({ where: { id, weddingId } })
    requireScopedMutation(result.count, 'Created timeline item')
  },
  restoreUpdated: async (weddingId, id, snapshot, context) => {
    const client = context?.db ?? db
    const record = snapshot.record
    const result = await client.programmeItem.updateMany({
      where: { id, weddingId },
      data: {
        time: record.time,
        title: record.title,
        description: record.description,
        icon: record.icon,
        duration: record.duration,
        location: record.location,
        displayIcon: record.displayIcon,
        order: record.order,
      },
    })
    requireScopedMutation(result.count, 'Timeline rollback target')
  },
}

// ---------------------------------------------------------------------------
// Seating
// ---------------------------------------------------------------------------

const seatingFields: FieldDefinition[] = [
  { key: 'guestId', label: 'Guest ID', required: false, type: 'string', description: 'Existing active-wedding Guest ID.' },
  { key: 'guestName', label: 'Guest Name', required: true, type: 'string', example: 'Tendai Moyo' },
  { key: 'tableId', label: 'Table ID', required: false, type: 'string', description: 'Existing active-wedding Table ID. Leave blank to match/create by name.' },
  { key: 'tableName', label: 'Table Name', required: true, type: 'string', example: 'Family Table 1' },
  { key: 'tableCapacity', label: 'Table Capacity', required: false, type: 'number', example: '8' },
]

function seatingRowToRecord(row: Record<string, string>): any {
  return {
    guestId: optionalString(row.guestId),
    guestName: clean(row.guestName),
    tableId: optionalString(row.tableId),
    tableName: clean(row.tableName),
    tableCapacity: clean(row.tableCapacity) ? parseInteger(row.tableCapacity) : undefined,
  }
}

function seatingRecordToRow(record: any): Record<string, string> {
  return {
    guestId: record.id || '',
    guestName: record.name || '',
    tableId: record.seatingTable?.id || record.seatingTableId || '',
    tableName: record.seatingTable?.name || '',
    tableCapacity: record.seatingTable ? formatNumber(record.seatingTable.capacity) : '',
  }
}

function seatingValidate(row: Record<string, string>): string[] {
  const errors: string[] = []
  if (!clean(row.guestName)) errors.push('Guest Name is required.')
  if (!clean(row.tableName)) errors.push('Table Name is required.')
  if (clean(row.tableCapacity)) {
    const capacity = parseInteger(row.tableCapacity)
    if (capacity == null || capacity < 1 || capacity > 50) errors.push('Table Capacity must be a whole number from 1 to 50.')
  }
  return errors
}

function plannedSeats(guest: any): number {
  return 1 + (guest.rsvp?.plusOne ? 1 : 0) + (guest.rsvp?.kidsAttending ? guest.rsvp.kidsCount : 0)
}

async function resolveSeatingGuest(row: Record<string, string>, weddingId: string): Promise<any | null> {
  const guestId = clean(row.guestId)
  if (guestId) return db.guest.findFirst({ where: { id: guestId, weddingId }, include: { rsvp: true, seatingTable: true } })
  const guests = await db.guest.findMany({ where: { weddingId }, include: { rsvp: true, seatingTable: true } })
  const matches = guests.filter((guest) => norm(guest.name) === norm(row.guestName))
  return matches.length === 1 ? matches[0] : null
}

async function seatingReferenceErrors(row: Record<string, string>, weddingId: string): Promise<string[]> {
  const errors: string[] = []
  const guestId = clean(row.guestId)
  const guestName = norm(row.guestName)
  const guests = await db.guest.findMany({ where: { weddingId }, include: { rsvp: true, seatingTable: true } })
  let guest: any | undefined
  if (guestId) {
    guest = guests.find((candidate) => candidate.id === guestId)
    if (!guest) errors.push(`Guest ID "${guestId}" was not found in the active wedding.`)
    else if (guestName && norm(guest.name) !== guestName) errors.push('Guest ID and Guest Name refer to different records.')
  } else {
    const matches = guests.filter((candidate) => norm(candidate.name) === guestName)
    if (matches.length === 0) errors.push('Guest Name was not found in the active wedding. Seating imports do not create Guests.')
    if (matches.length > 1) errors.push('Guest Name is ambiguous. Add the Guest ID and try again.')
    guest = matches[0]
  }

  const tableId = clean(row.tableId)
  const tableName = norm(row.tableName)
  const tables = await db.seatingTable.findMany({ where: { weddingId } })
  let table: any | undefined
  if (tableId) {
    table = tables.find((candidate) => candidate.id === tableId)
    if (!table) errors.push(`Table ID "${tableId}" was not found in the active wedding.`)
    else if (tableName && norm(table.name) !== tableName) errors.push('Table ID and Table Name refer to different records.')
  } else {
    const matches = tables.filter((candidate) => norm(candidate.name) === tableName)
    if (matches.length > 1) errors.push('Table Name is ambiguous. Add the Table ID and try again.')
    table = matches[0]
  }

  if (guest && errors.length === 0) {
    const requestedCapacity = clean(row.tableCapacity) ? parseInteger(row.tableCapacity) : null
    const capacity = requestedCapacity ?? table?.capacity ?? 8
    if (table) {
      const assigned = await db.guest.findMany({
        where: { weddingId, seatingTableId: table.id }, include: { rsvp: true },
      })
      const occupiedWithoutGuest = assigned
        .filter((candidate) => candidate.id !== guest.id)
        .reduce((sum, candidate) => sum + plannedSeats(candidate), 0)
      if (occupiedWithoutGuest + plannedSeats(guest) > capacity) {
        errors.push(`Table capacity ${capacity} cannot accommodate this Guest party.`)
      }
    } else if (plannedSeats(guest) > capacity) {
      errors.push(`Table capacity ${capacity} cannot accommodate this Guest party.`)
    }
  }
  return errors
}

const seatingSchema: ModuleSchema = {
  key: 'seating',
  name: 'Seating',
  description: 'Existing Guest assignments aligned with the planner Seating workspace.',
  version: '1.1.0',
  fields: seatingFields,
  rowToRecord: seatingRowToRecord,
  recordToRow: seatingRecordToRow,
  validateRow: seatingValidate,
  validateReferences: seatingReferenceErrors,
  rowIdentity: (row) => idOrFallbackIdentity(row.guestId, 'guest', row.guestName),
  matchExisting: (row, existing) => {
    const guestId = clean(row.guestId)
    if (guestId) {
      const record = existing.find((candidate) => candidate.id === guestId)
      if (!record) return { error: `Guest ID "${guestId}" was not found in the active wedding.` }
      if (clean(row.guestName) && norm(record.name) !== norm(row.guestName)) return { error: 'Guest ID and Guest Name refer to different records.' }
      return { record }
    }
    const matches = existing.filter((record) => norm(record.name) === norm(row.guestName))
    if (matches.length === 0) return { error: 'Guest Name was not found in the active wedding. Seating imports do not create Guests.' }
    if (matches.length > 1) return { error: 'Guest Name is ambiguous. Add the Guest ID and try again.' }
    return { record: matches[0] }
  },
  fetchExisting: (weddingId) => db.guest.findMany({
    where: { weddingId },
    include: { rsvp: true, seatingTable: true },
    orderBy: { name: 'asc' },
  }),
  upsert: async (weddingId, record, existing, context) => {
    if (!existing) throw new Error('Seating imports require an existing active-wedding Guest.')
    const client = context?.db ?? db
    let table: any | null = null
    if (record.tableId) {
      table = await client.seatingTable.findFirst({ where: { id: record.tableId, weddingId } })
      if (!table) throw new Error('Table does not belong to the active wedding.')
      if (norm(table.name) !== norm(record.tableName)) throw new Error('Table ID and Table Name refer to different records.')
    } else {
      const tables = await client.seatingTable.findMany({ where: { weddingId } })
      const matches = tables.filter((candidate: any) => norm(candidate.name) === norm(record.tableName))
      if (matches.length > 1) throw new Error('Table Name is ambiguous. Add the Table ID.')
      table = matches[0] ?? null
    }

    let targetTableCreated = false
    if (!table) {
      table = await client.seatingTable.create({
        data: { weddingId, name: record.tableName, capacity: record.tableCapacity ?? 8 },
      })
      targetTableCreated = true
    }

    const assigned = await client.guest.findMany({
      where: { weddingId, seatingTableId: table.id }, include: { rsvp: true },
    })
    const occupiedWithoutGuest = assigned
      .filter((candidate: any) => candidate.id !== existing.id)
      .reduce((sum: number, candidate: any) => sum + plannedSeats(candidate), 0)
    const guestWithRsvp = await client.guest.findFirst({
      where: { id: existing.id, weddingId }, include: { rsvp: true },
    })
    if (!guestWithRsvp) throw new Error('Guest does not belong to the active wedding.')
    const capacity = record.tableCapacity ?? table.capacity
    if (occupiedWithoutGuest + plannedSeats(guestWithRsvp) > capacity) {
      throw new Error(`Table capacity ${capacity} cannot accommodate this Guest party.`)
    }
    if (record.tableCapacity !== undefined && record.tableCapacity !== table.capacity) {
      table = await client.seatingTable.update({
        where: { id: table.id }, data: { capacity: record.tableCapacity },
      })
    }
    const guest = await client.guest.update({
      where: { id: existing.id }, data: { seatingTableId: table.id },
    })
    return {
      ...guest,
      id: guest.id,
      __rollbackPatch: { targetTableId: table.id, targetTableCreated },
    }
  },
  captureRollbackSnapshot: async (weddingId, existing, record) => {
    let targetTable: any | null = null
    if (record.tableId) {
      targetTable = await db.seatingTable.findFirst({ where: { id: record.tableId, weddingId } })
    } else {
      const tables = await db.seatingTable.findMany({ where: { weddingId } })
      const matches = tables.filter((candidate) => norm(candidate.name) === norm(record.tableName))
      targetTable = matches.length === 1 ? matches[0] : null
    }
    return {
      guest: {
        id: existing.id,
        weddingId: existing.weddingId,
        seatingTableId: existing.seatingTableId,
        tableNumber: existing.tableNumber,
      },
      targetTable: targetTable ? { ...targetTable } : null,
    }
  },
  restoreUpdated: async (weddingId, id, snapshot, context) => {
    const client = context?.db ?? db
    const guest = await client.guest.updateMany({
      where: { id, weddingId },
      data: {
        seatingTableId: snapshot.guest.seatingTableId,
        tableNumber: snapshot.guest.tableNumber,
      },
    })
    requireScopedMutation(guest.count, 'Seating rollback Guest')
    if (snapshot.targetTable) {
      const table = snapshot.targetTable
      const restored = await client.seatingTable.updateMany({
        where: { id: table.id, weddingId },
        data: { name: table.name, capacity: table.capacity, position: table.position },
      })
      requireScopedMutation(restored.count, 'Seating rollback table')
    } else if (snapshot.targetTableCreated && snapshot.targetTableId) {
      const assigned = await client.guest.count({
        where: { weddingId, seatingTableId: snapshot.targetTableId },
      })
      if (assigned === 0) {
        await client.seatingTable.deleteMany({
          where: { id: snapshot.targetTableId, weddingId },
        })
      }
    }
  },
}

export const PLANNER_WORKSHEET_SCHEMAS: Partial<Record<ModuleKey, ModuleSchema>> = {
  checklist: checklistSchema,
  vendors: vendorsSchema,
  budget: budgetSchema,
  timeline: timelineSchema,
  seating: seatingSchema,
}

export function getPlannerWorksheetSchema(moduleKey: ModuleKey): ModuleSchema | undefined {
  return PLANNER_WORKSHEET_SCHEMAS[moduleKey]
}
