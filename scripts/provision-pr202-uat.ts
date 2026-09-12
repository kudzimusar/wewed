/** Explicit, preview-build-only provisioning. Never part of the normal build. */
import { PrismaClient } from '@prisma/client'
import { createHmac } from 'node:crypto'
const branch = 'feature/private-invitation-android-delivery-20260912'
const weddingId = 'wewed-pr202-uat-20260912'
const slug = weddingId
if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== branch || process.env.WEWED_UAT_PROVISION !== weddingId) {
  throw new Error('Provisioning requires the exact PR #202 preview and explicit fixture opt-in')
}
const secret = process.env.WEWED_UAT_FIXTURE_SECRET
if (!secret || secret.length < 32) throw new Error('Missing fixture seed secret')
const db = new PrismaClient()
try {
  const result = await db.$transaction(async (tx) => {
    const existing = await tx.wedding.findUnique({ where: { id: weddingId } })
    if (existing && (existing.slug !== slug || existing.title !== 'Wewed PR 202 — Synthetic UAT' || existing.coupleId !== weddingId + '-couple')) throw new Error('Fixture identity mismatch')
    const wedding = existing ?? await tx.wedding.create({ data: {
      id: weddingId, slug, title: 'Wewed PR 202 — Synthetic UAT',
      date: new Date('2027-04-24T12:00:00Z'), venue: 'Synthetic UAT Venue', venueCity: 'Test City', venueCountry: 'Test Country',
      privacy: 'link_only', invitationCardStyle: 'botanical', monogram: 'AB',
      couple: { create: { id: weddingId + '-couple', slug: weddingId + '-couple', partner1: 'UAT Partner One', partner2: 'UAT Partner Two' } },
    } })
    for (const label of ['A', 'B']) {
      const id = `${weddingId}-guest-${label.toLowerCase()}`
      const guest = await tx.guest.findUnique({ where: { id }, include: { rsvp: true } })
      if (guest && (guest.weddingId !== weddingId || guest.name !== `UAT Guest ${label}`)) throw new Error('Guest fixture mismatch')
      if (!guest) await tx.guest.create({ data: { id, name: `UAT Guest ${label}`, weddingId, rsvp: { create: { token: createHmac('sha256', secret).update(id).digest('base64url') } } } })
    }
    const id = 'print_UAT2020912'
    const qr = await tx.qRDestination.findUnique({ where: { id } })
    if (qr && qr.weddingId !== weddingId) throw new Error('Physical fixture mismatch')
    if (!qr) await tx.qRDestination.create({ data: { id, weddingId, label: 'PR 202 synthetic UAT physical invitation', type: 'physical_invitation', url: `/w/${slug}`, isActive: true } })
    return { id: wedding.id, slug: wedding.slug, title: wedding.title, guests: 2, physicalCode: 'UAT2020912' }
  })
  console.log('PR202_UAT_FIXTURE', JSON.stringify(result))
} finally { await db.$disconnect() }
