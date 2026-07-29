import { describe, expect, test } from 'bun:test'
import {
  ACTIVE_PLANNER_SOURCE_PATHS,
  INTENTIONAL_UPGRADES,
  KNOWN_ACTIVE_PARITY_GAPS,
  ORIGINAL_PLANNER_PARITY,
  ORIGINAL_PLANNER_SOURCE,
  missingActiveCapabilities,
  missingMarkers,
} from './planner-parity-contract'

const ACTIVE_PLANNER_MODULE_SOURCE_PATHS = [
  'src/components/wedding/planner/modules/planner-tasks-module.tsx',
  'src/components/wedding/planner/modules/planner-budget-module.tsx',
  'src/components/wedding/planner/modules/planner-vendors-module.tsx',
  'src/components/wedding/planner/modules/planner-guests-module.tsx',
  'src/components/wedding/planner/modules/planner-timeline-module.tsx',
  'src/components/wedding/planner/modules/planner-seating-module.tsx',
] as const

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

describe('original planner parity contract', () => {
  test('covers every original core planner module', () => {
    const modules = new Set(ORIGINAL_PLANNER_PARITY.map((capability) => capability.module))
    expect([...modules].sort()).toEqual(
      ['budget', 'guests', 'seating', 'shell', 'tasks', 'timeline', 'vendors'].sort(),
    )
  })

  test('uses unique capability identifiers', () => {
    const ids = ORIGINAL_PLANNER_PARITY.map((capability) => capability.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('the contract is supported by the original WeddingPlanner source', async () => {
    const original = await source(ORIGINAL_PLANNER_SOURCE)
    const failures = ORIGINAL_PLANNER_PARITY.flatMap((capability) => {
      const missing = missingMarkers(original, capability.originalMarkers)
      return missing.length ? [{ id: capability.id, missing }] : []
    })

    expect(failures).toEqual([])
  })

  test('the active planner has only the explicitly documented parity debt', async () => {
    const activeSources = await Promise.all(
      [...ACTIVE_PLANNER_SOURCE_PATHS, ...ACTIVE_PLANNER_MODULE_SOURCE_PATHS].map(source),
    )
    const activeSurface = activeSources.join('\n')

    expect(missingActiveCapabilities(activeSurface)).toEqual([...KNOWN_ACTIVE_PARITY_GAPS])
  })

  test('documented parity debt is valid and cannot name unknown capabilities', () => {
    const capabilityIds = new Set(ORIGINAL_PLANNER_PARITY.map((capability) => capability.id))
    const unknown = KNOWN_ACTIVE_PARITY_GAPS.filter((id) => !capabilityIds.has(id))
    expect(unknown).toEqual([])
    expect(new Set(KNOWN_ACTIVE_PARITY_GAPS).size).toBe(KNOWN_ACTIVE_PARITY_GAPS.length)
  })

  test('the Phase 4 shell improvements remain intentional upgrades', async () => {
    const [portal, workspace, original] = await Promise.all([
      source('src/components/wedding/planner-portal.tsx'),
      source('src/components/wedding/planner-workspace.tsx'),
      source(ORIGINAL_PLANNER_SOURCE),
    ])

    expect(INTENTIONAL_UPGRADES.length).toBeGreaterThan(0)
    // Props such as a wedding-specific key may strengthen isolation; the workspace must remain mounted.
    expect(portal).toContain('<PlannerWorkspace')
    expect(portal).toContain('h-dvh')
    expect(portal).toContain('WeddingContextControls')
    expect(workspace).not.toContain('<Dialog')
    expect(workspace).not.toContain('SEED_')
    expect(workspace).not.toContain('Charity')
    expect(workspace).not.toContain('Kudzie')

    // The original remains the comparison baseline, not the component to remount wholesale.
    expect(original).toContain('SEED_TASKS')
    expect(original).toContain('<Dialog')
  })

  test('retained Phase 1-6 surfaces stay mounted while parity is restored', async () => {
    const portal = await source('src/components/wedding/planner-portal.tsx')

    expect(portal).toContain('WeddingContextControls')
    expect(portal).toContain('PlannerInvitationTools')
    expect(portal).toContain('PlannerOperations')
    expect(portal).toContain('PlannerCollaborationHub')
    expect(portal).toContain('PlannerClientProfile')
    expect(portal).toContain('PlannerEventCommand')
  })
})
