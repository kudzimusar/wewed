import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const service = readFileSync('src/lib/contracts/phase6.ts', 'utf8')
const dashboardRoute = readFileSync('src/app/api/planner/contract-intelligence/route.ts', 'utf8')
const explainRoute = readFileSync('src/app/api/planner/contract-intelligence/explain/route.ts', 'utf8')
const amendmentRoute = readFileSync('src/app/api/planner/contract-intelligence/amendment-assist/route.ts', 'utf8')
const adminRoute = readFileSync('src/app/api/admin/contract-intelligence/route.ts', 'utf8')
const page = readFileSync('src/app/planner/contract-intelligence/page.tsx', 'utf8')

describe('Vault/Contracts Phase 6 intelligence, analytics and trust', () => {
  test('is a read-only derived layer over governed records', () => {
    expect(service).toContain("import 'server-only'")
    expect(service).toContain('ContractVersionEffectivity')
    expect(service).toContain('ManagedPaymentRecord')
    expect(service).toContain('DisputeCase')
    expect(service).toContain('EvidenceHold')
    expect(service).not.toContain('.create({')
    expect(service).not.toContain('.update({')
    expect(service).not.toContain('.delete({')
    expect(service).not.toContain('$executeRaw')
  })

  test('keeps planner search and dashboards wedding-scoped', () => {
    expect(dashboardRoute).toContain("requireWeddingPermission(request, 'planner.dashboard.view')")
    expect(dashboardRoute).toContain('access.context.weddingId')
    expect(service).toContain("where: { weddingId: input.weddingId }")
    expect(service).toContain('normalizedQuery')
  })

  test('uses factual review prompts rather than legal or fraud findings', () => {
    expect(service).toContain('Review signals are factual workflow prompts, not legal findings, fraud determinations, or adjudications.')
    expect(service).toContain("code: 'PAYMENT_PROOF_GAP'")
    expect(service).toContain("code: 'OPEN_DISPUTE'")
    expect(service).toContain("code: 'ACTIVE_EVIDENCE_HOLD'")
    expect(page).toContain('Signals are review prompts, not findings.')
    expect(page).toContain('not a reputation score or breach/fraud finding')
  })

  test('makes AI explanation optional, transient and incapable of changing governance', () => {
    expect(explainRoute).toContain("requireWeddingPermission(request, 'planner.dashboard.view')")
    expect(explainRoute).toContain('generateAiText')
    expect(explainRoute).toContain('advisoryOnly: true')
    expect(explainRoute).toContain('The governed contract record is unchanged')
    expect(explainRoute).not.toContain('ContractAcceptance')
    expect(explainRoute).not.toContain('ContractVersionEffectivity')
    expect(explainRoute).not.toContain('$executeRaw')
  })

  test('extracts amendment proposals without creating an amendment', () => {
    expect(amendmentRoute).toContain('generateAiText')
    expect(amendmentRoute).toContain('persisted: false')
    expect(amendmentRoute).toContain('Do not create or approve an amendment')
    expect(amendmentRoute).not.toContain('ContractAmendment')
    expect(amendmentRoute).not.toContain('.create(')
    expect(amendmentRoute).not.toContain('$executeRaw')
  })

  test('rate-limits private AI assistance and treats governed context as untrusted input', () => {
    expect(explainRoute).toContain('consumeAiRateLimit')
    expect(amendmentRoute).toContain('consumeAiRateLimit')
    expect(explainRoute).toContain('wrapUntrustedContext')
    expect(amendmentRoute).toContain('wrapUntrustedContext')
    expect(explainRoute).toContain("profile: 'private'")
    expect(amendmentRoute).toContain("profile: 'private'")
  })

  test('keeps Admin support aggregate-only and read-only', () => {
    expect(adminRoute).toContain("requireWewedAdmin(request, 'admin.support.read')")
    expect(adminRoute).toContain('getPrivacySafeAdminIntelligence')
    expect(adminRoute).not.toContain('export async function POST')
    expect(adminRoute).not.toContain('export async function PATCH')
    expect(adminRoute).not.toContain('export async function DELETE')
    expect(service).toContain('aggregate counts only: no contract text, party identity, contact detail, or AI prompt content')
  })

  test('states the Phase 6 kill-switch boundary in the user experience', () => {
    expect(page).toContain('AI explanations are advisory only')
    expect(page).toContain('No AI action accepts or amends a contract')
    expect(service).toContain('never accept, amend, make effective, pay, archive, or alter evidence')
  })
})
