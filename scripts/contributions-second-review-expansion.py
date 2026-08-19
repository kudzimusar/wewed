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


# Canonical campaign taxonomy: public gifting can represent more than a honeymoon.
replace_once(
    'src/lib/contributions.ts',
    "export type ContributionType = (typeof CONTRIBUTION_TYPES)[number]\n",
    """export type ContributionType = (typeof CONTRIBUTION_TYPES)[number]\n\nexport const CONTRIBUTION_CAMPAIGN_TYPES = [\n  'HONEYMOON',\n  'HOME',\n  'WEDDING_SUPPORT',\n  'CHARITY',\n  'ITEM_EXPERIENCE',\n] as const\n\nexport type ContributionCampaignType = (typeof CONTRIBUTION_CAMPAIGN_TYPES)[number]\n\nexport const CONTRIBUTION_CAMPAIGN_TYPE_LABELS: Record<ContributionCampaignType, string> = {\n  HONEYMOON: 'Honeymoon or travel',\n  HOME: 'Home or future plans',\n  WEDDING_SUPPORT: 'Wedding support',\n  CHARITY: 'Charity or cause',\n  ITEM_EXPERIENCE: 'Gift or experience',\n}\n\nexport function normalizeContributionCampaignType(value: unknown): ContributionCampaignType | null {\n  const candidate = typeof value === 'string' ? value.trim().toUpperCase() : ''\n  return CONTRIBUTION_CAMPAIGN_TYPES.includes(candidate as ContributionCampaignType)\n    ? (candidate as ContributionCampaignType)\n    : null\n}\n""",
)

# Campaign POST validates the governed taxonomy rather than accepting arbitrary strings.
campaign_route = 'src/app/api/planner/contribution-campaigns/route.ts'
replace_once(
    campaign_route,
    "import { finiteNonNegative, normalizeCurrency } from '@/lib/contributions'",
    "import { finiteNonNegative, normalizeContributionCampaignType, normalizeCurrency } from '@/lib/contributions'",
)
replace_once(
    campaign_route,
    "    const title = String(body.title ?? '').trim()\n    if (!title) return NextResponse.json({ success: false, error: 'Campaign title is required.' }, { status: 400 })",
    """    const title = String(body.title ?? '').trim()\n    if (!title) return NextResponse.json({ success: false, error: 'Campaign title is required.' }, { status: 400 })\n    const type = normalizeContributionCampaignType(body.type ?? 'HONEYMOON')\n    if (!type) return NextResponse.json({ success: false, error: 'Choose a valid contribution campaign type.' }, { status: 400 })""",
)
replace_once(
    campaign_route,
    "(${id}, ${weddingId}, ${String(body.type ?? 'HONEYMOON')}, ${title}",
    "(${id}, ${weddingId}, ${type}, ${title}",
)

# Contributor storage returns and records the full private profile that the schema already supports.
store = 'src/lib/contributions/store.ts'
replace_once(
    store,
    "  phone: string | null\n  publicRecognition: boolean",
    "  phone: string | null\n  address: string | null\n  preferredContactMethod: string | null\n  notes: string | null\n  publicRecognition: boolean",
)
replace_once(
    store,
    "           email,\n           phone,\n           public_recognition AS \"publicRecognition\",",
    "           email,\n           phone,\n           address,\n           preferred_contact_method AS \"preferredContactMethod\",\n           notes,\n           public_recognition AS \"publicRecognition\",",
)

