import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path), 'utf8')

describe('provider commercial AI guidance boundary', () => {
  test('keeps provider commercial data private and read-only', () => {
    const route = source('src/app/api/providers/commercial-guidance/route.ts')
    expect(route).toContain("profile: 'private'")
    expect(route).toContain('allowFallback: false')
    expect(route).toContain("scope: 'provider-commercial-guidance'")
    expect(route).toContain('wrapUntrustedContext')
    expect(route).toContain('Never invent, estimate, infer or recommend a monetary amount.')
    expect(route).toContain('Never claim that a price, package, availability state or commercial term was saved.')
    expect(route).not.toContain('UPDATE wewed_admin')
    expect(route).not.toContain('INSERT INTO wewed_admin')
  })

  test('embeds draft-only AI coaching in the provider commercial workflow', () => {
    const manager = source('src/components/providers/provider-profile-manager.tsx')
    const coach = source('src/components/providers/provider-commercial-ai-coach.tsx')
    expect(manager).toContain('ProviderCommercialAiCoach')
    expect(coach).toContain('/api/providers/commercial-guidance')
    expect(coach).toContain('It cannot invent or save prices.')
    expect(coach).toContain('Draft guidance — review before changing your catalogue')
  })
})
