import * as Haptics from 'expo-haptics'
import React, { useMemo, useState } from 'react'
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/auth/session'
import { ActionButton, Body, Eyebrow, Pill, Screen, Surface, Title } from '@/components/core'
import { WewedApiError, wewedRequest } from '@/lib/api'
import { colors, minimumTouchTarget, radius, shadow, spacing } from '@/theme/tokens'
import { parsePassCredential } from '@/lib/pass/pass-crypto'
import {
  enqueueOfflineScan,
  getOfflineManifest,
  getQueuedScans,
  syncOfflineQueueWithServer,
  verifyPassOffline,
  type LocalCheckInVerification,
} from '@/lib/pass/offline-store'
import type { OfflineManifestData, OfflineManifestGuestRecord } from '@/lib/pass/pass-types'

type ScanResultState =
  | { type: 'idle' }
  | {
      type: 'valid'
      guestName: string
      partyCount: number
      checkedInCount: number
      tableName: string | null
      passId: string
      delta: number
    }
  | {
      type: 'already_checked_in'
      guestName: string
      partyCount: number
      checkedInCount: number
      tableName: string | null
      message: string
      passId: string
    }
  | {
      type: 'invalid'
      error: string
    }

export default function StaffCheckInScreen() {
  const { token, session } = useSession()
  const queryClient = useQueryClient()
  const weddingId = session?.activeWedding?.id || 'default_wedding'
  const weddingTitle = session?.activeWedding?.title || 'Wedding Check-In'

  const [scanResult, setScanResult] = useState<ScanResultState>({ type: 'idle' })
  const [manualCode, setManualCode] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedGate, setSelectedGate] = useState('Main Entrance')

  // Query offline manifest and queue
  const manifestQuery = useQuery({
    queryKey: ['offline-manifest', weddingId],
    queryFn: async () => {
      const cached = await getOfflineManifest(weddingId)
      if (cached) return cached
      // Fetch fresh manifest if available
      try {
        const res = await wewedRequest<{ success: boolean; manifest?: { passes?: OfflineManifestGuestRecord[] } }>(
          `/api/pass/manifest?weddingId=${weddingId}`,
          { token }
        )
        if (res.manifest) {
          const fresh: OfflineManifestData = {
            weddingId,
            title: weddingTitle,
            venue: 'Main Venue',
            date: new Date().toISOString(),
            generatedAt: new Date().toISOString(),
            passes: res.manifest.passes || [],
          }
          return fresh
        }
      } catch {
        // Fallback to empty manifest if offline
      }
      return null
    },
  })

  const queueQuery = useQuery({
    queryKey: ['offline-queue', weddingId],
    queryFn: () => getQueuedScans(weddingId),
  })

  const totalGuests = manifestQuery.data?.passes.reduce((acc, p) => acc + p.partyCount, 0) || 0
  const arrivedGuests = manifestQuery.data?.passes.reduce((acc, p) => acc + p.checkedInCount, 0) || 0
  const queuedCount = queueQuery.data?.length || 0

  const syncMutation = useMutation({
    mutationFn: () => syncOfflineQueueWithServer(weddingId, token ?? undefined),
    onSuccess: async (res) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
      await queryClient.invalidateQueries({ queryKey: ['offline-queue', weddingId] })
      await queryClient.invalidateQueries({ queryKey: ['offline-manifest', weddingId] })
      Alert.alert('Queue Synchronized', `Successfully synced ${res.syncedCount} scan(s).`)
    },
    onError: (err) => {
      Alert.alert('Sync Failed', err instanceof Error ? err.message : 'Could not sync queue.')
    },
  })

  // Handle scanned QR credential
  const handleProcessScan = async (rawQr: string, override: boolean = false) => {
    if (!rawQr.trim()) return
    setIsProcessing(true)

    try {
      // 1. Client-side parse
      const parsed = parsePassCredential(rawQr)
      if (!parsed.valid || !parsed.payload) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
        setScanResult({
          type: 'invalid',
          error: parsed.error || 'Digital signature check failed or pass is invalid.',
        })
        setIsProcessing(false)
        return
      }

      const passId = parsed.payload.pId

      // 2. Try online server check-in first
      try {
        const response = await wewedRequest<{
          success: boolean
          status: string
          message?: string
          guest: {
            name: string
            partyCount: number
            checkedInCount: number
            table: string | null
          }
        }>('/api/pass/checkin', {
          token,
          method: 'POST',
          body: JSON.stringify({
            rawQr,
            stationGate: selectedGate,
            override,
          }),
        })

        if (response.status === 'valid') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
          setScanResult({
            type: 'valid',
            guestName: response.guest.name,
            partyCount: response.guest.partyCount,
            checkedInCount: response.guest.checkedInCount,
            tableName: response.guest.table,
            passId,
            delta: response.guest.partyCount,
          })
          await queryClient.invalidateQueries({ queryKey: ['offline-manifest', weddingId] })
        } else if (response.status === 'already_checked_in') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined)
          setScanResult({
            type: 'already_checked_in',
            guestName: response.guest.name,
            partyCount: response.guest.partyCount,
            checkedInCount: response.guest.checkedInCount,
            tableName: response.guest.table,
            message: response.message || 'Pass has already been checked in.',
            passId,
          })
        }
      } catch (netErr) {
        // 3. Fallback to Offline Local Verification
        const offlineCheck = await verifyPassOffline(weddingId, passId)
        if (offlineCheck.valid && offlineCheck.guest) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)

          await enqueueOfflineScan({
            passId,
            weddingId,
            guestName: offlineCheck.guest.guestName,
            stationGate: selectedGate,
            partyCountDelta: offlineCheck.partyCountDelta,
            scanTimestamp: new Date().toISOString(),
          })

          setScanResult({
            type: 'valid',
            guestName: offlineCheck.guest.guestName,
            partyCount: offlineCheck.guest.partyCount,
            checkedInCount: offlineCheck.guest.checkedInCount + offlineCheck.partyCountDelta,
            tableName: offlineCheck.guest.tableName,
            passId,
            delta: offlineCheck.partyCountDelta,
          })

          await queryClient.invalidateQueries({ queryKey: ['offline-queue', weddingId] })
          await queryClient.invalidateQueries({ queryKey: ['offline-manifest', weddingId] })
        } else if (offlineCheck.status === 'already_checked_in' && offlineCheck.guest) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined)
          setScanResult({
            type: 'already_checked_in',
            guestName: offlineCheck.guest.guestName,
            partyCount: offlineCheck.guest.partyCount,
            checkedInCount: offlineCheck.guest.checkedInCount,
            tableName: offlineCheck.guest.tableName,
            message: offlineCheck.message || 'Guest is already marked arrived.',
            passId,
          })
        } else {
          setScanResult({
            type: 'invalid',
            error: offlineCheck.message || 'Unrecognized offline pass.',
          })
        }
      }
    } finally {
      setIsProcessing(false)
      setManualCode('')
    }
  }

  // Filtered guest roster for manual search fallback
  const filteredGuests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q || !manifestQuery.data) return []
    return manifestQuery.data.passes.filter((p) =>
      p.guestName.toLowerCase().includes(q) || (p.tableName && p.tableName.toLowerCase().includes(q))
    )
  }, [searchQuery, manifestQuery.data])

  return (
    <Screen>
      {/* Header & Status Bar */}
      <View style={styles.header}>
        <Eyebrow>Day-of Operations</Eyebrow>
        <Title>Check-In Scanner</Title>
        <Body muted>{weddingTitle}</Body>

        <View style={styles.statusBar}>
          <Pill tone="gold">
            {arrivedGuests} / {totalGuests || '—'} Arrived
          </Pill>
          {queuedCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => syncMutation.mutate()}
              style={styles.syncButton}
            >
              <Pill tone="clay">{queuedCount} Offline Queued • Tap to Sync</Pill>
            </Pressable>
          ) : (
            <Pill tone="sage">Scanner Ready</Pill>
          )}
        </View>
      </View>

      {/* Camera Scanner Viewport Simulation */}
      <Surface style={styles.scannerViewport}>
        <View style={styles.viewFinder}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
          <Text style={styles.scanInstruction}>Align QR code within target</Text>
        </View>

        {/* Manual Test Scan Trigger / Input */}
        <View style={styles.manualEntry}>
          <TextInput
            style={styles.codeInput}
            placeholder="Paste or enter test QR credential…"
            placeholderTextColor={colors.inkMuted}
            value={manualCode}
            onChangeText={setManualCode}
            autoCapitalize="none"
            accessibilityLabel="QR credential input"
          />
          <ActionButton
            label={isProcessing ? 'Verifying…' : 'Scan Code'}
            disabled={isProcessing || !manualCode.trim()}
            loading={isProcessing}
            onPress={() => handleProcessScan(manualCode)}
          />
        </View>
      </Surface>

      {/* Glanceable Scan Result Cards */}
      {scanResult.type === 'valid' && (
        <Surface style={[styles.resultCard, styles.resultValid]}>
          <View style={styles.resultHeader}>
            <Text style={styles.validTitle}>✓ VALID PASS</Text>
            <Pill tone="sage">Checked In</Pill>
          </View>
          <Text style={styles.guestNameLarge}>{scanResult.guestName}</Text>
          <Text style={styles.partyText}>
            Party: {scanResult.partyCount} Guest{scanResult.partyCount > 1 ? 's' : ''} • Arrived: {scanResult.checkedInCount}
          </Text>
          {scanResult.tableName && (
            <View style={styles.tableBadge}>
              <Text style={styles.tableLabel}>Seating Table</Text>
              <Text style={styles.tableValue}>{scanResult.tableName}</Text>
            </View>
          )}
          <ActionButton
            label="Ready for Next Scan"
            variant="secondary"
            onPress={() => setScanResult({ type: 'idle' })}
          />
        </Surface>
      )}

      {scanResult.type === 'already_checked_in' && (
        <Surface style={[styles.resultCard, styles.resultWarning]}>
          <View style={styles.resultHeader}>
            <Text style={styles.warningTitle}>⚠ ALREADY CHECKED IN</Text>
            <Pill tone="clay">Previous Scan</Pill>
          </View>
          <Text style={styles.guestNameLarge}>{scanResult.guestName}</Text>
          <Text style={styles.metaText}>{scanResult.message}</Text>
          {scanResult.tableName && (
            <Text style={styles.tableValueSmall}>Table: {scanResult.tableName}</Text>
          )}
          <View style={styles.actionRow}>
            <ActionButton
              label="Dismiss"
              variant="quiet"
              onPress={() => setScanResult({ type: 'idle' })}
            />
            <ActionButton
              label="Supervisor Override"
              variant="secondary"
              onPress={() => handleProcessScan(`wewed:pass:v1.simulated.override`, true)}
            />
          </View>
        </Surface>
      )}

      {scanResult.type === 'invalid' && (
        <Surface style={[styles.resultCard, styles.resultError]}>
          <View style={styles.resultHeader}>
            <Text style={styles.errorTitle}>✕ INVALID PASS</Text>
            <Pill tone="plum">Rejected</Pill>
          </View>
          <Text style={styles.errorDescription}>{scanResult.error}</Text>
          <Body muted>Direct guest to Guest Assistance desk for verification.</Body>
          <ActionButton
            label="Try Again"
            variant="secondary"
            onPress={() => setScanResult({ type: 'idle' })}
          />
        </Surface>
      )}

      {/* Manual Guest Search Fallback */}
      <Surface>
        <Text style={styles.sectionTitle}>Manual Guest Search</Text>
        <Body muted>Look up by name or table if guest cannot present their pass</Body>
        <TextInput
          style={styles.searchInput}
          placeholder="Search guest name or table…"
          placeholderTextColor={colors.inkMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          accessibilityLabel="Guest search"
        />

        {filteredGuests.map((guest) => (
          <View key={guest.guestId} style={styles.guestSearchRow}>
            <View style={styles.guestSearchInfo}>
              <Text style={styles.guestSearchName}>{guest.guestName}</Text>
              <Text style={styles.metaText}>
                {guest.partyCount} Guest{guest.partyCount > 1 ? 's' : ''} • {guest.tableName || 'No table assigned'}
              </Text>
            </View>
            <ActionButton
              label={guest.checkedInCount >= guest.partyCount ? 'Arrived ✓' : 'Check In'}
              disabled={guest.checkedInCount >= guest.partyCount}
              variant={guest.checkedInCount >= guest.partyCount ? 'quiet' : 'primary'}
              onPress={async () => {
                if (guest.passId) {
                  await handleProcessScan(`wewed:pass:v1.manual.${guest.passId}`)
                }
              }}
            />
          </View>
        ))}
      </Surface>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  syncButton: {
    minHeight: minimumTouchTarget,
    justifyContent: 'center',
  },
  scannerViewport: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.espresso,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  viewFinder: {
    width: 220,
    height: 220,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: radius.md,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: colors.gold,
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  scanInstruction: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  manualEntry: {
    width: '100%',
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  codeInput: {
    backgroundColor: colors.white,
    color: colors.espresso,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    fontSize: 13,
  },
  resultCard: {
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1.5,
  },
  resultValid: {
    borderColor: colors.success,
    backgroundColor: '#F3F8F2',
  },
  resultWarning: {
    borderColor: colors.clay,
    backgroundColor: '#FAF4EF',
  },
  resultError: {
    borderColor: colors.danger,
    backgroundColor: '#FDF2F0',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  validTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.success,
    letterSpacing: 0.5,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.clay,
    letterSpacing: 0.5,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
    letterSpacing: 0.5,
  },
  guestNameLarge: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.espresso,
  },
  partyText: {
    fontSize: 14,
    color: colors.inkMuted,
    fontWeight: '500',
  },
  tableBadge: {
    backgroundColor: colors.champagne,
    padding: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: spacing.xs,
  },
  tableLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    color: colors.inkMuted,
    fontWeight: '600',
  },
  tableValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.espresso,
  },
  tableValueSmall: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.espresso,
  },
  metaText: {
    fontSize: 13,
    color: colors.inkMuted,
  },
  errorDescription: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.espresso,
  },
  searchInput: {
    backgroundColor: colors.white,
    color: colors.espresso,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  guestSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  guestSearchInfo: {
    flex: 1,
    gap: 2,
  },
  guestSearchName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.espresso,
  },
})
