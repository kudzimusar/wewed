import { createHash } from 'node:crypto'

export type IntegrityRecord = Record<string, unknown>

export interface PlannerIntegrityWeddingInput extends IntegrityRecord {
  id: string
  slug: string
  title: string
  plannerTasks?: IntegrityRecord[]
  budgetItems?: IntegrityRecord[]
  vendors?: IntegrityRecord[]
  guests?: IntegrityRecord[]
  programmeItems?: IntegrityRecord[]
  seatingTables?: IntegrityRecord[]
  memberships?: IntegrityRecord[]
  importJobs?: IntegrityRecord[]
  contentRevisions?: IntegrityRecord[]
}

export interface PlannerIntegrityDataset {
  count: number
  hash: string
}

export interface PlannerWeddingIntegritySnapshot {
  id: string
  slug: string
  title: string
  wedding: PlannerIntegrityDataset
  memberships: PlannerIntegrityDataset
  tasks: PlannerIntegrityDataset
  budget: PlannerIntegrityDataset & {
    totalEstimated: number
    totalActual: number
    totalPaid: number
  }
  vendors: PlannerIntegrityDataset
  guests: PlannerIntegrityDataset & {
    confirmed: number
    declined: number
    pending: number
    checkedIn: number
    assignedToTable: number
  }
  timeline: PlannerIntegrityDataset
  seating: PlannerIntegrityDataset & {
    totalCapacity: number
  }
  imports: PlannerIntegrityDataset
  revisions: PlannerIntegrityDataset
  overallHash: string
}

export interface PlannerIntegritySnapshot {
  version: 1
  generatedAt: string
  weddings: PlannerWeddingIntegritySnapshot[]
  overallHash: string
}

export interface PlannerIntegrityDifference {
  weddingId: string
  weddingSlug: string
  path: string
  before: unknown
  after: unknown
}

function finiteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function dateValue(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString()
  if (typeof value !== 'string') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function stableValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) {
    const normalized = value.map(stableValue)
    return normalized.sort((left, right) => {
      const leftKey = JSON.stringify(left)
      const rightKey = JSON.stringify(right)
      return leftKey.localeCompare(rightKey)
    })
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    )
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return null
  return value
}

export function stablePlannerJson(value: unknown): string {
  return JSON.stringify(stableValue(value))
}

export function plannerIntegrityHash(value: unknown): string {
  return createHash('sha256').update(stablePlannerJson(value)).digest('hex')
}

function records(value: unknown): IntegrityRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is IntegrityRecord => Boolean(item) && typeof item === 'object')
    : []
}

function dataset(value: unknown): PlannerIntegrityDataset {
  const rows = records(value)
  return { count: rows.length, hash: plannerIntegrityHash(rows) }
}

function rsvpForGuest(guest: IntegrityRecord): IntegrityRecord | null {
  return guest.rsvp && typeof guest.rsvp === 'object'
    ? (guest.rsvp as IntegrityRecord)
    : null
}

export function createWeddingIntegritySnapshot(
  wedding: PlannerIntegrityWeddingInput,
): PlannerWeddingIntegritySnapshot {
  const tasks = records(wedding.plannerTasks)
  const budgetItems = records(wedding.budgetItems)
  const vendors = records(wedding.vendors)
  const guests = records(wedding.guests)
  const timeline = records(wedding.programmeItems)
  const seating = records(wedding.seatingTables)
  const memberships = records(wedding.memberships)
  const imports = records(wedding.importJobs)
  const revisions = records(wedding.contentRevisions)

  const weddingFields = Object.fromEntries(
    Object.entries(wedding).filter(
      ([key]) =>
        ![
          'plannerTasks',
          'budgetItems',
          'vendors',
          'guests',
          'programmeItems',
          'seatingTables',
          'memberships',
          'importJobs',
          'contentRevisions',
        ].includes(key),
    ),
  )

  const snapshot: Omit<PlannerWeddingIntegritySnapshot, 'overallHash'> = {
    id: wedding.id,
    slug: wedding.slug,
    title: wedding.title,
    wedding: { count: 1, hash: plannerIntegrityHash(weddingFields) },
    memberships: dataset(memberships),
    tasks: dataset(tasks),
    budget: {
      ...dataset(budgetItems),
      totalEstimated: budgetItems.reduce(
        (total, item) => total + finiteNumber(item.estimatedCost),
        0,
      ),
      totalActual: budgetItems.reduce(
        (total, item) => total + finiteNumber(item.actualCost),
        0,
      ),
      totalPaid: budgetItems.reduce(
        (total, item) => total + finiteNumber(item.paidAmount),
        0,
      ),
    },
    vendors: dataset(vendors),
    guests: {
      ...dataset(guests),
      confirmed: guests.filter((guest) => rsvpForGuest(guest)?.attending === true).length,
      declined: guests.filter((guest) => rsvpForGuest(guest)?.attending === false).length,
      pending: guests.filter((guest) => rsvpForGuest(guest)?.attending == null).length,
      checkedIn: guests.filter((guest) => rsvpForGuest(guest)?.checkedIn === true).length,
      assignedToTable: guests.filter(
        (guest) => typeof guest.seatingTableId === 'string' && guest.seatingTableId.length > 0,
      ).length,
    },
    timeline: dataset(timeline),
    seating: {
      ...dataset(seating),
      totalCapacity: seating.reduce(
        (total, table) => total + finiteNumber(table.capacity),
        0,
      ),
    },
    imports: dataset(imports),
    revisions: dataset(revisions),
  }

  return { ...snapshot, overallHash: plannerIntegrityHash(snapshot) }
}

