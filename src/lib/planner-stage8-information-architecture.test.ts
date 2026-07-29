import { describe, expect, test } from 'bun:test'
import { KNOWN_ACTIVE_PARITY_GAPS } from './planner-parity-contract'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

function occurrences(value: string, marker: string): number {
  return value.split(marker).length - 1
}

describe('Stage 8 planner information architecture', () => {
  test('portal exposes one explicit daily navigation path with planning as the default view', async () => {
    const portal = await source('src/components/wedding/planner-portal.tsx')

    for (const marker of [
      'function PlannerExperienceNavigation',
      'data-planner-experience-nav',
      'aria-label="Planner experience navigation"',
      'Plan → coordinate → update → operate → execute',
      'href="#planner-workspace"',
      'aria-current="page"',
      'Planning workspace',
      '<PlannerCollaborationHub />',
      '<PlannerClientProfile />',
      '<PlannerOperations />',
      '<PlannerInvitationTools />',
      '<PlannerEventCommand />',
      'id="planner-workspace"',
    ]) {
      expect(portal).toContain(marker)
    }

    for (const component of [
      '<PlannerCollaborationHub />',
      '<PlannerClientProfile />',
      '<PlannerOperations />',
      '<PlannerInvitationTools />',
      '<PlannerEventCommand />',
    ]) {
      expect(occurrences(portal, component)).toBe(1)
    }
  })

  test('legacy floating triggers are normalized inside a keyboard and mobile-safe strip', async () => {
    const portal = await source('src/components/wedding/planner-portal.tsx')

    for (const marker of [
      'overflow-x-auto',
      'overscroll-x-contain',
      'data-planner-tool-triggers',
      '[data-planner-tool-triggers] > button',
      'position: static !important',
      'inset: auto !important',
      'box-shadow: none !important',
      '[data-planner-tool-triggers] > button span',
      'display: inline !important',
    ]) {
      expect(portal).toContain(marker)
    }
  })

  test('active-wedding changes remount the unified tools and the planning workspace', async () => {
    const portal = await source('src/components/wedding/planner-portal.tsx')

    expect(portal).toContain("window.addEventListener('wewed:wedding-switched', loadSession)")
    expect(portal).toContain("key={`tools-${wedding?.id ?? 'no-active-wedding'}`}")
    expect(portal).toContain("<PlannerWorkspace key={wedding?.id ?? 'no-active-wedding'} />")
    expect(portal).toContain('<WeddingContextControls />')
  })

  test('collaboration remains wedding-scoped and keeps all Phase 3 surfaces', async () => {
    const collaboration = await source('src/components/wedding/planner-collaboration-hub.tsx')

    for (const marker of [
      "fetch('/api/planner/collaboration'",
      "'upsert_vendor_pipeline'",
      "'create_approval'",
      "'decide_approval'",
      "'create_document'",
      "'create_comment'",
      'My Work',
      'Approvals',
      'Documents',
      'Discussion',
      'Notifications',
    ]) {
      expect(collaboration).toContain(marker)
    }
  })

  test('client, operations, invitations, and event command retain their existing APIs', async () => {
    const [profile, operations, invitations, eventCommand] = await Promise.all([
      source('src/components/wedding/planner-client-profile.tsx'),
      source('src/components/wedding/planner-operations.tsx'),
      source('src/components/wedding/planner-invitation-tools.tsx'),
      source('src/components/wedding/planner-event-command.tsx'),
    ])

    for (const marker of [
      "fetch('/api/planner/client-profile'",
      "method: 'PATCH'",
      "new CustomEvent('wewed:client-profile-updated')",
    ]) {
      expect(profile).toContain(marker)
    }

    for (const marker of [
      "fetch('/api/planner/overview'",
      "fetch('/api/planner/reminders'",
      "fetch('/api/planner/templates'",
      "fetch('/api/planner/seating/auto-assign'",
      'Reminders',
      'Templates',
      'Seating',
      'Imports',
    ]) {
      expect(operations).toContain(marker)
    }

    expect(invitations).toContain("fetch('/api/planner/guests/invitations', { method: 'POST' })")
    expect(invitations).toContain("fetch('/api/planner/guests/invitations?format=csv'")

    for (const marker of [
      "fetch('/api/planner/event-day'",
      "action: 'set_check_in'",
      "action: 'set_timeline_status'",
      "action: 'create_issue'",
      "action: resolved ? 'reopen_issue' : 'resolve_issue'",
      'window.setInterval(() => void load(false), 15_000)',
    ]) {
      expect(eventCommand).toContain(marker)
    }
  })

  test('the Alpha tester daily workflow documents planning through event execution', async () => {
    const workflow = await source('docs/planner-alpha-daily-workflow.md')

    for (const marker of [
      '# Wewed Planner Alpha Daily Workflow',
      '## 1. Plan in the workspace',
      '## 2. Coordinate in Team Hub',
      '## 3. Update the client profile',
      '## 4. Run daily operations',
      '## 5. Execute the wedding day',
      '## Switching weddings safely',
      'Opening the planner never imports or seeds data automatically.',
    ]) {
      expect(workflow).toContain(marker)
    }
  })

  test('zero original planner parity gaps remain', () => {
    expect([...KNOWN_ACTIVE_PARITY_GAPS]).toEqual([])
  })
})
