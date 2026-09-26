import { Redirect } from 'expo-router'
import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { colors } from '@/theme/tokens'

export default function Index() {
  const { loading, session } = useSession()

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.wordmark}>WEWED</Text>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    )
  }

  return <Redirect href={session ? '/(tabs)' : '/(auth)/sign-in'} />
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, backgroundColor: colors.espresso },
  wordmark: { color: colors.goldLight, fontFamily: 'serif', fontSize: 30, letterSpacing: 8 },
})
