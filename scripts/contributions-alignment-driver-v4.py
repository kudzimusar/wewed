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
        raise SystemExit(f'{path}: expected exactly one match, found {count}: {old[:100]!r}')
    write(path, text.replace(old, new, 1))


# 1. Canonical route state: Contributions is a real Planner module.
replace_once(
    'src/lib/planner-route-state.ts',
    "  | 'timeline'\n  | 'seating'\n",
    "  | 'timeline'\n  | 'seating'\n  | 'contributions'\n",
)
replace_once(
    'src/lib/planner-route-state.ts',
    "  'timeline',\n  'seating',\n])",
    "  'timeline',\n  'seating',\n  'contributions',\n])",
)

# 2. Direct route uses the same secure Planner shell as every canonical module.
write(
    'src/app/planner/contributions/page.tsx',
    """'use client'\n\nimport { useRouter } from 'next/navigation'\nimport { SecureWeddingPlanner } from '@/components/wedding/secure-wedding-planner'\n\nexport default function PlannerContributionsPage() {\n  const router = useRouter()\n  return <SecureWeddingPlanner onClose={() => router.push('/')} />\n}\n""",
)

# 3. Core Planner workspace: visible desktop/mobile module, Overview summary, embedded worksheet.
workspace = 'src/components/wedding/planner-workspace.tsx'
replace_once(
    workspace,
    "  CircleDollarSign,\n  LayoutGrid,",
    "  CircleDollarSign,\n  HandHeart,\n  LayoutGrid,",
)
replace_once(
    workspace,
    "import { PlannerBudgetModule } from '@/components/wedding/planner/modules/planner-budget-module'\n",
    "import { PlannerBudgetModule } from '@/components/wedding/planner/modules/planner-budget-module'\nimport { PlannerContributionsWorkspace } from '@/components/wedding/planner/planner-contributions-workspace'\n",
)
replace_once(
    workspace,
    "  | 'timeline'\n  | 'seating'\n",
    "  | 'timeline'\n  | 'seating'\n  | 'contributions'\n",
)
replace_once(
    workspace,
    "interface CategoryBreakdown {\n  category: string\n  estimated: number\n  actual: number\n  paid: number\n  outstanding: number\n  count: number\n}\n",
    """interface CategoryBreakdown {\n  category: string\n  estimated: number\n  actual: number\n  paid: number\n  outstanding: number\n  count: number\n}\n\ninterface ContributionOverviewSummary {\n  currency: string\n  cashReceived: number\n  directVendorPaid: number\n  inKindValue: number\n  pledged: number\n  availableCash: number\n}\n\ninterface ContributionOverviewCounts {\n  contributors: number\n  pledged: number\n  toThank: number\n}\n""",
)
replace_once(
    workspace,
    "  { value: 'budget', label: 'Budget', icon: <CircleDollarSign className=\"size-3.5\" /> },\n  { value: 'vendors',",
    "  { value: 'budget', label: 'Budget', icon: <CircleDollarSign className=\"size-3.5\" /> },\n  { value: 'contributions', label: 'Contributions', icon: <HandHeart className=\"size-3.5\" /> },\n  { value: 'vendors',",
)
replace_once(
    workspace,
    "  const [timeline, setTimeline] = useState<TimelineRow[]>([])\n",
    "  const [timeline, setTimeline] = useState<TimelineRow[]>([])\n  const [contributionSummary, setContributionSummary] = useState<ContributionOverviewSummary[]>([])\n  const [contributionCounts, setContributionCounts] = useState<ContributionOverviewCounts>({ contributors: 0, pledged: 0, toThank: 0 })\n",
)
replace_once(
    workspace,
    "      ['Timeline', api<{ data: TimelineRow[] }>('/api/planner/timeline', requestInit)],\n    ] as const",
    "      ['Timeline', api<{ data: TimelineRow[] }>('/api/planner/timeline', requestInit)],\n      ['Contributions', api<{ summaryByCurrency: ContributionOverviewSummary[]; counts: ContributionOverviewCounts }>('/api/planner/contributions/summary', requestInit)],\n    ] as const",
)
replace_once(
    workspace,
    "      const timelineResult = results[4]\n      if (timelineResult.status === 'fulfilled') {\n        setTimeline((timelineResult.value.data ?? []).sort((a, b) => a.order - b.order))\n      } else failures.push('Timeline')\n",
    """      const timelineResult = results[4]\n      if (timelineResult.status === 'fulfilled') {\n        setTimeline((timelineResult.value.data ?? []).sort((a, b) => a.order - b.order))\n      } else failures.push('Timeline')\n\n      const contributionsResult = results[5]\n      if (contributionsResult.status === 'fulfilled') {\n        setContributionSummary(contributionsResult.value.summaryByCurrency ?? [])\n        setContributionCounts(contributionsResult.value.counts ?? { contributors: 0, pledged: 0, toThank: 0 })\n      } else failures.push('Contributions')\n""",
)
replace_once(
    workspace,
    """                </div>\n\n                <SectionCard className=\"p-5\">\n                  <div className=\"flex flex-wrap items-center justify-between gap-3\"><div><h2 className=\"font-serif text-xl\">Planning readiness</h2>""",
    """                </div>\n\n                <div data-testid=\"planner-contributions-overview\">\n                  <SectionCard className=\"p-4 sm:p-5\">\n                    <div className=\"flex flex-wrap items-start justify-between gap-3\">\n                      <div>\n                        <p className=\"font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-gold/70\">Contributions & support</p>\n                        <h2 className=\"mt-1 font-serif text-xl\">Who is helping make this possible?</h2>\n                        <p className=\"mt-1 font-sans text-xs text-champagne/50\">{contributionCounts.contributors} contributors · {contributionCounts.pledged} pledged · {contributionCounts.toThank} thank-you{contributionCounts.toThank === 1 ? '' : 's'} pending</p>\n                      </div>\n                      <Button type=\"button\" variant=\"outline\" size=\"sm\" onClick={() => setActiveTab('contributions')} className=\"border-gold/25 bg-transparent text-gold\">\n                        <HandHeart className=\"size-3.5\" />Open Contributions\n                      </Button>\n                    </div>\n                    {contributionSummary.length > 0 ? (\n                      <div className=\"mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3\">\n                        {contributionSummary.map((row) => (\n                          <div key={row.currency} className=\"rounded-xl border border-gold/10 p-3\">\n                            <p className=\"font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-gold/65\">{row.currency}</p>\n                            <p className=\"mt-1 font-sans text-xs text-champagne/65\">Received {money(row.cashReceived, row.currency)} · Direct vendor {money(row.directVendorPaid, row.currency)}</p>\n                            <p className=\"mt-1 font-sans text-[11px] text-champagne/45\">In-kind {money(row.inKindValue, row.currency)} · Pledged {money(row.pledged, row.currency)} · Available {money(row.availableCash, row.currency)}</p>\n                          </div>\n                        ))}\n                      </div>\n                    ) : (\n                      <p className=\"mt-4 rounded-xl border border-dashed border-gold/15 p-3 font-sans text-xs text-champagne/45\">No contributions recorded yet. Add support only when someone has offered or provided it.</p>\n                    )}\n                  </SectionCard>\n                </div>\n\n                <SectionCard className=\"p-5\">\n                  <div className=\"flex flex-wrap items-center justify-between gap-3\"><div><h2 className=\"font-serif text-xl\">Planning readiness</h2>""",
)
replace_once(
    workspace,
    "            {activeTab === 'budget' && <PlannerBudgetModule",
    "            {activeTab === 'contributions' && <PlannerContributionsWorkspace embedded />}\n            {activeTab === 'budget' && <PlannerBudgetModule",
)

