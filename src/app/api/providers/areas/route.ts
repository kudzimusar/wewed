import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rows = await db.$queryRawUnsafe<Array<{
      name: string
      province: string
      district: string | null
      placeType: string
    }>>(
      `SELECT name, province, district, "placeType"
       FROM wewed_admin."ZimbabweMarketplacePlace"
       WHERE active = true
       ORDER BY priority, province, name`,
    )

    return NextResponse.json({
      success: true,
      areas: rows,
      broaderAreas: [
        'Zimbabwe nationwide',
        'Southern Africa',
        'Regional / destination',
      ],
    })
  } catch (error) {
    console.error('[providers/areas] Error:', error)
    return NextResponse.json(
      { success: false, areas: [], broaderAreas: [], error: 'Service areas are temporarily unavailable.' },
      { status: 500 },
    )
  }
}
