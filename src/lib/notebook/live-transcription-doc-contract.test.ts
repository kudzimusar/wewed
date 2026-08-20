import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

test('Notebook live transcription closure documents preservation and private provider routing', () => {
  const text = readFileSync(join(process.cwd(), 'docs/NOTEBOOK_LIVE_TRANSCRIPTION_CLOSURE_2026-08-20.md'), 'utf8')
  expect(text).toContain('configured private Z.AI credential')
  expect(text).toContain('original browser WebM recording')
  expect(text).toContain('browser never receives provider credentials')
})
