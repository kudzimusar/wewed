import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import {
  createVaultLink,
  prepareVaultUpload,
  registerPreparedVaultObject,
  removePreparedVaultUpload,
} from '@/lib/vault/core'
import { renderContractPdf, type ContractPdfModel } from '@/lib/contracts/pdf'

export const WEWED_CANONICAL_SITE = 'https://wewed.pro'
export const CONTRACT_REVIEW_TTL_DAYS = 7

const REVIEWABLE_PARTY_ROLES = new Set([
  'CLIENT',
  'PLANNER',
  'SERVICE_PROVIDER',
  'AUTHORIZED_REPRESENTATIVE',
  'WITNESS',
])

export class Phase2ContractError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'Phase2ContractError'
  }
}

export interface ManagedEngagementInput {
  vendorId?: unknown
  serviceDescription?: unknown
  agreedAmount?: unknown
  currency?: unknown
  serviceDate?: unknown
  serviceLocation?: unknown
  budgetItemIds?: unknown
}

function text(value: unknown, max = 4000): string | null {
  if (typeof value !== 'string') return null
  const result = value.trim()
  if (!result) return null
  return result.slice(0, max)
}

function currency(value: unknown): string {
  const result = typeof value === 'string' ? value.trim().toUpperCase() : 'USD'
  if (!/^[A-Z]{3}$/.test(result)) throw new Phase2ContractError('Currency must use a three-letter code.', 400, 'currency')
  return result
}

function moneyAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Phase2ContractError('Agreed amount must be zero or greater.', 400, 'agreedAmount')
  }
  return Math.round(amount * 100) / 100
}

function dateValue(value: unknown): Date | null {
  const normalized = text(value, 40)
  if (!normalized) return null
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) throw new Phase2ContractError('Service date is invalid.', 400, 'serviceDate')
  return date
}

function stringIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)))
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stable(entry)]),
    )
  }
  return value
}

export function stableContractJson(value: unknown): string {
  return JSON.stringify(stable(value))
}

export function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

function html(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function dateLabel(value: Date | string | null | undefined): string {
  if (!value) return 'Not specified'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date)
}

