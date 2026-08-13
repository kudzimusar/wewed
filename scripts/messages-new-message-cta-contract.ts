import { readFileSync } from 'node:fs'

const page = readFileSync('src/app/messages/page.tsx', 'utf8')
const layout = readFileSync('src/app/messages/layout.tsx', 'utf8')

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

console.log('Shared Inbox New Message CTA contract passed.')
