import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(ROOT, relativePath), 'utf8')
}

describe('canonical wedding social template', () => {
  test('all weddings use the rich classic canonical renderer', async () => {
    const home = await source('src/components/wedding/wedding-home.tsx')
    expect(home).not.toContain('DataBackedWeddingExperience')
    expect(home).not.toContain('if (!isFlagship)')
    expect(home).toContain('data-canonical-template="classic"')
    expect(home).toContain('<OurStory />')
    expect(home).toContain('<VenueSection />')
    expect(home).toContain('<TheDay />')
    expect(home).toContain('<SongbookEnhanced />')
    expect(home).toContain('<PhotoGallery />')
    expect(home).toContain('<MemoryCapsule />')
    expect(home).toContain('<VendorMarketplace />')
    expect(home).toContain('<AfterSections canPost={canContribute} />')
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
    expect(serverData).toContain('contentItems: true')
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

  test('classic high-value presentation and interactions cannot be reduced to generic cards', async () => {
    const [gallery, capsule, uploader, wall, after, vendors, guests, travel, registry, vision] = await Promise.all([
      source('src/components/wedding/photo-gallery.tsx'),
      source('src/components/wedding/memory-capsule.tsx'),
      source('src/components/wedding/media-upload.tsx'),
      source('src/components/wedding/live-wall.tsx'),
      source('src/components/wedding/after-sections.tsx'),
      source('src/components/wedding/vendor-marketplace.tsx'),
      source('src/components/wedding/guests.tsx'),
      source('src/components/wedding/travel-stay.tsx'),
      source('src/components/wedding/gift-registry.tsx'),
      source('src/components/wedding/platform-vision.tsx'),
    ])

    expect(gallery).toContain('data-classic-section="gallery"')
    expect(gallery).toContain('[column-count:1]')
    expect(gallery).toContain('function Lightbox(')
    expect(gallery).toContain("event.key === 'ArrowRight'")
    expect(gallery).toContain('group-hover:scale-105')
    expect(gallery).toContain('Load More')

    expect(capsule).toContain('data-classic-section="memory-capsule"')
    expect(capsule).toContain("type CapsuleState = 'idle' | 'recording' | 'preview' | 'sent'")
    expect(capsule).toContain('function ProgressRing(')
    expect(capsule).toContain('Re-record')
    expect(capsule).toContain('Send to Capsule')

    expect(uploader).toContain('data-classic-section="media-upload"')
    expect(uploader).toContain('onDrop={handleDrop}')
    expect(uploader).toContain('multiple')
    expect(uploader).toContain('<Progress')
    expect(uploader).toContain('Default moment')

    expect(wall).toContain('data-classic-section="live-wall"')
    expect(wall).toContain('Send applause')
    expect(wall).toContain('<Avatar')
    expect(wall).toContain('canPost')

    expect(after).toContain('data-classic-section="after-wedding-suite"')
    expect(after).toContain('data-classic-section="after-recap"')
    expect(after).toContain('data-classic-section="after-gallery"')
    expect(after).toContain('data-classic-section="after-playback"')
    expect(after).toContain('data-classic-section="after-guest-wall"')
    expect(after).toContain('data-classic-section="after-keepsakes"')

    expect(vendors).toContain('data-classic-section="vendor-marketplace"')
    expect(vendors).toContain('Featured')
    expect(vendors).toContain('View Profile')
    expect(vendors).toContain('Apply as Vendor')

    expect(guests).toContain('data-classic-section="wedding-party"')
    expect(guests).toContain('member.isKid ?')
    expect(guests).toContain("member.side === 'bride'")
    expect(guests).toContain("member.side === 'groom'")

    expect(travel).toContain('data-classic-section="travel-stay"')
    expect(travel).toContain("color === 'clay'")
    expect(travel).toContain('/night')

    expect(registry).toContain('data-classic-section="gift-registry"')
    expect(registry).toContain('Curated homeware & timeless pieces')

    expect(vision).toContain('data-classic-section="platform-vision"')
    expect(vision).toContain('-bottom-20 -left-20')
    expect(vision).toContain('lg:text-5xl')
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

  test('classic contribution surfaces use only wedding-scoped APIs', async () => {
    const [gallery, uploader, wall, after, songs] = await Promise.all([
      source('src/components/wedding/photo-gallery.tsx'),
      source('src/components/wedding/media-upload.tsx'),
      source('src/components/wedding/live-wall.tsx'),
      source('src/components/wedding/after-sections.tsx'),
      source('src/components/wedding/songbook.tsx'),
    ])

    expect(gallery).toContain('/api/media?slug=')
    expect(uploader).toContain("form.append('slug', ctx.slug)")
    expect(uploader).toContain("fetch('/api/media'")
    expect(wall).toContain('/api/messages?slug=')
    expect(wall).toContain("slug: ctx.slug")
    expect(after).toContain('/api/messages?slug=')
    expect(after).toContain("slug: ctx.slug")
    expect(songs).toContain("slug: ctx.slug")
  })

  test('shared content edits require the active wedding and membership', async () => {
    const route = await source('src/app/api/wedding-content/route.ts')
    expect(route).toContain('session.activeWeddingId !== wedding.id')
    expect(route).toContain("hasPermission(request, 'content.edit')")
    expect(route).toContain('db.weddingMembership.findFirst')
    expect(route).toContain("membership.role === 'owner'")
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

  test('reusable flagship-quality components contain no Charity-specific identity or venue copy', async () => {
    const files = [
      'src/components/wedding/hero-section.tsx',
      'src/components/wedding/our-story.tsx',
      'src/components/wedding/the-day.tsx',
      'src/components/wedding/travel-stay.tsx',
      'src/components/wedding/venue-section.tsx',
      'src/components/wedding/gift-registry.tsx',
      'src/components/wedding/songbook.tsx',
      'src/components/wedding/songbook-live.tsx',
      'src/components/wedding/guests.tsx',
      'src/components/wedding/vendor-marketplace.tsx',
      'src/components/wedding/faq-section.tsx',
      'src/components/wedding/live-wall.tsx',
      'src/components/wedding/photo-gallery.tsx',
      'src/components/wedding/media-upload.tsx',
      'src/components/wedding/memory-capsule.tsx',
      'src/components/wedding/after-sections.tsx',
      'src/components/wedding/telegram-widget.tsx',
      'src/components/wedding/platform-vision.tsx',
      'src/components/wedding/merch-teaser.tsx',
    ]
    const forbidden = [
      'Charity',
      'Kudzie',
      'Musarurwa',
      'Imba Manor',
      '23.12.26',
      '@wewedcharitykudzie',
    ]

    for (const file of files) {
      const text = await source(file)
      for (const term of forbidden) expect(text).not.toContain(term)
      expect(text).not.toContain('isFlagship')
    }
  })

  test('empty weddings receive explicit neutral starter guidance', async () => {
    const defaults = await source('src/lib/wedding-template-defaults.ts')
    expect(defaults).toContain('WEDDING_SOCIAL_TEMPLATE_VERSION = 1')
    expect(defaults).toContain('Example:')
    expect(defaults).toContain('Replace this')
    expect(defaults).not.toContain('Charity')
    expect(defaults).not.toContain('Kudzie')
    expect(defaults).not.toContain('Imba Manor')
  })
})
