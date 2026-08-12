import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(ROOT, relativePath), 'utf8')
}

describe('canonical wedding social template', () => {
  test('all weddings use the rich canonical renderer', async () => {
    const home = await source('src/components/wedding/wedding-home.tsx')
    expect(home).not.toContain('DataBackedWeddingExperience')
    expect(home).not.toContain('if (!isFlagship)')
    expect(home).toContain('<OurStory />')
    expect(home).toContain('<VenueSection />')
    expect(home).toContain('<TheDay />')
    expect(home).toContain('<SongbookEnhanced />')
    expect(home).toContain('<PhotoGallery />')
    expect(home).toContain('<MemoryCapsule />')
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

  test('shared content edits require the active wedding and membership', async () => {
    const route = await source('src/app/api/wedding-content/route.ts')
    expect(route).toContain('session.activeWeddingId !== wedding.id')
    expect(route).toContain("hasPermission(request, 'content.edit')")
    expect(route).toContain('db.weddingMembership.findFirst')
    expect(route).toContain("membership.role === 'owner'")
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
