import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { sortTimelineItems } from '@/lib/planner-timeline-order'

/**
 * Final C&K invitation distribution UAT (2026-09-29) regressions:
 * 1. The Couple Website listed "14:00 Ceremony" before "13:00 Guest Arrival" because the site loader
 *    kept the manual `order` while the guest Wedding Day sorted by clock time.
 * 2. The Wedding Pass dialog said "Available from 12/9/2026", which day-first readers take as
 *    12 September.
 */
describe('invitation distribution UAT polish', () => {
  test('the Couple Website programme uses the shared chronological order', () => {
    const loader = readFileSync('src/lib/wedding-data-server.ts', 'utf8')
    expect(loader).toContain("import { sortTimelineItems } from '@/lib/planner-timeline-order'")
    expect(loader).toContain('programmeItems: sortTimelineItems(programmeIsPublic(site.sections) ? wedding.programmeItems : [])')

    // The C&K shape: manual order put the ceremony first.
    const ordered = sortTimelineItems([
      { id: 'ceremony', time: '14:00', order: 1 },
      { id: 'arrival', time: '13:00', order: 2 },
      { id: 'confetti', time: '14:45', order: 3 },
    ])
    expect(ordered.map((item) => item.id)).toEqual(['arrival', 'ceremony', 'confetti'])
  })

  test('the Wedding Pass opening date spells the month out', () => {
    const dialog = readFileSync('src/components/wedding/invitation-experience/wedding-guest-pass-dialog.tsx', 'utf8')
    expect(dialog).toContain('Available from ${formatPassOpensAt(opensAt)}.')
    expect(dialog).not.toContain('opensAt.toLocaleDateString()')
    expect(new Date('2026-12-09T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))
      .toBe('9 December 2026')
  })
})
