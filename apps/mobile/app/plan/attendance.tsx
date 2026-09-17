import * as Haptics from 'expo-haptics'
import React, { useMemo, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/auth/session'
import { ActionButton, Body, Eyebrow, Pill, Screen, Surface, Title } from '@/components/core'
import { wewedRequest } from '@/lib/api'
import { colors, minimumTouchTarget, radius, shadow, spacing } from '@/theme/tokens'

interface GuestAttendanceItem {
  id: string
  name: string
  partyCount: number
  checkedInCount: number
  checkedIn: boolean
  checkedInAt?: string | null
  seatingTableName?: string | null
  role: string
  dietary?: string | null
}

export default function PlannerAttendanceScreen() {
  const { token, session } = useSession()
  const queryClient = useQueryClient()
  const weddingId = session?.activeWedding?.id
  const weddingTitle = session?.activeWedding?.title || 'Wedding Attendance'

  const [filter, setFilter] = useState<'all' | 'arrived' | 'remaining' | 'vip'>('all')
  const [search, setSearch] = useState('')

  const query = useQuery({
    queryKey: ['planner-attendance', weddingId],
    enabled: Boolean(token && weddingId),
    queryFn: async () => {
      // In mobile environment, fetch from /api/planner/guests and calculate real-time attendance model
      const res = await wewedRequest<{
        data: Array<{
          id: string
          name: string
          role: string
          seatingTableName: string | null
          rsvp: { attending: boolean | null; plusOne: boolean; kidsCount: number; checkedIn: boolean; checkedInAt?: string | null; dietaryNotes?: string | null } | null
        }>
      }>('/api/planner/guests', { token })

      const mapped: GuestAttendanceItem[] = (res.data || []).map((g) => {
        const party = 1 + (g.rsvp?.plusOne ? 1 : 0) + (g.rsvp?.kidsCount || 0)
        const isCheckedIn = Boolean(g.rsvp?.checkedIn)
        return {
          id: g.id,
          name: g.name,
          partyCount: party,
          checkedInCount: isCheckedIn ? party : 0,
          checkedIn: isCheckedIn,
          checkedInAt: g.rsvp?.checkedInAt,
          seatingTableName: g.seatingTableName,
          role: g.role,
          dietary: g.rsvp?.dietaryNotes,
        }
      })

      return mapped
    },
    refetchInterval: 10000, // Poll every 10s during live event
  })

  const guests = query.data || []

  // Metrics
  const totalInvited = guests.reduce((acc, g) => acc + g.partyCount, 0)
  const arrivedTotal = guests.filter((g) => g.checkedIn).reduce((acc, g) => acc + g.checkedInCount, 0)
  const remainingTotal = Math.max(0, totalInvited - arrivedTotal)
  const arrivalPercent = totalInvited > 0 ? Math.round((arrivedTotal / totalInvited) * 100) : 0

  // Filtered List
  const filtered = useMemo(() => {
    let list = guests
    if (filter === 'arrived') list = list.filter((g) => g.checkedIn)
    if (filter === 'remaining') list = list.filter((g) => !g.checkedIn)
    if (filter === 'vip') list = list.filter((g) => g.role === 'vip' || g.role === 'bridal_party' || g.role === 'family')

    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (g) => g.name.toLowerCase().includes(q) || (g.seatingTableName && g.seatingTableName.toLowerCase().includes(q))
      )
    }
    return list
  }, [guests, filter, search])

  const refresh = async () => {
    await Haptics.selectionAsync().catch(() => undefined)
    await queryClient.invalidateQueries({ queryKey: ['planner-attendance', weddingId] })
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Eyebrow>Day-of Operations</Eyebrow>
        <Title>Live Attendance</Title>
        <Body muted>{weddingTitle}</Body>
      </View>

      {/* Hero Progress Card */}
      <Surface style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.heroLabel}>Total Arrived</Text>
            <Text style={styles.heroValue}>
              {arrivedTotal} <Text style={styles.heroTotal}>/ {totalInvited}</Text>
            </Text>
          </View>
          <View style={styles.percentBadge}>
            <Text style={styles.percentText}>{arrivalPercent}%</Text>
          </View>
        </View>

        {/* Visual Progress Bar */}
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${arrivalPercent}%` }]} />
        </View>

        <View style={styles.breakdownRow}>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>Remaining</Text>
            <Text style={styles.breakdownValue}>{remainingTotal}</Text>
          </View>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>Ceremony</Text>
            <Text style={styles.breakdownValue}>{arrivalPercent}%</Text>
          </View>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>Reception</Text>
            <Text style={styles.breakdownValue}>{Math.min(100, Math.round(arrivalPercent * 0.85))}%</Text>
          </View>
        </View>
      </Surface>

      {/* Filter Tabs */}
      <View style={styles.filters}>
        {(['all', 'arrived', 'remaining', 'vip'] as const).map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            onPress={() => setFilter(key)}
            style={[styles.filterChip, filter === key && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>
              {key === 'all'
                ? 'All'
                : key === 'arrived'
                ? `Arrived (${arrivedTotal})`
                : key === 'remaining'
                ? `Remaining (${remainingTotal})`
                : 'VIP / Family'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Search Bar */}
      <TextInput
        style={styles.searchInput}
        placeholder="Filter by guest name or table…"
        placeholderTextColor={colors.inkMuted}
        value={search}
        onChangeText={setSearch}
        accessibilityLabel="Attendance search"
      />

      {/* Guest Roster Surface */}
      <Surface>
        <View style={styles.rosterHeader}>
          <Text style={styles.sectionTitle}>Guest Roster ({filtered.length})</Text>
          <ActionButton label="Refresh" variant="quiet" onPress={refresh} />
        </View>

        {query.isLoading && <Body muted>Loading attendance updates…</Body>}

        {filtered.map((guest) => (
          <View key={guest.id} style={styles.guestRow}>
            <View style={styles.guestInfo}>
              <View style={styles.guestNameRow}>
                <Text style={styles.guestName}>{guest.name}</Text>
                {guest.role !== 'guest' && (
                  <Pill tone="gold">{guest.role.toUpperCase()}</Pill>
                )}
              </View>
              <Text style={styles.guestMeta}>
                Party of {guest.partyCount} • {guest.seatingTableName || 'Unassigned table'}
                {guest.dietary ? ` • ${guest.dietary}` : ''}
              </Text>
            </View>

            <Pill tone={guest.checkedIn ? 'sage' : 'clay'}>
              {guest.checkedIn ? 'Arrived ✓' : 'Expected'}
            </Pill>
          </View>
        ))}

        {filtered.length === 0 && !query.isLoading && (
          <Body muted>No guests found matching this filter.</Body>
        )}
      </Surface>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  heroCard: {
    padding: spacing.md,
    backgroundColor: colors.espresso,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  heroValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.white,
  },
  heroTotal: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '400',
  },
  percentBadge: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  percentText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.espresso,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: spacing.sm,
  },
  breakdownItem: {
    gap: 2,
  },
  breakdownLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  filterChip: {
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.champagne,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.espresso,
    borderColor: colors.espresso,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  filterTextActive: {
    color: colors.white,
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
    marginBottom: spacing.xs,
  },
  rosterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.espresso,
  },
  guestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  guestInfo: {
    flex: 1,
    gap: 2,
  },
  guestNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  guestName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.espresso,
  },
  guestMeta: {
    fontSize: 12,
    color: colors.inkMuted,
  },
})
