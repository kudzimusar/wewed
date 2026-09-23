import Foundation
import Combine

/// Couple Level-1 destinations, mirroring the IA V2 couple taxonomy
/// (Home | Plan | Guests | Wedding Day | More).
///
/// `destinationId` ties each tab to the shared navigation contract so deep links resolve to a
/// contract destination rather than a screen name.
public enum AppTab: String, CaseIterable, Identifiable, Sendable {
    case home = "Home"
    case plan = "Plan"
    case guests = "Guests"
    case weddingDay = "Wedding Day"
    case more = "More"

    public var id: String { rawValue }

    public var destinationId: String {
        switch self {
        case .home: return "home"
        case .plan: return "plan"
        case .guests: return "guests"
        case .weddingDay: return "wedding_day"
        case .more: return "more"
        }
    }

    public static func from(destinationId: String) -> AppTab {
        allCases.first { $0.destinationId == destinationId } ?? .home
    }

    public var systemImage: String {
        switch self {
        case .home: return "heart.fill"
        case .plan: return "checklist"
        case .guests: return "person.2.fill"
        case .weddingDay: return "sparkles"
        case .more: return "line.3.horizontal"
        }
    }
}

/// Master plan Phase 8 closure round 3 §4/§5, hardened round 4 §1/§2 — one repository domain, three
/// states: never bound at all in this process (`.unbound`), or bound to a specific, verified
/// `(accessUserId, grantId[, engagementId])` key (`.bound`). A `grantId` string alone is not account-
/// scoped — two different accounts can independently resolve an identical grant id (`admin:system`,
/// or `coordinator:wedding:<id>` for a wedding both genuinely have separate memberships on) — so
/// comparing `grantId` alone cannot tell "this is still Account A's binding" apart from "Account B's
/// grantId happens to coincide". Carrying `accessUserId` in the same key makes that structurally
/// impossible: two different accounts never share one, so a stale binding can never satisfy a fresh
/// account's requirement by coincidence. `engagementId` extends the same discipline one level further
/// for the ONE domain where a single `(accessUserId, grantId)` pair can legitimately serve more than
/// one live value: a Vendor's `vendor:wedding:...` grant may carry several `serviceEngagementIds`, so
/// the engagement actually selected is part of the binding identity too, not just an argument baked
/// into the bound value.
public enum ProductionBinding<T> {
    case unbound
    case bound(accessUserId: String, grantId: String, value: T, engagementId: String?)

    /// True only when this binding is confirmed bound to EXACTLY this account+grant pair. This is
    /// the render gate's check (`RootView.authorizedShell`): the snapshot looking right is necessary
    /// but not sufficient — this proves the swap from `.unbound` to a real bound value has actually
    /// completed, for THIS account, not merely for a grant id that coincides with a previous
    /// account's stale binding. It deliberately does not compare `engagementId` — the Vendor render
    /// gate compares that separately (see `RootView.isProductionBindingCurrent`), since every other
    /// domain leaves it `nil` and has nothing to compare.
    public func isCurrent(accessUserId: String?, grantId: String?) -> Bool {
        guard case let .bound(boundAccessUserId, boundGrantId, _, _) = self else { return false }
        return boundAccessUserId == accessUserId && boundGrantId == grantId
    }
}

/// Master plan Phase 8 closure round 4 §1 — thrown when a production role shell (or anything else)
/// reads a mature-domain repository property before `ProductionBinding.bound` exists for that domain.
/// This is deliberately NOT the same type `ProductionReadOnlyDomainError` uses for "a bound
/// repository's live call just failed" — those are different facts (never bound vs. bound-but-
/// failing), and the render gate in `RootView.swift` is what is supposed to make this error
/// unreachable in practice by waiting for `ProductionBinding.bound` before ever composing a role
/// shell; reaching this error at all means that gate has a bug, not that a network call failed.
public struct ProductionRepositoryUnbound: Error, Equatable, Sendable {
    public let domain: String

    public init(domain: String) {
        self.domain = domain
    }
}

extension ProductionRepositoryUnbound: LocalizedError {
    public var errorDescription: String? {
        "This production \(domain) repository is not yet bound to a verified account and grant. " +
            "A role shell must wait for ProductionBinding.bound before reading it."
    }
}