contribution_route = 'src/app/api/planner/contributions/route.ts'
replace_once(
    contribution_route,
    """        await tx.$executeRaw`\n          INSERT INTO wewed_contributions.contributors\n            (id, wedding_id, display_name, legal_name, kind, relationship, email, phone, guest_id)\n          VALUES\n            (${contributorIdValue}, ${weddingId}, ${displayName}, ${String(body.contributor?.legalName ?? '').trim() || null}, ${String(body.contributor?.kind ?? 'individual')}, ${String(body.contributor?.relationship ?? '').trim() || null}, ${String(body.contributor?.email ?? '').trim().toLowerCase() || null}, ${String(body.contributor?.phone ?? '').trim() || null}, ${guestId})\n        `""",
    """        const contributorKindRaw = String(body.contributor?.kind ?? 'individual').trim().toLowerCase()\n        const contributorKind = ['individual', 'family', 'organisation'].includes(contributorKindRaw) ? contributorKindRaw : 'individual'\n        const preferredContactRaw = String(body.contributor?.preferredContactMethod ?? '').trim().toLowerCase()\n        const preferredContactMethod = ['email', 'phone', 'other'].includes(preferredContactRaw) ? preferredContactRaw : null\n        await tx.$executeRaw`\n          INSERT INTO wewed_contributions.contributors\n            (id, wedding_id, display_name, legal_name, kind, relationship, email, phone, address, preferred_contact_method, public_recognition, anonymous_public, notes, guest_id)\n          VALUES\n            (${contributorIdValue}, ${weddingId}, ${displayName}, ${String(body.contributor?.legalName ?? '').trim() || null}, ${contributorKind}, ${String(body.contributor?.relationship ?? '').trim() || null}, ${String(body.contributor?.email ?? '').trim().toLowerCase() || null}, ${String(body.contributor?.phone ?? '').trim() || null}, ${String(body.contributor?.address ?? '').trim() || null}, ${preferredContactMethod}, ${body.contributor?.publicRecognition === true}, ${body.contributor?.anonymousPublic === true}, ${String(body.contributor?.notes ?? '').trim() || null}, ${guestId})\n        `""",
)

# The Overview summary remains intentionally lightweight: no full ledger/task/campaign load every 30 seconds.
write(
    'src/app/api/planner/contributions/summary/route.ts',
    """import { NextRequest, NextResponse } from 'next/server'\nimport { db } from '@/lib/db'\nimport { summarizeContributions } from '@/lib/contributions'\nimport { requireWeddingPermission } from '@/lib/wedding-access'\n\ninterface SummaryRow {\n  type: string\n  amount: number | null\n  currency: string\n  estimatedValue: number | null\n  estimatedValueCurrency: string | null\n  commitmentState: string\n  fulfillmentState: string\n  allocatedAmount: number\n}\n\nexport async function GET(request: NextRequest) {\n  const access = await requireWeddingPermission(request, 'budget.view')\n  if (access.error) return access.error\n  const weddingId = access.context.weddingId\n  try {\n    const [rows, counts] = await Promise.all([\n      db.$queryRaw<SummaryRow[]>`\n        SELECT c.type, c.amount::float8 AS amount, c.currency,\n               c.estimated_value::float8 AS \"estimatedValue\",\n               c.estimated_value_currency AS \"estimatedValueCurrency\",\n               c.commitment_state AS \"commitmentState\",\n               c.fulfillment_state AS \"fulfillmentState\",\n               COALESCE(SUM(a.amount) FILTER (WHERE a.allocation_kind = 'CASH'), 0)::float8 AS \"allocatedAmount\"\n          FROM wewed_contributions.wedding_contributions c\n          LEFT JOIN wewed_contributions.contribution_allocations a\n            ON a.contribution_id = c.id AND a.wedding_id = c.wedding_id\n         WHERE c.wedding_id = ${weddingId}\n         GROUP BY c.id\n      `,\n      db.$queryRaw<Array<{ contributors: bigint; pledged: bigint; toThank: bigint }>>`\n        SELECT\n          (SELECT COUNT(*) FROM wewed_contributions.contributors WHERE wedding_id = ${weddingId}) AS contributors,\n          (SELECT COUNT(*) FROM wewed_contributions.wedding_contributions\n            WHERE wedding_id = ${weddingId}\n              AND commitment_state = 'PLEDGED'\n              AND fulfillment_state NOT IN ('RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED')) AS pledged,\n          (SELECT COUNT(*) FROM wewed_contributions.wedding_contributions\n            WHERE wedding_id = ${weddingId}\n              AND thank_you_state IN ('TO_THANK','PREPARED')) AS \"toThank\"\n      `,\n    ])\n    return NextResponse.json({\n      success: true,\n      summaryByCurrency: summarizeContributions(rows),\n      counts: {\n        contributors: Number(counts[0]?.contributors ?? 0),\n        pledged: Number(counts[0]?.pledged ?? 0),\n        toThank: Number(counts[0]?.toThank ?? 0),\n      },\n    })\n  } catch (error) {\n    console.error('[CONTRIBUTION SUMMARY GET] error', error)\n    return NextResponse.json({ success: false, error: 'Could not load contribution summary.' }, { status: 500 })\n  }\n}\n""",
)

