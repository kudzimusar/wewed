import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const plan = readFileSync('docs/WEWED_COMMERCIAL_DOCUMENT_EVIDENCE_GRAPH_EXTENSION.md', 'utf8')
const closeout = readFileSync('docs/WEWED_VAULT_CONTRACTS_TRANSACTION_GOVERNANCE_CLOSEOUT.md', 'utf8')
const graph = readFileSync('src/lib/vault/commercial-documents.ts', 'utf8')
const engagementEvidence = readFileSync('src/lib/vault/engagement-evidence.ts', 'utf8')
const engagementEvidenceRoute = readFileSync('src/app/api/planner/engagements/[id]/evidence/route.ts', 'utf8')
const dealRoom = readFileSync('src/components/wedding/planner/modules/planner-vendor-deal-room.tsx', 'utf8')
const dealRoomUpload = readFileSync('src/components/wedding/planner/modules/deal-room-document-upload.tsx', 'utf8')
const budgetRoute = readFileSync('src/app/api/planner/budget/route.ts', 'utf8')
const budgetUi = readFileSync('src/components/wedding/planner/modules/planner-budget-module.tsx', 'utf8')
const contributionEvidenceRoute = readFileSync('src/app/api/planner/contributions/[id]/evidence/route.ts', 'utf8')
const coupleDashboard = readFileSync('src/components/couple/couple-dashboard.tsx', 'utf8')
const vendorAccess = readFileSync('src/lib/vault/vendor-commercial-access.ts', 'utf8')
const vendorDocumentsRoute = readFileSync('src/app/api/vendor/documents/route.ts', 'utf8')
const vendorDocumentRoute = readFileSync('src/app/api/vendor/documents/[id]/route.ts', 'utf8')
const vendorDocumentsPage = readFileSync('src/app/vendor/documents/page.tsx', 'utf8')

describe('Commercial Document & Evidence Graph', () => {
  test('keeps the UAT extension canonical without reopening the Phase 0–6 sequence', () => {
    expect(plan).toContain('CANONICAL PRODUCT / IMPLEMENTATION / CORRECTION MANUAL EXTENSION')
    expect(plan).toContain('Store once, link everywhere it is factually relevant, authorize by relationship, preserve history.')
    expect(plan).toContain('It is not a new implementation phase')
    expect(closeout).toContain('WEWED_COMMERCIAL_DOCUMENT_EVIDENCE_GRAPH_EXTENSION.md')
    expect(closeout).toContain('does not weaken any existing privacy, immutability, audit, historical-truth or legal-boundary requirement')
  })

  test('stores one Vault object and projects it by links instead of duplicating bytes', () => {
    expect(engagementEvidence).toContain('await tx.vaultObject.create')
    expect(engagementEvidence).toContain('linkCommercialDocumentGraph')
    expect(graph).toContain("entityType: 'service_engagement'")
    expect(graph).toContain("entityType: 'vendor'")
    expect(graph).toContain("entityType: 'budget_item'")
    expect(graph).toContain("entityType: 'WeddingContribution'")
    expect(graph).toContain('vaultObjectId_entityType_entityId_linkRole')
    expect(graph).not.toContain('vaultObject.create')
  })

  test('supports current and historical Service Engagement documents through one governed uploader', () => {
    expect(engagementEvidence).toContain("uploadSource: 'service_engagement_document'")
    expect(engagementEvidence).toContain("'existing_agreement'")
    expect(engagementEvidence).not.toContain("origin: 'historical'")
    expect(engagementEvidenceRoute).toContain("action: 'service_engagement.document_uploaded'")
    expect(dealRoomUpload).toContain('Existing / external contract')
    expect(dealRoom).toContain('DealRoomDocumentUpload')
    expect(dealRoom).toContain('External contracts and commercial evidence can be attached once')
  })

  test('does not treat a direct-vendor promise as paid document entitlement', () => {
    expect(graph).toContain("c.type = 'DIRECT_VENDOR_PAYMENT'")
    expect(graph).toContain("f.source_kind = 'CONTRIBUTION'")
    expect(graph).toContain('f.amount > 0')
    expect(graph).toContain('JOIN public."EngagementPayment" p')
    expect(graph).toContain('A pledge')
    expect(dealRoomUpload).toContain('A pledge with $0 paid receives no payment-derived document access.')
    expect(contributionEvidenceRoute).toContain("entityType:'WeddingContribution'")
    expect(contributionEvidenceRoute).toContain("linkRole:'evidence'")
  })

  test('projects the same documents into Budget without changing Budget Paid', () => {
    expect(budgetRoute).toContain('listBudgetCommercialDocuments')
    expect(budgetRoute).toContain('documents: documentsByBudget.get(item.id) ?? []')
    expect(budgetUi).toContain('Related documents')
    expect(budgetUi).toContain('same governed Vault files')
    expect(budgetUi).toContain('viewing them does not change payment accounting')
    expect(graph).not.toContain('paidAmount')
    expect(graph).not.toContain('EngagementPayment.create')
  })

  test('gives the couple an existing private Vault projection', () => {
    expect(coupleDashboard).toContain('Documents & contracts')
    expect(coupleDashboard).toContain("'/vault'")
    expect(coupleDashboard).toContain('stored once in Wewed Vault')
  })

  test('keeps Vendor document discovery fail-closed and relationship scoped', () => {
    expect(vendorAccess).toContain("partyRole: 'SERVICE_PROVIDER'")
    expect(vendorAccess).toContain("status: 'active'")
    expect(vendorAccess).toContain("entityType: 'service_engagement'")
    expect(vendorDocumentsRoute).toContain("session.role !== 'vendor'")
    expect(vendorDocumentRoute).toContain('vendorCommercialDocumentAccess')
    expect(vendorDocumentsPage).toContain('Relationship-scoped access')
    expect(vendorDocumentsPage).toContain('Search filename, wedding, service or document type')
  })
})
