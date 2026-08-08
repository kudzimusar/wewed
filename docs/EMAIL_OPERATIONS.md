# Wewed email operations

## Production architecture

Wewed separates inbound human mail from outbound application mail so that the root-domain inbox experience and transactional sending reputation do not interfere with each other.

| Purpose | Provider | Address/domain | Free-tier role |
|---|---|---|---|
| Public inbound aliases | Cloudflare Email Routing | `@wewed.pro` | Free inbound forwarding |
| Transactional outbound | Resend | `updates.wewed.pro` | Free transactional sending |
| Human mailbox destination | Gmail | `kudzimusar@gmail.com` | Monitored destination |
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

Do not create a root-domain catch-all until spam volume and support workflow ownership have been reviewed.

## Canonical outbound identity

Transactional application mail sends from:

- `Wewed <notifications@updates.wewed.pro>`

Replies go to:

- `support@wewed.pro`

The outbound provider must be configured with a sending-only credential restricted to `updates.wewed.pro` where supported.

## DNS ownership boundary

Cloudflare Email Routing requires the domain to use Cloudflare DNS. If `wewed.pro` is still delegated to Vercel nameservers, inbound Cloudflare routing cannot be activated until the authoritative nameservers are moved to the Cloudflare zone and the existing web records are recreated there first.

The website can continue to resolve to Vercel while Cloudflare is authoritative: preserve the Vercel apex/`www` records and redirect behavior when moving DNS.

## Resend activation sequence

1. Retire the old DIREKT custom domain only after explicit destructive-change approval.
2. Create `updates.wewed.pro` in Resend with sending enabled and receiving disabled.
3. Add the Resend SPF, DKIM and return-path records to authoritative DNS.
4. Verify the Resend domain.
5. Create a sending-only Wewed API key restricted to the Wewed domain.
6. Add `RESEND_API_KEY`, `WEWED_EMAIL_FROM` and `WEWED_EMAIL_REPLY_TO` to Vercel Production.
7. Create the Resend webhook pointing at `https://wewed.pro/api/webhooks/resend` for `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained` and `email.failed`.
8. Store its signing secret as `RESEND_WEBHOOK_SECRET` in Vercel Production.
9. Send a production canary and verify the provider event appears in `wewed_admin.EmailDelivery` / `EmailWebhookEvent`.

## Cloudflare inbound activation sequence

1. Ensure `wewed.pro` is authoritative on Cloudflare DNS.
2. Onboard the root domain under Cloudflare Email Routing.
3. Add and verify `kudzimusar@gmail.com` as the destination address.
4. Create exact routing rules for each canonical inbound alias above.
5. Send canaries from an external account to `support@wewed.pro`, `privacy@wewed.pro` and `security@wewed.pro`.
6. Confirm delivery in the monitored Gmail inbox and preserve original sender/reply behavior.

## Fail-closed rules

- Never commit API tokens or webhook secrets.
- Never fall back to a non-Wewed sender domain.
- Registration must succeed even if the optional registration-receipt email fails.
- Authentication confirmation continues through Supabase Auth and always returns to `https://wewed.pro` in production.
- The Wewed Resend webhook persists only events tagged `application=wewed`.
