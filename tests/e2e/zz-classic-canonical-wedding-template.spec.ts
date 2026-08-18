import { createHmac } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'
import { E2E_COUPLE } from './support/marketplace-fixture'
import { E2E_USER, E2E_WEDDINGS } from './support/planner-fixture'
import { resetUnifiedNavigationFixture } from './support/unified-navigation-fixture'

const SECRET = process.env.WEWED_SESSION_SECRET ?? ''

function appToken(
  user: { id: string; authUserId: string; email: string },
  role: 'couple' | 'planner',
  weddingId: string,
) {
  const payload = {
    version: 2,
    userId: user.id,
    authUserId: user.authUserId,
    email: user.email,
    role,
    coupleId: role === 'couple' ? E2E_WEDDINGS.primary.coupleId : null,
    activeWeddingId: weddingId,
    expiresAt: Date.now() + 3_600_000,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${createHmac('sha256', SECRET).update(encoded).digest('base64url')}`
}

async function signIn(page: import('@playwright/test').Page, value: string) {
  await page.context().clearCookies()
  await page.context().addCookies([
    {
      name: 'wewed_admin_auth',
      value,
      url: 'http://127.0.0.1:3000',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
}

async function installFakeMediaCapture(page: import('@playwright/test').Page) {
  await page.addInitScript({
    content: `
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] })
        }
      });
      class FakeMediaRecorder {
        static isTypeSupported() { return true; }
        constructor(stream, options = {}) {
          this.stream = stream;
          this.mimeType = options.mimeType || 'video/webm';
          this.state = 'inactive';
          this.ondataavailable = null;
          this.onstop = null;
          this.onerror = null;
        }
        start() { this.state = 'recording'; }
        stop() {
          this.state = 'inactive';
          if (this.ondataavailable) {
            this.ondataavailable({ data: new Blob(['wewed-e2e'], { type: this.mimeType }) });
          }
          if (this.onstop) this.onstop();
        }
      }
      window.MediaRecorder = FakeMediaRecorder;
    `,
  })
}

function runtimeErrors(page: import('@playwright/test').Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`)
  })
  return errors
}

async function expectClassicTemplate(
  page: import('@playwright/test').Page,
  identity: { partner1: string; partner2: string; venue: string },
) {
  const main = page.locator('#main-content[data-canonical-template="classic"]')
  await expect(main).toBeVisible()
  await expect(main).toContainText(identity.partner1)
  await expect(main).toContainText(identity.partner2)
  await expect(main).toContainText(identity.venue)
  await expect(main).not.toContainText('Partner One')
  await expect(main).not.toContainText('Partner Two')
  await expect(main).not.toContainText('Add your venue')

  for (const marker of [
    'wedding-party',
    'travel-stay',
    'gift-registry',
    'gallery',
    'media-upload',
    'memory-capsule',
    'live-wall',
    'vendor-marketplace',
    'platform-vision',
  ]) {
    await expect(page.locator(`[data-classic-section="${marker}"]`)).toBeAttached()
  }

  const capsule = page.locator('[data-classic-section="memory-capsule"]')
  const record = capsule.getByRole('button', { name: 'Start recording your message' })
  await record.scrollIntoViewIfNeeded()
  await expect(record).toBeVisible()
  await record.click()
  await expect(capsule.getByText('Recording', { exact: true })).toBeVisible()
  await expect(capsule.getByRole('button', { name: 'Cancel' })).toBeVisible()
  await capsule.getByRole('button', { name: 'Cancel' }).click()
  await expect(record).toBeVisible()

  const gallery = page.locator('[data-classic-section="gallery"]')
  await expect(gallery.getByText('The Gallery', { exact: true })).toBeVisible()
  await expect(gallery.getByRole('button', { name: 'All', exact: true })).toBeVisible()
  await expect(gallery.getByRole('button', { name: 'Ceremony', exact: true })).toBeVisible()

  const uploader = page.locator('[data-classic-section="media-upload"]')
  await expect(uploader.getByTestId('classic-media-dropzone')).toBeVisible()
  await expect(uploader.getByText('Default moment', { exact: true })).toBeVisible()

  const wall = page.locator('[data-classic-section="live-wall"]')
  await expect(wall.getByTestId('classic-live-wall-composer')).toBeVisible()

  const vendors = page.locator('[data-classic-section="vendor-marketplace"]')
  await expect(vendors.getByRole('link', { name: /Apply as Vendor/i })).toBeVisible()
}

