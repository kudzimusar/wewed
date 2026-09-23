import Foundation

/// A verified relationship between an actor and the scope it may operate in (P0-2).
///
/// This is the authority for "is this actor actually the planner for this wedding / the vendor on
/// this engagement / the usher on this gate / this guest". A role alone never answers that.
///
/// Assignments come from an `ActorAssignmentSource`; no view or root may construct one to make a
/// workspace open. That is what stops fabricated client/gate/engagement context (P0-3).
public struct ActorAssignment: Equatable, Sendable {
    public let actorId: String
    public let role: AppRole
    /// The wedding this assignment is for. Nil only for system-scope roles.
    public let weddingId: String?
    public let clientId: String?
    /// The vendor company this actor belongs to. Distinct from `engagementId` (P0-9).
    public let vendorId: String?
    public let engagementId: String?
    public let gateId: String?
    /// Guest identity binding — which guest record this actor *is* (P0-4).
    public let guestId: String?
    /// The credential that authorises this actor's pass (P0-5).
    public let passToken: String?
    /// True when the relationship exists only as Shadow test authorisation rather than a real
    /// production engagement. Surfaces must say so instead of implying a live relationship (P0-13).
    public let isShadowTestAccess: Bool

    public init(
        actorId: String,
        role: AppRole,
        weddingId: String?,
        clientId: String? = nil,
        vendorId: String? = nil,
        engagementId: String? = nil,
        gateId: String? = nil,
        guestId: String? = nil,
        passToken: String? = nil,
        isShadowTestAccess: Bool = false
    ) {
        self.actorId = actorId
        self.role = role
        self.weddingId = weddingId
        self.clientId = clientId
        self.vendorId = vendorId
        self.engagementId = engagementId
        self.gateId = gateId
        self.guestId = guestId
        self.passToken = passToken
        self.isShadowTestAccess = isShadowTestAccess
    }

    /// System-scope assignments (Admin) are not tied to a single wedding.
    public var isSystemScope: Bool { role == .admin && weddingId == nil }
}

/// Supplies the assignments an actor actually holds.
public protocol ActorAssignmentSource: Sendable {
    func assignments(actorId: String) async -> [ActorAssignment]
}

/// An assignment source with no relationships at all — every scoped workspace is denied.
public struct EmptyActorAssignmentSource: ActorAssignmentSource {
    public init() {}
    public func assignments(actorId: String) async -> [ActorAssignment] { [] }
}

/// Chooses where assignments come from for an environment.
///
/// Shadow authority exists only where Shadow personas do. Production and production-read-verify
/// get a real `ProductionActorAssignmentSource` once a `ProductionAuthority` has actually been
/// fetched and verified server-side (master plan Phase 5); until then — no identity session, no
/// successful authority fetch yet — they still get `EmptyActorAssignmentSource`, so every scoped
/// workspace is denied rather than opened with Shadow test access. The root used to build the
/// Shadow source unconditionally (master plan §8.9).
///
/// Master plan Phase 8 closure round 5 — split into three narrowly-typed constructors on purpose.
/// The previous single `forEnvironment(_:repository:plannerRepository:...)` function required a
/// `WeddingRepositoryProtocol` argument for EVERY environment, including PRODUCTION, even though
/// `forProduction`/`empty` never read one. `RootView.resolveContext()` used to work around that by
/// passing `(try? appState.repository) ?? FixtureWeddingRepository()` — an invalid production
/// fallback that existed only because this API still demanded a repository parameter production
/// does not need. `forProduction` and `empty` have NO repository parameter at all, so it is not
/// possible for a caller to accidentally reintroduce that fallback by construction: there is
/// nothing to pass, and nothing this enum can misuse even if a caller wanted to. `forShadow` is the
/// only constructor that takes a repository, and only Shadow/dev-persona environments have one to
/// give it (`AppState`'s non-production repositories are always real and non-throwing, unlike
/// PRODUCTION's `get throws` properties).
public enum ActorAssignmentSources {
    /// Shadow/Fixture/dev-persona environments only — the repository is real and always available.
    public static func forShadow(
        repository: WeddingRepositoryProtocol,
        plannerRepository: PlannerDashboardRepositoryProtocol?,
        environment: NativeDataEnvironment
    ) -> ActorAssignmentSource {
        ShadowActorAssignmentSource(repository: repository, environment: environment, plannerRepository: plannerRepository)
    }

    /// PRODUCTION/PRODUCTION_READ_VERIFY once a `ProductionAuthority` has been fetched and verified. No repository is read or required.
    public static func forProduction(
        productionAuthority: ProductionAuthority,
        selectedGrantIds: Set<String> = [],
        selectedEngagementId: String? = nil
    ) -> ActorAssignmentSource {
        ProductionActorAssignmentSource(
            authority: productionAuthority,
            selectedGrantIds: selectedGrantIds,
            selectedEngagementId: selectedEngagementId
        )
    }

    /// No identity session yet, or no successful authority fetch yet. No repository is read or required.
    public static func empty() -> ActorAssignmentSource {
        EmptyActorAssignmentSource()
    }
}

/// Master plan Phase 8 closure round 5 — the exact pure decision `RootView.resolveContext()` makes,
/// extracted so it has a real executable unit test independent of SwiftUI. This is the ONLY place
/// `appState.repository`/`plannerRepository` may be read for the purpose of building an
/// `ActorAssignmentSource` — and only inside the branch where `AppState.dataEnvironment` allows
/// development persona switching. A caller passing a PRODUCTION `appState` (bound or not) never
/// reaches that branch, so `ProductionRepositoryUnbound` is structurally unreachable from here, and
/// no Fixture/Shadow fallback repository is ever constructed for it either.
public func resolveActorAssignmentSource(
    appState: AppState,
    productionAuthority: ProductionAuthority?,
    selectedGrantIds: Set<String>,
    selectedEngagementId: String?
) -> ActorAssignmentSource {
    if appState.dataEnvironment.allowsDevelopmentPersonaSwitching {
        return ActorAssignmentSources.forShadow(
            repository: try! appState.repository,
            plannerRepository: try? appState.plannerRepository,
            environment: appState.dataEnvironment
        )
    }
    if let productionAuthority {
        return ActorAssignmentSources.forProduction(
            productionAuthority: productionAuthority,
            selectedGrantIds: selectedGrantIds,
            selectedEngagementId: selectedEngagementId
        )
    }
    return ActorAssignmentSources.empty()
}

/// A fixed set of assignments, used by fixtures, Shadow provisioning and tests.
public struct StaticActorAssignmentSource: ActorAssignmentSource {
    private let all: [ActorAssignment]
    public init(_ all: [ActorAssignment]) { self.all = all }
    public func assignments(actorId: String) async -> [ActorAssignment] {
        all.filter { $0.actorId == actorId }
    }
}
