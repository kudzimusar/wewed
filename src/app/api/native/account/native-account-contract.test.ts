import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = (path: string) => readFileSync(path, 'utf8')

describe('native account sign-in stays read-only (master plan Phase 5)', () => {
  test('does not delegate to the browser sign-in route or its account-graph writes', () => {
    const signin = source('src/app/api/native/account/signin/route.ts')

    // Must verify Supabase credentials directly, not by importing the browser flow.
    expect(signin).toContain("createClient } from '@supabase/supabase-js'")
    expect(signin).toContain('persistSession: false')
    expect(signin).toContain('signInWithPassword')
    expect(signin).not.toContain('browserSignIn')
    expect(signin).not.toContain("from '@/app/api/auth/signin/route'")

    // None of the browser flow's account-graph mutations may appear here.
    expect(signin).not.toContain('acceptPendingMemberships')
    expect(signin).not.toContain('.update(')
    expect(signin).not.toContain('.upsert(')
    expect(signin).not.toContain('.create(')
    expect(signin).not.toContain('setAppSessionCookie')
    expect(signin).not.toContain('AppSession')

    // Issues only the narrow identity session; carries no role or wedding selection.
    expect(signin).toContain('createNativeAccountSessionToken')
    expect(signin).not.toContain('role:')
    expect(signin).not.toContain('activeWeddingId')
  })

  test('the authority endpoint is read-only and returns the unflattened contract as-is', () => {
    const authority = source('src/app/api/native/account/authority/route.ts')

    expect(authority).toContain('readBearerNativeAccountSession')
    expect(authority).toContain('resolveProductionAuthority')
    expect(authority).toContain('authUserId: session.authUserId')

    // No write of any kind, and no server-side context/grant selection.
    expect(authority).not.toContain('.update(')
    expect(authority).not.toContain('.upsert(')
    expect(authority).not.toContain('.create(')
    expect(authority).not.toContain('acceptPendingMemberships')
    expect(authority).not.toContain('grantId')

    // The full contract is returned, not a flattened role.
    expect(authority).toContain('{ success: true, authority }')
  })

  test('the workspace snapshot revalidates grant authority and accepts no raw scope id', () => {
    const workspace = source('src/app/api/native/account/workspace/route.ts')

    expect(workspace).toContain('readBearerNativeAccountSession')
    expect(workspace).toContain('resolveProductionAuthority')
    expect(workspace).toContain("authority.accountStatus !== 'authorized'")
    expect(workspace).toContain("item.grantId === grantId")
    expect(workspace).toContain("grant.scopeKind === 'wedding'")
    expect(workspace).toContain('where: { id: grant.weddingId }')

    // The caller selects only one server-issued grant id. Wedding/business/vendor ids are derived
    // from that freshly-resolved grant, never trusted from query/body input.
    expect(workspace).not.toContain("searchParams.get('weddingId')")
    expect(workspace).not.toContain("searchParams.get('businessAccountId')")
    expect(workspace).not.toContain("searchParams.get('vendorId')")

    expect(workspace).not.toContain('.update(')
    expect(workspace).not.toContain('.upsert(')
    expect(workspace).not.toContain('.create(')
    expect(workspace).not.toContain('acceptPendingMemberships')
  })

  test('the native identity session never appears alongside the Guest Session identity path', () => {
    const session = source('src/lib/native-account-session.ts')
    expect(session).not.toContain('wedding-guest-session')
    expect(session).not.toContain('rsvpToken')
    expect(session).not.toContain('invitationVersionFingerprint')

    for (const path of [
      'src/app/api/native/account/signin/route.ts',
      'src/app/api/native/account/authority/route.ts',
    ]) {
      const file = source(path)
      expect(file).not.toContain('wedding-guest-session')
      expect(file).not.toContain('GuestSession')
    }
  })
})
