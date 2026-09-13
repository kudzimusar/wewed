import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = (path: string) => readFileSync(path, 'utf8')

describe('multi-wedding guest portfolio contract', () => {
  test('portfolio is wedding-scoped, bounded and never stores RSVP credentials', () => {
    const portfolio = source('src/lib/wedding-guest-portfolio.ts')

    expect(portfolio).toContain("WEDDING_GUEST_PORTFOLIO_COOKIE = 'wewed_wedding_guest_portfolio'")
    expect(portfolio).toContain('activeWeddingId: string | null')
    expect(portfolio).toContain('weddingId: string')
    expect(portfolio).toContain('guestId: string')
    expect(portfolio).toContain('MAX_PORTFOLIO_WEDDINGS = 8')
    expect(portfolio).toContain('item.weddingId !== nextEntry.weddingId')
    expect(portfolio).toContain('entry.weddingId !== weddingId')
    expect(portfolio).not.toContain('rsvpToken: string')
  })

  test('switching weddings revalidates the guest against that exact wedding before minting an active session', () => {
    const api = source('src/app/api/guest-weddings/route.ts')

    expect(api).toContain('id: input.guestId')
    expect(api).toContain('weddingId: input.weddingId')
    expect(api).toContain("rsvp: { select: { token: true } }")
    expect(api).toContain("portfolio.entries.find((entry) => entry.weddingId === weddingId)")
    expect(api).toContain('setWeddingGuestSessionCookie(response')
    expect(api).toContain('setWeddingGuestPortfolioCookie(response, activated)')
    expect(api).not.toContain('guestName:')
    expect(api).not.toContain('guestName=')
    expect(api).not.toContain('rsvpToken=')
  })

  test('cold app launch keeps product workspaces authoritative and restores guest invitation only for guest-only launches', () => {
    const app = source('src/app/app/route.ts')

    const roleBranch = app.indexOf('} else if (session) {')
    const portfolioBranch = app.indexOf('const portfolio = readWeddingGuestPortfolio(request)')
    expect(roleBranch).toBeGreaterThan(-1)
    expect(portfolioBranch).toBeGreaterThan(roleBranch)
    expect(app).toContain('WORKSPACE_BY_ROLE[session.role]')
    expect(app).toContain("invitation: '1'")
    expect(app).toContain('resolveLegacyGuestSession(request)')
  })

  test('all successful personal and claimed-physical entry paths add the wedding to the portfolio', () => {
    for (const path of [
      'src/app/invite/[slug]/continue/route.ts',
      'src/app/invite/resume/route.ts',
      'src/app/api/weddings/[slug]/guest-session/exchange/route.ts',
      'src/app/api/weddings/[slug]/physical-invitation/claim/route.ts',
    ]) {
      const file = source(path)
      expect(file).toContain('mergeWeddingGuestPortfolio')
      expect(file).toContain('setWeddingGuestPortfolioCookie')
    }
  })

  test('leaving a wedding removes only that wedding from the portfolio and applies cookies to the final response', () => {
    const guestSession = source('src/app/api/weddings/[slug]/guest-session/route.ts')
    const portfolio = source('src/lib/wedding-guest-portfolio.ts')

    expect(guestSession).toContain('removeWeddingGuestPortfolioEntry')
    expect(portfolio).toContain(".filter((entry) => entry.weddingId !== weddingId)")
    expect(guestSession).toContain("nextPortfolio?.activeWeddingId ? '/app' : '/'")
    expect(guestSession).toContain('clearWeddingGuestSessionCookie(response)')
    expect(guestSession).toContain('if (nextPortfolio) setWeddingGuestPortfolioCookie(response, nextPortfolio)')
  })
})

describe('private wedding sharing contract', () => {
  test('top navigation shares the canonical wedding website rather than the current invitation URL', () => {
    const navbar = source('src/components/wedding/navbar.tsx')

    expect(navbar).toContain("const websiteUrl = `${window.location.origin}/w/${encodeURIComponent(slug)}`")
    expect(navbar).toContain("'Share Website'")
    expect(navbar).not.toContain('url: window.location.href')
    expect(navbar).not.toContain('clipboard.writeText(window.location.href)')
  })

  test('private wedding share section permits website sharing but never generates a generic private QR', () => {
    const share = source('src/components/wedding/share-section.tsx')

    expect(share).toContain('Share the Website, Not the Invitation')
    expect(share).toContain('Every invited guest keeps their own invitation and unique QR')
    expect(share).toContain('if (privateWedding || !origin) return')
    expect(share).toContain('Share Website')
    expect(share).toContain('WhatsApp Website')
  })
})
