import type { ExpoConfig, ConfigContext } from 'expo/config'

const androidVersionCode = Number.parseInt(process.env.WEWED_ANDROID_VERSION_CODE ?? '3', 10)

const appLinkPaths = [
  '/app',
  '/invite',
  '/vendor',
  '/vendors',
  '/booking',
  '/bookings',
  '/planner',
  '/messages',
  '/wedding',
  '/contribute',
  '/contracts',
] as const

const androidAppLinkData = appLinkPaths.flatMap((pathPrefix) => [
  { scheme: 'http', host: 'wewed.pro', pathPrefix },
  { scheme: 'https', host: 'wewed.pro', pathPrefix },
])

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Wewed',
  slug: 'wewed',
  owner: process.env.EXPO_OWNER,
  version: process.env.WEWED_APP_VERSION ?? '2.0.0',
  scheme: 'wewed',
  userInterfaceStyle: 'automatic',
  icon: '../../android/store_icon.png',
  assetBundlePatterns: ['**/*'],
  android: {
    package: 'pro.wewed.app',
    versionCode: Number.isFinite(androidVersionCode) ? androidVersionCode : 3,
    adaptiveIcon: {
      foregroundImage: '../../android/store_icon.png',
      backgroundColor: '#1A1410',
    },
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        category: ['BROWSABLE', 'DEFAULT'],
        data: androidAppLinkData,
      },
    ],
  },
  ios: {
    bundleIdentifier: 'pro.wewed.app',
    associatedDomains: ['applinks:wewed.pro'],
    supportsTablet: true,
    config: { usesNonExemptEncryption: false },
  },
  plugins: [
    'expo-router',
    ['expo-secure-store', { configureAndroidBackup: true }],
    ['expo-image-picker', {
      photosPermission: 'Allow Wewed to choose wedding photos and documents you want to share.',
      cameraPermission: 'Allow Wewed to take photos for wedding planning and vendor workflows.',
    }],
    'expo-notifications',
    './plugins/with-wewed-android-signing',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_WEWED_API_BASE_URL ?? 'https://wewed.pro',
    buildStamp: 'WW-NATIVE-MOBILE-2026-09-10-01',
    eas: {
      projectId: process.env.EXPO_PROJECT_ID ?? '',
    },
  },
})
