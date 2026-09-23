package pro.wewed.app.services

/**
 * Master plan Phase 8 closure round 4 §1 — thrown by every production repository's live call on
 * any non-success fetch (transport failure, permission denial, session-invalid, grant revocation).
 *
 * This is deliberately distinct from [ProductionRepositoryUnbound] (`AppState.kt`): that one means
 * "no repository has been bound to this domain yet" and is thrown by `AppViewModel`'s computed
 * repository properties themselves, before any repository object — real or otherwise — is
 * reachable. This one means "a real, bound repository's live call just failed." Collapsing the two
 * into one nulled-out placeholder object was the exact defect Phase 8 closure round 4 removed: it
 * made "never bound" indistinguishable from "fetched and failed" and from "fetched and genuinely
 * empty". `ProductionBoundaryWeddingRepository`/`ProductionBoundaryPlannerRepository` — the
 * same-typed placeholder objects that used to stand in for "unbound" — are deleted; PRODUCTION now
 * carries no wedding/planner repository at all until a real bind occurs (`NativeRepositoryFactory.kt`,
 * `AppState.kt`).
 */
class ProductionReadOnlyDomainUnavailable :
    IllegalStateException("This production domain is not enabled until the read-only adapter explicitly serves it.")
