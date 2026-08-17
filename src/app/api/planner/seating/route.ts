import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseSeatingTableMetadata, plannedSeatsForGuest } from '@/lib/planner-seating-metadata'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'seating.view')
  if (access.error) return access.error

  try {
    const tables = await db.seatingTable.findMany({
      where: { weddingId: access.context.weddingId },
      include: {
        guests: {
          include: { rsvp: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      success: true,
      count: tables.length,
      data: tables.map((table) => {
        const metadata = parseSeatingTableMetadata(table.position, table.name)
        const occupied = table.guests.reduce((sum, guest) => sum + plannedSeatsForGuest(guest), 0)
        return {
          id: table.id,
          name: table.name,
          capacity: table.capacity,
          position: table.position,
          tableType: metadata.tableType,
          zone: metadata.zone,
          notes: metadata.notes,
          occupied,
          available: Math.max(0, table.capacity - occupied),
          assignedGuests: table.guests.map((guest) => ({
            id: guest.id,
            name: guest.name,
            plannedSeats: plannedSeatsForGuest(guest),
          })),
        }
      }),
    })
  } catch (error) {
    console.error('[planner seating GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to load seating worksheet data.' }, { status: 500 })
  }
}
