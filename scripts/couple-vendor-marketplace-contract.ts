import { readFileSync } from 'node:fs'

function read(path: string) {
  return readFileSync(path, 'utf8')
}

function requireText(source: string, needle: string, message: string) {
  if (!source.includes(needle)) throw new Error(message)
}

function forbidText(source: string, needle: string, message: string) {
  if (source.includes(needle)) throw new Error(message)
}

const publicAccount = read('src/components/public/public-account-actions.tsx')
const providerProfile = read('src/components/providers/public-provider-profile.tsx')
const providerEnquiries = read('src/app/api/providers/enquiries/route.ts')
const vendorCommunications = read('src/lib/vendor-marketplace-communications.ts')
const messages = read('src/app/messages/page.tsx')

requireText(
  publicAccount,
  "export type AccountRole = 'admin' | 'couple' | 'planner' | 'vendor' | 'provider'",
  'Public marketplace auth must recognize the governed Vendor role.',
)
requireText(
  publicAccount,
  "if (role === 'vendor') return { href: '/vendor', label: 'Vendor workspace' }",
  'Vendor public navigation must return to the Vendor workspace.',
)
requireText(
  publicAccount,
  'export function usePublicAccountSession()',
  'Public marketplace surfaces must share one revalidating session hook.',
)
requireText(
  providerProfile,
  'const accountSession = usePublicAccountSession()',
  'Provider enquiry UI must consume the same session source as the public header.',
)
requireText(
  providerProfile,
  "accountSession.activeWedding?.membershipRole === 'owner'",
  'Provider enquiry UI must distinguish an active Couple owner from another signed-in role.',
)
requireText(
  providerProfile,
  'This enquiry opens or reuses a private Wewed Vendor conversation.',
  'Signed-in Couple owners must receive a coherent marketplace-to-Messages explanation.',
)
requireText(
  providerProfile,
  'Open conversation in Messages',
  'Successful Provider enquiries must expose the canonical Wewed conversation.',
)
forbidText(
  providerProfile,
  'A signed-in couple-owner account is required.',
  'Provider profiles must not show the old unconditional sign-in warning.',
)
requireText(
  vendorCommunications,
  "actor.role !== 'planner' && actor.role !== 'admin' && actor.role !== 'couple'",
  'Approved Vendor discovery must include governed Couple owners.',
)
requireText(
  vendorCommunications,
  "const conversationWeddingId = actor.role === 'couple' ? actor.activeWeddingId : null",
  'Couple Vendor conversations must retain the active wedding context.',
)
requireText(
  vendorCommunications,
  "const conversationType = actor.role === 'admin' ? 'SUPPORT' : 'MARKETPLACE'",
  'Admin Vendor support and Couple/Planner marketplace conversations must remain distinct.',
)
forbidText(
  vendorCommunications,
  'Marketplace vendor conversations must be started by a planner.',
  'The old Planner-only Vendor initiation guard must not return.',
)
requireText(
  providerEnquiries,
  'const [couple, actor] = await Promise.all([',
  'Structured Provider enquiries must verify Couple marketplace and Communications identities together.',
)
requireText(
  providerEnquiries,
  'maybeCreateVendorMarketplaceConversation(actor',
  'Structured Provider enquiries must establish or reuse the canonical Vendor conversation.',
)
requireText(
  providerEnquiries,
  'await sendCommunicationMessage(actor, conversation.id',
  'Structured Provider enquiries must create a participant-visible Wewed message.',
)
requireText(
  providerEnquiries,
  'conversationId: conversation.id',
  'Provider enquiry responses must return the canonical conversation id.',
)
requireText(
  messages,
  "type DashboardRole = 'admin' | 'couple' | 'planner' | 'vendor'",
  'Messages must continue to recognize Vendor sessions.',
)
requireText(
  messages,
  "{newMessageOpen ? 'Close' : 'New message'}",
  'The inbox must retain an obvious new-conversation CTA.',
)

console.log('Couple Vendor marketplace communications contract: PASS')
