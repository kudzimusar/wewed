import { describe, expect, test } from 'bun:test'
import {
  hasWeddingPermission,
  worksheetPermissionCapabilities,
} from './planner-client-permissions'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

describe('Stage 2 worksheet permissions', () => {
  test('wildcard owners and administrators retain all worksheet actions', () => {
    expect(worksheetPermissionCapabilities(['*'])).toEqual({
      canDownloadWorksheetTemplate: true,
      canImportWorksheet: true,
      canExportWorksheet: true,
      canUseWorksheetTools: true,
    })
  })

  test('planner import and export permissions map to matching controls', () => {
    expect(
      worksheetPermissionCapabilities(['planner.view', 'import.execute', 'export.data']),
    ).toEqual({
      canDownloadWorksheetTemplate: true,
      canImportWorksheet: true,
      canExportWorksheet: true,
      canUseWorksheetTools: true,
    })
  })

  test('coordinator and viewer export access does not expose import controls', () => {
    expect(worksheetPermissionCapabilities(['planner.view', 'export.data'])).toEqual({
      canDownloadWorksheetTemplate: false,
      canImportWorksheet: false,
      canExportWorksheet: true,
      canUseWorksheetTools: true,
    })
  })

  test('a role without worksheet permissions sees no worksheet controls', () => {
    expect(worksheetPermissionCapabilities(['planner.view'])).toEqual({
      canDownloadWorksheetTemplate: false,
      canImportWorksheet: false,
      canExportWorksheet: false,
      canUseWorksheetTools: false,
    })
    expect(hasWeddingPermission(undefined, 'export.data')).toBe(false)
  })

  test('the toolbar uses active-wedding permissions instead of legacy admin state', async () => {
    const toolbar = await source('src/components/wedding/import-export-bar.tsx')

    expect(toolbar).toContain("fetch('/api/auth/me'")
    expect(toolbar).toContain('session?.activeWedding?.permissions')
    expect(toolbar).toContain('worksheetPermissionCapabilities')
    expect(toolbar).toContain('canDownloadWorksheetTemplate')
    expect(toolbar).toContain('canImportWorksheet')
    expect(toolbar).toContain('canExportWorksheet')
    expect(toolbar).toContain("window.addEventListener('wewed:wedding-switched'")
    expect(toolbar).not.toContain('isAdminLoggedIn')
    expect(toolbar).not.toContain("from '@/lib/admin-auth'")
  })

  test('client controls and API routes enforce the same permission names', async () => {
    const [access, templates, exportsRoute, importsRoute, toolbar] = await Promise.all([
      source('src/lib/wedding-access.ts'),
      source('src/app/api/templates/route.ts'),
      source('src/app/api/exports/route.ts'),
      source('src/app/api/imports/route.ts'),
      source('src/components/wedding/import-export-bar.tsx'),
    ])

    expect(access).toContain("'import.execute'")
    expect(access).toContain("'export.data'")
    expect(templates).toContain("requireWeddingPermission(request, 'import.execute')")
    expect(importsRoute).toContain("requireWeddingPermission(request, 'import.execute')")
    expect(exportsRoute).toContain("requireWeddingPermission(request, 'export.data')")
    expect(toolbar).toContain("canDownloadWorksheetTemplate")
    expect(toolbar).toContain("canExportWorksheet")
  })
})