test('classic premium renderer survives database canonicalization for two isolated weddings', async ({ page }, testInfo) => {
  await resetUnifiedNavigationFixture()
  await installFakeMediaCapture(page)
  const errors = runtimeErrors(page)

  await signIn(page, appToken(E2E_COUPLE, 'couple', E2E_WEDDINGS.primary.id))
  await page.goto(`/w/${E2E_WEDDINGS.primary.slug}`)
  await expectClassicTemplate(page, {
    partner1: 'Aurora',
    partner2: 'Blake',
    venue: 'Primary Test Estate',
  })
  const primaryMain = page.locator('#main-content')
  await expect(primaryMain).not.toContainText('Charity')
  await expect(primaryMain).not.toContainText('Kudzie')
  await expect(primaryMain).not.toContainText('Imba Manor')
  await page.locator('#home').screenshot({ path: testInfo.outputPath('primary-classic-hero.png') })

  await signIn(page, appToken(E2E_USER, 'planner', E2E_WEDDINGS.secondary.id))
  await page.goto(`/w/${E2E_WEDDINGS.secondary.slug}`)
  await expectClassicTemplate(page, {
    partner1: 'Cedar',
    partner2: 'Drew',
    venue: 'Secondary Test Gardens',
  })
  const secondaryMain = page.locator('#main-content')
  await expect(secondaryMain).not.toContainText('Aurora')
  await expect(secondaryMain).not.toContainText('Blake')
  await expect(secondaryMain).not.toContainText('Charity')
  await expect(secondaryMain).not.toContainText('Kudzie')
  await expect(secondaryMain).not.toContainText('Imba Manor')
  await expect(secondaryMain).not.toContainText('23 · 12 · 26')
  await expect(secondaryMain).not.toContainText('Musarurwa')

  expect(errors).toEqual([])
})

test('public classic surface keeps rich contribution UI but locks all writes', async ({ page }, testInfo) => {
  await resetUnifiedNavigationFixture()
  const prisma = new PrismaClient()
  try {
    await prisma.wedding.update({
      where: { id: E2E_WEDDINGS.primary.id },
      data: { privacy: 'public' },
    })
  } finally {
    await prisma.$disconnect()
  }

  await page.context().clearCookies()
  const errors = runtimeErrors(page)
  await page.goto(`/w/${E2E_WEDDINGS.primary.slug}`)

  const uploader = page.locator('[data-classic-section="media-upload"]')
  await expect(uploader.getByTestId('classic-media-dropzone')).toBeVisible()
  await expect(uploader.getByTestId('media-upload-locked-notice')).toBeVisible()
  await expect(uploader.locator('input[type="file"]')).toBeDisabled()

  const wall = page.locator('[data-classic-section="live-wall"]')
  await expect(wall.getByTestId('classic-live-wall-composer')).toBeVisible()
  await expect(wall.getByTestId('live-wall-locked-notice')).toBeVisible()
  await expect(wall.getByPlaceholder(/invitation required to post/i)).toBeDisabled()

  const capsule = page.locator('[data-classic-section="memory-capsule"]')
  await expect(capsule.getByTestId('memory-capsule-locked-notice')).toBeVisible()
  await expect(capsule.getByTestId('memory-capsule-record')).toBeDisabled()

  await uploader.screenshot({ path: testInfo.outputPath('public-rich-locked-uploader.png') })
  expect(errors).toEqual([])
})
