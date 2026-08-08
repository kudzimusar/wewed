# Wewed email operations

## Production architecture

Wewed separates inbound human mail from outbound application mail so that the root-domain inbox experience and transactional sending reputation do not interfere with each other.

| Purpose | Provider | Address/domain | Free-tier role |
|---|---|---|---|
| Public inbound aliases | Cloudflare Email Routing | `@wewed.pro` | Free inbound forwarding |
| Transactional outbound | Resend | `updates.wewed.pro` | Free transactional sending |
| Human mailbox destination | Gmail | `eleven.eleven.testing@gmail.com` | Current monitored testing destination |
| Application email callbacks | Wewed/Vercel | `https://wewed.pro/api/webhooks/resend` | Delivery events |

Cloudflare Email Sending is deliberately not the production transactional provider while Wewed is constrained to Workers Free. Arbitrary-recipient outbound sending is a Workers Paid capability. Resend remains the outbound provider.

## Canonical inbound aliases

Route these addresses through Cloudflare Email Routing to the monitored Gmail destination:

- `hello@wewed.pro`
- `support@wewed.pro`
- `billing@wewed.pro`
- `privacy@wewed.pro`
- `legal@wewed.pro`
- `security@wewed.pro`
- `planners@wewed.pro`
- `marketplace@wewed.pro`

Current staff testing aliases also route to the same monitored mailbox:

- `tony@wewed.pro`
- `charity@wewed.pro`
- `kudzie@wewed.pro`

These staff aliases are forwarding identities, not private staff mailboxes. Move each alias to an individually verified destination before using it for private staff correspondence.

Keep the root-domain catch-all set to `Drop` until spam volume and support workflow ownership have been reviewed.

## Canonical outbound identity

Transactional application mail sends from:

- `Wewed <notifications@updates.wewed.pro>`

Replies go to:

- `support@wewed.pro`

The outbound provider must be configured with a sending-only credential restricted to `updates.wewed.pro` where supported.

## DNS ownership boundary

`wewed.pro` is authoritative on Cloudflare DNS while Vercel continues hosting the application. Preserve the Vercel apex/`www` records and redirect behavior in Cloudflare DNS. The Vercel-facing web records remain DNS-only during the initial production cutover so DNS authority and HTTP proxying are changed independently.

Cloudflare Email Routing owns the root-domain inbound MX path. Resend owns only the transactional sending subdomain records under `updates.wewed.pro`, including its DKIM, SPF and return-path records.

## Resend activation sequence

1. Create `updates.wewed.pro` in Resend with sending enabled and receiving disabled.
2. Add the Resend SPF, DKIM and return-path records to authoritative Cloudflare DNS.
3. Verify the Resend domain.
4. Create a sending-only Wewed API key restricted to the Wewed domain.
5. Add `RESEND_API_KEY`, `WEWED_EMAIL_FROM` and `WEWED_EMAIL_REPLY_TO` to Vercel Production.
6. Create the Resend webhook pointing at `https://wewed.pro/api/webhooks/resend` for `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained` and `email.failed`.
7. Store its signing secret as `RESEND_WEBHOOK_SECRET` in Vercel Production.
8. Send a production canary and verify the provider event appears in `wewed_admin.EmailDelivery` / `EmailWebhookEvent`.

## Cloudflare inbound activation sequence

1. Ensure `wewed.pro` is authoritative on Cloudflare DNS.
2. Onboard the root domain under Cloudflare Email Routing.
3. Verify `eleven.eleven.testing@gmail.com` as the monitored destination address.
4. Create exact routing rules for each operational and staff alias listed above.
5. Keep catch-all set to `Drop`.
6. Send canaries from an external account to `support@wewed.pro`, `privacy@wewed.pro`, `security@wewed.pro`, `planners@wewed.pro` and `marketplace@wewed.pro`.
7. Confirm delivery in the monitored Gmail inbox and preserve original sender/reply behavior.

## Fail-closed rules

- Never commit API tokens or webhook secrets.
- Never fall back to a non-Wewed sender domain.
- Registration must succeed even if the optional registration-receipt email fails.
- Authentication confirmation continues through Supabase Auth and always returns to `https://wewed.pro` in production.
- The Wewed Resend webhook persists only events tagged `application=wewed`.
- Do not use staff forwarding aliases for private correspondence until each staff member has an individually verified destination.
