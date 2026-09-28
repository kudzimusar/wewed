import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Application from 'expo-application'
import * as WebBrowser from 'expo-web-browser'
import { Linking, Platform } from 'react-native'
import {
  buildInvitationResumeUrl,
  hasExplicitWewedLaunchIntent,
  MAX_INSTALL_REFERRER_ATTEMPTS,
  parseInstallReferrerState,
  parseInvitationHandoffReferrer,
  serializeInstallReferrerState,
  type InstallReferrerState,
} from './install-referrer'

const INSTALL_REFERRER_STATE_KEY = 'wewed.native.install-referrer.v1'
let bootstrapPromise: Promise<void> | null = null

async function readState(): Promise<InstallReferrerState> {
  try {
    return parseInstallReferrerState(await AsyncStorage.getItem(INSTALL_REFERRER_STATE_KEY))
  } catch {
    return { processed: false, attempts: 0 }
  }
}

async function writeState(state: InstallReferrerState): Promise<void> {
  try {
    await AsyncStorage.setItem(INSTALL_REFERRER_STATE_KEY, serializeInstallReferrerState(state))
  } catch {
    // State persistence is best-effort. Never block ordinary Wewed launch.
  }
}

async function runInstallReferrerBootstrap(): Promise<void> {
  if (Platform.OS !== 'android') return

  const state = await readState()
  if (state.processed) return

  let initialUrl: string | null = null
  try {
    initialUrl = await Linking.getInitialURL()
  } catch {
    // Absence of launch-intent evidence is not a reason to block app startup.
  }

  // A fresh App Link/custom-scheme launch is newer user intent than an install
  // referrer. Consume the historical bootstrap marker so it cannot surprise the
  // user on a later ordinary launch.
  if (hasExplicitWewedLaunchIntent(initialUrl)) {
    await writeState({ processed: true, attempts: state.attempts })
    return
  }

  if (state.attempts >= MAX_INSTALL_REFERRER_ATTEMPTS) {
    await writeState({ processed: true, attempts: state.attempts })
    return
  }

  const attemptedState: InstallReferrerState = {
    processed: false,
    attempts: state.attempts + 1,
  }
  await writeState(attemptedState)

  let referrer: string
  try {
    referrer = await Application.getInstallReferrerAsync()
  } catch {
    // Play Store/service availability can be transient. The attempt counter lets
    // a later launch retry without holding this launch hostage.
    return
  }

  const handoff = parseInvitationHandoffReferrer(referrer)
  if (!handoff) {
    await writeState({ processed: true, attempts: attemptedState.attempts })
    return
  }

  // Mark before browser handoff so process interruption or React remounting cannot
  // create a repeated invitation-resume loop. The server independently enforces
  // one-time redemption and current RSVP authority.
  await writeState({ processed: true, attempts: attemptedState.attempts })

  try {
    // Do not use Linking.openURL here. /invite is an Android App Link claimed by
    // Wewed itself and could route straight back into the native app. A Custom Tab
    // is the intentional secure-web boundary that lets the canonical server issue
    // the existing HttpOnly guest session without creating a second auth model.
    await WebBrowser.openBrowserAsync(buildInvitationResumeUrl(handoff))
  } catch {
    // Browser launch failure must never prevent normal native app use. The opaque
    // secret is intentionally not persisted or logged by the mobile client.
  }
}

export function bootstrapDeferredInvitationFromInstallReferrer(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = runInstallReferrerBootstrap()
  }
  return bootstrapPromise
}
