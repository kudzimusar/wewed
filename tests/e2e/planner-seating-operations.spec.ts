import {
  E2E_WEDDINGS,
  acceptNextConfirmation,
  expect,
  expectNoDocumentOverflow,
  openModule,
  test,
} from './support/planner-browser'

async function createGuest(page: Parameters<typeof openModule>[0], name: string) {
  const response = await page.request.post('/api/planner/guests', {
    data: { kind: 'guest', name, role: 'guest', side: 'neutral' },
  })
  expect(response.status()).toBe(201)
  return (await response.json()) as { data: { id: string; name: string } }
}

async function createTable(
  page: Parameters<typeof openModule>[0],
  input: { name: string; capacity: number; tableType: string; zone: string; notes?: string },
) {
  const response = await page.request.post('/api/planner/guests', {
    data: { kind: 'table', tableName: input.name, ...input },
  })
  expect(response.status()).toBe(201)
  return (await response.json()) as { data: { id: string; name: string; capacity: number } }
}

test('seating tables expose operational type, zone, green/red status, bulk moves, and safe deletion', async ({ plannerPage: page }) => {
  await openModule(page, 'seating')

  await page.getByRole('button', { name: /Add table/ }).click()
  await page.locator('#seating-new-name').fill('E2E VIP Parents Table')
  await page.locator('#seating-new-type').selectOption('vip_parents')
  await page.locator('#seating-new-capacity').fill('2')
  await page.locator('#seating-new-zone').fill('Front left')
  await page.locator('#seating-new-notes').fill('Parents and guardians')
  await page.getByRole('button', { name: 'Create', exact: true }).click()

  const tableCard = page.locator('[data-seating-table-id]').filter({ hasText: 'E2E VIP Parents Table' })
  await expect(tableCard).toBeVisible()
  await expect(tableCard).toHaveAttribute('data-seating-type', 'vip_parents')
  await expect(tableCard).toHaveAttribute('data-seating-status', 'available')
  await expect(tableCard).toContainText('VIP — parents')
  await expect(tableCard).toContainText('Front left')
  await expect(tableCard).toContainText('Parents and guardians')

  const duplicate = await page.request.post('/api/planner/guests', {
    data: {
      kind: 'table',
      tableName: 'e2e vip parents table',
      capacity: 2,
      tableType: 'vip_parents',
    },
  })
  expect(duplicate.status()).toBe(409)

  const first = await createGuest(page, 'E2E Seating Guest One')
  const second = await createGuest(page, 'E2E Seating Guest Two')
  await page.reload()
  await expect(page.getByText('E2E Seating Guest One', { exact: true })).toBeVisible()

  await page.getByLabel('Select guest E2E Seating Guest One').check()
  await page.getByLabel('Select guest E2E Seating Guest Two').check()
  await expect(page.locator('[data-seating-bulk-bar]')).toContainText('2 guest records selected')
  await page.getByLabel('Bulk seating destination').selectOption({ label: /E2E VIP Parents Table/ })
  const bulkResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/planner/guests') && response.request().method() === 'PATCH',
  )
  await page.getByRole('button', { name: 'Move selected' }).click()
  expect((await bulkResponse).ok()).toBe(true)
  await expect(tableCard).toHaveAttribute('data-seating-status', 'full')
  await expect(tableCard).toContainText('Full · 2/2')

  await page.getByRole('button', { name: 'Edit E2E VIP Parents Table' }).click()
  await page.locator('[id^="seating-edit-capacity-"]').fill('1')
  const blockedResponse = page.waitForResponse((response) =>
    response.url().includes('/api/planner/guests/')
      && response.url().includes('kind=table')
      && response.request().method() === 'PATCH',
  )
  await page.getByRole('button', { name: 'Save table' }).click()
  expect((await blockedResponse).status()).toBe(409)
  await expect(page.getByText(/currently requires 2 planned seats/)).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()

  const secondaryIsolation = await page.request.patch('/api/planner/guests', {
    data: {
      kind: 'bulk_assignment',
      guestIds: [first.data.id, second.data.id],
      seatingTableId: `${E2E_WEDDINGS.secondary.id}-table`,
    },
  })
  expect(secondaryIsolation.status()).toBe(400)

  acceptNextConfirmation(page)
  await page.getByRole('button', { name: 'Delete E2E VIP Parents Table' }).click()
  await expect(page.getByText('E2E VIP Parents Table', { exact: true })).toHaveCount(0)
  await expect(page.getByText('E2E Seating Guest One', { exact: true })).toBeVisible()
  await expect(page.getByText('E2E Seating Guest Two', { exact: true })).toBeVisible()

  const state = await page.request.get('/api/planner/guests')
  const payload = (await state.json()) as {
    data: Array<{ id: string; seatingTableId: string | null }>
    tables: Array<{ name: string }>
  }
  expect(payload.tables.some((table) => table.name === 'E2E VIP Parents Table')).toBe(false)
  expect(payload.data.filter((guest) => [first.data.id, second.data.id].includes(guest.id)).every((guest) => guest.seatingTableId === null)).toBe(true)
})