# Contributions capture UI: private Contributor fields and campaign categories are usable, not schema-only.
ui = 'src/components/wedding/planner/planner-contributions-workspace.tsx'
replace_once(
    ui,
    "import { CONTRIBUTION_TYPE_LABELS } from '@/lib/contributions'",
    "import { CONTRIBUTION_CAMPAIGN_TYPE_LABELS, CONTRIBUTION_TYPE_LABELS } from '@/lib/contributions'",
)
replace_once(
    ui,
    "interface Contributor { id: string; displayName: string; email: string | null; relationship: string | null }",
    "interface Contributor { id: string; displayName: string; kind: string; email: string | null; phone: string | null; address: string | null; preferredContactMethod: string | null; relationship: string | null; publicRecognition: boolean }",
)
replace_once(
    ui,
    "const INITIAL_FORM = { contributorId: '', contributorName: '', email: '', relationship: '', guestId: '', type:",
    "const INITIAL_FORM = { contributorId: '', contributorName: '', contributorKind: 'individual', email: '', phone: '', address: '', preferredContactMethod: '', publicRecognition: false, relationship: '', guestId: '', type:",
)
replace_once(
    ui,
    "const [campaignForm, setCampaignForm] = useState({ title: '', description: '', targetAmount: '', currency: 'USD', externalUrl: '' })",
    "const [campaignForm, setCampaignForm] = useState({ type: 'HONEYMOON', title: '', description: '', targetAmount: '', currency: 'USD', externalUrl: '' })",
)
replace_once(
    ui,
    "contributor: form.contributorId ? undefined : { displayName: form.contributorName, email: form.email, relationship: form.relationship, guestId: form.guestId || null },",
    "contributor: form.contributorId ? undefined : { displayName: form.contributorName, kind: form.contributorKind, email: form.email, phone: form.phone, address: form.address, preferredContactMethod: form.preferredContactMethod || null, publicRecognition: form.publicRecognition, relationship: form.relationship, guestId: form.guestId || null },",
)
replace_once(
    ui,
    "body: JSON.stringify({ type: 'HONEYMOON', title: campaignForm.title,",
    "body: JSON.stringify({ type: campaignForm.type, title: campaignForm.title,",
)
replace_once(
    ui,
    "if (success) setCampaignForm({ title: '', description: '', targetAmount: '', currency: 'USD', externalUrl: '' })",
    "if (success) setCampaignForm({ type: 'HONEYMOON', title: '', description: '', targetAmount: '', currency: 'USD', externalUrl: '' })",
)
replace_once(
    ui,
    "<form onSubmit={createCampaign} className=\"grid content-start gap-2 sm:grid-cols-2\"><Input required value={campaignForm.title}",
    "<form onSubmit={createCampaign} className=\"grid content-start gap-2 sm:grid-cols-2\"><select aria-label=\"Campaign type\" value={campaignForm.type} onChange={(e) => setCampaignForm((c) => ({...c,type:e.target.value}))} className=\"h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm\">{Object.entries(CONTRIBUTION_CAMPAIGN_TYPE_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><Input required value={campaignForm.title}",
)
replace_once(
    ui,
    "{!form.contributorId && <><Input type=\"email\"",
    "{!form.contributorId && <><select aria-label=\"Contributor type\" value={form.contributorKind} onChange={(e) => setForm((c) => ({...c,contributorKind:e.target.value}))} className=\"h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm\"><option value=\"individual\">Individual</option><option value=\"family\">Family / household</option><option value=\"organisation\">Organisation / sponsor</option></select><Input type=\"email\"",
)
replace_once(
    ui,
    "placeholder=\"Email (optional)\" className=\"border-gold/20 bg-espresso/70\" /><Input value={form.relationship}",
    "placeholder=\"Email (optional)\" className=\"border-gold/20 bg-espresso/70\" /><Input value={form.phone} onChange={(e) => setForm((c) => ({...c,phone:e.target.value}))} placeholder=\"Phone (optional)\" className=\"border-gold/20 bg-espresso/70\" /><Input value={form.relationship}",
)
replace_once(
    ui,
    "placeholder=\"Relationship, e.g. Bride's aunt\" className=\"border-gold/20 bg-espresso/70\" /><select value={form.guestId}",
    "placeholder=\"Relationship, e.g. Bride's aunt\" className=\"border-gold/20 bg-espresso/70\" /><Input value={form.address} onChange={(e) => setForm((c) => ({...c,address:e.target.value}))} placeholder=\"Address (optional)\" className=\"border-gold/20 bg-espresso/70\" /><select aria-label=\"Preferred contributor contact\" value={form.preferredContactMethod} onChange={(e) => setForm((c) => ({...c,preferredContactMethod:e.target.value}))} className=\"h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm\"><option value=\"\">No contact preference</option><option value=\"email\">Email</option><option value=\"phone\">Phone</option><option value=\"other\">Other</option></select><label className=\"flex items-start gap-2 rounded-lg border border-gold/15 p-3 text-xs text-champagne/60 sm:col-span-2\"><Checkbox checked={form.publicRecognition} onCheckedChange={(checked) => setForm((c) => ({...c,publicRecognition:checked===true}))} /><span><strong className=\"text-champagne/80\">Contributor is comfortable being publicly acknowledged.</strong><br/>This is private by default and does not automatically publish their name or amount.</span></label><select value={form.guestId}",
)

