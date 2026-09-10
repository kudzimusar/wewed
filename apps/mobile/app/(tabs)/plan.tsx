import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { Body, Eyebrow, Pill, Screen, Surface, Title } from '@/components/core'
import { wewedRequest } from '@/lib/api'
import type { PlannerBudgetSummary, PlannerGuest, PlannerTask, PlannerTimelineItem, PlannerVendor } from '@/lib/types'
import { colors, minimumTouchTarget, radius, spacing } from '@/theme/tokens'

export default function PlanHub() {
  const { session, token } = useSession()
  const wedding = session?.activeWedding
  const summary = useQuery({
    queryKey: ['plan-hub', wedding?.id],
    enabled: Boolean(token && wedding),
    queryFn: async () => {
      const [tasks, budget, guests, vendors, timeline] = await Promise.all([
        wewedRequest<{ data: PlannerTask[] }>('/api/planner/tasks', { token }),
        wewedRequest<{ summary: PlannerBudgetSummary }>('/api/planner/budget', { token }),
        wewedRequest<{ data: PlannerGuest[] }>('/api/planner/guests', { token }),
        wewedRequest<{ data: PlannerVendor[] }>('/api/planner/vendors', { token }),
        wewedRequest<{ data: PlannerTimelineItem[] }>('/api/planner/timeline', { token }),
      ])
      return {
        tasks: tasks.data,
        budget: budget.summary,
        guests: guests.data,
        vendors: vendors.data,
        timeline: timeline.data,
      }
    },
  })

  if (!wedding) {
    return <Screen><Eyebrow>Plan</Eyebrow><Title>Choose a wedding first.</Title><Body muted>Open a wedding from Today to work with its tasks, guests, budget, vendors and timeline.</Body></Screen>
  }

  const openTasks = summary.data?.tasks.filter((task) => task.status !== 'done').length ?? 0
  const confirmedGuests = summary.data?.guests.filter((guest: any) => guest.rsvp?.attending === true).length ?? 0

  return (
    <Screen>
      <View style={styles.header}>
        <Eyebrow>Planning command centre</Eyebrow>
        <Title>{wedding.title}</Title>
        <Body muted>Everything important is within thumb reach. Deep tools stay available without turning your phone into a desktop dashboard.</Body>
      </View>

      <View style={styles.grid}>
        <PlanCard title="Tasks" value={summary.isLoading ? '…' : String(openTasks)} detail="open actions" tone="gold" onPress={() => router.push('/plan/tasks')} />
        <PlanCard title="Budget" value={summary.isLoading ? '…' : money(summary.data?.budget.totalOutstanding ?? 0, summary.data?.budget.currency)} detail="outstanding" tone="clay" onPress={() => router.push('/plan/budget')} />
        <PlanCard title="Guests" value={summary.isLoading ? '…' : String(summary.data?.guests.length ?? 0)} detail={`${confirmedGuests} confirmed`} tone="plum" onPress={() => router.push('/plan/guests')} />
        <PlanCard title="Vendors" value={summary.isLoading ? '…' : String(summary.data?.vendors.length ?? 0)} detail="in your plan" tone="sage" onPress={() => router.push('/plan/vendors')} />
      </View>

      <Surface>
        <Text style={styles.sectionTitle}>Wedding operations</Text>
        <HubRow label="Contributions" detail="Cash, direct vendor payments and in-kind support" onPress={() => router.push('/plan/contributions')} />
        <HubRow label="Timeline" detail={`${summary.data?.timeline.length ?? 0} event-day items`} onPress={() => router.push('/plan/timeline')} />
        <HubRow label="Seating" detail="Tables, capacity and guest placement" onPress={() => router.push('/plan/guests')} />
      </Surface>
    </Screen>
  )
}

function PlanCard({ title, value, detail, tone, onPress }: { title: string; value: string; detail: string; tone: 'gold' | 'clay' | 'plum' | 'sage'; onPress: () => void }) {
  const accent = tone === 'clay' ? colors.clay : tone === 'plum' ? colors.plum : tone === 'sage' ? colors.sage : colors.gold
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.planCard, pressed && styles.pressed]}>
      <View style={[styles.topLine, { backgroundColor: accent }]} />
      <Pill tone={tone}>{title}</Pill>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardDetail}>{detail}</Text>
    </Pressable>
  )
}

function HubRow({ label, detail, onPress }: { label: string; detail: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.hubRow, pressed && styles.pressed]}>
      <View style={styles.flexOne}><Text style={styles.rowTitle}>{label}</Text><Text style={styles.rowDetail}>{detail}</Text></View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  )
}

function money(value: number, currency = 'USD') {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value) }
  catch { return `$${Math.round(value).toLocaleString()}` }
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, paddingTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  planCard: { width: '48%', minHeight: 148, backgroundColor: colors.white, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, overflow: 'hidden' },
  topLine: { position: 'absolute', left: 0, right: 0, top: 0, height: 4 },
  cardValue: { color: colors.espresso, fontFamily: 'serif', fontSize: 28, fontWeight: '600' },
  cardDetail: { color: colors.inkMuted, fontSize: 12, fontWeight: '600' },
  sectionTitle: { color: colors.espresso, fontFamily: 'serif', fontSize: 22, fontWeight: '600' },
  hubRow: { minHeight: minimumTouchTarget + 12, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
  rowTitle: { color: colors.espresso, fontSize: 15, fontWeight: '700' },
  rowDetail: { color: colors.inkMuted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  arrow: { color: colors.goldMuted, fontSize: 30 },
  pressed: { opacity: 0.68 },
  flexOne: { flex: 1 },
})
