# Wewed WhatsApp Service-Window Routing Plan

## Goal

Turn the proven WhatsApp notification bridge into a controlled conversational bridge without weakening Wewed's canonical conversation model or contextual safety.

The target behavior is:

- Outside an active WhatsApp customer-service window: send the approved `wewed_new_message_v1` notification template.
- Inside an active customer-service window for the same Wewed conversation: send the actual Wewed message body as a WhatsApp text message.
- Quoted WhatsApp replies continue to resolve by exact Meta `context.id` correlation.
- Non-quoted WhatsApp text may be accepted only when Wewed can resolve exactly one safe active Wewed conversation for that verified endpoint; otherwise ignore it rather than guess.

Meta's current WhatsApp Business policy permits non-template replies within 24 hours of the user's last message and requires approved templates outside that window. The window resets with each user message.

## Existing production foundation already proven

- verified WhatsApp endpoint and explicit user delivery preference
- automatic minute-level queue dispatch
- approved `wewed_new_message_v1` production notification template
- Meta Cloud API send with provider message IDs
- signed webhook verification
- sent/delivered/read reconciliation
- contextual quoted inbound reply correlation back to the correct Wewed conversation
- retries, queue locking, idempotency and fail-closed transport configuration

## Design

### 1. Conversation-scoped service window

Derive service-window eligibility from a recent successfully processed inbound WhatsApp message already associated with the same Wewed conversation and recipient user.

Do not use a global phone-number-only window for content routing: one Wewed user may participate in multiple conversations. The service window may be globally open at Meta, but Wewed will only send raw conversation content when its own conversation correlation is unambiguous.

A conversation is eligible for free-form outbound WhatsApp when:

- the delivery recipient has a VERIFIED WhatsApp endpoint and enabled preference;
- the recipient is still an active conversation participant;
- a PROCESSED inbound WhatsApp provider event exists for a canonical message in the same conversation from that recipient within the previous 24 hours.

Otherwise use `wewed_new_message_v1`.

### 2. Outbound routing

Extend the claimed delivery context with whether the current conversation has an active WhatsApp service window.

- active window -> Meta request `type: text`, body is the canonical Wewed message body;
- no active window -> current approved template request with sender name only;
- controlled test mode, if deliberately re-enabled, remains higher-priority and allowlisted exactly as today.

No message body is logged or copied into provider-event metadata.

### 3. Non-quoted inbound safety

Normalize safe text inbound messages even when Meta does not include `context.id`.

Resolution order:

1. If `context.id` exists, use the existing exact provider-message correlation.
2. If no context exists, find the verified endpoint/user and the set of Wewed conversations for which that user has a PROCESSED inbound WhatsApp message in the last 24 hours and remains a participant.
3. If exactly one conversation is eligible, ingest into that conversation and extend its active service window.
4. If zero or more than one conversation are eligible, ignore the inbound message. Do not guess.

The first non-quoted message cannot create a conversation from nothing; an exact quoted correlation remains the mechanism that establishes the initial safe WhatsApp-to-Wewed conversation binding.

### 4. Privacy and security invariants

- Wewed remains the canonical record.
- Staff-only messages never fan out externally.
- Raw message bodies, phone numbers, tokens and webhook payloads are not logged.
- Existing signed webhook verification remains mandatory.
- Existing verified-endpoint and preference checks remain mandatory.
- Non-quoted inbound routing fails closed on ambiguity.
- Service-window eligibility is conversation-scoped even though Meta's customer-service window is user/business scoped.
- The approved template remains the fallback outside the safe Wewed conversation window.

## Tests

- active same-conversation inbound within 24h produces WhatsApp `text` request with canonical body;
- 24h boundary expired produces approved template request;
- inbound activity in a different Wewed conversation does not unlock raw content for this conversation;
- test mode still overrides production routing and remains allowlisted;
- contextual inbound reply still resolves exactly as before;
- non-context text with exactly one active conversation resolves safely;
- non-context text with zero active conversations is ignored;
- non-context text with multiple active conversations is ignored;
- non-text inbound remains ignored;
- no sensitive logging regression;
- existing communications and WhatsApp webhook contracts remain green.

## Production qualification

1. Use the already-proven approved Wewed template to create a real WhatsApp notification tied to a canonical Wewed delivery.
2. Reply with WhatsApp's explicit quoted Reply action and verify the inbound message reaches the same Wewed conversation.
3. Without waiting 24 hours, send a fresh Wewed message in that same conversation.
4. Confirm WhatsApp receives the actual Wewed message body, not `wewed_new_message_v1`.
5. Send a normal non-quoted WhatsApp text while exactly one conversation is active and confirm Wewed receives it in that conversation.
6. Verify provider status reconciliation and no duplicate delivery.
7. Confirm an unrelated conversation still uses the approved template unless it has established its own inbound WhatsApp binding.

## Rollback

The production notification-template path remains the safe fallback. If service-window routing behaves unexpectedly, disable the new free-form branch and retain the approved-template transport while preserving all canonical messages and delivery records.
