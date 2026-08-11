# Wewed Communications UI Redesign Plan

## Goal

Make `/messages` immediately understandable to ordinary users by combining a Gmail-like inbox hierarchy with a WhatsApp-like conversation experience, without changing communications data, permissions, delivery routing, persistence, provider logic, or database structures.

## Product rules

1. Inbox before controls. Existing conversations are the primary navigation surface; starting a new conversation is a secondary action.
2. One mobile surface at a time. Phones show either the conversation list or the selected thread, never a long stacked list-plus-thread page.
3. Familiar conversation anatomy. Thread header, message history, bubbles, timestamps and composer should behave and read like mainstream chat applications.
4. Strong unread hierarchy. Unread conversations use weight, badge and preview contrast rather than decorative cards.
5. Technical infrastructure stays out of the everyday UI. Polling/provider/database implementation copy is removed from the user-facing thread.
6. Admin-only functions remain available but quiet. Internal-note controls appear near the composer and are visually distinct without competing with normal messaging.
7. Existing communication behavior is preserved. This release is presentation and client navigation state only.

## Desktop information architecture

- Compact product header: Back, Messages, Refresh.
- Two-column communications shell.
- Left: Inbox toolbar, New message action, conversation list.
- Right: Sticky conversation header, scrollable message history, sticky composer.
- Conversation rows show avatar/initial, title, last-message preview, time and unread badge.
- Active conversation is obvious without large decorative cards.

## Mobile information architecture

- Inbox is the default screen.
- Opening a conversation replaces the inbox with the thread.
- Thread header has a clear back-to-inbox action.
- Composer stays attached to the bottom of the conversation surface.
- Message viewport remains bounded and latest-message anchoring from the current fix is preserved.

## Visual language

- Keep Wewed ivory/espresso/champagne/gold tokens.
- Reduce serif usage inside operational messaging UI; reserve it for the page title only.
- Use restrained borders and flat surfaces rather than nested rounded cards.
- Outgoing bubbles: espresso/champagne.
- Incoming bubbles: white/espresso.
- Staff-only notes: subtle gold treatment with lock indicator.

## Explicit non-goals

- no database or migration changes
- no API changes
- no WhatsApp/email/SMS/push routing changes
- no participant/permission changes
- no delivery-status changes
- no new realtime infrastructure
- no attachments, reactions, search backend or moderation features

## Qualification

- build/type qualification on exact head
- existing Communications CI remains green
- mobile layout contract: inbox and thread do not stack
- current latest-message anchoring/reconciliation behavior remains intact
