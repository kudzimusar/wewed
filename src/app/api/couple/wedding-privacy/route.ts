import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getWeddingContext } from '@/lib/wedding-access'

const PRIVACY_VALUES = ['public', 'link_only', 'private'] as const
type PrivacyValue = (typeof PRIVACY_VALUES)[number]

async function requireOwner(request: NextRequest) {
  const context = await getWeddingContext(request)
  if (!context) {
    return { context: null, error: NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 }) }
  }
  if (context.role !== 'owner') {
    return { context: null, error: NextResponse.json({ success: false, error: 'Only the couple owner can change wedding privacy.' }, { status: 403 }) }
  }
  return { context, error: null }
}

export async function GET(request: NextRequest) {
  const access = await requireOwner(request)
  if (access.error) return access.error

  const wedding = await db.wedding.findUnique({
    where: { id: access.context.weddingId },
    select: { id: true, slug: true, title: true, privacy: true, canonSealed: true },
  })
  if (!wedding) {
    return NextResponse.json({ success: false, error: 'Wedding not found.' }, { status: 404 })
  }

  return NextResponse.json({ success: true, wedding })
}

export async function PATCH(request: NextRequest) {
  const access = await requireOwner(request)
  if (access.error) return access.error

  const body = (await request.json().catch(() => null)) as { privacy?: unknown } | null
  const privacy = body?.privacy
  if (typeof privacy !== 'string' || !PRIVACY_VALUES.includes(privacy as PrivacyValue)) {
    return NextResponse.json({ success: false, error: 'Choose public, link_only or private.' }, { status: 400 })
  }

  const before = await db.wedding.findUnique({
    where: { id: access.context.weddingId },
    select: { privacy: true, slug: true },
  })
  if (!before) {
    return NextResponse.json({ success: false, error: 'Wedding not found.' }, { status: 404 })
  }

  const wedding = await db.$transaction(async (tx) => {
    const updated = await tx.wedding.update({
      where: { id: access.context.weddingId },
      data: { privacy },
      select: { id: true, slug: true, title: true, privacy: true, canonSealed: true },
    })
    await tx.auditEvent.create({
      data: {
        action: 'wedding.privacy_changed',
        resourceType: 'wedding',
        resourceId: updated.id,
        beforeValue: JSON.stringify({ privacy: before.privacy }),
        afterValue: JSON.stringify({ privacy }),
        weddingId: updated.id,
        actorId: access.context.session.userId,
      },
    })
    return updated
  })

  return NextResponse.json({ success: true, wedding })
}