public final class AppState: ObservableObject, @unchecked Sendable {
    @Published public var selectedTab: AppTab = .home
    @Published public var isOffline: Bool = false
    @Published public var pendingSyncCount: Int = 0
    @Published public var lastSyncTime: Date? = nil
    @Published public var pendingInvitationDeepLink: InvitationDeepLink? = nil
    /// A parsed but *unauthorized* route request. The root resolves it through `DeepLinkRouter`
    /// against the active role and context; parsing alone never navigates.
    @Published public var pendingRouteDeepLink: NativeDeepLink? = nil

    /// The wedding every graph read is scoped to (P0-1).
    ///
    /// Bound once by the root from the resolved NavigationContext. Deliberately not defaulted: an
    /// unbound state cannot read a wedding graph at all, so no view can rely on an ambient fallback.
    @Published public private(set) var activeWeddingId: String?

    public let dataEnvironment: NativeDataEnvironment
    public let dataBaseURL: URL?
    /// Nil by default. Isolated integration builds/tests may inject a manifest-backed runtime.
    public let weddingDayGate: WeddingDayGateOperations?

    // Fixed for the app's lifetime outside PRODUCTION — nothing below changes Shadow/Fixture/
    // PRIVATE_REAL_SHADOW behavior at all.
    private let nonProductionRepository: WeddingRepositoryProtocol
    private let nonProductionPlannerRepository: PlannerDashboardRepositoryProtocol
    private let nonProductionAdminRepository: AdminSystemRepositoryProtocol
    private let nonProductionContractsRepository: ContractsRepositoryProtocol = EmptyContractsRepository()
    private let nonProductionVendorEngagementRepository: VendorEngagementRepositoryProtocol = EmptyVendorEngagementRepository()

    /// Master plan Phase 8 closure round 3 §4/§5 (NativeRepositoryFactory.PRODUCTION closure).
    ///
    /// PRODUCTION no longer represents "unbound" merely by defaulting to a `ProductionBoundary*
    /// Repository` instance that is, by its type, indistinguishable from a real one sitting behind
    /// `repository`/`plannerRepository`/`adminRepository`. `.unbound` is now the explicit,
    /// type-checked default, and the computed properties below derive their value from it on every
    /// read rather than being separately-mutated stored properties that could in principle drift out
    /// of sync with each other or with a same-shaped `boundXGrantId` flag. See `ProductionBinding`'s
    /// own doc for why the key is `(accessUserId, grantId)`, not `grantId` alone.
    @Published public private(set) var productionWeddingBinding:
        ProductionBinding<(wedding: WeddingRepositoryProtocol, planner: PlannerDashboardRepositoryProtocol)> = .unbound

    @Published public private(set) var productionAdminBinding: ProductionBinding<AdminSystemRepositoryProtocol> = .unbound

    /// Master plan Phase 8 closure round 3 §3 — same binding discipline, for Contracts/Deal-Room.
    @Published public private(set) var productionContractsBinding: ProductionBinding<ContractsRepositoryProtocol> = .unbound

    /// Master plan Phase 8 closure round 3 §6 — same binding discipline, for the Vendor's own wedding engagement.
    @Published public private(set) var productionVendorEngagementBinding: ProductionBinding<VendorEngagementRepositoryProtocol> = .unbound

    /// The repository a role shell actually reads. Master plan Phase 8 closure round 4 §1 — while
    /// `productionWeddingBinding` is `.unbound`, this THROWS `ProductionRepositoryUnbound` rather
    /// than handing back a same-typed boundary placeholder: a caller cannot obtain a
    /// `WeddingRepositoryProtocol` value at all until a real binding exists, so "unbound" can never
    /// be mistaken for "bound to something that happens to always fail". `RootView`'s render gate
    /// waits for the confirmed binding before any role shell is composed, so this is not expected to
    /// ever actually throw in normal operation — reaching it means that gate has a bug. Every other
    /// environment always returns the same constructor-supplied repository, unchanged.
    public var repository: WeddingRepositoryProtocol {
        get throws {
            if dataEnvironment == .production {
                if case let .bound(_, _, value, _) = productionWeddingBinding { return value.wedding }
                throw ProductionRepositoryUnbound(domain: "wedding")
            }
            return nonProductionRepository
        }
    }

