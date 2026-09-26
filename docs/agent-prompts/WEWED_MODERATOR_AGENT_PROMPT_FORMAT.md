# WEWED — MODERATOR → AGENT TASK FORMAT

Status: **AUTHORITATIVE COMMUNICATION FORMAT**

Purpose: give every implementation, research and certification agent a direct task with no need to rediscover project direction.

This file defines structure only. Task content changes by phase.

---

# MODERATOR → <AGENT ID> — <EXACT TASK TITLE>

Repository:

`kudzimusar/wewed`

Authoritative branch/base:

`<branch>`

Required starting SHA:

`<sha>`

Relevant accepted dependency:

`<branch / sha / plan id>`

## Moderator disposition

`<ONE-LINE STATUS / WHY THIS AGENT IS RELEASED>`

State:

- what has already been accepted;
- what remains open;
- why this agent owns the next unit;
- what this task does **not** reopen.

Do not ask the agent to rediscover the programme.

---

# 1. Exact authorized mission

State the exact outcome.

Use one sentence whenever possible.

Example form:

`<input authority> → <implementation action> → <required resulting authority>`

State what success means.

State what is explicitly outside scope.

---

# 2. Required pre-edit verification

Before changing source, require the agent to prove:

- remote branch still exists;
- remote tip still equals the expected SHA;
- required dependencies still exist;
- working tree is safe where local execution is involved;
- no unexpected operator/agent already changed the target state.

If authority drift is found:

**STOP BEFORE MUTATION.**

Record the drift and return it to the moderator.

Do not overwrite unexpected state blindly.

---

# 3. Frozen architecture and product rules

List decisions the agent may not redesign.

Examples:

- source of truth;
- identity authority;
- security boundary;
- navigation authority;
- data model authority;
- credential authority;
- branch topology;
- UX terminology;
- production policy.

Use explicit:

`DO NOT`

statements for high-risk deviations.

---

# 4. Required investigation

For implementation agents, require root-cause investigation before changing code.

For research agents, state exact questions.

For certification agents, state exact surfaces and failure hypotheses.

Every material conclusion must be tied to:

- source path;
- runtime evidence;
- database authority;
- API response;
- test evidence;
- screenshot/artifact;

as applicable.

---

# 5. Required implementation

State files/domains the agent is expected to modify.

State the intended authority flow.

State non-negotiable behavior.

Do not prescribe arbitrary implementation details where source investigation may reveal a safer implementation.

Do prescribe exact invariants.

---

# 6. Data and security requirements

Explicitly identify:

- real-data reads allowed;
- real-data writes allowed;
- production writes forbidden;
- credentials that must never appear in logs;
- bearer tokens that must not be printed;
- database mutations that require owner authorization;
- preview/UAT boundaries;
- rollback/restoration requirements.

---

# 7. Qualification requirements

State mandatory tests.

Examples:

- unit;
- integration;
- browser;
- iOS build;
- Android build;
- simulator;
- device;
- live parity;
- database assertions.

Require exact:

- run ID;
- job ID;
- tested SHA;
- result;
- post-qualification diff.

A successful build without the required behavioral proof is insufficient.

---

# 8. Runtime / visual proof

Where relevant, specify:

- exact device;
- viewport;
- URL/origin;
- account/wedding context;
- screenshots;
- logs;
- parity records;
- interaction sequence.

Tell the agent which evidence is implementation evidence and which proof must still be independently certified later.

---

# 9. Failure classifications

Define the classifications relevant to the task.

Example:

**P0** — identity/security/wrong authority/data corruption/admission bypass.

**P1** — release corridor unusable or systems disagree on canonical state.

**P2** — material but non-blocking operational/UX discrepancy.

**P3** — cosmetic.

**ENV** — independently proven tooling/environment problem.

Agents must not use vague terms such as:

`mostly passes`

for required gates.

---

# 10. Required receipt

Require:

- starting branch;
- starting SHA;
- final branch;
- final SHA;
- changed files;
- root cause;
- tests;
- CI;
- runtime evidence;
- database reads/writes;
- rollback/restoration;
- unresolved items;
- confirmation of forbidden actions not performed.

