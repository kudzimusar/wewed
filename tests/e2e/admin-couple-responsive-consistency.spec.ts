import {
  E2E_WEDDINGS,
  expect,
  expectNoDocumentOverflow,
  test,
} from './support/planner-browser'

const RESPONSIVE_VIEWPORTS = [
  { name: 'small phone', width: 360, height: 800, columns: 2 },
  { name: 'phone', width: 390, height: 844, columns: 2 },
  { name: 'tablet portrait', width: 768, height: 1024, columns: 4 },
  { name: 'tablet landscape', width: 1024, height: 768, columns: 4 },
] as const

test('planner overview keeps compact metric density without document overflow', async ({
  plannerPage: page,
}) => {
  test.setTimeout(90_000)

  for (const viewport of RESPONSIVE_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/planner/overview#planner-workspace')
    await expect(page.locator('[data-active-planner-module="overview"]')).toBeVisible()
    await expect(page.getByText('Task progress', { exact: true })).toBeVisible()
    await expect(page.getByText('Budget outstanding', { exact: true })).toBeVisible()

    const metrics = page
      .locator(
        '[data-active-planner-module="overview"] [data-planner-module-scroll="true"] > div > .space-y-5 > .grid',
      )
      .first()
    await expect(metrics).toBeVisible()

    const layout = await metrics.evaluate((element) => {
      const cards = Array.from(element.children) as HTMLElement[]
      const columns = getComputedStyle(element)
        .gridTemplateColumns.split(' ')
        .filter(Boolean).length
      return {
        columns,
        cardCount: cards.length,
        tallestCard: Math.max(...cards.map((card) => card.getBoundingClientRect().height)),
      }
    })

    expect(layout.cardCount, `${viewport.name} shows all overview metrics`).toBe(4)
    expect(layout.columns, `${viewport.name} uses the intended compact grid`).toBe(
      viewport.columns,
    )
    expect(
      layout.tallestCard,
      `${viewport.name} summary cards remain compact`,
    ).toBeLessThan(170)
    await expectNoDocumentOverflow(page)
  }
})

test('authenticated wedding members receive workspace navigation without flagship-only tools', async ({
  plannerPage: page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/w/${E2E_WEDDINGS.primary.slug}`)

  const weddingSurface = page.locator('#main-content')
  await expect(weddingSurface).toBeVisible()
  await expect(weddingSurface).toContainText('Aurora')
  await expect(weddingSurface).toContainText('Blake')
  const workspaceLink = page.getByRole('link', {
    name: 'Planner workspace',
    exact: true,
  })
  await expect(workspaceLink).toBeVisible()
  await expect(workspaceLink).toHaveAttribute('href', '/planner')
  await expect(page.getByRole('button', { name: 'Couple login' })).toBeHidden()
  await expect(
    page.getByRole('button', { name: 'Quick RSVP via WhatsApp' }),
  ).toHaveCount(0)
  await expectNoDocumentOverflow(page)
})