    public var plannerRepository: PlannerDashboardRepositoryProtocol {
        get throws {
            if dataEnvironment == .production {
                if case let .bound(_, _, value, _) = productionWeddingBinding { return value.planner }
                throw ProductionRepositoryUnbound(domain: "planner")
            }
            return nonProductionPlannerRepository
        }
    }

    /// Master plan Phase 8 closure §B/§12, hardened round 4 §1 — never `ShadowAdminSystemRepository`
    /// in production, and never a same-typed boundary placeholder either; throws
    /// `ProductionRepositoryUnbound` while unbound. Non-production keeps the existing Shadow-over-
    /// wedding-graph behavior unchanged.
    public var adminRepository: AdminSystemRepositoryProtocol {
        get throws {
            if dataEnvironment == .production {
                if case let .bound(_, _, value, _) = productionAdminBinding { return value }
                throw ProductionRepositoryUnbound(domain: "admin")
            }
            return nonProductionAdminRepository
        }
    }

    /// Master plan Phase 8 closure round 3 §3, hardened round 4 §1 — Contracts/Deal-Room, same pattern as Admin.
    public var contractsRepository: ContractsRepositoryProtocol {
        get throws {
            if dataEnvironment == .production {
                if case let .bound(_, _, value, _) = productionContractsBinding { return value }
                throw ProductionRepositoryUnbound(domain: "contracts")
            }
            return nonProductionContractsRepository
        }
    }

    /// Master plan Phase 8 closure round 3 §6, hardened round 4 §1/§2 — the Vendor's own wedding
    /// engagement, same pattern. `productionVendorEngagementBinding`'s own `engagementId` associated
    /// value additionally exposes WHICH engagement is currently bound, so `RootView`'s render gate
    /// can confirm it matches the one actually selected before treating this repository as current.
    public var vendorEngagementRepository: VendorEngagementRepositoryProtocol {
        get throws {
            if dataEnvironment == .production {
                if case let .bound(_, _, value, _) = productionVendorEngagementBinding { return value }
                throw ProductionRepositoryUnbound(domain: "vendor engagement")
            }
            return nonProductionVendorEngagementRepository
        }
    }

    /// Master plan Phase 8 — rebinds this app state's domain repositories to real, grant-scoped
    /// production adapters once a wedding-scoped grant is active, and `accessUserId` to the account
    /// that resolved them. Only ever called for `dataEnvironment == .production`; every other
    /// environment keeps its constructor-supplied repositories for the whole app lifetime, exactly as
    /// before. The Wedding Day gate wrapper, if any, is preserved around the new base repository so
    /// operational fail-closed behavior is unchanged.
    public func bindProductionRepositories(
        accessUserId: String,
        grantId: String,
        wedding: WeddingRepositoryProtocol,
        planner: PlannerDashboardRepositoryProtocol
    ) {
        precondition(
            dataEnvironment == .production,
            "bindProductionRepositories is only valid for the PRODUCTION environment."
        )
        let gated: WeddingRepositoryProtocol
        if let weddingDayGate {
            gated = WeddingDayGateAwareRepository(base: wedding, gate: weddingDayGate)
        } else {
            gated = wedding
        }
        productionWeddingBinding = .bound(accessUserId: accessUserId, grantId: grantId, value: (wedding: gated, planner: planner), engagementId: nil)
    }

    /// Master plan Phase 8 closure §B/§1 — rebinds Admin to a real, grant-scoped production adapter.
    public func bindProductionAdminRepository(accessUserId: String, grantId: String, _ admin: AdminSystemRepositoryProtocol) {
        precondition(
            dataEnvironment == .production,
            "bindProductionAdminRepository is only valid for the PRODUCTION environment."
        )
        productionAdminBinding = .bound(accessUserId: accessUserId, grantId: grantId, value: admin, engagementId: nil)
    }

