/// <reference types="bun-types" />

import { afterAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import {
  consumePhysicalInvitationInstallHandoff,
  createPhysicalInvitationInstallHandoff,
} from '@/lib/physical-invitation-install-handoff'

function physicalSecret(playStoreUrl: string) {
  const referrer = new URL(playStoreUrl).searchParams.get('referrer')
  if (!referrer) throw new Error('missing referrer')
  const secret = new URLSearchParams(referrer).get('physical_handoff')
  if (!secret) throw new Error('missing physical_handoff')
  return secret
}

async function fixture() {
  const suffix = randomUUID().replaceAll('-', '')
  const couple = await db.couple.create({
    data: { slug: `physical-handoff-couple-${suffix}`, partner1: 'Physical', partner2: 'Invite' },
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
  await db.$executeRaw`DELETE FROM private."PhysicalInvitationInstallHandoff" WHERE "weddingId" = ${input.wedding.id}`
  await db.qRDestination.deleteMany({ where: { id: input.destination.id } })
  await db.wedding.deleteMany({ where: { id: input.wedding.id } })
  await db.couple.deleteMany({ where: { id: input.couple.id } })
}

afterAll(async () => { await db.$disconnect() })

describe('physical invitation deferred Android handoff', () => {
  test('Play receives only an opaque one-time physical handoff and resume restores shared invitation context', async () => {
    const input = await fixture()
    try {
      const created = await createPhysicalInvitationInstallHandoff({
        destinationId: input.destination.id,
        weddingId: input.wedding.id,
        card: 'ivory-floral-gold',
        source: 'integration-test',
      })
      const secret = physicalSecret(created.playStoreUrl)
      expect(secret).toHaveLength(43)
      expect(created.playStoreUrl).not.toContain(input.wedding.slug)
      expect(created.playStoreUrl).not.toContain(input.wedding.id)
      expect(created.playStoreUrl).not.toContain(input.destination.id)
      expect(created.playStoreUrl).not.toContain('rsvp')
      expect(created.appResumePath).toBe(`/invite/physical-resume?h=${secret}`)

      const first = await consumePhysicalInvitationInstallHandoff(secret)
      expect(first).toMatchObject({
        ok: true,
        weddingId: input.wedding.id,
        weddingSlug: input.wedding.slug,
        destinationId: input.destination.id,
        card: 'ivory-floral-gold',
      })
      expect(await consumePhysicalInvitationInstallHandoff(secret)).toEqual({ ok: false, reason: 'used' })
    } finally {
      await cleanup(input)
    }
  })

  test('revokes the handoff if the printed invitation is disabled before first app launch', async () => {
    const input = await fixture()
    try {
      const created = await createPhysicalInvitationInstallHandoff({
        destinationId: input.destination.id,
        weddingId: input.wedding.id,
        card: 'ivory-floral-gold',
      })
      const secret = physicalSecret(created.playStoreUrl)
      await db.qRDestination.update({ where: { id: input.destination.id }, data: { isActive: false } })
      expect(await consumePhysicalInvitationInstallHandoff(secret)).toEqual({ ok: false, reason: 'revoked' })
    } finally {
      await cleanup(input)
    }
  })

  test('preview cannot create or consume a physical handoff for another wedding', async () => {
    const input = await fixture()
    const oldEnv = process.env.VERCEL_ENV
    const oldWritable = process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID
    try {
      const created = await createPhysicalInvitationInstallHandoff({
        destinationId: input.destination.id,
        weddingId: input.wedding.id,
        card: 'ivory-floral-gold',
      })
      const secret = physicalSecret(created.playStoreUrl)
      process.env.VERCEL_ENV = 'preview'
      process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID = 'another-wedding'
      await expect(createPhysicalInvitationInstallHandoff({
        destinationId: input.destination.id,
        weddingId: input.wedding.id,
        card: 'ivory-floral-gold',
      })).rejects.toThrow('PREVIEW_WRITE_BLOCKED')
      expect(await consumePhysicalInvitationInstallHandoff(secret)).toEqual({ ok: false, reason: 'invalid' })
    } finally {
      if (oldEnv === undefined) delete process.env.VERCEL_ENV
      else process.env.VERCEL_ENV = oldEnv
      if (oldWritable === undefined) delete process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID
      else process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID = oldWritable
      await cleanup(input)
    }
  })
})