# 4. Stage-7 worksheet actions use the same module registry; remove one-off route exception.
stage7 = 'src/components/wedding/planner-workspace-stage7.tsx'
replace_once(
    stage7,
    "  { value: 'budget', label: 'Budget', worksheetKey: 'budget' },\n  { value: 'vendors',",
    "  { value: 'budget', label: 'Budget', worksheetKey: 'budget' },\n  { value: 'contributions', label: 'Contributions' },\n  { value: 'vendors',",
)
replace_once(
    stage7,
    "data-testid={`worksheet-module-${module.worksheetKey ?? 'overview'}`}",
    "data-testid={`worksheet-module-${module.worksheetKey ?? module.value}`}",
)
replace_once(
    stage7,
    """              <button\n                type=\"button\"\n                data-testid=\"worksheet-module-contributions\"\n                onClick={() => router.push('/planner/contributions')}\n                className=\"min-h-10 rounded-md border border-gold/10 px-2.5 py-1.5 font-sans text-[11px] text-champagne/55 transition-colors hover:border-gold/25 hover:text-champagne\"\n              >\n                Contributions\n              </button>\n""",
    "",
)

# 5. Contributions worksheet supports embedding in the canonical Planner content area.
contrib_ui = 'src/components/wedding/planner/planner-contributions-workspace.tsx'
replace_once(
    contrib_ui,
    'export function PlannerContributionsWorkspace() {',
    'export function PlannerContributionsWorkspace({ embedded = false }: { embedded?: boolean } = {}) {',
)
replace_once(
    contrib_ui,
    "  return <div className=\"min-h-screen bg-espresso text-champagne\" data-testid=\"planner-contributions-workspace\">\n    <header className=\"sticky top-0 z-40 border-b border-gold/15 bg-espresso/95 px-3 py-2 backdrop-blur sm:px-5\"><div className=\"mx-auto flex max-w-7xl items-center gap-3\"><Button variant=\"ghost\" size=\"sm\" onClick={() => router.push('/planner/overview')} className=\"text-champagne/70\"><ArrowLeft className=\"size-4\" />Planner</Button><div className=\"min-w-0 flex-1\"><p className=\"truncate text-[10px] uppercase tracking-[0.18em] text-gold\">Contributions</p><p className=\"hidden text-xs text-champagne/40 sm:block\">Money, vendor payments, goods, services and time</p></div><Button asChild variant=\"outline\" size=\"sm\" className=\"border-gold/20 bg-transparent text-champagne/70\"><a href=\"/api/planner/contributions/export\"><Download className=\"size-4\" /><span className=\"hidden sm:inline\">Export</span></a></Button><Button size=\"sm\" onClick={() => setAddOpen(true)} className=\"bg-gold text-espresso hover:bg-gold-light\"><Plus className=\"size-4\" />Add</Button></div></header>\n\n    <main className=\"mx-auto max-w-7xl space-y-5 px-3 py-5 sm:px-5 sm:py-7\">",
    """  return <div className={embedded ? 'text-champagne' : 'min-h-screen bg-espresso text-champagne'} data-testid=\"planner-contributions-workspace\">\n    {!embedded && <header className=\"sticky top-0 z-40 border-b border-gold/15 bg-espresso/95 px-3 py-2 backdrop-blur sm:px-5\"><div className=\"mx-auto flex max-w-7xl items-center gap-3\"><Button variant=\"ghost\" size=\"sm\" onClick={() => router.push('/planner/overview')} className=\"text-champagne/70\"><ArrowLeft className=\"size-4\" />Planner</Button><div className=\"min-w-0 flex-1\"><p className=\"truncate text-[10px] uppercase tracking-[0.18em] text-gold\">Contributions</p><p className=\"hidden text-xs text-champagne/40 sm:block\">Money, vendor payments, goods, services and time</p></div><Button asChild variant=\"outline\" size=\"sm\" className=\"border-gold/20 bg-transparent text-champagne/70\"><a href=\"/api/planner/contributions/export\"><Download className=\"size-4\" /><span className=\"hidden sm:inline\">Export</span></a></Button><Button size=\"sm\" onClick={() => setAddOpen(true)} className=\"bg-gold text-espresso hover:bg-gold-light\"><Plus className=\"size-4\" />Add</Button></div></header>}\n\n    <main className={embedded ? 'space-y-5' : 'mx-auto max-w-7xl space-y-5 px-3 py-5 sm:px-5 sm:py-7'}>\n      {embedded && <div className=\"flex flex-wrap items-start justify-between gap-3 border-b border-gold/10 pb-4\"><div><p className=\"text-[10px] font-semibold uppercase tracking-[0.18em] text-gold\">Contributions</p><p className=\"mt-1 text-xs text-champagne/45\">Money, vendor payments, goods, services and time</p></div><div className=\"flex gap-2\"><Button asChild variant=\"outline\" size=\"sm\" className=\"border-gold/20 bg-transparent text-champagne/70\"><a href=\"/api/planner/contributions/export\"><Download className=\"size-4\" /><span className=\"hidden sm:inline\">Export</span></a></Button><Button size=\"sm\" onClick={() => setAddOpen(true)} className=\"bg-gold text-espresso hover:bg-gold-light\"><Plus className=\"size-4\" />Add</Button></div></div>}""",
)

