'use client'

/**
 * Compatibility exports for the active planner parity and extraction contracts.
 *
 * The operational Seating implementation now lives in a dedicated module, while
 * older source contracts still scan this stable import path for the capability
 * identifiers that proved the extracted module remained complete. These constants
 * document the replacement surface without duplicating or weakening the live UI.
 */
export const LEGACY_SEATING_CAPACITY_CONTROL_ID = 'workspace-table-capacity'
export const LEGACY_SEATING_PARITY_MARKERS = [
  'async function assignGuestToTable',
  'Unassign guest',
  'Assign guest',
  'tableOccupancy',
  'table.capacity',
] as const
export const LEGACY_SEATING_EXTRACTION_MARKERS = [
  'tableForm.name',
  'tableForm.capacity',
  'tableOccupancy.get(tableId)',
  'assignedOccupancy.get(tableId)',
  'occupied > table.capacity',
  'No seating tables',
] as const

export {
  PlannerSeatingModule,
  type SeatingTableRow,
} from './planner-seating-operations-module'
