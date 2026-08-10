# Wewed Communications — WhatsApp Cloud Operations

**Date:** 2026-08-10  
**Status:** Deployment/runbook companion to `WEWED_WHATSAPP_CLOUD_WEBHOOK_IMPLEMENTATION_PLAN.md`

## Purpose

This runbook activates Meta WhatsApp Cloud API as a transport around Wewed's canonical communications system. Meta is not the conversation database. Wewed messages, membership, visibility, rate limits, endpoint ownership and delivery state remain authoritative.

## Current Meta test assets

- WABA: `1052651633933852`
- Cloud API Phone Number ID: `1262607510266445`
- Graph API: `v26.0`
- notification template: `wewed_new_message_v1`
- template language: `en_US`
- callback path: `https://wewed.pro/api/webhooks/whatsapp`

The currently verified API asset is a Meta test number. Do not treat it as the final public Wewed phone number.

## Deployment secrets

Configure the following as server-only deployment environment variables. Never commit real values and never expose them with a `NEXT_PUBLIC_` prefix.

```text
WHATSAPP_CLOUD_ACCESS_TOKEN=<Meta System User token>
WHATSAPP_CLOUD_PHONE_NUMBER_ID=1262607510266445
WHATSAPP_CLOUD_GRAPH_VERSION=v26.0
WEWED_WHATSAPP_NOTIFICATION_TEMPLATE=wewed_new_message_v1
WEWED_WHATSAPP_TEMPLATE_LANGUAGE=en_US
WHATSAPP_WEBHOOK_VERIFY_TOKEN=<random webhook verification secret>
WHATSAPP_WEBHOOK_APP_SECRET=<Wewed Meta App Secret>
```

`WHATSAPP_CLOUD_GRAPH_BASE_URL` is optional and should normally be left unset so Wewed uses `https://graph.facebook.com`.

Generate a new webhook verification token locally with:

```bash
openssl rand -hex 32
```

The verification token is Wewed-defined. The App Secret must be copied from the Wewed Meta app settings. The System User access token must belong to the Wewed app and have the required WhatsApp management/messaging permissions plus access to the target WABA.

## Pre-subscription gate

Do not subscribe the app to the WABA until all of these conditions are true:

1. The exact qualified code head containing `/api/webhooks/whatsapp` is deployed to a public HTTPS Wewed URL.
2. `WHATSAPP_WEBHOOK_VERIFY_TOKEN` and `WHATSAPP_WEBHOOK_APP_SECRET` exist in that deployment.
3. A direct GET verification test against the deployed callback succeeds.
4. The Meta notification template is approved and the configured language matches the approved template.
5. The production/test System User token can list the WABA phone numbers.

## Meta webhook callback configuration

In the Meta app's WhatsApp/Webhooks configuration, use:

```text
Callback URL: https://wewed.pro/api/webhooks/whatsapp
Verify token: <the exact WHATSAPP_WEBHOOK_VERIFY_TOKEN value from deployment>
```

During callback verification Meta sends `hub.mode=subscribe`, `hub.verify_token`, and `hub.challenge`. Wewed returns the challenge only when the configured verification token matches exactly.

For webhook POSTs, Wewed validates `X-Hub-Signature-256` against the raw HTTP request body using HMAC-SHA256 and `WHATSAPP_WEBHOOK_APP_SECRET`. Invalid or unsigned payloads are rejected before JSON parsing or communications-domain processing.

## Subscribe the app to the WABA

After Meta accepts the callback, subscribe the Wewed app to the WABA. Keep the token in a shell variable rather than writing it into shell history:

```bash
read -s WA_TOKEN
export WA_TOKEN
export WABA_ID='1052651633933852'

curl -sS -X POST \
  "https://graph.facebook.com/v26.0/${WABA_ID}/subscribed_apps" \
  -H "Authorization: Bearer ${WA_TOKEN}"
```

Do not paste the access token into tickets, chat, screenshots, source files or documentation.

## Outbound notification contract

Wewed proactively sends only the approved template notification. The current template receives one body parameter, the Wewed sender display name:

```text
You have a new message from {{1}} on Wewed. Open Wewed to view and reply.
```

The private Wewed message body is deliberately not copied into the WhatsApp template request. If the approved template name is missing, the WhatsApp transport is treated as not configured and the delivery fails closed rather than falling back to proactive free-form text.

## Temporary `hello_world` qualification mode

