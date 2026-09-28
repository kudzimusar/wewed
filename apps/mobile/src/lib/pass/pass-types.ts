export type PassLifecycleStage =
  | 'invitation'
  | 'attending'
  | 'pre_wedding'
  | 'wedding_morning'
  | 'checked_in'
  | 'during'
  | 'after'
  | 'expired'

export interface PassGuestContext {
  guestId: string
  guestName: string
  partyCount: number
  checkedInCount: number
  plusOneName?: string | null
  dietaryNotes?: string | null
  mealChoice?: string | null
  tableName?: string | null
  tableNumber?: number | null
  seatNumber?: string | null
}

export interface PassWeddingContext {
  weddingId: string
  title: string
  coupleNames: string
  date: string
  venue: string
  venueCity: string
  venueCountry: string
  primaryColor: string
  backgroundColor: string
  accentColor: string
  monogram?: string | null
  slug: string
}

export interface PassScheduleItem {
  id: string
  time: string
  title: string
  location?: string | null
  description?: string | null
}

export interface PassModel {
  passId: string
  serialNumber: string
  passType: 'individual' | 'household'
  lifecycleStage: PassLifecycleStage
  wedding: PassWeddingContext
  guest: PassGuestContext
  schedule: PassScheduleItem[]
  entitlements: string[]
  signedQrCredential: string
  deepLinks: {
    webPassUrl: string
    rsvpUrl: string
    directionsUrl: string
    scheduleUrl: string
    seatingUrl: string
    photosUrl: string
    applePassUrl: string
    googleWalletUrl: string
    nativeAppUrl: string
  }
}

export interface PassQrPayload {
  v: number
  wId: string
  pId: string
  gId?: string
  pt: 'individual' | 'household'
  cnt: number
  ent?: string[]
  iat: number
  exp?: number
  nonce: string
}

export interface VerificationResult {
  valid: boolean
  payload?: PassQrPayload
  error?: string
}

export interface OfflineManifestGuestRecord {
  guestId: string
  guestName: string
  passId: string | null
  serialNumber: string | null
  partyCount: number
  checkedInCount: number
  tableName: string | null
  tableNumber: number | null
  allowedEvents: string[]
}

export interface OfflineManifestData {
  weddingId: string
  title: string
  venue: string
  date: string
  generatedAt: string
  passes: OfflineManifestGuestRecord[]
}

export interface QueuedScanRecord {
  id: string
  passId: string
  weddingId: string
  guestName: string
  stationGate: string
  partyCountDelta: number
  scanTimestamp: string
  synced: boolean
}
