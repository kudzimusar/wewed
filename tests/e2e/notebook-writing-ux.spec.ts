import { expect, expectNoDocumentOverflow, test } from './support/planner-browser'

async function expectCompactNotebookActionRow(page: Parameters<typeof expectNoDocumentOverflow>[0]) {
  const checkpoint = page.getByRole('button', { name: /Save checkpoint/ })
  const trash = page.locator('button[title="Trash"]')
  await expect(checkpoint).toBeVisible()
  await expect(trash).toBeVisible()

  const checkpointBox = await checkpoint.boundingBox()
  const trashBox = await trash.boundingBox()
  expect(checkpointBox).not.toBeNull()
  expect(trashBox).not.toBeNull()
  expect(Math.abs((checkpointBox?.y ?? 0) - (trashBox?.y ?? 0))).toBeLessThan(4)
  expect(await checkpoint.evaluate((element) => getComputedStyle(element).fontSize)).toBe('0px')
  await expectNoDocumentOverflow(page)
}

test('Notebook renders writing, exposes AI guidance, and keeps autosave separate from checkpoints', async ({ plannerPage: page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/planner/notebook')
  await expect(page.getByRole('heading', { name: 'Notebook', exact: true })).toBeVisible()

  const createdResponse = page.waitForResponse(
    (response) => response.url().endsWith('/api/notebook') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'New note', exact: true }).click()
  expect((await createdResponse).ok()).toBe(true)

  const title = page.getByPlaceholder('Note title')
  const editor = page.getByPlaceholder(/Start writing/)
  await expect(editor).toBeVisible()
  await title.fill('Notebook UX release test')
  await editor.fill([
    '## Budget review',
    '',
    '**Approved:** Chairs are quoted at $460.',
    '',
    '> Verify the final invoice before payment.',
    '',
    '[Vendor site](https://example.com)',
  ].join('\n'))

  const saveStatus = page.locator('span.mr-1.text-xs.opacity-55').filter({ hasText: /^Saved$/ })
  await expect(saveStatus).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/Saved · v\d+/)).toHaveCount(0)
  await expectCompactNotebookActionRow(page)

  await page.setViewportSize({ width: 320, height: 760 })
  await expectCompactNotebookActionRow(page)
  await page.setViewportSize({ width: 390, height: 844 })

  await page.getByRole('button', { name: 'Read', exact: true }).click()
  const rendered = page.locator('[data-notebook-rendered-markdown]').first()
  await expect(rendered).toBeVisible()
  await expect(rendered.getByRole('heading', { name: 'Budget review' })).toBeVisible()
  await expect(rendered.getByText('Approved:', { exact: true })).toBeVisible()
  await expect(rendered.locator('strong')).toContainText('Approved:')
  await expect(rendered.locator('blockquote')).toContainText('Verify the final invoice before payment.')
  await expect(rendered.getByRole('link', { name: 'Vendor site' })).toHaveAttribute('href', 'https://example.com')
  await expect(rendered.getByText('**Approved:**', { exact: true })).toHaveCount(0)
  expect(await rendered.evaluate((element) => getComputedStyle(element).fontSize)).toBe('14px')
  expect(await title.evaluate((element) => getComputedStyle(element).fontSize)).toBe('20px')

  await page.locator('button[title="AI & suggested actions"]').click()
  const aiGuide = page.locator('[data-notebook-ai-guide]')
  await expect(aiGuide).toBeVisible()
  await expect(aiGuide.getByText('Use AI in 3 steps')).toBeVisible()
  await expect(aiGuide.getByText('Proposed', { exact: true })).toBeVisible()
  await expect(aiGuide.getByText('Quoted', { exact: true })).toBeVisible()
  await expect(page.locator('[data-notebook-suggest-actions]')).toBeVisible()
  await expect(page.locator('[data-notebook-suggest-actions]')).toContainText('Suggest Wewed actions')
  await expectNoDocumentOverflow(page)
  await page.getByRole('button', { name: 'Close panel' }).click()

  await page.locator('button[title="Saved history"]').click()
  await expect(page.getByText('Note created', { exact: true })).toBeVisible()
  await expect(page.getByText('Saved checkpoint', { exact: true })).toHaveCount(0)
  await expect(page.getByText(/Earlier autosave history/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Close panel' }).click()

  await page.getByRole('button', { name: /Save checkpoint/ }).click()
  await expect(page.getByText(/Checkpoint saved\.|already protected in history/)).toBeVisible({ timeout: 10_000 })

  await page.locator('button[title="Saved history"]').click()
  await expect(page.getByText('Saved checkpoint', { exact: true })).toBeVisible()
  await expect(page.getByText(/Earlier autosave history/)).toHaveCount(0)
  await expectNoDocumentOverflow(page)
})
