# Wewed email operations

## Production architecture

Wewed separates inbound human mail, staff correspondence, and application-generated mail. They are different delivery problems and must not be collapsed into one provider or credential.

| Purpose | Provider | Address/domain | Operational role |
|---|---|---|---|
| Public inbound aliases | Cloudflare Email Routing | `@wewed.pro` | Receives and forwards human mail |
| Transactional application outbound | Resend | `updates.wewed.pro` | Wewed-generated notifications and receipts |
| Staff outbound correspondence | Gmail + Brevo SMTP | individual `@wewed.pro` staff identities | Human-to-human mail sent from each staff member's Gmail inbox |
| Current shared testing destination | Gmail | `eleven.eleven.testing@gmail.com` | Operational/testing destination for aliases not yet separated |
| Application email callbacks | Wewed/Vercel | `https://wewed.pro/api/webhooks/resend` | Resend delivery lifecycle events |

Cloudflare Email Routing does not provide a private mailbox UI or arbitrary SMTP sending. Resend remains the application transactional sender. Brevo SMTP is used only to let a human Gmail inbox send as an authenticated `@wewed.pro` identity; it does not replace the Wewed application email adapter.

## Canonical operational aliases

Route these addresses through Cloudflare Email Routing to the monitored operations destination unless and until an owner-specific destination is assigned:

- `hello@wewed.pro`
- `support@wewed.pro`
- `billing@wewed.pro`
- `privacy@wewed.pro`
- `legal@wewed.pro`
- `security@wewed.pro`
- `planners@wewed.pro`
- `marketplace@wewed.pro`

Keep the root-domain catch-all set to `Drop` until spam volume and support-workflow ownership have been reviewed.

## Private staff mailbox pattern

Staff identities are:

- `tony@wewed.pro`
- `charity@wewed.pro`
- `kudzie@wewed.pro`

A staff address becomes a practical private mailbox only when both directions are configured:

1. **Inbound:** Cloudflare Email Routing sends the exact staff alias to that staff member's own verified destination Gmail account.
2. **Outbound:** that Gmail account adds the matching `@wewed.pro` address under **Send mail as**, authenticated through `smtp-relay.brevo.com` on port `587` with TLS and a Brevo SMTP key.
3. In Gmail, make the matching Wewed address the default sender for that staff inbox and select **Reply from the same address the message was sent to**.

Do not route multiple staff identities to one shared Gmail inbox for confidential long-term correspondence. The shared testing mailbox is acceptable only while validating routing or before individual destinations are available.

Each staff member should use a separate Gmail account/destination. The same authenticated Wewed domain may be used for multiple staff Send-As identities, subject to Brevo account limits and acceptable-use controls. Never share a Gmail password between staff.

## Canonical application outbound identity

Transactional application mail sends from:

- `Wewed <notifications@updates.wewed.pro>`

Replies go to:

- `support@wewed.pro`

The application sending credential is separate from staff SMTP credentials. Never reuse a human Brevo SMTP key as `RESEND_API_KEY`, and never expose either credential client-side.

## DNS ownership boundary

`wewed.pro` is authoritative on Cloudflare DNS while Vercel hosts the application. Preserve the Vercel apex/`www` records and redirect behavior in Cloudflare DNS.

Cloudflare Email Routing owns the root-domain inbound MX path. Resend owns only the transactional sending subdomain records under `updates.wewed.pro`. Brevo authenticates the root domain for staff SMTP Send-As with its Brevo verification/DKIM records and the single authoritative `_dmarc` policy record.

There must be only one `_dmarc.wewed.pro` TXT policy record. Do not create parallel DMARC records for different email providers; all legitimate senders must align under the same domain policy.

## Application outbound activation sequence

1. Verify `updates.wewed.pro` in Resend with sending enabled.
2. Keep the Resend SPF, DKIM and return-path records in authoritative Cloudflare DNS.
3. Keep `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `WEWED_EMAIL_FROM` and `WEWED_EMAIL_REPLY_TO` in Vercel Production secrets only.
4. Keep the Resend webhook at `https://wewed.pro/api/webhooks/resend` for the supported email delivery lifecycle events.
5. Send production canaries and verify provider events appear in `wewed_admin.EmailDelivery` / `EmailWebhookEvent`.

## Cloudflare inbound activation sequence

1. Keep `wewed.pro` authoritative on Cloudflare DNS.
2. Keep Cloudflare Email Routing enabled for the root domain.
3. Verify every destination Gmail address before routing an alias to it.
4. Create exact routing rules for operational and staff aliases.
5. Keep catch-all set to `Drop`.
6. Test each route from an unrelated external sender.
7. Confirm the forwarded message preserves the original sender so Reply targets the external correspondent rather than Cloudflare.

## Staff Send-As activation sequence

For each staff member:

1. Route the staff alias to that person's verified Gmail destination.
2. In that Gmail account, add the matching `@wewed.pro` identity under **Accounts and Import → Send mail as**.
3. Use Brevo SMTP: `smtp-relay.brevo.com`, port `587`, TLS.
4. Use the Brevo SMTP login shown by Brevo and a current SMTP key as the password.
5. Complete Google's verification message delivered through the Cloudflare route.
6. Set the Wewed identity as the default sender for that staff inbox.
7. Select **Reply from the same address the message was sent to**.
8. Send a named, normal-content canary to an unrelated external mailbox and inspect SPF/DKIM/DMARC results if available.

## Fail-closed rules

- Never commit API tokens, SMTP keys or webhook secrets.
- Never fall back to a non-Wewed application sender domain.
- Registration must succeed even if the optional registration-receipt email fails.
- Authentication confirmation continues through Supabase Auth and always returns to `https://wewed.pro` in production.
- The Wewed Resend webhook persists only events tagged `application=wewed`.
- Staff email and application transactional email are separate systems with separate credentials.
- A staff alias is not considered private until its inbound destination is individual and its matching Gmail Send-As identity has been verified.
