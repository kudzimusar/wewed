import { describe, expect, test } from 'bun:test'
import {
  hasWeddingPermission,
  worksheetPermissionCapabilities,
} from './planner-client-permissions'
import {
  plannerControlHasDraft,
  plannerFormHasDraft,
} from './planner-draft-guard'

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
    expect(toolbar).toContain('canDownloadWorksheetTemplate')
    expect(toolbar).toContain('canExportWorksheet')
  })
})

describe('Stage 2 unsaved planner drafts', () => {
  test('unchanged defaults are not treated as drafts', () => {
    expect(plannerControlHasDraft({ type: 'text', value: '', defaultValue: '' })).toBe(false)
    expect(plannerControlHasDraft({ type: 'number', value: '8', defaultValue: '8' })).toBe(false)
    expect(
      plannerControlHasDraft({
        value: 'planner',
        options: [
          { value: 'owner' },
          { value: 'planner', defaultSelected: true },
        ],
      }),
    ).toBe(false)
  })

  test('typed, selected, checked, and uploaded values are drafts', () => {
    expect(plannerControlHasDraft({ type: 'text', value: 'Book caterer', defaultValue: '' })).toBe(true)
    expect(plannerControlHasDraft({ type: 'checkbox', checked: true, defaultChecked: false })).toBe(true)
    expect(plannerControlHasDraft({ type: 'file', files: { length: 1 } })).toBe(true)
    expect(
      plannerControlHasDraft({
        value: 'owner',
        options: [
          { value: 'owner' },
          { value: 'planner', defaultSelected: true },
        ],
      }),
    ).toBe(true)
  })

  test('buttons and hidden inputs never create false draft warnings', () => {
    expect(plannerControlHasDraft({ type: 'hidden', value: 'token', defaultValue: '' })).toBe(false)
    expect(plannerControlHasDraft({ type: 'submit', value: 'Save', defaultValue: '' })).toBe(false)
    expect(
      plannerFormHasDraft({
        0: { type: 'hidden', value: 'token', defaultValue: '' },
        1: { type: 'text', value: '', defaultValue: '' },
        length: 2,
      }),
    ).toBe(false)
  })

  test('wedding switching confirms drafts and never reloads the page', async () => {
    const controls = await source('src/components/wedding/wedding-context-controls.tsx')

    expect(controls).toContain('hasUnsavedPlannerForms(plannerRoot())')
    expect(controls).toContain('window.confirm(')
    expect(controls).toContain("window.addEventListener('beforeunload'")
    expect(controls).toContain("new CustomEvent('wewed:wedding-switched'")
    expect(controls).toContain('payload.activeWedding')
    expect(controls).not.toContain('window.location.reload()')
  })

  test('the portal reloads session context and remounts workspace by wedding ID', async () => {
    const portal = await source('src/components/wedding/planner-portal.tsx')

    expect(portal).toContain("window.addEventListener('wewed:wedding-switched', loadSession)")
    expect(portal).toContain("window.removeEventListener('wewed:wedding-switched', loadSession)")
    expect(portal).toContain("<PlannerWorkspace key={wedding?.id ?? 'no-active-wedding'} />")
  })

  test('the switch API returns the authoritative active wedding with scoped permissions', async () => {
    const route = await source('src/app/api/auth/wedding/route.ts')

    expect(route).toContain('listAccessibleWeddings')
    expect(route).toContain("candidate.membershipStatus === 'active'")
    expect(route).toContain('activeWedding:')
    expect(route).toContain('permissions')
    expect(route).toContain('setAppSessionCookie')
  })
})
