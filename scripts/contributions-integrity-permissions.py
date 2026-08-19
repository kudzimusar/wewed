from pathlib import Path

ROOT = Path('.')


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))


# Canonical lifecycle/state validators prevent DB-constraint failures from becoming generic 500s.
domain = 'src/lib/contributions.ts'
replace_once(
    domain,
    "export function normalizeContributionCampaignType(value: unknown): ContributionCampaignType | null {\n  const candidate = typeof value === 'string' ? value.trim().toUpperCase() : ''\n  return CONTRIBUTION_CAMPAIGN_TYPES.includes(candidate as ContributionCampaignType)\n    ? (candidate as ContributionCampaignType)\n    : null\n}\n",
    """export function normalizeContributionCampaignType(value: unknown): ContributionCampaignType | null {\n  const candidate = typeof value === 'string' ? value.trim().toUpperCase() : ''\n  return CONTRIBUTION_CAMPAIGN_TYPES.includes(candidate as ContributionCampaignType)\n    ? (candidate as ContributionCampaignType)\n    : null\n}\n\nexport const CONTRIBUTION_COMMITMENT_STATES = ['PLEDGED','CONFIRMED','CANCELLED','NOT_APPLICABLE'] as const\nexport const CONTRIBUTION_FULFILLMENT_STATES = ['PENDING','PARTIALLY_RECEIVED','RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED','FAILED_OR_CANCELLED'] as const\nexport const CONTRIBUTION_VERIFICATION_STATES = ['UNVERIFIED','CONFIRMED_BY_USER','EVIDENCE_ATTACHED','RECONCILED'] as const\nexport const CONTRIBUTION_THANK_YOU_STATES = ['NOT_DUE','TO_THANK','PREPARED','SENT','ACKNOWLEDGED_OTHER','NOT_REQUIRED'] as const\n\nexport function isCurrencyCode(value: unknown): boolean {\n  return typeof value === 'string' && /^[A-Za-z]{3}$/.test(value.trim())\n}\n\nfunction includesState(values: readonly string[], value: unknown): boolean {\n  return typeof value === 'string' && values.includes(value)\n}\n\nexport function validContributionCommitmentState(value: unknown): boolean { return includesState(CONTRIBUTION_COMMITMENT_STATES, value) }\nexport function validContributionFulfillmentState(value: unknown): boolean { return includesState(CONTRIBUTION_FULFILLMENT_STATES, value) }\nexport function validContributionVerificationState(value: unknown): boolean { return includesState(CONTRIBUTION_VERIFICATION_STATES, value) }\nexport function validContributionThankYouState(value: unknown): boolean { return includesState(CONTRIBUTION_THANK_YOU_STATES, value) }\n""",
)

