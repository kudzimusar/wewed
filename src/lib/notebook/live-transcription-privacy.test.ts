import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const config = read('src/lib/notebook/transcription-config.ts')
const chunkRoute = read('src/app/api/notebook/[id]/transcription-chunks/route.ts')
const readinessRoute = read('src/app/api/notebook/transcription-readiness/route.ts')

describe('Notebook live transcription privacy', () => {
  test('keeps every credential lookup server-only', () => {
    expect(config).toContain('ZAI_API_KEY')
    expect(config).toContain('GROQ_API_KEY')
    expect(config).not.toContain('NEXT_PUBLIC_')
    expect(chunkRoute).not.toContain('ZAI_API_KEY')
    expect(readinessRoute).not.toContain('apiKey')
  })

  test('requires Notebook authorization before readiness or chunk transcription', () => {
    expect(chunkRoute).toContain('requireNotebookActor(request)')
    expect(readinessRoute).toContain('requireNotebookActor(request)')
  })
})
