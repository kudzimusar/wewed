import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-gate'
import { getModuleSchema, isModuleKey } from '@/lib/import-engine/schemas'
import { generateTemplate } from '@/lib/import-engine/template'

/* ============================================================
   /api/templates/[module]
   ------------------------------------------------------------
   GET  → download an .xlsx template for the given module.
          Admin-gated. Returns the file inline (Content-Disposition:
          attachment) so the browser downloads it.

   Modules: guests, budget, checklist, seating, vendors, timeline,
            songs, wedding-party, travel, media
   ============================================================ */

export async function GET(
  request: NextRequest,
) {
  // ── Admin gate ──
  const gateFail = requireAdmin(request)
  if (gateFail) return gateFail

  const moduleKey = new URL(request.url).searchParams.get('module') || ''

  // ── Validate module key ──
  if (!isModuleKey(moduleKey)) {
    return NextResponse.json(
      {
        success: false,
        error: `Unknown module "${moduleKey}". Valid: guests, budget, checklist, seating, vendors, timeline, songs, wedding-party, travel, media`,
      },
      { status: 400 },
    )
  }

  try {
    const schema = getModuleSchema(moduleKey)
    const buffer = generateTemplate(schema)
    const fileName = `wewed-${moduleKey}-template-v${schema.version}.xlsx`

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (err) {
    console.error('[TEMPLATES GET] error:', err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to generate template',
      },
      { status: 500 },
    )
  }
}
