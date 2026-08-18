import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const migration = readFileSync('prisma/migrations/20260818223000_phase4_payments_evidence_disputes/migration.sql', 'utf8')
const phase4 = readFileSync('src/lib/contracts/phase4.ts', 'utf8')
const plannerRoute = readFileSync('src/app/api/planner/engagements/[id]/transactions/route.ts', 'utf8')
const adminListRoute = readFileSync('src/app/api/admin/transaction-governance/route.ts', 'utf8')
const adminDetailRoute = readFileSync('src/app/api/admin/service-engagements/[id]/transactions/route.ts', 'utf8')
const dealRoom = readFileSync('src/components/wedding/planner/modules/planner-vendor-deal-room.tsx', 'utf8')
const panel = readFileSync('src/components/wedding/planner/modules/transaction-governance-panel.tsx', 'utf8')
const adminConsole = readFileSync('src/components/admin/admin-transaction-governance-console.tsx', 'utf8')
const adminNav = readFileSync('src/components/admin/admin-utility-nav.tsx', 'utf8')
const prismaSchema = readFileSync('prisma/schema.prisma', 'utf8')

describe('Vault/Contracts Phase 4 canonical governance', () => {
  test('implements every canonical Phase 4 deliverable through the Service Engagement', () => {
    for (const table of [
      'PaymentMilestone',
      'ManagedPaymentRecord',
      'DisputeCase',
      'DisputeIssue',
      'DisputeEvent',
      'DisputeOutcome',
      'EvidenceHold',
    ]) expect(migration).toContain(`CREATE TABLE wewed_contracts."${table}"`)

    expect(dealRoom).toContain("label: 'Payments'")
    expect(dealRoom).toContain("label: 'Evidence & disputes'")
    expect(dealRoom).toContain('<TransactionGovernancePanel engagementId={room.id} mode="payments" />')
    expect(dealRoom).toContain('<TransactionGovernancePanel engagementId={room.id} mode="disputes" />')
    expect(panel).toContain('Add payment milestone')
    expect(panel).toContain('Preserve dispute evidence')
    expect(panel).toContain('Add clause-linked issue')
    expect(panel).toContain('Record externally/mutually established outcome')
    expect(adminConsole).toContain('readOnly')
    expect(adminNav).toContain('/admin/transaction-governance')
  })

  test('payment governance records facts without making Wewed merchant, processor or custodian', () => {
    expect(migration).toContain(`"recordNature" text NOT NULL DEFAULT 'FACT_ONLY'`)
    expect(migration).toContain(`"wewedProcessorRole" text NOT NULL DEFAULT 'NONE'`)
    expect(migration).toContain(`"custodyStatus" text NOT NULL DEFAULT 'NOT_HELD_BY_WEWED'`)
    expect(migration).toContain(`CHECK ("recordNature" = 'FACT_ONLY')`)
    expect(migration).toContain(`CHECK ("wewedProcessorRole" = 'NONE')`)
    expect(migration).toContain(`CHECK ("custodyStatus" = 'NOT_HELD_BY_WEWED')`)
    expect(panel).toContain('Wewed does not receive, hold, escrow, or process vendor funds')
    expect(phase4).toContain("budgetMutationPolicy: 'read_only_reconciliation'")
    expect(phase4).toContain("wewedProcessorRole: 'NONE'")
    expect(phase4).toContain("custodyStatus: 'NOT_HELD_BY_WEWED'")
  })

  test('does not mutate Budget or create contract acceptance/effectivity from payment facts', () => {
    expect(phase4).not.toContain('budgetItem.update')
    expect(phase4).not.toContain('budgetItem.create')
    expect(phase4).not.toContain('budgetItem.delete')
    expect(phase4).not.toContain('ContractAcceptance')
    expect(phase4).not.toContain('ContractVersionEffectivity')
    expect(plannerRoute).not.toContain('recordContractDecision')
    expect(plannerRoute).not.toContain('ContractAcceptance')
    expect(plannerRoute).not.toContain('ContractVersionEffectivity')
    expect(panel).toContain('Recording a payment never accepts a contract')
  })

  test('keeps historical and managed payment facts separate to prevent silent double counting', () => {
    expect(phase4).toContain("const comparisonPaymentTotal = managedPayments.length > 0 ? managedNet : legacyPaymentTotal")
    expect(phase4).toContain("code: 'LEGACY_PAYMENT_UNALLOCATED'")
    expect(panel).toContain('Legacy payment facts — shown separately')
  })

  test('makes managed payment facts append-only and corrections explicit', () => {
    expect(migration).toContain('ManagedPaymentRecord_append_only_guard')
    expect(migration).toContain('Managed payment facts are append-only; record a governed reversal or refund instead')
    expect(migration).toContain('ManagedPaymentRecord_reversesPaymentId_key')
    expect(phase4).toContain('reverseManagedPayment')
    expect(phase4).toContain("entryType: 'REVERSAL'")
    expect(panel).toContain('Reverse')
  })

  test('preserves dispute allegations separately from outcomes and forbids Wewed adjudication findings', () => {
    expect(migration).toContain(`"findingStatus" text NOT NULL DEFAULT 'UNADJUDICATED'`)
    expect(migration).toContain(`CHECK ("findingStatus" = 'UNADJUDICATED')`)
    expect(migration).toContain(`"wewedAdjudicationRole" text NOT NULL DEFAULT 'NONE'`)
    expect(migration).toContain(`CHECK ("wewedAdjudicationRole" = 'NONE')`)
    expect(migration).toContain("'MUTUAL_SETTLEMENT','EXTERNAL_ADJUDICATION','COURT_ORDER','WITHDRAWAL'")
    expect(panel).toContain('allegation until independently resolved')
    expect(panel).toContain('This is not a Wewed judgment.')
    expect(phase4).toContain("wewedAdjudicationRole: 'NONE'")
  })

  test('puts dispute evidence in Vault under database-enforced holds without silent destruction', () => {
    expect(phase4).toContain('prepareVaultUpload')
    expect(phase4).toContain('registerPreparedVaultObject')
    expect(phase4).toContain("source: 'phase4_dispute_evidence'")
    expect(migration).toContain('EvidenceHold_sync_vault_guard')
    expect(migration).toContain('VaultObject_evidence_hold_guard')
    expect(migration).toContain('Vault evidence under active hold cannot be deleted')
    expect(phase4).toContain('objectDeleted: false')
    expect(panel).toContain('The Vault object is immediately placed under an active evidence hold.')
  })

  test('keeps Phase 4 private and server-authorized', () => {
    for (const model of [
      'PaymentMilestone',
      'ManagedPaymentRecord',
      'DisputeCase',
      'DisputeIssue',
      'DisputeEvent',
      'DisputeOutcome',
      'EvidenceHold',
    ]) expect(prismaSchema).not.toContain(`model ${model}`)
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA wewed_contracts FROM PUBLIC')
    expect(migration).toContain("ARRAY['anon','authenticated']")
    expect(plannerRoute).toContain("requireWeddingPermission(request, 'vendors.view')")
    expect(plannerRoute).toContain("requireWeddingPermission(request, 'vendors.edit')")
    expect(adminListRoute).toContain("requireWewedAdmin(request, 'admin.support.read')")
    expect(adminDetailRoute).toContain("requireWewedAdmin(request, 'admin.support.read')")
    expect(adminListRoute).not.toContain('export async function POST')
    expect(adminDetailRoute).not.toContain('export async function POST')
    expect(adminDetailRoute).not.toContain('recordDisputeOutcome')
    expect(adminDetailRoute).not.toContain('releaseEvidenceHold')
  })

  test('creates exact covering indexes for every Phase 4 foreign-key path', () => {
    for (const indexName of [
      'PaymentMilestone_service_engagement_wedding_idx',
      'PaymentMilestone_contract_wedding_idx',
      'PaymentMilestone_version_contract_idx',
      'ManagedPaymentRecord_service_engagement_wedding_idx',
      'ManagedPaymentRecord_milestone_idx',
      'ManagedPaymentRecord_proof_vault_wedding_idx',
      'ManagedPaymentRecord_reversesPaymentId_key',
      'DisputeCase_service_engagement_wedding_idx',
      'DisputeCase_contract_wedding_idx',
      'DisputeCase_version_contract_idx',
      'DisputeIssue_case_idx',
      'DisputeEvent_case_idx',
      'DisputeEvent_issue_idx',
      'DisputeEvent_actor_party_idx',
      'DisputeOutcome_case_idx',
      'DisputeOutcome_evidence_vault_wedding_idx',
      'EvidenceHold_vault_wedding_idx',
      'EvidenceHold_case_idx',
    ]) expect(migration).toContain(indexName)
  })
})
