import { expect, test } from '@playwright/test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const OFFICIAL_ORIGIN = 'https://wewed.pro'
const LEGACY_DOMAIN = ['wewed', 'app'].join('.')
const VERCEL_SUFFIX = ['vercel', 'app'].join('.')

const PUBLIC_ROUTES = [
  '/',
  '/planners',
  '/vendors',
  '/for-planners',
  '/how-it-works',
  '/pricing',
  '/guest-access-help',
  '/sign-in',
  '/register',
  '/company',
  '/company/about',
  '/company/how-wewed-works',
  '/company/contact',
  '/company/careers',
  '/trust',
  '/trust/trust-at-wewed',
  '/trust/vendor-verification',
  '/trust/review-integrity',
  '/trust/wedding-safety',
  '/trust/scam-prevention',
  '/trust/report-a-problem',
  '/trust/non-discrimination',
  '/trust/accessibility',
  '/trust/security',
  '/legal',
  '/legal/terms',
  '/legal/privacy',
  '/legal/cookies',
  '/legal/marketplace',
  '/legal/vendor-terms',
  '/legal/payments-refunds',
  '/legal/acceptable-use',
  '/legal/content-community',
  '/legal/reviews',
  '/legal/intellectual-property',
  '/legal/ai-transparency',
  '/legal/data-processing',
  '/vendors/resources',
  '/vendors/resources/vendor-standards',
  '/vendors/resources/how-ranking-works',
  '/vendors/resources/verification',
  '/vendors/resources/reviews',
  '/vendors/resources/vendor-help',
  '/developers',
  '/developers/overview',
  '/developers/quickstart',
  '/developers/api-reference',
  '/developers/authentication',
  '/developers/webhooks',
  '/developers/errors',
  '/developers/rate-limits',
  '/developers/versioning',
  '/developers/changelog',
  '/developers/api-status',
  '/developers/developer-terms',
  '/help',
  '/help/couples',
  '/help/planners',
  '/help/vendors',
  '/help/guests',
] as const

function sourceFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root)) {
    const path = join(root, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      files.push(...sourceFiles(path))
    } else if (/\.(?:ts|tsx|js|jsx|json)$/.test(entry)) {
      files.push(path)
    }
  }
  return files
}

test('runtime source does not hard-code retired public production domains', () => {
  const roots = [join(process.cwd(), 'src'), join(process.cwd(), 'public')]
  const violations: string[] = []

  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      const source = readFileSync(file, 'utf8')
      if (source.includes(LEGACY_DOMAIN) || source.includes(`.${VERCEL_SUFFIX}`)) {
        violations.push(file.replace(`${process.cwd()}/`, ''))
      }
    }
  }

  expect(violations).toEqual([])
})

test('all public migration routes render in Chromium without legacy-domain links', async ({ page }) => {
  test.setTimeout(180_000)

  await page.route('**/*', async (route) => {
    const type = route.request().resourceType()
    if (type === 'image' || type === 'media' || type === 'font') {
      await route.abort()
      return
    }
    await route.continue()
  })

  const failures: string[] = []
  for (const path of PUBLIC_ROUTES) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
    const status = response?.status() ?? 0
    if (status >= 400 || status === 0) failures.push(`${path}: HTTP ${status}`)

    const body = page.locator('body')
    if (!(await body.isVisible())) failures.push(`${path}: body not visible`)
    const text = await body.innerText().catch(() => '')
    if (/Application error|Internal Server Error|This page could not be found/i.test(text)) {
      failures.push(`${path}: rendered an error page`)
    }

    const oldLinks = await page.locator(`a[href*="${LEGACY_DOMAIN}"], a[href*=".${VERCEL_SUFFIX}"]`).count()
    if (oldLinks > 0) failures.push(`${path}: contains ${oldLinks} legacy-domain link(s)`)
  }

  expect(failures).toEqual([])
})

test('robots and sitemap publish only the official production origin', async ({ request }) => {
  const robots = await request.get('/robots.txt')
  expect(robots.ok()).toBeTruthy()
  const robotsText = await robots.text()
  expect(robotsText).toContain(`${OFFICIAL_ORIGIN}/sitemap.xml`)
  expect(robotsText).not.toContain(LEGACY_DOMAIN)
  expect(robotsText).not.toContain(`.${VERCEL_SUFFIX}`)

  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.ok()).toBeTruthy()
  const sitemapText = await sitemap.text()
  expect(sitemapText).toContain(`<loc>${OFFICIAL_ORIGIN}`)
  expect(sitemapText).not.toContain(LEGACY_DOMAIN)
  expect(sitemapText).not.toContain(`.${VERCEL_SUFFIX}`)
})

test('legacy privacy mutation cannot authorize through a client nonce', async ({ request }) => {
  const response = await request.patch('/api/privacy', {
    headers: { cookie: 'wewed_admin_auth=0123456789abcdef' },
    data: { privacy: 'public' },
  })
  expect(response.status()).toBe(410)
  expect(await response.json()).toMatchObject({
    success: false,
    code: 'LEGACY_PRIVACY_MUTATION_RETIRED',
    replacement: '/api/couple/wedding-privacy',
  })
})
