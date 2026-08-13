import { readFileSync } from 'node:fs'

const launcher = readFileSync(
  'src/components/communications/messages-new-message-launcher.tsx',
  'utf8',
)
const layout = readFileSync('src/app/messages/layout.tsx', 'utf8')

const requiredLauncherFragments = [
  'data-communications-new-message-cta="true"',
  'New message',
  "pathname === '/messages'",
  "fetch('/api/communications/contacts'",
  "fetch('/api/communications/conversations'",
  'participantIds: [contact.id]',
  'type: contact.defaultType',
  'initialMessage: body',
  "window.location.assign('/messages')",
]

for (const fragment of requiredLauncherFragments) {
  if (!launcher.includes(fragment)) {
    throw new Error(`Missing New Message launcher contract fragment: ${fragment}`)
  }
}

const requiredLayoutFragments = [
  "import MessagesNewMessageLauncher from '@/components/communications/messages-new-message-launcher'",
  '<MessagesNewMessageLauncher />',
]

for (const fragment of requiredLayoutFragments) {
  if (!layout.includes(fragment)) {
    throw new Error(`Messages layout does not mount launcher: ${fragment}`)
  }
}

console.log('Messages New Message CTA contract passed.')
