import { expect, test } from './support/planner-browser'

test('Contributions is a first-class Planner module with Overview entry and durable direct route', async ({ plannerPage }) => {
  const navigation = plannerPage.getByRole('navigation', { name: 'Planner workspace sections' })
  await expect(navigation.getByRole('button', { name: 'Contributions', exact: true })).toBeVisible()
  await expect(plannerPage.getByTestId('planner-contributions-overview')).toBeVisible()
  await plannerPage.getByRole('button', { name: 'Open Contributions', exact: true }).click()
  await expect(plannerPage).toHaveURL(/\/planner\/contributions(?:[?#]|$)/)
  await expect(plannerPage.locator('[data-active-planner-module]')).toHaveAttribute('data-active-planner-module', 'contributions')
  await expect(plannerPage.getByTestId('planner-contributions-workspace')).toBeVisible()
  await expect(plannerPage.getByRole('heading', { name: 'Who helped make this possible?' })).toBeVisible()
  await expect(plannerPage.locator('[data-planner-portal]')).toBeVisible()

  await plannerPage.goto('/planner/contributions#planner-workspace')
  await expect(plannerPage).toHaveURL(/\/planner\/contributions(?:[?#]|$)/)
  await expect(plannerPage.locator('[data-active-planner-module]')).toHaveAttribute('data-active-planner-module', 'contributions')
  await expect(plannerPage.locator('#active-wedding')).not.toHaveValue('')
  await expect(plannerPage.getByTestId('planner-contributions-workspace')).toBeVisible()
})

test('Planner can record a contribution and the private contributor profile persists after reload', async ({ plannerPage }) => {
  await plannerPage.goto('/planner/contributions#planner-workspace')
  const marker = `UAT Contribution ${Date.now()}`
  await plannerPage.getByRole('button', { name: 'Add', exact: true }).click()
  const dialog = plannerPage.getByRole('dialog', { name: 'Add contribution' })
  await expect(dialog).toBeVisible()
  await dialog.getByPlaceholder('Name or organisation').fill(marker)
  await dialog.getByRole('combobox', { name: 'Contributor type' }).selectOption('family')
  await dialog.getByPlaceholder('Email (optional)').fill('contribution-uat@example.com')
  await dialog.getByPlaceholder('Phone (optional)').fill('+263 77 000 0000')
  await dialog.getByPlaceholder("Relationship, e.g. Bride's aunt").fill('Family')
  await dialog.getByPlaceholder('Address (optional)').fill('Harare')
  await dialog.getByRole('combobox', { name: 'Preferred contributor contact' }).selectOption('email')
  await dialog.getByPlaceholder('What did they help with?').fill('Family wedding support')
  await dialog.getByPlaceholder('Amount').fill('125')
  await dialog.getByRole('button', { name: 'Save contribution' }).click()
  await expect(dialog).toBeHidden()
  await expect(plannerPage.getByText(marker, { exact: true }).first()).toBeVisible()

  const payload = await plannerPage.evaluate(async () => {
    const response = await fetch('/api/planner/contributions', { cache: 'no-store' })
    return response.json()
  }) as { contributors: Array<{ displayName: string; kind: string; email: string | null; phone: string | null; address: string | null; preferredContactMethod: string | null }> }
  const contributor = payload.contributors.find((person) => person.displayName === marker)
  expect(contributor).toMatchObject({ kind: 'family', email: 'contribution-uat@example.com', phone: '+263 77 000 0000', address: 'Harare', preferredContactMethod: 'email' })

  await plannerPage.reload()
  await expect(plannerPage.getByText(marker, { exact: true }).first()).toBeVisible()
})

test('Planner can create a governed non-honeymoon campaign privately', async ({ plannerPage }) => {
  await plannerPage.goto('/planner/contributions#planner-workspace')
  const title = `Future home ${Date.now()}`
  const campaign = plannerPage.locator('form').filter({ has: plannerPage.getByRole('combobox', { name: 'Campaign type' }) })
  await campaign.getByRole('combobox', { name: 'Campaign type' }).selectOption('HOME')
  await campaign.getByPlaceholder('Honeymoon fund').fill(title)
  await campaign.getByPlaceholder('Optional target').fill('500')
  await campaign.getByRole('button', { name: 'Create private campaign' }).click()
  await expect(plannerPage.getByText(title, { exact: true })).toBeVisible()
  await expect(plannerPage.getByText('Private', { exact: true }).last()).toBeVisible()
})

test('Contributions remains reachable through the mobile Planner section selector @mobile', async ({ plannerPage }) => {
  const selector = plannerPage.getByRole('combobox', { name: 'Planner workspace section' })
  await expect(selector).toBeVisible()
  await expect(selector.locator('option[value="contributions"]')).toHaveText('Contributions')
  await selector.selectOption('contributions')
  await expect(plannerPage).toHaveURL(/\/planner\/contributions(?:[?#]|$)/)
  await expect(selector).toHaveValue('contributions')
  await expect(plannerPage.getByTestId('planner-contributions-workspace')).toBeVisible()
})
