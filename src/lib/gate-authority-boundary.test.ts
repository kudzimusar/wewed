import { describe, expect, test } from 'bun:test'

describe('Phase 10 gate authority boundaries', () => {
  test('gate management never inherits the legacy global-admin wedding shortcut', async () => {
    const source = await Bun.file('src/lib/gate-authority.ts').text()
    expect(source).not.toContain("@/lib/wedding-access")
    expect(source).not.toContain('getWeddingContext')
    expect(source).not.toContain('requireWeddingPermission')
    expect(source).toContain('resolveProductionAuthority')
    expect(source).toContain("grant.permissions.includes('members.manage')")
  })

  test('native gate enforcement always re-resolves fresh production authority', async () => {
    const source = await Bun.file('src/lib/native-gate-context.ts').text()
    expect(source).toContain('resolveProductionAuthority')
    expect(source).toContain('requireGateOperationalGrant')
    expect(source).not.toContain('weddingIdOverride')
    expect(source).not.toContain('gateIdOverride')
    expect(source).not.toContain('operatorUserIdOverride')
  })

  test('gate management and native context routes are no-store authority surfaces', async () => {
    const management = await Bun.file('src/app/api/weddings/gates/route.ts').text()
    const native = await Bun.file('src/app/api/native/gate/context/route.ts').text()
    expect(management).toContain("'cache-control': 'no-store'")
    expect(native).toContain('noStoreJson')
  })
})
