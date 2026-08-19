from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f'Anchor not found in {path}: {old[:120]!r}')
    if text.count(old) != 1:
        raise SystemExit(f'Anchor not unique in {path}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))


# -----------------------------------------------------------------------------
# Phase 0: mark the already-approved canon as active implementation authority.
# -----------------------------------------------------------------------------
replace_once(
    'docs/WEWED_CONTRIBUTIONS_RESOURCE_ACCOUNTING_PLAN.md',
    '**Status:** STAMPED — AUTHORITATIVE IMPLEMENTATION PLAN — IMPLEMENTATION NOT YET AUTHORIZED  ',
    '**Status:** STAMPED — AUTHORITATIVE IMPLEMENTATION PLAN — IMPLEMENTATION AUTHORIZED  ',
)
replace_once(
    'docs/WEWED_CONTRIBUTIONS_RESOURCE_ACCOUNTING_PLAN.md',
    '**Implementation state:** Planning/documentation only. No runtime implementation is authorized by this document alone.',
    '**Implementation state:** Authorized on 2026-08-19. Runtime implementation must follow the phased gates in this document and preserve the stamped canon.',
)
replace_once(
    'agent-ctx/CONTRIBUTIONS-RESOURCE-ACCOUNTING-CANON.md',
    '**Status:** CANONICAL POINTER — IMPLEMENTATION NOT YET AUTHORIZED  ',
    '**Status:** CANONICAL POINTER — IMPLEMENTATION AUTHORIZED  ',
)
replace_once(
    'agent-ctx/CONTRIBUTIONS-RESOURCE-ACCOUNTING-CANON.md',
    'Do not skip later-phase requirements merely because an earlier phase is being implemented. Do not start runtime implementation until the user explicitly authorizes implementation after reviewing the plan.',
    'Do not skip later-phase requirements merely because an earlier phase is being implemented. Runtime implementation was explicitly authorized by the user on 2026-08-19; every phase remains subject to its documented integrity and regression gates.',
)

# -----------------------------------------------------------------------------
# Phase 1: canonical schema and migration.
# -----------------------------------------------------------------------------
replace_once(
    'prisma/schema.prisma',
    '  guestContributions      GuestContribution[]\n  contentItems            WeddingContent[]',
    '  guestContributions      GuestContribution[]\n  contributors            Contributor[]\n  weddingContributions    WeddingContribution[]\n  contributionAllocations ContributionAllocation[]\n  paymentFundingAllocations PaymentFundingAllocation[]\n  contributionCampaigns   ContributionCampaign[]\n  contributionTaskLinks   ContributionTaskLink[]\n  contentItems            WeddingContent[]',
)
replace_once(
    'prisma/schema.prisma',
    '  rsvp         RSVP?\n  contribution GuestContribution?',
    '  rsvp                RSVP?\n  contribution        GuestContribution?\n  contributorProfiles Contributor[]',
)
replace_once(
    'prisma/schema.prisma',
    '  budgetItems        BudgetItem[]\n  serviceEngagements ServiceEngagement[]',
    '  budgetItems          BudgetItem[]\n  serviceEngagements   ServiceEngagement[]\n  weddingContributions WeddingContribution[]',
)
replace_once(
    'prisma/schema.prisma',
    '  weddingId String\n  wedding   Wedding @relation(fields: [weddingId], references: [id])\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@index([assigneeUserId])\n}\n\nmodel BudgetItem',
    '  weddingId String\n  wedding   Wedding @relation(fields: [weddingId], references: [id])\n  contributionLinks ContributionTaskLink[]\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@index([assigneeUserId])\n}\n\nmodel BudgetItem',
)
replace_once(
    'prisma/schema.prisma',
    '  serviceEngagement ServiceEngagement? @relation(fields: [serviceEngagementId, weddingId], references: [id, weddingId], onDelete: Restrict)\n\n  createdAt DateTime @default(now())',
    '  serviceEngagement      ServiceEngagement?        @relation(fields: [serviceEngagementId, weddingId], references: [id, weddingId], onDelete: Restrict)\n  contributionAllocations  ContributionAllocation[]\n  fundingAllocations       PaymentFundingAllocation[]\n\n  createdAt DateTime @default(now())',
)
replace_once(
    'prisma/schema.prisma',
    '  budgetItems BudgetItem[]\n  payments    EngagementPayment[]\n  parties     EngagementParty[]\n  contracts   Contract[]',
    '  budgetItems            BudgetItem[]\n  payments               EngagementPayment[]\n  parties                EngagementParty[]\n  contracts              Contract[]\n  weddingContributions   WeddingContribution[]',
)
replace_once(
    'prisma/schema.prisma',
    '  serviceEngagementId String\n  serviceEngagement   ServiceEngagement @relation(fields: [serviceEngagementId], references: [id], onDelete: Cascade)\n\n  createdAt DateTime @default(now())',
    '  serviceEngagementId String\n  serviceEngagement   ServiceEngagement @relation(fields: [serviceEngagementId], references: [id], onDelete: Cascade)\n  fundingAllocations  PaymentFundingAllocation[]\n\n  createdAt DateTime @default(now())',
)

CONTRIBUTION_MODELS = r'''
model Contributor {
  id                     String   @id @default(cuid())
  displayName            String
  legalName              String?
  kind                   String   @default("individual")
  relationship           String?
  email                  String?
  phone                  String?
  address                String?
  preferredContactMethod String?
  publicRecognition      Boolean  @default(false)
  anonymousPublic        Boolean  @default(false)
  notes                  String?
  guestId                String?

  weddingId String
  wedding   Wedding @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  guest     Guest?   @relation(fields: [guestId], references: [id], onDelete: SetNull)

  contributions WeddingContribution[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([weddingId, displayName])
  @@index([guestId])
}

model WeddingContribution {
  id                     String    @id @default(cuid())
  type                   String    @default("CASH_TO_COUPLE")
  title                  String
  description            String?
  amount                 Decimal?  @db.Decimal(14, 2)
  currency               String    @default("USD")
  estimatedValue         Decimal?  @db.Decimal(14, 2)
  estimatedValueCurrency String?
  quantity               Decimal?  @db.Decimal(14, 3)
  unit                   String?
  route                  String    @default("TO_COUPLE")
  commitmentState        String    @default("NOT_APPLICABLE")
  fulfillmentState       String    @default("PENDING")
  verificationState      String    @default("UNVERIFIED")
  thankYouState          String    @default("NOT_DUE")
  pledgedAt              DateTime?
  expectedAt             DateTime?
  fulfilledAt            DateTime?
  notes                  String?
  source                 String    @default("planner")
  recordedById           String?
  contributorId          String
  campaignId             String?
  vendorId               String?
  serviceEngagementId    String?

  weddingId String
  wedding   Wedding @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  contributor Contributor @relation(fields: [contributorId], references: [id], onDelete: Restrict)
  campaign ContributionCampaign? @relation(fields: [campaignId], references: [id], onDelete: SetNull)
  vendor Vendor? @relation(fields: [vendorId], references: [id], onDelete: SetNull)
  serviceEngagement ServiceEngagement? @relation(fields: [serviceEngagementId], references: [id], onDelete: SetNull)

  allocations               ContributionAllocation[]
  paymentFundingAllocations PaymentFundingAllocation[]
  taskLinks                 ContributionTaskLink[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([weddingId, fulfillmentState])
  @@index([weddingId, commitmentState])
  @@index([contributorId])
  @@index([campaignId])
  @@index([vendorId])
  @@index([serviceEngagementId])
}

model ContributionAllocation {
  id             String   @id @default(cuid())
  amount         Decimal  @db.Decimal(14, 2)
  currency       String   @default("USD")
  allocationKind String   @default("CASH")
  note           String?
  createdById    String?
  contributionId String
  budgetItemId   String

  weddingId    String
  wedding      Wedding             @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  contribution WeddingContribution @relation(fields: [contributionId], references: [id], onDelete: Cascade)
  budgetItem   BudgetItem          @relation(fields: [budgetItemId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([weddingId, budgetItemId])
  @@index([contributionId])
}

model PaymentFundingAllocation {
  id             String   @id @default(cuid())
  sourceKind     String
  amount         Decimal  @db.Decimal(14, 2)
  currency       String   @default("USD")
  note           String?
  createdById    String?
  reconciledAt   DateTime?
  paymentId      String?
  budgetItemId   String?
  contributionId String?

  weddingId    String
  wedding      Wedding             @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  payment      EngagementPayment?  @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  budgetItem   BudgetItem?         @relation(fields: [budgetItemId], references: [id], onDelete: Cascade)
  contribution WeddingContribution? @relation(fields: [contributionId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([weddingId, budgetItemId])
  @@index([paymentId])
  @@index([contributionId])
}

model ContributionCampaign {
  id                String    @id @default(cuid())
  type              String    @default("HONEYMOON")
  title             String
  description       String?
  targetAmount      Decimal?  @db.Decimal(14, 2)
  currency          String    @default("USD")
  published         Boolean   @default(false)
  showTarget        Boolean   @default(false)
  showRaised        Boolean   @default(false)
  externalUrl       String?
  ctaLabel          String?
  invitationVisible Boolean   @default(false)
  publishFrom       DateTime?
  publishUntil      DateTime?
  publicNote        String?

  weddingId String
  wedding   Wedding @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  contributions WeddingContribution[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([weddingId, published])
}

model ContributionTaskLink {
  id             String   @id @default(cuid())
  linkRole       String   @default("follow_up")
  contributionId String
  plannerTaskId  String

  weddingId    String
  wedding      Wedding             @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  contribution WeddingContribution @relation(fields: [contributionId], references: [id], onDelete: Cascade)
  plannerTask   PlannerTask         @relation(fields: [plannerTaskId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([contributionId, plannerTaskId, linkRole])
  @@index([weddingId, plannerTaskId])
}

'''
replace_once('prisma/schema.prisma', '\nmodel VaultObject {', '\n' + CONTRIBUTION_MODELS + 'model VaultObject {')

MIGRATION = r'''-- Wewed Contributions & Resource Accounting
-- Stamp: WW-CONTRIBUTIONS-2026-08-19-01
-- Additive only: no existing BudgetItem/EngagementPayment funding source is guessed.

CREATE TABLE "Contributor" (
  "id" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "legalName" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'individual',
  "relationship" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "preferredContactMethod" TEXT,
  "publicRecognition" BOOLEAN NOT NULL DEFAULT false,
  "anonymousPublic" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "guestId" TEXT,
  "weddingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Contributor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WeddingContribution" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'CASH_TO_COUPLE',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "amount" DECIMAL(14,2),
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "estimatedValue" DECIMAL(14,2),
  "estimatedValueCurrency" TEXT,
  "quantity" DECIMAL(14,3),
  "unit" TEXT,
  "route" TEXT NOT NULL DEFAULT 'TO_COUPLE',
  "commitmentState" TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
  "fulfillmentState" TEXT NOT NULL DEFAULT 'PENDING',
  "verificationState" TEXT NOT NULL DEFAULT 'UNVERIFIED',
  "thankYouState" TEXT NOT NULL DEFAULT 'NOT_DUE',
  "pledgedAt" TIMESTAMP(3),
  "expectedAt" TIMESTAMP(3),
  "fulfilledAt" TIMESTAMP(3),
  "notes" TEXT,
  "source" TEXT NOT NULL DEFAULT 'planner',
  "recordedById" TEXT,
  "contributorId" TEXT NOT NULL,
  "campaignId" TEXT,
  "vendorId" TEXT,
  "serviceEngagementId" TEXT,
  "weddingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WeddingContribution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WeddingContribution_amount_nonnegative" CHECK ("amount" IS NULL OR "amount" >= 0),
  CONSTRAINT "WeddingContribution_estimatedValue_nonnegative" CHECK ("estimatedValue" IS NULL OR "estimatedValue" >= 0),
  CONSTRAINT "WeddingContribution_quantity_nonnegative" CHECK ("quantity" IS NULL OR "quantity" >= 0)
);

CREATE TABLE "ContributionAllocation" (
  "id" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "allocationKind" TEXT NOT NULL DEFAULT 'CASH',
  "note" TEXT,
  "createdById" TEXT,
  "contributionId" TEXT NOT NULL,
  "budgetItemId" TEXT NOT NULL,
  "weddingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContributionAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContributionAllocation_amount_nonnegative" CHECK ("amount" >= 0)
);

CREATE TABLE "PaymentFundingAllocation" (
  "id" TEXT NOT NULL,
  "sourceKind" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "note" TEXT,
  "createdById" TEXT,
  "reconciledAt" TIMESTAMP(3),
  "paymentId" TEXT,
  "budgetItemId" TEXT,
  "contributionId" TEXT,
  "weddingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentFundingAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentFundingAllocation_amount_nonnegative" CHECK ("amount" >= 0),
  CONSTRAINT "PaymentFundingAllocation_target_required" CHECK ("paymentId" IS NOT NULL OR "budgetItemId" IS NOT NULL)
);

CREATE TABLE "ContributionCampaign" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'HONEYMOON',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "targetAmount" DECIMAL(14,2),
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "published" BOOLEAN NOT NULL DEFAULT false,
  "showTarget" BOOLEAN NOT NULL DEFAULT false,
  "showRaised" BOOLEAN NOT NULL DEFAULT false,
  "externalUrl" TEXT,
  "ctaLabel" TEXT,
  "invitationVisible" BOOLEAN NOT NULL DEFAULT false,
  "publishFrom" TIMESTAMP(3),
  "publishUntil" TIMESTAMP(3),
  "publicNote" TEXT,
  "weddingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContributionCampaign_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContributionCampaign_target_nonnegative" CHECK ("targetAmount" IS NULL OR "targetAmount" >= 0)
);

CREATE TABLE "ContributionTaskLink" (
  "id" TEXT NOT NULL,
  "linkRole" TEXT NOT NULL DEFAULT 'follow_up',
  "contributionId" TEXT NOT NULL,
  "plannerTaskId" TEXT NOT NULL,
  "weddingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContributionTaskLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Contributor_weddingId_displayName_idx" ON "Contributor"("weddingId", "displayName");
CREATE INDEX "Contributor_guestId_idx" ON "Contributor"("guestId");
CREATE INDEX "WeddingContribution_weddingId_fulfillmentState_idx" ON "WeddingContribution"("weddingId", "fulfillmentState");
CREATE INDEX "WeddingContribution_weddingId_commitmentState_idx" ON "WeddingContribution"("weddingId", "commitmentState");
CREATE INDEX "WeddingContribution_contributorId_idx" ON "WeddingContribution"("contributorId");
CREATE INDEX "WeddingContribution_campaignId_idx" ON "WeddingContribution"("campaignId");
CREATE INDEX "WeddingContribution_vendorId_idx" ON "WeddingContribution"("vendorId");
CREATE INDEX "WeddingContribution_serviceEngagementId_idx" ON "WeddingContribution"("serviceEngagementId");
CREATE INDEX "ContributionAllocation_weddingId_budgetItemId_idx" ON "ContributionAllocation"("weddingId", "budgetItemId");
CREATE INDEX "ContributionAllocation_contributionId_idx" ON "ContributionAllocation"("contributionId");
CREATE INDEX "PaymentFundingAllocation_weddingId_budgetItemId_idx" ON "PaymentFundingAllocation"("weddingId", "budgetItemId");
CREATE INDEX "PaymentFundingAllocation_paymentId_idx" ON "PaymentFundingAllocation"("paymentId");
CREATE INDEX "PaymentFundingAllocation_contributionId_idx" ON "PaymentFundingAllocation"("contributionId");
CREATE INDEX "ContributionCampaign_weddingId_published_idx" ON "ContributionCampaign"("weddingId", "published");
CREATE UNIQUE INDEX "ContributionTaskLink_contributionId_plannerTaskId_linkRole_key" ON "ContributionTaskLink"("contributionId", "plannerTaskId", "linkRole");
CREATE INDEX "ContributionTaskLink_weddingId_plannerTaskId_idx" ON "ContributionTaskLink"("weddingId", "plannerTaskId");

ALTER TABLE "Contributor" ADD CONSTRAINT "Contributor_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contributor" ADD CONSTRAINT "Contributor_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WeddingContribution" ADD CONSTRAINT "WeddingContribution_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeddingContribution" ADD CONSTRAINT "WeddingContribution_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "Contributor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WeddingContribution" ADD CONSTRAINT "WeddingContribution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ContributionCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WeddingContribution" ADD CONSTRAINT "WeddingContribution_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WeddingContribution" ADD CONSTRAINT "WeddingContribution_serviceEngagementId_fkey" FOREIGN KEY ("serviceEngagementId") REFERENCES "ServiceEngagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContributionAllocation" ADD CONSTRAINT "ContributionAllocation_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContributionAllocation" ADD CONSTRAINT "ContributionAllocation_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "WeddingContribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContributionAllocation" ADD CONSTRAINT "ContributionAllocation_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentFundingAllocation" ADD CONSTRAINT "PaymentFundingAllocation_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentFundingAllocation" ADD CONSTRAINT "PaymentFundingAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "EngagementPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentFundingAllocation" ADD CONSTRAINT "PaymentFundingAllocation_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentFundingAllocation" ADD CONSTRAINT "PaymentFundingAllocation_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "WeddingContribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContributionCampaign" ADD CONSTRAINT "ContributionCampaign_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContributionTaskLink" ADD CONSTRAINT "ContributionTaskLink_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContributionTaskLink" ADD CONSTRAINT "ContributionTaskLink_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "WeddingContribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContributionTaskLink" ADD CONSTRAINT "ContributionTaskLink_plannerTaskId_fkey" FOREIGN KEY ("plannerTaskId") REFERENCES "PlannerTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
'''
write('prisma/migrations/20260819033000_contributions_resource_accounting/migration.sql', MIGRATION)

CONTRIBUTIONS_LIB = r'''export const CONTRIBUTION_TYPES = [
  'CASH_TO_COUPLE',
  'DIRECT_VENDOR_PAYMENT',
  'GOODS_IN_KIND',
  'SERVICE_IN_KIND',
  'TIME_LABOUR',
  'DISCOUNT_SPONSORSHIP',
  'HONEYMOON_GIFT',
  'OTHER',
] as const

export const CONTRIBUTION_ROUTES = [
  'TO_COUPLE',
  'DIRECT_TO_VENDOR',
  'IN_KIND_TO_COUPLE',
  'IN_KIND_TO_VENDOR',
  'CAMPAIGN_EXTERNAL',
  'OTHER',
] as const

export const COMMITMENT_STATES = ['PLEDGED', 'CONFIRMED', 'CANCELLED', 'NOT_APPLICABLE'] as const
export const FULFILLMENT_STATES = ['PENDING', 'PARTIALLY_RECEIVED', 'RECEIVED', 'DELIVERED', 'PAID_DIRECT', 'COMPLETED', 'FAILED_OR_CANCELLED'] as const
export const VERIFICATION_STATES = ['UNVERIFIED', 'CONFIRMED_BY_USER', 'EVIDENCE_ATTACHED', 'RECONCILED'] as const
export const THANK_YOU_STATES = ['NOT_DUE', 'TO_THANK', 'PREPARED', 'SENT', 'ACKNOWLEDGED_OTHER', 'NOT_REQUIRED'] as const
export const FUNDING_SOURCE_KINDS = ['COUPLE', 'CONTRIBUTION', 'LEGACY_UNATTRIBUTED', 'OTHER'] as const

export type ContributionType = (typeof CONTRIBUTION_TYPES)[number]
export type ContributionRoute = (typeof CONTRIBUTION_ROUTES)[number]
export type CommitmentState = (typeof COMMITMENT_STATES)[number]
export type FulfillmentState = (typeof FULFILLMENT_STATES)[number]

export const CONTRIBUTION_TYPE_LABELS: Record<ContributionType, string> = {
  CASH_TO_COUPLE: 'Money given to us',
  DIRECT_VENDOR_PAYMENT: 'Paid a vendor directly',
  GOODS_IN_KIND: 'Goods or materials',
  SERVICE_IN_KIND: 'A service',
  TIME_LABOUR: 'Time or help',
  DISCOUNT_SPONSORSHIP: 'Discount or sponsorship',
  HONEYMOON_GIFT: 'Honeymoon or experience gift',
  OTHER: 'Other support',
}

export const FULFILLED_STATES = new Set<FulfillmentState>(['RECEIVED', 'DELIVERED', 'PAID_DIRECT', 'COMPLETED'])
export const CASH_RECEIPT_TYPES = new Set<ContributionType>(['CASH_TO_COUPLE', 'HONEYMOON_GIFT'])
export const IN_KIND_TYPES = new Set<ContributionType>(['GOODS_IN_KIND', 'SERVICE_IN_KIND', 'TIME_LABOUR', 'DISCOUNT_SPONSORSHIP'])

export function isFulfilled(state: string): boolean {
  return FULFILLED_STATES.has(state as FulfillmentState)
}

export function finiteNonNegative(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

export function normalizeCurrency(value: unknown, fallback = 'USD'): string {
  return typeof value === 'string' && /^[A-Za-z]{3}$/.test(value.trim()) ? value.trim().toUpperCase() : fallback
}

export function contributionAvailableAmount(input: {
  type: string
  amount: number | null
  fulfillmentState: string
  allocatedAmount?: number
}): number {
  if (!CASH_RECEIPT_TYPES.has(input.type as ContributionType) || input.fulfillmentState !== 'RECEIVED') return 0
  return Math.max(0, (input.amount ?? 0) - (input.allocatedAmount ?? 0))
}

export interface ContributionSummaryRow {
  type: string
  amount: number | null
  currency: string
  estimatedValue: number | null
  estimatedValueCurrency: string | null
  commitmentState: string
  fulfillmentState: string
  allocatedAmount?: number
  thankYouState?: string
}

export interface CurrencySummary {
  currency: string
  cashReceived: number
  directVendorPaid: number
  inKindValue: number
  pledged: number
  availableCash: number
}

export function summarizeContributions(rows: ContributionSummaryRow[]): CurrencySummary[] {
  const totals = new Map<string, CurrencySummary>()
  const get = (currency: string) => {
    const key = normalizeCurrency(currency)
    const current = totals.get(key) ?? { currency: key, cashReceived: 0, directVendorPaid: 0, inKindValue: 0, pledged: 0, availableCash: 0 }
    totals.set(key, current)
    return current
  }

  for (const row of rows) {
    const amount = row.amount ?? 0
    if (row.commitmentState === 'PLEDGED' && !isFulfilled(row.fulfillmentState)) {
      get(row.currency).pledged += amount
    }
    if (row.fulfillmentState === 'RECEIVED' && CASH_RECEIPT_TYPES.has(row.type as ContributionType)) {
      const current = get(row.currency)
      current.cashReceived += amount
      current.availableCash += contributionAvailableAmount({ ...row, allocatedAmount: row.allocatedAmount ?? 0 })
    }
    if (row.fulfillmentState === 'PAID_DIRECT' && row.type === 'DIRECT_VENDOR_PAYMENT') {
      get(row.currency).directVendorPaid += amount
    }
    if (isFulfilled(row.fulfillmentState) && IN_KIND_TYPES.has(row.type as ContributionType) && (row.estimatedValue ?? 0) > 0) {
      get(row.estimatedValueCurrency ?? row.currency).inKindValue += row.estimatedValue ?? 0
    }
  }

  return Array.from(totals.values()).sort((a, b) => a.currency.localeCompare(b.currency))
}

export function validateContributionShape(input: {
  type: unknown
  title: unknown
  amount?: unknown
  estimatedValue?: unknown
  fulfillmentState?: unknown
}): string | null {
  if (!CONTRIBUTION_TYPES.includes(input.type as ContributionType)) return 'Choose a valid contribution type.'
  if (typeof input.title !== 'string' || !input.title.trim()) return 'Describe what was contributed.'
  const amount = finiteNonNegative(input.amount)
  if (['CASH_TO_COUPLE', 'DIRECT_VENDOR_PAYMENT', 'HONEYMOON_GIFT'].includes(String(input.type)) && (amount === null || amount <= 0)) {
    return 'Enter the amount contributed.'
  }
  if (input.estimatedValue !== undefined && input.estimatedValue !== null && finiteNonNegative(input.estimatedValue) === null) {
    return 'Estimated value must be zero or more.'
  }
  if (input.fulfillmentState && !FULFILLMENT_STATES.includes(input.fulfillmentState as FulfillmentState)) return 'Choose a valid contribution state.'
  return null
}
'''
write('src/lib/contributions.ts', CONTRIBUTIONS_LIB)

# -----------------------------------------------------------------------------
# Server APIs: canonical records, allocations, campaigns, export and AI context.
# -----------------------------------------------------------------------------
CONTRIBUTIONS_ROUTE = r'''import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import {
  contributionAvailableAmount,
  finiteNonNegative,
  normalizeCurrency,
  summarizeContributions,
  validateContributionShape,
} from '@/lib/contributions'

function number(value: { toString(): string } | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value.toString())
  return Number.isFinite(parsed) ? parsed : null
}

function iso(value: Date | null | undefined): string | null {
  return value?.toISOString() ?? null
}

function serializeContribution(row: any) {
  const allocations = row.allocations ?? []
  const allocatedAmount = allocations
    .filter((allocation: any) => allocation.allocationKind !== 'IN_KIND')
    .reduce((sum: number, allocation: any) => sum + (number(allocation.amount) ?? 0), 0)
  const amount = number(row.amount)
  return {
    id: row.id,
    weddingId: row.weddingId,
    type: row.type,
    title: row.title,
    description: row.description,
    amount,
    currency: row.currency,
    estimatedValue: number(row.estimatedValue),
    estimatedValueCurrency: row.estimatedValueCurrency,
    quantity: number(row.quantity),
    unit: row.unit,
    route: row.route,
    commitmentState: row.commitmentState,
    fulfillmentState: row.fulfillmentState,
    verificationState: row.verificationState,
    thankYouState: row.thankYouState,
    pledgedAt: iso(row.pledgedAt),
    expectedAt: iso(row.expectedAt),
    fulfilledAt: iso(row.fulfilledAt),
    notes: row.notes,
    source: row.source,
    contributor: row.contributor,
    campaign: row.campaign ? { ...row.campaign, targetAmount: number(row.campaign.targetAmount) } : null,
    vendor: row.vendor,
    serviceEngagement: row.serviceEngagement ? { ...row.serviceEngagement, agreedAmount: number(row.serviceEngagement.agreedAmount) } : null,
    allocations: allocations.map((allocation: any) => ({ ...allocation, amount: number(allocation.amount) ?? 0 })),
    paymentFundingAllocations: (row.paymentFundingAllocations ?? []).map((allocation: any) => ({ ...allocation, amount: number(allocation.amount) ?? 0 })),
    taskLinks: row.taskLinks ?? [],
    allocatedAmount,
    availableAmount: contributionAvailableAmount({ type: row.type, amount, fulfillmentState: row.fulfillmentState, allocatedAmount }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const include = {
  contributor: true,
  campaign: true,
  vendor: { select: { id: true, name: true, category: true } },
  serviceEngagement: { select: { id: true, serviceCategory: true, serviceDescription: true, agreedAmount: true, currency: true, vendorId: true } },
  allocations: { include: { budgetItem: { select: { id: true, description: true, category: true, currency: true } } }, orderBy: { createdAt: 'asc' as const } },
  paymentFundingAllocations: { include: { payment: { select: { id: true, amount: true, currency: true, paidAt: true, reference: true } } }, orderBy: { createdAt: 'asc' as const } },
  taskLinks: { include: { plannerTask: { select: { id: true, title: true, status: true, dueDate: true } } } },
} as const

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'budget.view')
  if (access.error) return access.error
  const weddingId = access.context.weddingId
  try {
    const [rows, contributors, campaigns, budgetItems, vendors, engagements] = await Promise.all([
      db.weddingContribution.findMany({ where: { weddingId }, include, orderBy: [{ fulfilledAt: 'desc' }, { createdAt: 'desc' }] }),
      db.contributor.findMany({ where: { weddingId }, orderBy: [{ displayName: 'asc' }] }),
      db.contributionCampaign.findMany({ where: { weddingId }, include: { contributions: { select: { amount: true, fulfillmentState: true, currency: true } } }, orderBy: [{ createdAt: 'desc' }] }),
      db.budgetItem.findMany({ where: { weddingId }, select: { id: true, description: true, category: true, currency: true, actualCost: true, estimatedCost: true, serviceEngagementId: true }, orderBy: [{ category: 'asc' }, { description: 'asc' }] }),
      db.vendor.findMany({ where: { weddingId }, select: { id: true, name: true, category: true }, orderBy: { name: 'asc' } }),
      db.serviceEngagement.findMany({ where: { weddingId }, select: { id: true, serviceCategory: true, serviceDescription: true, currency: true, vendor: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } }),
    ])
    const data = rows.map(serializeContribution)
    const summaryByCurrency = summarizeContributions(data)
    const publicCampaigns = campaigns.map((campaign) => {
      const raised = campaign.contributions
        .filter((item) => ['RECEIVED', 'PAID_DIRECT', 'COMPLETED'].includes(item.fulfillmentState) && item.currency === campaign.currency)
        .reduce((sum, item) => sum + (number(item.amount) ?? 0), 0)
      return { ...campaign, targetAmount: number(campaign.targetAmount), raised }
    })
    return NextResponse.json({
      success: true,
      weddingId,
      data,
      contributors,
      campaigns: publicCampaigns,
      options: { budgetItems, vendors, engagements },
      summaryByCurrency,
      counts: {
        contributors: contributors.length,
        toThank: data.filter((item) => ['TO_THANK', 'PREPARED'].includes(item.thankYouState)).length,
        pledged: data.filter((item) => item.commitmentState === 'PLEDGED' && !['RECEIVED', 'DELIVERED', 'PAID_DIRECT', 'COMPLETED'].includes(item.fulfillmentState)).length,
      },
    })
  } catch (error) {
    console.error('[PLANNER CONTRIBUTIONS GET] error', error)
    return NextResponse.json({ success: false, error: 'Could not load contributions.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error
  const weddingId = access.context.weddingId
  const actorId = access.context.session.userId
  try {
    const body = (await request.json()) as Record<string, any>
    const validation = validateContributionShape(body)
    if (validation) return NextResponse.json({ success: false, error: validation }, { status: 400 })
    const currency = normalizeCurrency(body.currency)
    const amount = finiteNonNegative(body.amount)
    const estimatedValue = finiteNonNegative(body.estimatedValue)
    const quantity = finiteNonNegative(body.quantity)
    const fulfillmentState = typeof body.fulfillmentState === 'string' ? body.fulfillmentState : 'PENDING'

    const created = await db.$transaction(async (tx) => {
      let contributorId = typeof body.contributorId === 'string' ? body.contributorId : ''
      if (contributorId) {
        const found = await tx.contributor.findFirst({ where: { id: contributorId, weddingId }, select: { id: true } })
        if (!found) throw new Error('CONTRIBUTOR_SCOPE')
      } else {
        const displayName = String(body.contributor?.displayName ?? '').trim()
        if (!displayName) throw new Error('CONTRIBUTOR_REQUIRED')
        let guestId = typeof body.contributor?.guestId === 'string' ? body.contributor.guestId : null
        if (guestId) {
          const guest = await tx.guest.findFirst({ where: { id: guestId, weddingId }, select: { id: true } })
          if (!guest) guestId = null
        }
        const contributor = await tx.contributor.create({
          data: {
            weddingId,
            displayName,
            legalName: String(body.contributor?.legalName ?? '').trim() || null,
            kind: String(body.contributor?.kind ?? 'individual'),
            relationship: String(body.contributor?.relationship ?? '').trim() || null,
            email: String(body.contributor?.email ?? '').trim().toLowerCase() || null,
            phone: String(body.contributor?.phone ?? '').trim() || null,
            guestId,
          },
        })
        contributorId = contributor.id
      }

      const campaignId = typeof body.campaignId === 'string' && body.campaignId ? body.campaignId : null
      if (campaignId) {
        const campaign = await tx.contributionCampaign.findFirst({ where: { id: campaignId, weddingId }, select: { id: true, currency: true } })
        if (!campaign) throw new Error('CAMPAIGN_SCOPE')
      }
      const vendorId = typeof body.vendorId === 'string' && body.vendorId ? body.vendorId : null
      if (vendorId) {
        const vendor = await tx.vendor.findFirst({ where: { id: vendorId, weddingId }, select: { id: true } })
        if (!vendor) throw new Error('VENDOR_SCOPE')
      }
      const serviceEngagementId = typeof body.serviceEngagementId === 'string' && body.serviceEngagementId ? body.serviceEngagementId : null
      if (serviceEngagementId) {
        const engagement = await tx.serviceEngagement.findFirst({ where: { id: serviceEngagementId, weddingId }, select: { id: true, currency: true } })
        if (!engagement) throw new Error('ENGAGEMENT_SCOPE')
        if (body.type === 'DIRECT_VENDOR_PAYMENT' && engagement.currency !== currency) throw new Error('CURRENCY_MISMATCH')
      }

      const contribution = await tx.weddingContribution.create({
        data: {
          weddingId,
          contributorId,
          type: String(body.type),
          title: String(body.title).trim(),
          description: String(body.description ?? '').trim() || null,
          amount,
          currency,
          estimatedValue,
          estimatedValueCurrency: estimatedValue === null ? null : normalizeCurrency(body.estimatedValueCurrency, currency),
          quantity,
          unit: String(body.unit ?? '').trim() || null,
          route: String(body.route ?? (body.type === 'DIRECT_VENDOR_PAYMENT' ? 'DIRECT_TO_VENDOR' : 'TO_COUPLE')),
          commitmentState: String(body.commitmentState ?? (fulfillmentState === 'PENDING' ? 'PLEDGED' : 'NOT_APPLICABLE')),
          fulfillmentState,
          verificationState: String(body.verificationState ?? 'UNVERIFIED'),
          thankYouState: String(body.thankYouState ?? (['RECEIVED', 'DELIVERED', 'PAID_DIRECT', 'COMPLETED'].includes(fulfillmentState) ? 'TO_THANK' : 'NOT_DUE')),
          pledgedAt: body.pledgedAt ? new Date(body.pledgedAt) : null,
          expectedAt: body.expectedAt ? new Date(body.expectedAt) : null,
          fulfilledAt: body.fulfilledAt ? new Date(body.fulfilledAt) : (['RECEIVED', 'DELIVERED', 'PAID_DIRECT', 'COMPLETED'].includes(fulfillmentState) ? new Date() : null),
          campaignId,
          vendorId,
          serviceEngagementId,
          notes: String(body.notes ?? '').trim() || null,
          source: String(body.source ?? 'planner'),
          recordedById: actorId,
        },
      })

      const budgetItemId = typeof body.budgetItemId === 'string' && body.budgetItemId ? body.budgetItemId : null
      if (budgetItemId) {
        const item = await tx.budgetItem.findFirst({ where: { id: budgetItemId, weddingId }, select: { id: true, currency: true } })
        if (!item) throw new Error('BUDGET_SCOPE')
        const allocationValue = body.type === 'DIRECT_VENDOR_PAYMENT' || ['CASH_TO_COUPLE', 'HONEYMOON_GIFT'].includes(String(body.type)) ? amount : estimatedValue
        if ((allocationValue ?? 0) > 0) {
          const allocationCurrency = body.type === 'DIRECT_VENDOR_PAYMENT' || ['CASH_TO_COUPLE', 'HONEYMOON_GIFT'].includes(String(body.type)) ? currency : normalizeCurrency(body.estimatedValueCurrency, currency)
          if (item.currency !== allocationCurrency) throw new Error('CURRENCY_MISMATCH')
          await tx.contributionAllocation.create({
            data: { weddingId, contributionId: contribution.id, budgetItemId, amount: allocationValue!, currency: allocationCurrency, allocationKind: ['GOODS_IN_KIND', 'SERVICE_IN_KIND', 'TIME_LABOUR', 'DISCOUNT_SPONSORSHIP'].includes(String(body.type)) ? 'IN_KIND' : body.type === 'DIRECT_VENDOR_PAYMENT' ? 'DIRECT_PAYMENT' : 'CASH', createdById: actorId },
          })
        }
      }

      if (body.type === 'DIRECT_VENDOR_PAYMENT' && fulfillmentState === 'PAID_DIRECT') {
        if (!serviceEngagementId || !amount || amount <= 0) throw new Error('DIRECT_PAYMENT_ENGAGEMENT_REQUIRED')
        const payment = await tx.engagementPayment.create({
          data: {
            serviceEngagementId,
            amount,
            currency,
            paidAt: body.fulfilledAt ? new Date(body.fulfilledAt) : new Date(),
            method: String(body.paymentMethod ?? '').trim() || null,
            reference: String(body.paymentReference ?? '').trim() || null,
            notes: `Contributor-funded payment: ${String(body.title).trim()}`,
            recordedById: actorId,
          },
        })
        await tx.paymentFundingAllocation.create({
          data: { weddingId, paymentId: payment.id, budgetItemId, contributionId: contribution.id, sourceKind: 'CONTRIBUTION', amount, currency, createdById: actorId, reconciledAt: new Date() },
        })
        if (budgetItemId) await tx.budgetItem.update({ where: { id: budgetItemId }, data: { paidAmount: { increment: amount } } })
        await tx.weddingContribution.update({ where: { id: contribution.id }, data: { verificationState: 'RECONCILED' } })
      }

      await tx.auditEvent.create({
        data: { weddingId, eventType: 'contribution.created', actorType: 'user', actorId, targetType: 'WeddingContribution', targetId: contribution.id, payload: JSON.stringify({ type: contribution.type, route: contribution.route, fulfillmentState: contribution.fulfillmentState }), severity: 'info' },
      })
      return tx.weddingContribution.findUniqueOrThrow({ where: { id: contribution.id }, include })
    })

    return NextResponse.json({ success: true, data: serializeContribution(created) }, { status: 201 })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    const known: Record<string, string> = {
      CONTRIBUTOR_SCOPE: 'That contributor does not belong to this wedding.',
      CONTRIBUTOR_REQUIRED: 'Choose or add the person who contributed.',
      CAMPAIGN_SCOPE: 'That campaign does not belong to this wedding.',
      VENDOR_SCOPE: 'That vendor does not belong to this wedding.',
      ENGAGEMENT_SCOPE: 'That service engagement does not belong to this wedding.',
      BUDGET_SCOPE: 'That budget item does not belong to this wedding.',
      CURRENCY_MISMATCH: 'The selected records use different currencies. Record them separately or use a governed conversion.',
      DIRECT_PAYMENT_ENGAGEMENT_REQUIRED: 'A direct vendor payment must be connected to the vendor service engagement.',
    }
    if (known[code]) return NextResponse.json({ success: false, error: known[code] }, { status: 400 })
    console.error('[PLANNER CONTRIBUTIONS POST] error', error)
    return NextResponse.json({ success: false, error: 'Could not save the contribution.' }, { status: 500 })
  }
}
'''
write('src/app/api/planner/contributions/route.ts', CONTRIBUTIONS_ROUTE)

CONTRIBUTION_DETAIL_ROUTE = r'''import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { finiteNonNegative, normalizeCurrency } from '@/lib/contributions'

interface RouteContext { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error
  const { id } = await context.params
  const weddingId = access.context.weddingId
  const actorId = access.context.session.userId
  try {
    const current = await db.weddingContribution.findFirst({
      where: { id, weddingId },
      include: { allocations: { select: { id: true } }, paymentFundingAllocations: { select: { id: true } } },
    })
    if (!current) return NextResponse.json({ success: false, error: 'Contribution not found.' }, { status: 404 })
    const body = (await request.json()) as Record<string, unknown>
    const financiallyLocked = current.allocations.length > 0 || current.paymentFundingAllocations.length > 0 || current.verificationState === 'RECONCILED'
    if (financiallyLocked && ['amount', 'currency', 'type', 'fulfillmentState'].some((field) => field in body)) {
      return NextResponse.json({ success: false, error: 'This contribution is already allocated or reconciled. Use an adjustment/reversal instead of rewriting the financial fact.' }, { status: 409 })
    }
    const data: Record<string, unknown> = {}
    for (const field of ['title', 'description', 'notes', 'relationship', 'thankYouState', 'verificationState', 'commitmentState', 'fulfillmentState', 'route', 'unit']) {
      if (typeof body[field] === 'string') data[field] = String(body[field]).trim() || null
    }
    if (body.amount !== undefined) data.amount = finiteNonNegative(body.amount)
    if (body.estimatedValue !== undefined) data.estimatedValue = finiteNonNegative(body.estimatedValue)
    if (body.quantity !== undefined) data.quantity = finiteNonNegative(body.quantity)
    if (body.currency !== undefined) data.currency = normalizeCurrency(body.currency)
    if (body.estimatedValueCurrency !== undefined) data.estimatedValueCurrency = normalizeCurrency(body.estimatedValueCurrency)
    if (body.fulfilledAt !== undefined) data.fulfilledAt = body.fulfilledAt ? new Date(String(body.fulfilledAt)) : null
    const updated = await db.weddingContribution.update({ where: { id }, data })
    await db.auditEvent.create({ data: { weddingId, eventType: 'contribution.updated', actorType: 'user', actorId, targetType: 'WeddingContribution', targetId: id, payload: JSON.stringify({ fields: Object.keys(data), financiallyLocked }), severity: 'info' } })
    return NextResponse.json({ success: true, data: { ...updated, amount: updated.amount ? Number(updated.amount) : null, estimatedValue: updated.estimatedValue ? Number(updated.estimatedValue) : null } })
  } catch (error) {
    console.error('[PLANNER CONTRIBUTION PATCH] error', error)
    return NextResponse.json({ success: false, error: 'Could not update the contribution.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error
  const { id } = await context.params
  const weddingId = access.context.weddingId
  const actorId = access.context.session.userId
  const current = await db.weddingContribution.findFirst({ where: { id, weddingId }, include: { allocations: { select: { id: true } }, paymentFundingAllocations: { select: { id: true } } } })
  if (!current) return NextResponse.json({ success: false, error: 'Contribution not found.' }, { status: 404 })
  if (current.allocations.length || current.paymentFundingAllocations.length || current.verificationState === 'RECONCILED') {
    return NextResponse.json({ success: false, error: 'Reconciled or allocated contributions cannot be deleted. Cancel or adjust them so the history remains auditable.' }, { status: 409 })
  }
  await db.$transaction([
    db.weddingContribution.delete({ where: { id } }),
    db.auditEvent.create({ data: { weddingId, eventType: 'contribution.deleted_unreconciled', actorType: 'user', actorId, targetType: 'WeddingContribution', targetId: id, severity: 'warning' } }),
  ])
  return NextResponse.json({ success: true })
}
'''
write('src/app/api/planner/contributions/[id]/route.ts', CONTRIBUTION_DETAIL_ROUTE)

CONTRIBUTION_ACTIONS_ROUTE = r'''import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contributionAvailableAmount, finiteNonNegative, normalizeCurrency } from '@/lib/contributions'
import { contextHasPermission, requireWeddingPermission } from '@/lib/wedding-access'

interface RouteContext { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error
  const { id } = await context.params
  const weddingId = access.context.weddingId
  const actorId = access.context.session.userId
  const body = (await request.json()) as Record<string, unknown>
  const action = String(body.action ?? '')
  try {
    const contribution = await db.weddingContribution.findFirst({
      where: { id, weddingId },
      include: { allocations: true, contributor: { select: { displayName: true } } },
    })
    if (!contribution) return NextResponse.json({ success: false, error: 'Contribution not found.' }, { status: 404 })

    if (action === 'allocate') {
      const budgetItemId = String(body.budgetItemId ?? '')
      const amount = finiteNonNegative(body.amount)
      if (!budgetItemId || !amount || amount <= 0) return NextResponse.json({ success: false, error: 'Choose a budget item and amount.' }, { status: 400 })
      const budget = await db.budgetItem.findFirst({ where: { id: budgetItemId, weddingId }, select: { id: true, currency: true } })
      if (!budget) return NextResponse.json({ success: false, error: 'Budget item not found for this wedding.' }, { status: 404 })
      const currency = normalizeCurrency(body.currency, contribution.currency)
      if (currency !== contribution.currency || currency !== budget.currency) return NextResponse.json({ success: false, error: 'Allocation currency must match the contribution and budget item.' }, { status: 400 })
      const allocatedAmount = contribution.allocations.filter((item) => item.allocationKind !== 'IN_KIND').reduce((sum, item) => sum + Number(item.amount), 0)
      const available = contributionAvailableAmount({ type: contribution.type, amount: contribution.amount ? Number(contribution.amount) : null, fulfillmentState: contribution.fulfillmentState, allocatedAmount })
      if (amount > available + 0.0001) return NextResponse.json({ success: false, error: `Only ${currency} ${available.toFixed(2)} is still available to allocate.` }, { status: 409 })
      const allocation = await db.contributionAllocation.create({ data: { weddingId, contributionId: id, budgetItemId, amount, currency, allocationKind: 'CASH', note: String(body.note ?? '').trim() || null, createdById: actorId } })
      await db.auditEvent.create({ data: { weddingId, eventType: 'contribution.allocated', actorType: 'user', actorId, targetType: 'WeddingContribution', targetId: id, payload: JSON.stringify({ budgetItemId, amount, currency }), severity: 'info' } })
      return NextResponse.json({ success: true, data: { ...allocation, amount: Number(allocation.amount) } })
    }

    if (action === 'create-task') {
      if (!contextHasPermission(access.context, 'planner.edit')) return NextResponse.json({ success: false, error: 'You do not have permission to create Planner tasks.' }, { status: 403 })
      const title = String(body.title ?? `Follow up contribution from ${contribution.contributor.displayName}`).trim()
      if (!title) return NextResponse.json({ success: false, error: 'Task title is required.' }, { status: 400 })
      const task = await db.plannerTask.create({ data: { weddingId, title, description: String(body.description ?? contribution.title).trim() || null, category: 'other', status: 'todo', priority: 'medium', dueDate: body.dueDate ? new Date(String(body.dueDate)) : null, assigneeUserId: actorId } })
      await db.contributionTaskLink.create({ data: { weddingId, contributionId: id, plannerTaskId: task.id, linkRole: String(body.linkRole ?? 'follow_up') } })
      return NextResponse.json({ success: true, data: task })
    }

    if (action === 'mark-thanked') {
      const updated = await db.weddingContribution.update({ where: { id }, data: { thankYouState: 'SENT' } })
      await db.auditEvent.create({ data: { weddingId, eventType: 'contribution.thanked', actorType: 'user', actorId, targetType: 'WeddingContribution', targetId: id, severity: 'info' } })
      return NextResponse.json({ success: true, data: { id: updated.id, thankYouState: updated.thankYouState } })
    }

    if (action === 'reconcile-budget-funding') {
      const budgetItemId = String(body.budgetItemId ?? '')
      const amount = finiteNonNegative(body.amount)
      const sourceKind = String(body.sourceKind ?? '')
      if (!['COUPLE', 'CONTRIBUTION', 'LEGACY_UNATTRIBUTED', 'OTHER'].includes(sourceKind) || !budgetItemId || !amount || amount <= 0) return NextResponse.json({ success: false, error: 'Choose a valid funding source, budget item and amount.' }, { status: 400 })
      const budget = await db.budgetItem.findFirst({ where: { id: budgetItemId, weddingId }, select: { id: true, paidAmount: true, currency: true } })
      if (!budget) return NextResponse.json({ success: false, error: 'Budget item not found.' }, { status: 404 })
      const existing = await db.paymentFundingAllocation.aggregate({ where: { weddingId, budgetItemId }, _sum: { amount: true } })
      const already = Number(existing._sum.amount ?? 0)
      if (already + amount > budget.paidAmount + 0.0001) return NextResponse.json({ success: false, error: 'Funding attribution cannot exceed the amount already marked paid.' }, { status: 409 })
      if (sourceKind === 'CONTRIBUTION' && contribution.currency !== budget.currency) return NextResponse.json({ success: false, error: 'Funding currency must match the budget item.' }, { status: 400 })
      const allocation = await db.paymentFundingAllocation.create({ data: { weddingId, budgetItemId, contributionId: sourceKind === 'CONTRIBUTION' ? id : null, sourceKind, amount, currency: budget.currency, createdById: actorId, reconciledAt: new Date() } })
      return NextResponse.json({ success: true, data: { ...allocation, amount: Number(allocation.amount) } })
    }

    return NextResponse.json({ success: false, error: 'Unsupported contribution action.' }, { status: 400 })
  } catch (error) {
    console.error('[PLANNER CONTRIBUTION ACTION] error', error)
    return NextResponse.json({ success: false, error: 'Could not complete the contribution action.' }, { status: 500 })
  }
}
'''
write('src/app/api/planner/contributions/[id]/actions/route.ts', CONTRIBUTION_ACTIONS_ROUTE)

CAMPAIGNS_ROUTE = r'''import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { finiteNonNegative, normalizeCurrency } from '@/lib/contributions'
import { requireWeddingPermission } from '@/lib/wedding-access'

function serialized(row: any) {
  const raised = (row.contributions ?? []).filter((item: any) => ['RECEIVED', 'PAID_DIRECT', 'COMPLETED'].includes(item.fulfillmentState) && item.currency === row.currency).reduce((sum: number, item: any) => sum + Number(item.amount ?? 0), 0)
  return { ...row, targetAmount: row.targetAmount === null ? null : Number(row.targetAmount), raised, contributions: undefined }
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'budget.view')
  if (access.error) return access.error
  const rows = await db.contributionCampaign.findMany({ where: { weddingId: access.context.weddingId }, include: { contributions: { select: { amount: true, currency: true, fulfillmentState: true } } }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ success: true, data: rows.map(serialized) })
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error
  const body = (await request.json()) as Record<string, unknown>
  const title = String(body.title ?? '').trim()
  if (!title) return NextResponse.json({ success: false, error: 'Campaign title is required.' }, { status: 400 })
  const externalUrl = String(body.externalUrl ?? '').trim() || null
  if (externalUrl && !/^https:\/\//i.test(externalUrl)) return NextResponse.json({ success: false, error: 'External campaign links must use HTTPS.' }, { status: 400 })
  const row = await db.contributionCampaign.create({ data: { weddingId: access.context.weddingId, type: String(body.type ?? 'HONEYMOON'), title, description: String(body.description ?? '').trim() || null, targetAmount: finiteNonNegative(body.targetAmount), currency: normalizeCurrency(body.currency), published: Boolean(body.published), showTarget: Boolean(body.showTarget), showRaised: Boolean(body.showRaised), externalUrl, ctaLabel: String(body.ctaLabel ?? '').trim() || null, invitationVisible: Boolean(body.invitationVisible), publicNote: String(body.publicNote ?? '').trim() || null } })
  return NextResponse.json({ success: true, data: { ...row, targetAmount: row.targetAmount === null ? null : Number(row.targetAmount), raised: 0 } }, { status: 201 })
}
'''
write('src/app/api/planner/contribution-campaigns/route.ts', CAMPAIGNS_ROUTE)

CAMPAIGN_DETAIL_ROUTE = r'''import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { finiteNonNegative, normalizeCurrency } from '@/lib/contributions'
import { requireWeddingPermission } from '@/lib/wedding-access'

interface RouteContext { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error
  const { id } = await context.params
  const existing = await db.contributionCampaign.findFirst({ where: { id, weddingId: access.context.weddingId }, select: { id: true } })
  if (!existing) return NextResponse.json({ success: false, error: 'Campaign not found.' }, { status: 404 })
  const body = (await request.json()) as Record<string, unknown>
  const data: Record<string, unknown> = {}
  for (const field of ['title', 'description', 'type', 'ctaLabel', 'publicNote']) if (typeof body[field] === 'string') data[field] = String(body[field]).trim() || null
  for (const field of ['published', 'showTarget', 'showRaised', 'invitationVisible']) if (typeof body[field] === 'boolean') data[field] = body[field]
  if (body.targetAmount !== undefined) data.targetAmount = finiteNonNegative(body.targetAmount)
  if (body.currency !== undefined) data.currency = normalizeCurrency(body.currency)
  if (body.externalUrl !== undefined) {
    const url = String(body.externalUrl ?? '').trim() || null
    if (url && !/^https:\/\//i.test(url)) return NextResponse.json({ success: false, error: 'External campaign links must use HTTPS.' }, { status: 400 })
    data.externalUrl = url
  }
  const row = await db.contributionCampaign.update({ where: { id }, data })
  return NextResponse.json({ success: true, data: { ...row, targetAmount: row.targetAmount === null ? null : Number(row.targetAmount) } })
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error
  const { id } = await context.params
  const existing = await db.contributionCampaign.findFirst({ where: { id, weddingId: access.context.weddingId }, include: { _count: { select: { contributions: true } } } })
  if (!existing) return NextResponse.json({ success: false, error: 'Campaign not found.' }, { status: 404 })
  if (existing._count.contributions) return NextResponse.json({ success: false, error: 'Campaigns with recorded contributions should be unpublished rather than deleted.' }, { status: 409 })
  await db.contributionCampaign.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
'''
write('src/app/api/planner/contribution-campaigns/[id]/route.ts', CAMPAIGN_DETAIL_ROUTE)

PUBLIC_CAMPAIGNS_ROUTE = r'''import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const weddingSlug = request.nextUrl.searchParams.get('weddingSlug')?.trim()
  if (!weddingSlug) return NextResponse.json({ success: true, data: [] })
  const now = new Date()
  const wedding = await db.wedding.findUnique({ where: { slug: weddingSlug }, select: { id: true, privacy: true } })
  if (!wedding) return NextResponse.json({ success: true, data: [] })
  const rows = await db.contributionCampaign.findMany({
    where: { weddingId: wedding.id, published: true, AND: [{ OR: [{ publishFrom: null }, { publishFrom: { lte: now } }] }, { OR: [{ publishUntil: null }, { publishUntil: { gte: now } }] }] },
    include: { contributions: { where: { fulfillmentState: { in: ['RECEIVED', 'PAID_DIRECT', 'COMPLETED'] } }, select: { amount: true, currency: true } } },
    orderBy: { createdAt: 'asc' },
  })
  const data = rows.map((row) => {
    const raised = row.contributions.filter((item) => item.currency === row.currency).reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description,
      currency: row.currency,
      targetAmount: row.showTarget && row.targetAmount !== null ? Number(row.targetAmount) : null,
      raised: row.showRaised ? raised : null,
      showTarget: row.showTarget,
      showRaised: row.showRaised,
      externalUrl: row.externalUrl,
      ctaLabel: row.ctaLabel,
      invitationVisible: row.invitationVisible,
      publicNote: row.publicNote,
    }
  })
  return NextResponse.json({ success: true, data })
}
'''
write('src/app/api/contribution-campaigns/public/route.ts', PUBLIC_CAMPAIGNS_ROUTE)

EXPORT_ROUTE = r'''import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'

function csv(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'export.data')
  if (access.error) return access.error
  const rows = await db.weddingContribution.findMany({ where: { weddingId: access.context.weddingId }, include: { contributor: true, allocations: true }, orderBy: { createdAt: 'asc' } })
  const header = ['Contributor','Email','Relationship','Contribution','Type','Amount','Currency','Estimated in-kind value','In-kind currency','State','Route','Allocated','Thank-you','Notes']
  const lines = [header.map(csv).join(',')]
  for (const row of rows) {
    const allocated = row.allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0)
    lines.push([row.contributor.displayName,row.contributor.email,row.contributor.relationship,row.title,row.type,row.amount === null ? '' : Number(row.amount),row.currency,row.estimatedValue === null ? '' : Number(row.estimatedValue),row.estimatedValueCurrency,row.fulfillmentState,row.route,allocated,row.thankYouState,row.notes].map(csv).join(','))
  }
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="wewed-contributions.csv"', 'cache-control': 'private, no-store' } })
}
'''
write('src/app/api/planner/contributions/export/route.ts', EXPORT_ROUTE)

AI_CONTEXT_ROUTE = r'''import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { summarizeContributions } from '@/lib/contributions'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'budget.view')
  if (access.error) return access.error
  const rows = await db.weddingContribution.findMany({ where: { weddingId: access.context.weddingId }, include: { contributor: { select: { displayName: true } }, allocations: { select: { amount: true, allocationKind: true } } }, orderBy: { createdAt: 'desc' } })
  const data = rows.map((row) => ({ id: row.id, contributor: row.contributor.displayName, title: row.title, type: row.type, amount: row.amount === null ? null : Number(row.amount), currency: row.currency, estimatedValue: row.estimatedValue === null ? null : Number(row.estimatedValue), estimatedValueCurrency: row.estimatedValueCurrency, commitmentState: row.commitmentState, fulfillmentState: row.fulfillmentState, thankYouState: row.thankYouState, allocatedAmount: row.allocations.filter((item) => item.allocationKind !== 'IN_KIND').reduce((sum, item) => sum + Number(item.amount), 0) }))
  return NextResponse.json({ success: true, guardrails: { unknownPayerIsNotCouple: true, pledgeIsNotCash: true, noAutomaticFx: true, financialMutationRequiresConfirmation: true }, summaryByCurrency: summarizeContributions(data), records: data })
}
'''
write('src/app/api/planner/contributions/ai-context/route.ts', AI_CONTEXT_ROUTE)

ANALYTICS_ROUTE = r'''import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-gate'

export async function GET(request: NextRequest) {
  const gate = requireAdmin(request)
  if (gate) return gate
  const [total, weddings, campaigns, direct, inKind, unattributed] = await Promise.all([
    db.weddingContribution.count(),
    db.weddingContribution.groupBy({ by: ['weddingId'], _count: { _all: true } }),
    db.contributionCampaign.count(),
    db.weddingContribution.count({ where: { type: 'DIRECT_VENDOR_PAYMENT' } }),
    db.weddingContribution.count({ where: { type: { in: ['GOODS_IN_KIND', 'SERVICE_IN_KIND', 'TIME_LABOUR', 'DISCOUNT_SPONSORSHIP'] } } }),
    db.paymentFundingAllocation.count({ where: { sourceKind: 'LEGACY_UNATTRIBUTED' } }),
  ])
  return NextResponse.json({ success: true, data: { contributions: total, weddingsUsingContributions: weddings.length, campaigns, directVendorPayments: direct, inKindContributions: inKind, explicitlyUnattributedFundingRows: unattributed } })
}
'''
write('src/app/api/admin/contributions/analytics/route.ts', ANALYTICS_ROUTE)

# -----------------------------------------------------------------------------
# Phase 2/4/5/6: responsive non-accountant-first Planner workspace.
# -----------------------------------------------------------------------------
CONTRIBUTIONS_UI = r'''\'use client\'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CircleDollarSign, Download, Gift, HandHeart, Loader2, NotebookPen, Plus, Search, Sparkles, Store, Users, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { CONTRIBUTION_TYPE_LABELS } from '@/lib/contributions'

interface Contributor { id: string; displayName: string; email: string | null; relationship: string | null }
interface Allocation { id: string; amount: number; currency: string; allocationKind: string; budgetItem: { id: string; description: string } }
interface Contribution {
  id: string; weddingId: string; type: keyof typeof CONTRIBUTION_TYPE_LABELS; title: string; description: string | null; amount: number | null; currency: string; estimatedValue: number | null; estimatedValueCurrency: string | null; quantity: number | null; unit: string | null; route: string; commitmentState: string; fulfillmentState: string; verificationState: string; thankYouState: string; expectedAt: string | null; fulfilledAt: string | null; notes: string | null; contributor: Contributor; allocations: Allocation[]; availableAmount: number; vendor: { id: string; name: string } | null; campaign: { id: string; title: string } | null; taskLinks: Array<{ plannerTask: { id: string; title: string; status: string } }>;
}
interface Summary { currency: string; cashReceived: number; directVendorPaid: number; inKindValue: number; pledged: number; availableCash: number }
interface BudgetOption { id: string; description: string; category: string; currency: string; serviceEngagementId: string | null }
interface EngagementOption { id: string; serviceCategory: string; serviceDescription: string | null; currency: string; vendor: { id: string; name: string } }
interface Campaign { id: string; type: string; title: string; description: string | null; targetAmount: number | null; currency: string; published: boolean; showTarget: boolean; showRaised: boolean; invitationVisible: boolean; externalUrl: string | null; raised: number }
interface Payload { success: boolean; weddingId: string; data: Contribution[]; contributors: Contributor[]; campaigns: Campaign[]; options: { budgetItems: BudgetOption[]; vendors: Array<{id:string;name:string;category:string}>; engagements: EngagementOption[] }; summaryByCurrency: Summary[]; counts: { contributors: number; toThank: number; pledged: number } }

const EMPTY_FORM = { contributorId: '', contributorName: '', email: '', relationship: '', type: 'CASH_TO_COUPLE', title: '', amount: '', currency: 'USD', estimatedValue: '', quantity: '', unit: '', route: 'TO_COUPLE', state: 'RECEIVED', budgetItemId: '', serviceEngagementId: '', campaignId: '', notes: '' }

function money(value: number, currency = 'USD') { try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value) } catch { return `${currency} ${value.toFixed(2)}` } }
function humanState(value: string) { return value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <section className={`rounded-2xl border border-gold/15 bg-champagne/[0.035] ${className}`}>{children}</section> }

export function PlannerContributionsModule() {
  const { toast } = useToast()
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [manage, setManage] = useState<Contribution | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [allocation, setAllocation] = useState({ budgetItemId: '', amount: '' })
  const [taskTitle, setTaskTitle] = useState('')
  const [noteText, setNoteText] = useState('')
  const [campaignForm, setCampaignForm] = useState({ title: '', description: '', targetAmount: '', currency: 'USD', externalUrl: '' })

  const load = useCallback(async (spinner = false) => {
    if (spinner) setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/planner/contributions', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok || body.success === false) throw new Error(body.error || 'Could not load contributions.')
      setPayload(body)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load contributions.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load(true) }, [load])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (payload?.data ?? []).filter((item) => {
      if (filter === 'pledged' && !(item.commitmentState === 'PLEDGED' && !['RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED'].includes(item.fulfillmentState))) return false
      if (filter === 'received' && !['RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED'].includes(item.fulfillmentState)) return false
      if (filter === 'in-kind' && !['GOODS_IN_KIND','SERVICE_IN_KIND','TIME_LABOUR','DISCOUNT_SPONSORSHIP'].includes(item.type)) return false
      if (filter === 'direct' && item.type !== 'DIRECT_VENDOR_PAYMENT') return false
      if (filter === 'thank' && !['TO_THANK','PREPARED'].includes(item.thankYouState)) return false
      return !query || [item.contributor.displayName, item.title, item.description ?? '', item.vendor?.name ?? '', item.campaign?.title ?? ''].some((value) => value.toLowerCase().includes(query))
    })
  }, [payload, search, filter])

  async function request(url: string, init: RequestInit) {
    setSaving(true); setError('')
    try {
      const response = await fetch(url, init)
      const body = await response.json()
      if (!response.ok || body.success === false) throw new Error(body.error || 'The change could not be saved.')
      await load(false)
      return body
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'The change could not be saved.'
      setError(message); toast({ title: 'Could not save', description: message, variant: 'destructive' }); return null
    } finally { setSaving(false) }
  }

  async function addContribution(event: React.FormEvent) {
    event.preventDefault()
    const type = form.type
    const isDirect = type === 'DIRECT_VENDOR_PAYMENT'
    const isInKind = ['GOODS_IN_KIND','SERVICE_IN_KIND','TIME_LABOUR','DISCOUNT_SPONSORSHIP'].includes(type)
    const state = form.state === 'PROMISED' ? 'PENDING' : isDirect ? 'PAID_DIRECT' : isInKind ? 'DELIVERED' : 'RECEIVED'
    const body = {
      contributorId: form.contributorId || undefined,
      contributor: form.contributorId ? undefined : { displayName: form.contributorName, email: form.email, relationship: form.relationship },
      type, title: form.title, amount: form.amount ? Number(form.amount) : null, currency: form.currency,
      estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : null, quantity: form.quantity ? Number(form.quantity) : null, unit: form.unit || null,
      route: isDirect ? 'DIRECT_TO_VENDOR' : isInKind ? 'IN_KIND_TO_COUPLE' : 'TO_COUPLE', commitmentState: form.state === 'PROMISED' ? 'PLEDGED' : 'NOT_APPLICABLE', fulfillmentState: state,
      budgetItemId: form.budgetItemId || null, serviceEngagementId: form.serviceEngagementId || null, campaignId: form.campaignId || null, notes: form.notes,
    }
    const result = await request('/api/planner/contributions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (result) { setAddOpen(false); setForm(EMPTY_FORM); toast({ title: 'Contribution saved', description: 'Wewed kept the contributor and funding source separate from your own spending.' }) }
  }

  async function doAction(action: string, extra: Record<string, unknown> = {}) {
    if (!manage) return
    const result = await request(`/api/planner/contributions/${manage.id}/actions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...extra }) })
    if (result) {
      const next = (await fetch('/api/planner/contributions', { cache: 'no-store' }).then((res) => res.json())) as Payload
      setPayload(next)
      setManage(next.data.find((item) => item.id === manage.id) ?? null)
    }
  }

  async function createNotebookNote() {
    if (!manage || !payload || !noteText.trim()) return
    setSaving(true)
    try {
      const response = await fetch('/api/notebook', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `Contribution — ${manage.contributor.displayName}`, contentText: noteText.trim(), weddingId: payload.weddingId, noteType: 'QUICK', visibility: 'PRIVATE', contextType: 'contribution' }) })
      const note = await response.json()
      if (!response.ok || note.success === false || !note.data?.id) throw new Error(note.error || 'Could not create Notebook note.')
      const linked = await fetch(`/api/notebook/${note.data.id}/actions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add-link', entityType: 'WeddingContribution', entityId: manage.id, labelSnapshot: `${manage.contributor.displayName} — ${manage.title}` }) })
      const linkedBody = await linked.json()
      if (!linked.ok || linkedBody.success === false) throw new Error(linkedBody.error || 'Note was created but could not be linked.')
      setNoteText(''); toast({ title: 'Notebook note linked' })
    } catch (reason) { toast({ title: 'Notebook link failed', description: reason instanceof Error ? reason.message : undefined, variant: 'destructive' }) } finally { setSaving(false) }
  }

  async function createCampaign(event: React.FormEvent) {
    event.preventDefault()
    const result = await request('/api/planner/contribution-campaigns', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'HONEYMOON', title: campaignForm.title, description: campaignForm.description, targetAmount: campaignForm.targetAmount ? Number(campaignForm.targetAmount) : null, currency: campaignForm.currency, externalUrl: campaignForm.externalUrl || null, published: false, showTarget: false, showRaised: false, invitationVisible: false }) })
    if (result) setCampaignForm({ title: '', description: '', targetAmount: '', currency: 'USD', externalUrl: '' })
  }

  async function toggleCampaign(campaign: Campaign, patch: Record<string, unknown>) {
    await request(`/api/planner/contribution-campaigns/${campaign.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
  }

  if (loading && !payload) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="size-7 animate-spin text-gold" /></div>

  return <div className="space-y-5" data-testid="planner-contributions-module">
    {error && <div role="alert" className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay-light">{error}</div>}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="font-sans text-[10px] uppercase tracking-[0.18em] text-gold">Contributions</p><h1 className="mt-1 font-serif text-2xl sm:text-3xl">Who helped make this possible?</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-champagne/55">Record money, vendor payments, materials, services or time. Wewed keeps this separate from what you personally paid.</p></div>
      <div className="flex gap-2"><Button asChild variant="outline" className="border-gold/20 bg-transparent text-champagne/70"><a href="/api/planner/contributions/export"><Download className="size-4" />Export</a></Button><Button onClick={() => setAddOpen(true)} className="bg-gold text-espresso hover:bg-gold-light"><Plus className="size-4" />Add contribution</Button></div>
    </div>

    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {(payload?.summaryByCurrency ?? []).length === 0 ? <Card className="col-span-2 p-4 lg:col-span-4"><p className="text-sm text-champagne/55">No contribution totals yet. Add the first person or organisation that helped.</p></Card> : (payload?.summaryByCurrency ?? []).flatMap((summary) => [
        ['Money received', summary.cashReceived, 'Cash in your contribution pool', <CircleDollarSign key="cash" className="size-4" />],
        ['Paid direct', summary.directVendorPaid, 'Contributor paid a vendor', <Store key="vendor" className="size-4" />],
        ['In-kind value', summary.inKindValue, 'Estimated non-cash support', <Gift key="kind" className="size-4" />],
        ['Still available', summary.availableCash, 'Received cash not yet allocated', <HandHeart key="available" className="size-4" />],
      ].map(([label, value, detail, icon]) => <Card key={`${summary.currency}-${label}`} className="p-3 sm:p-4"><div className="flex items-center justify-between text-gold"><p className="text-[9px] uppercase tracking-[0.13em] sm:text-[10px]">{label as string}</p>{icon}</div><p className="mt-2 font-serif text-xl sm:text-2xl">{money(Number(value), summary.currency)}</p><p className="mt-1 text-[10px] leading-4 text-champagne/45">{detail as string} · {summary.currency}</p></Card>)))}
    </div>
    {(payload?.summaryByCurrency ?? []).some((summary) => summary.pledged > 0) && <Card className="p-3"><p className="text-xs text-champagne/60"><span className="font-medium text-gold">Promised, not received:</span> {(payload?.summaryByCurrency ?? []).filter((item) => item.pledged > 0).map((item) => `${money(item.pledged, item.currency)}`).join(' · ')}. Promises are not counted as money received.</p></Card>}

    <Card className="overflow-hidden">
      <div className="grid gap-2 border-b border-gold/10 p-3 sm:grid-cols-[1fr_13rem]"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-champagne/35" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search contributor, item, vendor or campaign" className="border-gold/20 bg-espresso/70 pl-9" /></div><select aria-label="Filter contributions" value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="all">Everything</option><option value="pledged">Promised</option><option value="received">Received / delivered</option><option value="direct">Paid vendor directly</option><option value="in-kind">Goods / services / time</option><option value="thank">Needs a thank-you</option></select></div>
      {filtered.length === 0 ? <div className="p-8 text-center text-sm text-champagne/50">No contributions in this view.</div> : <>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[780px] text-left text-sm"><thead className="border-b border-gold/10 text-[10px] uppercase tracking-wider text-champagne/45"><tr><th className="p-3">Contributor</th><th className="p-3">What they helped with</th><th className="p-3">Value</th><th className="p-3">State</th><th className="p-3">Where it went</th><th className="p-3"><span className="sr-only">Actions</span></th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id} className="border-b border-gold/10 last:border-0"><td className="p-3"><p className="font-medium">{item.contributor.displayName}</p><p className="text-xs text-champagne/45">{item.contributor.relationship || 'Contributor'}</p></td><td className="p-3"><p>{item.title}</p><p className="text-xs text-champagne/45">{CONTRIBUTION_TYPE_LABELS[item.type]}</p></td><td className="p-3">{item.amount !== null ? money(item.amount, item.currency) : item.estimatedValue !== null ? `${money(item.estimatedValue, item.estimatedValueCurrency || item.currency)} est.` : 'Value not recorded'}</td><td className="p-3"><Badge variant="outline" className="border-gold/25 text-champagne/75">{humanState(item.fulfillmentState)}</Badge></td><td className="p-3 text-champagne/60">{item.allocations[0]?.budgetItem.description || item.vendor?.name || item.campaign?.title || (item.availableAmount > 0 ? `${money(item.availableAmount,item.currency)} still available` : 'Not allocated')}</td><td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => { setManage(item); setTaskTitle(`Follow up contribution from ${item.contributor.displayName}`) }} className="border-gold/20 bg-transparent">Manage</Button></td></tr>)}</tbody></table></div>
        <div className="space-y-2 p-3 md:hidden">{filtered.map((item) => <button key={item.id} type="button" onClick={() => { setManage(item); setTaskTitle(`Follow up contribution from ${item.contributor.displayName}`) }} className="w-full rounded-xl border border-gold/12 bg-espresso/45 p-3 text-left"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{item.contributor.displayName}</p><p className="mt-0.5 text-xs text-champagne/50">{item.title}</p></div><p className="shrink-0 font-serif text-base text-gold">{item.amount !== null ? money(item.amount,item.currency) : item.estimatedValue !== null ? `${money(item.estimatedValue,item.estimatedValueCurrency || item.currency)} est.` : '—'}</p></div><div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline" className="border-gold/25 text-[10px] text-champagne/70">{humanState(item.fulfillmentState)}</Badge><Badge variant="outline" className="border-champagne/15 text-[10px] text-champagne/55">{CONTRIBUTION_TYPE_LABELS[item.type]}</Badge></div></button>)}</div>
      </>}
    </Card>

    <Card className="p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="max-w-xl"><p className="text-[10px] uppercase tracking-[0.16em] text-gold">Honeymoon & gifting</p><h2 className="mt-1 font-serif text-xl">Optional information for guests</h2><p className="mt-1 text-xs leading-5 text-champagne/50">Campaigns stay private until you publish them. Public progress and targets are separate choices. Wewed never publishes contributor contact details or individual amounts here.</p></div><form onSubmit={createCampaign} className="grid w-full gap-2 sm:grid-cols-2 lg:max-w-2xl"><Input required value={campaignForm.title} onChange={(e) => setCampaignForm((c) => ({...c,title:e.target.value}))} placeholder="Honeymoon fund" className="border-gold/20 bg-espresso/70" /><Input value={campaignForm.targetAmount} onChange={(e) => setCampaignForm((c) => ({...c,targetAmount:e.target.value}))} inputMode="decimal" placeholder="Optional target" className="border-gold/20 bg-espresso/70" /><Input value={campaignForm.description} onChange={(e) => setCampaignForm((c) => ({...c,description:e.target.value}))} placeholder="A short, appreciative note" className="border-gold/20 bg-espresso/70 sm:col-span-2" /><Input value={campaignForm.externalUrl} onChange={(e) => setCampaignForm((c) => ({...c,externalUrl:e.target.value}))} placeholder="Optional HTTPS registry/payment link" className="border-gold/20 bg-espresso/70 sm:col-span-2" /><Button type="submit" disabled={saving} className="bg-gold text-espresso sm:col-span-2">Create private campaign</Button></form></div>
      {(payload?.campaigns ?? []).length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2">{payload!.campaigns.map((campaign) => <div key={campaign.id} className="rounded-xl border border-gold/12 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{campaign.title}</p><p className="text-xs text-champagne/45">{campaign.raised > 0 ? `${money(campaign.raised,campaign.currency)} recorded` : 'No received contributions yet'}</p></div><Badge variant="outline" className={campaign.published ? 'border-sage/40 text-sage-light' : 'border-gold/20 text-champagne/55'}>{campaign.published ? 'Published' : 'Private'}</Badge></div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void toggleCampaign(campaign,{published:!campaign.published})} className="border-gold/20 bg-transparent">{campaign.published ? 'Unpublish' : 'Publish'}</Button><Button size="sm" variant="outline" onClick={() => void toggleCampaign(campaign,{invitationVisible:!campaign.invitationVisible})} className="border-gold/20 bg-transparent">Invitation: {campaign.invitationVisible ? 'On' : 'Off'}</Button><Button size="sm" variant="outline" onClick={() => void toggleCampaign(campaign,{showRaised:!campaign.showRaised})} className="border-gold/20 bg-transparent">Progress: {campaign.showRaised ? 'Shown' : 'Hidden'}</Button></div></div>)}</div>}
    </Card>

    {addOpen && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-2 backdrop-blur-sm sm:items-center" role="presentation"><button aria-label="Close add contribution" className="absolute inset-0" onClick={() => setAddOpen(false)} /><form onSubmit={addContribution} className="relative z-10 max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gold/25 bg-espresso p-4 shadow-2xl sm:p-5" role="dialog" aria-modal="true" aria-label="Add contribution"><div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-[0.16em] text-gold">Add contribution</p><h2 className="mt-1 font-serif text-xl">Record the help, not accounting jargon</h2></div><Button type="button" variant="ghost" size="icon" onClick={() => setAddOpen(false)}><X className="size-4" /></Button></div><div className="mt-5 space-y-5">
      <fieldset><legend className="font-medium">1. Who contributed?</legend><div className="mt-2 grid gap-2 sm:grid-cols-2"><select aria-label="Choose existing contributor" value={form.contributorId} onChange={(e) => setForm((c) => ({...c,contributorId:e.target.value}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">Add someone new</option>{payload?.contributors.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select>{!form.contributorId && <Input required value={form.contributorName} onChange={(e) => setForm((c) => ({...c,contributorName:e.target.value}))} placeholder="Name or organisation" className="border-gold/20 bg-espresso/70" />}{!form.contributorId && <><Input type="email" value={form.email} onChange={(e) => setForm((c) => ({...c,email:e.target.value}))} placeholder="Email (optional)" className="border-gold/20 bg-espresso/70" /><Input value={form.relationship} onChange={(e) => setForm((c) => ({...c,relationship:e.target.value}))} placeholder="Relationship, e.g. Bride's aunt" className="border-gold/20 bg-espresso/70" /></>}</div></fieldset>
      <fieldset><legend className="font-medium">2. What did they contribute?</legend><div className="mt-2 grid gap-2 sm:grid-cols-2"><select value={form.type} onChange={(e) => setForm((c) => ({...c,type:e.target.value,serviceEngagementId:'',budgetItemId:''}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm">{Object.entries(CONTRIBUTION_TYPE_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><Input required value={form.title} onChange={(e) => setForm((c) => ({...c,title:e.target.value}))} placeholder="What did they help with?" className="border-gold/20 bg-espresso/70" />{['CASH_TO_COUPLE','DIRECT_VENDOR_PAYMENT','HONEYMOON_GIFT'].includes(form.type) ? <Input required inputMode="decimal" value={form.amount} onChange={(e) => setForm((c) => ({...c,amount:e.target.value}))} placeholder="Amount" className="border-gold/20 bg-espresso/70" /> : <Input inputMode="decimal" value={form.estimatedValue} onChange={(e) => setForm((c) => ({...c,estimatedValue:e.target.value}))} placeholder="Estimated value (optional)" className="border-gold/20 bg-espresso/70" />}<Input value={form.currency} maxLength={3} onChange={(e) => setForm((c) => ({...c,currency:e.target.value.toUpperCase()}))} placeholder="USD" className="border-gold/20 bg-espresso/70" />{['GOODS_IN_KIND','SERVICE_IN_KIND','TIME_LABOUR'].includes(form.type) && <><Input inputMode="decimal" value={form.quantity} onChange={(e) => setForm((c) => ({...c,quantity:e.target.value}))} placeholder="Quantity (optional)" className="border-gold/20 bg-espresso/70" /><Input value={form.unit} onChange={(e) => setForm((c) => ({...c,unit:e.target.value}))} placeholder="Unit, e.g. crates, hours" className="border-gold/20 bg-espresso/70" /></>}</div></fieldset>
      <fieldset><legend className="font-medium">3. Where is it going?</legend><div className="mt-2 grid gap-2 sm:grid-cols-2"><select value={form.budgetItemId} onChange={(e) => { const item = payload?.options.budgetItems.find((candidate) => candidate.id === e.target.value); setForm((c) => ({...c,budgetItemId:e.target.value,serviceEngagementId:c.serviceEngagementId || item?.serviceEngagementId || ''})) }} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">Not allocated yet</option>{payload?.options.budgetItems.map((item) => <option key={item.id} value={item.id}>{item.description}</option>)}</select>{form.type === 'DIRECT_VENDOR_PAYMENT' && <select required value={form.serviceEngagementId} onChange={(e) => setForm((c) => ({...c,serviceEngagementId:e.target.value}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">Choose vendor service engagement</option>{payload?.options.engagements.map((item) => <option key={item.id} value={item.id}>{item.vendor.name} — {item.serviceCategory}</option>)}</select>}<select value={form.campaignId} onChange={(e) => setForm((c) => ({...c,campaignId:e.target.value}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">No honeymoon/campaign</option>{payload?.campaigns.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div></fieldset>
      <fieldset><legend className="font-medium">4. What is the current state?</legend><div className="mt-2 grid gap-2 sm:grid-cols-2"><select value={form.state} onChange={(e) => setForm((c) => ({...c,state:e.target.value}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="PROMISED">Promised — not received yet</option><option value="RECEIVED">Received / paid / delivered</option></select><Textarea value={form.notes} onChange={(e) => setForm((c) => ({...c,notes:e.target.value}))} placeholder="Optional context or payment reference" className="border-gold/20 bg-espresso/70 sm:col-span-2" /></div></fieldset>
      <div className="rounded-xl border border-gold/15 bg-gold/5 p-3 text-xs leading-5 text-champagne/60">A promise is never counted as received money. Direct vendor payments remain vendor payments with this contribution recorded as the funding source. In-kind values are shown separately from cash.</div><Button type="submit" disabled={saving} className="w-full bg-gold text-espresso hover:bg-gold-light">{saving ? <Loader2 className="size-4 animate-spin" /> : <HandHeart className="size-4" />}Save contribution</Button>
    </div></form></div>}

    {manage && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-2 backdrop-blur-sm sm:items-center" role="presentation"><button aria-label="Close contribution details" className="absolute inset-0" onClick={() => setManage(null)} /><section role="dialog" aria-modal="true" aria-label="Manage contribution" className="relative z-10 max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gold/25 bg-espresso p-4 shadow-2xl sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.16em] text-gold">{manage.contributor.displayName}</p><h2 className="mt-1 font-serif text-xl">{manage.title}</h2><p className="mt-1 text-xs text-champagne/50">{CONTRIBUTION_TYPE_LABELS[manage.type]} · {humanState(manage.fulfillmentState)}</p></div><Button variant="ghost" size="icon" onClick={() => setManage(null)}><X className="size-4" /></Button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><Card className="p-3"><p className="text-[10px] uppercase text-champagne/40">Recorded value</p><p className="mt-1 font-serif text-xl">{manage.amount !== null ? money(manage.amount,manage.currency) : manage.estimatedValue !== null ? `${money(manage.estimatedValue,manage.estimatedValueCurrency || manage.currency)} est.` : 'Not valued'}</p></Card><Card className="p-3"><p className="text-[10px] uppercase text-champagne/40">Still available</p><p className="mt-1 font-serif text-xl">{money(manage.availableAmount,manage.currency)}</p></Card></div>
      {manage.availableAmount > 0 && <div className="mt-4 rounded-xl border border-gold/15 p-3"><h3 className="font-medium">Use some of this money</h3><p className="mt-1 text-xs text-champagne/50">Allocation records where received cash is being used; it does not create a second payment.</p><div className="mt-2 grid gap-2 sm:grid-cols-[1fr_10rem_auto]"><select value={allocation.budgetItemId} onChange={(e) => setAllocation((c) => ({...c,budgetItemId:e.target.value}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">Choose budget item</option>{payload?.options.budgetItems.filter((item) => item.currency === manage.currency).map((item) => <option key={item.id} value={item.id}>{item.description}</option>)}</select><Input inputMode="decimal" value={allocation.amount} onChange={(e) => setAllocation((c) => ({...c,amount:e.target.value}))} placeholder="Amount" className="border-gold/20 bg-espresso/70" /><Button disabled={saving} onClick={() => void doAction('allocate',{budgetItemId:allocation.budgetItemId,amount:Number(allocation.amount),currency:manage.currency})} className="bg-gold text-espresso">Allocate</Button></div></div>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-gold/15 p-3"><h3 className="font-medium">Follow-up task</h3><Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="mt-2 border-gold/20 bg-espresso/70" /><Button size="sm" disabled={saving} onClick={() => void doAction('create-task',{title:taskTitle})} className="mt-2 bg-gold text-espresso"><Plus className="size-3.5" />Create task</Button></div><div className="rounded-xl border border-gold/15 p-3"><h3 className="font-medium">Notebook context</h3><Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Capture a promise, detail or conversation…" className="mt-2 min-h-20 border-gold/20 bg-espresso/70" /><Button size="sm" variant="outline" disabled={saving || !noteText.trim()} onClick={() => void createNotebookNote()} className="mt-2 border-gold/20 bg-transparent"><NotebookPen className="size-3.5" />Save linked note</Button></div></div>
      <div className="mt-4 flex flex-wrap items-center gap-2"><Button variant="outline" disabled={saving || manage.thankYouState === 'SENT'} onClick={() => void doAction('mark-thanked')} className="border-gold/20 bg-transparent"><Sparkles className="size-4" />{manage.thankYouState === 'SENT' ? 'Thank-you sent' : 'Mark thank-you sent'}</Button>{manage.allocations.length > 0 && <span className="text-xs text-champagne/45">Allocated: {manage.allocations.map((item) => `${item.budgetItem.description} ${money(item.amount,item.currency)}`).join(' · ')}</span>}</div>
    </section></div>}
  </div>
}
'''.replace("\\'use client\\'", "'use client'")
write('src/components/wedding/planner/modules/planner-contributions-module.tsx', CONTRIBUTIONS_UI)

# -----------------------------------------------------------------------------
# Planner navigation and workspace integration.
# -----------------------------------------------------------------------------
replace_once(
    'src/lib/planner-route-state.ts',
    "  | 'budget'\n  | 'vendors'",
    "  | 'budget'\n  | 'contributions'\n  | 'vendors'",
)
replace_once(
    'src/lib/planner-route-state.ts',
    "  'budget',\n  'vendors',",
    "  'budget',\n  'contributions',\n  'vendors',",
)
replace_once(
    'src/components/wedding/planner-workspace-stage7.tsx',
    "  worksheetKey?: 'checklist' | 'budget' | 'vendors' | 'guests' | 'timeline' | 'seating'",
    "  worksheetKey?: 'checklist' | 'budget' | 'vendors' | 'guests' | 'timeline' | 'seating'",
)
replace_once(
    'src/components/wedding/planner-workspace-stage7.tsx',
    "  { value: 'budget', label: 'Budget', worksheetKey: 'budget' },\n  { value: 'vendors', label: 'Vendors', worksheetKey: 'vendors' },",
    "  { value: 'budget', label: 'Budget', worksheetKey: 'budget' },\n  { value: 'contributions', label: 'Contributions' },\n  { value: 'vendors', label: 'Vendors', worksheetKey: 'vendors' },",
)
replace_once(
    'src/components/wedding/planner-workspace-stage7.tsx',
    "grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-7",
    "grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-8",
)
replace_once(
    'src/components/wedding/planner-workspace.tsx',
    "  Store,\n  Users,",
    "  Store,\n  HandHeart,\n  Users,",
)
replace_once(
    'src/components/wedding/planner-workspace.tsx',
    "import { PlannerBudgetModule } from '@/components/wedding/planner/modules/planner-budget-module'",
    "import { PlannerBudgetModule } from '@/components/wedding/planner/modules/planner-budget-module'\nimport { PlannerContributionsModule } from '@/components/wedding/planner/modules/planner-contributions-module'",
)
replace_once(
    'src/components/wedding/planner-workspace.tsx',
    "  | 'budget'\n  | 'vendors'",
    "  | 'budget'\n  | 'contributions'\n  | 'vendors'",
)
replace_once(
    'src/components/wedding/planner-workspace.tsx',
    "  { value: 'budget', label: 'Budget', icon: <CircleDollarSign className=\"size-3.5\" /> },\n  { value: 'vendors'",
    "  { value: 'budget', label: 'Budget', icon: <CircleDollarSign className=\"size-3.5\" /> },\n  { value: 'contributions', label: 'Contributions', icon: <HandHeart className=\"size-3.5\" /> },\n  { value: 'vendors'",
)
replace_once(
    'src/components/wedding/planner-workspace.tsx',
    "            {activeTab === 'budget' && <PlannerBudgetModule budget={budget} budgetSummary={budgetSummary} budgetByCategory={budgetByCategory} budgetForm={budgetForm} setBudgetForm={setBudgetForm} vendors={vendors} saving={saving} onAddBudgetItem={addBudgetItem} onUpdateBudgetItem={updateBudgetItem} onDeleteBudgetItem={deleteBudgetItem} />}\n            {activeTab === 'vendors'",
    "            {activeTab === 'budget' && <PlannerBudgetModule budget={budget} budgetSummary={budgetSummary} budgetByCategory={budgetByCategory} budgetForm={budgetForm} setBudgetForm={setBudgetForm} vendors={vendors} saving={saving} onAddBudgetItem={addBudgetItem} onUpdateBudgetItem={updateBudgetItem} onDeleteBudgetItem={deleteBudgetItem} />}\n            {activeTab === 'contributions' && <PlannerContributionsModule />}\n            {activeTab === 'vendors'",
)

# -----------------------------------------------------------------------------
# Phase 3: Budget source-of-funds truth without changing historical paid facts.
# -----------------------------------------------------------------------------
replace_once(
    'src/app/api/planner/budget/route.ts',
    "    const totals = summarize(items)\n\n    return NextResponse.json({\n      success: true,\n      count: items.length,\n      data: items.map(formatItem),\n      ...totals,\n    })",
    "    const totals = summarize(items)\n    const [fundingRows, contributionAllocations] = await Promise.all([\n      db.paymentFundingAllocation.findMany({ where: { weddingId: access.context.weddingId, budgetItemId: { not: null } }, select: { budgetItemId: true, sourceKind: true, amount: true, currency: true } }),\n      db.contributionAllocation.findMany({ where: { weddingId: access.context.weddingId }, select: { budgetItemId: true, allocationKind: true, amount: true, currency: true, contribution: { select: { fulfillmentState: true } } } }),\n    ])\n    const data = items.map((item) => {\n      const sources = fundingRows.filter((row) => row.budgetItemId === item.id && row.currency === item.currency)\n      const coupleFunded = sources.filter((row) => row.sourceKind === 'COUPLE').reduce((sum, row) => sum + Number(row.amount), 0)\n      const contributorFunded = sources.filter((row) => row.sourceKind === 'CONTRIBUTION').reduce((sum, row) => sum + Number(row.amount), 0)\n      const otherAttributed = sources.filter((row) => !['COUPLE', 'CONTRIBUTION', 'LEGACY_UNATTRIBUTED'].includes(row.sourceKind)).reduce((sum, row) => sum + Number(row.amount), 0)\n      const explicitlyLegacy = sources.filter((row) => row.sourceKind === 'LEGACY_UNATTRIBUTED').reduce((sum, row) => sum + Number(row.amount), 0)\n      const attributed = coupleFunded + contributorFunded + otherAttributed + explicitlyLegacy\n      const legacyUnattributed = Math.max(0, item.paidAmount - attributed) + explicitlyLegacy\n      const itemAllocations = contributionAllocations.filter((row) => row.budgetItemId === item.id && row.currency === item.currency)\n      const inKindValue = itemAllocations.filter((row) => row.allocationKind === 'IN_KIND' && ['DELIVERED', 'COMPLETED'].includes(row.contribution.fulfillmentState)).reduce((sum, row) => sum + Number(row.amount), 0)\n      const contributionAllocated = itemAllocations.filter((row) => row.allocationKind === 'CASH').reduce((sum, row) => sum + Number(row.amount), 0)\n      return { ...formatItem(item), funding: { coupleFunded, contributorFunded, legacyUnattributed, otherAttributed, inKindValue, contributionAllocated } }\n    })\n    const fundingSummary = data.reduce((sum, item) => ({ coupleFunded: sum.coupleFunded + item.funding.coupleFunded, contributorFunded: sum.contributorFunded + item.funding.contributorFunded, legacyUnattributed: sum.legacyUnattributed + item.funding.legacyUnattributed, inKindValue: sum.inKindValue + item.funding.inKindValue }), { coupleFunded: 0, contributorFunded: 0, legacyUnattributed: 0, inKindValue: 0 })\n\n    return NextResponse.json({ success: true, count: items.length, data, ...totals, fundingSummary })",
)
replace_once(
    'src/components/wedding/planner-workspace.tsx',
    "  dueDate: string | null\n}",
    "  dueDate: string | null\n  funding?: { coupleFunded: number; contributorFunded: number; legacyUnattributed: number; otherAttributed: number; inKindValue: number; contributionAllocated: number }\n}",
)
replace_once(
    'src/components/wedding/planner/modules/planner-budget-module.tsx',
    "  dueDate: string | null\n}",
    "  dueDate: string | null\n  funding?: { coupleFunded: number; contributorFunded: number; legacyUnattributed: number; otherAttributed: number; inKindValue: number; contributionAllocated: number }\n}",
)
replace_once(
    'src/components/wedding/planner/modules/planner-budget-module.tsx',
    "{item.notes && <p className=\"mt-1 font-sans text-xs text-champagne/55\">{item.notes}</p>}</div><div><Label",
    "{item.notes && <p className=\"mt-1 font-sans text-xs text-champagne/55\">{item.notes}</p>}{item.funding && (item.funding.coupleFunded > 0 || item.funding.contributorFunded > 0 || item.funding.legacyUnattributed > 0 || item.funding.inKindValue > 0 || item.funding.contributionAllocated > 0) && <div className=\"mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-champagne/50\"><span className=\"font-medium text-gold/80\">Paid by:</span>{item.funding.coupleFunded > 0 && <span>Couple {money(item.funding.coupleFunded,item.currency)}</span>}{item.funding.contributorFunded > 0 && <span>Contributors {money(item.funding.contributorFunded,item.currency)}</span>}{item.funding.legacyUnattributed > 0 && <span className=\"text-clay-light\">Source not recorded {money(item.funding.legacyUnattributed,item.currency)}</span>}{item.funding.contributionAllocated > 0 && <span>Contribution money set aside {money(item.funding.contributionAllocated,item.currency)}</span>}{item.funding.inKindValue > 0 && <span>In-kind {money(item.funding.inKindValue,item.currency)} est.</span>}</div>}</div><div><Label",
)

# -----------------------------------------------------------------------------
# Phase 5: use canonical published campaigns on the wedding site when present.
# -----------------------------------------------------------------------------
replace_once(
    'src/components/wedding/gift-registry.tsx',
    "import { useRef } from 'react';",
    "import { useEffect, useRef, useState } from 'react';",
)
replace_once(
    'src/components/wedding/gift-registry.tsx',
    "export function GiftRegistry() {\n  const sectionRef = useRef(null);",
    "export function GiftRegistry() {\n  const sectionRef = useRef(null);\n  const [campaignCards, setCampaignCards] = useState<RegistryCard[] | null>(null);",
)
replace_once(
    'src/components/wedding/gift-registry.tsx',
    "  const wedding = ctx?.wedding;\n  const rows = ctx?.getOrdered('registry', 'card-') ?? [];\n  const cards = rows.length > 0 ? rows.map((row, index) => cardFromContent(row.value, row.metadata, index)) : STARTER_CARDS;",
    "  const wedding = ctx?.wedding;\n  const rows = ctx?.getOrdered('registry', 'card-') ?? [];\n  useEffect(() => {\n    if (!wedding?.slug) return;\n    let cancelled = false;\n    fetch(`/api/contribution-campaigns/public?weddingSlug=${encodeURIComponent(wedding.slug)}`, { cache: 'no-store' })\n      .then((response) => response.json())\n      .then((payload) => {\n        if (cancelled || !Array.isArray(payload.data) || payload.data.length === 0) { if (!cancelled) setCampaignCards(null); return; }\n        setCampaignCards(payload.data.map((campaign: any, index: number): RegistryCard => {\n          const target = typeof campaign.targetAmount === 'number' ? campaign.targetAmount : undefined;\n          const raised = typeof campaign.raised === 'number' ? campaign.raised : 0;\n          return { icon: campaign.type === 'CHARITY' ? 'heart' : campaign.type === 'HOME' ? 'gift' : 'plane', title: campaign.title, description: campaign.description || campaign.publicNote || 'Optional gifting information from the couple.', accent: index % 3 === 1 ? 'clay' : index % 3 === 2 ? 'sage' : 'gold', cta: campaign.ctaLabel || 'Gift details', meta: { label: campaign.showRaised ? 'With gratitude' : 'Optional', raised, goal: target, progress: target && campaign.showRaised ? Math.min(100, Math.round((raised / target) * 100)) : undefined, detail: campaign.publicNote || undefined }, href: campaign.externalUrl || '#rsvp' };\n        }));\n      })\n      .catch(() => { if (!cancelled) setCampaignCards(null); });\n    return () => { cancelled = true; };\n  }, [wedding?.slug]);\n  const contentCards = rows.length > 0 ? rows.map((row, index) => cardFromContent(row.value, row.metadata, index)) : STARTER_CARDS;\n  const cards = campaignCards ?? contentCards;",
)

# -----------------------------------------------------------------------------
# Tests and permanent fail-closed CI.
# -----------------------------------------------------------------------------
TESTS = r'''import { describe, expect, test } from 'bun:test'
import { contributionAvailableAmount, summarizeContributions, validateContributionShape } from './contributions'

describe('Contributions financial truth', () => {
  test('a pledge is not received cash', () => {
    const summary = summarizeContributions([{ type: 'CASH_TO_COUPLE', amount: 1000, currency: 'USD', estimatedValue: null, estimatedValueCurrency: null, commitmentState: 'PLEDGED', fulfillmentState: 'PENDING', allocatedAmount: 0 }])
    expect(summary[0].pledged).toBe(1000)
    expect(summary[0].cashReceived).toBe(0)
    expect(summary[0].availableCash).toBe(0)
  })

  test('direct vendor payments are not available cash', () => {
    const summary = summarizeContributions([{ type: 'DIRECT_VENDOR_PAYMENT', amount: 600, currency: 'USD', estimatedValue: null, estimatedValueCurrency: null, commitmentState: 'NOT_APPLICABLE', fulfillmentState: 'PAID_DIRECT', allocatedAmount: 0 }])
    expect(summary[0].directVendorPaid).toBe(600)
    expect(summary[0].cashReceived).toBe(0)
    expect(summary[0].availableCash).toBe(0)
  })

  test('received cash subtracts allocations only once', () => {
    expect(contributionAvailableAmount({ type: 'CASH_TO_COUPLE', amount: 2000, fulfillmentState: 'RECEIVED', allocatedAmount: 1500 })).toBe(500)
  })

  test('in-kind is reported separately from cash', () => {
    const summary = summarizeContributions([{ type: 'GOODS_IN_KIND', amount: null, currency: 'USD', estimatedValue: 480, estimatedValueCurrency: 'USD', commitmentState: 'NOT_APPLICABLE', fulfillmentState: 'DELIVERED', allocatedAmount: 0 }])
    expect(summary[0].inKindValue).toBe(480)
    expect(summary[0].cashReceived).toBe(0)
    expect(summary[0].directVendorPaid).toBe(0)
  })

  test('currencies remain separate', () => {
    const summary = summarizeContributions([
      { type: 'CASH_TO_COUPLE', amount: 100, currency: 'USD', estimatedValue: null, estimatedValueCurrency: null, commitmentState: 'NOT_APPLICABLE', fulfillmentState: 'RECEIVED', allocatedAmount: 0 },
      { type: 'CASH_TO_COUPLE', amount: 1000, currency: 'ZAR', estimatedValue: null, estimatedValueCurrency: null, commitmentState: 'NOT_APPLICABLE', fulfillmentState: 'RECEIVED', allocatedAmount: 0 },
    ])
    expect(summary).toHaveLength(2)
    expect(summary.find((item) => item.currency === 'USD')?.cashReceived).toBe(100)
    expect(summary.find((item) => item.currency === 'ZAR')?.cashReceived).toBe(1000)
  })

  test('cash requires a positive amount', () => {
    expect(validateContributionShape({ type: 'CASH_TO_COUPLE', title: 'Family help', amount: 0 })).toContain('amount')
  })
})
'''
write('src/lib/contributions.test.ts', TESTS)

SOURCE_TEST = r'''import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

describe('Contributions canonical source contract', () => {
  test('financial contributions do not repurpose GuestContribution', () => {
    const schema = read('prisma/schema.prisma')
    expect(schema).toContain('model WeddingContribution')
    expect(schema).toContain('model Contributor')
    expect(schema).toContain('model PaymentFundingAllocation')
    expect(schema).toContain('guestContributions      GuestContribution[]')
  })

  test('planner has a first-class responsive Contributions module', () => {
    expect(read('src/lib/planner-route-state.ts')).toContain("| 'contributions'")
    const workspace = read('src/components/wedding/planner/modules/planner-contributions-module.tsx')
    expect(workspace).toContain('Record the help, not accounting jargon')
    expect(workspace).toContain('md:hidden')
    expect(workspace).toContain('hidden overflow-x-auto md:block')
  })

  test('legacy paid amounts remain explicitly unattributed until classified', () => {
    const budget = read('src/app/api/planner/budget/route.ts')
    expect(budget).toContain('legacyUnattributed')
    expect(budget).toContain('Math.max(0, item.paidAmount - attributed)')
    expect(budget).not.toContain("sourceKind: 'COUPLE', amount: item.paidAmount")
  })

  test('public gifting reads canonical campaigns without exposing contributor identities', () => {
    const registry = read('src/components/wedding/gift-registry.tsx')
    const publicRoute = read('src/app/api/contribution-campaigns/public/route.ts')
    expect(registry).toContain('/api/contribution-campaigns/public')
    expect(publicRoute).not.toContain('contributor:')
    expect(publicRoute).toContain('invitationVisible')
  })

  test('Notebook uses the existing add-link action graph', () => {
    const workspace = read('src/components/wedding/planner/modules/planner-contributions-module.tsx')
    expect(workspace).toContain("action: 'add-link'")
    expect(workspace).toContain("entityType: 'WeddingContribution'")
  })
})
'''
write('src/lib/contributions-source-contract.test.ts', SOURCE_TEST)

PERMANENT_CI = r'''name: Contributions Resource Accounting

on:
  pull_request:
    paths:
      - 'prisma/schema.prisma'
      - 'prisma/migrations/**contributions**/**'
      - 'src/lib/contributions*'
      - 'src/app/api/planner/contributions/**'
      - 'src/app/api/planner/contribution-campaigns/**'
      - 'src/app/api/contribution-campaigns/**'
      - 'src/app/api/admin/contributions/**'
      - 'src/components/wedding/planner/**'
      - 'src/components/wedding/gift-registry.tsx'
      - 'src/lib/planner-route-state.ts'
      - 'docs/WEWED_CONTRIBUTIONS_RESOURCE_ACCOUNTING_PLAN.md'
      - 'agent-ctx/CONTRIBUTIONS-RESOURCE-ACCOUNTING-CANON.md'
      - '.github/workflows/contributions-resource-accounting.yml'
  workflow_dispatch:

jobs:
  qualify:
    runs-on: ubuntu-latest
    timeout-minutes: 35
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: wewed
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      CI: 'true'
      WEWED_E2E_MODE: '1'
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/wewed?schema=public
      DIRECT_URL: postgresql://postgres:postgres@localhost:5432/wewed?schema=public
      NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-anon-key
      SUPABASE_SERVICE_ROLE_KEY: ci-service-role-key
      WEWED_SESSION_SECRET: ci-session-secret-not-for-production
      NEXT_PUBLIC_SITE_URL: http://localhost:3000
      NEXT_TELEMETRY_DISABLED: 1
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6
        with:
          bun-version: 1.3.14
      - run: bun install --frozen-lockfile
      - run: bunx prisma validate --schema prisma/schema.prisma
      - run: bunx prisma generate --schema prisma/schema.prisma
      - run: bunx prisma migrate deploy --schema prisma/schema.prisma
      - run: bunx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
      - run: bun test src/lib/contributions.test.ts src/lib/contributions-source-contract.test.ts
      - run: bun run build
'''
write('.github/workflows/contributions-resource-accounting.yml', PERMANENT_CI)

print('Contributions phases 1-7 source implementation generated.')
