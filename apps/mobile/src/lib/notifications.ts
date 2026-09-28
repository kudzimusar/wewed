import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import { wewedRequest } from '@/lib/api'

const PUSH_TOKEN_STORAGE_KEY = 'wewed.native.expo-push-token.v1'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

function projectId() {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
  return extra?.eas?.projectId || Constants.easConfig?.projectId || null
}

export async function registerNativePushAsync(sessionToken: string) {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') throw new Error('Push notifications require Android or iOS.')

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('wewed-important', {
      name: 'Wedding updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      showBadge: true,
    })
  }

  const existing = await Notifications.getPermissionsAsync()
  let status = existing.status
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status
  if (status !== 'granted') throw new Error('Notification permission was not granted on this device.')

  const expoProjectId = projectId()
  if (!expoProjectId) throw new Error('Native push is ready in code, but the authorized Expo/EAS project ID has not been configured for this build.')

  const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId: expoProjectId })).data
  await wewedRequest('/api/mobile/push', {
    token: sessionToken,
    method: 'POST',
    body: JSON.stringify({
      expoPushToken,
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version ?? null,
      buildVersion: Constants.nativeBuildVersion ?? null,
    }),
  })
  await SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, expoPushToken)
  return expoPushToken
}

export async function disableNativePushAsync(sessionToken: string) {
  const expoPushToken = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY)
  if (!expoPushToken) return false
  await wewedRequest('/api/mobile/push', {
    token: sessionToken,
    method: 'DELETE',
    body: JSON.stringify({ expoPushToken }),
  })
  await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY)
  return true
}

export async function storedNativePushToken() {
  return SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY)
}

export function notificationUrl(response: Notifications.NotificationResponse | null | undefined) {
  const data = response?.notification.request.content.data
  if (!data || typeof data !== 'object') return null
  for (const key of ['url', 'href', 'deepLink']) {
    const value = data[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  const conversationId = data.conversationId
  if (typeof conversationId === 'string' && conversationId) return `https://wewed.pro/messages/${conversationId}`
  const bookingId = data.bookingId
  if (typeof bookingId === 'string' && bookingId) return `https://wewed.pro/bookings/${bookingId}`
  return null
}

export function addNotificationResponseListener(onUrl: (url: string) => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const url = notificationUrl(response)
    if (url) onUrl(url)
  })
}
