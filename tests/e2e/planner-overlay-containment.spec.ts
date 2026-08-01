import { expect, expectNoDocumentOverflow, openModule, test } from './support/planner-browser'

const DEVICE_VIEWPORTS = [
  { name: 'compact-phone', width: 390, height: 667 },
  { name: 'large-phone', width: 430, height: 932 },
  { name: 'tablet-portrait', width: 820, height: 1180 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

const DATA_PREVIEW_VIEWPORTS = new Set(['compact-phone', 'tablet-portrait', 'desktop'])

async function openWorksheetTools(page: Parameters<typeof openModule>[0]) {
  const toggle = page.getByTestId('worksheet-tools-toggle')
  if (await toggle.isVisible()) {
    const expanded = await toggle.getAttribute('aria-expanded')
    if (expanded !== 'true') await toggle.click()
  }
  await expect(page.locator('#planner-worksheet-tools')).toBeVisible()
}

async function assertDialogGeometry(
  page: Parameters<typeof openModule>[0],
  viewport: { width: number; height: number },
) {
  const dialog = page.locator('[data-slot="dialog-content"]:visible').last()
  await expect(dialog).toBeVisible()
  const box = await dialog.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(-1)
  expect(box!.y).toBeGreaterThanOrEqual(-1)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1)

  const closeButton = dialog.getByRole('button', { name: /close/i }).first()
  if (await closeButton.isVisible()) {
    const closeBox = await closeButton.boundingBox()
    expect(closeBox).not.toBeNull()
    expect(closeBox!.x).toBeGreaterThanOrEqual(box!.x - 1)
    expect(closeBox!.y).toBeGreaterThanOrEqual(box!.y - 1)
    expect(closeBox!.x + closeBox!.width).toBeLessThanOrEqual(box!.x + box!.width + 1)
    expect(closeBox!.y + closeBox!.height).toBeLessThanOrEqual(box!.y + box!.height + 1)
    if (viewport.width < 640) {
      expect(closeBox!.width).toBeGreaterThanOrEqual(40)
      expect(closeBox!.height).toBeGreaterThanOrEqual(40)
    }
  }

  return dialog
}

async function closeVisibleDialog(page: Parameters<typeof openModule>[0]) {
  const dialog = page.locator('[data-slot="dialog-content"]:visible').last()
  const closeButton = dialog.getByRole('button', { name: /close/i }).first()
  if (await closeButton.isVisible()) await closeButton.click()
  else await page.keyboard.press('Escape')
  await expect(page.locator('[data-slot="dialog-content"]:visible')).toHaveCount(0)
}

async function openPlannerToolPanel(page: Parameters<typeof openModule>[0]) {
  const disclosure = page.locator('[data-planner-tools-disclosure]')
  if (await disclosure.isVisible()) {
    const expanded = await disclosure.getAttribute('aria-expanded')
    if (expanded !== 'true') await disclosure.click()
  }
  await expect(page.locator('#planner-experience-tools')).toBeVisible()
}

async function assertPlannerOwnsVerticalScroll(page: Parameters<typeof openModule>[0]) {
  const result = await page.evaluate(() => {
    const root = document.querySelector('[data-active-planner-module]')
    if (!root) return { found: false, canScroll: false, moved: false }
    const candidates = Array.from(root.querySelectorAll<HTMLElement>('*'))
      .filter((element) => {
        const style = getComputedStyle(element)
        return ['auto', 'scroll'].includes(style.overflowY) && element.clientHeight >= 120
      })
      .sort((a, b) => b.clientHeight - a.clientHeight)
    const target = candidates[0]
    if (!target) return { found: false, canScroll: false, moved: false }
    const canScroll = target.scrollHeight > target.clientHeight + 1
    const previous = target.scrollTop
    if (canScroll) target.scrollTop = Math.min(target.scrollHeight - target.clientHeight, Math.max(1, previous + 120))
    return { found: true, canScroll, moved: !canScroll || target.scrollTop > previous }
  })
  expect(result.found, 'planner module has an owned vertical scroll boundary').toBe(true)
  expect(result.moved, 'owned planner scroll boundary responds when content overflows').toBe(true)
}

test('worksheet import is actionable and viewport-safe across device classes', async ({ plannerPage: page }, testInfo) => {
  test.setTimeout(150_000)
  let templatePath = ''

  for (const viewport of DEVICE_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/planner?module=guests#planner-workspace')
    await openModule(page, 'guests')
    await openWorksheetTools(page)
    await expectNoDocumentOverflow(page)

    if (!templatePath) {
      const downloadPromise = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Template', exact: true }).click()
      const download = await downloadPromise
      templatePath = testInfo.outputPath('responsive-guests-template.xlsx')
      await download.saveAs(templatePath)

      const header = page.locator('[data-planner-portal] > header')
      const toastTitle = page.getByText('Template downloaded', { exact: true })
      await expect(toastTitle).toBeVisible()
      const headerBox = await header.boundingBox()
      const toastBox = await toastTitle.boundingBox()
      expect(headerBox).not.toBeNull()
      expect(toastBox).not.toBeNull()
      expect(toastBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1)
    }

    await page.getByRole('button', { name: 'Import', exact: true }).click()
    let dialog = await assertDialogGeometry(page, viewport)
    await dialog.locator('input[type="file"]').setInputFiles(templatePath)
    await expect(dialog.getByTestId('import-stat-rows').getByText('0', { exact: true })).toBeVisible()
    await expect(dialog.getByTestId('import-empty-preview')).toBeVisible()
    await expect(dialog.getByText('Blank template confirmed', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Review import', exact: true })).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Choose another file', exact: true })).toBeEnabled()
    await expect(dialog.getByRole('button', { name: 'Close preview', exact: true })).toBeEnabled()
    await expect(dialog.getByTestId('import-dialog-footer')).toBeInViewport()
    await dialog.getByRole('button', { name: 'Close preview', exact: true }).click()
    await expect(page.locator('[data-slot="dialog-content"]:visible')).toHaveCount(0)

    if (DATA_PREVIEW_VIEWPORTS.has(viewport.name)) {
      await page.getByRole('button', { name: 'Import', exact: true }).click()
      dialog = await assertDialogGeometry(page, viewport)
      const email = `responsive-${viewport.name}@example.test`
      const csv = [
        'First Name,Last Name,Display Name,Email,Phone',
        `Responsive,${viewport.name},Responsive ${viewport.name},${email},+263770000001`,
      ].join('\n')
      await dialog.locator('input[type="file"]').setInputFiles({
        name: `responsive-${viewport.name}.csv`,
        mimeType: 'text/csv',
        buffer: Buffer.from(csv, 'utf8'),
      })
      await expect(dialog.getByTestId('import-stat-rows').getByText('1', { exact: true })).toBeVisible()
      const reviewButton = dialog.getByRole('button', { name: 'Review import', exact: true })
      await expect(reviewButton).toBeEnabled()
      await expect(dialog.getByTestId('import-dialog-footer')).toBeInViewport()
      await reviewButton.click()
      await expect(dialog.getByRole('button', { name: 'Import now', exact: true })).toBeEnabled()
      await expect(dialog.getByText(/Import 1 records\?/)).toBeVisible()
      await dialog.getByRole('button', { name: 'Back', exact: true }).click()
      await expect(reviewButton).toBeEnabled()

      const mappingTrigger = dialog.locator('[data-slot="select-trigger"]').first()
      await mappingTrigger.click()
      const selectContent = page.locator('[data-slot="select-content"]:visible')
      await expect(selectContent).toBeVisible()
      const dialogZ = await dialog.evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex || '0', 10))
      const selectZ = await selectContent.evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex || '0', 10))
      expect(selectZ).toBeGreaterThan(dialogZ)
      await page.keyboard.press('Escape')
      await expect(selectContent).toHaveCount(0)
      await expect(dialog).toBeVisible()
      await closeVisibleDialog(page)
    }
  }
})

