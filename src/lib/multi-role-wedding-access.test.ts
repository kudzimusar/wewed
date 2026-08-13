import { describe, expect, test } from 'bun:test'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

describe('multi-role wedding identity', () => {
  test('wedding owners keep personal wedding access even when they also have a business account', async () => {
    const access = await source('src/lib/wedding-access.ts')

    expect(access).toContain("m.role = 'owner'")
    expect(access).toContain('GOVERNED_WEDDING_ACCESS')
    expect(access).toContain('BUSINESS_TEAM_MANAGEMENT_ACCESS')
  })

  test('the browser session keeps global capability and active wedding role separately', async () => {
    const [auth, gate] = await Promise.all([
      source('src/lib/admin-auth.ts'),
      source('src/components/wedding/dashboard-auth-gate.tsx'),
    ])

    expect(auth).toContain('activeWeddingRole')
    expect(auth).toContain('activeWedding?.membershipRole')
    expect(gate).toContain("user.activeWeddingRole === 'owner'")
    expect(gate).toContain("allowedRoles?.includes('couple')")
    expect(gate).toContain('ownerActsAsCouple')
  })
})

describe('wedding team invitations', () => {
  test('registered users are resolved without enumerating Supabase Auth users', async () => {
    const route = await source('src/app/api/weddings/members/route.ts')

    expect(route).not.toContain('auth.admin.listUsers')
    expect(route).toContain('FROM auth.users')
    expect(route).toContain('await db.user.findUnique({ where: { email } })')
    expect(route).toContain("{ success: false, error: 'Unable to invite this team member.' }")
  })

  test('a wedding membership does not overwrite an existing global account role', async () => {
    const route = await source('src/app/api/weddings/members/route.ts')

    expect(route).toContain('globalRole: user.role')
    expect(route).not.toContain('nextGlobalRole')
    expect(route).not.toContain('role: nextGlobalRole')
    expect(route).toContain("role === 'owner' && !user.coupleId ? wedding.coupleId : user.coupleId")
  })

  test('planner and coordinator appointments synchronize the governed business relationship', async () => {
    const route = await source('src/app/api/weddings/members/route.ts')

    expect(route).toContain('syncPlannerBusinessLink')
    expect(route).toContain("['planner', 'coordinator'].includes(input.role)")
    expect(route).toContain("relationship, \"createdAt\"")
    expect(route).toContain("'manages'")
    expect(route).toContain('planner-wedding-${input.membershipId}')
  })

  test('selecting a registered planner does not immediately render a false no-results state', async () => {
    const controls = await source('src/components/wedding/wedding-context-controls.tsx')

    expect(controls).toContain('selectedPlannerUserId')
    expect(controls).toContain('setSelectedPlannerUserId(planner.userId)')
    expect(controls).toContain('!plannerSearchError && !selectedPlannerUserId')
    expect(controls).toContain('Registered planner selected. Review the details below, then invite.')
  })
})
