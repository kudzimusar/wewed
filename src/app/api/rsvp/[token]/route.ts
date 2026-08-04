import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'

interface Params {
  params: Promise<{ token: string }>
}

function retiredResponse() {
  return NextResponse.json(
    {
      success: false,
      code: 'guest_session_required',
      error:
        'Use the guest invitation exchange and signed wedding session for RSVP self-service.',
    },
    {
      status: 410,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    },
  )
}

export async function GET() {
  return retiredResponse()
}

export async function PUT() {
  return retiredResponse()
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const access = await requireWeddingPermission(request, 'guests.edit')
  if (access.error) return access.error

  try {
    const { token } = await params
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required.' },
        { status: 400 },
      )
    }

    const existing = await db.rSVP.findFirst({
      where: {
        token,
        guest: { weddingId: access.context.weddingId },
      },
      include: {
        guest: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'RSVP not found for the active wedding.' },
        { status: 404 },
      )
    }

    const newCheckedIn = !existing.checkedIn
    const updated = await db.rSVP.update({
      where: { id: existing.id },
      data: {
        checkedIn: newCheckedIn,
        checkedInAt: newCheckedIn ? new Date() : null,
      },
      include: {
        guest: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    await db.auditEvent.create({
      data: {
        action: newCheckedIn ? 'guest.checked_in' : 'guest.check_in_reverted',
        resourceType: 'rsvp',
        resourceId: updated.id,
        beforeValue: JSON.stringify({ checkedIn: existing.checkedIn }),
        afterValue: JSON.stringify({ checkedIn: newCheckedIn }),
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
      },
    })

    return NextResponse.json({
      success: true,
      checkedIn: newCheckedIn,
      data: updated,
    })
  } catch (error) {
    console.error('[RSVP TOKEN PATCH] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update guest check-in.' },
      { status: 500 },
    )
  }
}
