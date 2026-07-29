import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { getModuleSchema, isModuleKey } from '@/lib/import-engine/schemas'
import { parseFile } from '@/lib/import-engine/parser'
import { generatePreview } from '@/lib/import-engine/preview'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_EXTS = ['.xlsx', '.csv']

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'import.execute')
  if (access.error) return access.error

  try {
    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Expected multipart/form-data with a file and moduleKey.' },
        { status: 400 },
      )
    }

    const fileEntry = form.get('file')
    const moduleKey = (form.get('moduleKey') as string | null)?.toString().trim()
    if (!fileEntry || typeof fileEntry === 'string') {
      return NextResponse.json({ success: false, error: 'A spreadsheet file is required.' }, { status: 400 })
    }
    if (!moduleKey || !isModuleKey(moduleKey)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unknown module. Valid modules: guests, budget, checklist, seating, vendors, timeline, songs, wedding-party, travel, media.',
        },
        { status: 400 },
      )
    }

    const file: File = fileEntry
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { success: false, error: `File is too large. Maximum size is ${MAX_FILE_BYTES / 1024 / 1024} MB.` },
        { status: 413 },
      )
    }
    const fileName = file.name || 'upload'
    const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''
    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json(
        { success: false, error: 'Only .xlsx and .csv files are supported.' },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = await parseFile(buffer, file.type || 'application/octet-stream')
    const schema = getModuleSchema(moduleKey)
    const preview = await generatePreview(
      parsed,
      schema,
      access.context.weddingId,
      fileName,
    )
    const jobId = `imp_${randomUUID().replace(/-/g, '')}`

    await db.importJob.create({
      data: {
        id: jobId,
        moduleKey,
        fileName,
        templateVersion: preview.templateVersion,
        status: 'preview',
        totalRows: preview.totalRows,
        errorCount: preview.invalidRows,
        errorReport: JSON.stringify(
          preview.rows
            .filter((row) => row.errors.length)
            .map((row) => ({ row: row.rowIndex, errors: row.errors })),
        ),
        fieldMapping: JSON.stringify(preview.fieldMapping),
        previewData: JSON.stringify(preview),
        weddingId: access.context.weddingId,
        performedBy: access.context.session.email,
      },
    })

    await db.auditEvent.create({
      data: {
        action: 'import.preview',
        resourceType: 'import_job',
        resourceId: jobId,
        afterValue: JSON.stringify({
          moduleKey,
          fileName,
          totalRows: preview.totalRows,
          creates: preview.newRecords,
          updates: preview.updateRecords,
          invalid: preview.invalidRows,
        }),
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
      },
    })

    return NextResponse.json({ success: true, jobId, preview })
  } catch (error) {
    console.error('[imports POST] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unable to preview import.' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'import.execute')
  if (access.error) return access.error

  try {
    const url = new URL(request.url)
    const requestedModule = url.searchParams.get('module')?.trim() || null
    if (requestedModule && !isModuleKey(requestedModule)) {
      return NextResponse.json(
        { success: false, error: 'Unknown import module.' },
        { status: 400 },
      )
    }

    const requestedLimit = Number(url.searchParams.get('limit') || 8)
    const take = Number.isFinite(requestedLimit)
      ? Math.min(30, Math.max(1, Math.floor(requestedLimit)))
      : 8

    const jobs = await db.importJob.findMany({
      where: {
        weddingId: access.context.weddingId,
        ...(requestedModule ? { moduleKey: requestedModule } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    })

    const data = jobs.map((job) => ({
      id: job.id,
      jobId: job.id,
      moduleKey: job.moduleKey,
      fileName: job.fileName,
      templateVersion: job.templateVersion,
      status: job.status,
      totalRows: job.totalRows,
      createdCount: job.createdCount,
      updatedCount: job.updatedCount,
      skippedCount: job.skippedCount,
      errorCount: job.errorCount,
      errorReport: job.errorReport,
      rollbackToken: job.rollbackToken,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    }))

    return NextResponse.json({ success: true, data, recent: data })
  } catch (error) {
    console.error('[imports GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to load import history.' }, { status: 500 })
  }
}
