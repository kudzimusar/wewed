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
  await page.goto('/planner/overview#planner-workspace')
  await expect(page.getByRole('heading', { name: E2E_WEDDINGS.primary.title })).toBeVisible()
  await expect(page.locator('#active-wedding')).toHaveValue(E2E_WEDDINGS.primary.id)
}

function isModuleRoute(page: Page, routeKey: string): boolean {
  return new URL(page.url()).pathname.endsWith(`/planner/${routeKey}`)
}

export async function openModule(page: Page, moduleKey: ModuleKey): Promise<void> {
  const routeKey = moduleKey === 'checklist' ? 'tasks' : moduleKey
  const targetUrl = `/planner/${routeKey}#planner-workspace`

  try {
    const worksheetButton = page.getByTestId(`worksheet-module-${moduleKey}`)
    if (!(await worksheetButton.isVisible())) {
      const toggle = page.getByTestId('worksheet-tools-toggle')
      if (await toggle.isVisible()) {
        await toggle.click({ timeout: 2_500 })
        await expect(worksheetButton).toBeVisible({ timeout: 3_000 })
      } else {
        await page.goto(targetUrl)
      }
    }

    if (await worksheetButton.isVisible()) {
      await worksheetButton.click({ timeout: 3_000 })
      await page.waitForURL(new RegExp(`/planner/${routeKey}(?:[?#]|$)`), {
        timeout: 4_000,
      }).catch(() => null)
    }
  } catch {
    // The direct canonical route below is the deterministic fallback for a
    // pre-hydration click or a responsive navigation replacement.
  }

  if (!isModuleRoute(page, routeKey)) {
    await page.goto(targetUrl)
  }

  await expect(page).toHaveURL(new RegExp(`/planner/${routeKey}(?:[?#]|$)`))
  await expect(page.getByRole('heading', { name: E2E_WEDDINGS.primary.title })).toBeVisible()

  const worksheetToggle = page.getByTestId('worksheet-tools-toggle')
  if (await worksheetToggle.isVisible()) {
    // Module selection intentionally closes the compact worksheet panel. Wait
    // for that route transition to settle before a caller performs another
    // panel action, otherwise the old navigation can overwrite the new query.
    await expect.poll(() => new URL(page.url()).searchParams.get('panel')).not.toBe('worksheet')
    await expect(worksheetToggle).toHaveAttribute('aria-expanded', 'false')
  }

  const mobileSelector = page.getByRole('combobox', { name: 'Planner workspace section' })
  const workspaceNavigation = page.getByRole('navigation', { name: 'Planner workspace sections' })
  const responsiveState = await expect.poll(async () => {
    if (await mobileSelector.isVisible()) return 'mobile'
    if (await workspaceNavigation.isVisible()) return 'desktop'
    return 'pending'
  }, { timeout: 12_000 }).not.toBe('pending').then(async () => {
    if (await mobileSelector.isVisible()) return 'mobile' as const
    return 'desktop' as const
  })

  if (responsiveState === 'mobile') {
    await expect(mobileSelector).toHaveValue(routeKey)
  } else {
    const activeButton = workspaceNavigation.getByRole('button', {
      name: MODULE_LABELS[moduleKey],
      exact: true,
    })
    await expect(activeButton).toBeVisible()
    await expect(activeButton).toHaveClass(/bg-gold/)
  }
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
      if (message.type() !== 'error') return
      const text = message.text()
      const expectedClientValidation = /^Failed to load resource: the server responded with a status of 4\d\d\b/.test(text)
      if (!expectedClientValidation) errors.push(`console: ${text}`)
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