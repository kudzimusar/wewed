import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'
import { E2E_WEDDINGS } from './support/planner-fixture'
import { resetUnifiedNavigationFixture } from './support/unified-navigation-fixture'

test('classic canonical wedding keeps premium locked presentation on mobile @mobile', async ({ page }, testInfo) => {
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
  await page.goto(`/w/${E2E_WEDDINGS.primary.slug}`)

  const main = page.locator('#main-content[data-canonical-template="classic"]')
  await expect(main).toBeVisible()
  await expect(main).toContainText('Aurora')
  await expect(main).toContainText('Blake')
  await expect(main).not.toContainText('Partner One')
  await expect(main).not.toContainText('Charity')
  await expect(main).not.toContainText('Kudzie')

  const hero = page.locator('#home')
  await expect(hero.getByText('Counting the moments until forever', { exact: true })).toBeVisible()

  const uploader = page.locator('[data-classic-section="media-upload"]')
  await expect(uploader.getByTestId('classic-media-dropzone')).toBeVisible()
  await expect(uploader.getByTestId('media-upload-locked-notice')).toBeVisible()

  const wall = page.locator('[data-classic-section="live-wall"]')
  await expect(wall.getByTestId('classic-live-wall-composer')).toBeVisible()
  await expect(wall.getByTestId('live-wall-locked-notice')).toBeVisible()

  const capsule = page.locator('[data-classic-section="memory-capsule"]')
  await expect(capsule.getByTestId('memory-capsule-locked-notice')).toBeVisible()
  await expect(capsule.getByTestId('memory-capsule-record')).toBeDisabled()

  await hero.screenshot({ path: testInfo.outputPath('mobile-classic-hero.png') })
  await uploader.screenshot({ path: testInfo.outputPath('mobile-rich-locked-uploader.png') })
})
