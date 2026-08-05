import { expect, openModule, openWorksheetActions, test } from './support/planner-browser'

const DEVICE_VIEWPORTS = [
  { name: 'compact-phone', width: 360, height: 640 },
  { name: 'tall-phone', width: 390, height: 844 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'small-laptop', width: 1280, height: 720 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

const DATA_PREVIEW_VIEWPORTS = new Set(['compact-phone', 'tablet-portrait', 'desktop'])

async function stableBoundingBox(locator: import('@playwright/test').Locator) {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return box!
}

async function expectNoDocumentOverflow(page: Parameters<typeof openModule>[0]) {
  await expect.poll(async () => page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))).toEqual(expect.objectContaining({ width: expect.any(Number), viewport: expect.any(Number) }))

  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport + 1)
}

async function openWorksheetTools(page: Parameters<typeof openModule>[0]) {
  await openWorksheetActions(page)
  const actions = page.locator('#planner-worksheet-actions')
  await expect(actions).toBeVisible()
  await expect(actions.getByRole('button', { name: 'Template', exact: true })).toBeVisible()
  await expect(actions.getByRole('button', { name: 'Import', exact: true })).toBeVisible()
}

async function assertDialogGeometry(
  page: Parameters<typeof openModule>[0],
  viewport: { width: number; height: number },
) {
  const dialog = page.locator('[data-slot="dialog-content"]:visible').last()
  await expect(dialog).toBeVisible()
  const box = await stableBoundingBox(dialog)
  expect(box.x).toBeGreaterThanOrEqual(-1)
  expect(box.y).toBeGreaterThanOrEqual(-1)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)

  const title = dialog.locator('[data-slot="dialog-title"]').first()
  const titleClasses = await title.getAttribute('class')
  if (await title.isVisible() && !titleClasses?.split(/\s+/).includes('sr-only')) {
    await expect(title).toBeInViewport()
  }

  const closeButtons = dialog.locator('[data-slot="dialog-close"]')
  const geometryTolerance = 4
  for (let index = 0; index < await closeButtons.count(); index += 1) {
    const closeButton = closeButtons.nth(index)
    if (!(await closeButton.isVisible())) continue
    const closeBox = await stableBoundingBox(closeButton)
    expect(closeBox.x).toBeGreaterThanOrEqual(box.x - geometryTolerance)
    expect(closeBox.y).toBeGreaterThanOrEqual(box.y - geometryTolerance)
    expect(closeBox.x + closeBox.width).toBeLessThanOrEqual(box.x + box.width + geometryTolerance)
    expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(box.y + box.height + geometryTolerance)
    if (viewport.width < 640) {
      expect(closeBox.width).toBeGreaterThanOrEqual(40)
      expect(closeBox.height).toBeGreaterThanOrEqual(40)
    }
  }

  return dialog
}

async function closeVisibleDialog(page: Parameters<typeof openModule>[0]) {
  const dialog = page.locator('[data-slot="dialog-content"]:visible').last()
  const sharedClose = dialog.locator('[data-slot="dialog-close"]').first()
  if (await sharedClose.isVisible()) {
    await sharedClose.click()
  } else {
    const customClose = dialog.getByRole('button', { name: /^close/i }).first()
    if (await customClose.isVisible()) await customClose.click()
    else await page.keyboard.press('Escape')
  }
  await expect(page.locator('[data-slot="dialog-content"]:visible')).toHaveCount(0)
}

async function openPlannerToolPanel(page: Parameters<typeof openModule>[0]) {
  const disclosure = page.locator('[data-planner-tools-disclosure]')
  const tools = page.locator('#planner-experience-tools')

  await expect(page.getByRole('combobox', { name: 'Active wedding' })).toBeVisible()
  await expect(disclosure).toBeVisible()

  if (!(await tools.isVisible())) {
    // A tool action closes the panel and updates the URL asynchronously. Wait
    // for that close transition to settle before requesting the next open.
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    await disclosure.click()
  }

  await expect(disclosure).toHaveAttribute('aria-expanded', 'true')
  await expect(tools).toBeVisible()
  await expect(page).toHaveURL(/panel=experience/)
}

