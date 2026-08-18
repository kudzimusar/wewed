import { describe, expect, test } from 'bun:test'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

describe('Phase 0 Admin historical service record contract', () => {
  test('Admin wedding access is platform-scoped and never a Planner-session bypass', async () => {
    const scope = await source('src/lib/admin-historical-engagement.ts')

    expect(scope).toContain('buildBusinessAccountScopeSql')
    expect(scope).toContain('wewed_admin."BusinessAccountLink"')
    expect(scope).toContain('bal."entityType"=\'wedding\'')
    expect(scope).toContain('context.accountScope.global')
    expect(scope).toContain('The wedding is outside this administrator scope.')
    expect(scope).not.toContain('requireWeddingPermission')
  })

  test('Admin read and write APIs use bounded support permissions and record-only core', async () => {
    const route = await source('src/app/api/admin/service-engagements/route.ts')

    expect(route).toContain("requireWewedAdmin(request, 'admin.support.read')")
    expect(route).toContain("requireWewedAdmin(request, 'admin.support.manage')")
    expect(route).toContain('assertAdminHistoricalWeddingScope')
    expect(route).toContain('normalizeHistoricalEngagementInput(record)')
    expect(route).toContain('createHistoricalEngagement({')
    expect(route).toContain('calculatePaidVendorRescue(weddingId)')
    expect(route).toContain('writeBusinessAudit')
    expect(route).toContain('logAuditEvent')
    expect(route).not.toContain('acceptedAt')
    expect(route).not.toContain('effectiveAt')
    expect(route).not.toContain('contractAcceptedAt')
    expect(route).not.toContain('contractEffectiveAt')
  })

  test('Admin evidence remains scoped, private and signed through the shared Vault service', async () => {
    const upload = await source('src/app/api/admin/service-engagements/[id]/evidence/route.ts')
    const download = await source('src/app/api/admin/vault/[id]/route.ts')

    expect(upload).toContain("requireWewedAdmin(request, 'admin.support.manage')")
    expect(upload).toContain('assertAdminHistoricalWeddingScope')
    expect(upload).toContain('uploadEngagementEvidence')
    expect(upload).toContain('writeBusinessAudit')
    expect(download).toContain("requireWewedAdmin(request, 'admin.support.read')")
    expect(download).toContain('assertAdminHistoricalWeddingScope')
    expect(download).toContain('engagementEvidenceSignedUrl')
    expect(download).toContain('expiresInSeconds: 600')
    expect(upload).not.toContain('DELETE')
    expect(download).not.toContain('DELETE')
  })

  test('Admin UI reuses the governed Vendor engagement panel and exposes no parallel contract semantics', async () => {
    const consoleSource = await source('src/components/admin/admin-historical-engagement-console.tsx')
    const secure = await source('src/components/admin/secure-service-engagements.tsx')
    const nav = await source('src/components/admin/admin-utility-nav.tsx')

    expect(consoleSource).toContain('<PlannerVendorEngagementPanel')
    expect(consoleSource).toContain('record-only')
    expect(consoleSource).toContain('no retroactive Wewed acceptance was created')
    expect(consoleSource).toContain('!data.admin.canManage')
    expect(secure).toContain('<DashboardAuthGate')
    expect(nav).toContain("'/admin/service-engagements'")
    expect(nav).toContain("'Service records'")
    expect(consoleSource).not.toContain('acceptedAt')
    expect(consoleSource).not.toContain('effectiveAt')
  })
})