test('major planner tools share the responsive overlay contract', async ({ plannerPage: page }) => {
  test.setTimeout(150_000)
  const viewports = DEVICE_VIEWPORTS.filter((viewport) =>
    ['compact-phone', 'tablet-portrait', 'desktop'].includes(viewport.name),
  )
  const tools = [
    { name: /Team Hub/i },
    { name: /Edit client profile|Client profile/i },
    { name: /Daily Ops/i },
    { name: /Wedding Day/i },
    { name: /Intelligence/i },
  ]

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/planner#planner-workspace')
    await openPlannerToolPanel(page)

    for (const tool of tools) {
      const trigger = page.getByRole('button', { name: tool.name }).first()
      await expect(trigger).toBeVisible()
      await trigger.click()
      const dialog = await assertDialogGeometry(page, viewport)
      const scrollContract = await dialog.evaluate((element) => {
        const candidates = [element, ...Array.from(element.querySelectorAll<HTMLElement>('*'))]
        const scrollOwner = candidates.find((candidate) => {
          const style = getComputedStyle(candidate)
          return ['auto', 'scroll'].includes(style.overflowY) && candidate.clientHeight >= 100
        })
        if (!scrollOwner) return { found: false, usable: false }
        const canScroll = scrollOwner.scrollHeight > scrollOwner.clientHeight + 1
        const before = scrollOwner.scrollTop
        if (canScroll) scrollOwner.scrollTop = Math.min(scrollOwner.scrollHeight - scrollOwner.clientHeight, before + 100)
        return { found: true, usable: !canScroll || scrollOwner.scrollTop > before }
      })
      expect(scrollContract.found, `${String(tool.name)} owns a scroll boundary`).toBe(true)
      expect(scrollContract.usable, `${String(tool.name)} scroll boundary is usable`).toBe(true)
      await closeVisibleDialog(page)
      await openPlannerToolPanel(page)
    }

    await expectNoDocumentOverflow(page)
  }
})

test('all core planner modules retain an internal vertical scroll owner', async ({ plannerPage: page }) => {
  test.setTimeout(120_000)
  const modules = ['checklist', 'budget', 'vendors', 'guests', 'timeline', 'seating'] as const
  const viewports = DEVICE_VIEWPORTS.filter((viewport) =>
    ['compact-phone', 'tablet-landscape', 'desktop'].includes(viewport.name),
  )

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/planner#planner-workspace')
    for (const moduleKey of modules) {
      await openModule(page, moduleKey)
      await assertPlannerOwnsVerticalScroll(page)
      await expectNoDocumentOverflow(page)
    }
  }
})