function amountLabel(value: Prisma.Decimal | number | string | null | undefined, currencyCode: string): string {
  if (value === null || value === undefined) return 'Not specified'
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 'Not specified'
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`
  }
}

function canonicalTemplateCategory(category: string): string {
  const normalized = category.trim().toLowerCase()
  const aliases: Record<string, string> = {
    photography: 'photographer',
    photographer: 'photographer',
    videography: 'videographer',
    videographer: 'videographer',
    catering: 'caterer',
    caterer: 'caterer',
    flowers: 'florist',
    florist: 'florist',
    entertainment: 'dj',
    music: 'dj',
    dj: 'dj',
    decoration: 'decor',
    styling: 'decor',
    decor: 'decor',
    transportation: 'transport',
    transport: 'transport',
    printing: 'stationery',
    signage: 'stationery',
    stationery: 'stationery',
    venue: 'venue',
  }
  return aliases[normalized] ?? normalized
}

async function contractTemplateFor(serviceCategory: string) {
  const category = canonicalTemplateCategory(serviceCategory)
  const exact = await db.contractTemplate.findFirst({
    where: {
      serviceCategory: category,
      status: { in: ['internal_review', 'counsel_approved', 'active'] },
    },
    include: {
      clauses: {
        include: { clause: true },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      },
    },
    orderBy: [{ createdAt: 'desc' }, { semanticVersion: 'desc' }],
  })
  if (exact) return exact

  const fallback = await db.contractTemplate.findFirst({
    where: {
      serviceCategory: 'other',
      status: { in: ['internal_review', 'counsel_approved', 'active'] },
    },
    include: {
      clauses: {
        include: { clause: true },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      },
    },
    orderBy: [{ createdAt: 'desc' }, { semanticVersion: 'desc' }],
  })
  if (!fallback) throw new Phase2ContractError('No Wewed contract template is available for this service yet.', 409)
  return fallback
}

export async function createManagedServiceEngagement(input: {
  weddingId: string
  actorId: string
  actorRole: string
  body: ManagedEngagementInput
}) {
  const vendorId = text(input.body.vendorId, 200)
  if (!vendorId) throw new Phase2ContractError('Choose a vendor.', 400, 'vendorId')

  const [vendor, wedding, actor, existing] = await Promise.all([
    db.vendor.findFirst({ where: { id: vendorId, weddingId: input.weddingId } }),
    db.wedding.findUnique({
      where: { id: input.weddingId },
      include: { couple: true },
    }),
    db.user.findUnique({ where: { id: input.actorId }, select: { id: true, name: true, email: true } }),
    db.serviceEngagement.findFirst({
      where: {
        weddingId: input.weddingId,
        vendorId,
        origin: 'current',
        recordMode: 'managed_contract',
        lifecycleStatus: { notIn: ['cancelled', 'completed'] },
      },
      select: { id: true },
    }),
  ])
  if (!vendor || !wedding) throw new Phase2ContractError('Vendor or wedding context was not found.', 404)
  if (!actor) throw new Phase2ContractError('Planner identity was not found.', 401)
  if (existing) throw new Phase2ContractError('This vendor already has an active Wewed service engagement.', 409)

  const budgetItemIds = stringIds(input.body.budgetItemIds)
  const budgetItems = budgetItemIds.length
    ? await db.budgetItem.findMany({
        where: { id: { in: budgetItemIds }, weddingId: input.weddingId },
        select: { id: true, vendorId: true, serviceEngagementId: true },
      })
    : []
  if (budgetItems.length !== budgetItemIds.length) {
    throw new Phase2ContractError('One or more selected Budget items are outside this wedding.', 409, 'budgetItemIds')
  }
  for (const item of budgetItems) {
    if (item.vendorId && item.vendorId !== vendorId) {
      throw new Phase2ContractError('A selected Budget item belongs to another vendor.', 409, 'budgetItemIds')
    }
    if (item.serviceEngagementId) {
      throw new Phase2ContractError('A selected Budget item is already governed by another service engagement.', 409, 'budgetItemIds')
    }
  }

  const coupleUsers = await db.user.findMany({
    where: { coupleId: wedding.coupleId, isActive: true },
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: 'asc' },
    take: 2,
  })
  const coupleDisplay = [wedding.couple.partner1, wedding.couple.partner2].filter(Boolean).join(' & ')
  const coupleName = wedding.couple.surname ? `${coupleDisplay} ${wedding.couple.surname}` : coupleDisplay
  const clientUser = coupleUsers[0] ?? null
  const serviceDescription = text(input.body.serviceDescription, 6000)
  const agreedAmount = moneyAmount(input.body.agreedAmount)
  const currencyCode = currency(input.body.currency)
  const serviceDate = dateValue(input.body.serviceDate)
  const serviceLocation = text(input.body.serviceLocation, 500)

  return db.$transaction(async (tx) => {
    const engagement = await tx.serviceEngagement.create({
      data: {
        origin: 'current',
        recordMode: 'managed_contract',
        lifecycleStatus: 'draft',
        serviceCategory: vendor.category,
        serviceDescription,
        agreedAmount,
        currency: currencyCode,
        serviceDate,
        serviceLocation,
        externalAgreementStatus: 'none',
        historicalBasis: null,
        recordedById: null,
        createdById: input.actorId,
        weddingId: input.weddingId,
        vendorId,
        parties: {
          create: [
            {
              weddingId: input.weddingId,
              partyRole: 'CLIENT',
              partyKind: 'COUPLE',
              displayName: coupleName || wedding.title,
              email: clientUser?.email ?? null,
              userId: clientUser?.id ?? null,
              entityId: wedding.coupleId,
              authorityBasis: 'Wedding couple/client record',
              requiredForReview: true,
              createdById: input.actorId,
            },
            {
              weddingId: input.weddingId,
              partyRole: 'PLANNER',
              partyKind: 'PERSON',
              displayName: actor.name?.trim() || actor.email,
              email: actor.email,
              userId: actor.id,
              entityId: actor.id,
              authorityBasis: `Active wedding ${input.actorRole} authority`,
              requiredForReview: true,
              createdById: input.actorId,
            },
            {
              weddingId: input.weddingId,
              partyRole: 'SERVICE_PROVIDER',
              partyKind: 'VENDOR',
              displayName: vendor.name,
              legalName: vendor.name,
              email: vendor.email,
              phone: vendor.phone,
              entityId: vendor.id,
              authorityBasis: 'Selected wedding vendor/service provider record',
              requiredForReview: true,
              createdById: input.actorId,
            },
          ],
        },
      },
      include: { parties: true, vendor: true, budgetItems: true, contracts: true },
    })

    if (budgetItemIds.length > 0) {
      await tx.budgetItem.updateMany({
        where: { id: { in: budgetItemIds }, weddingId: input.weddingId, serviceEngagementId: null },
        data: { serviceEngagementId: engagement.id, vendorId },
      })
    }
    await tx.vendor.update({ where: { id: vendor.id }, data: { contractStatus: 'negotiating' } })
    return tx.serviceEngagement.findUniqueOrThrow({
      where: { id: engagement.id },
      include: { parties: true, vendor: true, budgetItems: true, contracts: true },
    })
  })
}

export async function listManagedServiceEngagements(weddingId: string, vendorId?: string | null) {
  return db.serviceEngagement.findMany({
    where: {
      weddingId,
      origin: 'current',
      recordMode: 'managed_contract',
      ...(vendorId ? { vendorId } : {}),
    },
    include: {
      parties: { where: { status: 'active' }, orderBy: [{ partyRole: 'asc' }, { createdAt: 'asc' }] },
      vendor: true,
      budgetItems: true,
      contracts: {
        include: { template: true, versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getServiceEngagementDealRoom(weddingId: string, engagementId: string) {
  const engagement = await db.serviceEngagement.findFirst({
    where: { id: engagementId, weddingId, origin: 'current', recordMode: 'managed_contract' },
    include: {
      wedding: { include: { couple: true } },
      vendor: true,
      parties: { where: { status: 'active' }, orderBy: [{ partyRole: 'asc' }, { createdAt: 'asc' }] },
      budgetItems: { orderBy: { createdAt: 'asc' } },
      payments: { orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }] },
      contracts: {
        include: {
          template: true,
          versions: { orderBy: { versionNumber: 'desc' } },
          reviewGrants: { orderBy: { createdAt: 'desc' } },
          events: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100 },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!engagement) throw new Phase2ContractError('Service engagement was not found.', 404)

  const entityIds = [
    engagement.id,
    ...engagement.contracts.map((contract) => contract.id),
    ...engagement.contracts.flatMap((contract) => contract.versions.map((version) => version.id)),
  ]
  const vaultLinks = await db.vaultLink.findMany({
    where: {
      weddingId,
      entityId: { in: entityIds },
      vaultObject: { deletedAt: null },
    },
    include: { vaultObject: true },
    orderBy: { createdAt: 'desc' },
  })

  return {
    ...engagement,
    agreedAmount: engagement.agreedAmount?.toString() ?? null,
    budgetItems: engagement.budgetItems.map((item) => ({
      ...item,
      estimatedCost: item.estimatedCost.toString(),
      actualCost: item.actualCost?.toString() ?? null,
      paidAmount: item.paidAmount.toString(),
    })),
    payments: engagement.payments.map((payment) => ({ ...payment, amount: payment.amount.toString() })),
    contracts: engagement.contracts.map((contract) => ({
      ...contract,
      reviewGrants: contract.reviewGrants.map((grant) => ({
        id: grant.id,
        role: grant.role,
        status: grant.status,
        expiresAt: grant.expiresAt,
        revokedAt: grant.revokedAt,
        lastAccessedAt: grant.lastAccessedAt,
        engagementPartyId: grant.engagementPartyId,
      })),
    })),
    documents: vaultLinks.map((link) => ({
      id: link.vaultObject.id,
      entityType: link.entityType,
      entityId: link.entityId,
      linkRole: link.linkRole,
      displayName: link.vaultObject.displayName,
      originalFilename: link.vaultObject.originalFilename,
      mimeType: link.vaultObject.mimeType,
      byteSize: Number(link.vaultObject.byteSize),
      checksumSha256: link.vaultObject.checksumSha256,
      storageState: link.vaultObject.storageState,
      scanState: link.vaultObject.scanState,
      createdAt: link.vaultObject.createdAt,
    })),
  }
}

interface CanonicalContract {
  schemaVersion: 'wewed.contract.v1'
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
  clauses: Array<{
    code: string
    version: string
    title: string
    family: string
    body: string
  }>
  platform: {
    canonicalDomain: 'https://wewed.pro'
    commercialPartyByDefault: false
    acceptanceIncludedInThisPhase: false
  }
}

function renderContractHtml(canonical: CanonicalContract, contentSha256: string): string {
  const verificationUrl = `${WEWED_CANONICAL_SITE}/contracts/verify/${encodeURIComponent(canonical.contractNumber)}`
  const clauses = canonical.clauses.map((clause, index) => `
    <section class="clause">
      <h3>${index + 1}. ${html(clause.title)}</h3>
      <p>${html(clause.body)}</p>
    </section>`).join('')
  const parties = canonical.parties.map((party) => `
    <div class="party">
      <strong>${html(party.role.replaceAll('_', ' '))}</strong>
      <span>${html(party.displayName)}</span>
      ${party.authorityBasis ? `<small>${html(party.authorityBasis)}</small>` : ''}
    </div>`).join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${html(canonical.title)} · ${html(canonical.contractNumber)}</title>
<style>
  :root{color-scheme:light;--ink:#2d211b;--gold:#a8874e;--paper:#fffdf8;--muted:#73675f}
  *{box-sizing:border-box}body{margin:0;background:#f3eee5;color:var(--ink);font:15px/1.58 Arial,sans-serif}
  main{max-width:880px;margin:24px auto;background:var(--paper);border:1px solid #ddcfb8;border-radius:18px;overflow:hidden;box-shadow:0 16px 45px rgba(45,33,27,.08)}
  header{padding:34px 42px 26px;border-bottom:3px solid var(--gold)}.brand{font:700 25px Georgia,serif;letter-spacing:.18em;color:var(--gold)}
  .domain{font-size:12px;color:var(--muted)}h1{font:500 32px/1.15 Georgia,serif;margin:22px 0 8px}.meta{color:var(--muted);font-size:13px}
  .review{margin-top:18px;padding:12px 14px;border:1px solid #decda9;background:#fff8e9;border-radius:10px;font-size:12px}
  article{padding:30px 42px 40px}h2{font:600 19px Georgia,serif;margin:28px 0 12px;color:#5c472b}h3{font-size:14px;margin:0 0 6px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.fact,.party,.clause{border:1px solid #e5dccd;border-radius:10px;padding:13px}.fact small,.party small{display:block;color:var(--muted);margin-top:3px}.party{display:flex;flex-direction:column;gap:2px}.clause{margin:10px 0}.clause p{margin:0;color:#463b34}
  .verify{word-break:break-all;background:#f7f2e9;border-radius:10px;padding:14px;font-size:12px}.footer{margin-top:30px;padding-top:16px;border-top:1px solid #e5dccd;color:var(--muted);font-size:11px}
  @media(max-width:640px){main{margin:0;border-radius:0}.grid{grid-template-columns:1fr}header,article{padding-left:20px;padding-right:20px}h1{font-size:26px}}
</style>
</head>
<body><main>
<header>
  <div class="brand">WEWED</div><div class="domain">wewed.pro</div>
  <h1>${html(canonical.title)}</h1>
  <div class="meta">${html(canonical.contractNumber)} · Contract version 1 · Template ${html(canonical.template.semanticVersion)}</div>
  <div class="review"><strong>Template review status:</strong> ${html(canonical.template.reviewStatus.replaceAll('_', ' '))}. Wewed does not claim jurisdiction-specific enforceability from this status. Viewing this version is not acceptance.</div>
</header>
<article>
  <h2>Wedding & service</h2>
  <div class="grid">
    <div class="fact"><strong>${html(canonical.wedding.title)}</strong><small>${html(dateLabel(canonical.wedding.date))}</small></div>
    <div class="fact"><strong>${html(canonical.service.vendorName)}</strong><small>${html(canonical.service.category)}</small></div>
    <div class="fact"><strong>Service date</strong><small>${html(dateLabel(canonical.service.serviceDate))}</small></div>
    <div class="fact"><strong>Service location</strong><small>${html(canonical.service.location || canonical.wedding.venue || 'Not specified')}</small></div>
    <div class="fact"><strong>Agreed amount</strong><small>${html(amountLabel(canonical.service.agreedAmount, canonical.service.currency))}</small></div>
    <div class="fact"><strong>Wedding venue</strong><small>${html([canonical.wedding.venue, canonical.wedding.venueCity, canonical.wedding.venueCountry].filter(Boolean).join(', '))}</small></div>
  </div>
  <h2>Service scope</h2><div class="clause"><p>${html(canonical.service.description || 'No additional service description was recorded.')}</p></div>
  <h2>Parties & recorded authority</h2><div class="grid">${parties}</div>
  <h2>Wewed standard terms</h2>${clauses}
  <h2>Version verification</h2>
  <div class="verify"><strong>Canonical SHA-256</strong><br/>${html(contentSha256)}<br/><br/><strong>Verify</strong><br/>${html(verificationUrl)}</div>
  <div class="footer">Created and governed through Wewed · wewed.pro · The exact issued version is immutable. Acceptance, when enabled, is a separate governed action and is not inferred from viewing or payment.</div>
</article>
</main></body></html>`
}

