import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

/**
 * NATIVE-MOBILE-QRO08 — the native Planner invitation/guest write twins are thin shells over the
 * SAME operation functions the desktop Planner routes call. One database authority, no second
 * backend, no credential echoed back to the device.
 */

const read = (path: string) => readFileSync(path, 'utf8')

const NATIVE = {
  delivery: 'src/app/api/native/wedding/invitations/delivery/route.ts',
  invitations: 'src/app/api/native/wedding/invitations/route.ts',
  guests: 'src/app/api/native/wedding/guests/route.ts',
  guest: 'src/app/api/native/wedding/guests/[id]/route.ts',
}
const WEB = {
  delivery: 'src/app/api/planner/guests/invitations/delivery/route.ts',
  invitations: 'src/app/api/planner/guests/invitations/route.ts',
  guests: 'src/app/api/planner/guests/route.ts',
  guest: 'src/app/api/planner/guests/[id]/route.ts',
}

/** Body of one exported handler, up to the next export. */
function handler(source: string, method: string): string {
  const start = source.indexOf(`export async function ${method}(`)
  expect(start).toBeGreaterThanOrEqual(0)
  const next = source.indexOf('\nexport ', start + 1)
  return source.slice(start, next === -1 ? undefined : next)
}

describe('QRO08 native Planner write authority', () => {
  test('resolves the grant, wedding scope, guests.edit and the Preview block before any write', () => {
    const source = read('src/lib/native-planner-guest-write.ts')
    const order = [
      'resolveNativeGrantContext(request)',
      'requireWeddingScope(result.context.grant)',
      "requireGrantPermission(result.context.grant, 'guests.edit')",
      'shouldBlockPreviewWrite({ method: request.method, weddingId: scope.weddingId })',
      'actor: { weddingId: scope.weddingId, actorId: result.context.session.accessUserId }',
    ].map((marker) => source.indexOf(marker))
    expect(order.every((index) => index >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    // The wedding never comes from the request body.
    expect(source).not.toContain('body.weddingId')
  })

  test('every native write handler goes through the write authority first', () => {
    const cases: Array<[string, string[]]> = [
      [NATIVE.delivery, ['POST', 'DELETE']],
      [NATIVE.invitations, ['POST', 'PATCH']],
      [NATIVE.guests, ['POST']],
      [NATIVE.guest, ['PATCH', 'DELETE']],
    ]
    for (const [path, methods] of cases) {
      const source = read(path)
      for (const method of methods) {
        const body = handler(source, method)
        expect(body).toContain('const write = await resolveNativeGuestWrite(request)')
        expect(body).toContain('if (!write.ok) return write.response')
      }
    }
  })

  test('native and desktop routes call the same shared operations and never write the database directly', () => {
    const shared: Array<[string, string, string[]]> = [
      [NATIVE.delivery, WEB.delivery, ['recordInvitationDelivery(', 'resetInvitationDelivery(']],
      [NATIVE.invitations, WEB.invitations, ['repairMissingInvitationLinks(', 'rotateGuestInvitation(']],
      [NATIVE.guests, WEB.guests, ['createPlannerGuest(']],
      [NATIVE.guest, WEB.guest, ['updatePlannerGuest(', 'deletePlannerGuest(']],
    ]
    for (const [nativePath, webPath, calls] of shared) {
      const nativeSource = read(nativePath)
      const webSource = read(webPath)
      for (const call of calls) {
        expect(nativeSource).toContain(call)
        expect(webSource).toContain(call)
      }
      // The write handlers (GET readers above them stay on the canonical projections).
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        if (!nativeSource.includes(`export async function ${method}(`)) continue
        expect(/\b(db|tx)\./.test(handler(nativeSource, method))).toBe(false)
      }
    }
  })

  test('native write responses never carry a credential', () => {
    for (const path of [NATIVE.delivery, NATIVE.guests, NATIVE.guest]) {
      const source = read(path)
      for (const method of ['POST', 'PATCH', 'DELETE']) {
        if (!source.includes(`export async function ${method}(`)) continue
        const body = handler(source, method)
        // Code only: doc comments may name the RSVP they delete.
        const code = body.replace(/\/\*\*[\s\S]*?\*\//g, '')
        expect(/\.token\b|\btoken:|invitationUrl|qrValue|shareMessage|\.rsvp\b|rsvp:/.test(code)).toBe(false)
      }
    }
    // Created/updated Guests are reduced to the non-credential summary.
    expect(read(NATIVE.guests)).toContain('nativeGuestSummary(result.data)')
    expect(read(NATIVE.guest)).toContain('nativeGuestSummary(result.data)')
    const summary = read('src/lib/native-planner-guest-write.ts')
    for (const marker of ['id: guest.id', 'name: guest.name', 'email: guest.email', 'phone: guest.phone', 'attendanceAllocation: guest.attendanceAllocation']) expect(summary).toContain(marker)
    // Repair/rotate return only a count / success flag.
    const invitations = read(NATIVE.invitations)
    expect(handler(invitations, 'POST')).toContain('{ success: true, generated: result.ok ? result.data.generated : 0 }')
    expect(handler(invitations, 'PATCH')).toContain('{ success: true }')
  })

  test('native write responses are private and uncacheable', () => {
    for (const path of [NATIVE.delivery, NATIVE.invitations]) {
      expect(read(path)).toContain('privateNoStoreJson(')
    }
    for (const path of [NATIVE.guests, NATIVE.guest]) {
      expect(read(path)).toContain('noStoreJson(')
    }
  })

  test('native guest writes expose the canonical Guest editor fields through shared authority', () => {
    const create = handler(read(NATIVE.guests), 'POST')
    for (const field of ['name', 'email', 'phone', 'role', 'roleDetail', 'side', 'attendanceAllocation', 'seatingTableId']) {
      expect(create).toContain(`${field}:`)
    }
    const edit = handler(read(NATIVE.guest), 'PATCH')
    expect(edit).toContain('updatePlannerGuest(write.actor')
    expect(edit).toContain('attendanceAllocation')
    expect(create).not.toContain('db.guest.create')
    expect(edit).not.toContain('db.guest.update')
  })

  test('P1: desktop and native Guest DELETE expose the same protected-deletion contract', () => {
    const shared = read('src/lib/planner-guest-operations.ts')
    expect(shared).toContain("export const GUEST_DELETE_CONFLICT = 'GUEST_DELETE_CONFLICT'")
    expect(shared).toContain('status: 409,')
    expect(shared).toContain('code: GUEST_DELETE_CONFLICT,')
    expect(shared).toContain('protectedRecords: records,')
    // The protected check runs inside the delete transaction, before anything is removed.
    const del = shared.slice(shared.indexOf('export async function deletePlannerGuest'))
    expect(del.indexOf('protectedGuestRecords(tx')).toBeLessThan(del.indexOf('tx.rSVP.deleteMany'))
    // A foreign-key refusal is mapped to the same conflict, never a raw database error.
    expect(shared).toContain("code === 'P2003' || code === '23503'")
    for (const path of [WEB.guest, NATIVE.guest]) {
      const body = handler(read(path), 'DELETE')
      expect(body).toContain('deletePlannerGuest(')
      expect(body).toContain("...('code' in result ? { code: result.code, protectedRecords: result.protectedRecords } : {})")
      expect(body).toContain('result.status')
    }
  })
})
