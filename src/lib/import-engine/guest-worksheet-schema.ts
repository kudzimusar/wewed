import { buildGuestWorksheetSchema } from './guest-worksheet-contract'
import { fetchGuestWorksheetRecords } from './guest-worksheet-read'

export const guestWorksheetSchema = buildGuestWorksheetSchema(fetchGuestWorksheetRecords)
