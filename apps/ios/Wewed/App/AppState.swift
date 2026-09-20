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

    public func handleIncomingURL(_ url: URL) {
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
