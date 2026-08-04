'use client'

/**
 * Compatibility export for the active planner parity contract.
 * The legacy planner called the table-capacity control `workspace-table-capacity`;
 * the operational implementation now exposes richer create/edit capacity fields.
 */
export const LEGACY_SEATING_CAPACITY_CONTROL_ID = 'workspace-table-capacity'

export {
  PlannerSeatingModule,
  type SeatingTableRow,
} from './planner-seating-operations-module'
