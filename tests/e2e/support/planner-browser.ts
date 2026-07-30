import { createHmac } from 'node:crypto'
import { expect, test as base, type Page } from '@playwright/test'
import {
  E2E_USER,
  E2E_WEDDINGS,
  resetPlannerE2EFixture,
} from './planner-fixture'

const SESSION_COOKIE = 'wewed_admin_auth'
const SESSION_SECRET = process.env.WEWED_SESSION_SECRET ?? ''

export const MODULE_LABELS = {
  checklist: 'Tasks',
  budget: 'Budget',
  vendors: 'Vendors',
  guests: 'Guests',
  timeline: 'Timeline',
  seating: 'Seating',
} as const

export type ModuleKey = keyof typeof MODULE_LABELS

function signedSession(activeWeddingId = E2E_WEDDINGS.primary.id): string {
  if (!SESSION_SECRET) throw new Error('WEWED_SESSION_SECRET is required for browser tests.')

  const payload = {
    version: 2,
    userId: E2E_USER.id,
    authUserId: E2E_USER.authUserId,
    email: E2E_USER.email,
    role: 'planner',
    coupleId: null,
    activeWeddingId,
    expiresAt: Date.now() + 60 * 60 * 1000,
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

async function openPlanner(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: SESSION_COOKIE,
      value: signedSession(),
      url: 'http://127.0.0.1:3000',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await page.goto('/planner')
  await expect(page.getByRole('heading', { name: E2E_WEDDINGS.primary.title })).toBeVisible()
  await expect(page.locator('#active-wedding')).toHaveValue(E2E_WEDDINGS.primary.id)
}

export async function openModule(page: Page, moduleKey: ModuleKey): Promise<void> {
  await page.getByTestId(`worksheet-module-${moduleKey}`).click()
  const workspaceNavigation = page.getByRole('navigation', {
    name: 'Planner workspace sections',
  })
  await expect(
    workspaceNavigation.getByRole('button', {
      name: MODULE_LABELS[moduleKey],
      exact: true,
    }),
  ).toHaveClass(/bg-gold/)
}

export function acceptNextConfirmation(page: Page): void {
  page.once('dialog', async (dialog) => dialog.accept())
}

export async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(overflow.width).toBeLessThanOrEqual(overflow.viewport + 1)
}

type PlannerFixtures = {
  plannerPage: Page
}

export const test = base.extend<PlannerFixtures>({
  plannerPage: async ({ page }, use, testInfo) => {
    await resetPlannerE2EFixture()
    const errors: string[] = []

    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`)
    })
    page.on('response', (response) => {
      if (response.status() >= 500 && response.url().includes('/api/')) {
        errors.push(`http ${response.status()}: ${response.url()}`)
      }
    })

    await openPlanner(page)
    await use(page)

    await testInfo.attach('planner-release-gate.png', {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    })
    expect(errors, 'browser/runtime errors').toEqual([])
  },
})

export { E2E_WEDDINGS, expect }