    /// Master plan Phase 8 closure round 3 §3 — rebinds Contracts to a real, grant-scoped adapter.
    public func bindProductionContractsRepository(accessUserId: String, grantId: String, _ contracts: ContractsRepositoryProtocol) {
        precondition(
            dataEnvironment == .production,
            "bindProductionContractsRepository is only valid for the PRODUCTION environment."
        )
        productionContractsBinding = .bound(accessUserId: accessUserId, grantId: grantId, value: contracts, engagementId: nil)
    }

    /// Master plan Phase 8 closure round 3 §6, hardened round 4 §2 — rebinds the Vendor's own
    /// wedding engagement. `engagementId` is part of the binding key (not just baked into
    /// `engagement`'s own closure) because one `(accessUserId, grantId)` pair can legitimately serve
    /// more than one engagement — a Vendor's grant may carry several `serviceEngagementIds` — so
    /// switching the SELECTED engagement while the grant id stays the same must still be a
    /// distinguishable rebind, not something the render gate could mistake for "nothing changed".
    public func bindProductionVendorEngagementRepository(
        accessUserId: String,
        grantId: String,
        engagementId: String?,
        _ engagement: VendorEngagementRepositoryProtocol
    ) {
        precondition(
            dataEnvironment == .production,
            "bindProductionVendorEngagementRepository is only valid for the PRODUCTION environment."
        )
        productionVendorEngagementBinding = .bound(accessUserId: accessUserId, grantId: grantId, value: engagement, engagementId: engagementId)
    }

    /// Master plan Phase 8 closure round 3 §4 — explicit, synchronous clear for sign-out/session-
    /// invalidation/account replacement, so no bound repository (and the bearer token closed over
    /// inside it) is reachable any longer than necessary. The `(accessUserId, grantId)` key on
    /// `.bound` already makes a stale binding harmless for a *different* account by construction even
    /// without this — but this drops the actual objects rather than leaving them reachable in memory,
    /// and covers the same-account "authority became unusable" case too.
    public func clearProductionBinding() {
        guard dataEnvironment == .production else { return }
        productionWeddingBinding = .unbound
        productionAdminBinding = .unbound
        productionContractsBinding = .unbound
        productionVendorEngagementBinding = .unbound
    }

    public func bindActiveWedding(_ weddingId: String) {
        activeWeddingId = weddingId.isEmpty ? nil : weddingId
    }

    /// The only way a view reads the wedding graph. Throws if no wedding is bound, and
    /// `forWedding` rejects a wedding this source does not serve.
    public func scopedRepository() async throws -> ScopedWeddingRepository {
        guard let weddingId = activeWeddingId else {
            throw WeddingScopeMismatch(requestedWeddingId: "<unbound>", availableWeddingIds: [])
        }
        return try await repository.forWedding(weddingId)
    }

    /// A launch that looked like an invitation and is refused.
    ///
    /// Held as its own state rather than dropped, because failing closed has to be *visible*. An
    /// invalid or expired link that silently does nothing looks identical to the app opening as
    /// whoever was already signed in — which is exactly the confusion that lets the wrong person's
    /// invitation appear.
    @Published public var rejectedInvitation: InvitationRejection?

    public func clearRejectedInvitation() {
        rejectedInvitation = nil
    }

    /// The invitation entry this launch carries, waiting to be exchanged.
    ///
    /// Both credential-bearing shapes travel through here — a private link and an opaque handoff —
    /// because after exchange the two are indistinguishable and the coordinator treats them the
    /// same. The handoff in particular used to be recognised and then dropped on the floor, so the
    /// parser tests passed while the app never redeemed it. Carrying it as state is what makes the
    /// journey completable.
    @Published public var pendingInvitationEntry: InvitationEntry?

    /// Consumed by the coordinator once, so a re-render cannot replay an exchange.
    public func consumePendingInvitationEntry() -> InvitationEntry? {
        let entry = pendingInvitationEntry
        pendingInvitationEntry = nil
        return entry
    }

