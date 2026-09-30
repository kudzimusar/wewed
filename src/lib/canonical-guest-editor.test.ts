import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const editor = readFileSync(
  'src/components/wedding/planner/planner-guest-editor.tsx',
  'utf8',
)
const register = readFileSync(
  'src/components/wedding/planner/modules/planner-guests-module.tsx',
  'utf8',
)
const invitations = readFileSync(
  'src/components/wedding/invitation-manager.tsx',
  'utf8',
)
const projection = readFileSync(
  'src/lib/planner-invitation-projection.ts',
  'utf8',
)
const operations = readFileSync(
  'src/lib/planner-guest-operations.ts',
  'utf8',
)

describe('canonical Planner Guest editor convergence', () => {
  test('the shared editor exposes the approved canonical Guest fields', () => {
    for (const field of [
      'name',
      'email',
      'phone',
      'role',
      'roleDetail',
      'side',
      'attendanceAllocation',
      'seatingTableId',
    ]) {
      expect(editor).toContain(field)
    }
    expect(editor).toContain('Participant type / role')
    expect(editor).toContain('Relationship / role detail')
    expect(editor).toContain('Relationship side')
    expect(editor).toContain('Capacity allocation')
    expect(editor).toContain('Seating table')
  })

  test('Guest register and Invitation Command Center render the same editor', () => {
    expect(register).toContain('<PlannerGuestEditor')
    expect(invitations).toContain('<PlannerGuestEditor')
    expect(register).toContain('roleDetail: editGuest.roleDetail.trim() || null')
    expect(register).toContain('attendanceAllocation: editGuest.attendanceAllocation')
    expect(register).toContain('seatingTableId: editGuest.seatingTableId || null')
    expect(invitations).toContain('roleDetail: newGuest.roleDetail.trim() || undefined')
    expect(invitations).toContain('attendanceAllocation: newGuest.attendanceAllocation')
    expect(invitations).toContain('seatingTableId: newGuest.seatingTableId || undefined')
    expect(invitations).toContain('roleDetail: editGuest.roleDetail.trim() || null')
    expect(invitations).toContain('seatingTableId: editGuest.seatingTableId || null')
  })

  test('Invitation projection carries the same Guest classification and seating identity', () => {
    expect(projection).toContain('role: guest.role')
    expect(projection).toContain('roleDetail: guest.roleDetail')
    expect(projection).toContain('side: guest.side')
    expect(projection).toContain('attendanceAllocation: guest.attendanceAllocation')
    expect(projection).toContain('seatingTableId: guest.seatingTableId')
    expect(projection).toContain('seatingTableName: guest.seatingTable?.name ?? null')
    expect(projection).toContain('tables,')
  })

  test('both workspaces remain backed by the single shared Guest operation authority', () => {
    expect(operations).toContain('export async function createPlannerGuest')
    expect(operations).toContain('export async function updatePlannerGuest')
    expect(operations).toContain('export async function deletePlannerGuest')
    expect(operations).toContain('roleDetail?: string')
    expect(operations).toContain('attendanceAllocation?: string')
    expect(operations).toContain('seatingTableId?: string')
  })

  test('Invitation Manager no longer owns a reduced name-email-phone Guest type', () => {
    expect(invitations).not.toContain('interface EditableGuest')
    expect(invitations).not.toContain("role: 'guest',\n          side: 'neutral'")
  })
})
