import { NextRequest, NextResponse } from 'next/server'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { getWorksheetSchema, isModuleKey } from '@/lib/import-engine/schema-resolver'
import { generateTemplate } from '@/lib/import-engine/template'

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'import.execute')
  if (access.error) return access.error

  const moduleKey = new URL(request.url).searchParams.get('module') || ''
  if (!isModuleKey(moduleKey)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unknown module. Valid modules: guests, budget, checklist, seating, vendors, timeline, songs, wedding-party, travel, media.',
      },
      { status: 400 },
    )
  }

  try {
    const schema = getWorksheetSchema(moduleKey)
    const buffer = generateTemplate(schema)
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="wewed-${moduleKey}-template-v${schema.version}.xlsx"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('[templates GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to generate template.' }, { status: 500 })
  }
}