# 6. Lightweight private Overview endpoint reuses the canonical ledger summary.
write(
    'src/app/api/planner/contributions/summary/route.ts',
    """import { NextRequest, NextResponse } from 'next/server'\nimport { loadContributionWorkspace } from '@/lib/contributions/store'\nimport { requireWeddingPermission } from '@/lib/wedding-access'\n\nexport async function GET(request: NextRequest) {\n  const access = await requireWeddingPermission(request, 'budget.view')\n  if (access.error) return access.error\n  try {\n    const workspace = await loadContributionWorkspace(access.context.weddingId)\n    return NextResponse.json({\n      success: true,\n      summaryByCurrency: workspace.summaryByCurrency,\n      counts: workspace.counts,\n    })\n  } catch (error) {\n    console.error('[CONTRIBUTION SUMMARY GET] error', error)\n    return NextResponse.json({ success: false, error: 'Could not load contribution summary.' }, { status: 500 })\n  }\n}\n""",
)

# 7. Browser helper recognizes Contributions as a module.
helper = 'tests/e2e/support/planner-browser.ts'
replace_once(
    helper,
    "  seating: 'Seating',\n} as const",
    "  seating: 'Seating',\n  contributions: 'Contributions',\n} as const",
)

# 8. Executable browser contract: visible desktop/mobile navigation + direct route + Overview CTA.
write(
    'tests/e2e/planner-contributions.spec.ts',
    """import { expect, openModule, test } from './support/planner-browser'\n\ntest('Contributions is a first-class Planner module with Overview entry and durable direct route', async ({ plannerPage }) => {\n  const navigation = plannerPage.getByRole('navigation', { name: 'Planner workspace sections' })\n  await expect(navigation.getByRole('button', { name: 'Contributions', exact: true })).toBeVisible()\n\n  await expect(plannerPage.getByTestId('planner-contributions-overview')).toBeVisible()\n  await plannerPage.getByRole('button', { name: 'Open Contributions', exact: true }).click()\n  await expect(plannerPage).toHaveURL(/\\/planner\\/contributions(?:[?#]|$)/)\n  await expect(plannerPage.locator('[data-active-planner-module]')).toHaveAttribute('data-active-planner-module', 'contributions')\n  await expect(plannerPage.getByTestId('planner-contributions-workspace')).toBeVisible()\n  await expect(plannerPage.getByRole('heading', { name: 'Who helped make this possible?' })).toBeVisible()\n  await expect(plannerPage.locator('[data-planner-portal]')).toBeVisible()\n\n  await plannerPage.goto('/planner/contributions#planner-workspace')\n  await expect(plannerPage).toHaveURL(/\\/planner\\/contributions(?:[?#]|$)/)\n  await expect(plannerPage.locator('[data-active-planner-module]')).toHaveAttribute('data-active-planner-module', 'contributions')\n  await expect(plannerPage.locator('#active-wedding')).not.toHaveValue('')\n  await expect(plannerPage.getByTestId('planner-contributions-workspace')).toBeVisible()\n})\n\ntest('Contributions remains reachable through the mobile Planner section selector @mobile', async ({ plannerPage }) => {\n  const selector = plannerPage.getByRole('combobox', { name: 'Planner workspace section' })\n  await expect(selector).toBeVisible()\n  await expect(selector.locator('option[value=\"contributions\"]')).toHaveText('Contributions')\n  await selector.selectOption('contributions')\n  await expect(plannerPage).toHaveURL(/\\/planner\\/contributions(?:[?#]|$)/)\n  await expect(selector).toHaveValue('contributions')\n  await expect(plannerPage.getByTestId('planner-contributions-workspace')).toBeVisible()\n})\n""",
)

