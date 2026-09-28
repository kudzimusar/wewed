import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const bridge = readFileSync('src/components/wedding/gift-registry-campaign-bridge.tsx', 'utf8')
const form = readFileSync('src/components/wedding/guest-contribution-pledge-form.tsx', 'utf8')

describe('QRO07-AT01 contribution form uses the already-authorized Guest', () => {
  test('the Guest context comes only from this wedding’s guest-session read', () => {
    expect(bridge).toContain('fetch(`/api/weddings/${encodeURIComponent(slug)}/guest-session`')
    expect(bridge).toContain('guestContact={guestContact}')
    // Name and invitation email only — never the RSVP token or the Guest id.
    expect(bridge).not.toMatch(/rsvpToken|guest\.id|guestId/)
  })

  test('prefill never overwrites what the Guest typed and stays editable', () => {
    expect(form).toContain('setDisplayName((current) => current || guestContact.name)')
    expect(form).toContain("setEmail((current) => current || guestContact.email || '')")
    expect(form).toContain('onChange={(event) => setDisplayName(event.target.value)}')
    expect(form).toContain('onChange={(event) => setEmail(event.target.value)}')
  })

  test('nothing about the Guest is placed in a browser-visible URL', () => {
    expect(bridge).not.toMatch(/history\.(push|replace)State\([^)]*guest/i)
    expect(form).not.toMatch(/\?[^'"`]*(name|email)=/)
  })
})
