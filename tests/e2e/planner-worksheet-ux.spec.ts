import { createHmac } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import type { Page } from '@playwright/test'
import { E2E_WEDDINGS, expect, openModule, test } from './support/planner-browser'

const SESSION_COOKIE = 'wewed_admin_auth'
const SESSION_SECRET = process.env.WEWED_SESSION_SECRET ?? ''

function signedSession(input: {
  userId: string
  authUserId: string
  email: string
  role: 'couple' | 'planner'
  coupleId: string | null
  activeWeddingId: string
}): string {
  if (!SESSION_SECRET) throw new Error('WEWED_SESSION_SECRET is required for browser tests.')
  const payload = {
    version: 2,
    ...input,
    expiresAt: Date.now() + 60 * 60 * 1000,
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

async function useSession(page: Page, input: Parameters<typeof signedSession>[0]) {
  await page.context().addCookies([{ name: SESSION_COOKIE, value: signedSession(input), url: 'http://127.0.0.1:3000', httpOnly: true, sameSite: 'Lax' }])
}

test('Planner fixed-dark form controls stay readable under light and dark system themes', async ({ plannerPage: page }) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await openModule(page, 'budget')

    const description = page.locator('#workspace-budget-description')
    const estimate = page.locator('#workspace-budget-estimated-cost')
    const dueDate = page.locator('#workspace-budget-due-date')
    await description.fill(`Contrast ${colorScheme}`)
    await estimate.fill('987')
    await dueDate.fill('2027-04-20')

    for (const locator of [description, estimate, dueDate]) {
      const colours = await locator.evaluate((element) => {
        const computed = window.getComputedStyle(element)
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          colorScheme: computed.colorScheme,
          plannerText: computed.getPropertyValue('--planner-field-text').trim(),
        }
      })
      expect(colours.color).toBe('rgb(251, 246, 238)')
      expect(colours.backgroundColor).not.toBe(colours.color)
      expect(colours.plannerText.toLowerCase()).toBe('#fbf6ee')
      expect(colours.colorScheme).toContain('dark')
    }

    await expect(description).toHaveValue(`Contrast ${colorScheme}`)
    await expect(estimate).toHaveValue('987')
  }
})

test('shared worksheet tools print an A4 document and persist presentation order without changing task data', async ({ plannerPage: page }) => {
  const created = await page.request.post('/api/planner/tasks', {
    data: {
      title: 'Ordering gate second task',
      description: 'Synthetic task created only inside the ephemeral browser-test database.',
      category: 'venue',
      status: 'todo',
      priority: 'medium',
    },
  })
  expect(created.status()).toBe(201)

  await openModule(page, 'checklist')

  const trigger = page.getByTestId('planner-worksheet-command-trigger')
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page.getByRole('heading', { name: 'Tasks worksheet tools' })).toBeVisible()

  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: /Print full worksheet/ }).click()
  const printPage = await popupPromise
  await printPage.waitForLoadState('domcontentloaded')
  await expect(printPage.locator('text=Wewed Planner Workspace')).toBeVisible()
  await expect(printPage.locator('text=Tasks')).toBeVisible()
  const pageRule = await printPage.locator('style').textContent()
  expect(pageRule).toContain('@page { size: A4 portrait;')
  expect(pageRule).toContain('thead { display: table-header-group; }')
  await printPage.close()

  await page.getByRole('button', { name: 'Arrange', exact: true }).click()
  const arranged = page.locator('[data-planner-arrange-record]')
  const count = await arranged.count()
  expect(count).toBeGreaterThan(1)

  const firstId = await arranged.nth(0).getAttribute('data-planner-arrange-record')
  const secondId = await arranged.nth(1).getAttribute('data-planner-arrange-record')
  expect(firstId).toBeTruthy()
  expect(secondId).toBeTruthy()

  const firstTitle = (await arranged.nth(0).locator('p').first().textContent()) ?? ''
  const secondTitle = (await arranged.nth(1).locator('p').first().textContent()) ?? ''
  await arranged.nth(1).getByRole('button', { name: 'Move to top' }).click()

  const saveResponse = page.waitForResponse(
    (response) => response.url().includes('/api/planner/worksheet-order?module=tasks') && response.request().method() === 'PUT',
  )
  await page.getByRole('button', { name: 'Save order', exact: true }).click()
  expect((await saveResponse).ok()).toBe(true)

  const stored = await page.request.get('/api/planner/worksheet-order?module=tasks')
  expect(stored.ok()).toBe(true)
  const payload = (await stored.json()) as { data: string[] }
  expect(payload.data[0]).toBe(secondId)
  expect(payload.data[1]).toBe(firstId)

  await page.keyboard.press('Escape')
  await openModule(page, 'checklist')
  await expect(page.getByRole('heading', { name: firstTitle, exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: secondTitle, exact: true })).toBeVisible()
})

