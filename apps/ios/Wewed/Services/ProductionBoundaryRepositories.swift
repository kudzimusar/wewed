import Foundation

/// Master plan Phase 8 closure round 4 §1 — thrown by every production repository's live call on
/// any non-success fetch (transport failure, permission denial, session-invalid, grant revocation).
///
/// This is deliberately distinct from `ProductionRepositoryUnbound` (`AppState.swift`): that one
/// means "no repository has been bound to this domain yet" and is thrown by `AppState`'s computed
/// repository properties themselves, before any repository object — real or otherwise — is
/// reachable. This one means "a real, bound repository's live call just failed." Collapsing the two
/// into one nulled-out placeholder object was the exact defect Phase 8 closure round 4 removed:
/// `ProductionBoundaryWeddingRepository`/`ProductionBoundaryPlannerRepository` — the same-typed
/// placeholder objects that used to stand in for "unbound" — are deleted; PRODUCTION now carries no
/// wedding/planner repository at all until a real bind occurs (`NativeRepositoryFactory.swift`,
/// `AppState.swift`).
public enum ProductionReadOnlyDomainError: Error, Equatable, Sendable {
    case unavailable
}
