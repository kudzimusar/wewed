import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const schema = readFileSync('prisma/schema.prisma', 'utf8')
const migration = readFileSync(
  'prisma/migrations/20261001003000_guest_attendance_allocation_capacity/migration.sql',
  'utf8',
)
const authority = readFileSync('src/lib/guest-capacity-allocation.ts', 'utf8')
const operations = readFileSync('src/lib/planner-guest-operations.ts', 'utf8')
const importApply = readFileSync('src/lib/import-engine/guest-worksheet-apply.ts', 'utf8')
const importContract = readFileSync('src/lib/import-engine/guest-worksheet-contract.ts', 'utf8')
const editor = readFileSync('src/components/wedding/planner/planner-guest-editor.tsx', 'utf8')
const capacityRoute = readFileSync('src/app/api/planner/guests/capacity/route.ts', 'utf8')
const nativeCreate = readFileSync('src/app/api/native/wedding/guests/route.ts', 'utf8')
const nativeEdit = readFileSync('src/app/api/native/wedding/guests/[id]/route.ts', 'utf8')

describe('Guest capacity allocation authority', () => {
  test('relationship side and capacity allocation are separate canonical Guest fields', () => {
    expect(schema).toContain('side               String?')
    expect(schema).toContain('attendanceAllocation String @default("shared")')
    expect(migration).toContain('ADD COLUMN "attendanceAllocation" TEXT NOT NULL DEFAULT \'shared\'')
    expect(editor).toContain('Relationship side')
    expect(editor).toContain('Capacity allocation')
    expect(editor).toContain("attendanceAllocation: 'shared'")
  })

  test('capacity vocabulary is Bride, Groom, Shared and Operational only', () => {
    expect(authority).toContain("['bride', 'groom', 'shared', 'operational']")
    expect(migration).toContain("CHECK (\"attendanceAllocation\" IN ('bride', 'groom', 'shared', 'operational'))")
    expect(migration).toContain("CHECK (\"allocation\" IN ('bride', 'groom', 'shared', 'operational'))")
  })

  test('shared Guest create/update authority blocks writes above a configured hard limit', () => {
    expect(operations).toContain('assertAttendanceAllocationCapacity(tx')
    expect(operations).toContain('AttendanceAllocationCapacityError')
    expect(operations).toContain("field: 'attendanceAllocation'")
    expect(authority).toContain('projected > limit.hardLimit')
    expect(authority).toContain('ATTENDANCE_ALLOCATION_CAPACITY_EXCEEDED')
  })

  test('native Planner uses the same shared Guest operation for allocation writes', () => {
    expect(nativeCreate).toContain('createPlannerGuest(write.actor')
    expect(nativeCreate).toContain('attendanceAllocation')
    expect(nativeEdit).toContain('updatePlannerGuest(write.actor')
    expect(nativeEdit).toContain('attendanceAllocation')
    expect(nativeCreate).not.toContain('db.guest.create')
    expect(nativeEdit).not.toContain('db.guest.update')
  })

  test('worksheet import cannot bypass capacity enforcement', () => {
    expect(importContract).toContain("label: 'Attendance Allocation'")
    expect(importApply).toContain('assertAttendanceAllocationCapacity(tx')
    expect(importApply).toContain('Prisma.TransactionIsolationLevel.Serializable')
    expect(importApply).toContain('attendanceAllocation')
  })

  test('capacity settings cannot be reduced below the current registered count', () => {
    expect(capacityRoute).toContain('ATTENDANCE_ALLOCATION_CAPACITY_BELOW_CURRENT')
    expect(capacityRoute).toContain('hardLimit < registered')
    expect(capacityRoute).toContain('warningAt > hardLimit')
    expect(capacityRoute).toContain("action: 'guest.attendance_allocation_capacity_updated'")
  })

  test('capacity overview distinguishes registered from attending', () => {
    expect(authority).toContain("client.guest.count({ where: { weddingId, attendanceAllocation: allocation } })")
    expect(authority).toContain("rsvp: { is: { attending: true } }")
    const panel = readFileSync(
      'src/components/wedding/planner/planner-guest-capacity-panel.tsx',
      'utf8',
    )
    expect(panel).toContain('registered · {row.attending} attending')
    expect(panel).toContain('Hard limit')
    expect(panel).toContain('Warn at')
  })
})
