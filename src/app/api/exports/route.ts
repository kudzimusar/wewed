import { NextRequest, NextResponse } from 'next/server'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { getModuleSchema, isModuleKey } from '@/lib/import-engine/schemas'
import { exportModule } from '@/lib/import-engine/exporter'

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'export.data')
  if (access.error) return access.error

  const url = new URL(request.url)
  const moduleKey = url.searchParams.get('module') || ''
  const format = (url.searchParams.get('format') || 'xlsx').toLowerCase()

  if (!isModuleKey(moduleKey)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unknown module. Valid modules: guests, budget, checklist, seating, vendors, timeline, songs, wedding-party, travel, media.',
      },
      { status: 400 },
    )
  }
  if (format !== 'xlsx' && format !== 'csv') {
    return NextResponse.json({ success: false, error: 'Format must be xlsx or csv.' }, { status: 400 })
  }

  try {
    const schema = getModuleSchema(moduleKey)
    const buffer = await exportModule(schema, access.context.weddingId, format)
    const fileName = `wewed-${moduleKey}-export-${new Date().toISOString().slice(0, 10)}.${format}`
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':
          format === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('[exports GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to export wedding data.' }, { status: 500 })
  }
}
