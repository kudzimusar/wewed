# Wewed Supabase authentication emails

## Purpose

Wewed authentication email must explain what action occurred, what the recipient should do next, and what the action does **not** do. Email links must land on a purpose-built Wewed page rather than the homepage.

Source-controlled templates:

- `supabase/email-templates/confirm-signup.html`
- `supabase/email-templates/reset-password.html`

Application routes:

- `/forgot-password` requests a Supabase recovery email.
- `/reset-password` establishes the recovery session, removes URL-fragment tokens, validates a 12-character minimum, updates the password, and globally signs out previous Supabase sessions.
- `/register?confirmed=1` explains that confirmation succeeded but the application remains pending review.

## Supabase project

Configure project:

```text
kjigkhjdeymukwradoqu
```

## URL configuration

In **Authentication → URL Configuration**:

### Site URL

```text
https://wewed-nu.vercel.app
```

### Allowed redirect URLs

```text
https://wewed-nu.vercel.app/**
https://wewed-git-feature-wewed-pricing-billing-v1-pay-pass-project.vercel.app/**
```

Production recovery requests therefore return to:

```text
https://wewed-nu.vercel.app/reset-password
```

Pricing Preview recovery requests return to:

```text
https://wewed-git-feature-wewed-pricing-billing-v1-pay-pass-project.vercel.app/reset-password
```

## Confirm signup template

In **Authentication → Email Templates → Confirm signup**:

Subject:

```text
Confirm your Wewed application
```

Paste the complete contents of:

```text
supabase/email-templates/confirm-signup.html
```

Required behavior:

- The button uses `{{ .ConfirmationURL }}`.
- The message states that email confirmation does not activate dashboard access.
- The message states that administrator review and onboarding remain required.
- The message warns that the link is single-use and time-limited.

## Reset password template

In **Authentication → Email Templates → Reset password / Recovery**:

Subject:

```text
Reset your Wewed password
```

Paste the complete contents of:

```text
supabase/email-templates/reset-password.html
```

Required behavior:

- The button uses `{{ .ConfirmationURL }}`.
- The email says the link opens a Wewed password page.
- The email distinguishes password recovery from a magic-link sign-in.
- The email warns never to forward the link or share tokens.

## Sender identity

For production, configure a dedicated SMTP sender rather than relying on a generic Supabase sender.

Recommended identity:

```text
Sender name: Wewed
From address: access@wewed.example
Reply-to: support@wewed.example
```

Replace the example domain with a verified Wewed-owned domain before launch. Do not use a personal mailbox as the production sender.

## Recovery request rules

Use the Wewed `/forgot-password` page. It calls Supabase `resetPasswordForEmail` with the current deployment origin and `/reset-password` as `redirectTo`.

Do not use **Send magic link** as a password-reset substitute. A magic link signs a user in; it does not ask them to choose a new password.

Do not place `{{ .SiteURL }}` directly on the primary email button. The primary button must use `{{ .ConfirmationURL }}` so the verification token and requested redirect destination are preserved.

## Security rules

- Never paste access tokens, refresh tokens, OTPs, passwords, service-role keys, or confirmation URLs into chat, tickets, or source control.
- A recovery URL exposed outside the recipient's browser must be revoked and replaced.
- Open only the newest recovery message.
- Recovery links are single-use and time-limited.
- The reset page removes URL-fragment tokens before rendering the password form.
- A successful password update globally signs out Supabase sessions and requires a fresh Wewed sign-in.

## Preview certification

1. Open the pricing Preview `/admin` sign-in.
2. Select **Forgot password?**.
3. Request recovery for a controlled test administrator.
4. Confirm the received email has Wewed branding and the correct subject.
5. Confirm the button opens Preview `/reset-password`, not the homepage and not Production.
6. Confirm tokens disappear from the address bar before the password form is used.
7. Set a new 12+ character test password.
8. Confirm the page requires a fresh sign-in.
9. Sign in to `/admin` with the new password.
10. Confirm `/admin`, Approvals and the pending QA account are accessible.
11. Inspect Preview runtime logs for auth or 5xx errors.

## Production release gate

Do not certify Production recovery until:

- the templates are pasted into the intended Supabase project;
- sender identity and SMTP are verified;
- Production and Preview redirect URLs are present;
- Preview recovery passes end to end;
- no access or refresh token appears in support logs, screenshots, tickets, or chat;
- the reviewed billing branch is explicitly approved for merge.
