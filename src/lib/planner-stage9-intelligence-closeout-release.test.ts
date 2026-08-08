import { describe, expect, test } from 'bun:test'
import { KNOWN_ACTIVE_PARITY_GAPS } from './planner-parity-contract'
import {
  buildCloseoutEvaluation,
  buildPlannerRecommendations,
  buildReleaseEvaluation,
  canManageWeddingCanon,
  evaluateHealthEnvironment,
  type PlannerIntelligenceInput,
} from './planner-stage9'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

function baseInput(): PlannerIntelligenceInput {
  return {
    wedding: {
      title: 'Alpha Wedding',
      date: new Date('2026-01-01T00:00:00.000Z'),
      lifecycle: 'before',
      privacy: 'private',
      canonSealed: false,
    },
    tasks: { open: 0, overdue: 0, dueSoon: 0 },
    guests: { pending: 0, confirmedUnseated: 0, withoutEmail: 0 },
    budget: { outstanding: 0, overduePayments: 0, currency: 'USD' },
    vendors: { unsigned: 0, unpaid: 0, missingContact: 0 },
    timeline: { total: 0, incomplete: 0 },
    event: { openIssues: 0, criticalIssues: 0 },
    reminders: { failed: 0 },
    imports: { failed: 0 },
    submissions: { pending: 0 },
    profile: { missing: [] },
    release: { activeOwners: 1, overCapacityTables: 0 },
  }
}

describe('Stage 9 wedding-scoped intelligence', () => {
  test('recommendations are prioritized and include explainable task evidence', () => {
    const input = baseInput()
    input.event.criticalIssues = 1
    input.event.openIssues = 1
    input.tasks.open = 4
    input.tasks.overdue = 4
    input.budget.outstanding = 1250
    input.budget.overduePayments = 1

    const recommendations = buildPlannerRecommendations(input)

    expect(recommendations.map((item) => item.id).slice(0, 3)).toEqual([
      'event-critical-issues',
      'tasks-overdue',
      'budget-outstanding',
    ])
    expect(recommendations[0]?.severity).toBe('critical')
    expect(recommendations[0]?.evidence).toContain('1 critical/high issue')
    expect(recommendations[0]?.task?.category).toBe('wedding_day')
    expect(recommendations.find((item) => item.id === 'budget-outstanding')?.evidence).toContain('$1,250')
  })

  test('clean selected-wedding data produces no active recommendations', () => {
    expect(buildPlannerRecommendations(baseInput())).toEqual([])
  })

  test('closeout requires a passed date and every blocking operational check', () => {
    const clean = baseInput()
    const ready = buildCloseoutEvaluation(clean, new Date('2026-07-30T00:00:00.000Z'))
    expect(ready.ready).toBe(true)
    expect(ready.completed).toBe(ready.total)

    const blocked = baseInput()
    blocked.wedding.date = new Date('2027-01-01T00:00:00.000Z')
    blocked.tasks.open = 1
    blocked.vendors.unpaid = 1
    const result = buildCloseoutEvaluation(blocked, new Date('2026-07-30T00:00:00.000Z'))
    expect(result.ready).toBe(false)
    expect(result.datePassed).toBe(false)
    expect(result.checks.find((check) => check.id === 'tasks-closed')?.complete).toBe(false)
    expect(result.checks.find((check) => check.id === 'vendors-closed')?.complete).toBe(false)
  })

  test('release readiness blocks incomplete profile, missing owner, failed delivery and over-capacity', () => {
    const input = baseInput()
    input.profile.missing = ['venue map']
    input.release.activeOwners = 0
    input.reminders.failed = 2
    input.release.overCapacityTables = 1

    const result = buildReleaseEvaluation(input)
    expect(result.ready).toBe(false)
    expect(result.checks.filter((check) => !check.complete).map((check) => check.id)).toEqual([
      'profile-complete',
      'active-owner',
      'reminders-clean',
      'seating-capacity-safe',
    ])
  })

  test('canon management is limited to owners, admins, or wildcard access', () => {
    expect(canManageWeddingCanon('owner', [])).toBe(true)
    expect(canManageWeddingCanon('admin', [])).toBe(true)
    expect(canManageWeddingCanon('planner', ['*'])).toBe(true)
    expect(canManageWeddingCanon('planner', ['content.edit'])).toBe(false)
  })
})

describe('Stage 9 release hardening helpers', () => {
  test('production health requires HTTPS, a non-local origin, and a strong session secret', () => {
    const ready = evaluateHealthEnvironment({
      nodeEnv: 'production',
      databaseUrl: 'postgres://database',
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon',
      sessionSecret: 'a-strong-session-secret-with-32-chars',
      siteUrl: 'https://planner.example.com',
      productionSiteUrl: 'https://planner.example.com',
    })
    expect(ready.siteUrlValid).toBe(true)
    expect(ready.productionSiteMatches).toBe(true)
    expect(ready.requiredEnvironmentReady).toBe(true)

    const unsafe = evaluateHealthEnvironment({
      nodeEnv: 'production',
      databaseUrl: 'postgres://database',
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon',
      sessionSecret: 'short',
      siteUrl: 'http://localhost:3000',
    })
    expect(unsafe.siteUrlValid).toBe(false)
    expect(unsafe.requiredEnvironment.sessionSecret).toBe(false)
    expect(unsafe.requiredEnvironmentReady).toBe(false)
  })
})

