import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

test('WW-NOTEBOOK-LIVE-ASR-2026-08-20-01 remains in release documentation', () => {
  const text = readFileSync(join(process.cwd(), 'docs/NOTEBOOK_LIVE_TRANSCRIPTION_CLOSURE_2026-08-20.md'), 'utf8')
  expect(text).toContain('WW-NOTEBOOK-LIVE-ASR-2026-08-20-01')
  expect(text).toContain('FINAL PRODUCTION CLOSURE')
})
