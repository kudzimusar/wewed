import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-gate'
import { getModuleSchema, isModuleKey } from '@/lib/import-engine/schemas'
import { exportModule } from '@/lib/import-engine/exporter'
import { getFlagshipWeddingId } from '@/lib/import-engine/wedding'

/* ============================================================
   /api/exports/[module]
   ------------------------------------------------------------
   GET  → export the current wedding's data for the given module.
          Admin-gated.

   Query params:
     format = xlsx | csv   (default: xlsx)

   Modules: guests, budget, checklist, seating, vendors, timeline,
            songs, wedding-party, travel, media
   ============================================================ */

export async function GET(
  request: NextRequest,
) {
  // ── Admin gate ──
  const gateFail = requireAdmin(request)
  if (gateFail) return gateFail

  const url = new URL(request.url)
  const moduleKey = url.searchParams.get('module') || ''
  const format = (url.searchParams.get('format') || 'xlsx').toLowerCase()

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

  // ── Validate format ──
  if (format !== 'xlsx' && format !== 'csv') {
    return NextResponse.json(
      { success: false, error: `Invalid format "${format}". Use xlsx or csv.` },
      { status: 400 },
    )
  }

  try {
    const weddingId = await getFlagshipWeddingId()
    if (!weddingId) {
      return NextResponse.json(
        { success: false, error: 'Flagship wedding not found. Seed the database first.' },
        { status: 404 },
      )
    }

    const schema = getModuleSchema(moduleKey)
    const buffer = await exportModule(schema, weddingId, format)
    const fileName = `wewed-${moduleKey}-export-${new Date().toISOString().slice(0, 10)}.${format}`
    const contentType =
      format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv; charset=utf-8'

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (err) {
    console.error('[EXPORTS GET] error:', err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to export data',
      },
      { status: 500 },
    )
  }
}
