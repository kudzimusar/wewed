import { randomInt } from 'node:crypto'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  physicalInvitationCodeFromDestinationId,
  physicalInvitationDestinationId,
} from '@/lib/physical-invitation-code'

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const CODE_LENGTH = 10
const COMPROMISED_DESTINATION_ID = 'print_CHRTYKDZ23'

function generateCode(): string {
  return Array.from(
    { length: CODE_LENGTH },
    () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)],
  ).join('')
}

export async function GET() {
  if (process.env.VERCEL_ENV !== 'production') {
    return new NextResponse(null, { status: 404 })
  }

  const wedding = await db.wedding.findUnique({
    where: { slug: 'charity-and-kudzie' },
    select: { id: true, slug: true, privacy: true },
  })

  if (!wedding) {
    console.info('[print-bootstrap] wedding-not-found')
    return new NextResponse(null, { status: 404 })
  }

  await db.qRDestination.updateMany({
    where: {
      weddingId: wedding.id,
      type: 'physical_invitation',
      id: COMPROMISED_DESTINATION_ID,
    },
    data: { isActive: false },
  })

  let destination = await db.qRDestination.findFirst({
    where: {
      weddingId: wedding.id,
      type: 'physical_invitation',
      isActive: true,
      NOT: { id: COMPROMISED_DESTINATION_ID },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })

  if (!destination) {
    for (let attempt = 0; attempt < 12 && !destination; attempt += 1) {
      const code = generateCode()
      const id = physicalInvitationDestinationId(code)
      if (!id) continue

      try {
        destination = await db.qRDestination.create({
          data: {
            id,
            weddingId: wedding.id,
            label: 'Bulk printed wedding invitation',
            url: `/w/${wedding.slug}`,
            type: 'physical_invitation',
            isActive: true,
          },
          select: { id: true },
        })
      } catch (caught) {
        const collision =
          caught instanceof Error && caught.message.includes('Unique constraint')
        if (!collision) throw caught
      }
    }
  }

  if (!destination) {
    console.error('[print-bootstrap] unable-to-allocate')
    return new NextResponse(null, { status: 500 })
  }

  const code = physicalInvitationCodeFromDestinationId(destination.id)
  if (!code) {
    console.error('[print-bootstrap] invalid-destination-id')
    return new NextResponse(null, { status: 500 })
  }

  console.info(
    `[print-bootstrap] code=${code} access=https://wewed.pro/i/${code} privacy=${wedding.privacy}`,
  )

  // Never disclose the credential in the response. This route is removed
  // immediately after the one-time production bootstrap has completed.
  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}
