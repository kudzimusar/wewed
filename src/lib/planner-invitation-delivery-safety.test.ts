import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/wedding/invitation-manager.tsx', 'utf8')

describe('Planner invitation delivery safety', () => {
  test('loading the invitation manager is read-only', () => {
    const start = source.indexOf('const load = useCallback')
    const end = source.indexOf('useEffect(() => { void load() }, [load])')
    const loadBlock = source.slice(start, end)

    expect(loadBlock).toContain("fetch('/api/planner/guests/invitations', { cache: 'no-store' })")
    expect(loadBlock).not.toContain("method: 'POST'")
  })

  test('missing invitation credentials require an explicit operator action', () => {
    expect(source).toContain('async function generateMissingLinks()')
    expect(source).toContain("method: 'POST'")
    expect(source).toContain('window.confirm')
  })

  test('share sheet receives the server message exactly once', () => {
    const start = source.indexOf('async function share(row: InvitationRow)')
    const end = source.indexOf('async function generateMissingLinks()')
    const shareBlock = source.slice(start, end)

    expect(shareBlock).toContain('text: row.shareMessage')
    expect(shareBlock).not.toContain('url: row.invitationUrl')
  })
})
