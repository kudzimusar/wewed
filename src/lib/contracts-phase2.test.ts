import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

function source(path: string) {
  return readFileSync(path, 'utf8')
}

describe('Phase 2 Service Engagement Deal Room and Wewed contract governance', () => {
  test('uses one current managed Service Engagement instead of a parallel contract vendor record', () => {
    const service = source('src/lib/contracts/phase2.ts')
    const schema = source('prisma/schema.prisma')
    expect(service).toContain("origin: 'current'")
    expect(service).toContain("recordMode: 'managed_contract'")
    expect(service).toContain("partyRole: 'CLIENT'")
    expect(service).toContain("partyRole: 'PLANNER'")
    expect(service).toContain("partyRole: 'SERVICE_PROVIDER'")
    expect(service).not.toContain("partyRole: 'WEWED_PLATFORM'")
    expect(schema).toContain('vendor      Vendor  @relation(fields: [vendorId, weddingId], references: [id, weddingId], onDelete: Restrict)')
  })

  test('brands contracts as Wewed while refusing an implicit commercial-party claim', () => {
    const service = source('src/lib/contracts/phase2.ts')
    const pdf = source('src/lib/contracts/pdf.ts')
    expect(service).toContain("WEWED_CANONICAL_SITE = 'https://wewed.pro'")
    expect(service).toContain('commercialPartyByDefault: false')
    expect(service).toContain('acceptanceIncludedInThisPhase: false')
    expect(pdf).toContain("{ text: 'WEWED', size: 18 }")
    expect(pdf).toContain("{ text: 'wewed.pro', size: 10 }")
    expect(pdf).toContain("QRCode.create(value")
    expect(pdf).toContain('Canonical SHA-256')
    expect(pdf).toContain('Viewing this document does not constitute acceptance')
  })

  test('freezes the issued version and its exact private Vault artifact', () => {
    const migration = source('prisma/migrations/20260818181500_phase2_contract_domain/migration.sql')
    const service = source('src/lib/contracts/phase2.ts')
    expect(migration).toContain('next_wewed_contract_number')
    expect(migration).toContain('WW-CON-')
    expect(migration).toContain('enforce_issued_contract_version_immutability')
    expect(migration).toContain('Issued contract version content is immutable')
    expect(migration).toContain('Issued contract versions cannot be deleted')
    expect(service).toContain('prepareVaultUpload')
    expect(service).toContain('registerPreparedVaultObject')
    expect(service).toContain("entityType: 'contract_version'")
    expect(service).toContain("linkRole: 'immutable_artifact'")
    expect(service).toContain('artifactSha256: prepared.checksumSha256')
    expect(service).toContain('contentSha256')
  })

  test('stores only hashed review tokens and keeps review separate from acceptance', () => {
    const schema = source('prisma/schema.prisma')
    const service = source('src/lib/contracts/phase2.ts')
    const reviewPage = source('src/app/contracts/review/[token]/page.tsx')
    expect(schema).toMatch(/tokenHash\s+String\s+@unique/)
    expect(schema).not.toMatch(/^\s*token\s+String/m)
    expect(service).toContain('tokenHash: sha256(token)')
    expect(service).toContain('canAccept: false')
    expect(service).toContain('acceptanceRecorded: false')
    expect(reviewPage).toContain('Viewing this page does')
    expect(reviewPage).toContain('not</strong> accept, sign, amend, or make the contract effective')
    expect(reviewPage).not.toContain('/accept')
  })

  test('keeps starter templates operator-reviewed until an explicit counsel gate changes them', () => {
    const seed = source('prisma/migrations/20260818183000_phase2_contract_template_seed/migration.sql')
    expect(seed).toContain("'internal_review', 'operator_review'")
    expect(seed).toContain('"legalReviewClaim":false')
    expect(seed).not.toContain("'counsel_approved', 'approved'")
    expect(seed).toContain('WEWED_STANDARD_SERVICE')
    expect(seed).toContain('WEWED_PHOTOGRAPHY')
    expect(seed).toContain('WEWED_CATERING')
  })

  test('mounts the Deal Room inside Vendors without removing historical paid-vendor rescue', () => {
    const vendors = source('src/components/wedding/planner/modules/planner-vendors-module.tsx')
    const dealRoom = source('src/components/wedding/planner/modules/planner-vendor-deal-room.tsx')
    expect(vendors).toContain('PlannerVendorDealRoom')
    expect(vendors).toContain('PlannerVendorEngagementPanel')
    expect(vendors).toContain("governanceJson<{ data: ManagedEngagementSummary[] }>('/api/planner/engagements/current')")
    expect(vendors).toContain('vendorEngagements.length > 0 || Boolean(managedEngagement)')
    expect(dealRoom).toContain("type Tab = 'overview' | 'contract' | 'payments' | 'documents' | 'messages' | 'tasks' | 'changes'")
    expect(dealRoom).toContain('Phase 3')
  })

  test('requires wedding vendor edit authority for all contract mutations', () => {
    const current = source('src/app/api/planner/engagements/current/route.ts')
    const draft = source('src/app/api/planner/engagements/[id]/contracts/route.ts')
    const issue = source('src/app/api/planner/contracts/[id]/issue/route.ts')
    const links = source('src/app/api/planner/contracts/[id]/review-links/route.ts')
    expect(current).toContain("requireWeddingPermission(request, 'vendors.edit')")
    expect(draft).toContain("requireWeddingPermission(request, 'vendors.edit')")
    expect(issue).toContain("requireWeddingPermission(request, 'vendors.edit')")
    expect(links).toContain("requireWeddingPermission(request, 'vendors.edit')")
  })

  test('makes public verification privacy-minimal and Wewed canonical', () => {
    const verification = source('src/app/contracts/verify/[contractNumber]/page.tsx')
    const service = source('src/lib/contracts/phase2.ts')
    expect(verification).toContain('does not expose private wedding terms or party data')
    expect(service).toContain("verifiedBy: WEWED_CANONICAL_SITE")
    expect(service).toContain('artifactSha256')
    expect(service).toContain('canonicalSha256')
  })
})
