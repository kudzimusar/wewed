import type { ExpoConfig, ConfigContext } from 'expo/config'

const androidVersionCode = Number.parseInt(process.env.WEWED_ANDROID_VERSION_CODE ?? '2', 10)

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
    versionCode: Number.isFinite(androidVersionCode) ? androidVersionCode : 2,
    adaptiveIcon: {
      foregroundImage: '../../android/store_icon.png',
      backgroundColor: '#1A1410',
    },
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        category: ['BROWSABLE', 'DEFAULT'],
        data: [
          { scheme: 'https', host: 'wewed.pro', pathPrefix: '/app' },
          { scheme: 'https', host: 'wewed.pro', pathPrefix: '/invite' },
          { scheme: 'https', host: 'wewed.pro', pathPrefix: '/vendor' },
          { scheme: 'https', host: 'wewed.pro', pathPrefix: '/vendors' },
          { scheme: 'https', host: 'wewed.pro', pathPrefix: '/booking' },
          { scheme: 'https', host: 'wewed.pro', pathPrefix: '/bookings' },
          { scheme: 'https', host: 'wewed.pro', pathPrefix: '/planner' },
          { scheme: 'https', host: 'wewed.pro', pathPrefix: '/messages' },
          { scheme: 'https', host: 'wewed.pro', pathPrefix: '/wedding' },
          { scheme: 'https', host: 'wewed.pro', pathPrefix: '/contribute' },
          { scheme: 'https', host: 'wewed.pro', pathPrefix: '/contracts' },
        ],
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