# Planner contribution POST: app-level lifecycle validation, currency validation, campaign currency parity, permission hints in GET.
route = 'src/app/api/planner/contributions/route.ts'
replace_once(
    route,
    "import { contributionDatabaseUnavailable, contributionAvailableAmount, finiteNonNegative, normalizeCurrency, validateContributionInput } from '@/lib/contributions'",
    "import { contributionDatabaseUnavailable, contributionAvailableAmount, finiteNonNegative, isCurrencyCode, normalizeCurrency, validContributionCommitmentState, validContributionFulfillmentState, validContributionThankYouState, validContributionVerificationState, validateContributionInput } from '@/lib/contributions'",
)
replace_once(
    route,
    "import { requireWeddingPermission } from '@/lib/wedding-access'",
    "import { contextHasPermission, requireWeddingPermission } from '@/lib/wedding-access'",
)
replace_once(
    route,
    "return NextResponse.json({ success: true, weddingId, ...workspace, options: { budgetItems, vendors, engagements, guests } })",
    "return NextResponse.json({ success: true, weddingId, ...workspace, permissions: { canEdit: contextHasPermission(access.context, 'budget.edit'), canCreateTasks: contextHasPermission(access.context, 'planner.edit') }, options: { budgetItems, vendors, engagements, guests } })",
)
replace_once(
    route,
    "    const type = String(body.type)\n    const currency = normalizeCurrency(body.currency)",
    """    const type = String(body.type)\n    if (body.currency !== undefined && !isCurrencyCode(body.currency)) return NextResponse.json({ success: false, error: 'Use a three-letter currency code such as USD.' }, { status: 400 })\n    const currency = normalizeCurrency(body.currency)""",
)
replace_once(
    route,
    "    const commitmentState = String(body.commitmentState ?? 'NOT_APPLICABLE')\n    const fulfillmentState = String(body.fulfillmentState ?? 'PENDING')",
    """    const commitmentState = String(body.commitmentState ?? 'NOT_APPLICABLE')\n    const fulfillmentState = String(body.fulfillmentState ?? 'PENDING')\n    const requestedVerificationState = String(body.verificationState ?? 'UNVERIFIED')\n    const requestedThankYouState = String(body.thankYouState ?? (['RECEIVED', 'DELIVERED', 'PAID_DIRECT', 'COMPLETED'].includes(fulfillmentState) ? 'TO_THANK' : 'NOT_DUE'))\n    if (!validContributionCommitmentState(commitmentState) || !validContributionFulfillmentState(fulfillmentState) || !validContributionVerificationState(requestedVerificationState) || !validContributionThankYouState(requestedThankYouState)) {\n      return NextResponse.json({ success: false, error: 'Choose valid contribution lifecycle states.' }, { status: 400 })\n    }""",
)
replace_once(
    route,
    "        if (!rows[0]) throw new Error('CAMPAIGN_SCOPE')\n      }",
    "        if (!rows[0]) throw new Error('CAMPAIGN_SCOPE')\n        if (rows[0].currency !== currency) throw new Error('CAMPAIGN_CURRENCY_MISMATCH')\n      }",
)
replace_once(
    route,
    "      const thankYouState = String(body.thankYouState ?? (fulfilled ? 'TO_THANK' : 'NOT_DUE'))\n      const verificationState = String(body.verificationState ?? 'UNVERIFIED')",
    "      const thankYouState = requestedThankYouState\n      const verificationState = requestedVerificationState",
)
replace_once(
    route,
    "      CAMPAIGN_SCOPE: 'That campaign does not belong to this wedding.',",
    "      CAMPAIGN_SCOPE: 'That campaign does not belong to this wedding.',\n      CAMPAIGN_CURRENCY_MISMATCH: 'The contribution currency must match the campaign currency. Record a separate campaign for another currency.',",
)

