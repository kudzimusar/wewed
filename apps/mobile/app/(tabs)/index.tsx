import { useNetInfo } from '@react-native-community/netinfo'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { ActionButton, Body, Divider, Eyebrow, Pill, Screen, Surface, Title } from '@/components/core'
import { readFieldModeSnapshot, savePulseFieldSnapshot, type FieldModeSnapshot } from '@/lib/field-mode'
import { wewedRequest } from '@/lib/api'
import type { PlannerBudgetSummary, PlannerTask } from '@/lib/types'
import { colors, radius, spacing } from '@/theme/tokens'

interface PulseData {
  tasks: PlannerTask[]
  budget: PlannerBudgetSummary | null
}

interface LoadedFieldSnapshot {
  key: string
  snapshot: FieldModeSnapshot | null
}

function daysTo(date: string) {
  const target = new Date(date).getTime()
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((target - now.getTime()) / 86_400_000)
}

export default function TodayScreen() {
  const { session, token, switchWedding } = useSession()
  const wedding = session?.activeWedding ?? null
  const userId = session?.user.id ?? null
  const weddingId = wedding?.id ?? null
  const snapshotKey = userId && weddingId ? `${userId}:${weddingId}` : null
  const netInfo = useNetInfo()
  const offline = netInfo.isConnected === false
  const [loadedSnapshot, setLoadedSnapshot] = useState<LoadedFieldSnapshot | null>(null)
  const [todayStart] = useState(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today.getTime()
  })

  useEffect(() => {
    if (!userId || !weddingId || !snapshotKey) return
    let alive = true
    void readFieldModeSnapshot(userId, weddingId).then((snapshot) => {
      if (alive) setLoadedSnapshot({ key: snapshotKey, snapshot })
    })
    return () => { alive = false }
  }, [userId, weddingId, snapshotKey])

  const pulse = useQuery({
    queryKey: ['mobile-pulse', weddingId],
    enabled: Boolean(token && wedding && !offline),
    queryFn: async (): Promise<PulseData> => {
      const [tasks, budget] = await Promise.all([
        wewedRequest<{ data: PlannerTask[] }>('/api/planner/tasks', { token }),
        wewedRequest<{ summary: PlannerBudgetSummary }>('/api/planner/budget', { token }),
      ])
      return { tasks: tasks.data ?? [], budget: budget.summary ?? null }
    },
  })

  useEffect(() => {
    if (!userId || !weddingId || !snapshotKey || !pulse.data) return
    void savePulseFieldSnapshot(userId, weddingId, pulse.data)
      .then(() => readFieldModeSnapshot(userId, weddingId))
      .then((snapshot) => setLoadedSnapshot({ key: snapshotKey, snapshot }))
      .catch(() => undefined)
  }, [pulse.data, userId, weddingId, snapshotKey])

  const fieldSnapshot = loadedSnapshot?.key === snapshotKey ? loadedSnapshot.snapshot : null
  const effectivePulse = pulse.data ?? fieldSnapshot?.pulse ?? null
  const usingFieldSnapshot = Boolean(!pulse.data && fieldSnapshot?.pulse)

  const taskStats = useMemo(() => {
    const tasks = effectivePulse?.tasks ?? []
    return {
      open: tasks.filter((task) => task.status !== 'done').length,
      urgent: tasks.filter((task) => task.status !== 'done' && task.priority === 'high').length,
      overdue: tasks.filter((task) => task.status !== 'done' && task.dueDate && new Date(task.dueDate).getTime() < todayStart).length,
    }
  }, [effectivePulse?.tasks, todayStart])

  const firstName = session?.user.displayName?.trim().split(/\s+/)[0] || 'there'

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.wordmark}>WEWED</Text>
          {session?.user.role ? <Pill tone="gold">{session.user.role}</Pill> : null}
        </View>
        <Eyebrow>Wedding pulse</Eyebrow>
        <Title>Good to see you, {firstName}.</Title>
        <Body muted>{wedding ? `${wedding.title} · ${wedding.venueCity || wedding.venueCountry || 'Wedding workspace'}` : 'Choose where you want to work today.'}</Body>
      </View>

      {offline ? (
        <View accessibilityRole="alert" style={styles.fieldBanner}>
          <View style={styles.flexOne}>
            <Text style={styles.fieldTitle}>Field Mode · offline</Text>
            <Text style={styles.fieldText}>{fieldSnapshot ? `Showing the last safe operational snapshot from ${new Date(fieldSnapshot.savedAt).toLocaleString()}.` : 'No local snapshot is available yet. Connect once to prepare this wedding for Field Mode.'}</Text>
          </View>
          <Pill tone="clay">Read only</Pill>
        </View>
      ) : usingFieldSnapshot ? (
        <View style={styles.fieldBanner}>
          <View style={styles.flexOne}>
            <Text style={styles.fieldTitle}>Using saved wedding snapshot</Text>
            <Text style={styles.fieldText}>Live refresh is unavailable right now; these operational figures were saved {fieldSnapshot ? new Date(fieldSnapshot.savedAt).toLocaleString() : 'earlier'}.</Text>
          </View>
          <Pill tone="gold">Stale</Pill>
        </View>
      ) : null}

      {!wedding && session?.weddings?.length ? (
        <Surface>
          <Text style={styles.sectionTitle}>Your weddings</Text>
          <Body muted>Open a wedding and Wewed will keep that project in context across Tasks, Guests, Budget and Messages.</Body>
          {session.weddings.filter((item) => item.membershipStatus === 'active').map((item) => (
            <Pressable
              key={item.id}
              onPress={() => void switchWedding(item.id)}
              style={({ pressed }) => [styles.weddingChoice, pressed && styles.pressed]}
            >
              <View style={styles.flexOne}>
                <Text style={styles.choiceTitle}>{item.title}</Text>
                <Text style={styles.choiceMeta}>{new Date(item.date).toLocaleDateString()} · {item.venueCity || item.venueCountry}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </Surface>
      ) : null}

      {wedding ? (
        <>
          <Surface>
            <View style={styles.countdownRow}>
              <View style={styles.flexOne}>
                <Eyebrow>Countdown</Eyebrow>
                <Text style={styles.countdown}>{Math.max(0, daysTo(wedding.date))}</Text>
                <Body muted>{daysTo(wedding.date) === 1 ? 'day to go' : 'days to go'}</Body>
              </View>
              <View style={styles.dateBlock}>
                <Text style={styles.dateMonth}>{new Date(wedding.date).toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</Text>
                <Text style={styles.dateDay}>{new Date(wedding.date).getDate()}</Text>
              </View>
            </View>
          </Surface>

          <View style={styles.metrics}>
            <Metric label="Open tasks" value={pulse.isLoading && !effectivePulse ? '…' : String(taskStats.open)} tone="gold" />
            <Metric label="High priority" value={pulse.isLoading && !effectivePulse ? '…' : String(taskStats.urgent)} tone="clay" />
            <Metric label="Overdue" value={pulse.isLoading && !effectivePulse ? '…' : String(taskStats.overdue)} tone="plum" />
            <Metric label="Outstanding" value={pulse.isLoading && !effectivePulse ? '…' : money(effectivePulse?.budget?.totalOutstanding ?? 0, effectivePulse?.budget?.currency)} tone="sage" />
          </View>

          <Surface>
            <View style={styles.sectionHeading}>
              <View style={styles.flexOne}>
                <Text style={styles.sectionTitle}>What needs attention</Text>
                <Body muted>Wewed surfaces the work that can move the wedding forward now.</Body>
              </View>
              {taskStats.overdue > 0 ? <Pill tone="plum">{taskStats.overdue} overdue</Pill> : <Pill tone="sage">On track</Pill>}
            </View>
            <Divider />
            {(effectivePulse?.tasks ?? []).filter((task) => task.status !== 'done').slice(0, 3).map((task) => (
              <View key={task.id} style={styles.attentionRow}>
                <View style={[styles.priorityMark, { backgroundColor: task.priority === 'high' ? colors.clay : task.priority === 'low' ? colors.sage : colors.gold }]} />
                <View style={styles.flexOne}>
                  <Text numberOfLines={2} style={styles.attentionTitle}>{task.title}</Text>
                  <Text style={styles.choiceMeta}>{task.assignee || 'Unassigned'}{task.dueDate ? ` · ${new Date(task.dueDate).toLocaleDateString()}` : ''}</Text>
                </View>
              </View>
            ))}
            {!pulse.isLoading && taskStats.open === 0 ? <Body muted>No open tasks are waiting. Use Plan to add the next action.</Body> : null}
            {offline ? <Body muted>Planning changes are intentionally unavailable in Field Mode. Reconnect before changing wedding records.</Body> : <ActionButton label="Open planning workspace" onPress={() => router.push('/(tabs)/plan')} variant="secondary" />}
          </Surface>
        </>
      ) : null}
    </Screen>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'gold' | 'clay' | 'plum' | 'sage' }) {
  const accent = tone === 'clay' ? colors.clay : tone === 'plum' ? colors.plum : tone === 'sage' ? colors.sage : colors.goldMuted
  return (
    <View style={styles.metric}>
      <View style={[styles.metricAccent, { backgroundColor: accent }]} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  )
}

function money(value: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
  } catch {
    return `$${Math.round(value).toLocaleString()}`
  }
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, paddingTop: spacing.sm },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  wordmark: { color: colors.espresso, fontFamily: 'serif', fontSize: 18, letterSpacing: 6, fontWeight: '600' },
  fieldBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: '#FFF4E8', borderColor: '#E0C497', borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  fieldTitle: { color: colors.espresso, fontSize: 14, fontWeight: '900' },
  fieldText: { color: colors.inkMuted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  countdown: { color: colors.espresso, fontFamily: 'serif', fontSize: 54, lineHeight: 58 },
  dateBlock: { width: 88, minHeight: 96, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.espresso, borderRadius: radius.lg },
  dateMonth: { color: colors.goldLight, fontWeight: '800', letterSpacing: 2, fontSize: 12 },
  dateDay: { color: colors.champagne, fontFamily: 'serif', fontSize: 38 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { width: '48%', minHeight: 112, borderRadius: radius.lg, backgroundColor: colors.white, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md, overflow: 'hidden' },
  metricAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  metricValue: { color: colors.espresso, fontFamily: 'serif', fontSize: 27, fontWeight: '600', marginLeft: 3 },
  metricLabel: { color: colors.inkMuted, fontSize: 12, fontWeight: '700', marginLeft: 3, marginTop: 4 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  sectionTitle: { color: colors.espresso, fontFamily: 'serif', fontSize: 22, fontWeight: '600' },
  attentionRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', minHeight: 54 },
  priorityMark: { width: 8, height: 8, borderRadius: 4 },
  attentionTitle: { color: colors.espresso, fontSize: 15, fontWeight: '700' },
  weddingChoice: { minHeight: 64, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  choiceTitle: { color: colors.espresso, fontSize: 15, fontWeight: '700' },
  choiceMeta: { color: colors.inkMuted, fontSize: 12, marginTop: 3 },
  chevron: { color: colors.goldMuted, fontSize: 30, lineHeight: 30 },
  pressed: { opacity: 0.6 },
  flexOne: { flex: 1 },
})
