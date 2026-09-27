# QRO03-CLEAN01 — Retire Temporary Charity & Kudzie Writable Preview

## Repository
`kudzimusar/wewed`

## Role
You are the environment/safety closure agent.

Do not change product/test source.

Do not mutate wedding business data.

Do not begin QRO04 Pass/Gate work.

## Moderator decision
**D-082 — QRO03 end-to-end RSVP convergence accepted; one writable Preview retirement remains before QRO04**

## Exact target

Delete/retire exactly this temporary QRO03 writable Preview deployment, and no other deployment:

`dpl_q6QdpTUsP1BHtSnAhiMheu2YWNVu`

Unique URL:

`wewed-q3hssjdtx-11-11.vercel.app`

Source:

`fadc62feaa11acc69a3bf1aa4fdb428255c4f37d`

This deployment was deliberately built with branch-scoped:

`WEWED_PREVIEW_WRITABLE_WEDDING_ID=<Charity & Kudzie wedding id>`

and therefore remains writable at its immutable URL even though the environment entry has since been removed.

## HARD OWNER-AUTHORIZATION GATE

Deployment deletion is destructive.

**Do not delete anything until the owner explicitly authorizes deletion of this exact deployment.**

Required authorization scope must be equivalent to:

`I authorize permanent deletion of dpl_q6QdpTUsP1BHtSnAhiMheu2YWNVu only.`

Authorization for this deployment does NOT authorize:
- deletion of the 313 PR202 synthetic-UAT deployments;
- deletion of the read-only integration deployment;
- deletion of production;
- deletion of logs/artifacts elsewhere;
- any wedding-data mutation.

If explicit authorization is absent, STOP and return:

`QRO03-CLEAN01 BLOCKED-APPROVAL — destructive deletion of dpl_q6QdpTUsP1BHtSnAhiMheu2YWNVu requires owner authorization — RETURNING TO MODERATOR.`

## Pre-delete evidence preservation

After owner authorization but before deletion:

1. verify exact deployment ID, URL, source SHA and Preview target;
2. verify it is not Production;
3. verify it is not the current integration branch alias target;
4. record safe metadata in the QRO03 receipt or a cleanup receipt;
5. preserve the already-needed runtime facts:
   - exactly two C&K RSVP PUT 200s;
   - restoration occurred;
   - two other-wedding 423 probes;
   - no production qualification traffic;
6. do not print environment values, session secrets, Guest credentials or private invitation URLs.

Do not create a new writable deployment merely to test deletion.

## Destructive action

After the explicit owner authorization and pre-delete evidence capture:

- permanently delete only:
  `dpl_q6QdpTUsP1BHtSnAhiMheu2YWNVu`.

Use authorized Vercel account/CLI tooling.

Do not delete:
- `dpl_GLSWXAcNX3uQp7XAu6DXGz5C1xKT`;
- the current integration alias target;
- `dpl_ApFS83c3F2MtqNFvCQEF8Pdg1UwL` production;
- historical PR202 deployments.

## Post-delete proof

Prove:

1. lookup of deployment ID `dpl_q6QdpTUsP1BHtSnAhiMheu2YWNVu` no longer resolves as an active deployment;
2. unique URL `wewed-q3hssjdtx-11-11.vercel.app` no longer serves the application;
3. current integration branch alias still resolves to a READY read-only deployment;
4. current integration source still includes QRO03 receipt history;
5. no `WEWED_PREVIEW_WRITABLE_WEDDING_ID` entry exists for the integration branch;
6. a safe C&K RSVP write probe against the current integration Preview still returns:
   `423 PREVIEW_WRITE_BLOCKED`;
7. production remains untouched.

## Receipt

Create/update:

`docs/QRO03_CLEAN01_WRITABLE_PREVIEW_RETIREMENT_RECEIPT_20260927.md`

Include:
- owner-authorization statement category (do not include unrelated personal data);
- deleted deployment ID only;
- source SHA;
- pre-delete non-secret metadata;
- deletion command/action result;
- post-delete lookup result;
- post-delete URL result;
- current read-only integration deployment ID/URL/SHA;
- final 423 proof;
- production unchanged proof;
- business-data writes = 0;
- other deployments deleted = 0;
- secret scan.

## Safety freeze

Do not:
- mutate C&K business data;
- modify source;
- delete PR202 deployments;
- deploy production;
- merge integration to main;
- activate Wedding Day;
- issue/revoke Passes;
- perform Gate actions;
- publish native apps.

## Completion

Success:
`QRO03-CLEAN01 TEMPORARY C&K WRITABLE PREVIEW RETIRED — CURRENT INTEGRATION PREVIEW READ-ONLY — 0 BUSINESS-DATA WRITES — RETURNING TO MODERATOR FOR QRO04 RELEASE.`

Blocked:
`QRO03-CLEAN01 BLOCKED-APPROVAL — destructive deletion of dpl_q6QdpTUsP1BHtSnAhiMheu2YWNVu requires owner authorization — RETURNING TO MODERATOR.`
