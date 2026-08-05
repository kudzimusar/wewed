import { timelineMinutes } from '@/lib/planner-timeline-order'
import { getModuleSchema, isModuleKey } from './schemas'
import { guestWorksheetSchema } from './guest-worksheet-schema'
import { getPlannerWorksheetSchema } from './planner-worksheet-schemas'
import { seatingWorksheetSchema } from './seating-worksheet-schema'
import type { ModuleKey, ModuleSchema } from './types'

export { isModuleKey }

const TIMELINE_TIME_ERROR = 'Time must be a valid clock time (HH:MM or h:mm AM/PM).'

function withTimelineClockValidation(schema: ModuleSchema): ModuleSchema {
  return {
    ...schema,
    validateRow(row) {
      const errors = schema.validateRow(row)
      const time = row.time?.trim()
      if (time && timelineMinutes(time) === null) errors.push(TIMELINE_TIME_ERROR)
      return [...new Set(errors)]
    },
  }
}

export function getWorksheetSchema(moduleKey: ModuleKey): ModuleSchema {
  const legacySchema = moduleKey === 'guests' ? guestWorksheetSchema : getModuleSchema(moduleKey)
  if (moduleKey === 'guests') return legacySchema
  if (moduleKey === 'seating') return seatingWorksheetSchema
  const plannerSchema = getPlannerWorksheetSchema(moduleKey) ?? legacySchema
  return moduleKey === 'timeline' ? withTimelineClockValidation(plannerSchema) : plannerSchema
}
