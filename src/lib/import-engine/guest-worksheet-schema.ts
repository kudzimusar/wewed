import {
  buildGuestWorksheetSchema,
  cleanGuestValue,
  inputDisplayName,
  toGuestWorksheetInput,
} from './guest-worksheet-contract'
import { fetchGuestWorksheetRecords } from './guest-worksheet-read'

const baseGuestWorksheetSchema = buildGuestWorksheetSchema(fetchGuestWorksheetRecords)
const NAME_REQUIRED_ERROR = 'Either "First Name" or "Display Name" is required'

export const guestWorksheetSchema = {
  ...baseGuestWorksheetSchema,
  validateRow(row: Record<string, string>): string[] {
    const errors = baseGuestWorksheetSchema.validateRow(row)
    const hasStableLookup = Boolean(cleanGuestValue(row.guestId) || cleanGuestValue(row.email))
    return hasStableLookup ? errors.filter((error) => error !== NAME_REQUIRED_ERROR) : errors
  },
  matchExisting(row: Record<string, string>, records: any[]) {
    const match = baseGuestWorksheetSchema.matchExisting?.(row, records) ?? {}
    if (match.record || match.error) return match

    const input = toGuestWorksheetInput(row)
    const hasStableLookup = Boolean(input.guestId || input.email)
    if (hasStableLookup && !inputDisplayName(input)) {
      return {
        error: 'Guest ID or email did not resolve to an existing guest, and a name is required to create a new guest.',
      }
    }
    return match
  },
}