async function assertPlannerOwnsVerticalScroll(page: Parameters<typeof openModule>[0]) {
  const result = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-active-planner-module]')
    if (!root) return { found: false, overflowFound: false, moved: false }

    const candidates = new Set<HTMLElement>()
    let ancestor: HTMLElement | null = root
    while (ancestor) {
      candidates.add(ancestor)
      ancestor = ancestor.parentElement
    }
    for (const descendant of root.querySelectorAll<HTMLElement>('*')) candidates.add(descendant)

    const scrollOwners = Array.from(candidates).filter((element) => {
      const style = getComputedStyle(element)
      return ['auto', 'scroll'].includes(style.overflowY) && element.clientHeight >= 100
    })
    if (!scrollOwners.length) return { found: false, overflowFound: false, moved: false }

    let overflowFound = false
    for (const owner of scrollOwners) {
      if (owner.scrollHeight <= owner.clientHeight + 1) continue
      overflowFound = true
      owner.scrollTop = 0
      const origin = owner.scrollTop
      owner.scrollTop = Math.min(owner.scrollHeight - owner.clientHeight, 120)
      if (owner.scrollTop > origin) {
        owner.scrollTop = 0
        return { found: true, overflowFound: true, moved: true }
      }
    }

    return { found: true, overflowFound, moved: !overflowFound }
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
      const headerBox = await stableBoundingBox(header)
      const toastBox = await stableBoundingBox(toastTitle)
      expect(toastBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1)
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
      await openWorksheetActions(page)
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
      if (viewport.width < 768) {
        const cards = dialog.getByTestId('import-review-cards')
        await expect(cards).toBeVisible()
        await expect(cards.getByText('Row 2', { exact: true })).toBeVisible()
        await expect(cards.getByText(email, { exact: true })).toBeVisible()
      } else {
        const tableScroll = dialog.getByTestId('import-review-table-scroll')
        const rowHeader = tableScroll.getByTestId('import-review-row-header')
        await expect(tableScroll).toBeVisible()
        await expect(rowHeader).toBeVisible()
        await tableScroll.evaluate((element) => {
          element.scrollTop = element.scrollHeight
          element.scrollLeft = element.scrollWidth
        })
        await expect(rowHeader).toBeVisible()
        const scrollBox = await stableBoundingBox(tableScroll)
        const headerBox = await stableBoundingBox(rowHeader)
        expect(headerBox.y).toBeLessThanOrEqual(scrollBox.y + 2)
        expect(headerBox.y + headerBox.height).toBeGreaterThanOrEqual(scrollBox.y + 1)
      }
      const reviewButton = dialog.getByRole('button', { name: 'Review import', exact: true })
      await expect(reviewButton).toBeEnabled()
      await expect(dialog.getByTestId('import-dialog-footer')).toBeInViewport()
      await reviewButton.click()
      await expect(dialog.getByRole('button', { name: 'Import now', exact: true })).toBeEnabled()
      await expect(dialog.getByText(/Import 1 records\?/)).toBeVisible()
      const confirmationRecords = dialog.getByTestId('import-confirmation-records')
      await expect(confirmationRecords).toBeVisible()
      await expect(confirmationRecords.getByText(email, { exact: true })).toBeVisible()
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
        const scrollOwners = candidates.filter((candidate) => {
          const style = getComputedStyle(candidate)
          return ['auto', 'scroll'].includes(style.overflowY) && candidate.clientHeight >= 100
        })
        const overflowing = candidates.some((candidate) =>
          candidate.clientHeight >= 100 && candidate.scrollHeight > candidate.clientHeight + 1,
        )
        if (!scrollOwners.length) return { found: !overflowing, usable: !overflowing }

        let overflowFound = false
        for (const owner of scrollOwners) {
          if (owner.scrollHeight <= owner.clientHeight + 1) continue
          overflowFound = true
          owner.scrollTop = 0
          const origin = owner.scrollTop
          owner.scrollTop = Math.min(owner.scrollHeight - owner.clientHeight, 100)
          if (owner.scrollTop > origin) {
            owner.scrollTop = 0
            return { found: true, usable: true }
          }
        }
        return { found: true, usable: !overflowFound }
      })
      expect(scrollContract.found, `${String(tool.name)} is contained or owns a scroll boundary`).toBe(true)
      expect(scrollContract.usable, `${String(tool.name)} scroll boundary is usable when needed`).toBe(true)
      await closeVisibleDialog(page)
      await openPlannerToolPanel(page)
    }

    await expectNoDocumentOverflow(page)
  }
})

test('all core planner modules retain an internal vertical scroll owner', async ({ plannerPage: page }) => {
  test.setTimeout(120_000)
  const modules = ['checklist', 'budget', 'vendors', 'guests', 'timeline', 'seating'] as const

  for (const module of modules) {
    await page.goto(`/planner?module=${module}#planner-workspace`)
    await openModule(page, module)
    await assertPlannerOwnsVerticalScroll(page)
  }
})