While `wewed_new_message_v1` is still under Meta review, Wewed can qualify the real canonical delivery path with Meta's already-approved parameter-free `hello_world` test template.

Configure only during a controlled test window:

```text
WEWED_WHATSAPP_TEST_MODE=true
WEWED_WHATSAPP_TEST_TEMPLATE=hello_world
WEWED_WHATSAPP_TEST_RECIPIENTS=+818081201356
```

The recipient list is comma-separated E.164. The implementation normalizes each configured number and fails closed unless the current delivery recipient is explicitly allowlisted. In test mode Wewed supplies no template components or parameters, so no sender name or private message body is sent to `hello_world`.

If test mode is enabled but the template is missing, the allowlist is empty, an allowlist value is invalid, or the delivery recipient is not allowlisted, no WhatsApp request is built. The canonical Wewed message still exists; the external delivery is treated as unavailable rather than silently falling back to the production template.

After qualification, set:

```text
WEWED_WHATSAPP_TEST_MODE=false
```

and redeploy. Keep `WEWED_WHATSAPP_NOTIFICATION_TEMPLATE=wewed_new_message_v1` configured throughout so the normal production path is restored automatically once Meta approves it.

## Delivery webhook contract

Meta message statuses are normalized into Wewed's existing delivery state:

| Meta status | Wewed status | Note |
| --- | --- | --- |
| `sent` | `SENT` | Meta accepted/sent the message |
| `delivered` | `DELIVERED` | Recipient device delivery confirmed |
| `read` | `DELIVERED` | Current Wewed schema has no separate READ delivery state; sanitized provider metadata retains `providerStatus=read` |
| `failed` | `FAILED` | Failure code/reason is sanitized before provider-event persistence |

Status event IDs are derived deterministically from stable Meta identifiers and timestamps. Meta retries therefore hit the existing provider-event idempotency boundary rather than duplicating state transitions.

## Inbound reply contract

This release accepts only inbound WhatsApp text messages that include `context.id` pointing at a Wewed-originated WhatsApp message. That ID routes through the existing verified-endpoint and active-conversation-membership checks before Wewed creates a canonical reply.

An inbound message without `context.id` is acknowledged but not attached to a conversation. Wewed does not guess based on the phone number because one Wewed participant can belong to multiple conversations. Media, documents, audio and other attachment-bearing WhatsApp messages remain deferred until the communications attachment/scanning phase.

## Privacy and logging

The webhook layer must not log raw webhook payloads, message bodies, phone endpoints, access tokens or the Meta App Secret. Inbound provider-event metadata stores the existing body SHA-256 rather than the raw inbound body. Status metadata is restricted to provider status plus bounded failure code/reason values.

## Test-number qualification

Before attaching a real Wewed business number, exercise the Meta test number through this sequence:

1. Register and internally verify a Wewed WhatsApp endpoint for an authenticated tester, then enable the WhatsApp channel preference.
2. If the production Wewed template is not yet approved, enable the controlled `hello_world` qualification mode and allowlist only the tester number.
3. Send a canonical Wewed message to that tester and run the protected communications dispatcher.
4. Confirm Meta returns a provider message ID and the Wewed delivery reaches `SENT`.
5. Confirm Meta webhook status transitions reconcile to `DELIVERED` and a later `read` event does not downgrade state.
6. In WhatsApp, explicitly reply to the Wewed-originated notification so Meta supplies `context.id`; confirm exactly one canonical Wewed inbound message is created.
7. Replay the same webhook payload and confirm no duplicate canonical message/provider transition is created.
8. Disable `WEWED_WHATSAPP_TEST_MODE` after the qualification window.

## Production-number cutover

The real Wewed WhatsApp number is a separate launch gate. Before cutover, confirm business/phone verification, display name, template approval, quality state and production messaging limits in Meta. Replace `WHATSAPP_CLOUD_PHONE_NUMBER_ID` only after the production phone asset is verified and assigned to the same controlled Wewed business/app access model.

## Rollback

To stop WhatsApp external fanout without affecting canonical Wewed messages, disable WhatsApp preferences/endpoints or remove the WhatsApp transport credentials/template from deployment. To stop the temporary test path specifically, set `WEWED_WHATSAPP_TEST_MODE=false` and redeploy. To stop inbound Meta processing, remove the WABA app subscription and/or webhook callback after first disabling outbound fanout. No rollback should delete canonical Wewed conversations or messages.
