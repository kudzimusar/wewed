# Secure authentication architecture

## Identity

Supabase Auth owns email/password credentials and browser auth cookies.

## Authorization

The public `User` record controls whether an authenticated identity may use the dashboard:

- `isActive` must be true.
- `role` must be `admin`, `couple`, or `planner`.
- Non-admin users must be linked to the couple that owns the flagship wedding.

`UserProfile` stores display information and moderation state.

## Application session

After Supabase Auth and database authorization both succeed, the server creates an eight-hour HMAC-signed application session in the `wewed_admin_auth` cookie.

The cookie is:

- HttpOnly
- Secure in production
- SameSite=Lax
- scoped to `/`
- inaccessible to browser JavaScript

The signing key is `WEWED_SESSION_SECRET`, falling back to the server-only Supabase service-role key when the dedicated secret has not yet been configured.

## Server protection

- `admin-gate.ts` verifies the signed session for protected route handlers.
- `proxy.ts` protects the planner API namespace, admin RSVP listing/check-in, and the database seed endpoint before route execution.
- Public self-service signup is disabled; accounts are invite-only.
- Browser local storage is only a UI cache. It cannot grant API access.
