import { router } from 'expo-router'
import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { ActionButton, Body, Eyebrow, Field, Screen, Surface, Title } from '@/components/core'
import { WewedApiError } from '@/lib/api'
import { handoffPath, resolveWewedLink } from '@/lib/deep-links'
import { takePendingLink } from '@/lib/pending-link'
import { colors, spacing } from '@/theme/tokens'

export default function SignInScreen() {
  const { signIn, loading } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !password) {
      setError('Enter your Wewed email and password.')
      return
    }
    setError(null)
    try {
      await signIn(normalizedEmail, password)
      const pending = await takePendingLink().catch(() => null)
      if (pending) {
        const resolved = resolveWewedLink(pending)
        if (resolved.nativePath) {
          router.replace(resolved.nativePath as never)
          return
        }
        router.replace(handoffPath(pending) as never)
        return
      }
      router.replace('/(tabs)')
    } catch (cause) {
      setError(cause instanceof WewedApiError ? cause.message : 'Wewed could not sign you in. Please try again.')
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={styles.hero}>
          <Text accessibilityRole="header" style={styles.wordmark}>WEWED</Text>
          <Eyebrow>Zimbabwe-first wedding platform</Eyebrow>
          <Title>Your wedding world, in your hand.</Title>
          <Body muted>Plan, book, communicate and keep the people around your wedding aligned from one secure place.</Body>
        </View>

        <Surface>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <ActionButton label="Sign in to Wewed" onPress={submit} loading={loading} />
        </Surface>

        <View style={styles.footnote}>
          <Body muted>Your account, wedding permissions and vendor access are the same ones you use on wewed.pro. Links opened before sign-in are resumed after authentication.</Body>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.champagne },
  hero: { gap: spacing.sm, paddingTop: spacing.xl, paddingBottom: spacing.sm },
  wordmark: { color: colors.espresso, fontFamily: 'serif', fontSize: 21, letterSpacing: 7, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  footnote: { paddingHorizontal: spacing.xs },
})
