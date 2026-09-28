import { router, Stack, useLocalSearchParams } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
import { Linking, StyleSheet, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { ActionButton, Body, Eyebrow, Screen, Surface, Title } from '@/components/core'
import { resolveWewedLink } from '@/lib/deep-links'
import { clearPendingLink, storePendingLink } from '@/lib/pending-link'
import { colors, spacing } from '@/theme/tokens'

export default function HandoffScreen() {
  const params = useLocalSearchParams<{ url?: string }>()
  const { session, loading } = useSession()
  const [error, setError] = useState<string | null>(null)
  const rawUrl = typeof params.url === 'string' && params.url ? params.url : 'https://wewed.pro/app'
  const resolved = useMemo(() => resolveWewedLink(rawUrl), [rawUrl])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        if (resolved.requiresAuthentication && !session) {
          await storePendingLink(resolved.canonicalUrl)
          return
        }
        if (resolved.nativePath && (session || !resolved.requiresAuthentication)) {
          await clearPendingLink().catch(() => undefined)
          if (alive) router.replace(resolved.nativePath as never)
        }
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : 'Could not continue this Wewed link.')
      }
    })()
    return () => { alive = false }
  }, [resolved, session])

  if (loading) return <Screen><Body muted>Restoring your Wewed destination…</Body></Screen>

  if (resolved.requiresAuthentication && !session) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Continue in Wewed' }} />
        <View style={styles.heading}><Eyebrow>Secure continuation</Eyebrow><Title>Sign in, then continue.</Title><Body muted>Wewed has saved the destination from this link securely on this device. After sign-in, the native app will resume at the intended wedding workspace.</Body></View>
        <Surface>
          <Text style={styles.url} numberOfLines={3}>{resolved.canonicalUrl}</Text>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <ActionButton label="Sign in to continue" onPress={() => router.replace('/(auth)/sign-in')} />
          <ActionButton label="Cancel" variant="quiet" onPress={async () => { await clearPendingLink(); router.replace('/') }} />
        </Surface>
      </Screen>
    )
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: resolved.secureWebOnly ? 'Secure Wewed page' : 'Open in Wewed' }} />
      <View style={styles.heading}>
        <Eyebrow>{resolved.secureWebOnly ? 'Canonical secure workflow' : 'Wewed link'}</Eyebrow>
        <Title>{resolved.secureWebOnly ? 'Continue on the secure Wewed page.' : 'Continue with Wewed.'}</Title>
        <Body muted>{resolved.secureWebOnly ? 'This workflow stays on its canonical web surface until the native client reproduces every token, version and authority safeguard. The app will not weaken that security for convenience.' : 'This link does not yet map to a dedicated native destination, so Wewed will open the canonical page.'}</Body>
      </View>
      <Surface>
        <Text selectable style={styles.url}>{resolved.canonicalUrl}</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <ActionButton label="Open secure Wewed page" onPress={async () => { await Linking.openURL(resolved.canonicalUrl) }} />
        <ActionButton label="Back to Wewed" variant="quiet" onPress={() => router.replace('/(tabs)')} />
      </Surface>
    </Screen>
  )
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xs },
  url: { color: colors.inkMuted, fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
})
