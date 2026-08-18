import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const migration = readFileSync('prisma/migrations/20260818203000_phase3_contract_acceptance_amendments/migration.sql', 'utf8')
const phase3 = readFileSync('src/lib/contracts/phase3.ts', 'utf8')
const reviewPage = readFileSync('src/app/contracts/review/[token]/page.tsx', 'utf8')
const decisionPanel = readFileSync('src/components/contracts/contract-decision-panel.tsx', 'utf8')
const decisionRoute = readFileSync('src/app/api/contracts/review/[token]/decision/route.ts', 'utf8')
const governanceUi = readFileSync('src/components/contracts/planner-contract-governance.tsx', 'utf8')

function filesUnder(root: string): string[] {
  const result: string[] = []
  for (const name of readdirSync(root)) {
    const path = join(root, name)
    if (statSync(path).isDirectory()) result.push(...filesUnder(path))
    else result.push(path)
  }
  return result
}

describe('Vault/Contracts Phase 3 canonical governance', () => {
  test('stores evidentiary consent in a private schema with append-only/finality guards', () => {
    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS wewed_contracts')
    expect(migration).toContain('ContractPartyRequirement')
    expect(migration).toContain('ContractAcceptance')
    expect(migration).toContain('ContractVersionEffectivity')
    expect(migration).toContain('ContractAmendment')
    expect(migration).toContain('ContractAcceptance_append_only_guard')
    expect(migration).toContain('ContractVersionEffectivity_append_only_guard')
    expect(migration).toContain('ContractPartyRequirement_identity_guard')
    expect(migration).toContain('ContractAmendment_finality_guard')
    expect(migration).toContain('ContractVersion_phase3_lifecycle_guard')
    expect(migration).toContain("'PARTIALLY_ACCEPTED'")
    expect(migration).toContain("'effective'")
    expect(migration).toContain('REVOKE ALL ON SCHEMA wewed_contracts FROM PUBLIC')
    expect(migration).toContain("ARRAY['anon', 'authenticated']")
  })

  test('does not backdate or infer Phase 2 reviews into acceptance', () => {
    expect(migration).toContain("g.\"role\",\n  'PENDING'")
    expect(migration).not.toContain("g.\"role\",\n  'ACCEPTED'")
    expect(phase3).toContain('Viewing, payment, or message delivery alone is not acceptance')
    expect(reviewPage).toContain('Viewing is not acceptance')
  })

  test('acceptance binds exact version fingerprints, identity evidence and declaration version', () => {
    expect(phase3).toContain('CONTRACT_ACCEPTANCE_DECLARATION_VERSION')
    expect(phase3).toContain('contractContentSha256')
    expect(phase3).toContain('contractArtifactSha256')
    expect(phase3).toContain('identityEvidence')
    expect(phase3).toContain('declarationSha256')
    expect(phase3).toContain("'SECURE_REVIEW_LINK'")
    expect(decisionPanel).toContain('Accept this exact version')
    expect(decisionRoute).toContain('recordContractDecision')
  })

  test('full approval is required before effectivity and creates a Vault Acceptance Certificate', () => {
    expect(phase3).toContain(`"status" <> 'ACCEPTED'`)
    expect(phase3).toContain('renderAcceptanceCertificatePdf')
    expect(phase3).toContain("source: 'contract_acceptance_certificate'")
    expect(phase3).toContain("linkRole: 'acceptance_certificate'")
    expect(phase3).toContain("status: 'EFFECTIVE'")
    expect(phase3).toContain("eventType: amendment ? 'amendment_effective' : 'contract_effective'")
  })

  test('partial acceptance is explicit and cannot be silently regressed', () => {
    expect(phase3).toContain("status: 'PARTIALLY_ACCEPTED'")
    expect(phase3).toContain("lifecycleStatus: 'partially_accepted'")
    expect(migration).toContain("OLD.\"status\" = 'PARTIALLY_ACCEPTED'")
    expect(migration).toContain('Partially accepted contract versions cannot regress')
  })

  test('amendments create replacement versions while preserving the effective base until completion', () => {
    expect(phase3).toContain('createContractAmendmentDraft')
    expect(phase3).toContain('issueContractAmendment')
    expect(phase3).toContain("if (!base || base.status !== 'EFFECTIVE')")
    expect(phase3).toContain("await tx.contractVersion.update({ where: { id: base.id }, data: { status: 'SUPERSEDED' } })")
    expect(phase3).toContain("status: 'EFFECTIVE', currentVersionNumber: base?.versionNumber")
    expect(governanceUi).toContain('old version remains effective until the replacement is fully accepted')
    expect(governanceUi).toContain('Propose replacement terms')
  })

  test('rejection is final evidence and requires a new version for changed terms', () => {
    expect(phase3).toContain("eventType: input.decision === 'ACCEPTED' ? 'party_accepted' : 'party_rejected'")
    expect(phase3).toContain("status: 'REJECTED'")
    expect(decisionPanel).toContain('a new governed version is required for any changes')
    expect(migration).toContain('Rejected contract versions are final')
  })

  test('admin routes cannot forge party acceptance', () => {
    for (const file of filesUnder('src/app/api/admin')) {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue
      const source = readFileSync(file, 'utf8')
      expect(source).not.toContain('recordContractDecision')
      expect(source).not.toContain('ContractAcceptance')
    }
  })
})
