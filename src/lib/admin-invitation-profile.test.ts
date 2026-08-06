import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path), 'utf8')

describe('administrator invitation and profile contract', () => {
  test('invitation flow avoids the fragile Supabase user-list endpoint', () => {
    const route = source('src/app/api/admin/roles/route.ts')

    expect(route).not.toContain('findSupabaseAuthUserByEmail')
    expect(route).not.toContain('.listUsers(')
    expect(route).toContain('FROM auth.users')
    expect(route).toContain("/admin/accept-invite")
    expect(route).toContain("membershipStatus === 'active' ? 'active' : 'invited'")
    expect(route).toContain("status = CASE")
    expect(route).toContain("ELSE 'invited'")
  })

  test('administrator profiles stay private and include professional fields', () => {
    const migration = source(
      'prisma/migrations/20260806090000_admin_invitation_profiles/migration.sql',
    )

    expect(migration).toContain('wewed_admin."AdministratorProfile"')
    expect(migration).toContain('"alternateEmails" JSONB')
    expect(migration).toContain('"phone" TEXT')
    expect(migration).toContain('"addressLine1" TEXT')
    expect(migration).toContain('"certificates" JSONB')
    expect(migration).toContain('"invitationStatus" TEXT')
    expect(migration).toContain('REVOKE ALL PRIVILEGES')
    expect(migration).not.toContain('CREATE VIEW public."AdministratorProfile"')
  })

  test('acceptance requires a Supabase bearer session before activation', () => {
    const route = source('src/app/api/admin/invitations/accept/route.ts')
    const page = source('src/app/admin/accept-invite/page.tsx')

    expect(route).toContain("request.headers.get('authorization')")
    expect(route).toContain('service.auth.getUser(token)')
    expect(route).toContain("!['invited', 'active'].includes(membership.status)")
    expect(route).toContain("SET status = 'active'")
    expect(route).toContain("'admin_membership.accepted'")
    expect(route).toContain('"profileCompletedAt" = CURRENT_TIMESTAMP')
    expect(page).toContain('exchangeCodeForSession')
    expect(page).toContain('supabase.auth.setSession')
    expect(page).toContain('Accept invitation and activate account')
  })

  test('role-management form captures the complete invitation profile', () => {
    const form = source('src/components/admin/admin-role-management.tsx')

    expect(form).toContain('Full name')
    expect(form).toContain('Phone number')
    expect(form).toContain('Alternate email addresses')
    expect(form).toContain('Address line 1')
    expect(form).toContain('Certificates and credentials')
    expect(form).toContain('Send invitation')
    expect(form).toContain('<option value="invited">Invited</option>')
  })
})