# 9. Source contract explicitly fails if the Planner wiring regresses again.
contract = 'src/lib/contributions-source-contract.test.ts'
insert = """\n  test('Contributions is a canonical and visible Planner module', () => {\n    const routeState = read('src/lib/planner-route-state.ts')\n    const workspace = read('src/components/wedding/planner-workspace.tsx')\n    const stage7 = read('src/components/wedding/planner-workspace-stage7.tsx')\n    const page = read('src/app/planner/contributions/page.tsx')\n    expect(routeState).toContain(\"| 'contributions'\")\n    expect(workspace).toContain(\"value: 'contributions', label: 'Contributions'\")\n    expect(workspace).toContain(\"activeTab === 'contributions'\")\n    expect(workspace).toContain('planner-contributions-overview')\n    expect(stage7).toContain(\"{ value: 'contributions', label: 'Contributions' }\")\n    expect(stage7).not.toContain(\"router.push('/planner/contributions')\")\n    expect(page).toContain('SecureWeddingPlanner')\n  })\n\n  test('Contributions has an executable desktop and mobile browser reachability contract', () => {\n    const browser = read('tests/e2e/planner-contributions.spec.ts')\n    expect(browser).toContain('Planner workspace sections')\n    expect(browser).toContain('Planner workspace section')\n    expect(browser).toContain('@mobile')\n    expect(browser).toContain('/planner/contributions')\n  })\n"""
text = read(contract)
needle = "\n  test('Notebook links use the existing entity-link action', () => {"
if text.count(needle) != 1:
    raise SystemExit('source contract insertion point not unique')
