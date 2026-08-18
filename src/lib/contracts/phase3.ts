import 'server-only'

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { renderContractPdf, type ContractPdfModel } from '@/lib/contracts/pdf'
import { renderAcceptanceCertificatePdf } from '@/lib/contracts/acceptance-certificate'
import {
  createVaultLink,
  prepareVaultUpload,
  registerPreparedVaultObject,
  removePreparedVaultUpload,
} from '@/lib/vault/core'
import {
  CONTRACT_REVIEW_TTL_DAYS,
  WEWED_CANONICAL_SITE,
  sha256,
  stableContractJson,
} from '@/lib/contracts/phase2'

export const CONTRACT_ACCEPTANCE_DECLARATION_VERSION = 'wewed.acceptance.v1'
export const CONTRACT_ACCEPTANCE_DECLARATION =
  'I confirm that I am the named or authorised party shown for this review link, I have reviewed this exact Wewed contract version and its SHA-256 fingerprints, and I explicitly accept the terms of this version. I understand that viewing, payment, or message delivery alone is not acceptance.'

const REVIEWABLE_STATUSES = new Set(['ISSUED', 'AWAITING_ACCEPTANCE', 'PARTIALLY_ACCEPTED'])
const REVIEWABLE_PARTY_ROLES = new Set(['CLIENT', 'PLANNER', 'SERVICE_PROVIDER', 'AUTHORIZED_REPRESENTATIVE', 'WITNESS'])

export class Phase3ContractError extends Error {
  constructor(message: string, readonly status = 400, readonly field?: string) {
    super(message)
    this.name = 'Phase3ContractError'
  }
}

type RequirementRow = {
  id: string
  contractId: string
  contractVersionId: string
  engagementPartyId: string
  requiredRole: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED'
  acceptedAt: Date | null
  rejectedAt: Date | null
}

type AcceptanceRow = {
  id: string
  contractId: string
  contractVersionId: string
  engagementPartyId: string
  requirementId: string
  decision: 'ACCEPTED' | 'REJECTED'
  representedRole: string
  identityKind: 'SECURE_REVIEW_LINK' | 'AUTHENTICATED_ACCOUNT'
  declarationVersion: string
  contractContentSha256: string
  contractArtifactSha256: string
  sourceChannel: string
  decisionAt: Date
  reason: string | null
}

type AmendmentRow = {
  id: string
  contractId: string
  baseVersionId: string
  proposedVersionId: string
  reason: string
  diffSummary: unknown
  status: 'DRAFT' | 'PROPOSED' | 'PARTIALLY_ACCEPTED' | 'EFFECTIVE' | 'REJECTED' | 'WITHDRAWN'
  proposedById: string
  proposedAt: Date | null
  effectiveAt: Date | null
  rejectedAt: Date | null
}

type CanonicalContract = {
  schemaVersion: string
  contractNumber: string
  title: string
  snapshotAt: string
  template: {
    code: string
    semanticVersion: string
    marketCode: string
    jurisdictionCode: string | null
    reviewStatus: string
    status: string
  }
  wedding: {
    id: string
    title: string
    date: string
    venue: string
    venueCity: string
    venueCountry: string
  }
  service: {
    engagementId: string
    vendorId: string
    vendorName: string
    category: string
    description: string | null
    serviceDate: string | null
    location: string | null
    agreedAmount: string | null
    currency: string
  }
  parties: Array<{
    partyId: string
    role: string
    kind: string
    displayName: string
    legalName: string | null
    authorityBasis: string | null
    requiredForReview: boolean
  }>
  clauses: Array<{ code: string; version: string; title: string; family: string; body: string }>
  platform: Record<string, unknown>
}

