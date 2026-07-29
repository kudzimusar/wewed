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

  test('all six active module tabs mount the shared worksheet recovery panel', async () => {
    const workspace = await source('src/components/wedding/planner-workspace.tsx')

    expect(workspace).toContain("import { ImportExportBar } from '@/components/wedding/import-export-bar'")
    expect(workspace).toContain('const handleWorksheetChanged = useCallback')
    expect(workspace).toContain('void refresh(false)')

    for (const [moduleKey] of WORKSHEET_MODULES) {
      expect(workspace).toContain(`moduleKey="${moduleKey}"`)
      expect(workspace).toContain('onImportComplete={handleWorksheetChanged}')
    }
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
      'job.errorReport',
      "job.status === 'completed' && job.rollbackToken",
      "action: 'rollback'",
      'rollbackToken: job.rollbackToken',
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
      "fetch('/api/imports'",
      'formData.append(\'moduleKey\', moduleKey)',
      'preview.errors',
      'preview.warnings',
      'preview.summary',
      "fetch(`/api/imports/${jobId}`",
      "action: 'confirm'",
      'rollbackToken',
      "action: 'rollback'",
      'errorReport',
      'onComplete?.()',
    ]) {
      expect(dialog).toContain(marker)
    }
  })

  test('import history and rollback APIs require import permission and wedding scope', async () => {
    const [collectionRoute, jobRoute] = await Promise.all([
      source('src/app/api/imports/route.ts'),
      source('src/app/api/imports/[jobId]/route.ts'),
    ])

    expect(collectionRoute).toContain("requireWeddingPermission(request, 'import.execute')")
    expect(collectionRoute).toContain('weddingId: access.context.weddingId')
    expect(collectionRoute).toContain('db.importJob.findMany')
    expect(collectionRoute).toContain('rollbackToken: job.rollbackToken')

    expect(jobRoute).toContain("requireWeddingPermission(request, 'import.execute')")
    expect(jobRoute).toContain('where: { id: jobId, weddingId }')
    expect(jobRoute).toContain("if (action === 'rollback')")
    expect(jobRoute).toContain('rollbackImport({')
    expect(jobRoute).toContain('executeImport({')
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