# Core Planner refresh should not fail all worksheet refresh messaging merely because the optional summary endpoint is unavailable.
workspace = 'src/components/wedding/planner-workspace.tsx'
replace_once(
    workspace,
    "      } else failures.push('Contributions')",
    "      } else if (!isRequestCancellation(contributionsResult.reason, controller.signal)) { console.warn('[PLANNER WORKSPACE CLIENT] contribution summary refresh failed', contributionsResult.reason) }",
)

# Public campaign cards visually distinguish the broader governed campaign taxonomy.
bridge = 'src/components/wedding/gift-registry-campaign-bridge.tsx'
replace_once(bridge, "import { ArrowRight, Gift, Heart, Plane } from 'lucide-react'", "import { ArrowRight, Gift, HandHeart, Heart, Plane } from 'lucide-react'")
replace_once(
    bridge,
    "const Icon = campaign.type === 'CHARITY' ? Heart : campaign.type === 'HOME' ? Gift : Plane",
    "const Icon = campaign.type === 'CHARITY' ? Heart : campaign.type === 'HOME' || campaign.type === 'ITEM_EXPERIENCE' ? Gift : campaign.type === 'WEDDING_SUPPORT' ? HandHeart : Plane",
)

# Admin analytics: provide financial counts and currency-separated totals, never a cross-currency sum.
write(
    'src/app/api/admin/contributions/analytics/route.ts',
    """import { NextRequest, NextResponse } from 'next/server'\nimport { db } from '@/lib/db'\nimport { summarizeContributions } from '@/lib/contributions'\nimport { requireAdmin } from '@/lib/admin-gate'\n\ninterface AdminSummaryRow {\n  type: string\n  amount: number | null\n  currency: string\n  estimatedValue: number | null\n  estimatedValueCurrency: string | null\n  commitmentState: string\n  fulfillmentState: string\n  allocatedAmount: number\n}\n\nexport async function GET(request: NextRequest) {\n  const gate = requireAdmin(request)\n  if (gate) return gate\n  try {\n    const [totals, rows] = await Promise.all([\n      db.$queryRaw<Array<{ contributions: bigint; weddings: bigint; campaigns: bigint; directVendor: bigint; inKind: bigint; toThank: bigint; unattributedFunding: bigint }>>`\n        SELECT\n          (SELECT COUNT(*) FROM wewed_contributions.wedding_contributions) AS contributions,\n          (SELECT COUNT(DISTINCT wedding_id) FROM wewed_contributions.wedding_contributions) AS weddings,\n          (SELECT COUNT(*) FROM wewed_contributions.campaigns) AS campaigns,\n          (SELECT COUNT(*) FROM wewed_contributions.wedding_contributions WHERE type = 'DIRECT_VENDOR_PAYMENT') AS \"directVendor\",\n          (SELECT COUNT(*) FROM wewed_contributions.wedding_contributions WHERE type IN ('GOODS_IN_KIND','SERVICE_IN_KIND','TIME_LABOUR','DISCOUNT_SPONSORSHIP')) AS \"inKind\",\n          (SELECT COUNT(*) FROM wewed_contributions.wedding_contributions WHERE thank_you_state IN ('TO_THANK','PREPARED')) AS \"toThank\",\n          (SELECT COUNT(*) FROM wewed_contributions.payment_funding_allocations WHERE source_kind = 'LEGACY_UNATTRIBUTED') AS \"unattributedFunding\"\n      `,\n      db.$queryRaw<AdminSummaryRow[]>`\n        SELECT c.type, c.amount::float8 AS amount, c.currency,\n               c.estimated_value::float8 AS \"estimatedValue\", c.estimated_value_currency AS \"estimatedValueCurrency\",\n               c.commitment_state AS \"commitmentState\", c.fulfillment_state AS \"fulfillmentState\",\n               COALESCE(SUM(a.amount) FILTER (WHERE a.allocation_kind = 'CASH'), 0)::float8 AS \"allocatedAmount\"\n          FROM wewed_contributions.wedding_contributions c\n          LEFT JOIN wewed_contributions.contribution_allocations a ON a.contribution_id = c.id AND a.wedding_id = c.wedding_id\n         GROUP BY c.id\n      `,\n    ])\n    const counts = totals[0]\n    return NextResponse.json({\n      success: true,\n      data: {\n        contributions: Number(counts?.contributions ?? 0),\n        weddingsUsingContributions: Number(counts?.weddings ?? 0),\n        campaigns: Number(counts?.campaigns ?? 0),\n        directVendorPayments: Number(counts?.directVendor ?? 0),\n        inKindContributions: Number(counts?.inKind ?? 0),\n        thankYousOutstanding: Number(counts?.toThank ?? 0),\n        explicitlyUnattributedFundingRows: Number(counts?.unattributedFunding ?? 0),\n        summaryByCurrency: summarizeContributions(rows),\n      },\n    })\n  } catch (error) {\n    console.error('[ADMIN CONTRIBUTIONS ANALYTICS] error', error)\n    return NextResponse.json({ success: false, error: 'Contribution analytics are unavailable.' }, { status: 500 })\n  }\n}\n""",
)

