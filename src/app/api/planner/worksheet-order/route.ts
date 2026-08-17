import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  isOrderedPlannerWorksheet,
  mergePlannerWorksheetOrder,
  readPlannerWorksheetOrder,
  savePlannerWorksheetOrder,
  type OrderedPlannerWorksheet,
} from '@/lib/planner-worksheet-order'
import { requireWeddingPermission } from '@/lib/wedding-access'

const VIEW_PERMISSION: Record<OrderedPlannerWorksheet, string> = {
  tasks: 'planner.view',
  budget: 'budget.view',
  vendors: 'vendors.view',
  guests: 'guests.view',
  timeline: 'timeline.view',
  seating: 'seating.view',
}

const EDIT_PERMISSION: Record<OrderedPlannerWorksheet, string> = {
  tasks: 'planner.edit',
  budget: 'budget.edit',
  vendors: 'vendors.edit',
  guests: 'guests.edit',
  timeline: 'timeline.edit',
  seating: 'seating.edit',
}

const MAX_ORDERED_RECORDS = 5000

async function currentIds(worksheet: OrderedPlannerWorksheet, weddingId: string): Promise<string[]> {
  if (worksheet === 'tasks') {
    const rows = await db.plannerTask.findMany({
      where: { weddingId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    })
    return rows.map((row) => row.id)
  }
  if (worksheet === 'budget') {
    const rows = await db.budgetItem.findMany({
      where: { weddingId },
      orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    })
    return rows.map((row) => row.id)
  }
  if (worksheet === 'vendors') {
    const rows = await db.vendor.findMany({
      where: { weddingId },
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    })
    return rows.map((row) => row.id)
  }
  if (worksheet === 'guests') {
    const rows = await db.guest.findMany({
      where: { weddingId },
      orderBy: [{ side: 'asc' }, { name: 'asc' }],
      select: { id: true },
    })
    return rows.map((row) => row.id)
  }
  if (worksheet === 'timeline') {
    const rows = await db.programmeItem.findMany({
      where: { weddingId },
      orderBy: [{ time: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    })
    return rows.map((row) => row.id)
  }
  const rows = await db.seatingTable.findMany({
    where: { weddingId },
    orderBy: { name: 'asc' },
    select: { id: true },
  })
  return rows.map((row) => row.id)
}

function worksheetFromRequest(request: NextRequest): OrderedPlannerWorksheet | null {
  const value = new URL(request.url).searchParams.get('module')
  return isOrderedPlannerWorksheet(value) ? value : null
}

export async function GET(request: NextRequest) {
  const worksheet = worksheetFromRequest(request)
  if (!worksheet) {
    return NextResponse.json({ success: false, error: 'Unsupported worksheet module.' }, { status: 400 })
  }

  const access = await requireWeddingPermission(request, VIEW_PERMISSION[worksheet])
  if (access.error) return access.error

  try {
    const ids = await currentIds(worksheet, access.context.weddingId)
    const saved = await readPlannerWorksheetOrder(access.context.weddingId, worksheet)
    return NextResponse.json({
      success: true,
      module: worksheet,
      data: mergePlannerWorksheetOrder(saved, ids),
      customized: saved.length > 0,
    })
  } catch (error) {
    console.error('[planner worksheet order GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to load worksheet order.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const worksheet = worksheetFromRequest(request)
  if (!worksheet) {
    return NextResponse.json({ success: false, error: 'Unsupported worksheet module.' }, { status: 400 })
  }

  const access = await requireWeddingPermission(request, EDIT_PERMISSION[worksheet])
  if (access.error) return access.error

  try {
    const body = (await request.json()) as { order?: unknown }
    if (!Array.isArray(body.order)) {
      return NextResponse.json({ success: false, error: 'order must be an array of record IDs.' }, { status: 400 })
    }
    const requested = body.order.filter(
      (value): value is string => typeof value === 'string' && value.trim().length > 0,
    )
    if (requested.length !== body.order.length || requested.length > MAX_ORDERED_RECORDS) {
      return NextResponse.json(
        { success: false, error: `Select no more than ${MAX_ORDERED_RECORDS} valid records.` },
        { status: 400 },
      )
    }
    if (new Set(requested).size !== requested.length) {
      return NextResponse.json({ success: false, error: 'Worksheet order contains duplicate records.' }, { status: 400 })
    }

    const ids = await currentIds(worksheet, access.context.weddingId)
    const current = new Set(ids)
    const foreign = requested.filter((id) => !current.has(id))
    if (foreign.length) {
      return NextResponse.json(
        { success: false, error: 'One or more records do not belong to the active wedding.' },
        { status: 400 },
      )
    }

    const normalized = mergePlannerWorksheetOrder(requested, ids)
    const previous = mergePlannerWorksheetOrder(
      await readPlannerWorksheetOrder(access.context.weddingId, worksheet),
      ids,
    )
    await savePlannerWorksheetOrder({
      weddingId: access.context.weddingId,
      module: worksheet,
      order: normalized,
    })
    await db.auditEvent.create({
      data: {
        action: 'planner.worksheet_reorder',
        resourceType: 'planner_worksheet',
        resourceId: worksheet,
        beforeValue: JSON.stringify(previous),
        afterValue: JSON.stringify(normalized),
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
      },
    })

    return NextResponse.json({ success: true, module: worksheet, data: normalized })
  } catch (error) {
    console.error('[planner worksheet order PUT] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to save worksheet order.' }, { status: 500 })
  }
}
