import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('provider form security regressions', () => {
  test('provider offering readiness is explicitly typed before calculation', () => {
    const route = source('src/app/api/providers/profile/route.ts')
    expect(route).toContain('completionScore: 0')
    expect(route).toContain('offering.completionScore = offeringCompletion')
  })

  test('private verification details are not persisted in browser autosave storage', () => {
    const manager = source('src/components/providers/provider-profile-manager.tsx')
    expect(manager).toContain('JSON.stringify({ profile, offerings, savedAt })')
    expect(manager).not.toContain('JSON.stringify({ profile, verification, offerings, savedAt })')
    expect(manager).not.toContain('nextVerification = restored.verification')
  })

  test('verification data remains on the authenticated private API only', () => {
    const privateRoute = source('src/app/api/providers/profile/route.ts')
    const publicDirectory = source('src/app/api/providers/route.ts')
    const publicProfile = source('src/app/api/providers/[slug]/route.ts')
    expect(privateRoute).toContain('ProviderVerification')
    expect(publicDirectory).not.toContain('ProviderVerification')
    expect(publicProfile).not.toContain('ProviderVerification')
  })
})