describe('Stage 9 API and UI regression controls', () => {
  test('release-centre reads and writes remain active-wedding scoped and permission protected', async () => {
    const route = await source('src/app/api/planner/release-center/route.ts')

    for (const marker of [
      "requireWeddingPermission(request, 'planner.view')",
      "action === 'seal_canon' || action === 'reopen_canon' ? 'content.edit' : 'planner.edit'",
      'access.context.weddingId',
      'where: { weddingId }',
      'where: { id: weddingId }',
      "section: { in: ['event_day_issue', 'event_day_timeline_status'] }",
      "status: { in: ['pending', 'submitted'] }",
      "where: { weddingId, status: 'active', role: 'owner' }",
    ]) {
      expect(route).toContain(marker)
    }

    expect(route).not.toContain('openai')
    expect(route).not.toContain('anthropic')
    expect(route).not.toContain('.delete(')
    expect(route).not.toContain('deleteMany')
  })

  test('recommendation task creation is revalidated, duplicate safe, scoped and audited', async () => {
    const route = await source('src/app/api/planner/release-center/route.ts')

    for (const marker of [
      "action === 'create_recommendation_task'",
      'centre.recommendations.find(',
      'candidate.id === recommendationId && candidate.task',
      'status: { not:',
      'description: { contains: marker }',
      'weddingId,',
      "action: 'intelligence.task_create'",
      "resourceType: 'planner_task'",
      'recommendationId: recommendation.id',
      'duplicate: true',
    ]) {
      expect(route).toContain(marker)
    }
  })

  test('closeout and canon transitions require cleared blockers, exact confirmation and audit events', async () => {
    const route = await source('src/app/api/planner/release-center/route.ts')

    for (const marker of [
      "action === 'complete_closeout'",
      'confirmation !== centre.input.wedding.title',
      '!centre.closeout.datePassed || !centre.closeout.ready',
      "data: { lifecycle: 'after' }",
      "action: 'closeout.lifecycle_after'",
      "action === 'seal_canon' || action === 'reopen_canon'",
      'canManageWeddingCanon(access.context.role, access.context.permissions)',
      "centre.input.wedding.lifecycle !== 'after' || !centre.closeout.ready",
      "action: seal ? 'closeout.canon_seal' : 'closeout.canon_reopen'",
      'canonSealedAt: seal ? new Date() : null',
    ]) {
      expect(route).toContain(marker)
    }
  })

  test('release centre is mounted in the active-wedding navigation and never writes on mount', async () => {
    const [portal, component, route] = await Promise.all([
      source('src/components/wedding/planner-portal.tsx'),
      source('src/components/wedding/planner-release-center.tsx'),
      source('src/app/api/planner/release-center/route.ts'),
    ])

    expect(portal).toContain("import { PlannerReleaseCenter }")
    expect(portal).toContain('<PlannerReleaseCenter />')
    expect(portal).toContain("key={`tools-${wedding?.id ?? 'no-active-wedding'}`}")
    expect(portal).toContain('execute → close')

    expect(component).toContain("fetch('/api/planner/release-center', { cache: 'no-store' })")
    expect(component).toContain("fetch('/api/health', { cache: 'no-store' })")
    expect(component).toContain('data.intelligence.explanation')
    expect(route).toContain('No client data is sent to an external AI provider.')
    expect(component).toContain("method: 'POST'")
    expect(component).toContain('window.confirm(')
    expect(component).toContain('window.prompt(')
    expect(component).toContain('Create task')
    expect(component).toContain('Complete closeout')
    expect(component).toContain('Seal canon')
    expect(component).toContain('Reopen canon')

    const openEffect = component.slice(component.indexOf('useEffect(() =>'), component.indexOf('async function runAction'))
    expect(openEffect).not.toContain("method: 'POST'")
  })

  test('health readiness is environment-aware and no longer tied to one hostname', async () => {
    const health = await source('src/app/api/health/route.ts')

    expect(health).toContain('evaluateHealthEnvironment')
    expect(health).toContain('sessionSecret: process.env.WEWED_SESSION_SECRET')
    expect(health).toContain('productionSiteUrl: process.env.PRODUCTION_SITE_URL')
    expect(health).toContain('environment.siteUrlValid')
    expect(health).toContain('environment.productionSiteMatches')
    expect(health).not.toContain('EXPECTED_SITE_URL')
    expect(health).not.toContain(['wewed-nu', 'vercel', 'app'].join('.'))
  })

  test('release runbook covers health, permissions, smoke tests, rollback, privacy and incident response', async () => {
    const runbook = await source('docs/planner-alpha-to-release-runbook.md')

    for (const marker of [
      '# Wewed Planner Alpha-to-Release Runbook',
      '## 1. Environment and health',
      '## 2. Migration and rollback safety',
      '## 3. Authentication and permission matrix',
      '## 4. Core planner smoke test',
      '## 6. Planner intelligence validation',
      '## 8. Post-wedding closeout',
      '## 9. Privacy and export review',
      '## 10. Incident response',
      'Closeout never deletes operational records.',
    ]) {
      expect(runbook).toContain(marker)
    }
  })

  test('zero original planner parity gaps remain', () => {
    expect([...KNOWN_ACTIVE_PARITY_GAPS]).toEqual([])
  })
})
