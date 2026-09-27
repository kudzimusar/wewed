import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(ROOT, relativePath), 'utf8')
}

describe('canonical wedding social template', () => {
  test('every wedding mounts the same canonical, data-driven site renderer', async () => {
    const home = await source('src/components/wedding/wedding-home.tsx')
    expect(home).not.toContain('DataBackedWeddingExperience')
    expect(home).not.toContain('isFlagship')
    expect(home).toContain('data-canonical-template="classic"')
    expect(home).toContain('<SiteHero />')
    expect(home).toContain('<SiteAnnouncements />')
    // Section order and visibility come from the wedding's WeddingSiteSection rows.
    expect(home).toContain('site.sections.filter((section) => section.enabled)')
    for (const component of ['<SiteStory />', '<SiteVenue />', '<SiteTheDay />', '<GiftRegistryCampaignBridge />', '<SiteGallery />', '<SiteFaq />', '<ShareSection />']) {
      expect(home).toContain(component)
    }
    // QRO07: marketing, vendor promotion and fabricated experiences are not part of a wedding site.
    for (const removed of ['WewedPricingCatalog', 'PlatformVision', 'MerchTeaser', 'VendorMarketplace', 'MemoryCapsule', 'AfterSections', 'PlannerMarketplaceInvitation', 'CountdownBanner', 'BeforeAfterToggle']) {
      expect(home).not.toContain(removed)
    }
  })

  test('the first render is seeded from the authoritative wedding database projection', async () => {
    const [page, provider, dataHook, serverData, api] = await Promise.all([
      source('src/app/w/[slug]/page.tsx'),
      source('src/components/wedding/wedding-data-provider.tsx'),
      source('src/lib/wedding-data.ts'),
      source('src/lib/wedding-data-server.ts'),
      source('src/app/api/wedding-content/route.ts'),
    ])

    expect(serverData).toContain("import 'server-only'")
    expect(serverData).toContain('export async function loadWeddingDataBySlug')
    // QRO07: guests receive an allowlisted projection, never every WeddingContent row.
    expect(serverData).toContain('contentItems: {')
    expect(serverData).toContain('if (!isPublicScalarField(row.section, row.field)) continue')
    expect(serverData).toContain('loadPublicSiteStructure(wedding.id)')
    expect(serverData).toContain('programmeItems:')
    expect(serverData).toContain('songs:')

    expect(page).toContain("import { loadWeddingDataBySlug } from '@/lib/wedding-data-server'")
    expect(page).toContain('const initialData = await loadWeddingDataBySlug(slug)')
    expect(page).toContain('initialData={initialData}')

    expect(provider).toContain('initialData?: WeddingData | null')
    expect(provider).toContain('useWeddingData(slug, initialData)')
    expect(dataHook).toContain('initialData?: WeddingData | null')
    expect(dataHook).toContain('useState<WeddingData | null>(initialData ?? null)')
    expect(dataHook).toContain('useState<boolean>(!initialData)')

    expect(api).toContain('const data = await loadWeddingDataBySlug(slug)')
  })

  test('the site is editorial, accessible and reduced-motion aware', async () => {
    const [primitives, hero, gallery, uploader] = await Promise.all([
      source('src/components/wedding/site/primitives.tsx'),
      source('src/components/wedding/site/site-hero.tsx'),
      source('src/components/wedding/site/site-gallery.tsx'),
      source('src/components/wedding/media-upload.tsx'),
    ])
    expect(primitives).toContain('useReducedMotion()')
    expect(primitives).toContain('aria-labelledby={headingId}')
    expect(hero).toContain('useReducedMotion()')
    // The countdown is blank until the browser clock is known: no after-state flash for future dates.
    expect(hero).toContain('if (now === null) return <div')
    expect(gallery).toContain('role="dialog"')
    expect(gallery).toContain("event.key === 'Escape'")
    expect(uploader).toContain('data-classic-section="media-upload"')
    expect(uploader).toContain('onDrop={handleDrop}')
  })

  test('guest chrome cannot reveal couple planner admin edit or AI tools', async () => {
    const [navbar, globalTools, coupleLogin] = await Promise.all([
      source('src/components/wedding/navbar.tsx'),
      source('src/components/wedding/global-wedding-tools.tsx'),
      source('src/components/wedding/couple-login.tsx'),
    ])

    expect(navbar).toContain("const isCoupleOwner = accessKind === 'couple_owner' && viewerRole === 'couple'")
    expect(navbar).toContain('{isCoupleOwner && (')
    expect(navbar).toContain('<PlannerTrigger />')
    expect(navbar).toContain('{isCoupleOwner && <QrGateway')
    expect(globalTools).toContain('{showOwnerUtilities && <AiTrigger />}')
    expect(globalTools).toContain('{isAdmin && <AdminTrigger />}')
    expect(globalTools).toContain('{isCoupleOwner && <CoupleLogin')
    expect(coupleLogin).toContain("if (accessKind !== 'couple_owner') return null")
  })

  test('private wedding sharing never links guests into private workspaces', async () => {
    const share = await source('src/components/wedding/share-section.tsx')
    expect(share).toContain('data-testid="private-share-guard"')
    expect(share).not.toContain('/couple/invitations')
    expect(share).not.toContain('/planner/guests')
    expect(share).not.toContain('/admin')
  })

  test('participant writes fail closed for anonymous public viewers', async () => {
    const [messages, media, songs] = await Promise.all([
      source('src/app/api/messages/route.ts'),
      source('src/app/api/media/route.ts'),
      source('src/app/api/songs/route.ts'),
    ])
    for (const api of [messages, media, songs]) {
      expect(api).toContain("accessKind === 'public'")
      expect(api).toContain('status: 403')
    }
  })

  test('guest contribution surfaces use only wedding-scoped APIs', async () => {
    const [gallery, uploader, gifts] = await Promise.all([
      source('src/components/wedding/site/site-gallery.tsx'),
      source('src/components/wedding/media-upload.tsx'),
      source('src/components/wedding/gift-registry-campaign-bridge.tsx'),
    ])
    expect(gallery).toContain('/api/media?slug=')
    expect(uploader).toContain("form.append('slug', ctx.slug)")
    expect(uploader).toContain("fetch('/api/media'")
    expect(gifts).toContain('/api/contribution-campaigns/public?weddingSlug=')
    // An API failure is never presented as the couple's decision.
    expect(gifts).toContain("if (!response.ok) throw new Error")
    expect(gifts).toContain('data-registry-configured="unavailable"')
  })

  test('shared content edits require the active wedding and membership', async () => {
    const route = await source('src/app/api/wedding-content/route.ts')
    expect(route).toContain("requireWeddingPermission(request, 'content.edit')")
    expect(route).toContain('wedding.id !== access.context.weddingId')
    expect(route).toContain('isPublicScalarField(section, field)')
    expect(route).toContain('await publishScalar(')
  })

  test('production migration workflow permits pending migrations but rejects rewritten history', async () => {
    const workflow = await source('.github/workflows/deploy-database.yml')
    expect(workflow).toContain('Fail closed on failed or divergent Prisma history')
    expect(workflow).toContain('sha256sum "$migration_file"')
    expect(workflow).toContain('repository_checksum')
    expect(workflow).toContain('recorded_checksum')
    expect(workflow).toContain('Pending repository migrations:')
    expect(workflow).toContain('bunx prisma migrate deploy')
    expect(workflow).not.toContain('completed_migrations" != "$repo_migrations')
  })

  test('classic flagship presentation data is additive and cannot overwrite edits', async () => {
    const migration = await source('prisma/migrations/20260813033000_restore_classic_wedding_presentation_data/migration.sql')
    expect(migration).toContain("w.slug = 'charity-and-kudzie'")
    expect(migration).toContain("'gallery', 'previewImage0'")
    expect(migration).toContain("'memory', 'messageCount', '47'")
    expect(migration).toContain("'guests', 'guide-0'")
    expect(migration).toContain("'vendors', 'vendor-0'")
    expect(migration).toContain("'after', 'thankYou'")
    expect(migration).toContain('on conflict ("weddingId", "section", "field") do nothing')
    expect(migration).not.toContain('do update set')
  })

  test('legacy realtime stays disabled until wedding room isolation is explicitly verified', async () => {
    const live = await source('src/lib/useWewedLive.ts')
    expect(live).toContain("process.env.NEXT_PUBLIC_WEWED_LIVE_SCOPED === '1'")
    expect(live).toContain('if (!LIVE_SCOPED_ENABLED)')
  })

  test('empty weddings are hidden or honest — never example content', async () => {
    const defaults = await source('src/lib/wedding-template-defaults.ts')
    expect(defaults).not.toContain('STARTER_')
    expect(defaults).not.toContain('Example')
    const theDay = await source('src/components/wedding/site/site-the-day.tsx')
    expect(theDay).toContain('data-testid="site-programme-pending"')
  })
})