write(
    'src/components/admin/admin-financial-contributions.tsx',
    """'use client'\n\nimport { useEffect, useState } from 'react'\nimport { CircleDollarSign, Gift, HandHeart, Loader2, Store, Users } from 'lucide-react'\n\ninterface CurrencySummary { currency: string; cashReceived: number; directVendorPaid: number; inKindValue: number; pledged: number; availableCash: number }\ninterface Analytics { contributions: number; weddingsUsingContributions: number; campaigns: number; directVendorPayments: number; inKindContributions: number; thankYousOutstanding: number; explicitlyUnattributedFundingRows: number; summaryByCurrency: CurrencySummary[] }\n\nfunction money(value: number, currency: string) {\n  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value) }\n  catch { return `${currency} ${Math.round(value).toLocaleString()}` }\n}\n\nexport function AdminFinancialContributions() {\n  const [data, setData] = useState<Analytics | null>(null)\n  const [error, setError] = useState('')\n  useEffect(() => {\n    let cancelled = false\n    void fetch('/api/admin/contributions/analytics', { cache: 'no-store' }).then(async (response) => {\n      const body = await response.json()\n      if (!response.ok || body.success === false) throw new Error(body.error || 'Could not load financial contribution analytics.')\n      if (!cancelled) setData(body.data)\n    }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load analytics.') })\n    return () => { cancelled = true }\n  }, [])\n\n  return <main className=\"min-h-dvh bg-espresso px-4 pb-28 pt-8 text-champagne sm:px-6\" data-admin-financial-contributions>\n    <div className=\"mx-auto max-w-6xl\">\n      <p className=\"text-[10px] font-semibold uppercase tracking-[0.2em] text-gold\">Admin · Resource accounting</p>\n      <h1 className=\"mt-2 font-serif text-3xl\">Financial Contributions</h1>\n      <p className=\"mt-2 max-w-3xl text-sm leading-6 text-champagne/55\">Operational visibility into wedding support recorded in the Planner. This is separate from Guest Stories / “Our Village” moderation and never combines different currencies.</p>\n      {error && <div role=\"alert\" className=\"mt-5 rounded-xl border border-clay/30 bg-clay/10 p-3 text-sm text-clay-light\">{error}</div>}\n      {!data && !error ? <div className=\"mt-12 flex justify-center\"><Loader2 className=\"size-7 animate-spin text-gold\" /></div> : data ? <>\n        <div className=\"mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4\">\n          {[\n            ['Recorded', data.contributions, HandHeart], ['Weddings', data.weddingsUsingContributions, Users], ['Campaigns', data.campaigns, Gift], ['Direct vendor payments', data.directVendorPayments, Store],\n            ['In-kind records', data.inKindContributions, Gift], ['Thank-yous pending', data.thankYousOutstanding, HandHeart], ['Unattributed funding rows', data.explicitlyUnattributedFundingRows, CircleDollarSign],\n          ].map(([label, value, Icon]) => <section key={String(label)} className=\"rounded-2xl border border-gold/15 bg-white/[0.025] p-4\"><Icon className=\"size-4 text-gold\" /><p className=\"mt-3 text-[10px] uppercase tracking-[0.14em] text-champagne/45\">{String(label)}</p><p className=\"mt-1 font-serif text-2xl\">{Number(value).toLocaleString()}</p></section>)}\n        </div>\n        <section className=\"mt-6 rounded-2xl border border-gold/15 bg-white/[0.025] p-4 sm:p-5\">\n          <h2 className=\"font-serif text-xl\">Value by currency</h2><p className=\"mt-1 text-xs text-champagne/45\">Each currency is its own accounting bucket.</p>\n          {data.summaryByCurrency.length ? <div className=\"mt-4 grid gap-3 md:grid-cols-2\">{data.summaryByCurrency.map((row) => <div key={row.currency} className=\"rounded-xl border border-gold/10 p-3\"><p className=\"text-[10px] font-semibold uppercase tracking-[0.16em] text-gold\">{row.currency}</p><p className=\"mt-2 text-sm\">Received {money(row.cashReceived,row.currency)} · Direct vendor {money(row.directVendorPaid,row.currency)}</p><p className=\"mt-1 text-xs text-champagne/50\">In-kind {money(row.inKindValue,row.currency)} · Pledged {money(row.pledged,row.currency)} · Available {money(row.availableCash,row.currency)}</p></div>)}</div> : <p className=\"mt-4 text-sm text-champagne/50\">No financial Contributions have been recorded yet.</p>}\n        </section>\n      </> : null}\n    </div>\n  </main>\n}\n""",
)

