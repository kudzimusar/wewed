import { describe, expect, test } from 'bun:test'
import * as XLSX from 'xlsx'
import { plannerTitleError } from './planner-task-validation'
import { generateTemplate } from './import-engine/template'
import { parseFile } from './import-engine/parser'
import { generatePreview } from './import-engine/preview'
import { readZipEntries } from './import-engine/open-xml-workbook'
import { guestWorksheetSchema } from './import-engine/guest-worksheet-schema'
import type { ModuleSchema } from './import-engine/types'

async function source(path: string): Promise<string> { return Bun.file(path).text() }

describe('complete planner gap closure', () => {
  test('task title validation rejects blank and punctuation-only values without rejecting legitimate punctuation', () => {
    expect(plannerTitleError('   ')).toBe('Enter a task title.')
    expect(plannerTitleError('--- !!!')).toContain('letter or number')
    expect(plannerTitleError("Bride & groom's final walk-through")).toBeNull()
  })

  test('module routing, refresh restoration and mobile containment are implemented in the active shell', async () => {
    const [shell, workspace, tools, portal, context, routeState, filterState, worksheetBar, rootLayout, weddingHome] = await Promise.all([
      source('src/components/wedding/planner-workspace-stage7.tsx'),
      source('src/components/wedding/planner-workspace.tsx'),
      source('src/components/wedding/global-wedding-tools.tsx'),
      source('src/components/wedding/planner-portal.tsx'),
      source('src/components/wedding/wedding-context-controls.tsx'),
      source('src/lib/planner-route-state.ts'),
      source('src/lib/planner-filter-state.ts'),
      source('src/components/wedding/import-export-bar.tsx'),
      source('src/app/layout.tsx'),
      source('src/components/wedding/wedding-home.tsx'),
    ])
    for (const marker of [
      "searchParams.get('module')",
      'plannerModuleFromPath(pathname, legacyModule)',
      'plannerModulePath(activeTab, activeTool)',
      "next.delete('module')",
      "window.history.scrollRestoration = 'manual'",
      'wewed:planner:scroll:',
      'let savedPosition = 0',
      'if (!restored && savedPosition > 0 && position === 0) return',
      'const routeKey = pathname',
      'pendingActionsOpen.current = nextOpen',
      "window.addEventListener('pagehide', save)",
      "document.addEventListener('visibilitychange', saveWhenHidden)",
      'data-planner-primary-scroll',
      'data-active-planner-module={activeTab}',
      'onActiveTabChange={selectWorkspaceTab}',
      'router.push(',
      'router.replace(',
      'routeTool={activeTool}',
      'onRouteToolChange={selectWorkspaceTool}',
    ]) expect(shell).toContain(marker)
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
    expect(workspace).toContain('sm:hidden')
    expect(workspace).toContain('hidden items-center gap-1 sm:flex')
    expect(tools).toContain('<StoreRehydrator />')
    expect(tools).toContain('<KeyboardSectionNav />')
    expect(tools).not.toContain('usePathname')
    expect(rootLayout).not.toContain('GlobalWeddingTools')
    expect(weddingHome).toContain('<GlobalWeddingTools />')
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
      source('src/components/wedding/planner/modules/planner-seating-operations-module.tsx'),
      source('src/app/api/planner/guests/[id]/route.ts'),
    ])
    for (const marker of ['Save task', 'Description', 'Priority', 'Due date', 'Assignee', 'role="alert"', 'usePlannerFilterState']) expect(tasks).toContain(marker)
    for (const marker of ['Search item, vendor, category, or notes', 'All payment states', 'Vendor:', 'border-champagne bg-champagne']) expect(budget).toContain(marker)
    for (const marker of ['Save guest', 'Filter guests by side', 'Filter guests by RSVP', 'onUpdateGuest']) expect(guests).toContain(marker)
    for (const marker of ['Search table, zone, note, or Guest', 'Filter seating by table type', 'Filter seating by assignment', 'Filter seating by capacity', 'Filter seating by occupancy', 'Move selected', 'Print plan']) expect(seating).toContain(marker)
    expect(guestApi).toContain("NOT: { id: existing.id }")
    expect(guestApi).toContain("field: 'email'")
  })

  test('the generated guest workbook has no executable example rows and contains real Excel controls', async () => {
    const workbook = generateTemplate(guestWorksheetSchema)
    const parsed = await parseFile(workbook, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(parsed.firstSheetName).toBe('Template')
    expect(parsed.rows).toEqual([])
    expect(parsed.formulaCells).toEqual([])

    const entries = readZipEntries(workbook)
    const sheet = entries.get('xl/worksheets/sheet1.xml')?.toString('utf8') ?? ''
    const styles = entries.get('xl/styles.xml')?.toString('utf8') ?? ''
    const table = entries.get('xl/tables/table1.xml')?.toString('utf8') ?? ''
    const rels = entries.get('xl/worksheets/_rels/sheet1.xml.rels')?.toString('utf8') ?? ''
    for (const marker of ['state="frozen"', '<autoFilter', '<dataValidations', '<sheetProtection', '<conditionalFormatting', '<tableParts']) expect(sheet).toContain(marker)
    expect(styles).toContain('<protection locked="0"/>')
    expect(table).toContain('<tableColumns')
    expect(table).toContain('showRowStripes="1"')
    expect(rels).toContain('relationships/table')
  })

  test('formula cells are stripped and reported as invalid row/column preview errors', async () => {
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([['Name'], ['placeholder']])
    sheet.A2 = { t: 'n', f: '1+1', v: 2 }
    XLSX.utils.book_append_sheet(workbook, sheet, 'Template')
    const buffer = Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
    const parsed = await parseFile(buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(parsed.rows).toEqual([{ Name: '' }])
    expect(parsed.formulaCells).toEqual([{ rowIndex: 2, column: 'Name', address: 'A2' }])

    const schema: ModuleSchema = {
      key: 'media', name: 'Formula test', description: 'Formula rejection', version: '1.0.0',
      fields: [{ key: 'name', label: 'Name', required: true, type: 'string' }],
      rowToRecord: (row) => row, recordToRow: (row) => row,
      validateRow: () => [], fetchExisting: async () => [], upsert: async () => ({}),
    }
    const preview = await generatePreview(parsed, schema, 'wedding-1', 'formula.xlsx')
    expect(preview.rows[0].action).toBe('invalid')
    expect(preview.rows[0].errors).toContain('Formula detected in "Name" (A2). Replace it with a plain value.')
    expect(preview.newRecords).toBe(0)

    const headerWorkbook = XLSX.utils.book_new()
    const headerSheet = XLSX.utils.aoa_to_sheet([['placeholder'], ['Tariro']])
    headerSheet.A1 = { t: 's', f: '"Name"', v: 'Name' }
    XLSX.utils.book_append_sheet(headerWorkbook, headerSheet, 'Template')
    const headerBuffer = Buffer.from(XLSX.write(headerWorkbook, { type: 'buffer', bookType: 'xlsx' }))
    const headerParsed = await parseFile(headerBuffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    const headerPreview = await generatePreview(headerParsed, schema, 'wedding-1', 'formula-header.xlsx')
    expect(headerPreview.invalidRows).toBeGreaterThan(0)
    expect(headerPreview.rows.some((row) => row.errors.some((error) => error.includes('Formula detected')))).toBe(true)
    expect(headerPreview.newRecords).toBe(0)
  })
})