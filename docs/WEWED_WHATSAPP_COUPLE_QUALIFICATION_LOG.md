# Wewed WhatsApp Couple Qualification Log

## 2026-08-11 production checkpoint

Target: active Couple account attached to the Charity & Kudzie wedding, using a WhatsApp number distinct from the previously qualified Planner endpoint.

### Endpoint setup

- Couple WhatsApp endpoint saved through `Messages -> Channels`.
- Endpoint moved from `PENDING` to `VERIFIED` through the protected internal verification route.
- Couple WhatsApp preference is enabled.
- Couple Email endpoint is also verified and enabled.
- No phone number or secret is recorded in this document.

### Admin -> Couple first-message test

Canonical Wewed message: `Couple WhatsApp notification qualification 2026-08-11`.

Observed results:

- canonical Wewed message created in the Admin/Couple conversation: PASS;
- Couple in-app delivery: `DELIVERED`: PASS;
- automatic communications scheduler picked up external delivery: PASS;
- WhatsApp delivery attempted once through `meta-whatsapp-cloud`: PASS;
- WhatsApp provider request returned `HTTP_400`: FAIL;
- no WhatsApp provider message ID was returned and no Meta status webhook followed: expected after provider rejection;
- Email delivery was also created, but the Resend attempt is retrying with `PROVIDER_ERROR`: separate channel issue to investigate.

The WhatsApp failure occurred at the external provider boundary, not in Wewed conversation creation or queue scheduling. Waiting longer cannot turn this particular delivery into a success because the WhatsApp delivery is already terminally marked `FAILED` after the HTTP 400 response.

### Immediate diagnostic

Run the approved `wewed_new_message_v1` template directly against the Couple test recipient with the local Meta developer token and inspect Meta's JSON response. Do not paste the token or phone number into issues, commits, logs or chat. The most likely controlled-test cause is Meta test-recipient eligibility/configuration, but the direct API response must be used as the authority before changing application code.

### Qualification status

Couple role qualification remains OPEN. Do not classify Couple WhatsApp as production-qualified until:

1. the provider-side HTTP 400 cause is identified and cleared;
2. first business-initiated notification template arrives on the Couple WhatsApp account;
3. quoted reply establishes exact Wewed conversation correlation;
4. normal non-quoted reply resolves safely to the same conversation;
5. Wewed sends the exact canonical text inside the active service window;
6. sent/delivered/read reconciliation and duplicate protection are confirmed.

### Product finding

The test also demonstrates why channel health must be visible separately from the Wewed inbox. An in-app `DELIVERED` state does not imply WhatsApp or Email delivery succeeded. Productisation should expose per-channel delivery state and actionable failure/retry information to authorised users or staff without leaking addresses, message bodies, provider payloads or secrets.
