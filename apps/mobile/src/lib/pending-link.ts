import * as SecureStore from 'expo-secure-store'

const PENDING_LINK_KEY = 'wewed.native.pending-link.v1'

export async function storePendingLink(url: string) {
  await SecureStore.setItemAsync(PENDING_LINK_KEY, url, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  })
}

export async function readPendingLink() {
  return SecureStore.getItemAsync(PENDING_LINK_KEY)
}

export async function clearPendingLink() {
  await SecureStore.deleteItemAsync(PENDING_LINK_KEY)
}

export async function takePendingLink() {
  const value = await readPendingLink()
  if (value) await clearPendingLink()
  return value
}
