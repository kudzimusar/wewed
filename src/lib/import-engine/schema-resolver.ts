import { getModuleSchema, isModuleKey } from './schemas'
import { guestWorksheetSchema } from './guest-worksheet-schema'
import { getPlannerWorksheetSchema } from './planner-worksheet-schemas'
import type { ModuleKey, ModuleSchema } from './types'

export { isModuleKey }

export function getWorksheetSchema(moduleKey: ModuleKey): ModuleSchema {
  if (moduleKey === 'guests') return guestWorksheetSchema
  return getPlannerWorksheetSchema(moduleKey) ?? getModuleSchema(moduleKey)
}
