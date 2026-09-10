import Constants from 'expo-constants'
import { router } from 'expo-router'
import React, { useState } from 'react'
import { Linking, StyleSheet, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { ActionButton, Body, Divider, Eyebrow, Pill, Screen, Surface, Title } from '@/components/core'
import { colors, spacing } from '@/theme/tokens'
import type { DashboardRole, WeddingSummary } from '@/lib/types'

const ROLE_LABELS: Record<DashboardRole, string> = {
  admin: 'Wewed administrator',
  couple: 'Couple',
  planner: 'Wedding planner',
  vendor: 'Vendor',
}

function workspaceUrl(role: DashboardRole) {
  if (role === 'admin') return 'https://wewed.pro/admin'
  if (role === 'vendor') return 'https://wewed.pro/vendor'
  return 'https://wewed.pro/app'
}

export default function MoreScreen() {
  const { session, loading, signOut, switchWedding } = useSession()
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <Screen><Body muted>Loading your Wewed account…</Body></Screen>
  if (!session) return <Screen><Title>Sign in required</Title><ActionButton label="Go to sign in" onPress={() => router.replace('/(auth)/sign-in')} /></Screen>

  const role = session.user.role
  const version = Constants.expoConfig?.version ?? '2.0.0'
  const nativeBuild = Constants.nativeBuildVersion ?? 'development'

  async function activateWedding(wedding: WeddingSummary) {
    if (wedding.id === session?.activeWedding?.id) return
    setSwitchingId(wedding.id)
    setError(null)
    try {
      await switchWedding(wedding.id)
      router.replace('/(tabs)')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not switch wedding workspace.')
    } finally {
      setSwitchingId(null)
    }
  }

  return (
    <Screen>
      <View style={styles.heading}>
        <Eyebrow>Account & workspace</Eyebrow>
        <Title>More</Title>
        <Body muted>Control your Wewed identity, wedding context and role-specific tools without leaving the native app unless a secure web-only workflow requires it.</Body>
      </View>

      <Surface>
        <View style={styles.row}>
          <View style={styles.flexOne}>
            <Text style={styles.name}>{session.user.displayName?.trim() || session.user.email}</Text>
            <Text style={styles.email}>{session.user.email}</Text>
          </View>
          <Pill tone={role === 'admin' ? 'plum' : role === 'vendor' ? 'clay' : role === 'planner' ? 'sage' : 'gold'}>{ROLE_LABELS[role]}</Pill>
        </View>
        <Divider />
        <Fact label="Workspace" value={session.workspace.replaceAll('_', ' ')} />
        <Fact label="Active wedding" value={session.activeWedding?.title || 'Portfolio / platform workspace'} />
        {session.activeWedding?.date ? <Fact label="Wedding date" value={new Date(session.activeWedding.date).toLocaleDateString()} /> : null}
      </Surface>

      {session.weddings.length > 0 ? (
        <Surface>
          <Text style={styles.sectionTitle}>Wedding workspaces</Text>
          <Body muted>Switching rotates your authenticated wedding context and clears wedding-scoped cached data before the next workspace loads.</Body>
          {session.weddings.map((wedding) => {
            const active = wedding.id === session.activeWedding?.id
            return (
              <View key={wedding.id} style={styles.weddingRow}>
                <View style={styles.flexOne}>
                  <View style={styles.inline}>
                    <Text style={styles.weddingName}>{wedding.title}</Text>
                    {active ? <Pill tone="sage">Active</Pill> : null}
                  </View>
                  <Text style={styles.meta}>{[wedding.venueCity, wedding.venueCountry].filter(Boolean).join(', ') || 'Location not set'} · {wedding.membershipRole.replaceAll('_', ' ')}</Text>
                </View>
                {!active ? <ActionButton label="Open" variant="secondary" loading={switchingId === wedding.id} disabled={Boolean(switchingId)} onPress={() => activateWedding(wedding)} /> : null}
              </View>
            )
          })}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        </Surface>
      ) : null}

      <Surface>
        <Text style={styles.sectionTitle}>Wewed tools</Text>
        <ActionButton label="Wedding Pulse" variant="secondary" onPress={() => router.push('/(tabs)')} />
        <ActionButton label="Planning workspace" variant="secondary" onPress={() => router.push('/(tabs)/plan')} />
        <ActionButton label="Wewed Messages" variant="secondary" onPress={() => router.push('/(tabs)/messages')} />
        <ActionButton label="Vendor marketplace" variant="secondary" onPress={() => router.push('/(tabs)/marketplace')} />
        {session.activeWedding && role !== 'vendor' ? <ActionButton label="Governed bookings" variant="secondary" onPress={() => router.push('/bookings')} /> : null}
        {session.activeWedding && role !== 'vendor' ? <ActionButton label="Wewed AI Planner Copilot" variant="secondary" onPress={() => router.push('/ai')} /> : null}
        {(role === 'admin' || role === 'vendor') ? (
          <ActionButton
            label={role === 'admin' ? 'Open full Admin Command Centre' : 'Open full Vendor workspace'}
            variant="quiet"
            accessibilityHint="Opens the secure Wewed web workspace for dense role-specific administration."
            onPress={async () => { await Linking.openURL(workspaceUrl(role)) }}
          />
        ) : null}
      </Surface>

      <Surface>
        <Text style={styles.sectionTitle}>Help, privacy & account</Text>
        <ActionButton label="Wewed Help & Support" variant="quiet" onPress={async () => { await Linking.openURL('https://wewed.pro/contact') }} />
        <ActionButton label="Privacy policy" variant="quiet" onPress={async () => { await Linking.openURL('https://wewed.pro/privacy') }} />
        <ActionButton label="Terms of service" variant="quiet" onPress={async () => { await Linking.openURL('https://wewed.pro/terms') }} />
        <ActionButton label="Account deletion & data controls" variant="quiet" onPress={async () => { await Linking.openURL('https://wewed.pro/account-deletion') }} />
        <Divider />
        <ActionButton label="Sign out securely" variant="danger" onPress={async () => { await signOut(); router.replace('/(auth)/sign-in') }} />
      </Surface>

      <View style={styles.build} accessibilityLabel={`Wewed version ${version}, build ${nativeBuild}`}>
        <Text style={styles.buildText}>Wewed native · v{version} · build {nativeBuild}</Text>
        <Text style={styles.buildStamp}>WW-NATIVE-MOBILE-2026-09-10-01 · Zimbabwe first</Text>
      </View>
    </Screen>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  inline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  flexOne: { flex: 1 },
  name: { color: colors.espresso, fontSize: 20, fontWeight: '800' },
  email: { color: colors.inkMuted, fontSize: 13, marginTop: 3 },
  sectionTitle: { color: colors.espresso, fontFamily: 'serif', fontSize: 22, fontWeight: '600' },
  fact: { gap: 2 },
  factLabel: { color: colors.goldMuted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  factValue: { color: colors.espresso, fontSize: 14, lineHeight: 20, textTransform: 'capitalize' },
  weddingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  weddingName: { color: colors.espresso, fontSize: 15, fontWeight: '800' },
  meta: { color: colors.inkMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  build: { alignItems: 'center', gap: 3, paddingVertical: spacing.sm },
  buildText: { color: colors.inkMuted, fontSize: 11 },
  buildStamp: { color: colors.goldMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
})