write(
    'src/components/admin/secure-admin-financial-contributions.tsx',
    """'use client'\n\nimport { useRouter } from 'next/navigation'\nimport { AdminFinancialContributions } from '@/components/admin/admin-financial-contributions'\nimport { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'\n\nexport function SecureAdminFinancialContributions() {\n  const router = useRouter()\n  return <DashboardAuthGate title=\"Wewed Financial Contributions\" description=\"Sign in with an authorized Wewed company administrator account.\" onClose={() => router.push('/')}><AdminFinancialContributions /></DashboardAuthGate>\n}\n""",
)

write(
    'src/app/admin/contributions/page.tsx',
    """import type { Metadata } from 'next'\nimport { SecureAdminFinancialContributions } from '@/components/admin/secure-admin-financial-contributions'\n\nexport const metadata: Metadata = { title: 'Financial Contributions | Wewed Admin', description: 'Private Wewed resource-accounting analytics.', robots: { index: false, follow: false } }\nexport default function AdminFinancialContributionsPage() { return <SecureAdminFinancialContributions /> }\n""",
)

# Admin utility navigation exposes the financial view distinctly from GuestContribution moderation.
nav = 'src/components/admin/admin-utility-nav.tsx'
replace_once(nav, "  FileCheck2,\n  LayoutDashboard,", "  FileCheck2,\n  HandHeart,\n  LayoutDashboard,")
replace_once(
    nav,
    """    [\n      '/admin/transaction-governance',\n      'Transactions',\n      Scale,\n      pathname.startsWith('/admin/transaction-governance'),\n    ],\n""",
    """    [\n      '/admin/transaction-governance',\n      'Transactions',\n      Scale,\n      pathname.startsWith('/admin/transaction-governance'),\n    ],\n    [\n      '/admin/contributions',\n      'Financial contributions',\n      HandHeart,\n      pathname.startsWith('/admin/contributions'),\n    ],\n""",
)
replace_once(
    nav,
    "<a href=\"/admin/transaction-governance\" className=\"flex min-h-14 items-center gap-2 rounded-xl border border-gold/12 bg-white/[0.025] px-3 text-xs font-semibold text-champagne\"><Scale className=\"size-4 text-gold\" />Transactions</a>",
    "<a href=\"/admin/transaction-governance\" className=\"flex min-h-14 items-center gap-2 rounded-xl border border-gold/12 bg-white/[0.025] px-3 text-xs font-semibold text-champagne\"><Scale className=\"size-4 text-gold\" />Transactions</a>\n              <a href=\"/admin/contributions\" className=\"flex min-h-14 items-center gap-2 rounded-xl border border-gold/12 bg-white/[0.025] px-3 text-xs font-semibold text-champagne\"><HandHeart className=\"size-4 text-gold\" />Financial contributions</a>",
)

