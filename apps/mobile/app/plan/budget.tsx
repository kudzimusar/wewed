import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import React, { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { ActionButton, Body, Divider, Eyebrow, Field, Pill, Screen, Surface, Title } from '@/components/core'
import { WewedApiError, wewedRequest } from '@/lib/api'
import type { PlannerBudgetRow, PlannerBudgetSummary } from '@/lib/types'
import { colors, minimumTouchTarget, radius, spacing } from '@/theme/tokens'

const categories = ['venue', 'catering', 'attire', 'roora', 'decor', 'photo_video', 'music', 'transport', 'stationery', 'miscellaneous'] as const

type BudgetWithFunding = PlannerBudgetRow & {
  funding?: {
    coupleFunded: number
    contributorFunded: number
    legacyUnattributed: number
    otherAttributed: number
    inKindValue: number
    contributionAllocated: number
  }
  serviceEngagementId?: string | null
}

export default function BudgetScreen() {
  const { token, session } = useSession()
  const queryClient = useQueryClient()
  const weddingId = session?.activeWedding?.id
  const key = ['planner-budget', weddingId]
  const [description, setDescription] = useState('')
  const [estimated, setEstimated] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [category, setCategory] = useState<(typeof categories)[number]>('venue')
  const [error, setError] = useState<string | null>(null)

  const budget = useQuery({
    queryKey: key,
    enabled: Boolean(token && weddingId),
    queryFn: () => wewedRequest<{ data: BudgetWithFunding[]; summary: PlannerBudgetSummary }>('/api/planner/budget', { token }),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })

  const createItem = useMutation({
    mutationFn: () => wewedRequest('/api/planner/budget', {
      token,
      method: 'POST',
      body: JSON.stringify({
        description: description.trim(),
        category,
        estimatedCost: Number(estimated) || 0,
        currency: currency.trim().toUpperCase() || 'USD',
        paidAmount: 0,
      }),
    }),
    onSuccess: async () => {
      setDescription(''); setEstimated(''); setError(null)
      await refresh()
    },
    onError: (cause) => setError(cause instanceof WewedApiError ? cause.message : 'Budget item could not be saved.'),
  })

  const deleteItem = useMutation({
    mutationFn: (id: string) => wewedRequest(`/api/planner/budget/${id}`, { token, method: 'DELETE' }),
    onSuccess: refresh,
    onError: (cause) => Alert.alert('Wewed kept this record', cause instanceof WewedApiError ? cause.message : 'This budget item could not be deleted.'),
  })

  const summary = budget.data?.summary

  return (
    <Screen>
      <View style={styles.header}>
        <Eyebrow>Plan · Budget</Eyebrow>
        <Title>Know where the money is going.</Title>
        <Body muted>Wewed keeps wedding cost, payment and contribution funding separate so a contribution never silently becomes “your payment”.</Body>
      </View>

      <View style={styles.summaryGrid}>
        <Summary label="Estimated" value={money(summary?.totalEstimated ?? 0, summary?.currency)} tone="gold" />
        <Summary label="Actual" value={money(summary?.totalActual ?? 0, summary?.currency)} tone="clay" />
        <Summary label="Paid" value={money(summary?.totalPaid ?? 0, summary?.currency)} tone="sage" />
        <Summary label="Outstanding" value={money(summary?.totalOutstanding ?? 0, summary?.currency)} tone="plum" />
      </View>

      <Surface>
        <Text style={styles.sectionTitle}>Add budget item</Text>
        <Field label="What is this for?" value={description} onChangeText={setDescription} placeholder="Reception venue balance" />
        <View style={styles.amountRow}>
          <View style={styles.flexOne}><Field label="Estimate" value={estimated} onChangeText={setEstimated} keyboardType="decimal-pad" placeholder="0" /></View>
          <View style={styles.currency}><Field label="Currency" value={currency} onChangeText={(value) => setCurrency(value.toUpperCase().slice(0, 6))} autoCapitalize="characters" placeholder="USD" /></View>
        </View>
        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>{categories.map((value) => <Chip key={value} label={pretty(value)} active={category === value} onPress={() => setCategory(value)} />)}</View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <ActionButton label="Add to budget" loading={createItem.isPending} onPress={async () => {
          if (!description.trim()) { setError('Describe the budget item first.'); return }
          createItem.mutate()
        }} />
      </Surface>

      <Surface>
        <View style={styles.titleRow}>
          <View style={styles.flexOne}><Text style={styles.sectionTitle}>Budget lines</Text><Body muted>{budget.data?.data.length ?? 0} items in this wedding</Body></View>
          <ActionButton label="Contributions" variant="quiet" onPress={() => router.push('/plan/contributions')} />
        </View>
        {budget.isLoading ? <Body muted>Loading budget…</Body> : null}
        {(budget.data?.data ?? []).map((item) => (
          <View key={item.id} style={styles.item}>
            <View style={styles.titleRow}>
              <View style={styles.flexOne}>
                <Text style={styles.itemTitle}>{item.description}</Text>
                <Text style={styles.meta}>{pretty(item.category)}{item.vendorName ? ` · ${item.vendorName}` : ''}</Text>
              </View>
              <Pill tone="gold">{item.currency}</Pill>
            </View>
            <View style={styles.moneyLine}>
              <Text style={styles.strong}>{money(item.actualCost ?? item.estimatedCost, item.currency)}</Text>
              <Text style={styles.meta}>{money(item.paidAmount, item.currency)} paid</Text>
            </View>
            {item.funding ? (
              <View style={styles.fundingBox}>
                <Text style={styles.fundingTitle}>Funding source</Text>
                <Funding label="Couple" value={item.funding.coupleFunded} currency={item.currency} />
                <Funding label="Contributors" value={item.funding.contributorFunded} currency={item.currency} />
                {item.funding.inKindValue > 0 ? <Funding label="In kind" value={item.funding.inKindValue} currency={item.currency} /> : null}
                {item.funding.legacyUnattributed > 0 ? <Funding label="Source not recorded" value={item.funding.legacyUnattributed} currency={item.currency} warning /> : null}
              </View>
            ) : null}
            <Divider />
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" onPress={() => router.push('/plan/contributions')} style={styles.textButton}><Text style={styles.actionText}>Record funding</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => Alert.alert('Delete budget item?', item.description, [
                { text: 'Keep', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteItem.mutate(item.id) },
              ])} style={styles.textButton}><Text style={styles.deleteText}>Delete</Text></Pressable>
            </View>
          </View>
        ))}
      </Surface>
    </Screen>
  )
}

