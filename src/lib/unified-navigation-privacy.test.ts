import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'

const source = (path: string) => readFile(path, 'utf8')

const privacyMigration = await source('prisma/migrations/20260804002000_default_new_weddings_link_only/migration.sql')
const schema = await source('prisma/schema.prisma')
const proxy = await source('src/proxy.ts')
const guestSessionRoute = await source('src/app/api/weddings/[slug]/guest-session/route.ts')
const exchangeRoute = await source('src/app/api/weddings/[slug]/guest-exchange/route.ts')
const access = await source('src/lib/wedding-route-access.ts')
const weddingApi = await source('src/app/api/weddings/[slug]/route.ts')
const contentApi = await source('src/app/api/weddings/[slug]/content/route.ts')
const contentItemApi = await source('src/app/api/weddings/[slug]/content/[id]/route.ts')
const guestsApi = await source('src/app/api/weddings/[slug]/guests/route.ts')
const rsvpsApi = await source('src/app/api/weddings/[slug]/rsvps/route.ts')
const rsvpTokenRoute = await source('src/app/api/weddings/[slug]/rsvp/[token]/route.ts')
const legacyTokenRoute = await source('src/app/api/weddings/[slug]/guest/token/route.ts')
const rsvpSection = await source('src/components/wedding/sections/rsvp-section.tsx')
const checkin = await source('src/components/wedding/planner/checkin-scanner.tsx')

describe('unified Wewed navigation and wedding privacy', () => {
  test('root is a neutral platform and wedding sites live under slug routes', async () => {
    const home = await source('src/app/page.tsx')
    const weddingRoute = await source('src/app/w/[slug]/page.tsx')
    expect(home).toContain('PublicPlatformShell')
    expect(home).not.toContain('Charity')
    expect(weddingRoute).toContain('WeddingSite')
    expect(weddingRoute).toContain('params')
  })

  test('new weddings default to invitation-only at the database boundary', () => {
    expect(privacyMigration).toContain("ALTER COLUMN \"privacy\" SET DEFAULT 'link_only'")
    expect(privacyMigration).toContain("UPDATE \"Wedding\" SET \"privacy\" = 'link_only'")
    expect(schema).toContain('@default("link_only")')
  })

  test('guest invitations exchange into signed HttpOnly scoped sessions', () => {
    expect(guestSessionRoute).toContain('guest_session')
    expect(guestSessionRoute).toContain('httpOnly: true')
    expect(guestSessionRoute).toContain('sameSite:')
    expect(guestSessionRoute).toContain('secure:')
    expect(exchangeRoute).toContain('setWeddingGuestSession')
    expect(proxy).toContain('/guest-exchange')
    expect(proxy).toContain('/guest-session')
  })

  test('wedding payload APIs fail through the shared access resolver', () => {
    expect(access).toContain('resolveWeddingRouteAccess')
    expect(access).toContain('private')
    expect(access).toContain('link_only')
    expect(weddingApi).toContain('resolveWeddingRouteAccess')
    expect(contentApi).toContain('resolveWeddingRouteAccess')
    expect(contentItemApi).toContain('resolveWeddingRouteAccess')
    expect(guestsApi).toContain('resolveWeddingRouteAccess')
    expect(rsvpsApi).toContain('resolveWeddingRouteAccess')
    expect(rsvpTokenRoute).toContain('resolveWeddingRouteAccess')
  })

  test('RSVP writes and check-in require guest invitation identity', () => {
    expect(rsvpTokenRoute).toContain("guestId: access.context.guestId")
    expect(rsvpTokenRoute).toContain("weddingId: access.context.weddingId")
    expect(legacyTokenRoute).toContain('guest: { weddingId: access.context.weddingId }')
    expect(rsvpSection).toContain('/guest-session')
    expect(rsvpSection).toContain('Names and email addresses alone cannot')
    expect(checkin).toContain('/guest-session')
    expect(checkin).not.toContain('DEMO_TOKEN_URL')
    expect(checkin).not.toContain('pseudo-random')
  })

  test('every stakeholder has visible navigation from a role home', async () => {
    const publicShell = await source('src/components/public/public-platform-shell.tsx')
    const couple = await source('src/components/couple/couple-dashboard.tsx')
    const plannerNavigation = await source('src/components/navigation/planner-adaptive-navigation.tsx')
    const plannerPortal = await source('src/components/wedding/planner-portal.tsx')
    const adminNav = await source('src/components/admin/admin-utility-nav.tsx')
    const weddingNav = await source('src/components/wedding/wedding-platform-nav.tsx')
    const marketplace = await source('src/components/marketplace/marketplace-frame.tsx')

    for (const label of ['Find a planner', 'For planners', 'How it works', 'Pricing', 'Sign in']) {
      expect(publicShell).toContain(label)
    }
    for (const href of ['/couple/planners', '/couple/invitations', '/couple/privacy', '/planner']) {
      expect(couple).toContain(href)
    }
    expect(plannerNavigation).toContain('/planner/marketplace')
    expect(plannerNavigation).toContain('`/w/${weddingSlug}`')
    expect(plannerNavigation).toContain('Wedding site')
    expect(plannerPortal).toContain('<PlannerAdaptiveNavigation')
    expect(adminNav).toContain('/admin/planner-profiles')
    expect(weddingNav).toContain('/planners')
    expect(weddingNav).toContain('Leave wedding')
    expect(marketplace).toContain('Wewed home')
    expect(marketplace).toContain('Planner directory')
  })

  test('QR management is visible to authorized couple and planner stakeholders', async () => {
    const manager = await source('src/components/wedding/invitation-manager.tsx')
    const plannerTool = await source('src/components/wedding/planner-invitation-tools.tsx')
    const coupleRoute = await source('src/app/couple/invitations/page.tsx')

    expect(manager).toContain('QRCode.toDataURL')
    expect(manager).toContain('Copy link')
    expect(manager).toContain('Rotate')
    expect(plannerTool).toContain('InvitationManager')
    expect(coupleRoute).toContain('InvitationManager')
  })
})
