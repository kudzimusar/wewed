import { createHmac } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { expect, test as base, type Page } from '@playwright/test'
import { resetPlannerE2EFixture } from './planner-fixture'

const SESSION_COOKIE = 'wewed_admin_auth'
const SESSION_SECRET = process.env.WEWED_SESSION_SECRET ?? ''

export const E2E_ADMIN = {
  id: 'e2e-wewed-super-admin',
  authUserId: 'e2e-wewed-super-admin-auth',
  email: 'admin.e2e@example.test',
  name: 'Wewed Admin E2E',
} as const

function assertSafeTarget(): void {
  const databaseUrl = process.env.DATABASE_URL?.toLowerCase() ?? ''
  const localDatabase = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')
  if (
    process.env.WEWED_E2E_MODE !== '1' ||
    process.env.CI !== 'true' ||
    process.env.VERCEL ||
    !localDatabase
  ) {
    throw new Error(
      'Refusing Admin E2E fixture setup outside explicit CI mode on a local PostgreSQL database.',
    )
  }
}

async function seedAdmin(): Promise<void> {
  assertSafeTarget()
  await resetPlannerE2EFixture()
  const prisma = new PrismaClient()
  try {
    await prisma.user.create({
      data: {
        id: E2E_ADMIN.id,
        email: E2E_ADMIN.email,
        name: E2E_ADMIN.name,
        role: 'admin',
        isActive: true,
      },
    })

    await prisma.$executeRawUnsafe(
      `INSERT INTO wewed_admin."BusinessAccountMember"
        (id, "businessAccountId", "userId", role, status, permissions)
       VALUES ($1, 'wewed-platform', $2, 'wewed_super_admin', 'active', '["*"]'::jsonb)`,
      'e2e-wewed-super-admin-membership',
      E2E_ADMIN.id,
    )

    const registry = await prisma.$queryRawUnsafe<Array<{ role: string; status: string }>>(
      `SELECT role, status
       FROM wewed_admin."PlatformAdministrator"
       WHERE "userId"=$1`,
      E2E_ADMIN.id,
    )
    if (registry[0]?.role !== 'wewed_super_admin' || registry[0]?.status !== 'active') {
      throw new Error('Admin E2E fixture did not create an active Super Admin registry record.')
    }
  } finally {
    await prisma.$disconnect()
  }
}

function signedSession(): string {
  if (!SESSION_SECRET) throw new Error('WEWED_SESSION_SECRET is required for Admin browser tests.')

  const payload = {
    version: 2,
    userId: E2E_ADMIN.id,
    authUserId: E2E_ADMIN.authUserId,
    email: E2E_ADMIN.email,
    role: 'admin',
    coupleId: null,
    activeWeddingId: null,
    expiresAt: Date.now() + 60 * 60 * 1000,
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

async function openAdmin(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: SESSION_COOKIE,
      value: signedSession(),
      url: 'http://127.0.0.1:3000',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await page.goto('/admin')
  await expect(page.locator('[data-admin-command-centre="true"]')).toBeVisible()
  await expect(page.getByText(E2E_ADMIN.email, { exact: true }).first()).toBeVisible()
}

export async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(overflow.width, 'Admin document width stays inside the viewport').toBeLessThanOrEqual(
    overflow.viewport + 1,
  )
}

type AdminFixtures = {
  adminPage: Page
}

export const test = base.extend<AdminFixtures>({
  adminPage: async ({ page }, providePage, testInfo) => {
    await seedAdmin()
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

    await openAdmin(page)
    await providePage(page)

    await testInfo.attach('admin-command-centre.png', {
      body: await page.screenshot({ animations: 'disabled', fullPage: true }),
      contentType: 'image/png',
    })
    expect(errors, 'Admin browser/runtime errors').toEqual([])
  },
})

export { expect }
