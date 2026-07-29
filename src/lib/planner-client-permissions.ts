export interface WeddingPermissionCapabilities {
  canDownloadWorksheetTemplate: boolean
  canImportWorksheet: boolean
  canExportWorksheet: boolean
  canUseWorksheetTools: boolean
}

export function hasWeddingPermission(
  permissions: readonly string[] | null | undefined,
  permission: string,
): boolean {
  if (!permissions) return false
  return permissions.includes('*') || permissions.includes(permission)
}

export function worksheetPermissionCapabilities(
  permissions: readonly string[] | null | undefined,
): WeddingPermissionCapabilities {
  const canImport = hasWeddingPermission(permissions, 'import.execute')
  const canExport = hasWeddingPermission(permissions, 'export.data')

  return {
    // The template endpoint deliberately uses the same permission as import.
    canDownloadWorksheetTemplate: canImport,
    canImportWorksheet: canImport,
    canExportWorksheet: canExport,
    canUseWorksheetTools: canImport || canExport,
  }
}
