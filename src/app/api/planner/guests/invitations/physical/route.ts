import { randomInt } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  formatPhysicalInvitationCode,
  physicalInvitationCodeFromDestinationId,
  physicalInvitationDestinationId,
} from '@/lib/physical-invitation-code'
import { requireWeddingPermission } from '@/lib/wedding-access'

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const CODE_LENGTH = 10

function privateNoStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

function privateJson(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return privateNoStore(NextResponse.json(body, { status }))
}

function generateCode(): string {
  return Array.from(
    { length: CODE_LENGTH },
    () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)],
  ).join('')
}

async function physicalInvitationPayload(
  request: NextRequest,
  weddingId: string,
) {
  const [wedding, invitedCount, destination] = await Promise.all([
    db.wedding.findUnique({
      where: { id: weddingId },
      select: { slug: true, title: true },
    }),
    db.guest.count({ where: { weddingId } }),
    db.qRDestination.findFirst({
      where: {
        weddingId,
        type: 'physical_invitation',
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        scanCount: true,
        createdAt: true,
      },
    }),
  ])

  if (!wedding) return null

  const code = destination
    ? physicalInvitationCodeFromDestinationId(destination.id)
    : null
  const origin = request.nextUrl.origin.replace(/\/$/, '')

  return {
    wedding: { slug: wedding.slug, title: wedding.title },
    configured: Boolean(destination && code),
    code: code ? formatPhysicalInvitationCode(code) : null,
    rawCode: code,
    accessUrl: code ? `${origin}/i/${code}` : null,
    scanCount: destination?.scanCount ?? 0,
    invitedCount,
    createdAt: destination?.createdAt?.toISOString() ?? null,
  }
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.view')
  if (access.error) return privateNoStore(access.error)

  try {
    const payload = await physicalInvitationPayload(
      request,
      access.context.weddingId,
    )
    if (!payload) {
      return privateJson({ success: false, error: 'Wedding not found.' }, 404)
    }
    return privateJson({ success: true, ...payload })
  } catch (error) {
    console.error('[physical invitation QR GET] Error:', error)
    return privateJson(
      { success: false, error: 'Unable to load the bulk invitation QR.' },
      500,
    )
  }
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.edit')
  if (access.error) return privateNoStore(access.error)

  try {
    const existing = await db.qRDestination.findFirst({
      where: {
        weddingId: access.context.weddingId,
        type: 'physical_invitation',
        isActive: true,
      },
      select: { id: true },
    })

    if (!existing) {
      const wedding = await db.wedding.findUnique({
        where: { id: access.context.weddingId },
        select: { slug: true },
      })
      if (!wedding) {
        return privateJson({ success: false, error: 'Wedding not found.' }, 404)
      }

      let created = false
      for (let attempt = 0; attempt < 8 && !created; attempt += 1) {
        const code = generateCode()
        const id = physicalInvitationDestinationId(code)
        if (!id) continue
        try {
          await db.qRDestination.create({
            data: {
              id,
              weddingId: access.context.weddingId,
              label: 'Bulk printed wedding invitation',
              url: `/w/${wedding.slug}`,
              type: 'physical_invitation',
              isActive: true,
            },
          })
          created = true
        } catch (caught) {
          const isCollision =
            caught instanceof Error && caught.message.includes('Unique constraint')
          if (!isCollision) throw caught
        }
      }

      if (!created) {
        return privateJson(
          { success: false, error: 'Unable to allocate an invitation code.' },
          500,
        )
      }

      await db.auditEvent.create({
        data: {
          action: 'wedding.physical_invitation_qr_created',
          resourceType: 'qr_destination',
          weddingId: access.context.weddingId,
          actorId: access.context.session.userId,
          afterValue: JSON.stringify({ type: 'physical_invitation' }),
        },
      })
    }

    const payload = await physicalInvitationPayload(
      request,
      access.context.weddingId,
    )
    if (!payload) {
      return privateJson({ success: false, error: 'Wedding not found.' }, 404)
    }
    return privateJson({ success: true, ...payload })
  } catch (error) {
    console.error('[physical invitation QR POST] Error:', error)
    return privateJson(
      { success: false, error: 'Unable to create the bulk invitation QR.' },
      500,
    )
  }
}
