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

const SELF = 'src/lib/ai/core/bypass-guard.test.ts'
const TRANSPORT_FILES = new Set([
  'src/lib/ai/config.ts',
  'src/lib/ai/provider-clients.ts',
])

// Phase 0 discovered these pre-Core transcription exceptions. Keep the list
// explicit and shrinking: adding another file here is an architecture change,
// not a convenient way around the Wewed AI Core.
const LEGACY_PROVIDER_ENDPOINT_EXCEPTIONS = new Set([
  'src/lib/notebook/transcription-config.ts',
  'src/lib/notebook/transcription-config.test.ts',
])

const CORE_MODEL_FILES = new Set([
  'src/lib/ai/types.ts',
  'src/lib/ai/index.ts',
  'src/lib/ai/core/model-release.ts',
  'src/lib/ai/core/orchestrator.ts',
  'src/lib/ai/core/core.test.ts',
  SELF,
])

const DIRECT_TRANSPORT_CALLERS = new Set([
  'src/lib/ai/index.ts',
  'src/lib/ai/provider-clients.ts',
  'src/lib/ai/provider-clients.test.ts',
  SELF,
])

const PROVIDER_ENDPOINT_MARKERS = [
  'api.groq.com',
  'generativelanguage.googleapis.com',
  'api.z.ai',
]

const MODEL_RELEASE_ENV = /WEWED_AI_(?:DEFAULT|REASONING|FALLBACK)_MODEL/
const MODEL_OVERRIDE_PROPERTY = /\bmodelOverride\s*:/

describe('Wewed AI bypass freeze', () => {
  test('no new provider HTTP endpoint bypasses appear outside the transport layer', () => {
    const violations: string[] = []
    for (const absolute of sourceFiles(join(process.cwd(), 'src'))) {
      const path = relative(process.cwd(), absolute).replaceAll('\\', '/')
      if (path === SELF || TRANSPORT_FILES.has(path) || LEGACY_PROVIDER_ENDPOINT_EXCEPTIONS.has(path)) continue
      const source = readFileSync(absolute, 'utf8')
      if (PROVIDER_ENDPOINT_MARKERS.some((marker) => source.includes(marker))) violations.push(path)
    }
    expect(violations).toEqual([])
  })

  test('the Phase 0 legacy endpoint exception list remains real and auditable', () => {
    for (const path of LEGACY_PROVIDER_ENDPOINT_EXCEPTIONS) {
      const source = readFileSync(join(process.cwd(), path), 'utf8')
      expect(PROVIDER_ENDPOINT_MARKERS.some((marker) => source.includes(marker))).toBe(true)
    }
  })

  test('no feature can call the provider transport directly', () => {
    const violations: string[] = []
    for (const absolute of sourceFiles(join(process.cwd(), 'src'))) {
      const path = relative(process.cwd(), absolute).replaceAll('\\', '/')
      if (DIRECT_TRANSPORT_CALLERS.has(path)) continue
      const source = readFileSync(absolute, 'utf8')
      if (source.includes('callAiProvider(')) violations.push(path)
    }
    expect(violations).toEqual([])
  })

  test('model override and global model release configuration stay inside the router/Core boundary', () => {
    const violations: string[] = []
    for (const absolute of sourceFiles(join(process.cwd(), 'src'))) {
      const path = relative(process.cwd(), absolute).replaceAll('\\', '/')
      if (CORE_MODEL_FILES.has(path) || path === 'src/lib/ai/provider-clients.ts') continue
      const source = readFileSync(absolute, 'utf8')
      if (MODEL_OVERRIDE_PROPERTY.test(source) || MODEL_RELEASE_ENV.test(source)) violations.push(path)
    }
    expect(violations).toEqual([])
  })
})