function normalize(value: unknown, max = 4000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function normalizeIdentity(value: unknown): string {
  return normalize(value, 320).normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase()
}

function hashEvidence(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function safeJson(value: string): CanonicalContract {
  try {
    return JSON.parse(value) as CanonicalContract
  } catch {
    throw new Phase3ContractError('The governed contract version could not be verified.', 500)
  }
}

function dateLabel(value: string | null): string {
  if (!value) return 'Not specified'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10)
}

function html(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function amendmentHtml(canonical: CanonicalContract, diff: Array<{ field: string; before: unknown; after: unknown }>, contentSha256: string): string {
  const clauses = canonical.clauses
    .map((clause, index) => `<section><h3>${index + 1}. ${html(clause.title)}</h3><p>${html(clause.body)}</p></section>`)
    .join('')
  const changes = diff
    .map((item) => `<tr><th>${html(item.field)}</th><td>${html(item.before ?? 'Not specified')}</td><td>${html(item.after ?? 'Not specified')}</td></tr>`)
    .join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>
  body{margin:0;background:#f3eee5;color:#2d211b;font:15px/1.55 Arial,sans-serif}main{max-width:900px;margin:24px auto;background:#fffdf8;border:1px solid #ddcfb8;border-radius:18px;padding:36px}h1,h2{font-family:Georgia,serif}h1{color:#7c6137}table{width:100%;border-collapse:collapse;margin:18px 0}th,td{border:1px solid #ddd0bb;padding:10px;text-align:left;vertical-align:top}th{background:#f7f0e2}section{border:1px solid #e5dccd;border-radius:10px;padding:12px;margin:10px 0}.hash{word-break:break-all;background:#f7f2e9;padding:12px;border-radius:10px}.notice{border-left:4px solid #a8874e;padding:10px 14px;background:#fff7e6}</style></head><body><main>
  <p><strong>WEWED · wewed.pro</strong></p><h1>${html(canonical.title)}</h1><p>${html(canonical.contractNumber)} · Proposed replacement version</p>
  <div class="notice">This is a governed amendment proposal. The previously effective version remains effective until every required party accepts this exact replacement version. Viewing does not constitute acceptance.</div>
  <h2>Changes from current effective version</h2><table><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>${changes}</tbody></table>
  <h2>Service</h2><p><strong>${html(canonical.service.vendorName)}</strong> · ${html(canonical.service.category)}</p><p>${html(canonical.service.description || 'No additional description')}</p><p>${html(dateLabel(canonical.service.serviceDate))} · ${html(canonical.service.location || 'Location not specified')} · ${html(canonical.service.agreedAmount || 'Amount not specified')} ${html(canonical.service.currency)}</p>
  <h2>Wewed standard terms</h2>${clauses}<h2>Exact version fingerprint</h2><div class="hash">Canonical SHA-256: ${html(contentSha256)}</div>
  <p><small>Created and governed through Wewed. Wewed does not become the merchant, service provider, guarantor, or adjudicator by providing this governance layer.</small></p>
  </main></body></html>`
}

function pdfModel(canonical: CanonicalContract, contentSha256: string, versionNumber: number): ContractPdfModel {
  return {
    contractNumber: canonical.contractNumber,
    title: canonical.title,
    versionNumber,
    templateVersion: canonical.template.semanticVersion,
    reviewStatus: canonical.template.reviewStatus.replaceAll('_', ' '),
    weddingTitle: canonical.wedding.title,
    weddingDate: dateLabel(canonical.wedding.date),
    serviceCategory: canonical.service.category,
    serviceDescription: canonical.service.description || '',
    serviceLocation: canonical.service.location || [canonical.wedding.venue, canonical.wedding.venueCity, canonical.wedding.venueCountry].filter(Boolean).join(', '),
    agreedAmount: canonical.service.agreedAmount ?? '',
    currency: canonical.service.currency,
    parties: canonical.parties.map((party) => ({ role: party.role, displayName: party.displayName, authorityBasis: party.authorityBasis })),
    clauses: canonical.clauses.map((clause) => ({ title: clause.title, body: clause.body })),
    contentSha256,
    verificationUrl: `${WEWED_CANONICAL_SITE}/contracts/verify/${encodeURIComponent(canonical.contractNumber)}?v=${versionNumber}`,
  }
}

async function requirementForGrant(grant: { id: string; contractId: string; contractVersionId: string; engagementPartyId: string | null; role: string }): Promise<RequirementRow> {
  if (!grant.engagementPartyId) throw new Phase3ContractError('This review link is not bound to a governed party.', 409)
  if (!REVIEWABLE_PARTY_ROLES.has(grant.role)) throw new Phase3ContractError('This party role cannot accept a contract.', 409)
  const id = `requirement-${randomUUID()}`
  await db.$executeRawUnsafe(
    `INSERT INTO wewed_contracts."ContractPartyRequirement"
      ("id", "contractId", "contractVersionId", "engagementPartyId", "requiredRole", "status")
     VALUES ($1,$2,$3,$4,$5,'PENDING')
     ON CONFLICT ("contractVersionId", "engagementPartyId") DO NOTHING`,
    id, grant.contractId, grant.contractVersionId, grant.engagementPartyId, grant.role,
  )
  const rows = await db.$queryRawUnsafe<RequirementRow[]>(
    `SELECT * FROM wewed_contracts."ContractPartyRequirement" WHERE "contractVersionId"=$1 AND "engagementPartyId"=$2 LIMIT 1`,
    grant.contractVersionId, grant.engagementPartyId,
  )
  if (!rows[0]) throw new Phase3ContractError('Acceptance requirement could not be established.', 500)
  return rows[0]
}

async function amendmentForVersion(versionId: string): Promise<AmendmentRow | null> {
  const rows = await db.$queryRawUnsafe<AmendmentRow[]>(
    `SELECT * FROM wewed_contracts."ContractAmendment" WHERE "proposedVersionId"=$1 LIMIT 1`,
    versionId,
  )
  return rows[0] ?? null
}

export async function getPhase3ContractReviewByToken(rawToken: string) {
  const token = rawToken.trim()
  if (token.length < 32 || token.length > 200) throw new Phase3ContractError('Review link is invalid.', 404)
  const tokenHash = sha256(token)
  const grant = await db.contractReviewGrant.findUnique({
    where: { tokenHash },
    include: {
      engagementParty: true,
      contractVersion: true,
      contract: { include: { template: true, serviceEngagement: { include: { vendor: true } } } },
    },
  })
  if (!grant || grant.status !== 'ACTIVE') throw new Phase3ContractError('Review link is unavailable or has been revoked.', 404)
  if (grant.expiresAt.getTime() <= Date.now()) {
    await db.contractReviewGrant.update({ where: { id: grant.id }, data: { status: 'EXPIRED' } })
    throw new Phase3ContractError('Review link has expired. Ask the planner for a new Wewed review link.', 410)
  }
  if (!grant.contractVersion.issuedAt || !REVIEWABLE_STATUSES.has(grant.contractVersion.status)) {
    const existing = await db.$queryRawUnsafe<AcceptanceRow[]>(
      `SELECT * FROM wewed_contracts."ContractAcceptance" WHERE "contractVersionId"=$1 AND "engagementPartyId"=$2 LIMIT 1`,
      grant.contractVersionId, grant.engagementPartyId ?? '',
    )
    if (!existing[0] || !['EFFECTIVE', 'REJECTED', 'SUPERSEDED'].includes(grant.contractVersion.status)) {
      throw new Phase3ContractError('This contract version is not available for review.', 409)
    }
  }

  const requirement = await requirementForGrant(grant)
  const acceptanceRows = await db.$queryRawUnsafe<AcceptanceRow[]>(
    `SELECT * FROM wewed_contracts."ContractAcceptance" WHERE "contractVersionId"=$1 AND "engagementPartyId"=$2 LIMIT 1`,
    grant.contractVersionId, grant.engagementPartyId ?? '',
  )
  const amendment = await amendmentForVersion(grant.contractVersionId)
  const now = new Date()
  await db.$transaction(async (tx) => {
    await tx.contractReviewGrant.update({ where: { id: grant.id }, data: { lastAccessedAt: now } })
    await tx.contractEvent.create({
      data: {
        contractId: grant.contractId,
        versionId: grant.contractVersionId,
        eventType: 'review_link_viewed',
        actorId: null,
        metadata: JSON.stringify({ grantId: grant.id, role: grant.role, viewedAt: now.toISOString(), acceptanceRecorded: Boolean(acceptanceRows[0]) }),
      },
    })
  })

  return {
    contractNumber: grant.contract.contractNumber,
    title: grant.contract.title,
    vendorName: grant.contract.serviceEngagement.vendor.name,
    versionNumber: grant.contractVersion.versionNumber,
    versionStatus: grant.contractVersion.status,
    issuedAt: grant.contractVersion.issuedAt?.toISOString() ?? null,
    contentSha256: grant.contractVersion.contentSha256,
    artifactSha256: grant.contractVersion.artifactSha256,
    templateVersion: grant.contractVersion.templateSemanticVersion,
    templateReviewStatus: grant.contract.template.reviewStatus,
    viewerRole: grant.role,
    viewerName: grant.engagementParty?.displayName ?? null,
    viewerEmailRequired: Boolean(grant.engagementParty?.email),
    renderedHtml: grant.contractVersion.renderedHtml,
    canAccept: requirement.status === 'PENDING' && !acceptanceRows[0] && REVIEWABLE_STATUSES.has(grant.contractVersion.status),
    decision: acceptanceRows[0]?.decision ?? null,
    decisionAt: acceptanceRows[0]?.decisionAt?.toISOString() ?? null,
    declarationVersion: CONTRACT_ACCEPTANCE_DECLARATION_VERSION,
    declaration: CONTRACT_ACCEPTANCE_DECLARATION,
    amendment: amendment ? { id: amendment.id, status: amendment.status, reason: amendment.reason, diffSummary: amendment.diffSummary } : null,
  }
}

function validateIdentity(party: { displayName: string; legalName: string | null; email: string | null }, input: { identityName?: unknown; identityEmail?: unknown }) {
  const suppliedName = normalizeIdentity(input.identityName)
  const displayName = normalizeIdentity(party.displayName)
  const legalName = normalizeIdentity(party.legalName)
  const nameMatch = Boolean(suppliedName) && (suppliedName === displayName || (legalName && suppliedName === legalName))
  if (!nameMatch) throw new Phase3ContractError('Enter the party name shown on this review link.', 400, 'identityName')

  const suppliedEmail = normalizeIdentity(input.identityEmail)
  const expectedEmail = normalizeIdentity(party.email)
  const emailMatch = expectedEmail ? suppliedEmail === expectedEmail : true
  if (!emailMatch) throw new Phase3ContractError('The email address does not match this governed party.', 403, 'identityEmail')
  return { nameMatch, emailMatch, suppliedEmail }
}

async function allAcceptanceRows(versionId: string) {
  return db.$queryRawUnsafe<Array<AcceptanceRow & { partyName: string }>>(
    `SELECT a.*, p."displayName" AS "partyName"
     FROM wewed_contracts."ContractAcceptance" a
     JOIN public."EngagementParty" p ON p."id" = a."engagementPartyId"
     WHERE a."contractVersionId"=$1 AND a."decision"='ACCEPTED'
     ORDER BY a."decisionAt", a."id"`,
    versionId,
  )
}

async function finalizeEffectivity(versionId: string) {
  const existing = await db.$queryRawUnsafe<Array<{ contractVersionId: string; effectiveAt: Date; acceptanceCertificateVaultObjectId: string; acceptanceCertificateSha256: string }>>(
    `SELECT * FROM wewed_contracts."ContractVersionEffectivity" WHERE "contractVersionId"=$1 LIMIT 1`, versionId,
  )
  if (existing[0]) {
    return { effective: true, effectiveAt: existing[0].effectiveAt.toISOString(), certificateVaultObjectId: existing[0].acceptanceCertificateVaultObjectId, certificateSha256: existing[0].acceptanceCertificateSha256 }
  }

  const pending = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT count(*)::bigint AS count FROM wewed_contracts."ContractPartyRequirement" WHERE "contractVersionId"=$1 AND "status" <> 'ACCEPTED'`, versionId,
  )
  if (Number(pending[0]?.count ?? 0) !== 0) return { effective: false }

  const version = await db.contractVersion.findUnique({
    where: { id: versionId },
    include: { contract: { include: { serviceEngagement: { include: { vendor: true } } } } },
  })
  if (!version || !version.issuedAt || !version.contentSha256 || !version.artifactSha256) {
    throw new Phase3ContractError('The exact issued version is incomplete and cannot become effective.', 409)
  }
  const acceptances = await allAcceptanceRows(versionId)
  const effectiveAt = new Date()
  const certificate = renderAcceptanceCertificatePdf({
    contractNumber: version.contract.contractNumber,
    title: version.contract.title,
    versionNumber: version.versionNumber,
    effectiveAt: effectiveAt.toISOString(),
    contentSha256: version.contentSha256,
    artifactSha256: version.artifactSha256,
    declarationVersion: CONTRACT_ACCEPTANCE_DECLARATION_VERSION,
    acceptances: acceptances.map((item) => ({ role: item.representedRole, partyName: item.partyName, decisionAt: item.decisionAt.toISOString(), identityKind: item.identityKind, receiptId: item.id })),
  })
  const file = new File([certificate], `${version.contract.contractNumber}-v${version.versionNumber}-acceptance-certificate.pdf`, { type: 'application/pdf' })
  const prepared = await prepareVaultUpload({
    file,
    weddingId: version.weddingId,
    actorId: null,
    source: 'contract_acceptance_certificate',
    category: 'contract_acceptance_certificate',
    metadata: { contractId: version.contractId, contractVersionId: version.id, versionNumber: version.versionNumber, receiptIds: acceptances.map((item) => item.id) },
  })

  const amendment = await amendmentForVersion(version.id)
  try {
    await db.$transaction(async (tx) => {
      const duplicate = await tx.$queryRawUnsafe<Array<{ contractVersionId: string }>>(
        `SELECT "contractVersionId" FROM wewed_contracts."ContractVersionEffectivity" WHERE "contractVersionId"=$1 FOR UPDATE`, version.id,
      )
      if (duplicate[0]) return
      await registerPreparedVaultObject(prepared, tx)
      await createVaultLink({ vaultObjectId: prepared.id, weddingId: version.weddingId, entityType: 'service_engagement', entityId: version.contract.serviceEngagementId, linkRole: 'acceptance_certificate', tx })
      await createVaultLink({ vaultObjectId: prepared.id, weddingId: version.weddingId, entityType: 'contract', entityId: version.contractId, linkRole: 'acceptance_certificate', tx })
      await createVaultLink({ vaultObjectId: prepared.id, weddingId: version.weddingId, entityType: 'contract_version', entityId: version.id, linkRole: 'acceptance_certificate', tx })
      await tx.$executeRawUnsafe(
        `INSERT INTO wewed_contracts."ContractVersionEffectivity"
          ("contractVersionId","contractId","weddingId","effectiveAt","acceptanceCertificateVaultObjectId","acceptanceCertificateSha256")
         VALUES ($1,$2,$3,$4,$5,$6)`,
        version.id, version.contractId, version.weddingId, effectiveAt, prepared.id, prepared.checksumSha256,
      )
      await tx.contractVersion.update({ where: { id: version.id }, data: { status: 'EFFECTIVE' } })

      if (amendment) {
        const base = await tx.contractVersion.findUnique({ where: { id: amendment.baseVersionId } })
        if (!base || base.status !== 'EFFECTIVE') throw new Phase3ContractError('The base contract version is no longer the effective version.', 409)
        await tx.contractVersion.update({ where: { id: base.id }, data: { status: 'SUPERSEDED' } })
        await tx.$executeRawUnsafe(
          `UPDATE wewed_contracts."ContractAmendment" SET "status"='EFFECTIVE', "effectiveAt"=$2, "updatedAt"=$2 WHERE "id"=$1`, amendment.id, effectiveAt,
        )
        const canonical = safeJson(version.canonicalJson)
        const serviceDate = canonical.service.serviceDate ? new Date(canonical.service.serviceDate) : null
        await tx.serviceEngagement.update({
          where: { id: version.contract.serviceEngagementId },
          data: {
            serviceDescription: canonical.service.description,
            agreedAmount: canonical.service.agreedAmount,
            currency: canonical.service.currency,
            serviceDate,
            serviceLocation: canonical.service.location,
            lifecycleStatus: 'effective',
          },
        })
      } else {
        await tx.serviceEngagement.update({ where: { id: version.contract.serviceEngagementId }, data: { lifecycleStatus: 'effective' } })
      }
      await tx.contract.update({ where: { id: version.contractId }, data: { status: 'EFFECTIVE', currentVersionNumber: version.versionNumber } })
      await tx.vendor.update({ where: { id: version.contract.serviceEngagement.vendorId }, data: { contractStatus: 'signed' } })
      await tx.contractReviewGrant.updateMany({
        where: { contractVersionId: version.id, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: effectiveAt },
      })
      await tx.contractEvent.create({
        data: {
          contractId: version.contractId,
          versionId: version.id,
          eventType: amendment ? 'amendment_effective' : 'contract_effective',
          actorId: null,
          metadata: JSON.stringify({ effectiveAt: effectiveAt.toISOString(), acceptanceCertificateVaultObjectId: prepared.id, acceptanceCertificateSha256: prepared.checksumSha256, receiptCount: acceptances.length, previousVersionId: amendment?.baseVersionId ?? null }),
        },
      })
    })
  } catch (error) {
    await removePreparedVaultUpload(prepared)
    throw error
  }

  return { effective: true, effectiveAt: effectiveAt.toISOString(), certificateVaultObjectId: prepared.id, certificateSha256: prepared.checksumSha256 }
}

export async function recordContractDecision(input: {
  token: string
  decision: 'ACCEPTED' | 'REJECTED'
  identityName?: unknown
  identityEmail?: unknown
  declarationAccepted?: unknown
  reason?: unknown
  userAgent?: string | null
  ipAddress?: string | null
  sourceChannel?: 'WEB' | 'MOBILE_WEB'
}) {
  const token = input.token.trim()
  if (token.length < 32 || token.length > 200) throw new Phase3ContractError('Review link is invalid.', 404)
  if (!['ACCEPTED', 'REJECTED'].includes(input.decision)) throw new Phase3ContractError('Choose accept or reject.', 400)
  if (input.decision === 'ACCEPTED' && input.declarationAccepted !== true) {
    throw new Phase3ContractError('Explicitly confirm the acceptance declaration.', 400, 'declarationAccepted')
  }
  const tokenHash = sha256(token)
  const grant = await db.contractReviewGrant.findUnique({
    where: { tokenHash },
    include: { engagementParty: true, contractVersion: true, contract: { include: { serviceEngagement: { include: { vendor: true } } } } },
  })
  if (!grant || grant.status !== 'ACTIVE' || !grant.engagementParty) throw new Phase3ContractError('Review link is unavailable or has been revoked.', 404)
  if (grant.expiresAt.getTime() <= Date.now()) {
    await db.contractReviewGrant.update({ where: { id: grant.id }, data: { status: 'EXPIRED' } })
    throw new Phase3ContractError('Review link has expired.', 410)
  }
  if (!grant.contractVersion.issuedAt || !REVIEWABLE_STATUSES.has(grant.contractVersion.status)) {
    throw new Phase3ContractError('This contract version is no longer accepting decisions.', 409)
  }
  if (!grant.contractVersion.contentSha256 || !grant.contractVersion.artifactSha256) {
    throw new Phase3ContractError('The exact contract fingerprints are missing.', 409)
  }
  const identity = validateIdentity(grant.engagementParty, input)
  const requirement = await requirementForGrant(grant)
  const existing = await db.$queryRawUnsafe<AcceptanceRow[]>(
    `SELECT * FROM wewed_contracts."ContractAcceptance" WHERE "contractVersionId"=$1 AND "engagementPartyId"=$2 LIMIT 1`,
    grant.contractVersionId, grant.engagementParty.id,
  )
  if (existing[0]) {
    if (existing[0].decision === 'ACCEPTED') {
      const final = await finalizeEffectivity(grant.contractVersionId)
      return { decision: existing[0].decision, decisionAt: existing[0].decisionAt.toISOString(), receiptId: existing[0].id, duplicate: true, ...final }
    }
    return { decision: existing[0].decision, decisionAt: existing[0].decisionAt.toISOString(), receiptId: existing[0].id, duplicate: true, effective: false }
  }
  if (requirement.status !== 'PENDING') throw new Phase3ContractError('This party requirement already has a final decision.', 409)

  const decisionAt = new Date()
  const receiptId = `acceptance-${randomUUID()}`
  const declarationSha256 = sha256(CONTRACT_ACCEPTANCE_DECLARATION)
  const reason = normalize(input.reason, 2000) || null
  const identityEvidence = {
    grantId: grant.id,
    tokenHash,
    nameMatched: identity.nameMatch,
    emailMatched: identity.emailMatch,
    emailSha256: identity.suppliedEmail ? hashEvidence(identity.suppliedEmail) : null,
    ipSha256: input.ipAddress ? hashEvidence(input.ipAddress) : null,
    userAgentSha256: input.userAgent ? hashEvidence(input.userAgent) : null,
  }
  const amendment = await amendmentForVersion(grant.contractVersionId)

  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_contracts."ContractAcceptance"
        ("id","contractId","contractVersionId","engagementPartyId","requirementId","decision","representedRole","actorUserId","identityKind","identityEvidence","declarationVersion","declarationSha256","contractContentSha256","contractArtifactSha256","sourceChannel","decisionAt","reason")
       VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,'SECURE_REVIEW_LINK',$8::jsonb,$9,$10,$11,$12,$13,$14,$15)`,
      receiptId, grant.contractId, grant.contractVersionId, grant.engagementParty.id, requirement.id, input.decision, grant.role,
      JSON.stringify(identityEvidence), CONTRACT_ACCEPTANCE_DECLARATION_VERSION, declarationSha256,
      grant.contractVersion.contentSha256, grant.contractVersion.artifactSha256, input.sourceChannel ?? 'WEB', decisionAt, reason,
    )
    await tx.$executeRawUnsafe(
      `UPDATE wewed_contracts."ContractPartyRequirement"
       SET "status"=$2, "acceptedAt"=CASE WHEN $2='ACCEPTED' THEN $3 ELSE NULL END,
           "rejectedAt"=CASE WHEN $2='REJECTED' THEN $3 ELSE NULL END, "updatedAt"=$3
       WHERE "id"=$1 AND "status"='PENDING'`,
      requirement.id, input.decision, decisionAt,
    )
    await tx.contractEvent.create({
      data: {
        contractId: grant.contractId,
        versionId: grant.contractVersionId,
        eventType: input.decision === 'ACCEPTED' ? 'party_accepted' : 'party_rejected',
        actorId: null,
        metadata: JSON.stringify({ receiptId, partyId: grant.engagementParty.id, role: grant.role, decisionAt: decisionAt.toISOString(), declarationVersion: CONTRACT_ACCEPTANCE_DECLARATION_VERSION, contentSha256: grant.contractVersion.contentSha256, artifactSha256: grant.contractVersion.artifactSha256 }),
      },
    })

    if (input.decision === 'REJECTED') {
      await tx.contractVersion.update({ where: { id: grant.contractVersionId }, data: { status: 'REJECTED' } })
      await tx.contractReviewGrant.updateMany({ where: { contractVersionId: grant.contractVersionId, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: decisionAt } })
      if (amendment) {
        const base = await tx.contractVersion.findUnique({ where: { id: amendment.baseVersionId } })
        await tx.$executeRawUnsafe(`UPDATE wewed_contracts."ContractAmendment" SET "status"='REJECTED', "rejectedAt"=$2, "updatedAt"=$2 WHERE "id"=$1`, amendment.id, decisionAt)
        await tx.contract.update({ where: { id: grant.contractId }, data: { status: 'EFFECTIVE', currentVersionNumber: base?.versionNumber ?? Math.max(1, grant.contractVersion.versionNumber - 1) } })
        await tx.serviceEngagement.update({ where: { id: grant.contract.serviceEngagementId }, data: { lifecycleStatus: 'effective' } })
      } else {
        await tx.contract.update({ where: { id: grant.contractId }, data: { status: 'REJECTED' } })
        await tx.serviceEngagement.update({ where: { id: grant.contract.serviceEngagementId }, data: { lifecycleStatus: 'rejected' } })
        await tx.vendor.update({ where: { id: grant.contract.serviceEngagement.vendorId }, data: { contractStatus: 'rejected' } })
      }
    }
  })

  if (input.decision === 'REJECTED') {
    return { decision: input.decision, decisionAt: decisionAt.toISOString(), receiptId, effective: false, rejected: true }
  }

  const pending = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT count(*)::bigint AS count FROM wewed_contracts."ContractPartyRequirement" WHERE "contractVersionId"=$1 AND "status" <> 'ACCEPTED'`, grant.contractVersionId,
  )
  if (Number(pending[0]?.count ?? 0) > 0) {
    await db.$transaction(async (tx) => {
      await tx.contractVersion.update({ where: { id: grant.contractVersionId }, data: { status: 'PARTIALLY_ACCEPTED' } })
      await tx.contract.update({ where: { id: grant.contractId }, data: { status: 'PARTIALLY_ACCEPTED' } })
      if (amendment) {
        await tx.$executeRawUnsafe(`UPDATE wewed_contracts."ContractAmendment" SET "status"='PARTIALLY_ACCEPTED', "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "status"='PROPOSED'`, amendment.id)
      } else {
        await tx.serviceEngagement.update({ where: { id: grant.contract.serviceEngagementId }, data: { lifecycleStatus: 'partially_accepted' } })
      }
    })
    return { decision: input.decision, decisionAt: decisionAt.toISOString(), receiptId, effective: false, pendingRequirements: Number(pending[0]?.count ?? 0) }
  }

  const final = await finalizeEffectivity(grant.contractVersionId)
  return { decision: input.decision, decisionAt: decisionAt.toISOString(), receiptId, ...final }
}