No raw secrets or bearer credentials.

---

# 11. Documentation closure

Tell the agent whether to:

- update an existing plan/receipt;
- create a new receipt;
- leave documentation to the moderator.

Historical blocked/failed checkpoints are preserved.

Do not silently rewrite programme history.

---

# 12. Safety freeze

List everything forbidden during this unit.

Typical examples:

- merge to main;
- production deploy;
- production migration;
- production key rotation;
- release-store publication;
- destructive production data mutation;
- bulk communication send;
- unapproved architecture redesign;
- unrelated phase work.

---

# 13. Stop conditions

Return to moderator rather than improvising if the task requires:

- unavailable production credentials;
- owner approval for destructive/live mutation;
- signing/store authority;
- genuine product/security choice;
- unexpected authoritative-state drift.

Ordinary repository gaps inside the assigned scope belong to the implementation agent.

---

# 14. Other-agent disposition

State which agents/workstreams are:

`ACTIVE`

`PARKED`

`FROZEN`

`NOT RELEASED`

This prevents parallel agents from unknowingly reopening accepted authority.

---

# 15. Completion disposition

Give the agent exact allowed final lines.

Example success:

`<AGENT ID> <TASK> COMPLETE — RETURNING TO MODERATOR FOR INDEPENDENT REVIEW.`

Example failure:

`<AGENT ID> <TASK> BLOCKED — RETURNING TO MODERATOR WITH EVIDENCE.`

Certification agents use:

`PASSED — RETURNING CONTROL TO MODERATOR`

or:

`FAILED — RETURNING CONTROL TO MODERATOR`

Agents do not release the next phase themselves.

---

# Moderator operating rule

The normal sequence is:

`implementation/research agent`

→ `moderator independent review`

→ `moderator ordinary closure patch if needed`

→ `local independent certification`

→ `moderator acceptance`

→ `next progressive unit`.

The moderator must not replace the primary implementation agent by implementing the assigned unit first.


## Mandatory continuity / follow-up task rule

A moderator review is **not complete** when it ends only with a verdict.

After every implementation, research, certification or environment-agent return, the moderator must do all of the following in the same review cycle:

1. independently review and classify the returned claims;
2. close any ordinary bounded gap the moderator is authorized to close;
3. identify the exact next progressive unit from the authoritative programme order;
4. **write and issue the full next-agent prompt immediately** using this format;
5. record the next task in repository documentation where the programme uses repository task files;
6. explicitly state which later phases remain blocked/not released.

The default completion sequence is therefore:

`agent return`
→ `moderator independent review`
→ `moderator disposition`
→ `ordinary closure if needed`
→ **`next-agent task created + prompt issued immediately`**
→ `next agent executes`.

The moderator must **not** stop at:

- `ACCEPTED`;
- `PARTIALLY ACCEPTED`;
- `NOT PROVEN`;
- `BLOCKED-ENV`;
- `BLOCKED-ACTIVATION`;
- a certification PASS/FAIL;

without also issuing the next actionable task.

### External-blocker exception

The only time a moderator may end without releasing an executable next agent unit is when the next progressive action genuinely requires an external input or authority that no agent can obtain safely, such as:

- owner-provided credentials or invitation material unavailable to any authorized secure source;
- destructive/live production action requiring owner approval;
- store/release signing authority;
- unavailable local signed-device tooling;
- a genuine architecture/product/security decision requiring the owner.

Even then, the moderator must still issue a **blocker-resolution task/prompt** that states:

- the exact missing input;
- who/what can supply it;
- the secure handoff method;
- what the next agent should do immediately once it becomes available;
- all safety boundaries that remain frozen.

A moderator must never leave the programme with only “tell me when ready” or “the next step is X.”

### Prompt delivery requirement

Whenever the moderator releases a next progressive unit, the moderator must:

- create/update its repository task file where applicable; **and**
- include the actual follow-up prompt in the moderator response so it can be handed directly to the next agent without rediscovery.

This continuity rule is part of the moderator operating model and applies to every future Wewed phase unless the owner explicitly overrides it.
