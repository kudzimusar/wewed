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

    public let repository: WeddingRepositoryProtocol
    public let plannerRepository: PlannerDashboardRepositoryProtocol
    public let dataEnvironment: NativeDataEnvironment
    public let dataBaseURL: URL?
    /// Nil by default. Isolated integration builds/tests may inject a manifest-backed runtime.
    public let weddingDayGate: WeddingDayGateOperations?

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

    public static func make(
        environment: NativeDataEnvironment,
        baseURL: URL? = nil
    ) throws -> AppState {
        let bundle = try NativeRepositoryFactory.make(environment: environment, baseURL: baseURL)
        return AppState(
            repository: bundle.wedding,
            plannerRepository: bundle.planner,
            dataEnvironment: bundle.environment,
            dataBaseURL: bundle.baseURL
        )
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

        self.plannerRepository = plannerRepository
        self.dataEnvironment = dataEnvironment
        self.dataBaseURL = dataBaseURL
        self.weddingDayGate = weddingDayGate
        if let weddingDayGate {
            self.repository = WeddingDayGateAwareRepository(base: repository, gate: weddingDayGate)
        } else {
            self.repository = repository
        }
    }
}