# Contracts now cover the breadth that was missing in the first release.
contract = 'src/lib/contributions-source-contract.test.ts'
insert = """\n  test('Contributor capture exposes the private entity fields supported by the schema', () => {\n    const ui = read('src/components/wedding/planner/planner-contributions-workspace.tsx')\n    const route = read('src/app/api/planner/contributions/route.ts')\n    expect(ui).toContain('Contributor type')\n    expect(ui).toContain('Preferred contributor contact')\n    expect(ui).toContain('publicRecognition')\n    expect(route).toContain('preferred_contact_method')\n    expect(route).toContain('public_recognition')\n    expect(route).toContain('address')\n  })\n\n  test('Campaign creation supports governed wedding-support categories instead of honeymoon-only data', () => {\n    const domain = read('src/lib/contributions.ts')\n    const ui = read('src/components/wedding/planner/planner-contributions-workspace.tsx')\n    const route = read('src/app/api/planner/contribution-campaigns/route.ts')\n    expect(domain).toContain('WEDDING_SUPPORT')\n    expect(domain).toContain('ITEM_EXPERIENCE')\n    expect(ui).toContain('CONTRIBUTION_CAMPAIGN_TYPE_LABELS')\n    expect(route).toContain('normalizeContributionCampaignType')\n    expect(route).not.toContain(\"String(body.type ?? 'HONEYMOON')\")\n  })\n\n  test('Admin financial Contributions are visible separately from legacy GuestContribution moderation', () => {\n    const page = read('src/app/admin/contributions/page.tsx')\n    const admin = read('src/components/admin/admin-financial-contributions.tsx')\n    const nav = read('src/components/admin/admin-utility-nav.tsx')\n    expect(page).toContain('SecureAdminFinancialContributions')\n    expect(admin).toContain('separate from Guest Stories')\n    expect(admin).toContain('summaryByCurrency')\n    expect(nav).toContain('/admin/contributions')\n  })\n"""
text = read(contract)
needle = "\n  test('public campaign endpoint never selects contributor identity', () => {"
if text.count(needle) != 1:
    raise SystemExit('source contract second-review insertion point not unique')
write(contract, text.replace(needle, insert + needle, 1))

print('Contributions phase-completeness expansion applied.')
