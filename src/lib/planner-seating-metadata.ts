// Production release marker: worksheet-seating-20260804
export const SEATING_TABLE_TYPES = [
  'high',
  'vip_parents',
  'vip_friends',
  'ordinary',
  'other',
] as const

export type SeatingTableType = (typeof SEATING_TABLE_TYPES)[number]

export interface SeatingTableMetadata {
  tableType: SeatingTableType
  zone: string | null
  notes: string | null
  x?: number
  y?: number
}

const TYPE_LABELS: Record<SeatingTableType, string> = {
  high: 'High table',
  vip_parents: 'VIP — parents',
  vip_friends: 'VIP — friends',
  ordinary: 'Ordinary seating',
  other: 'Other',
}

function clean(value: unknown, maxLength = 240): string | null {
  if (typeof value !== 'string') return null
  const result = value.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim()
  return result ? result.slice(0, maxLength) : null
}

export function isSeatingTableType(value: unknown): value is SeatingTableType {
  return typeof value === 'string' && SEATING_TABLE_TYPES.includes(value as SeatingTableType)
}

export function seatingTableTypeLabel(value: SeatingTableType): string {
  return TYPE_LABELS[value]
}

export function inferSeatingTableType(...values: Array<string | null | undefined>): SeatingTableType {
  const source = values.filter(Boolean).join(' ').toLowerCase()
  if (/high\s*table|top\s*table|head\s*table/.test(source)) return 'high'
  if (/vip.*parent|parent.*vip|mother|father/.test(source)) return 'vip_parents'
  if (/vip.*friend|friend.*vip/.test(source)) return 'vip_friends'
  if (/ordinary|general|standard|guest\s*table|colleague|family|friend/.test(source)) return 'ordinary'
  return 'ordinary'
}

export function parseSeatingTableMetadata(
  position: string | null | undefined,
  tableName?: string | null,
): SeatingTableMetadata {
  const fallbackType = inferSeatingTableType(tableName, position)
  if (!position) return { tableType: fallbackType, zone: null, notes: null }

  try {
    const parsed = JSON.parse(position) as Record<string, unknown>
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const tableType = isSeatingTableType(parsed.tableType)
        ? parsed.tableType
        : isSeatingTableType(parsed.type)
          ? parsed.type
          : fallbackType
      const x = typeof parsed.x === 'number' && Number.isFinite(parsed.x) ? parsed.x : undefined
      const y = typeof parsed.y === 'number' && Number.isFinite(parsed.y) ? parsed.y : undefined
      const explicitZone = clean(parsed.zone ?? parsed.label ?? parsed.position, 120)
      const coordinateZone = x !== undefined && y !== undefined ? `Floor position ${x}, ${y}` : null
      return {
        tableType,
        zone: explicitZone ?? coordinateZone,
        notes: clean(parsed.notes, 500),
        ...(x !== undefined ? { x } : {}),
        ...(y !== undefined ? { y } : {}),
      }
    }
  } catch {
    // Plain legacy position strings remain supported and become the visible zone.
  }

  return {
    tableType: fallbackType,
    zone: clean(position, 120),
    notes: null,
  }
}

export function serializeSeatingTableMetadata(metadata: SeatingTableMetadata): string {
  const payload = {
    version: 1,
    tableType: metadata.tableType,
    zone: clean(metadata.zone, 120),
    notes: clean(metadata.notes, 500),
    ...(typeof metadata.x === 'number' && Number.isFinite(metadata.x) ? { x: metadata.x } : {}),
    ...(typeof metadata.y === 'number' && Number.isFinite(metadata.y) ? { y: metadata.y } : {}),
  }
  return JSON.stringify(payload)
}

export function plannedSeatsForGuest(guest: {
  rsvp?: {
    plusOne?: boolean
    kidsAttending?: boolean
    kidsCount?: number
  } | null
}): number {
  const kids = guest.rsvp?.kidsAttending
    ? Math.max(0, Math.floor(Number(guest.rsvp.kidsCount) || 0))
    : 0
  return 1 + (guest.rsvp?.plusOne ? 1 : 0) + kids
}
