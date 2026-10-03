import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/wedding/invitation-manager.tsx', 'utf8')
const actions = readFileSync('src/components/wedding/planner/planner-guest-invitation-actions.tsx', 'utf8')

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
    const start = actions.indexOf('async function invite()')
    const end = actions.indexOf('async function recordDelivery')
    const shareBlock = actions.slice(start, end)

    expect(shareBlock).toContain('text: guest.shareMessage')
    expect(shareBlock).toContain('Wewed ·')
    expect(shareBlock).not.toContain('url: guest.invitationUrl')
  })
})
