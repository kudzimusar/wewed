import AsyncStorage from '@react-native-async-storage/async-storage'
import { buildWewedHeaders } from '@/lib/api-request'
import type { OfflineManifestData, OfflineManifestGuestRecord, QueuedScanRecord } from './pass-types'

const MANIFEST_PREFIX = 'wewed_offline_manifest_'
const QUEUE_PREFIX = 'wewed_offline_queue_'

export async function saveOfflineManifest(manifest: OfflineManifestData): Promise<void> {
  const key = `${MANIFEST_PREFIX}${manifest.weddingId}`
  await AsyncStorage.setItem(key, JSON.stringify(manifest))
}

export async function getOfflineManifest(weddingId: string): Promise<OfflineManifestData | null> {
  const key = `${MANIFEST_PREFIX}${weddingId}`
  const raw = await AsyncStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as OfflineManifestData
  } catch {
    return null
  }
}

export async function getQueuedScans(weddingId: string): Promise<QueuedScanRecord[]> {
  const key = `${QUEUE_PREFIX}${weddingId}`
  const raw = await AsyncStorage.getItem(key)
  if (!raw) return []
  try {
    return JSON.parse(raw) as QueuedScanRecord[]
  } catch {
    return []
  }
}

export async function enqueueOfflineScan(record: Omit<QueuedScanRecord, 'id' | 'synced'>): Promise<QueuedScanRecord> {
  const queuedScans = await getQueuedScans(record.weddingId)
  const fullRecord: QueuedScanRecord = {
    ...record,
    id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    synced: false,
  }

  queuedScans.push(fullRecord)
  const key = `${QUEUE_PREFIX}${record.weddingId}`
  await AsyncStorage.setItem(key, JSON.stringify(queuedScans))

  // Update local cached manifest check-in count so subsequent scans reflect the arrival
  const manifest = await getOfflineManifest(record.weddingId)
  if (manifest) {
    const pass = manifest.passes.find((p) => p.passId === record.passId)
    if (pass) {
      pass.checkedInCount = Math.min(pass.partyCount, pass.checkedInCount + record.partyCountDelta)
      await saveOfflineManifest(manifest)
    }
  }

  return fullRecord
}

export async function clearSyncedScans(weddingId: string, syncedIds: string[]): Promise<void> {
  const queuedScans = await getQueuedScans(weddingId)
  const remaining = queuedScans.filter((s) => !syncedIds.includes(s.id))
  const key = `${QUEUE_PREFIX}${weddingId}`
  await AsyncStorage.setItem(key, JSON.stringify(remaining))
}

export interface LocalCheckInVerification {
  valid: boolean
  status: 'valid' | 'already_checked_in' | 'invalid_pass'
  guest?: OfflineManifestGuestRecord
  message?: string
  partyCountDelta: number
}

/**
 * Validates a scanned pass against the offline manifest in local storage.
 */
export async function verifyPassOffline(
  weddingId: string,
  passId: string,
  requestedPartyDelta?: number
): Promise<LocalCheckInVerification> {
  const manifest = await getOfflineManifest(weddingId)
  if (!manifest) {
    return {
      valid: false,
      status: 'invalid_pass',
      message: 'Offline manifest not downloaded. Please connect to download manifest first.',
      partyCountDelta: 0,
    }
  }

  const pass = manifest.passes.find((p) => p.passId === passId)
  if (!pass) {
    return {
      valid: false,
      status: 'invalid_pass',
      message: 'Pass not recognized in this wedding guest list.',
      partyCountDelta: 0,
    }
  }

  if (pass.checkedInCount >= pass.partyCount) {
    return {
      valid: false,
      status: 'already_checked_in',
      guest: pass,
      message: `Already fully checked in (${pass.checkedInCount}/${pass.partyCount} arrived).`,
      partyCountDelta: 0,
    }
  }

  const delta = typeof requestedPartyDelta === 'number' && requestedPartyDelta > 0
    ? requestedPartyDelta
    : pass.partyCount - pass.checkedInCount

  return {
    valid: true,
    status: 'valid',
    guest: pass,
    partyCountDelta: delta,
  }
}

/**
 * Synchronizes the queued offline scans with the server.
 */
export async function syncOfflineQueueWithServer(
  weddingId: string,
  token?: string,
  staffDeviceId: string = 'native-mobile-device'
): Promise<{ success: boolean; syncedCount: number; remainingCount: number; error?: string }> {
  const queued = await getQueuedScans(weddingId)
  if (queued.length === 0) {
    return { success: true, syncedCount: 0, remainingCount: 0 }
  }

  try {
    const payload = {
      weddingId,
      staffDeviceId,
      records: queued.map((item) => ({
        passId: item.passId,
        scanTimestamp: item.scanTimestamp,
        stationGate: item.stationGate,
        partyCountDelta: item.partyCountDelta,
      })),
    }

    const baseUrl = process.env.EXPO_PUBLIC_WEWED_API_BASE_URL || 'https://wewed.pro'
    const headers = buildWewedHeaders({ token, body: JSON.stringify(payload) })

    const res = await fetch(`${baseUrl}/api/pass/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    const response = await res.json().catch(() => null) as { success?: boolean; processedCount?: number } | null

    if (res.ok && response?.success) {
      const syncedIds = queued.map((item) => item.id)
      await clearSyncedScans(weddingId, syncedIds)
      return { success: true, syncedCount: response.processedCount ?? queued.length, remainingCount: 0 }
    }

    return { success: false, syncedCount: 0, remainingCount: queued.length, error: 'Server returned sync failure.' }
  } catch (err) {
    return {
      success: false,
      syncedCount: 0,
      remainingCount: queued.length,
      error: err instanceof Error ? err.message : 'Network sync error',
    }
  }
}
