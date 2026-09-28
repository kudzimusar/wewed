import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

describe('wedding social message credential safety', () => {
  test('messages never copy or expose RSVP credentials', () => {
    const source = readFileSync('src/app/api/messages/route.ts', 'utf8')

    expect(source).not.toContain('resolved.access.guest?.rsvpToken')
    expect(source).toContain('authorToken: null')
    expect(source).toContain('select: publicMessageSelect')
    // Every read returns only the public projection, which never includes the author's credential.
    const projection = source.slice(source.indexOf('const publicMessageSelect'), source.indexOf('} as const'))
    expect(projection).not.toContain('authorToken')
    const getHandler = source.slice(source.indexOf('export async function GET'), source.indexOf('export async function POST'))
    expect(getHandler).toContain('select: publicMessageSelect')
  })
})
