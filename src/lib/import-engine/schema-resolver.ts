import { getModuleSchema, isModuleKey } from './schemas'
import { guestWorksheetSchema } from './guest-worksheet-schema'
import { getPlannerWorksheetSchema } from './planner-worksheet-schemas'
import type { ModuleKey, ModuleSchema } from './types'

export { isModuleKey }

export function getWorksheetSchema(moduleKey: ModuleKey): ModuleSchema {
  const legacySchema = moduleKey === 'guests' ? guestWorksheetSchema : getModuleSchema(moduleKey)
  if (moduleKey === 'guests') return legacySchema
  return getPlannerWorksheetSchema(moduleKey) ?? legacySchema
}
