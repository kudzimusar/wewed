import { getModuleSchema, isModuleKey } from './schemas'
import { guestWorksheetSchema } from './guest-worksheet-schema'
import type { ModuleKey, ModuleSchema } from './types'

export { isModuleKey }

export function getWorksheetSchema(moduleKey: ModuleKey): ModuleSchema {
  return moduleKey === 'guests' ? guestWorksheetSchema : getModuleSchema(moduleKey)
}
