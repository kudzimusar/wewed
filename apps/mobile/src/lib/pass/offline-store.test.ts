import { describe, expect, it, mock } from 'bun:test'
import type { OfflineManifestData } from './pass-types'

const memoryStore = new Map<string, string>()

mock.module('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => memoryStore.get(key) || null,
    setItem: async (key: string, value: string) => {
      memoryStore.set(key, value)
    },
    removeItem: async (key: string) => {
      memoryStore.delete(key)
    },
    clear: async () => {
      memoryStore.clear()
    },
  },
}))

// Import offline-store after mocking AsyncStorage
const {
  saveOfflineManifest,
  getOfflineManifest,
  verifyPassOffline,
  enqueueOfflineScan,
  getQueuedScans,
  clearSyncedScans,
} = await import('./offline-store')

describe('Offline Manifest and Check-In Queue', () => {
  const sampleManifest: OfflineManifestData = {
    weddingId: 'wedding_test_123',
    title: 'Tariro & Shadreck',
    venue: 'Imba Manor',
    date: '2026-10-24T14:00:00.000Z',
    generatedAt: '2026-10-24T10:00:00.000Z',
    passes: [
      {
        guestId: 'guest_1',
        guestName: 'Jane Doe',
        passId: 'pass_jane_1',
        serialNumber: 'SN-001',
        partyCount: 2,
        checkedInCount: 0,
        tableName: 'Jacaranda Table 8',
        tableNumber: 8,
        allowedEvents: ['ceremony', 'reception'],
      },
      {
        guestId: 'guest_2',
        guestName: 'Sarah VIP',
        passId: 'pass_sarah_2',
        serialNumber: 'SN-002',
        partyCount: 1,
        checkedInCount: 1, // Already checked in
        tableName: 'High Table',
        tableNumber: 1,
        allowedEvents: ['all'],
      },
    ],
  }

  it('saves and retrieves offline manifest', async () => {
    await saveOfflineManifest(sampleManifest)
    const retrieved = await getOfflineManifest('wedding_test_123')

    expect(retrieved).not.toBeNull()
    expect(retrieved?.title).toBe('Tariro & Shadreck')
    expect(retrieved?.passes.length).toBe(2)
  })

  it('verifies an authentic un-checked-in pass offline', async () => {
    const result = await verifyPassOffline('wedding_test_123', 'pass_jane_1')

    expect(result.valid).toBe(true)
    expect(result.status).toBe('valid')
    expect(result.guest?.guestName).toBe('Jane Doe')
    expect(result.partyCountDelta).toBe(2)
  })

  it('rejects already checked in pass offline', async () => {
    const result = await verifyPassOffline('wedding_test_123', 'pass_sarah_2')

    expect(result.valid).toBe(false)
    expect(result.status).toBe('already_checked_in')
    expect(result.message).toContain('Already fully checked in')
  })

  it('rejects unknown pass offline', async () => {
    const result = await verifyPassOffline('wedding_test_123', 'unknown_pass_id')

    expect(result.valid).toBe(false)
    expect(result.status).toBe('invalid_pass')
    expect(result.message).toContain('Pass not recognized')
  })

  it('enqueues offline scans and updates cached counts', async () => {
    const queued = await enqueueOfflineScan({
      passId: 'pass_jane_1',
      weddingId: 'wedding_test_123',
      guestName: 'Jane Doe',
      stationGate: 'Gate A',
      partyCountDelta: 2,
      scanTimestamp: new Date().toISOString(),
    })

    expect(queued.id).toBeDefined()
    expect(queued.synced).toBe(false)

    // Check queue
    const allQueued = await getQueuedScans('wedding_test_123')
    expect(allQueued.length).toBe(1)
    expect(allQueued[0]?.passId).toBe('pass_jane_1')

    // Subsequent offline check should now see Jane as already checked in!
    const recheck = await verifyPassOffline('wedding_test_123', 'pass_jane_1')
    expect(recheck.status).toBe('already_checked_in')

    // Clear synced
    await clearSyncedScans('wedding_test_123', [queued.id])
    const remaining = await getQueuedScans('wedding_test_123')
    expect(remaining.length).toBe(0)
  })
})