async function contractSnapshot(engagementId: string, weddingId: string) {
  const engagement = await db.serviceEngagement.findFirst({
    where: { id: engagementId, weddingId, origin: 'current', recordMode: 'managed_contract' },
    include: {
      wedding: true,
      vendor: true,
      parties: { where: { status: 'active' }, orderBy: [{ partyRole: 'asc' }, { id: 'asc' }] },
    },
  })
  if (!engagement) throw new Phase2ContractError('Managed service engagement was not found.', 404)
  return engagement
}

export async function createOrRefreshContractDraft(input: {
  weddingId: string
  engagementId: string
  actorId: string
}) {
  const engagement = await contractSnapshot(input.engagementId, input.weddingId)
  const template = await contractTemplateFor(engagement.serviceCategory)
  const existing = await db.contract.findFirst({
    where: { serviceEngagementId: engagement.id, weddingId: input.weddingId },
    include: { versions: { orderBy: { versionNumber: 'desc' } } },
    orderBy: { createdAt: 'asc' },
  })
  if (existing?.versions.some((version) => version.issuedAt)) {
    throw new Phase2ContractError('This contract has already been issued. Material changes require the governed amendment flow in Phase 3.', 409)
  }

  return db.$transaction(async (tx) => {
    let contract = existing
    if (!contract) {
      const numbers = await tx.$queryRaw<Array<{ contractNumber: string }>>`
        SELECT public.next_wewed_contract_number() AS "contractNumber"
      `
      const contractNumber = numbers[0]?.contractNumber
      if (!contractNumber) throw new Phase2ContractError('Could not allocate a Wewed contract number.', 500)
      contract = await tx.contract.create({
        data: {
          contractNumber,
          serviceEngagementId: engagement.id,
          weddingId: input.weddingId,
          templateId: template.id,
          status: 'DRAFT',
          currentVersionNumber: 1,
          title: template.title,
          createdById: input.actorId,
        },
        include: { versions: true },
      })
    }

    const versionNumber = 1
    const snapshotAt = new Date().toISOString()
    const canonical: CanonicalContract = {
      schemaVersion: 'wewed.contract.v1',
      contractNumber: contract.contractNumber,
      title: template.title,
      snapshotAt,
      template: {
        code: template.code,
        semanticVersion: template.semanticVersion,
        marketCode: template.marketCode,
        jurisdictionCode: template.jurisdictionCode,
        reviewStatus: template.reviewStatus,
        status: template.status,
      },
      wedding: {
        id: engagement.wedding.id,
        title: engagement.wedding.title,
        date: engagement.wedding.date.toISOString(),
        venue: engagement.wedding.venue,
        venueCity: engagement.wedding.venueCity,
        venueCountry: engagement.wedding.venueCountry,
      },
      service: {
        engagementId: engagement.id,
        vendorId: engagement.vendor.id,
        vendorName: engagement.vendor.name,
        category: engagement.serviceCategory,
        description: engagement.serviceDescription,
        serviceDate: engagement.serviceDate?.toISOString() ?? null,
        location: engagement.serviceLocation,
        agreedAmount: engagement.agreedAmount?.toString() ?? null,
        currency: engagement.currency,
      },
      parties: engagement.parties.map((party) => ({
        partyId: party.id,
        role: party.partyRole,
        kind: party.partyKind,
        displayName: party.displayName,
        legalName: party.legalName,
        authorityBasis: party.authorityBasis,
        requiredForReview: party.requiredForReview,
      })),
      clauses: template.clauses.map((entry) => ({
        code: entry.clause.code,
        version: entry.clause.version,
        title: entry.clause.title,
        family: entry.clause.clauseFamily,
        body: entry.clause.body,
      })),
      platform: {
        canonicalDomain: WEWED_CANONICAL_SITE,
        commercialPartyByDefault: false,
        acceptanceIncludedInThisPhase: false,
      },
    }
    const canonicalJson = stableContractJson(canonical)
    const contentSha256 = sha256(canonicalJson)
    const renderedHtml = renderContractHtml(canonical, contentSha256)
    const draft = await tx.contractVersion.findFirst({
      where: { contractId: contract.id, versionNumber, issuedAt: null },
    })
    const version = draft
      ? await tx.contractVersion.update({
          where: { id: draft.id },
          data: {
            templateSemanticVersion: template.semanticVersion,
            canonicalJson,
            renderedHtml,
            status: 'DRAFT',
            contentSha256: null,
            artifactVaultObjectId: null,
            artifactSha256: null,
          },
        })
      : await tx.contractVersion.create({
          data: {
            contractId: contract.id,
            weddingId: input.weddingId,
            versionNumber,
            status: 'DRAFT',
            templateSemanticVersion: template.semanticVersion,
            canonicalJson,
            renderedHtml,
            createdById: input.actorId,
          },
        })

    await tx.contract.update({
      where: { id: contract.id },
      data: {
        templateId: template.id,
        title: template.title,
        currentVersionNumber: versionNumber,
        status: 'DRAFT',
      },
    })
    await tx.serviceEngagement.update({ where: { id: engagement.id }, data: { lifecycleStatus: 'ready_for_review' } })
    await tx.contractEvent.create({
      data: {
        contractId: contract.id,
        versionId: version.id,
        eventType: draft ? 'draft_refreshed' : 'draft_created',
        actorId: input.actorId,
        metadata: JSON.stringify({ templateCode: template.code, templateVersion: template.semanticVersion, contentSha256 }),
      },
    })

    return {
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      versionId: version.id,
      versionNumber,
      title: template.title,
      templateReviewStatus: template.reviewStatus,
      templateStatus: template.status,
      renderedHtml,
      contentSha256,
    }
  })
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

function rawReviewGrant(party: { id: string; partyRole: string }) {
  const token = randomBytes(32).toString('base64url')
  return {
    partyId: party.id,
    role: party.partyRole,
    token,
    tokenHash: sha256(token),
    reviewUrl: `${WEWED_CANONICAL_SITE}/contracts/review/${token}`,
  }
}

export async function issueContractVersion(input: {
  weddingId: string
  contractId: string
  actorId: string
}) {
  const contract = await db.contract.findFirst({
    where: { id: input.contractId, weddingId: input.weddingId },
    include: {
      serviceEngagement: { include: { parties: { where: { status: 'active' } }, vendor: true } },
      template: true,
      versions: { orderBy: { versionNumber: 'desc' } },
    },
  })
  if (!contract) throw new Phase2ContractError('Contract was not found.', 404)
  if (contract.issuedAt || contract.versions.some((version) => version.issuedAt)) {
    throw new Phase2ContractError('This contract version has already been issued.', 409)
  }
  const version = contract.versions.find((candidate) => candidate.versionNumber === contract.currentVersionNumber)
  if (!version || version.status !== 'DRAFT') throw new Phase2ContractError('Generate the current contract draft before issuing it.', 409)

  let canonical: CanonicalContract
  try {
    canonical = JSON.parse(version.canonicalJson) as CanonicalContract
  } catch {
    throw new Phase2ContractError('The contract draft could not be verified.', 500)
  }
  const contentSha256 = sha256(version.canonicalJson)
  const pdf = renderContractPdf(pdfModel(canonical, contentSha256, version.versionNumber))
  const file = new File([pdf], `${contract.contractNumber}-v${version.versionNumber}.pdf`, { type: 'application/pdf' })
  const prepared = await prepareVaultUpload({
    file,
    weddingId: input.weddingId,
    actorId: input.actorId,
    source: 'contract_generator',
    category: 'contract',
    metadata: {
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      contractVersionId: version.id,
      versionNumber: version.versionNumber,
      canonicalSha256: contentSha256,
      templateCode: contract.template.code,
      templateReviewStatus: contract.template.reviewStatus,
    },
  })

  const requiredParties = contract.serviceEngagement.parties
    .filter((party) => party.requiredForReview && REVIEWABLE_PARTY_ROLES.has(party.partyRole))
  if (requiredParties.length === 0) {
    await removePreparedVaultUpload(prepared)
    throw new Phase2ContractError('At least one review party is required before a contract can be issued.', 409)
  }
  const rawGrants = requiredParties.map(rawReviewGrant)
  const issuedAt = new Date()
  const expiresAt = new Date(issuedAt.getTime() + CONTRACT_REVIEW_TTL_DAYS * 24 * 60 * 60 * 1000)

  try {
    await db.$transaction(async (tx) => {
      await registerPreparedVaultObject(prepared, tx)
      await createVaultLink({ vaultObjectId: prepared.id, weddingId: input.weddingId, entityType: 'service_engagement', entityId: contract.serviceEngagementId, linkRole: 'issued_contract', actorId: input.actorId, tx })
      await createVaultLink({ vaultObjectId: prepared.id, weddingId: input.weddingId, entityType: 'contract', entityId: contract.id, linkRole: 'issued_pdf', actorId: input.actorId, tx })
      await createVaultLink({ vaultObjectId: prepared.id, weddingId: input.weddingId, entityType: 'contract_version', entityId: version.id, linkRole: 'immutable_artifact', actorId: input.actorId, tx })

      await tx.contractVersion.update({
        where: { id: version.id },
        data: {
          status: 'ISSUED',
          contentSha256,
          artifactVaultObjectId: prepared.id,
          artifactSha256: prepared.checksumSha256,
          issuedAt,
        },
      })
      await tx.contract.update({
        where: { id: contract.id },
        data: { status: 'ISSUED', issuedAt, currentVersionNumber: version.versionNumber },
      })
      await tx.serviceEngagement.update({
        where: { id: contract.serviceEngagementId },
        data: { lifecycleStatus: 'issued' },
      })
      await tx.vendor.update({ where: { id: contract.serviceEngagement.vendorId }, data: { contractStatus: 'pending' } })

      for (const grant of rawGrants) {
        await tx.contractReviewGrant.create({
          data: {
            contractId: contract.id,
            contractVersionId: version.id,
            engagementPartyId: grant.partyId,
            role: grant.role,
            tokenHash: grant.tokenHash,
            status: 'ACTIVE',
            expiresAt,
            createdById: input.actorId,
          },
        })
      }
      await tx.contractEvent.create({
        data: {
          contractId: contract.id,
          versionId: version.id,
          eventType: 'version_issued',
          actorId: input.actorId,
          metadata: JSON.stringify({
            contentSha256,
            artifactSha256: prepared.checksumSha256,
            artifactVaultObjectId: prepared.id,
            reviewGrantCount: rawGrants.length,
            acceptanceRecorded: false,
          }),
        },
      })
    })
  } catch (error) {
    await removePreparedVaultUpload(prepared)
    throw error
  }

  return {
    contractId: contract.id,
    contractNumber: contract.contractNumber,
    versionId: version.id,
    versionNumber: version.versionNumber,
    issuedAt: issuedAt.toISOString(),
    contentSha256,
    artifactSha256: prepared.checksumSha256,
    artifactVaultObjectId: prepared.id,
    reviewLinks: rawGrants.map((grant) => ({
      partyId: grant.partyId,
      role: grant.role,
      reviewUrl: grant.reviewUrl,
      expiresAt: expiresAt.toISOString(),
    })),
    acceptanceRecorded: false,
  }
}

export async function rotateContractReviewLinks(input: {
  weddingId: string
  contractId: string
  actorId: string
}) {
  const contract = await db.contract.findFirst({
    where: { id: input.contractId, weddingId: input.weddingId, status: 'ISSUED' },
    include: {
      serviceEngagement: { include: { parties: { where: { status: 'active' } } } },
      versions: { where: { issuedAt: { not: null } }, orderBy: { versionNumber: 'desc' }, take: 1 },
    },
  })
  if (!contract || contract.versions.length === 0) throw new Phase2ContractError('Issued contract version was not found.', 404)
  const version = contract.versions[0]
  const requiredParties = contract.serviceEngagement.parties
    .filter((party) => party.requiredForReview && REVIEWABLE_PARTY_ROLES.has(party.partyRole))
  const rawGrants = requiredParties.map(rawReviewGrant)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + CONTRACT_REVIEW_TTL_DAYS * 24 * 60 * 60 * 1000)

  await db.$transaction(async (tx) => {
    await tx.contractReviewGrant.updateMany({
      where: { contractId: contract.id, contractVersionId: version.id, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: now },
    })
    for (const grant of rawGrants) {
      await tx.contractReviewGrant.create({
        data: {
          contractId: contract.id,
          contractVersionId: version.id,
          engagementPartyId: grant.partyId,
          role: grant.role,
          tokenHash: grant.tokenHash,
          status: 'ACTIVE',
          expiresAt,
          createdById: input.actorId,
        },
      })
    }
    await tx.contractEvent.create({
      data: {
        contractId: contract.id,
        versionId: version.id,
        eventType: 'review_links_rotated',
        actorId: input.actorId,
        metadata: JSON.stringify({ grantCount: rawGrants.length, previousLinksRevoked: true }),
      },
    })
  })

  return {
    reviewLinks: rawGrants.map((grant) => ({ partyId: grant.partyId, role: grant.role, reviewUrl: grant.reviewUrl, expiresAt: expiresAt.toISOString() })),
  }
}

