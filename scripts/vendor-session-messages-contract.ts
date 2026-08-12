import { readFileSync } from 'node:fs'

function read(path: string) {
  return readFileSync(path, 'utf8')
}

function requireText(source: string, needle: string, message: string) {
  if (!source.includes(needle)) throw new Error(message)
}

function requireOrder(source: string, first: string, second: string, message: string) {
  const firstIndex = source.indexOf(first)
  const secondIndex = source.indexOf(second)
  if (firstIndex < 0 || secondIndex < 0 || firstIndex >= secondIndex) throw new Error(message)
}

const authMe = read('src/app/api/auth/me/route.ts')
const authSignin = read('src/app/api/auth/signin/route.ts')
const browserAuth = read('src/lib/admin-auth.ts')
const messagesPage = read('src/app/messages/page.tsx')
const vendorWorkspace = read('src/app/vendor/page.tsx')
const vendorMarketplace = read('src/app/vendors/page.tsx')

requireText(
  authSignin,
  "if (accessUser.role === 'vendor')",
  'Vendor sign-in must retain a dedicated approved Vendor portfolio path.',
)
requireText(
  authSignin,
  'activeWeddingId: VENDOR_PORTFOLIO_SESSION_ID',
  'Vendor sign-in must issue the Vendor portfolio session sentinel.',
)
requireText(
  authMe,
  "if (dashboardRole === 'vendor')",
  'Session refresh must handle Vendor accounts before wedding membership resolution.',
)
requireText(
  authMe,
  'const vendor = await activeVendorIdentity(accessUser.id)',
  'Vendor session refresh must revalidate the approved owner-managed Vendor identity.',
)
requireText(
  authMe,
  "workspace: 'vendor_portfolio'",
  'Vendor session refresh must return the Vendor portfolio workspace.',
)
requireText(
  authMe,
  'activeWeddingId: VENDOR_PORTFOLIO_SESSION_ID',
  'Vendor session refresh must preserve the Vendor portfolio sentinel.',
)
requireOrder(
  authMe,
  "if (dashboardRole === 'vendor')",
  'await acceptPendingMemberships(accessUser.id)',
  'Vendor session refresh must not fall through wedding-scoped membership resolution.',
)
requireText(
  browserAuth,
  "export type DashboardRole = 'admin' | 'couple' | 'planner' | 'vendor'",
  'Browser dashboard auth must recognize Vendor as a first-class role.',
)
requireText(
  messagesPage,
  "type DashboardRole = 'admin' | 'couple' | 'planner' | 'vendor'",
  'Messages must recognize Vendor as a first-class participant role.',
)
requireText(
  messagesPage,
  "if (role === 'vendor') return '/vendor'",
  'Messages back navigation must return Vendors to the Vendor workspace.',
)
requireOrder(
  messagesPage,
  'await loadMe()',
  'await Promise.all([loadContacts(), loadConversations()])',
  'Messages must verify authentication before loading private inbox/contact data.',
)
requireText(
  messagesPage,
  'setConversations([])',
  'Messages must clear partial conversation state when initial authentication fails.',
)
requireText(
  vendorWorkspace,
  'Open Messages',
  'Vendor workspace must expose a prominent Messages action.',
)
requireText(
  vendorWorkspace,
  'href="/messages"',
  'Vendor workspace Messages action must route to the canonical inbox.',
)
requireText(
  vendorMarketplace,
  'Vendor sign in · Inbox',
  'Public Vendor marketplace must expose a discoverable Vendor sign-in/inbox entry point.',
)
requireText(
  vendorMarketplace,
  'href="/vendor"',
  'Vendor marketplace sign-in CTA must route to the Vendor workspace auth gate.',
)

console.log('Vendor session + Messages access contract: PASS')
