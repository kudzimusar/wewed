export const WEWED_IOS_BUNDLE_ID = 'pro.wewed.app'

const APPLICATION_IDENTIFIER_PREFIX = /^[A-Z0-9]{10}$/

const UNIVERSAL_LINK_COMPONENTS = [
  '/app*',
  '/invite/*',
  '/i/*',
  '/w/*',
  '/planner/*',
  '/messages/*',
  '/vendor/*',
  '/vendors/*',
  '/booking/*',
  '/bookings/*',
  '/wedding/*',
  '/contribute/*',
  '/contracts/*',
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