# Contribution detail edits: validate state/currency input and preserve campaign currency integrity.
detail = 'src/app/api/planner/contributions/[id]/route.ts'
replace_once(
    detail,
    "import { contributionDatabaseUnavailable, finiteNonNegative, normalizeCurrency } from '@/lib/contributions'",
    "import { contributionDatabaseUnavailable, finiteNonNegative, isCurrencyCode, normalizeCurrency, validContributionCommitmentState, validContributionFulfillmentState, validContributionThankYouState, validContributionVerificationState } from '@/lib/contributions'",
)
replace_once(
    detail,
    "    const title = typeof body.title === 'string' ? body.title.trim() : null",
    """    if (body.commitmentState !== undefined && !validContributionCommitmentState(body.commitmentState)) return NextResponse.json({ success: false, error: 'Choose a valid commitment state.' }, { status: 400 })\n    if (body.fulfillmentState !== undefined && !validContributionFulfillmentState(body.fulfillmentState)) return NextResponse.json({ success: false, error: 'Choose a valid fulfillment state.' }, { status: 400 })\n    if (body.verificationState !== undefined && !validContributionVerificationState(body.verificationState)) return NextResponse.json({ success: false, error: 'Choose a valid verification state.' }, { status: 400 })\n    if (body.thankYouState !== undefined && !validContributionThankYouState(body.thankYouState)) return NextResponse.json({ success: false, error: 'Choose a valid thank-you state.' }, { status: 400 })\n    if (body.currency !== undefined && !isCurrencyCode(body.currency)) return NextResponse.json({ success: false, error: 'Use a three-letter currency code such as USD.' }, { status: 400 })\n    if (body.amount !== undefined && finiteNonNegative(body.amount) === null) return NextResponse.json({ success: false, error: 'Amount must be zero or more.' }, { status: 400 })\n\n    const title = typeof body.title === 'string' ? body.title.trim() : null""",
)
replace_once(
    detail,
    "    const fulfilledAt = body.fulfilledAt === undefined ? null : body.fulfilledAt ? new Date(String(body.fulfilledAt)) : null\n\n    await db.$executeRaw`",
    """    const fulfilledAt = body.fulfilledAt === undefined ? null : body.fulfilledAt ? new Date(String(body.fulfilledAt)) : null\n    if (fulfilledAt && Number.isNaN(fulfilledAt.getTime())) return NextResponse.json({ success: false, error: 'Use a valid fulfilled date.' }, { status: 400 })\n    if (currency) {\n      const campaignRows = await db.$queryRaw<Array<{ currency: string }>>`\n        SELECT camp.currency FROM wewed_contributions.wedding_contributions c\n        JOIN wewed_contributions.campaigns camp ON camp.id = c.campaign_id\n        WHERE c.id = ${id} AND c.wedding_id = ${weddingId} LIMIT 1\n      `\n      if (campaignRows[0] && campaignRows[0].currency !== currency) return NextResponse.json({ success: false, error: 'Contribution currency must match its campaign currency.' }, { status: 409 })\n    }\n\n    await db.$executeRaw`""",
)

# Campaign edits cannot change currency after contributions exist; malformed currencies do not silently become USD.
campaign_detail = 'src/app/api/planner/contribution-campaigns/[id]/route.ts'
replace_once(
    campaign_detail,
    "import { finiteNonNegative, normalizeCurrency } from '@/lib/contributions'",
    "import { finiteNonNegative, isCurrencyCode, normalizeCurrency } from '@/lib/contributions'",
)
replace_once(
    campaign_detail,
    "const rows = await db.$queryRaw<Array<{ id: string }>>`SELECT id FROM wewed_contributions.campaigns WHERE id = ${id} AND wedding_id = ${weddingId} LIMIT 1`",
    "const rows = await db.$queryRaw<Array<{ id: string; currency: string }>>`SELECT id, currency FROM wewed_contributions.campaigns WHERE id = ${id} AND wedding_id = ${weddingId} LIMIT 1`",
)
replace_once(
    campaign_detail,
    "    const targetAmount = body.targetAmount === undefined ? null : finiteNonNegative(body.targetAmount)\n    const currency = body.currency === undefined ? null : normalizeCurrency(body.currency)",
    """    const targetAmount = body.targetAmount === undefined ? null : finiteNonNegative(body.targetAmount)\n    if (body.targetAmount !== undefined && body.targetAmount !== null && body.targetAmount !== '' && targetAmount === null) return NextResponse.json({ success: false, error: 'Target amount must be zero or more.' }, { status: 400 })\n    if (body.currency !== undefined && !isCurrencyCode(body.currency)) return NextResponse.json({ success: false, error: 'Use a three-letter currency code such as USD.' }, { status: 400 })\n    const currency = body.currency === undefined ? null : normalizeCurrency(body.currency)\n    if (currency && currency !== rows[0].currency) {\n      const attached = await db.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM wewed_contributions.wedding_contributions WHERE wedding_id = ${weddingId} AND campaign_id = ${id}`\n      if (Number(attached[0]?.count ?? 0) > 0) return NextResponse.json({ success: false, error: 'Campaign currency cannot change after contributions are recorded. Create a separate campaign for another currency.' }, { status: 409 })\n    }""",
)

