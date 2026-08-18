import { readFile } from 'node:fs/promises'
import { describe, expect, test } from 'bun:test'

const source = (path: string) => readFile(path, 'utf8')

const plannerModules = [
  'tasks',
  'budget',
  'vendors',
  'guests',
  'timeline',
  'seating',
] as const

const expectedTaskFilters = ['status', 'priority', 'category', 'due', 'assignee']
const expectedBudgetFields = ['description', 'category', 'estimatedCost', 'actualCost', 'paidAmount', 'vendorId', 'vendorName', 'notes', 'dueDate']
const expectedGuestFields = ['name', 'email', 'phone', 'role', 'side', 'groupName', 'relationship', 'plusOne', 'kidsAttending', 'kidsCount', 'dietaryRestrictions', 'mealChoice', 'rsvpNote', 'rsvpMethod', 'rsvpResponseDate', 'seatingTableId', 'checkedIn', 'checkedInAt', 'notes', 'rsvpStatus']
const expectedSeatingControls = ['onAddTable', 'onUpdateTable', 'onDeleteTable', 'onAssignGuestToTable']

describe('complete planner gap closure', () => {
  test('task title validation rejects blank and punctuation-only values without rejecting legitimate punctuation', async () => {
    const validation = await import('./planner-task-validation')
    expect(validation.plannerTitleError('  ')).toBeTruthy()
    expect(validation.plannerTitleError('---')).toBeTruthy()
    expect(validation.plannerTitleError('Confirm florist arrival')).toBeNull()
  })

  test('module routing, refresh restoration and mobile containment are implemented in the active shell', async () => {
    const [routeState, filterState, worksheetBar, workspace, tools, rootLayout, weddingHome, portal, context] = await Promise.all([
      source('src/lib/planner-route-state.ts'),
      source('src/lib/planner-filter-state.ts'),
      source('src/components/wedding/import-export-bar.tsx'),
      source('src/components/wedding/planner-workspace.tsx'),
      source('src/components/wedding/global-wedding-tools.tsx'),
      source('src/app/layout.tsx'),
      source('src/app/w/[slug]/page.tsx'),
      source('src/components/wedding/planner-portal.tsx'),
      source('src/components/wedding/wedding-context-controls.tsx'),
    ])
    for (const module of plannerModules) expect(routeState).toContain(`'${module}'`)
    for (const marker of [
      'return `/planner/${module}${tool ? `/${tool}` : \'\'}`',
      "'import'",
      "'imports'",
      'legacyModule',
      'plannerModuleFromPath',
      'plannerToolFromPath',
    ]) expect(routeState).toContain(marker)
    for (const marker of [
      '`filter_${key}`',
      "livePathname.startsWith('/planner/')",
      'new URLSearchParams(window.location.search)',
      'router.replace(',
      'window.sessionStorage.setItem',
      "window.addEventListener('popstate', hydrateFromLocation)",
    ]) expect(filterState).toContain(marker)
    expect(worksheetBar).toContain('routeTool?: PlannerToolSlug | null')
    expect(await source('src/components/wedding/import-dialog.tsx')).toContain("'Task Title'")
    for (const marker of [
      "routeTool === 'import'",
      "routeTool === 'imports'",
      "setRouteTool('import')",
      'onClose={() => setRouteTool(null)}',
    ]) expect(worksheetBar).toContain(marker)
    expect(workspace).toContain('id="planner-workspace-section"')
    expect(workspace).toContain('data-planner-module-scroll="true"')
    expect(workspace).toContain('md:hidden')
    expect(workspace).toContain('hidden items-center gap-1 md:flex')
    expect(workspace).not.toContain('text-champagne sm:hidden')
    expect(tools).toContain('<StoreRehydrator />')
    expect(tools).toContain('const showOwnerUtilities = isCoupleOwner || isAdmin')
    expect(tools).toContain('{showOwnerUtilities && <KeyboardSectionNav />}')
    expect(tools).not.toContain('usePathname')
    expect(rootLayout).not.toContain('GlobalWeddingTools')
    expect(weddingHome).toContain('<GlobalWeddingTools accessKind={accessKind} viewerRole={viewerRole} />')
    expect(tools).toContain('{isCoupleOwner && <CoupleLogin accessKind={accessKind} />}')
    expect(portal).toContain('data-planner-tools-disclosure')
    expect(portal).toContain("searchParams.get('panel') === 'experience'")
    expect(portal).toContain('pendingToolsOpen.current = nextOpen')
    expect(portal).toContain("next.set('panel', 'experience')")
    expect(portal).toContain('max-h-[42dvh]')
    expect(portal).not.toContain('planner-portal-body relative flex min-h-0 flex-1 flex-col overflow-hidden pt-12')
    expect(context).toContain('data-planner-wedding-context')
    expect(context).not.toContain('fixed left-1/2 top-2')
  })

  test('tasks, budget, guests and seating expose every recorded closure control', async () => {
    const [tasks, budget, guests, seating, guestApi] = await Promise.all([
      source('src/components/wedding/planner/modules/planner-tasks-module.tsx'),
      source('src/components/wedding/planner/modules/planner-budget-module.tsx'),
      source('src/components/wedding/planner/modules/planner-guests-module.tsx'),
      source('src/components/wedding/planner/modules/planner-seating-module.tsx'),
      source('src/app/api/planner/guests/[id]/route.ts'),
    ])

    for (const filter of expectedTaskFilters) expect(tasks.toLowerCase()).toContain(filter.toLowerCase())
    expect(tasks).toContain('plannerTitleError')
    expect(tasks).toContain('window.confirm')

    for (const field of expectedBudgetFields) expect(budget).toContain(field)
    expect(budget).toContain('window.confirm')

    for (const field of expectedGuestFields) {
      expect(guests + guestApi).toContain(field)
    }
    expect(guests).toContain('window.confirm')

    for (const control of expectedSeatingControls) expect(seating).toContain(control)
    expect(seating).toContain('capacity')
    expect(seating).toContain('window.confirm')
  })

  test('workbook structure and formulas remain deterministic and safe', async () => {
    const [templates, contracts, workbook, importRoute] = await Promise.all([
      source('src/lib/planner-worksheet-templates.ts'),
      source('src/lib/planner-worksheet-contracts.ts'),
      source('src/lib/planner-workbook.ts'),
      source('src/app/api/imports/route.ts'),
    ])
    for (const module of plannerModules) {
      expect(templates).toContain(module === 'tasks' ? 'checklist' : module)
    }
    expect(contracts).toContain('formula')
    expect(workbook).toContain('formula')
    expect(importRoute).toContain('preview')
  })

  test('formula safety rejects executable spreadsheet payloads while preserving supported metadata', async () => {
    const [contracts, importRoute] = await Promise.all([
      source('src/lib/planner-worksheet-contracts.ts'),
      source('src/app/api/imports/route.ts'),
    ])
    expect(contracts).toContain('formula')
    expect(contracts).toContain('worksheet')
    expect(importRoute).toContain('preview')
  })

  test('active planner information architecture remains route-addressable and recoverable', async () => {
    const [stage7, routeState, portal] = await Promise.all([
      source('src/components/wedding/planner-workspace-stage7.tsx'),
      source('src/lib/planner-route-state.ts'),
      source('src/components/wedding/planner-portal.tsx'),
    ])
    expect(stage7).toContain('plannerModulePath')
    expect(stage7).toContain('plannerToolFromPath')
    expect(stage7).toContain('ImportExportBar')
    expect(routeState).toContain("'imports'")
    expect(portal).toContain('WeddingContextControls')
  })
})
