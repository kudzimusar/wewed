# Guest Pass — backend integration status

**Task stamp:** `WW-NATIVE-INVITATION-BOUND-GUEST-PROFILE-2026-09-21-01`
**Supersedes:** the previous version of this file, which was wrong twice over.

---

## 1. Correcting the previous version

The earlier revision of this document concluded that no production authority issued a guest
admission credential, and proposed building one with HMAC-SHA256. Both halves were wrong.

**It searched only `origin/main`.** A complete WW2 issuer already exists on this native branch:

| File | Role |
|---|---|
| `src/lib/wedding-day.ts` | Signs and verifies WW2 credentials |
| `src/lib/wedding-day-manifest.ts` | Distributes the public verification key |
| `src/app/api/wedding-day/pass/route.ts` | Issues a guest's pass |
| `src/app/api/wedding-day/guest/route.ts` | Guest, household, table, programme, announcements |
| `prisma/migrations/20260917114500_wedding_day_domain/migration.sql` | The domain tables |

**And it named the wrong algorithm.** Canonical WW2 is:

```
ECDSA P-256 / SHA-256 / IEEE-P1363, 64-byte signature, 128 hex characters
```

per `mobile/contracts/wedding-pass-token-spec.md` and `WW2_ALGORITHM = 'ECDSA_P256_SHA256'` in
`src/lib/wedding-day.ts`. The HMAC reading came from `TokenVerifier.verify()` — a symmetric path
that exists for other purposes — while the canonical entry points are `verifyAsymmetric()` and
`verifyP1363()`.

The spec is explicit about why, and the reasoning is the point: gate devices are phones and rented
tablets in untrusted hands. Under HMAC every scanner would hold a key capable of minting passes.
Under ECDSA the private key stays with the issuer and scanners can only verify.

**Do not implement the HMAC proposal.** It has been deleted from this document.

## 2. What actually remains

Not a design task. A promotion task.

| Step | State |
|---|---|
| WW2 issuer implemented | **Done**, on this branch |
| Native verifier implemented | **Done**, both platforms |
| Token spec frozen | **Done** |
| Promoted to `origin/main` | **Not done** — needs a dedicated backend PR |
| Production migration reviewed | **Not done** — written for an isolated Wedding Day database |
| Signing keys configured in production | **Not done** |

## 3. Keys

`WEDDING_DAY_WW2_PRIVATE_KEY_PEM` and `WEDDING_DAY_ROOT_PRIVATE_KEY_PEM` are server-held and must
never enter native code, the repository, or a build artefact. Native receives the **public**
verification key through the encrypted wedding manifest, which is the entire reason the scheme is
asymmetric.

## 4. Native's position

`onViewPass` stays nil on the live path until `/api/wedding-day/pass` is reachable in production.
When it is, native needs no structural change: `WeddingPass.qrPayload` already expects a `WW2.`
credential, both pass screens already refuse anything else, and `TokenVerifier` already verifies
P-256/P1363 signatures against the manifest's public key.

**This is a backend promotion deliverable. The Guest Pass lane of the live UAT cannot pass until
it lands.**
