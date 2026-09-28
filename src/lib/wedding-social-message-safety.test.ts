import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

describe('wedding social message credential safety', () => {
  test('messages never copy or expose RSVP credentials', () => {
    const source = readFileSync('src/app/api/messages/route.ts', 'utf8')

    expect(source).not.toContain('resolved.access.guest?.rsvpToken')
    expect(source).toContain('authorToken: null')
    expect(source).toContain('select: publicMessageSelect')
    expect(source).not.toContain('data: messages }))')
  })
})
