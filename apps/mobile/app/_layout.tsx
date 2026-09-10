import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Notifications from 'expo-notifications'
import { router, Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import React, { useEffect, useRef, useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { SessionProvider } from '@/auth/session'
import { handoffPath } from '@/lib/deep-links'
import { bootstrapDeferredInvitationFromInstallReferrer } from '@/lib/install-referrer-bootstrap'
import { notificationUrl } from '@/lib/notifications'
import { colors } from '@/theme/tokens'

function DeferredInvitationBootstrap() {
  useEffect(() => {
    void bootstrapDeferredInvitationFromInstallReferrer()
  }, [])

  return null
}

function NotificationRouter() {
  const lastResponse = Notifications.useLastNotificationResponse()
  const lastIdentifier = useRef<string | null>(null)

  useEffect(() => {
    if (!lastResponse) return
    const identifier = lastResponse.notification.request.identifier
    if (identifier && identifier === lastIdentifier.current) return
    const url = notificationUrl(lastResponse)
    if (!url) return
    lastIdentifier.current = identifier || url
    router.push(handoffPath(url) as never)
  }, [lastResponse])

  return null
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 20_000,
        gcTime: 10 * 60_000,
        refetchOnReconnect: true,
      },
      mutations: { retry: 0 },
    },
  }))

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.champagne }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <DeferredInvitationBootstrap />
            <NotificationRouter />
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.champagne },
                headerTintColor: colors.espresso,
                headerShadowVisible: false,
                contentStyle: { backgroundColor: colors.champagne },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="handoff" options={{ title: 'Open in Wewed', presentation: 'modal' }} />
            </Stack>
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