function amendmentPatch(input: Record<string, unknown>, base: CanonicalContract) {
  const next = structuredClone(base)
  const diff: Array<{ field: string; before: unknown; after: unknown }> = []
  const set = (field: keyof CanonicalContract['service'], value: unknown) => {
    const before = next.service[field]
    if (before === value) return
    ;(next.service[field] as unknown) = value
    diff.push({ field: `service.${field}`, before, after: value })
  }

  if ('serviceDescription' in input) set('description', normalize(input.serviceDescription, 6000) || null)
  if ('serviceLocation' in input) set('location', normalize(input.serviceLocation, 500) || null)
  if ('currency' in input) {
    const currency = normalize(input.currency, 3).toUpperCase()
    if (!/^[A-Z]{3}$/.test(currency)) throw new Phase3ContractError('Currency must use a three-letter code.', 400, 'currency')
    set('currency', currency)
  }
  if ('agreedAmount' in input) {
    if (input.agreedAmount === null || input.agreedAmount === '') set('agreedAmount', null)
    else {
      const amount = Number(input.agreedAmount)
      if (!Number.isFinite(amount) || amount < 0) throw new Phase3ContractError('Agreed amount must be zero or greater.', 400, 'agreedAmount')
      set('agreedAmount', (Math.round(amount * 100) / 100).toFixed(2))
    }
  }
  if ('serviceDate' in input) {
    const raw = normalize(input.serviceDate, 60)
    if (!raw) set('serviceDate', null)
    else {
      const date = new Date(raw)
      if (Number.isNaN(date.getTime())) throw new Phase3ContractError('Service date is invalid.', 400, 'serviceDate')
      set('serviceDate', date.toISOString())
    }
  }
  next.snapshotAt = new Date().toISOString()
  next.platform = { ...next.platform, acceptanceIncludedInThisPhase: true, amendmentGovernance: 'phase3' }
  return { next, diff }
}

