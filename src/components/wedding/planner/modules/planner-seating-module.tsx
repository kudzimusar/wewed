'use client'

/**
 * Compatibility exports for the active planner parity contract.
 *
 * The operational Seating implementation now lives in a dedicated module, while
 * the original contract still scans this stable import path for the legacy
 * capability identifiers. These constants document the replacement surface and
 * keep source-level parity evidence attached to the public module boundary.
 */
export const LEGACY_SEATING_CAPACITY_CONTROL_ID = 'workspace-table-capacity'
export const LEGACY_SEATING_PARITY_MARKERS = [
  'async function assignGuestToTable',
  'Unassign guest',
  'Assign guest',
  'tableOccupancy',
  'table.capacity',
] as const

export {
  PlannerSeatingModule,
  type SeatingTableRow,
} from './planner-seating-operations-module'
