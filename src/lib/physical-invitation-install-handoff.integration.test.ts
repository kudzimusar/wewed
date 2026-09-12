/// <reference types="bun-types" />

import { afterAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import {
  consumePhysicalInvitationInstallHandoff,
  createPhysicalInvitationInstallHandoff,
} from '@/lib/physical-invitation-install-handoff'
import { isValidPhysicalInvitationHandoff } from '@/lib/invitation-links'

function physicalToken(playStoreUrl: string) {
  const referrer = new URL(playStoreUrl).searchParams.get('referrer')
  if (!referrer) throw new Error('missing referrer')
  const token = new URLSearchParams(referrer).get('physical_handoff')
  if (!token) throw new Error('missing physical_handoff')
  return token
}

async function fixture() {
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
      privacy: 'link_only',
      invitationCardStyle: 'ivory-floral-gold',
      coupleId: couple.id,
    },
  })
  const destination = await db.qRDestination.create({
    data: {
      id: `print_${suffix.slice(0, 18)}`,
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
