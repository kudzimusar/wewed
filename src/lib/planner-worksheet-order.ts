import 'server-only'

import { db } from '@/lib/db'

export const PLANNER_WORKSHEET_ORDER_SECTION = 'planner_worksheet_order'

export type OrderedPlannerWorksheet =
  | 'tasks'
  | 'budget'
  | 'vendors'
  | 'guests'
  | 'timeline'
  | 'seating'

const ORDERED_MODULES = new Set<OrderedPlannerWorksheet>([
  'tasks',
  'budget',
  'vendors',
  'guests',
  'timeline',
  'seating',
])

export function isOrderedPlannerWorksheet(value: unknown): value is OrderedPlannerWorksheet {
  return typeof value === 'string' && ORDERED_MODULES.has(value as OrderedPlannerWorksheet)
}

function parseOrder(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return Array.from(
      new Set(parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)),
    )
  } catch {
    return []
  }
}

export async function readPlannerWorksheetOrder(
  weddingId: string,
  module: OrderedPlannerWorksheet,
): Promise<string[]> {
  const record = await db.weddingContent.findUnique({
    where: {
      weddingId_section_field: {
        weddingId,
        section: PLANNER_WORKSHEET_ORDER_SECTION,
        field: module,
      },
    },
    select: { value: true },
  })
  return parseOrder(record?.value)
}

export function mergePlannerWorksheetOrder(saved: string[], currentIds: string[]): string[] {
  const current = new Set(currentIds)
  const retained = saved.filter((id) => current.has(id))
  const retainedSet = new Set(retained)
  const missing = currentIds.filter((id) => !retainedSet.has(id))
  return [...retained, ...missing]
}

export async function savePlannerWorksheetOrder(input: {
  weddingId: string
  module: OrderedPlannerWorksheet
  order: string[]
}): Promise<void> {
  await db.weddingContent.upsert({
    where: {
      weddingId_section_field: {
        weddingId: input.weddingId,
        section: PLANNER_WORKSHEET_ORDER_SECTION,
        field: input.module,
      },
    },
    create: {
      weddingId: input.weddingId,
      section: PLANNER_WORKSHEET_ORDER_SECTION,
      field: input.module,
      value: JSON.stringify(input.order),
      order: 0,
      metadata: JSON.stringify({ version: 1, kind: 'presentation_order' }),
    },
    update: {
      value: JSON.stringify(input.order),
      metadata: JSON.stringify({ version: 1, kind: 'presentation_order' }),
    },
  })
}
