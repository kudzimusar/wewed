import { describe, expect, test } from 'bun:test'
import { localDraftKey, parseStoredLocalDraft, resolveLocalDraft } from '@/lib/wedding-site/browser-draft'

describe('site editor local drafts never override newer server content', () => {
  const base = '2026-09-28T10:00:00.000Z'
  const newer = '2026-09-28T11:30:00.000Z'

  test('an unsaved edit typed over the current server version is restored', () => {
    const stored = { value: 'Our story, revised', baseUpdatedAt: base, savedAt: base }
    expect(resolveLocalDraft(stored, 'Our story', base)).toEqual({ use: 'local', value: 'Our story, revised' })
  })

  test('a local edit typed over an older server version is discarded when the server has moved on', () => {
    const stored = { value: 'Stale text from another tab', baseUpdatedAt: base, savedAt: base }
    expect(resolveLocalDraft(stored, 'Published on another device', newer)).toEqual({
      use: 'server',
      discardLocal: true,
      reason: 'stale',
    })
  })

  test('a local edit made before the field existed is discarded once the server has any copy', () => {
    const stored = { value: 'Local only', baseUpdatedAt: null, savedAt: base }
    expect(resolveLocalDraft(stored, 'Server copy', newer).use).toBe('server')
  })

  test('a local edit identical to the server copy is cleared', () => {
    const stored = { value: 'Same', baseUpdatedAt: base, savedAt: base }
    expect(resolveLocalDraft(stored, 'Same', base)).toEqual({ use: 'server', discardLocal: true, reason: 'same-as-server' })
  })

  test('corrupt or foreign storage is ignored', () => {
    expect(parseStoredLocalDraft('not json')).toBeNull()
    expect(parseStoredLocalDraft(JSON.stringify({ value: 3 }))).toBeNull()
    expect(parseStoredLocalDraft(null)).toBeNull()
    expect(resolveLocalDraft(null, 'x', base)).toEqual({ use: 'server', discardLocal: false, reason: 'none' })
  })

  test('drafts are scoped per wedding and field', () => {
    expect(localDraftKey('a-and-b', 'story', 'body')).not.toBe(localDraftKey('c-and-d', 'story', 'body'))
    expect(localDraftKey('a-and-b', 'story', 'body')).not.toBe(localDraftKey('a-and-b', 'story', 'heading'))
  })

  test('the guest-facing site never reads browser-local content', async () => {
    const { readFileSync, readdirSync } = await import('node:fs')
    const files = readdirSync('src/components/wedding/site').map((file) => `src/components/wedding/site/${file}`)
    files.push('src/components/wedding/wedding-home.tsx', 'src/lib/wedding-data.ts', 'src/components/wedding/wedding-data-provider.tsx')
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      expect(source).not.toContain('localStorage')
      expect(source).not.toContain('useInlineContent')
    }
  })
})
