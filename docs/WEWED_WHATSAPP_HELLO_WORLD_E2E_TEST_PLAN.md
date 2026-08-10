# Wewed WhatsApp `hello_world` End-to-End Test Plan

**Date:** 2026-08-10  
**Status:** Authoritative temporary qualification plan  
**Base:** `main` at `f6893fec510b7a044511050c3141390d311663fc`

## Goal

Qualify the real Wewed canonical communications path against Meta's already-approved `hello_world` template while `wewed_new_message_v1` remains under Meta review.

The target path is:

**Wewed canonical message -> durable WHATSAPP delivery -> protected dispatcher -> Meta Cloud API test number -> recipient WhatsApp -> signed Meta status webhook -> Wewed delivery state**

This test mode must not weaken the production template/privacy contract.

## Server-only test controls

Add three deployment variables:

- `WEWED_WHATSAPP_TEST_MODE=false`
- `WEWED_WHATSAPP_TEST_TEMPLATE=hello_world`
- `WEWED_WHATSAPP_TEST_RECIPIENTS=`

`WEWED_WHATSAPP_TEST_RECIPIENTS` is a comma-separated E.164 allowlist. Test mode is fail-closed: while enabled, Wewed may send the test template only to an allowlisted recipient. A missing test template, missing allowlist, or non-allowlisted recipient produces no WhatsApp request.

## Runtime contract

When test mode is **off**, the current production contract remains unchanged:

- `WEWED_WHATSAPP_NOTIFICATION_TEMPLATE` is required;
- the template receives exactly one body text parameter containing the sender display name;
- the private Wewed message body is never copied into the WhatsApp notification.

When test mode is **on** for an allowlisted recipient:

- Wewed sends `WEWED_WHATSAPP_TEST_TEMPLATE`;
- language stays `en_US` through the existing WhatsApp language configuration;
- no template components or parameters are supplied, matching Meta's pre-approved `hello_world` test template;
- the canonical Wewed message and delivery queue remain authoritative.

## Qualification gates

Before merge, the exact head must prove:

1. Production mode still emits `wewed_new_message_v1` with sender name only.
2. Production mode still fails closed if the production template is absent.
3. Test mode emits `hello_world` with no components only for an allowlisted normalized E.164 recipient.
4. Test mode fails closed for non-allowlisted recipients and incomplete test configuration.
5. The private Wewed message body is absent from both production and test WhatsApp requests.
6. Existing signed webhook, communications authorization, privacy, rate-limit, provider-security, marketplace, budget and build regressions remain green.

## Deployment/rollback

No database migration is required.

For the live qualification, enable the three test variables only on the controlled Wewed production test window and allowlist only the registered tester number. After qualification, set `WEWED_WHATSAPP_TEST_MODE=false` (or remove the three test variables) and redeploy. The production notification template remains configured as `wewed_new_message_v1` throughout, so Meta approval can be adopted without another transport redesign.
