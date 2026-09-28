import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  CANONICAL_INVITATION_CLOSED_ART,
  CANONICAL_INVITATION_STYLE,
  PremiumInvitationStudio,
} from '@/components/wedding/invitation-experience/premium-invitation-studio'
import { INVITATION_CARD_STYLES, type InvitationCardStyle } from '@/lib/digital-invitation-card'

/**
 * INV-CANON01 — the approved Wewed digital invitation is Ivory Floral Gold: the ornate
 * ivory/gold floral doors, the seal, "A special invitation awaits" and "Tap to open", opening
 * CLOSED → OPENING → OPEN → DETAILS. The Planner/Couple studio must show exactly that — never the
 * flat generic DigitalInvitationCard thumbnail — and any change that routes it back fails here.
 */

const source = (path: string) => readFileSync(path, 'utf8')
const noop = () => {}

function renderStudio(style: InvitationCardStyle) {
  return renderToStaticMarkup(
    createElement(PremiumInvitationStudio, {
      data: { title: 'Synthetic & Wedding', date: '2027-01-01T10:00:00.000Z', venue: 'Synthetic Venue' },
      style,
      message: '',
      deadline: '',
      childrenPolicy: 'welcome',
      saved: false,
      busy: false,
      onStyleChange: noop,
      onMessageChange: noop,
      onDeadlineChange: noop,
      onChildrenPolicyChange: noop,
      onSave: noop,
    }),
  )
}

function tileMarkup(html: string, id: string): string {
  const start = html.indexOf(`data-testid="invitation-style-${id}"`)
  expect(start).toBeGreaterThan(-1)
  const end = html.indexOf('</button>', start)
  return html.slice(start, end)
}

describe('INV-CANON01 — Planner/Couple studio shows the approved invitation', () => {
  test('the canonical style is Ivory Floral Gold', () => {
    expect(CANONICAL_INVITATION_STYLE).toBe('ivory-floral-gold')
    expect(INVITATION_CARD_STYLES.some((item) => item.id === CANONICAL_INVITATION_STYLE)).toBe(true)
  })

  test('the Ivory catalogue tile is the approved CLOSED artwork, not the generic DigitalInvitationCard', () => {
    const tile = tileMarkup(renderStudio('midnight'), 'ivory-floral-gold')
    expect(tile).toContain('data-testid="invitation-style-canonical-closed"')
    expect(tile).toContain('data-artwork="approved-closed"')
    expect(tile).toContain(`src="${CANONICAL_INVITATION_CLOSED_ART}"`)
    expect(tile).toContain('A special invitation awaits')
    expect(tile).not.toContain('digital-invitation-card-')
  })

  test('the other 11 invitation tiles are unchanged (generic cards)', () => {
    const html = renderStudio('midnight')
    const others = INVITATION_CARD_STYLES.filter((item) => item.id !== CANONICAL_INVITATION_STYLE)
    expect(others).toHaveLength(11)
    for (const theme of others) {
      const tile = tileMarkup(html, theme.id)
      expect(tile).toContain(`data-testid="digital-invitation-card-${theme.id}"`)
      expect(tile).not.toContain('invitation-style-canonical-closed')
    }
  })

  test('selecting Ivory renders the dedicated tri-fold, starting CLOSED with both doors', () => {
    const html = renderStudio('ivory-floral-gold')
    const frame = html.slice(html.indexOf('data-testid="invitation-preview-frame"'))
    expect(frame).toContain('data-testid="invitation-trifold"')
    expect(frame).toContain('data-invitation-view="closed"')
    expect(frame).toContain('data-artwork="left-door"')
    expect(frame).toContain('data-artwork="right-door"')
    expect(frame).toContain('A special invitation awaits')
  })

  test('the approved closed artwork file is the real approved crop', () => {
    const file = `public${CANONICAL_INVITATION_CLOSED_ART}`
    expect(existsSync(file)).toBe(true)
    expect(statSync(file).size).toBeGreaterThan(100_000)
    const header = readFileSync(file).subarray(0, 12)
    expect(header.subarray(0, 4).toString('ascii')).toBe('RIFF')
    expect(header.subarray(8, 12).toString('ascii')).toBe('WEBP')
    const manifest = JSON.parse(source('public/invitation-art/ivory/manifest.json'))
    expect(manifest.sources.closed.provenance).toBe('Original approved session PNG')
  })

  test('the interactive preview dispatches Ivory to IvoryFloralGoldTriFold, not GenericMotionCard', () => {
    const experience = source('src/components/wedding/invitation-experience/premium-invitation-experience.tsx')
    expect(experience).toContain("const isIvoryBenchmark = style === 'ivory-floral-gold'")
    const ivory = experience.indexOf('<IvoryFloralGoldTriFold')
    const generic = experience.indexOf('<GenericMotionCard')
    expect(ivory).toBeGreaterThan(-1)
    expect(experience.slice(experience.lastIndexOf('isIvoryBenchmark ?', ivory), ivory)).toContain('isIvoryBenchmark ?')
    expect(generic).toBeGreaterThan(ivory)
  })

  test('the tri-fold state machine is CLOSED → OPENING → OPEN → DETAILS', () => {
    const trifold = source('src/components/wedding/invitation-experience/ivory-floral-gold-trifold.tsx')
    expect(trifold).toContain("export type IvoryInvitationView = 'closed' | 'opening' | 'open' | 'details'")
    expect(trifold).toContain("useState<IvoryInvitationView>('closed')")
    expect(trifold).toContain("setView(reducedMotion ? 'open' : 'opening')")
    expect(trifold).toContain("setView('open')")
    expect(trifold).toContain("setView('details')")
  })

  test('opening the Planner invitation studio is read-only until an operator explicitly repairs missing links', () => {
    const manager = source('src/components/wedding/invitation-manager.tsx')
    const loadStart = manager.indexOf('const load = useCallback')
    const loadEnd = manager.indexOf('useEffect(() => { void load() }, [load])')
    expect(loadStart).toBeGreaterThan(-1)
    expect(loadEnd).toBeGreaterThan(loadStart)
    expect(manager.slice(loadStart, loadEnd)).not.toContain("method: 'POST'")
    expect(manager).toContain('async function generateMissingLinks()')
    expect(manager).toContain('window.confirm')
  })

  test('the RSVP dialog cannot let a stale card query override the saved wedding style', () => {
    const dialog = source('src/components/wedding/invitation-rsvp-dialog.tsx')
    expect(dialog).toContain('normalizeInvitationCardStyle(data.wedding.invitationCardStyle)')
    expect(dialog).not.toContain('requestedStyle || data.wedding.invitationCardStyle')
  })
})