export async function createContractAmendmentDraft(input: {
  weddingId: string
  contractId: string
  actorId: string
  reason: unknown
  changes: Record<string, unknown>
}) {
  const reason = normalize(input.reason, 2000)
  if (reason.length < 3) throw new Phase3ContractError('Explain why this amendment is needed.', 400, 'reason')
  const contract = await db.contract.findFirst({
    where: { id: input.contractId, weddingId: input.weddingId, status: 'EFFECTIVE' },
    include: { versions: { orderBy: { versionNumber: 'desc' } } },
  })
  if (!contract) throw new Phase3ContractError('Only an effective contract can be amended.', 409)
  const base = contract.versions.find((version) => version.status === 'EFFECTIVE')
  if (!base) throw new Phase3ContractError('The current effective version could not be found.', 409)
  const open = await db.$queryRawUnsafe<AmendmentRow[]>(
    `SELECT * FROM wewed_contracts."ContractAmendment" WHERE "contractId"=$1 AND "status" IN ('DRAFT','PROPOSED','PARTIALLY_ACCEPTED') LIMIT 1`, contract.id,
  )
  if (open[0]) throw new Phase3ContractError('Finish or withdraw the existing amendment before creating another.', 409)

  const canonical = safeJson(base.canonicalJson)
  const { next, diff } = amendmentPatch(input.changes, canonical)
  if (diff.length === 0) throw new Phase3ContractError('The amendment does not change any governed service term.', 400)
  const versionNumber = Math.max(...contract.versions.map((version) => version.versionNumber)) + 1
  const canonicalJson = stableContractJson(next)
  const previewSha256 = sha256(canonicalJson)
  const renderedHtml = amendmentHtml(next, diff, previewSha256)
  const amendmentId = `amendment-${randomUUID()}`

  return db.$transaction(async (tx) => {
    const version = await tx.contractVersion.create({
      data: {
        contractId: contract.id,
        weddingId: input.weddingId,
        versionNumber,
        status: 'DRAFT',
        templateSemanticVersion: base.templateSemanticVersion,
        canonicalJson,
        renderedHtml,
        createdById: input.actorId,
      },
    })
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_contracts."ContractAmendment" ("id","contractId","baseVersionId","proposedVersionId","reason","diffSummary","status","proposedById") VALUES ($1,$2,$3,$4,$5,$6::jsonb,'DRAFT',$7)`,
      amendmentId, contract.id, base.id, version.id, reason, JSON.stringify(diff), input.actorId,
    )
    await tx.contractEvent.create({
      data: { contractId: contract.id, versionId: version.id, eventType: 'amendment_draft_created', actorId: input.actorId, metadata: JSON.stringify({ amendmentId, baseVersionId: base.id, proposedVersionNumber: versionNumber, reason, diff }) },
    })
    return { amendmentId, contractId: contract.id, baseVersionId: base.id, proposedVersionId: version.id, proposedVersionNumber: versionNumber, reason, diff, previewSha256, renderedHtml }
  })
}

function rawReviewGrant(party: { id: string; partyRole: string }) {
  const token = randomBytes(32).toString('base64url')
  return { partyId: party.id, role: party.partyRole, token, tokenHash: sha256(token), reviewUrl: `${WEWED_CANONICAL_SITE}/contracts/review/${token}` }
}

export async function issueContractAmendment(input: { weddingId: string; amendmentId: string; actorId: string }) {
  const rows = await db.$queryRawUnsafe<AmendmentRow[]>(
    `SELECT * FROM wewed_contracts."ContractAmendment" WHERE "id"=$1 LIMIT 1`, input.amendmentId,
  )
  const amendment = rows[0]
  if (!amendment || amendment.status !== 'DRAFT') throw new Phase3ContractError('Amendment draft was not found or is no longer issuable.', 409)
  const version = await db.contractVersion.findFirst({
    where: { id: amendment.proposedVersionId, weddingId: input.weddingId, status: 'DRAFT' },
    include: { contract: { include: { serviceEngagement: { include: { parties: { where: { status: 'active', requiredForReview: true } }, vendor: true } }, template: true } } },
  })
  if (!version || version.contract.id !== amendment.contractId) throw new Phase3ContractError('Amendment version was not found in this wedding.', 404)
  const base = await db.contractVersion.findUnique({ where: { id: amendment.baseVersionId } })
  if (!base || base.status !== 'EFFECTIVE') throw new Phase3ContractError('The base version must remain effective while an amendment is proposed.', 409)
  const requiredParties = version.contract.serviceEngagement.parties.filter((party) => REVIEWABLE_PARTY_ROLES.has(party.partyRole))
  if (requiredParties.length === 0) throw new Phase3ContractError('At least one governed party is required.', 409)

  const canonical = safeJson(version.canonicalJson)
  const contentSha256 = sha256(version.canonicalJson)
  const pdf = renderContractPdf(pdfModel(canonical, contentSha256, version.versionNumber))
  const file = new File([pdf], `${version.contract.contractNumber}-v${version.versionNumber}-amendment.pdf`, { type: 'application/pdf' })
  const prepared = await prepareVaultUpload({
    file,
    weddingId: input.weddingId,
    actorId: input.actorId,
    source: 'contract_amendment_generator',
    category: 'contract_amendment',
    metadata: { amendmentId: amendment.id, contractId: version.contractId, contractVersionId: version.id, baseVersionId: amendment.baseVersionId, versionNumber: version.versionNumber, canonicalSha256: contentSha256 },
  })
  const rawGrants = requiredParties.map(rawReviewGrant)
  const issuedAt = new Date()
  const expiresAt = new Date(issuedAt.getTime() + CONTRACT_REVIEW_TTL_DAYS * 24 * 60 * 60 * 1000)

  try {
    await db.$transaction(async (tx) => {
      await registerPreparedVaultObject(prepared, tx)
      await createVaultLink({ vaultObjectId: prepared.id, weddingId: input.weddingId, entityType: 'service_engagement', entityId: version.contract.serviceEngagementId, linkRole: 'proposed_amendment', actorId: input.actorId, tx })
      await createVaultLink({ vaultObjectId: prepared.id, weddingId: input.weddingId, entityType: 'contract', entityId: version.contractId, linkRole: 'proposed_amendment', actorId: input.actorId, tx })
      await createVaultLink({ vaultObjectId: prepared.id, weddingId: input.weddingId, entityType: 'contract_version', entityId: version.id, linkRole: 'immutable_artifact', actorId: input.actorId, tx })
      await tx.contractVersion.update({ where: { id: version.id }, data: { status: 'AWAITING_ACCEPTANCE', contentSha256, artifactVaultObjectId: prepared.id, artifactSha256: prepared.checksumSha256, issuedAt } })
      await tx.contract.update({ where: { id: version.contractId }, data: { status: 'AWAITING_ACCEPTANCE', currentVersionNumber: version.versionNumber } })
      await tx.$executeRawUnsafe(`UPDATE wewed_contracts."ContractAmendment" SET "status"='PROPOSED', "proposedAt"=$2, "updatedAt"=$2 WHERE "id"=$1`, amendment.id, issuedAt)
      for (const grant of rawGrants) {
        await tx.contractReviewGrant.create({ data: { contractId: version.contractId, contractVersionId: version.id, engagementPartyId: grant.partyId, role: grant.role, tokenHash: grant.tokenHash, status: 'ACTIVE', expiresAt, createdById: input.actorId } })
        await tx.$executeRawUnsafe(
          `INSERT INTO wewed_contracts."ContractPartyRequirement" ("id","contractId","contractVersionId","engagementPartyId","requiredRole","status") VALUES ($1,$2,$3,$4,$5,'PENDING') ON CONFLICT ("contractVersionId","engagementPartyId") DO NOTHING`,
          `requirement-${randomUUID()}`, version.contractId, version.id, grant.partyId, grant.role,
        )
      }
      await tx.contractEvent.create({ data: { contractId: version.contractId, versionId: version.id, eventType: 'amendment_proposed', actorId: input.actorId, metadata: JSON.stringify({ amendmentId: amendment.id, baseVersionId: amendment.baseVersionId, contentSha256, artifactSha256: prepared.checksumSha256, reviewGrantCount: rawGrants.length }) } })
    })
  } catch (error) {
    await removePreparedVaultUpload(prepared)
    throw error
  }

  return { amendmentId: amendment.id, versionId: version.id, versionNumber: version.versionNumber, issuedAt: issuedAt.toISOString(), contentSha256, artifactSha256: prepared.checksumSha256, reviewLinks: rawGrants.map((grant) => ({ partyId: grant.partyId, role: grant.role, reviewUrl: grant.reviewUrl, expiresAt: expiresAt.toISOString() })) }
}

export async function rotatePendingPhase3ReviewLinks(input: { weddingId: string; contractVersionId: string; actorId: string }) {
  const version = await db.contractVersion.findFirst({
    where: { id: input.contractVersionId, weddingId: input.weddingId, status: { in: ['ISSUED', 'AWAITING_ACCEPTANCE', 'PARTIALLY_ACCEPTED'] } },
    include: { contract: { include: { serviceEngagement: { include: { parties: { where: { status: 'active', requiredForReview: true } } } } } } },
  })
  if (!version) throw new Phase3ContractError('Reviewable contract version was not found.', 404)
  const pending = await db.$queryRawUnsafe<RequirementRow[]>(
    `SELECT * FROM wewed_contracts."ContractPartyRequirement" WHERE "contractVersionId"=$1 AND "status"='PENDING'`, version.id,
  )
  const pendingIds = new Set(pending.map((row) => row.engagementPartyId))
  const parties = version.contract.serviceEngagement.parties.filter((party) => pendingIds.has(party.id) && REVIEWABLE_PARTY_ROLES.has(party.partyRole))
  const grants = parties.map(rawReviewGrant)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + CONTRACT_REVIEW_TTL_DAYS * 24 * 60 * 60 * 1000)
  await db.$transaction(async (tx) => {
    await tx.contractReviewGrant.updateMany({ where: { contractVersionId: version.id, status: 'ACTIVE', engagementPartyId: { in: parties.map((party) => party.id) } }, data: { status: 'REVOKED', revokedAt: now } })
    for (const grant of grants) {
      await tx.contractReviewGrant.create({ data: { contractId: version.contractId, contractVersionId: version.id, engagementPartyId: grant.partyId, role: grant.role, tokenHash: grant.tokenHash, status: 'ACTIVE', expiresAt, createdById: input.actorId } })
    }
    await tx.contractEvent.create({ data: { contractId: version.contractId, versionId: version.id, eventType: 'pending_review_links_rotated', actorId: input.actorId, metadata: JSON.stringify({ pendingPartyCount: grants.length, acceptedPartyLinksUntouched: true }) } })
  })
  return { reviewLinks: grants.map((grant) => ({ partyId: grant.partyId, role: grant.role, reviewUrl: grant.reviewUrl, expiresAt: expiresAt.toISOString() })) }
}

export async function getContractGovernanceSummary(input: { weddingId: string; contractId: string }) {
  const contract = await db.contract.findFirst({
    where: { id: input.contractId, weddingId: input.weddingId },
    include: { versions: { orderBy: { versionNumber: 'asc' } }, serviceEngagement: { include: { parties: true } }, events: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' } }, take: 80 } },
  })
  if (!contract) throw new Phase3ContractError('Contract was not found.', 404)
  const requirements = await db.$queryRawUnsafe<RequirementRow[]>(
    `SELECT r.* FROM wewed_contracts."ContractPartyRequirement" r WHERE r."contractId"=$1 ORDER BY r."createdAt", r."id"`, contract.id,
  )
  const acceptances = await db.$queryRawUnsafe<AcceptanceRow[]>(
    `SELECT a.* FROM wewed_contracts."ContractAcceptance" a WHERE a."contractId"=$1 ORDER BY a."decisionAt", a."id"`, contract.id,
  )
  const amendments = await db.$queryRawUnsafe<AmendmentRow[]>(
    `SELECT * FROM wewed_contracts."ContractAmendment" WHERE "contractId"=$1 ORDER BY "createdAt", "id"`, contract.id,
  )
  const effectivity = await db.$queryRawUnsafe<Array<{ contractVersionId: string; effectiveAt: Date; acceptanceCertificateVaultObjectId: string; acceptanceCertificateSha256: string }>>(
    `SELECT "contractVersionId","effectiveAt","acceptanceCertificateVaultObjectId","acceptanceCertificateSha256" FROM wewed_contracts."ContractVersionEffectivity" WHERE "contractId"=$1 ORDER BY "effectiveAt"`, contract.id,
  )
  return {
    contract: { id: contract.id, contractNumber: contract.contractNumber, status: contract.status, currentVersionNumber: contract.currentVersionNumber },
    versions: contract.versions.map((version) => ({ id: version.id, versionNumber: version.versionNumber, status: version.status, issuedAt: version.issuedAt?.toISOString() ?? null, contentSha256: version.contentSha256, artifactSha256: version.artifactSha256 })),
    parties: contract.serviceEngagement.parties.map((party) => ({ id: party.id, role: party.partyRole, displayName: party.displayName, requiredForReview: party.requiredForReview })),
    requirements: requirements.map((row) => ({ ...row, acceptedAt: row.acceptedAt?.toISOString() ?? null, rejectedAt: row.rejectedAt?.toISOString() ?? null })),
    acceptances: acceptances.map((row) => ({ id: row.id, contractVersionId: row.contractVersionId, engagementPartyId: row.engagementPartyId, decision: row.decision, representedRole: row.representedRole, identityKind: row.identityKind, declarationVersion: row.declarationVersion, contractContentSha256: row.contractContentSha256, contractArtifactSha256: row.contractArtifactSha256, sourceChannel: row.sourceChannel, decisionAt: row.decisionAt.toISOString(), reason: row.reason })),
    amendments: amendments.map((row) => ({ ...row, proposedAt: row.proposedAt?.toISOString() ?? null, effectiveAt: row.effectiveAt?.toISOString() ?? null, rejectedAt: row.rejectedAt?.toISOString() ?? null })),
    effectivity: effectivity.map((row) => ({ ...row, effectiveAt: row.effectiveAt.toISOString() })),
    events: contract.events.map((event) => ({ id: event.id, versionId: event.versionId, eventType: event.eventType, actorId: event.actorId, metadata: event.metadata, createdAt: event.createdAt.toISOString() })),
  }
}
