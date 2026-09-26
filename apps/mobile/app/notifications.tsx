import { Stack } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { ActionButton, Body, Eyebrow, Pill, Screen, Surface, Title } from '@/components/core'
import { disableNativePushAsync, registerNativePushAsync, storedNativePushToken } from '@/lib/notifications'
import { colors, spacing } from '@/theme/tokens'

export default function NotificationSettingsScreen() {
  const { token } = useSession()
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void storedNativePushToken().then((value) => { if (alive) setEnabled(Boolean(value)) })
    return () => { alive = false }
  }, [])

  async function enable() {
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      await registerNativePushAsync(token)
      setEnabled(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not enable native notifications.')
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      await disableNativePushAsync(token)
      setEnabled(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not disable native notifications.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <View style={styles.heading}>
        <Eyebrow>Native wedding alerts</Eyebrow>
        <Title>Notifications</Title>
        <Body muted>Receive Wewed updates on this device and open the exact Message, booking or wedding destination when you tap an alert.</Body>
      </View>
      <Surface>
        <View style={styles.row}><Text style={styles.sectionTitle}>This device</Text><Pill tone={enabled ? 'sage' : 'clay'}>{enabled ? 'Registered' : 'Not registered'}</Pill></View>
        <Body muted>Wewed asks for OS notification permission only when you enable this device. The registered native token is separate from browser Web Push subscriptions.</Body>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {enabled ? <ActionButton label="Disable notifications on this device" variant="danger" loading={busy} onPress={disable} /> : <ActionButton label="Enable native notifications" loading={busy} onPress={enable} />}
      </Surface>
      <Surface>
        <Text style={styles.sectionTitle}>Privacy & routing</Text>
        <Body muted>Notification payloads should carry only the minimum routing identifier needed by Wewed. Opening an alert still requires the same authenticated wedding permissions as opening that record from inside the app.</Body>
      </Surface>
    </Screen>
  )
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  sectionTitle: { color: colors.espresso, fontFamily: 'serif', fontSize: 22, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
})
