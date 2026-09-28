# Native Admin Parity Matrix

**Status: PARTIAL — authorization model delivered, management surfaces not yet built.**
Last updated 2026-09-20.

The native Admin taxonomy (Dashboard | Cases | Accounts | Audit | More) is approved and unchanged.
What follows is an honest account of what sits beneath those five tabs today, what the web Admin
already does, and what is blocked from outside.

---

## 1. The correction this records

Native Admin was an architecture prototype: it established the IA boundary and then said
"unsupported" beneath it. That was correct while the boundary was the question. It is not an
adequate implementation, because a substantial real Admin management system already exists on the
web, and native must be a projection of it — not a second system.

**Delivered in this pass:** the real Admin authorization model, machine-checked against the web
policy module, so that native cannot offer an action the server would refuse.

**Not delivered:** the management surfaces themselves, and the mobile Admin API they would consume.

---

## 2. The authorization model (delivered)

`src/lib/wewed-admin-policy.ts` is framework-agnostic and is what the Admin API enforces. Rather
than re-typing it into Kotlin and Swift — creating three copies that drift — it is **derived**:

```
src/lib/wewed-admin-policy.ts          the web Admin API enforces this
        │
        └─ generate_admin_policy_contract.py
                 │
                 └─ mobile/contracts/admin-policy.json
                          ├── AdminPolicy.kt    asserted equal, 16 tests
                          └── AdminPolicy.swift asserted equal, 16 tests
```

A change on the web that is not mirrored fails a build rather than reaching a device.

| Model element | Count | Native status |
|---|---:|---|
| Corporate Admin roles | 5 | ✅ Super, Operations, Billing, Support, Analyst — with real labels |
| Permissions | 25 | ✅ exact set, no native inventions |
| Role → permission grants | 5 sets | ✅ element-by-element equality |
| Account lifecycle statuses | 7 | ✅ |
| Governed transitions | 19 | ✅ |
| Transition → permission | 19 | ✅ approve and restore kept distinct |

What this replaces: `role == admin → may do everything`.

Asserted behaviour, both platforms:
- A **Support Admin** is offered *no* account lifecycle action; they may read an account and work
  a case.
- An **Operations Admin** is offered suspend, block, cancel and archive on an active account.
- An **invalid transition is refused for every role, Super Admin included.**
- An explicit grant may **narrow** a role and never widen it — a client that could widen it would
  be granting itself authority.

---

## 3. Capability matrix

Legend — **Represented**: a native surface exists. **Read**: it shows real data.
**Mutation**: an action contract exists.

| Web Admin capability | Web source | Shared service | Native destination | Represented | Read | Mutation |
|---|---|---|---|---|---|---|
| Admin role / permission model | `wewed-admin-policy.ts` | ✅ exists | `AdminPolicy` (both platforms) | ✅ | ✅ contract | n/a |
| Account lifecycle rules | `wewed-admin-policy.ts` | ✅ exists | `AdminAuthorization` | ✅ | ✅ contract | ⬜ |
| Account governance | `/api/admin/governance` | partial | Accounts | ⬜ | ⬜ | ⬜ |
| Onboarding queue | `/api/admin/onboarding` | partial | Cases, More | ⬜ | ⬜ | ⬜ |
| Roles & scopes | `/api/admin/roles` | partial | Accounts → Roles | ⬜ | ⬜ | ⬜ |
| Planner profiles | `/api/admin/planner-profiles` | partial | Cases, More | ⬜ | ⬜ | ⬜ |
| Provider claims | `/api/admin/providers/claims` | partial | Cases | ⬜ | ⬜ | ⬜ |
| Provider activation | `/api/admin/providers/activate` | partial | Cases | ⬜ | ⬜ | ⬜ |
| Client operations | `/api/admin/client-operations` | partial | More → Client Systems | ⬜ | ⬜ | ⬜ |
| Service engagements | `/api/admin/service-engagements` | partial | More → Service Records | ⬜ | ⬜ | ⬜ |
| Transaction governance | `/api/admin/transaction-governance` | partial | More → Transactions | ⬜ | ⬜ | ⬜ |
| Bookings | `/api/admin/bookings` | partial | More | ⬜ | ⬜ | ⬜ |
| Financial contributions | `/api/admin/contributions/analytics` | partial | More | ⬜ | ⬜ | ⬜ |
| Integration health | `/api/admin/integrations/health` | ✅ service | More → System Health | ⬜ | ⬜ | n/a |
| Command centre / overview | `/api/admin/overview`, `command-center` | ✅ route-core | Dashboard | ⬜ | ⬜ | n/a |
| Audit (`AuditEvent`) | production table | — | Audit | ✅ | ⚠️ gated | n/a |
| Audit (`BusinessAuditLog`) | production table | — | Audit | ⬜ | 🚫 denied | n/a |
| Notebook | `/admin/notebook` | — | More | ⬜ | ⬜ | ⬜ |
| Messages | admin console | — | More / Cases | ⬜ | ⬜ | ⬜ |

**No `/api/mobile/admin/*` contracts exist yet.** The architecture the addendum asks for — one
shared service layer behind both a web and a mobile Admin API — is the right shape, and
`wewed-admin-policy.ts` and `admin-command-center-route-core.ts` show the codebase already moving
that way. Extracting the remaining route bodies into shared services is the next unit of work.

---

## 4. The three states, kept distinct

Collapsing these is what made a missing grant look like a missing product.

| State | Means | Native wording |
|---|---|---|
| **Authorization required** | The rows exist; this reader may not read them | "not authorized for this reader", naming the denied domains |
| **Zero rows** | Production genuinely holds none | "Nothing recorded" |
| **Unsupported** | No product capability exists at all | "no native contract exists" |

Admin → Audit already does this correctly and now resolves its access context from the
system-scoped source, so a global administrative session reports the blocker rather than
"Nothing recorded" while production holds 275 wedding-scoped audit rows.

---

## 5. External blocker

`wewed_shadow_reader` is denied `SupportCase`, `BusinessAuditLog`, `PlannerShortlist` and
`ProviderEnquiry`, and sees no `BusinessAccount` rows. Four `role='admin'` users are visible, but
the Admin registry, roles and scopes are not.

**The real corporate Admin identity, role, permission set and account scope therefore cannot be
resolved, and no Admin management surface can be built against real data until that grant exists.**
Nothing is fabricated in its place.

Required: a read-only grant covering `BusinessAccount`, `BusinessAccountMember`,
`PlatformAdministrator`, `PlatformAdministratorScope`, `SupportCase`, `BusinessAuditLog`,
`ProviderProfile` and `ProviderClaim`.

---

## 6. Write gating

| Environment | Reads | Mutations |
|---|---|---|
| `PRIVATE_REAL_SHADOW` | real production-derived | shadow overlay only, never written back |
| `PRODUCTION_READ_VERIFY` | real production | **all management mutations disabled** |
| `CONTROLLED_PRODUCTION_WRITE_UAT` | real production | explicitly approved operations only |

Production Admin writes are **OFF** and no mutation path exists. The authorization model is in
place first, deliberately: it decides what may be offered before anything can be performed.
