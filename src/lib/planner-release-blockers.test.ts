import { describe, expect, test } from 'bun:test'
import { escapeHtml } from '@/lib/html-escape'
import { getWorksheetSchema } from '@/lib/import-engine/schema-resolver'

const CLOCK_ERROR = 'Time must be a valid clock time (HH:MM or h:mm AM/PM).'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

describe('final worksheet and Seating release blockers', () => {
  test('escapes every untrusted value before generated Seating print HTML', async () => {
    expect(escapeHtml('<img src=x onerror="boom"> & \'VIP\''))
      .toBe('&lt;img src=x onerror=&quot;boom&quot;&gt; &amp; &#39;VIP&#39;')

    const component = await source('src/components/wedding/planner/modules/planner-seating-operations-module.tsx')
    expect(component).toContain('escapeHtml(table.name)')
    expect(component).toContain('escapeHtml(seatingTableTypeLabel(typeOf(table)))')
    expect(component).toContain("escapeHtml(table.zone || 'Zone not set')")
    expect(component).toContain('escapeHtml(table.notes)')
    expect(component).toContain('escapeHtml(guest.name)')
    expect(component).not.toContain('<h2>${table.name}</h2>')
  })

  test('keeps Guest creation and live seating edits inside retrying serializable transactions', async () => {
    const createRoute = await source('src/app/api/planner/guests/route.ts')
    const updateRoute = await source('src/app/api/planner/guests/[id]/route.ts')
    const transaction = await source('src/lib/planner-seating-transaction.ts')

    expect(createRoute).toContain('const guest = await runSerializableSeatingTransaction(async (tx) =>')
    expect(createRoute).toContain('occupied + 1 > table.capacity')
    expect(createRoute).toContain('const updatedGuests = await runSerializableSeatingTransaction(async (tx) =>')
    expect(updateRoute).toContain('const updated = await runSerializableSeatingTransaction(async (tx) =>')
    expect(updateRoute).toContain('const current = await tx.guest.findFirst')
    expect(updateRoute).toContain('occupied + required > table.capacity')
    expect(updateRoute).toContain('updates.capacity < occupied')
    expect(transaction).toContain("isolationLevel: 'Serializable'")
    expect(transaction).toContain("code === 'P2034'")
  })

  test('rejects unsafe partial Seating execution', async () => {
    const route = await source('src/lib/import-engine/import-job-post.ts')
    expect(route).toContain("preview.moduleKey === 'seating'")
    expect(route).toContain('omittedExecutableRows')
    expect(route).toContain('must execute all validated create and update rows together')
    expect(route.indexOf('omittedExecutableRows')).toBeLessThan(route.indexOf('preview = { ...preview, rows: preview.rows.filter'))
  })

  test('rejects impossible and non-clock Timeline worksheet values', () => {
    const schema = getWorksheetSchema('timeline')
    const validRow = { time: '11:45', activity: 'Valid event', title: 'Valid event' }
    const twelveHourRow = { time: '2:30 PM', activity: 'Valid event', title: 'Valid event' }
    const impossibleRow = { time: '25:90', activity: 'Invalid event', title: 'Invalid event' }
    const nonClockRow = { time: 'TBD', activity: 'Invalid event', title: 'Invalid event' }

    expect(schema.validateRow(validRow)).not.toContain(CLOCK_ERROR)
    expect(schema.validateRow(twelveHourRow)).not.toContain(CLOCK_ERROR)
    expect(schema.validateRow(impossibleRow)).toContain(CLOCK_ERROR)
    expect(schema.validateRow(nonClockRow)).toContain(CLOCK_ERROR)
  })
})
