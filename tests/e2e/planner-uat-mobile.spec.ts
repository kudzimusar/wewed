import {
  expect,
  expectNoDocumentOverflow,
  test,
} from './support/planner-browser'

const MOBILE_VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 900 },
] as const

test('planner portfolio and client workspace stay navigable at UAT mobile widths', async ({ plannerPage }) => {
  for (const viewport of MOBILE_VIEWPORTS) {
    await plannerPage.setViewportSize(viewport)
    await plannerPage.goto('/planner/overview#planner-workspace')

    const activeWedding = plannerPage.locator('#active-wedding')
    await expect(activeWedding).toBeVisible()
    await expect
      .poll(
        async () => (await activeWedding.boundingBox())?.width ?? 0,
        {
          message: `active wedding selector has stable width at ${viewport.width}px`,
          timeout: 12_000,
        },
      )
      .toBeGreaterThanOrEqual(100)

    await expect(
      plannerPage.getByRole('combobox', { name: 'Planner workspace section' }),
    ).toBeVisible()
    await expectNoDocumentOverflow(plannerPage)

    const menu = plannerPage.getByTestId('planner-adaptive-menu-trigger')
    await expect(menu).toBeVisible()
    await menu.click()
    const drawer = plannerPage.locator('[data-planner-adaptive-navigation]')
    const allWeddings = drawer.getByRole('link', { name: 'All weddings', exact: true })
    await expect(allWeddings).toBeVisible()
    await allWeddings.click()

    await expect(plannerPage).toHaveURL(/\/planner\/portfolio(?:[?#]|$)/)
    await expect(plannerPage.locator('[data-planner-portfolio-shell]')).toBeVisible()
    await expect(
      plannerPage.getByRole('heading', { name: 'Your wedding command centre' }),
    ).toBeVisible()
    await expect(plannerPage.getByTestId('planner-adaptive-menu-trigger')).toBeVisible()
    await expect(plannerPage.getByTestId('workspace-quick-navigation')).toHaveCount(0)
    await expectNoDocumentOverflow(plannerPage)
  }
})
