import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

function sourceFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) files.push(...sourceFiles(path))
    else if (entry.isFile() && (path.endsWith('.ts') || path.endsWith('.tsx'))) files.push(path)
  }
  return files
}

const TRANSPORT_FILES = new Set([
  'src/lib/ai/config.ts',
  'src/lib/ai/provider-clients.ts',
])

const CORE_MODEL_FILES = new Set([
  'src/lib/ai/types.ts',
  'src/lib/ai/index.ts',
  'src/lib/ai/core/model-release.ts',
  'src/lib/ai/core/orchestrator.ts',
  'src/lib/ai/core/core.test.ts',
])

const PROVIDER_ENDPOINT_MARKERS = [
  'api.groq.com',
  'generativelanguage.googleapis.com',
  'api.z.ai',
]

describe('Wewed AI bypass freeze', () => {
  test('provider HTTP endpoints stay inside the transport layer', () => {
    const violations: string[] = []
    for (const absolute of sourceFiles(join(process.cwd(), 'src'))) {
      const path = relative(process.cwd(), absolute).replaceAll('\\', '/')
      if (TRANSPORT_FILES.has(path)) continue
      const source = readFileSync(absolute, 'utf8')
      if (PROVIDER_ENDPOINT_MARKERS.some((marker) => source.includes(marker))) violations.push(path)
    }
    expect(violations).toEqual([])
  })

  test('model override stays inside the router/Core boundary', () => {
    const violations: string[] = []
    for (const absolute of sourceFiles(join(process.cwd(), 'src'))) {
      const path = relative(process.cwd(), absolute).replaceAll('\\', '/')
      if (CORE_MODEL_FILES.has(path) || path === 'src/lib/ai/provider-clients.ts') continue
      const source = readFileSync(absolute, 'utf8')
      if (source.includes('modelOverride:') || source.includes('WEWED_AI_DEFAULT_MODEL')) violations.push(path)
    }
    expect(violations).toEqual([])
  })
})
