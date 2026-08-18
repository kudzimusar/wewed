import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const plan = readFileSync('docs/WEWED_VAULT_CONTRACTS_TRANSACTION_GOVERNANCE_PLAN.md', 'utf8')
const closeout = readFileSync('docs/WEWED_VAULT_CONTRACTS_TRANSACTION_GOVERNANCE_CLOSEOUT.md', 'utf8')
const canon = readFileSync('agent-ctx/VAULT-CONTRACTS-TRANSACTION-GOVERNANCE-CANON.md', 'utf8')
const vaultCore = readFileSync('src/lib/vault/core.ts', 'utf8')
const phase1Migration = readFileSync('prisma/migrations/20260818144500_phase1_vault_communications_attachments/migration.sql', 'utf8')
const dealRoom = readFileSync('src/components/wedding/planner/modules/planner-vendor-deal-room.tsx', 'utf8')
const phase3 = readFileSync('src/lib/contracts/phase3.ts', 'utf8')
const reviewPage = readFileSync('src/app/contracts/review/[token]/page.tsx', 'utf8')
const phase4 = readFileSync('src/lib/contracts/phase4.ts', 'utf8')
const transactionPanel = readFileSync('src/components/wedding/planner/modules/transaction-governance-panel.tsx', 'utf8')
const mediaPhase5 = readFileSync('src/lib/media/phase5.ts', 'utf8')
const mediaArchivePage = readFileSync('src/app/planner/media-archive/page.tsx', 'utf8')
const phase6 = readFileSync('src/lib/contracts/phase6.ts', 'utf8')
const amendmentAssistRoute = readFileSync('src/app/api/planner/contract-intelligence/amendment-assist/route.ts', 'utf8')
const adminIntelligenceRoute = readFileSync('src/app/api/admin/contract-intelligence/route.ts', 'utf8')

describe('Vault/Contracts Phase 0–6 implementation closeout', () => {
  test('keeps implementation status aligned without weakening the original canon', () => {
    expect(closeout).toContain('PHASE 0–6 IMPLEMENTATION COMPLETE')
    expect(closeout).toContain('MANUAL PRODUCT UAT IS THE NEXT GATE')
    expect(closeout).toContain('There is **no canonical Phase 7**')
    expect(canon).toContain('PHASE 0–6 IMPLEMENTATION COMPLETE')
    expect(canon).toContain('Implementation-status authority')
    expect(canon).toContain('There is no canonical Phase 7')

    // The original plan may retain its historical pre-implementation header until it is
    // rewritten in full. If it does, the closeout must explicitly supersede that status
    // wording so agents cannot mistake historical authorization text for current state.
    if (plan.includes('product implementation is **not yet authorized**')) {
      expect(closeout).toContain('supersedes **only the implementation-authorization/status wording**')
      expect(canon).toContain('supersedes only the old pre-implementation authorization/status wording')
    }

    expect(closeout).toContain('do **not** create synthetic production contracts')
    expect(canon).toContain('Do not manufacture production contracts')
  })

  test('retains one governed Vault foundation for communication and evidence files', () => {
    expect(vaultCore).toContain('wewed-vault')
    expect(vaultCore).toContain('checksumSha256')
    expect(vaultCore).toContain('prepareVaultUpload')
    expect(phase1Migration).toContain('CommunicationAttachment')
    expect(phase1Migration).toContain('vaultObjectId')
    expect(phase1Migration).toContain('CommunicationAttachment_context_guard')
    expect(closeout).toContain('Vault Core + Communications Attachments')
  })

  test('retains the Planner Service Engagement Deal Room as the Phase 2 transaction center', () => {
    expect(dealRoom).toContain('Wewed Service Engagement & Deal Room')
    expect(dealRoom).toContain('Create Service Engagement')
    expect(dealRoom).toContain('Generate branded draft')
    expect(dealRoom).toContain('Issue exact version')
    for (const label of [
      "label: 'Overview'",
      "label: 'Contract'",
      "label: 'Payments'",
      "label: 'Documents'",
      "label: 'Messages'",
      "label: 'Tasks'",
      "label: 'Changes'",
      "label: 'Evidence & disputes'",
    ]) expect(dealRoom).toContain(label)
    expect(dealRoom).toContain('Viewing is not acceptance')
  })

  test('retains exact-version acceptance, full-approval effectivity and replacement-version amendments', () => {
    expect(reviewPage).toContain('Viewing is not acceptance')
    expect(phase3).toContain('recordContractDecision')
    expect(phase3).toContain('contractContentSha256')
    expect(phase3).toContain('contractArtifactSha256')
    expect(phase3).toContain('renderAcceptanceCertificatePdf')
    expect(phase3).toContain("status: 'PARTIALLY_ACCEPTED'")
    expect(phase3).toContain("status: 'EFFECTIVE'")
    expect(phase3).toContain('createContractAmendmentDraft')
    expect(phase3).toContain('issueContractAmendment')
    expect(phase3).toContain("status: 'SUPERSEDED'")
  })

  test('keeps Phase 4 payment facts separate from acceptance and Wewed custody', () => {
    expect(phase4).toContain("wewedProcessorRole: 'NONE'")
    expect(phase4).toContain("custodyStatus: 'NOT_HELD_BY_WEWED'")
    expect(phase4).toContain("budgetMutationPolicy: 'read_only_reconciliation'")
    expect(phase4).not.toContain('ContractAcceptance')
    expect(phase4).not.toContain('ContractVersionEffectivity')
    expect(phase4).not.toContain('recordContractDecision')
    expect(transactionPanel).toContain('Recording a payment never accepts a contract')
    expect(transactionPanel).toContain('Preserve dispute evidence')
    expect(transactionPanel).toContain('This is not a Wewed judgment.')
  })

  test('keeps Phase 5 wedding media private-by-default, Vault-backed and forward-only archived', () => {
    expect(mediaPhase5).toContain('prepareVaultUpload')
    expect(mediaPhase5).toContain('registerPreparedVaultObject')
    expect(mediaPhase5).toContain("source: 'wedding_media_original'")
    expect(mediaPhase5).toContain('buildCoupleExportManifest')
    expect(mediaPhase5).toContain('destructiveDelete: false')
    expect(mediaArchivePage).toContain('Wedding Media Vault & Archive')
    expect(mediaArchivePage).toContain('Originals remain private.')
    expect(mediaArchivePage).toContain('Export manifest')
  })

  test('keeps Phase 6 derived, advisory and incapable of mutating governed records', () => {
    expect(phase6).toContain("import 'server-only'")
    expect(phase6).not.toContain('.create({')
    expect(phase6).not.toContain('.update({')
    expect(phase6).not.toContain('.delete({')
    expect(phase6).not.toContain('$executeRaw')
    expect(amendmentAssistRoute).toContain('advisoryOnly: true')
    expect(amendmentAssistRoute).toContain('persisted: false')
    expect(amendmentAssistRoute).toContain('Do not create or approve an amendment')
    expect(amendmentAssistRoute).not.toContain('ContractAmendment')
    expect(adminIntelligenceRoute).toContain("requireWewedAdmin(request, 'admin.support.read')")
    expect(adminIntelligenceRoute).not.toContain('export async function POST')
    expect(adminIntelligenceRoute).not.toContain('export async function PATCH')
    expect(adminIntelligenceRoute).not.toContain('export async function DELETE')
  })
})
