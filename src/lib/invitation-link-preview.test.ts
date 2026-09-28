import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
  invitationPreviewDescription,
  isLinkPreviewCrawler,
  renderInvitationLinkPreview,
} from '@/lib/invitation-link-preview'

const wedding = { title: 'Charity & Kudzie', date: new Date('2026-12-23T14:00:00.000Z') }

describe('shared invitation link preview (chat unfurl)', () => {
  test('recognises the chat and social crawlers that unfurl links', () => {
    for (const ua of [
      'WhatsApp/2.23.20.0 A',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'facebookexternalhit/1.1 Facebot Twitterbot/1.0',
      'TelegramBot (like TwitterBot)',
      'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
      'LinkedInBot/1.0',
      'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
    ]) expect(isLinkPreviewCrawler(ua)).toBe(true)
  })

  test('real browsers and apps keep the normal secure redirect', () => {
    for (const ua of [
      'Mozilla/5.0 (Linux; Android 16; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1',
      '',
    ]) expect(isLinkPreviewCrawler(ua)).toBe(false)
    expect(isLinkPreviewCrawler(null)).toBe(false)
  })

  test('the preview is branded Wewed and names the wedding and date only', () => {
    const html = renderInvitationLinkPreview({ origin: 'https://wewed.pro', wedding })
    expect(html).toContain('<meta property="og:title" content="Wewed · Private Wedding Invitation">')
    expect(html).toContain('Charity &amp; Kudzie · 23 December 2026. Open your secure Wewed digital invitation and RSVP.')
    expect(html).toContain('<meta property="og:image" content="https://wewed.pro/og/wewed-private-invitation.png">')
    expect(html).toContain('<meta property="og:site_name" content="Wewed">')
    expect(html).toContain('noindex, nofollow')
  })

  test('the preview never depends on or reveals a credential', () => {
    const route = readFileSync('src/app/invite/[slug]/route.ts', 'utf8')
    const get = route.slice(route.indexOf('export async function GET'))
    const branch = get.indexOf('isLinkPreviewCrawler(')
    // The crawler branch runs before the token is read, so valid and invalid links look identical.
    expect(branch).toBeGreaterThan(0)
    expect(branch).toBeLessThan(get.indexOf("searchParams.get('rsvp')"))
    const crawler = get.slice(branch, get.indexOf("searchParams.get('rsvp')"))
    expect(crawler).not.toContain('setPendingInvitationCookie')
    expect(crawler).not.toContain('resolvePersonalInvitation')
    const html = renderInvitationLinkPreview({ origin: 'https://wewed.pro', wedding })
    expect(html).not.toContain('rsvp')
  })

  test('unknown weddings get a generic Wewed preview, escaped safely', () => {
    expect(invitationPreviewDescription(null)).toContain('secure private wedding invitation from Wewed')
    const html = renderInvitationLinkPreview({
      origin: 'https://wewed.pro',
      wedding: { title: '<script>x</script>', date: wedding.date },
    })
    expect(html).not.toContain('<script>x')
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;')
  })
})