# Campaign POST rejects malformed currency instead of normalizing it silently.
campaign_post = 'src/app/api/planner/contribution-campaigns/route.ts'
replace_once(
    campaign_post,
    "import { finiteNonNegative, normalizeContributionCampaignType, normalizeCurrency } from '@/lib/contributions'",
    "import { finiteNonNegative, isCurrencyCode, normalizeContributionCampaignType, normalizeCurrency } from '@/lib/contributions'",
)
replace_once(
    campaign_post,
    "    const id = contributionId()\n    const currency = normalizeCurrency(body.currency)",
    """    if (body.currency !== undefined && !isCurrencyCode(body.currency)) return NextResponse.json({ success: false, error: 'Use a three-letter currency code such as USD.' }, { status: 400 })\n    const id = contributionId()\n    const currency = normalizeCurrency(body.currency)""",
)

# Permission-aware Planner UI: viewers retain read access but mutation affordances follow real permissions.
ui = 'src/components/wedding/planner/planner-contributions-workspace.tsx'
replace_once(
    ui,
    "interface WorkspacePayload { success: boolean; weddingId: string; data: Contribution[]; contributors: Contributor[]; campaigns: Campaign[]; summaryByCurrency: CurrencySummary[]; counts: { contributors: number; pledged: number; toThank: number }; options:",
    "interface WorkspacePayload { success: boolean; weddingId: string; data: Contribution[]; contributors: Contributor[]; campaigns: Campaign[]; summaryByCurrency: CurrencySummary[]; counts: { contributors: number; pledged: number; toThank: number }; permissions: { canEdit: boolean; canCreateTasks: boolean }; options:",
)
replace_once(
    ui,
    "  const filtered = useMemo(() => {",
    "  const canEdit = workspace?.permissions?.canEdit === true\n  const canCreateTasks = workspace?.permissions?.canCreateTasks === true\n\n  const filtered = useMemo(() => {",
)
# Two Add buttons exist after embedded alignment; both become permission-aware.
text = read(ui)
add_button = '<Button size="sm" onClick={() => setAddOpen(true)} className="bg-gold text-espresso hover:bg-gold-light"><Plus className="size-4" />Add</Button>'
if text.count(add_button) != 2:
    raise SystemExit(f'{ui}: expected 2 Add buttons, found {text.count(add_button)}')