export function createPlannerIntegritySnapshot(
  weddings: PlannerIntegrityWeddingInput[],
  generatedAt = new Date().toISOString(),
): PlannerIntegritySnapshot {
  const weddingSnapshots = weddings
    .map(createWeddingIntegritySnapshot)
    .sort((left, right) => left.id.localeCompare(right.id))

  return {
    version: 1,
    generatedAt: dateValue(generatedAt) ?? generatedAt,
    weddings: weddingSnapshots,
    overallHash: plannerIntegrityHash(weddingSnapshots),
  }
}

function comparableSnapshot(snapshot: PlannerIntegritySnapshot): Omit<PlannerIntegritySnapshot, 'generatedAt'> {
  const { generatedAt: _generatedAt, ...comparable } = snapshot
  return comparable
}

export function snapshotsMatch(
  before: PlannerIntegritySnapshot,
  after: PlannerIntegritySnapshot,
): boolean {
  return plannerIntegrityHash(comparableSnapshot(before)) === plannerIntegrityHash(comparableSnapshot(after))
}

function flatten(value: unknown, prefix = ''): Map<string, unknown> {
  const output = new Map<string, unknown>()
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    output.set(prefix, value)
    return output
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      for (const [nestedPath, nestedValue] of flatten(child, path)) {
        output.set(nestedPath, nestedValue)
      }
    } else {
      output.set(path, child)
    }
  }
  return output
}

export function comparePlannerIntegrity(
  before: PlannerIntegritySnapshot,
  after: PlannerIntegritySnapshot,
): PlannerIntegrityDifference[] {
  const beforeById = new Map(before.weddings.map((wedding) => [wedding.id, wedding]))
  const afterById = new Map(after.weddings.map((wedding) => [wedding.id, wedding]))
  const weddingIds = [...new Set([...beforeById.keys(), ...afterById.keys()])].sort()
  const differences: PlannerIntegrityDifference[] = []

  for (const weddingId of weddingIds) {
    const beforeWedding = beforeById.get(weddingId)
    const afterWedding = afterById.get(weddingId)
    const slug = afterWedding?.slug ?? beforeWedding?.slug ?? weddingId

    if (!beforeWedding || !afterWedding) {
      differences.push({
        weddingId,
        weddingSlug: slug,
        path: 'wedding',
        before: beforeWedding ?? null,
        after: afterWedding ?? null,
      })
      continue
    }

    const beforeFlat = flatten(beforeWedding)
    const afterFlat = flatten(afterWedding)
    const paths = [...new Set([...beforeFlat.keys(), ...afterFlat.keys()])].sort()

    for (const path of paths) {
      if (path === 'overallHash') continue
      const beforeValue = beforeFlat.get(path)
      const afterValue = afterFlat.get(path)
      if (stablePlannerJson(beforeValue) !== stablePlannerJson(afterValue)) {
        differences.push({
          weddingId,
          weddingSlug: slug,
          path,
          before: beforeValue,
          after: afterValue,
        })
      }
    }
  }

  return differences
}
