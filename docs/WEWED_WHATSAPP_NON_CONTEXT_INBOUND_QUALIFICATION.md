# Wewed WhatsApp Non-Context Inbound Qualification

This is the first implementation slice of the service-window plan.

## Behavior

- Contextual WhatsApp replies continue to resolve by exact Meta `context.id` to the originating Wewed delivery.
- A normal non-quoted WhatsApp text is normalized instead of discarded.
- Without `context.id`, Wewed accepts the message only when the verified endpoint has exactly one Wewed conversation with a successfully processed inbound WhatsApp message in the previous 24 hours and the endpoint owner is still an active participant.
- Zero or multiple eligible conversations fail closed and the webhook remains acknowledged without creating a canonical message.
- The first WhatsApp-to-Wewed binding still requires exact contextual correlation; non-context messages cannot invent a conversation.
- Message body, phone number, access token and raw webhook payload are not logged. Provider-event metadata stores only a body SHA-256 digest and the non-sensitive correlation mode.

## Production test

The current planner endpoint already has one recently established contextual WhatsApp binding. After this exact implementation is merged and deployed:

1. Send a normal WhatsApp text from the registered planner number without using Reply/quote.
2. Do not send a new Wewed outbound message first.
3. Confirm the text appears in the existing Wewed conversation.
4. Verify a new `CommunicationProviderEvent` is `INBOUND`, `eventType=message`, `status=PROCESSED`, and its canonical `messageId` belongs to that same conversation.
5. Confirm the webhook is HTTP 200 and no duplicate message is created on retry.

## Next slice

After non-context inbound is qualified, implement outbound service-window routing so a Wewed message in the same active conversation uses WhatsApp `type=text`; outside the safe 24-hour conversation binding it continues to use the approved `wewed_new_message_v1` template.