text = text.replace(add_button, '{canEdit && <Button size="sm" onClick={() => setAddOpen(true)} className="bg-gold text-espresso hover:bg-gold-light"><Plus className="size-4" />Add</Button>}', 2)
write(ui, text)
replace_once(
    ui,
    "{funding.some((item) => item.unattributed > 0) && <Panel",
    "{canEdit && funding.some((item) => item.unattributed > 0) && <Panel",
)
replace_once(
    ui,
    "<Button size=\"sm\" variant=\"outline\" onClick={() => void patchCampaign(campaign,{published:!campaign.published})}",
    "<Button size=\"sm\" variant=\"outline\" disabled={!canEdit} onClick={() => void patchCampaign(campaign,{published:!campaign.published})}",
)
replace_once(
    ui,
    "<Button size=\"sm\" variant=\"outline\" onClick={() => void patchCampaign(campaign,{invitationVisible:!campaign.invitationVisible})}",
    "<Button size=\"sm\" variant=\"outline\" disabled={!canEdit} onClick={() => void patchCampaign(campaign,{invitationVisible:!campaign.invitationVisible})}",
)
replace_once(
    ui,
    "<Button size=\"sm\" variant=\"outline\" onClick={() => void patchCampaign(campaign,{showRaised:!campaign.showRaised})}",
    "<Button size=\"sm\" variant=\"outline\" disabled={!canEdit} onClick={() => void patchCampaign(campaign,{showRaised:!campaign.showRaised})}",
)
replace_once(
    ui,
    "<Button size=\"sm\" variant=\"outline\" onClick={() => void patchCampaign(campaign,{showTarget:!campaign.showTarget})}",
    "<Button size=\"sm\" variant=\"outline\" disabled={!canEdit} onClick={() => void patchCampaign(campaign,{showTarget:!campaign.showTarget})}",
)
replace_once(
    ui,
    "<Button disabled={saving} className=\"bg-gold text-espresso sm:col-span-2\">Create private campaign</Button>",
    "<Button disabled={saving || !canEdit} className=\"bg-gold text-espresso sm:col-span-2\">Create private campaign</Button>",
)
replace_once(
    ui,
    "manage.commitmentState === 'PLEDGED' && manage.fulfillmentState === 'PENDING'",
    "canEdit && manage.commitmentState === 'PLEDGED' && manage.fulfillmentState === 'PENDING'",
)
replace_once(
    ui,
    "{manage.availableAmount > 0 && <div",
    "{canEdit && manage.availableAmount > 0 && <div",
)
replace_once(
    ui,
    "<Button size=\"sm\" disabled={saving} onClick={() => void contributionAction('create-task',{title:taskTitle})}",
    "<Button size=\"sm\" disabled={saving || !canCreateTasks} onClick={() => void contributionAction('create-task',{title:taskTitle})}",
)
replace_once(
    ui,
    "{['RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED'].includes(manage.fulfillmentState) && !['CONFIRMED_BY_USER','RECONCILED'].includes(manage.verificationState)",
    "{canEdit && ['RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED'].includes(manage.fulfillmentState) && !['CONFIRMED_BY_USER','RECONCILED'].includes(manage.verificationState)",
)
replace_once(
    ui,
    "<Button variant=\"outline\" disabled={saving || manage.thankYouState === 'SENT'} onClick={() => void contributionAction('mark-thanked')}",
    "<Button variant=\"outline\" disabled={saving || !canEdit || manage.thankYouState === 'SENT'} onClick={() => void contributionAction('mark-thanked')}",
)

# Add explicit source-contract coverage for the integrity/permission layer.
contract = 'src/lib/contributions-source-contract.test.ts'
insert = """\n  test('Campaign currency and contribution lifecycle input fail closed before database constraints', () => {\n    const domain = read('src/lib/contributions.ts')\n    const route = read('src/app/api/planner/contributions/route.ts')\n    const detail = read('src/app/api/planner/contributions/[id]/route.ts')\n    const campaign = read('src/app/api/planner/contribution-campaigns/[id]/route.ts')\n    expect(domain).toContain('validContributionFulfillmentState')\n    expect(route).toContain('CAMPAIGN_CURRENCY_MISMATCH')\n    expect(detail).toContain('Contribution currency must match its campaign currency.')\n    expect(campaign).toContain('Campaign currency cannot change after contributions are recorded.')\n  })\n\n  test('Planner contribution controls respect read versus edit permissions', () => {\n    const route = read('src/app/api/planner/contributions/route.ts')\n    const ui = read('src/components/wedding/planner/planner-contributions-workspace.tsx')\n    expect(route).toContain("canEdit: contextHasPermission(access.context, 'budget.edit')")\n    expect(route).toContain("canCreateTasks: contextHasPermission(access.context, 'planner.edit')")\n    expect(ui).toContain('const canEdit = workspace?.permissions?.canEdit === true')\n    expect(ui).toContain('disabled={saving || !canCreateTasks}')\n  })\n"""
text = read(contract)
needle = "\n  test('public campaign endpoint never selects contributor identity', () => {"
if text.count(needle) != 1:
    raise SystemExit('source contract integrity insertion point not unique')
write(contract, text.replace(needle, insert + needle, 1))

print('Contributions currency, lifecycle validation and permission hardening applied.')
