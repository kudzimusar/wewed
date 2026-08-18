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
8. Opening is what marks a conversation read. Loading the Inbox must not silently open or mark the first conversation read, and a hidden mobile thread must not keep consuming new unread messages.
9. Draft intent stays attached to its conversation. Switching people must never carry an unsent message into the wrong recipient's composer.
10. Late client responses must be conversation-safe. A response from a previously selected thread may not overwrite, mark read, or otherwise mutate the currently visible thread.

## Desktop information architecture

- Compact product header: Back, Messages, Refresh and a quiet Channels settings action.
- Two-column communications shell.
- Left: Inbox toolbar, New message action, conversation list.
- Right: conversation header, scrollable message history, bottom composer.
- Conversation rows show avatar/initial, title, last-message preview, time and unread badge.
- Active conversation is obvious without large decorative cards.
- The Inbox does not auto-open the first row; the user explicitly chooses a conversation, matching email-inbox expectations.
- Desktop composer supports Enter to send and Shift+Enter for a new line.

## Mobile information architecture

- Inbox is the default screen.
- Opening a conversation replaces the Inbox and its product header with the conversation screen.
- Thread header has a clear back-to-inbox action.
- Returning to Inbox clears the active thread so background refresh cannot mark unseen messages read.
- Composer stays attached to the bottom of the conversation surface.
- The Messages shell owns the dynamic viewport; the document itself does not become the chat scroll owner.
- Message viewport remains bounded and latest-message anchoring from the current fix is preserved.
- Channels settings remains reachable from the Inbox header without floating over conversation content.

## Visual language

- Keep Wewed ivory/espresso/champagne/gold tokens.
- Reduce serif usage inside operational messaging UI; reserve it for the page title only.
- Use restrained borders and flat surfaces rather than nested rounded cards.
- Outgoing bubbles: espresso/champagne.
- Incoming bubbles: white/espresso.
- Staff-only notes: subtle gold treatment with lock indicator.
- Direct-message bubbles do not repeat the sender name on every incoming message; group messages retain sender labels where identity is useful.
- Do not make ambiguous security claims in routine chat chrome. The product should communicate privacy through behavior and policy, not unsupported badges.

## Interaction safeguards

- Conversation drafts are stored independently in client state for the current session.
- Closed conversations remain readable but replace the active composer with a clear closed-state explanation.
- New-message controls collapse when a conversation is opened so composing and reading do not compete for attention.
- Search includes a clear action and remains local to already-loaded conversations; backend search remains explicitly out of scope.
- The composer grows with its content up to a bounded height, then scrolls internally.

## Explicit non-goals

- no database or migration changes
- no API changes
- no WhatsApp/email/SMS/push routing changes
- no participant/permission changes
- no delivery-status changes
- no new realtime infrastructure
- no attachments **in this UI-only redesign**; attachment/storage implementation is intentionally governed by `docs/WEWED_VAULT_CONTRACTS_TRANSACTION_GOVERNANCE_PLAN.md`
- no reactions, search backend or moderation features

## Qualification

- build/type qualification on exact head
- existing Communications CI remains green
- repository-wide browser release gate remains green
- mobile layout contract: Inbox and thread do not stack
- mobile Inbox performs zero thread fetch/read calls before explicit open
- returning to mobile Inbox prevents hidden-thread refresh/read calls
- current latest-message anchoring/reconciliation behavior remains intact
- deliberate history reading is not dragged back to the newest message by refresh/polling
- per-conversation draft survives leaving and reopening that conversation