test('multi-select exposes safe task actions while excluding financial and timeline bulk overwrites', async ({ plannerPage: page }) => {
  await openModule(page, 'checklist')
  await page.getByTestId('planner-worksheet-command-trigger').click()
  await page.getByRole('button', { name: 'Select & act', exact: true }).click()
  await page.getByRole('button', { name: /Select all in current view/ }).click()

  const actionSelect = page.locator('[data-planner-worksheet-command-center] select').filter({ has: page.locator('option[value="move_top"]') }).first()
  await expect(actionSelect).toBeVisible()
  await expect(actionSelect.locator('option[value="status"]')).toHaveCount(1)
  await expect(actionSelect.locator('option[value="priority"]')).toHaveCount(1)
  await expect(actionSelect.locator('option[value="delete"]')).toHaveCount(1)

  await page.keyboard.press('Escape')
  await openModule(page, 'budget')
  await page.getByTestId('planner-worksheet-command-trigger').click()
  await page.getByRole('button', { name: 'Select & act', exact: true }).click()
  await page.getByRole('button', { name: /Select all in current view/ }).click()
  const budgetActions = page.locator('[data-planner-worksheet-command-center] select').filter({ has: page.locator('option[value="move_top"]') }).first()
  await expect(budgetActions.locator('option[value="category"]')).toHaveCount(1)
  await expect(budgetActions.locator('option[value="dueDate"]')).toHaveCount(1)
  await expect(budgetActions.locator('option[value="vendor"]')).toHaveCount(1)
  await expect(budgetActions.locator('option[value="paidAmount"]')).toHaveCount(0)
  await expect(budgetActions.locator('option[value="actualCost"]')).toHaveCount(0)
})

test('secure QR invitation requires explicit cross-account acceptance and revoked links fail closed', async ({ plannerPage: page }) => {
  const prisma = new PrismaClient()
  const owner = {
    userId: 'e2e-qr-owner',
    authUserId: 'e2e-qr-owner-auth',
    email: 'qr.owner@example.test',
    role: 'couple' as const,
    coupleId: E2E_WEDDINGS.primary.coupleId,
    activeWeddingId: E2E_WEDDINGS.primary.id,
  }
  const invitee = {
    userId: 'e2e-qr-invitee',
    authUserId: 'e2e-qr-invitee-auth',
    email: 'qr.invitee@example.test',
    role: 'planner' as const,
    coupleId: null,
    activeWeddingId: E2E_WEDDINGS.primary.id,
  }

  try {
    await prisma.user.create({
      data: {
        id: owner.userId,
        email: owner.email,
        name: 'QR Owner',
        role: owner.role,
        coupleId: owner.coupleId,
        currentWeddingId: owner.activeWeddingId,
        isActive: true,
      },
    })
    await prisma.user.create({
      data: {
        id: invitee.userId,
        email: invitee.email,
        name: 'QR Invitee',
        role: invitee.role,
        currentWeddingId: null,
        isActive: true,
      },
    })
    await prisma.weddingMembership.create({
      data: {
        id: 'e2e-qr-owner-membership',
        userId: owner.userId,
        weddingId: E2E_WEDDINGS.primary.id,
        role: 'owner',
        status: 'active',
        acceptedAt: new Date(),
      },
    })

    await useSession(page, owner)
    const createInvite = await page.request.post('/api/weddings/team-invites', {
      data: { role: 'planner', expiryHours: 24, inviteeEmail: invitee.email, note: 'Cross-account E2E planner invitation' },
    })
    expect(createInvite.status()).toBe(201)
    const createdPayload = (await createInvite.json()) as { data: { id: string; roleLabel: string }; joinUrl: string }
    expect(createdPayload.data.roleLabel).toBe('Planner')
    expect(createdPayload.joinUrl).toContain('/join/')
    const joinPath = new URL(createdPayload.joinUrl).pathname

    await useSession(page, invitee)
    await page.goto(joinPath)
    await expect(page.getByRole('heading', { name: E2E_WEDDINGS.primary.title })).toBeVisible()
    await expect(page.getByText('Planner', { exact: true })).toBeVisible()
    await expect(page.getByText('Scanning or opening this page does not grant access', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Accept invitation' }).click()
    await page.waitForURL(/\/planner\/overview/)

    const inviteeSession = await page.request.get('/api/auth/me')
    expect(inviteeSession.ok()).toBe(true)
    const inviteeSessionPayload = (await inviteeSession.json()) as { authorized: boolean; activeWedding?: { id?: string; membershipRole?: string } }
    expect(inviteeSessionPayload.authorized).toBe(true)
    expect(inviteeSessionPayload.activeWedding?.id).toBe(E2E_WEDDINGS.primary.id)
    expect(inviteeSessionPayload.activeWedding?.membershipRole).toBe('planner')

    const replay = await page.request.post(joinPath.replace('/join/', '/api/join/'))
    expect(replay.status()).toBe(410)

    await useSession(page, owner)
    const createAdminInvite = await page.request.post('/api/weddings/team-invites', {
      data: { role: 'admin', expiryHours: 24, inviteeEmail: invitee.email, note: 'Wedding-scoped admin E2E invitation' },
    })
    expect(createAdminInvite.status()).toBe(201)
    const adminPayload = (await createAdminInvite.json()) as { data: { id: string; roleLabel: string }; joinUrl: string }
    expect(adminPayload.data.roleLabel).toBe('Wedding / project admin')
    const revoke = await page.request.patch('/api/weddings/team-invites', {
      data: { inviteId: adminPayload.data.id, action: 'revoke' },
    })
    expect(revoke.ok()).toBe(true)

    await useSession(page, invitee)
    const revokedPath = new URL(adminPayload.joinUrl).pathname
    await page.goto(revokedPath)
    await expect(page.getByText('Wedding / project admin', { exact: true })).toBeVisible()
    await expect(page.getByText('No platform-wide Wewed administrator authority', { exact: true })).toBeVisible()
    await expect(page.getByText('This invitation is revoked.', { exact: false })).toBeVisible()
    const revokedAccept = await page.request.post(revokedPath.replace('/join/', '/api/join/'))
    expect(revokedAccept.status()).toBe(410)
  } finally {
    await prisma.$disconnect()
  }
})
