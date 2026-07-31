import { describe, expect, test } from 'bun:test'
import { KNOWN_ACTIVE_PARITY_GAPS, ORIGINAL_PLANNER_SOURCE } from './planner-parity-contract'
import { worksheetPermissionCapabilities } from './planner-client-permissions'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

const WORKSHEET_MODULES = [
  ['checklist', 'tasks.worksheet'],
  ['budget', 'budget.worksheet'],
  ['vendors', 'vendors.worksheet'],
  ['guests', 'guests.worksheet'],
  ['timeline', 'timeline.worksheet'],
  ['seating', 'seating.worksheet'],
] as const

describe('Stage 7 six-module worksheet parity', () => {
  test('the original planner mounted worksheet controls for every mature module', async () => {
    const original = await source(ORIGINAL_PLANNER_SOURCE)

    for (const [moduleKey] of WORKSHEET_MODULES) {
      expect(original).toContain(`<ImportExportBar moduleKey="${moduleKey}"`)
    }
  })

  test('the active planner shell reaches all six worksheet pipelines and reloads saved data', async () => {
    const [portal, wrapper] = await Promise.all([
      source('src/components/wedding/planner-portal.tsx'),
      source('src/components/wedding/planner-workspace-stage7.tsx'),
    ])

    expect(portal).toContain("from '@/components/wedding/planner-workspace-stage7'")
    expect(portal).toContain("<PlannerWorkspace key={wedding?.id ?? 'no-active-wedding'} />")
    expect(wrapper).toContain('const handleWorksheetChanged = useCallback')
    expect(wrapper).toContain('setWorkspaceVersion((current) => current + 1)')
    expect(wrapper).toContain('activeTab={activeTab}')
    expect(wrapper).toContain('onActiveTabChange={selectWorkspaceTab}')
    expect(wrapper).toContain("searchParams.get('module')")

    for (const [moduleKey] of WORKSHEET_MODULES) {
      expect(wrapper).toContain(`worksheetKey: '${moduleKey}'`)
    }
    expect(wrapper).toContain('moduleKey={activeModule.worksheetKey}')
    expect(wrapper).toContain('onImportComplete={handleWorksheetChanged}')
  })

  test('worksheet role capabilities preserve wildcard, planner, and export-only access', () => {
    expect(worksheetPermissionCapabilities(['*'])).toEqual({
      canDownloadWorksheetTemplate: true,
      canImportWorksheet: true,
      canExportWorksheet: true,
      canUseWorksheetTools: true,
    })
    expect(worksheetPermissionCapabilities(['import.execute', 'export.data'])).toEqual({
      canDownloadWorksheetTemplate: true,
      canImportWorksheet: true,
      canExportWorksheet: true,
      canUseWorksheetTools: true,
    })
    expect(worksheetPermissionCapabilities(['export.data'])).toEqual({
      canDownloadWorksheetTemplate: false,
      canImportWorksheet: false,
      canExportWorksheet: true,
      canUseWorksheetTools: true,
    })
    expect(worksheetPermissionCapabilities([])).toEqual({
      canDownloadWorksheetTemplate: false,
      canImportWorksheet: false,
      canExportWorksheet: false,
      canUseWorksheetTools: false,
    })
  })

  test('shared worksheet UI uses selected-wedding permissions and supports history rollback', async () => {
    const bar = await source('src/components/wedding/import-export-bar.tsx')

    for (const marker of [
      "fetch('/api/auth/me'",
      'session?.activeWedding?.permissions',
      'worksheetPermissionCapabilities',
      'canDownloadWorksheetTemplate',
      'canImportWorksheet',
      'canExportWorksheet',
      "window.addEventListener('wewed:wedding-switched', loadPermissions)",
      '/api/templates?module=',
      '/api/exports?module=',
      '/api/imports?module=',
      'Recent imports',
      'errorSummary(job)',
      "job.status === 'executed'",
      'rollbackToken=${encodeURIComponent(job.rollbackToken)}',
      "method: 'DELETE'",
      'onImportComplete?.()',
    ]) {
      expect(bar).toContain(marker)
    }

    expect(bar).not.toContain('isAdminLoggedIn')
    expect(bar).not.toContain("from '@/lib/admin-auth'")
    expect(bar).not.toContain('window.location.reload')
  })

  test('import dialog retains preview, execute, error report and current-job rollback', async () => {
    const dialog = await source('src/components/wedding/import-dialog.tsx')

    for (const marker of [
      "form.append('file', selected)",
      "form.append('moduleKey', moduleKey)",
      "fetch('/api/imports', { method: 'POST', body: form })",
      'preview.totalRows',
      'preview.newRecords',
      'preview.updateRecords',
      'preview.invalidRows',
      'preview.rows',
      "fetch(`/api/imports/${encodeURIComponent(jobId)}`",
      "method: 'POST'",
      'body: JSON.stringify({ mappingOverrides })',
      'rollbackToken',
      '?rollbackToken=${encodeURIComponent(result.rollbackToken)}',
      "{ method: 'DELETE' }",
      'downloadErrors',
      'errorReport',
      'onComplete?.()',
    ]) {
      expect(dialog).toContain(marker)
    }
  })

  test('import history, execution and rollback APIs require import permission and wedding scope', async () => {
    const [collectionRoute, jobRoute, jobShared, jobPost, jobRollback] = await Promise.all([
      source('src/app/api/imports/route.ts'),
      source('src/app/api/imports/[jobId]/route.ts'),
      source('src/lib/import-engine/import-job-shared.ts'),
      source('src/lib/import-engine/import-job-post.ts'),
      source('src/lib/import-engine/import-job-rollback.ts'),
    ])

    expect(collectionRoute).toContain("requireWeddingPermission(request, 'import.execute')")
    expect(collectionRoute).toContain('requestedModule')
    expect(collectionRoute).toContain('moduleKey: requestedModule')
    expect(collectionRoute).toContain('weddingId: access.context.weddingId')
    expect(collectionRoute).toContain('db.importJob.findMany')
    expect(collectionRoute).toContain('rollbackToken: job.rollbackToken')
    expect(collectionRoute).toContain('return NextResponse.json({ success: true, data, recent: data })')

    expect(jobRoute).toContain('handleImportJobPost(request, context)')
    expect(jobRoute).toContain('handleImportJobDelete(request, context)')
    expect(jobShared).toContain('where: { id: jobId, weddingId }')
    expect(jobPost).toContain("requireWeddingPermission(request, 'import.execute')")
    expect(jobPost).toContain('executeImport(preview, schema')
    expect(jobPost).toContain('access.context.weddingId')
    expect(jobRollback).toContain("requireWeddingPermission(request, 'import.execute')")
    expect(jobRollback).toContain('const suppliedToken = new URL(request.url).searchParams.get')
    expect(jobRollback).toContain('rollbackImport(job.rollbackToken)')
    expect(jobRollback).toContain('snapshot.weddingId !== access.context.weddingId')
  })

  test('template and export APIs retain permission-specific selected-wedding controls', async () => {
    const [templateRoute, exportRoute] = await Promise.all([
      source('src/app/api/templates/route.ts'),
      source('src/app/api/exports/route.ts'),
    ])

    expect(templateRoute).toContain("requireWeddingPermission(request, 'import.execute')")
    expect(exportRoute).toContain("requireWeddingPermission(request, 'export.data')")
    expect(exportRoute).toContain('access.context.weddingId')
  })

  test('zero original planner parity gaps remain after worksheet restoration', () => {
    expect([...KNOWN_ACTIVE_PARITY_GAPS]).toEqual([])
  })

  test('worksheet controls do not import, seed, or overwrite data merely by mounting', async () => {
    const activeSurface = (
      await Promise.all([
        source('src/components/wedding/planner-workspace-stage7.tsx'),
        source('src/components/wedding/planner-workspace.tsx'),
        source('src/components/wedding/import-export-bar.tsx'),
        source('src/components/wedding/import-dialog.tsx'),
      ])
    ).join('\n')

    expect(activeSurface).not.toContain('SEED_')
    expect(activeSurface).not.toContain('Charity')
    expect(activeSurface).not.toContain('Kudzie')
    expect(activeSurface).not.toContain('autoImport')
    expect(activeSurface).not.toContain('window.location.reload')
    expect(activeSurface).not.toContain('isAdminLoggedIn')
  })
})