write(contract, text.replace(needle, insert + needle, 1))

# 10. Dedicated workflow watches the canonical Planner files and executes the new browser gate.
workflow = '.github/workflows/contributions-resource-accounting.yml'
replace_once(
    workflow,
    "      - 'src/components/wedding/planner/**'\n",
    "      - 'src/components/wedding/planner/**'\n      - 'src/components/wedding/planner-workspace.tsx'\n      - 'src/components/wedding/planner-workspace-stage7.tsx'\n      - 'src/lib/planner-route-state.ts'\n      - 'src/app/planner/contributions/**'\n      - 'tests/e2e/planner-contributions.spec.ts'\n      - 'tests/e2e/support/planner-browser.ts'\n",
)
replace_once(
    workflow,
    "      - run: bun install --frozen-lockfile\n",
    "      - run: bun install --frozen-lockfile\n      - run: bun add --no-save --exact @playwright/test@1.55.0\n",
)
replace_once(
    workflow,
    "      - run: bun run build\n      - run: git diff --check\n",
    "      - run: bun run build\n      - run: bash scripts/install-playwright-chromium-ci.sh\n      - run: bunx playwright test tests/e2e/planner-contributions.spec.ts\n      - run: git diff --check\n",
)

print('Contributions canonical Planner alignment applied.')