function Summary({ label, value, tone }: { label: string; value: string; tone: 'gold' | 'clay' | 'plum' | 'sage' }) {
  const accent = tone === 'clay' ? colors.clay : tone === 'plum' ? colors.plum : tone === 'sage' ? colors.sage : colors.gold
  return <View style={styles.summary}><View style={[styles.summaryLine, { backgroundColor: accent }]} /><Text numberOfLines={1} adjustsFontSizeToFit style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>
}
function Funding({ label, value, currency, warning }: { label: string; value: number; currency: string; warning?: boolean }) {
  return <View style={styles.fundingRow}><Text style={[styles.meta, warning && { color: colors.clay }]}>{label}</Text><Text style={[styles.meta, styles.strong, warning && { color: colors.clay }]}>{money(value, currency)}</Text></View>
}
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: .6 }]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>
}
function pretty(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }
function money(value: number, currency = 'USD') { try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value) } catch { return `$${Math.round(value).toLocaleString()}` } }

const styles = StyleSheet.create({
  header: { gap: spacing.xs }, summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, summary: { width: '48%', minHeight: 100, backgroundColor: colors.white, borderRadius: radius.lg, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md, overflow: 'hidden' }, summaryLine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 }, summaryValue: { color: colors.espresso, fontFamily: 'serif', fontSize: 23, fontWeight: '600' }, summaryLabel: { color: colors.inkMuted, fontSize: 12, fontWeight: '700', marginTop: 5 }, sectionTitle: { color: colors.espresso, fontFamily: 'serif', fontSize: 22, fontWeight: '600' }, amountRow: { flexDirection: 'row', gap: spacing.sm }, currency: { width: 104 }, label: { color: colors.espresso, fontSize: 13, fontWeight: '700' }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, chip: { minHeight: minimumTouchTarget, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border }, chipActive: { backgroundColor: colors.espresso, borderColor: colors.espresso }, chipText: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' }, chipTextActive: { color: colors.goldLight }, titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, item: { gap: spacing.sm, paddingTop: spacing.md, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }, itemTitle: { color: colors.espresso, fontSize: 16, fontWeight: '700' }, meta: { color: colors.inkMuted, fontSize: 12, lineHeight: 17 }, moneyLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, strong: { color: colors.espresso, fontWeight: '700' }, fundingBox: { backgroundColor: colors.ivory, padding: spacing.sm, borderRadius: radius.md, gap: 5 }, fundingTitle: { color: colors.espresso, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }, fundingRow: { flexDirection: 'row', justifyContent: 'space-between' }, actions: { flexDirection: 'row', justifyContent: 'space-between' }, textButton: { minHeight: minimumTouchTarget, justifyContent: 'center', paddingHorizontal: spacing.xs }, actionText: { color: colors.goldMuted, fontWeight: '800', fontSize: 13 }, deleteText: { color: colors.danger, fontWeight: '800', fontSize: 13 }, error: { color: colors.danger, fontSize: 13 }, flexOne: { flex: 1 },
})
