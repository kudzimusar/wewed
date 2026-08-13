import { readFileSync } from 'node:fs'

const page = readFileSync('src/app/messages/page.tsx', 'utf8')
const layout = readFileSync('src/app/messages/layout.tsx', 'utf8')
const pwaRegister = readFileSync('src/components/wedding/pwa-register.tsx', 'utf8')
const serviceWorker = readFileSync('public/sw.js', 'utf8')

const requiredInboxFragments = [
  'data-communications-inbox="true"',
  'setNewMessageOpen',
  "newMessageOpen ? 'Close' : 'New message'",
  "fetch('/api/communications/contacts'",
  "fetch('/api/communications/conversations'",
  'participantIds: [contact.id]',
  'type: contact.defaultType',
]

for (const fragment of requiredInboxFragments) {
  if (!page.includes(fragment)) {
    throw new Error(`Missing shared Inbox New Message contract fragment: ${fragment}`)
  }
}

if (!layout.includes("export const dynamic = 'force-dynamic'")) {
  throw new Error('Messages route must render dynamically so authenticated inbox sessions do not reuse a prerendered route shell.')
}

const forbiddenLayoutFragments = [
  'MessagesNewMessageLauncher',
  'messages-new-message-launcher',
  'data-communications-new-message-cta',
]

for (const fragment of forbiddenLayoutFragments) {
  if (layout.includes(fragment)) {
    throw new Error(`Messages layout must not mount a special New Message launcher: ${fragment}`)
  }
}

const cacheVersionMatch = serviceWorker.match(/const CACHE_VERSION = 'v(\d+)'/)
if (!cacheVersionMatch || Number(cacheVersionMatch[1]) < 2) {
  throw new Error('Service worker cache version must invalidate the stale v1 application bundle cache.')
}

for (const fragment of [
  'isNextBuildAsset(request)',
  "fetch(request, { cache: 'no-cache' })",
]) {
  if (!serviceWorker.includes(fragment)) {
    throw new Error(`Service worker must revalidate Next.js application assets online: ${fragment}`)
  }
}

for (const fragment of [
  "navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)",
  'window.location.reload()',
]) {
  if (!pwaRegister.includes(fragment)) {
    throw new Error(`PWA update flow must refresh a controlled Wewed session after an app update: ${fragment}`)
  }
}

console.log('Shared dynamic Inbox New Message CTA and client-update contract passed.')