export async function getContractReviewByToken(rawToken: string) {
  const token = rawToken.trim()
  if (token.length < 32 || token.length > 200) throw new Phase2ContractError('Review link is invalid.', 404)
  const tokenHash = sha256(token)
  const grant = await db.contractReviewGrant.findUnique({
    where: { tokenHash },
    include: {
      engagementParty: true,
      contractVersion: true,
      contract: {
        include: {
          template: true,
          serviceEngagement: { include: { vendor: true } },
        },
      },
    },
  })
  if (!grant || grant.status !== 'ACTIVE') throw new Phase2ContractError('Review link is unavailable or has been revoked.', 404)
  if (grant.expiresAt.getTime() <= Date.now()) {
    await db.contractReviewGrant.update({ where: { id: grant.id }, data: { status: 'EXPIRED' } })
    throw new Phase2ContractError('Review link has expired. Ask the planner for a new Wewed review link.', 410)
  }
  if (!grant.contractVersion.issuedAt || grant.contractVersion.status !== 'ISSUED') {
    throw new Phase2ContractError('This contract version is not available for review.', 409)
  }

  const now = new Date()
  await db.$transaction(async (tx) => {
    await tx.contractReviewGrant.update({ where: { id: grant.id }, data: { lastAccessedAt: now } })
    await tx.contractEvent.create({
      data: {
        contractId: grant.contractId,
        versionId: grant.contractVersionId,
        eventType: 'review_link_viewed',
        actorId: null,
        metadata: JSON.stringify({ grantId: grant.id, role: grant.role, viewedAt: now.toISOString(), acceptanceRecorded: false }),
      },
    })
  })

  return {
    contractNumber: grant.contract.contractNumber,
    title: grant.contract.title,
    vendorName: grant.contract.serviceEngagement.vendor.name,
    versionNumber: grant.contractVersion.versionNumber,
    issuedAt: grant.contractVersion.issuedAt.toISOString(),
    contentSha256: grant.contractVersion.contentSha256,
    artifactSha256: grant.contractVersion.artifactSha256,
    templateVersion: grant.contractVersion.templateSemanticVersion,
    templateReviewStatus: grant.contract.template.reviewStatus,
    viewerRole: grant.role,
    viewerName: grant.engagementParty?.displayName ?? null,
    renderedHtml: grant.contractVersion.renderedHtml,
    canAccept: false,
    acceptanceRecorded: false,
  }
}

export async function getContractVerification(contractNumber: string, versionNumber?: number | null) {
  const contract = await db.contract.findUnique({
    where: { contractNumber },
    include: {
      template: true,
      versions: { orderBy: { versionNumber: 'desc' } },
    },
  })
  if (!contract) throw new Phase2ContractError('Wewed contract record was not found.', 404)
  const version = versionNumber
    ? contract.versions.find((candidate) => candidate.versionNumber === versionNumber)
    : contract.versions.find((candidate) => candidate.issuedAt)
  if (!version || !version.issuedAt) throw new Phase2ContractError('No issued version is available for verification.', 404)
  return {
    contractNumber: contract.contractNumber,
    title: contract.title,
    contractStatus: contract.status,
    versionNumber: version.versionNumber,
    versionStatus: version.status,
    issuedAt: version.issuedAt.toISOString(),
    canonicalSha256: version.contentSha256,
    artifactSha256: version.artifactSha256,
    templateCode: contract.template.code,
    templateVersion: version.templateSemanticVersion,
    templateReviewStatus: contract.template.reviewStatus,
    verifiedBy: WEWED_CANONICAL_SITE,
  }
}
