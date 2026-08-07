import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(
  join(process.cwd(), 'src/components/wedding/ai-planner-assistant.tsx'),
  'utf8',
)

describe('AI Planner Assistant regression contract', () => {
  test('keeps a clipboard fallback and visible copy result feedback', () => {
    expect(source).toContain('navigator.clipboard?.writeText')
    expect(source).toContain("document.execCommand('copy')")
    expect(source).toContain("useState<'idle' | 'copied' | 'failed'>('idle')")
    expect(source).toContain("? 'Copied'")
    expect(source).toContain("? 'Select text to copy'")
    expect(source).toContain("aria-live=\"polite\"")
  })

  test('keeps Planner Copilot read-only in the user-facing boundary', () => {
    expect(source).toContain("boundary: 'Read-only; active wedding and permissions enforced'")
    expect(source).toContain('It cannot change records.')
  })
})