test('server rejects over-capacity individual and bulk moves atomically', async ({ plannerPage: page }) => {
  const table = await createTable(page, {
    name: 'E2E Capacity Guard Table',
    capacity: 1,
    tableType: 'ordinary',
    zone: 'Zone A',
  })
  const first = await createGuest(page, 'E2E Capacity First')
  const second = await createGuest(page, 'E2E Capacity Second')

  const firstMove = await page.request.patch(`/api/planner/guests/${first.data.id}`, {
    data: { seatingTableId: table.data.id },
  })
  expect(firstMove.ok()).toBe(true)

  const secondMove = await page.request.patch(`/api/planner/guests/${second.data.id}`, {
    data: { seatingTableId: table.data.id },
  })
  expect(secondMove.status()).toBe(409)

  const bulkMove = await page.request.patch('/api/planner/guests', {
    data: {
      kind: 'bulk_assignment',
      guestIds: [first.data.id, second.data.id],
      seatingTableId: table.data.id,
    },
  })
  expect(bulkMove.status()).toBe(409)

  const state = await page.request.get('/api/planner/guests')
  const payload = (await state.json()) as { data: Array<{ id: string; seatingTableId: string | null }> }
  expect(payload.data.find((guest) => guest.id === first.data.id)?.seatingTableId).toBe(table.data.id)
  expect(payload.data.find((guest) => guest.id === second.data.id)?.seatingTableId).toBeNull()
})

test('a 230-seat Imba Manor plan remains usable on desktop and mobile', async ({ plannerPage: page }) => {
  const seededDelete = await page.request.delete(`/api/planner/guests/${E2E_WEDDINGS.primary.id}-table?kind=table`)
  expect(seededDelete.ok()).toBe(true)

  const plan = [
    { name: 'High Table', capacity: 10, tableType: 'high', zone: 'Stage centre' },
    { name: 'VIP Parents — Bride', capacity: 10, tableType: 'vip_parents', zone: 'Front left' },
    { name: 'VIP Parents — Groom', capacity: 10, tableType: 'vip_parents', zone: 'Front right' },
    { name: 'VIP Friends — Bride', capacity: 10, tableType: 'vip_friends', zone: 'Front left centre' },
    { name: 'VIP Friends — Groom', capacity: 10, tableType: 'vip_friends', zone: 'Front right centre' },
    ...Array.from({ length: 18 }, (_, index) => ({
      name: `Ordinary Table ${String(index + 1).padStart(2, '0')}`,
      capacity: 10,
      tableType: 'ordinary',
      zone: `Zone ${String.fromCharCode(65 + Math.floor(index / 6))}`,
    })),
  ]
  for (const table of plan) await createTable(page, table)

  await openModule(page, 'seating')
  await page.reload()
  const capacitySummary = page.locator('section').filter({ hasText: 'Total planned seats' }).first()
  await expect(capacitySummary).toContainText('230')
  await expect(page.locator('[data-seating-table-id]')).toHaveCount(23)
  await expect(page.getByText('High Table', { exact: true })).toBeVisible()
  await page.getByLabel('Filter seating by table type').selectOption('vip_parents')
  await expect(page.locator('[data-seating-type="vip_parents"]')).toHaveCount(2)
  await page.getByRole('button', { name: 'Reset' }).click()
  await expectNoDocumentOverflow(page)

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('[data-seating-operations]')).toBeVisible()
  await expect(page.getByRole('button', { name: /Add table/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Print plan' })).toBeVisible()
  await expectNoDocumentOverflow(page)

  const data = await page.request.get('/api/planner/guests')
  const payload = (await data.json()) as { data: unknown[]; tables: Array<{ capacity: number }> }
  expect(payload.tables).toHaveLength(23)
  expect(payload.tables.reduce((sum, table) => sum + table.capacity, 0)).toBe(230)
  expect(payload.data).toHaveLength(1)
})
