import { describe, expect, test } from 'bun:test'
import {
  checkedInHeadcount,
  csvRows,
  eventReadiness,
  normaliseIssueSeverity,
  normaliseTimelineStatus,
  parseTimelineMinutes,
  partyHeadcount,
} from './planner-phase6'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

describe('Phase 6 event operations helpers', () => {
  test('calculates confirmed party and checked-in headcounts', () => {
    const rsvp = {
      attending: true,
      plusOne: true,
      kidsAttending: true,
      kidsCount: 2,
      checkedIn: true,
    }
    expect(partyHeadcount(rsvp)).toBe(4)
    expect(checkedInHeadcount(rsvp)).toBe(4)
    expect(partyHeadcount({ ...rsvp, attending: false })).toBe(0)
    expect(checkedInHeadcount({ ...rsvp, attending: false })).toBe(1)
  })

  test('normalises operational statuses', () => {
    expect(normaliseIssueSeverity('critical')).toBe('critical')
    expect(normaliseIssueSeverity('unknown')).toBe('medium')
    expect(normaliseTimelineStatus('in_progress')).toBe('in_progress')
    expect(normaliseTimelineStatus('unknown')).toBe('pending')
  })

  test('parses 12-hour and 24-hour timeline values', () => {
    expect(parseTimelineMinutes('2:30 PM')).toBe(870)
    expect(parseTimelineMinutes('14:30')).toBe(870)
    expect(parseTimelineMinutes('25:00')).toBeNull()
    expect(parseTimelineMinutes('ceremony')).toBeNull()
  })

  test('escapes downloadable CSV values', () => {
    expect(csvRows([['Name', 'Notes'], ['Charity, Kudzie', 'He said "hello"']]))
      .toBe('Name,Notes\r\n"Charity, Kudzie","He said ""hello"""\r\n')
  })

  test('readiness declines for unseated guests and critical issues', () => {
    const ready = eventReadiness({
      expectedHeads: 10,
      checkedInHeads: 10,
      unseatedHeads: 0,
      openCriticalIssues: 0,
      incompleteTimelineItems: 0,
    })
    const atRisk = eventReadiness({
      expectedHeads: 10,
      checkedInHeads: 2,
      unseatedHeads: 3,
      openCriticalIssues: 1,
      incompleteTimelineItems: 4,
    })
    expect(ready).toBe(100)
    expect(atRisk).toBeLessThan(ready)
  })
})

describe('Phase 6 architecture', () => {
  test('event-day API is wedding-scoped and validates resources', async () => {
    const route = await source('src/app/api/planner/event-day/route.ts')
    expect(route).toContain("requireWeddingPermission(request, 'planner.view')")
    expect(route).toContain('const weddingId = access.context.weddingId')
    expect(route).toContain("action === 'set_check_in'")
    expect(route).toContain("action === 'set_timeline_status'")
    expect(route).toContain("section: 'event_day_issue'")
  })

  test('operational exports are permission protected', async () => {
    const route = await source('src/app/api/planner/event-day/export/route.ts')
    expect(route).toContain("requireWeddingPermission(request, 'export.data')")
    expect(route).toContain('Content-Disposition')
    expect(route).toContain('guest-manifest')
    expect(route).toContain('run-sheet')
  })

  test('planner portal mounts the wedding-day command centre', async () => {
    const portal = await source('src/components/wedding/planner-portal.tsx')
    const command = await source('src/components/wedding/planner-event-command.tsx')
    expect(portal).toContain('PlannerEventCommand')
    expect(command).toContain('Wedding Day')
    expect(command).toContain('Check-in')
    expect(command).toContain('Run sheet')
    expect(command).toContain('Issues')
    expect(command).not.toContain('SEED_')
  })
})
