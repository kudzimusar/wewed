import { describe, expect, test } from 'bun:test'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

describe('unified Wewed navigation and wedding privacy', () => {
  test('root is a neutral platform and wedding sites live under slug routes', async () => {
    const root = await source('src/app/page.tsx')
    const rootLayout = await source('src/app/layout.tsx')
    const weddingPage = await source('src/app/w/[slug]/page.tsx')

    expect(root).toContain('PublicPlatformHome')
    expect(root).toContain("redirect(`/w/")
    expect(root).not.toContain('<WeddingHome')
    expect(rootLayout).toContain('Private Wedding Sites and Planner Marketplace')
    expect(rootLayout).not.toContain('Charity &')
    expect(rootLayout).not.toContain('Imba Manor')
    expect(weddingPage).toContain('resolveWeddingAccessFromTokens')
    expect(weddingPage).toContain('GuestAccessGateway')
    expect(weddingPage).toContain('guest-session/exchange')
    expect(weddingPage).toContain("dynamic = 'force-dynamic'")
  })

  test('new weddings default to invitation-only at the database boundary', async () => {
    const migration = await source(
      'prisma/migrations/20260804002000_default_new_weddings_link_only/migration.sql',
    )

    expect(migration).toContain('wewed_enforce_new_wedding_link_only')
    expect(migration).toContain("NEW.privacy := 'link_only'")
    expect(migration).toContain('BEFORE INSERT ON public."Wedding"')
    expect(migration).toContain('Public visibility must be selected later')
  })

  test('guest invitations exchange into signed HttpOnly scoped sessions', async () => {
    const session = await source('src/lib/wedding-guest-session.ts')
    const route = await source('src/app/api/weddings/[slug]/guest-session/route.ts')
    const exchange = await source(
      'src/app/api/weddings/[slug]/guest-session/exchange/route.ts',
    )
    const invitations = await source('src/app/api/planner/guests/invitations/route.ts')
    const cardContract = await source('src/lib/digital-invitation-card.ts')
    const legacySharedToken = await source('src/app/api/privacy/verify-token/route.ts')

    expect(session).toContain("WEDDING_GUEST_SESSION_COOKIE = 'wewed_wedding_guest'")
    expect(session).toContain('httpOnly: true')
    expect(session).toContain("sameSite: 'lax'")
    expect(session).toContain('weddingId')
    expect(session).toContain('guestId')
    expect(session).toContain('rsvpToken')
    expect(route).toContain('setWeddingGuestSessionCookie')
    expect(route).toContain("rsvp.guest.wedding.slug !== slug")
    expect(route).toContain("rsvp.guest.wedding.privacy === 'private'")
    expect(exchange).toContain('setWeddingGuestSessionCookie')
    expect(exchange).toContain('function relativeRedirect')
    expect(exchange).toContain("Location: location")
    expect(exchange).toContain("new URLSearchParams({ invitation: '1', card: requestedStyle })")
    expect(exchange).toContain('`/w/${encodeURIComponent(slug)}?${query.toString()}`')
    expect(exchange).toContain('normalizeInvitationCardStyle')
    expect(invitations).toContain('buildDigitalInvitationUrl')
    expect(cardContract).toContain('`/w/${encodeURIComponent(weddingSlug)}?${query.toString()}`')
    expect(invitations).toContain('guest.invitation_rotated')
    expect(legacySharedToken).toContain('legacy_shared_token_retired')
    expect(legacySharedToken).toContain('status: 410')
  })

  test('wedding payload APIs fail through the shared access resolver', async () => {
    const resolver = await source('src/lib/wedding-public-access.ts')
    const routes = await Promise.all([
      source('src/app/api/wedding-content/route.ts'),
      source('src/app/api/wedding/route.ts'),
      source('src/app/api/songs/route.ts'),
      source('src/app/api/messages/route.ts'),
      source('src/app/api/media/route.ts'),
      source('src/app/api/contributions/public/route.ts'),
    ])

    expect(resolver).toContain("return 'private'")
    expect(resolver).toContain("wedding.privacy === 'link_only' && guest")
    expect(resolver).toContain("wedding.privacy === 'public'")
    expect(resolver).toContain('session.activeWeddingId !== wedding.id')
    expect(resolver).toContain('db.weddingMembership.findFirst')
    expect(resolver).toContain("status: 'active'")
    expect(resolver).toContain("return 'couple_owner'")
    expect(resolver).toContain("return 'wedding_member'")
    for (const route of routes) {
      expect(route).toContain('resolveWeddingAccessForRequest')
      expect(route).toContain('weddingAccessErrorPayload')
    }
  })

  test('RSVP writes and check-in require guest invitation identity', async () => {
    const rsvpRoute = await source('src/app/api/rsvp/route.ts')
    const legacyTokenRoute = await source('src/app/api/rsvp/[token]/route.ts')
    const rsvpSection = await source('src/components/wedding/rsvp-section.tsx')
    const checkin = await source('src/components/wedding/qr-checkin.tsx')

    expect(rsvpRoute).toContain('guest_invitation_required')
    expect(rsvpRoute).toContain('access.guest.rsvpToken')
    expect(rsvpRoute).not.toContain('guest.create')
    expect(legacyTokenRoute).toContain('guest_session_required')
    expect(legacyTokenRoute).toContain('status: 410')
    expect(legacyTokenRoute).toContain("requireWeddingPermission(request, 'guests.edit')")
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
    const plannerDock = await source('src/components/wedding/planner-account-dock.tsx')
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
    expect(plannerDock).toContain('/planner/marketplace')
    expect(plannerPortal).toContain('`/w/${wedding.slug}`')
    expect(plannerPortal).toContain('Wedding site')
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
    expect(manager).toContain('CSV')
    expect(plannerTool).toContain('Invitations & QR')
    expect(coupleRoute).toContain('CoupleInvitationsCentre')
  })
})
