/// <reference types="bun-types" />

import { afterAll, describe, expect, mock, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { isValidPhysicalInvitationHandoff } from '@/lib/invitation-links'

// Keep the production module protected by Next.js' server-only marker while
// allowing Bun's standalone integration runner to exercise the crypto + DB
// contract outside the Next.js module resolver.
mock.module('server-only', () => ({}))

const {
  consumePhysicalInvitationInstallHandoff,
  createPhysicalInvitationInstallHandoff,
} = await import('@/lib/physical-invitation-install-handoff')

const BASE64URL_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function physicalToken(playStoreUrl: string) {
  const referrer = new URL(playStoreUrl).searchParams.get('referrer')
  if (!referrer) throw new Error('missing referrer')
  const token = new URLSearchParams(referrer).get('physical_handoff')
  if (!token) throw new Error('missing physical_handoff')
  return token
}

function nonCanonicalEquivalent(token: string): string | null {
  const prefix = 'p1.'
  const encoded = token.slice(prefix.length)
  const remainder = encoded.length % 4
  const unusedBits = remainder === 2 ? 4 : remainder === 3 ? 2 : 0
  if (!unusedBits) return null

  const last = encoded.at(-1)
  if (!last) return null
  const value = BASE64URL_ALPHABET.indexOf(last)
  if (value < 0) return null

  const mask = (1 << unusedBits) - 1
  const significant = value & ~mask
  const alternateLowBits = (value & mask) === 0 ? 1 : 0
  const replacement = BASE64URL_ALPHABET[significant | alternateLowBits]
  if (!replacement || replacement === last) return null

  return `${prefix}${encoded.slice(0, -1)}${replacement}`
}

async function fixture(destinationIdExtra = '') {
  const suffix = randomUUID().replaceAll('-', '')
  const couple = await db.couple.create({
    data: {
      slug: `physical-handoff-couple-${suffix}`,
      partner1: 'Physical',
      partner2: 'Invite',
    },
  })
  const wedding = await db.wedding.create({
    data: {
      slug: `physical-handoff-wedding-${suffix}`,
      title: 'Physical Deferred Invitation Wedding',
      date: new Date('2031-04-24T12:00:00.000Z'),
      venue: 'Test Venue',
      venueCity: 'Test City',
      venueCountry: 'Test Country',
      privacy: 'link_only',
      invitationCardStyle: 'ivory-floral-gold',
      coupleId: couple.id,
    },
  })
  const destination = await db.qRDestination.create({
    data: {
      id: `print_${suffix.slice(0, 18)}${destinationIdExtra}`,
      label: 'Physical install handoff test',
      url: `/w/${wedding.slug}`,
      type: 'physical_invitation',
      weddingId: wedding.id,
      isActive: true,
    },
  })
  return { couple, wedding, destination }
}

async function cleanup(input: Awaited<ReturnType<typeof fixture>>) {
  await db.qRDestination.deleteMany({ where: { id: input.destination.id } })
  await db.wedding.deleteMany({ where: { id: input.wedding.id } })
  await db.couple.deleteMany({ where: { id: input.couple.id } })
}

afterAll(async () => { await db.$disconnect() })

describe('physical invitation deferred Android handoff', () => {
  test('Play receives only an opaque encrypted physical handoff and resume restores shared context', async () => {
    const input = await fixture()
    try {
      const created = await createPhysicalInvitationInstallHandoff({
        destinationId: input.destination.id,
        weddingId: input.wedding.id,
        card: 'ivory-floral-gold',
      })
      const token = physicalToken(created.playStoreUrl)
      expect(isValidPhysicalInvitationHandoff(token)).toBe(true)
      expect(token.startsWith('p1.')).toBe(true)

      const visiblePlayData = decodeURIComponent(created.playStoreUrl)
      expect(visiblePlayData).not.toContain(input.wedding.slug)
      expect(visiblePlayData).not.toContain(input.wedding.id)
      expect(visiblePlayData).not.toContain(input.destination.id)
      expect(visiblePlayData).not.toContain('rsvp')
      expect(created.appResumePath).toBe(`/invite/physical-resume?h=${encodeURIComponent(token)}`)

      expect(await consumePhysicalInvitationInstallHandoff(token)).toMatchObject({
        ok: true,
        weddingId: input.wedding.id,
        weddingSlug: input.wedding.slug,
        destinationId: input.destination.id,
        card: 'ivory-floral-gold',
      })
    } finally {
      await cleanup(input)
    }
  })

  test('rejects a tampered encrypted physical handoff', async () => {
    const input = await fixture()
    try {
      const created = await createPhysicalInvitationInstallHandoff({
        destinationId: input.destination.id,
        weddingId: input.wedding.id,
        card: 'ivory-floral-gold',
      })
      const token = physicalToken(created.playStoreUrl)
      const last = token.at(-1) || 'A'
      const replacement = last === 'A' ? 'B' : 'A'
      const tampered = `${token.slice(0, -1)}${replacement}`
      expect(await consumePhysicalInvitationInstallHandoff(tampered)).toEqual({
        ok: false,
        reason: 'invalid',
      })
    } finally {
      await cleanup(input)
    }
  })

  test('rejects a noncanonical base64url alias even when it decodes to identical encrypted bytes', async () => {
    // One extra payload byte forces the packed ciphertext length off the
    // 3-byte boundary, guaranteeing unused bits in the final base64url symbol.
    const input = await fixture('x')
    try {
      const created = await createPhysicalInvitationInstallHandoff({
        destinationId: input.destination.id,
        weddingId: input.wedding.id,
        card: 'ivory-floral-gold',
      })
      const token = physicalToken(created.playStoreUrl)
      const alias = nonCanonicalEquivalent(token)
      expect(alias).not.toBeNull()
      if (!alias) throw new Error('fixture token unexpectedly has no base64url alias')

      const canonicalBytes = Buffer.from(token.slice(3), 'base64url')
      const aliasBytes = Buffer.from(alias.slice(3), 'base64url')
      expect(aliasBytes.equals(canonicalBytes)).toBe(true)
      expect(alias).not.toBe(token)
      expect(await consumePhysicalInvitationInstallHandoff(alias)).toEqual({
        ok: false,
        reason: 'invalid',
      })
    } finally {
      await cleanup(input)
    }
  })

  test('revokes the handoff if the printed invitation is disabled before app reveal', async () => {
    const input = await fixture()
    try {
      const created = await createPhysicalInvitationInstallHandoff({
        destinationId: input.destination.id,
        weddingId: input.wedding.id,
        card: 'ivory-floral-gold',
      })
      const token = physicalToken(created.playStoreUrl)
      await db.qRDestination.update({
        where: { id: input.destination.id },
        data: { isActive: false },
      })
      expect(await consumePhysicalInvitationInstallHandoff(token)).toEqual({
        ok: false,
        reason: 'revoked',
      })
    } finally {
      await cleanup(input)
    }
  })
})