    public func handleIncomingURL(_ url: URL) {
        // Invitation entry is resolved first and by its own parser, because it is the only launch
        // shape that carries a credential and the only one with refusals of its own.
        switch InvitationEntryParser.entry(from: url.absoluteString) {
        case let .rejected(reason):
            rejectedInvitation = reason
            pendingInvitationEntry = nil
            pendingInvitationDeepLink = nil
            pendingRouteDeepLink = nil
            return
        case let .handoff(secret):
            // Handed to the coordinator to redeem. It names nobody here, so there is nothing to
            // route on yet — but it must not be dropped, which is what used to happen.
            rejectedInvitation = nil
            pendingInvitationEntry = .handoff(secret: secret)
            pendingRouteDeepLink = nil
            return
        case let .privateInvitation(slug, token):
            rejectedInvitation = nil
            pendingInvitationEntry = .privateInvitation(weddingSlug: slug, rsvpToken: token)
        case .none:
            break
        }

        guard let deepLink = NativeDeepLinkParser.parse(url.absoluteString) else { return }

        switch deepLink {
        case .invitation(let invitation):
            pendingInvitationDeepLink = invitation
            pendingRouteDeepLink = nil
            selectedTab = .home
        case .pass:
            pendingInvitationDeepLink = nil
            pendingRouteDeepLink = deepLink
            selectedTab = .weddingDay
        case .wedding:
            pendingInvitationDeepLink = nil
            pendingRouteDeepLink = deepLink
            selectedTab = .home
        case .workspace:
            // Held unresolved: the root gates it against role/context before navigating.
            pendingInvitationDeepLink = nil
            pendingRouteDeepLink = deepLink
        }
    }


    /// Master plan Phase 8 closure round 4 §1 — a `.productionBootstrap` outcome carries no
    /// wedding/planner repository at all; `AppState` is constructed with the ordinary Fixture
    /// defaults (never read for PRODUCTION — see `repository`/`plannerRepository` above, which
    /// switch on `dataEnvironment` before ever consulting the constructor-supplied values), and
    /// every mature repository property throws `ProductionRepositoryUnbound` until a real
    /// `ProductionBinding.bound` exists.
    public static func make(
        environment: NativeDataEnvironment,
        baseURL: URL? = nil
    ) throws -> AppState {
        switch try NativeRepositoryFactory.make(environment: environment, baseURL: baseURL) {
        case let .nonProduction(wedding, planner, outcomeEnvironment, outcomeBaseURL):
            return AppState(
                repository: wedding,
                plannerRepository: planner,
                dataEnvironment: outcomeEnvironment,
                dataBaseURL: outcomeBaseURL
            )
        case let .productionBootstrap(outcomeBaseURL):
            return AppState(
                dataEnvironment: .production,
                dataBaseURL: outcomeBaseURL
            )
        }
    }

    public init(
        repository: WeddingRepositoryProtocol = FixtureWeddingRepository(),
        plannerRepository: PlannerDashboardRepositoryProtocol = FixturePlannerDashboardRepository(),
        dataEnvironment: NativeDataEnvironment = .fixture,
        dataBaseURL: URL? = nil,
        weddingDayGate: WeddingDayGateOperations? = nil
    ) {
        do {
            try NativeEnvironmentGuard.validate(baseURL: dataBaseURL, environment: dataEnvironment)
        } catch {
            preconditionFailure("Unsafe native data environment: \(error)")
        }

        self.nonProductionPlannerRepository = plannerRepository
        self.dataEnvironment = dataEnvironment
        self.dataBaseURL = dataBaseURL
        self.weddingDayGate = weddingDayGate
        if let weddingDayGate {
            self.nonProductionRepository = WeddingDayGateAwareRepository(base: repository, gate: weddingDayGate)
        } else {
            self.nonProductionRepository = repository
        }
        // Master plan Phase 8 closure round 3 §4/§5 — constructed unconditionally, matching
        // Android's `nonProductionAdminRepository`. Only ever read when `dataEnvironment != .production`
        // (the `adminRepository` computed property above never falls through to it for PRODUCTION),
        // so building it here regardless of environment changes no observable behavior.
        self.nonProductionAdminRepository = ShadowAdminSystemRepository(weddingRepository: self.nonProductionRepository, environment: dataEnvironment)
    }
}
