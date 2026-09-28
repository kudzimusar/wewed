import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'

const trifold = readFileSync('src/components/wedding/invitation-experience/ivory-floral-gold-trifold.tsx', 'utf8')

describe('QRO07-AT01 Ivory without a couple note', () => {
  test('the note-free details surface ships beside the approved one', () => {
    expect(existsSync('public/invitation-art/ivory/details-surface.webp')).toBe(true)
    expect(existsSync('public/invitation-art/ivory/details-surface-no-note.webp')).toBe(true)
  })

  test('without a note there is no note card, text or action', () => {
    expect(trifold).toContain("const detailsArt: DetailsArt = note ? 'details-surface' : 'details-surface-no-note'")
    expect(trifold).toContain('<Art name={detailsArt} />')
    expect(trifold).toMatch(/\{note \? \(\s*<Region box=\{\[36, 76, 44, 4\]\} className="ivory-detail-note">/)
    expect(trifold).toContain("{note ? hit('note', 'A Note from Us'")
  })

  test('the monogram fallback matches the Wedding Pass form', () => {
    expect(trifold).toContain("pair.map((p) => p[0]).join('&')")
  })
})
