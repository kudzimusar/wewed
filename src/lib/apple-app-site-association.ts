export const WEWED_IOS_BUNDLE_ID = 'pro.wewed.app'

const APPLICATION_IDENTIFIER_PREFIX = /^[A-Z0-9]{10}$/

// Only paths that native can resolve without bypassing a server-side browser ceremony belong here.
// In particular /i/* is intentionally excluded: that physical-invitation QR endpoint resolves
// QRDestination, sets shared invitation cookies, and redirects on the server.
const UNIVERSAL_LINK_COMPONENTS = [
  '/invite/*',
  '/w/*',
  '/pass',
  '/pass/*',
  '/planner/*',
  '/vendor/*',
  '/gate/*',
  '/wedding/*',
] as const

export function normalizeAppleApplicationIdentifierPrefix(
  value: string | undefined,
): string | null {
  const normalized = value?.trim().toUpperCase() ?? ''
  return APPLICATION_IDENTIFIER_PREFIX.test(normalized) ? normalized : null
}

export function buildAppleAppSiteAssociation(applicationIdentifierPrefix: string) {
  const normalized = normalizeAppleApplicationIdentifierPrefix(applicationIdentifierPrefix)
  if (!normalized) {
    throw new Error('Invalid Apple Application Identifier Prefix.')
  }

  const appIdentifier = `${normalized}.${WEWED_IOS_BUNDLE_ID}`
  return {
    applinks: {
      details: [
        {
          appIDs: [appIdentifier],
          components: UNIVERSAL_LINK_COMPONENTS.map((path) => ({
            '/': path,
            comment: `Open Wewed native navigation for ${path}`,
          })),
        },
      ],
    },
  }
}
