import Foundation
import Combine

public enum AppTab: String, CaseIterable, Identifiable, Sendable {
    case home = "Home"
    case plan = "Plan"
    case guests = "Guests"
    case pass = "Pass"
    case live = "More"

    public var id: String { rawValue }

    public var systemImage: String {
        switch self {
        case .home: return "heart.fill"
        case .plan: return "checklist"
        case .guests: return "person.2.fill"
        case .pass: return "qrcode"
        case .live: return "line.3.horizontal"
        }
    }
}

public final class AppState: ObservableObject, @unchecked Sendable {
    @Published public var selectedTab: AppTab = .home
    @Published public var isOffline: Bool = false
    @Published public var pendingSyncCount: Int = 0
    @Published public var lastSyncTime: Date? = nil
    @Published public var pendingInvitationDeepLink: InvitationDeepLink? = nil

    public let repository: WeddingRepositoryProtocol
    public let plannerRepository: PlannerDashboardRepositoryProtocol
    public let dataEnvironment: NativeDataEnvironment
    public let dataBaseURL: URL?
    /// Nil by default. Isolated integration builds/tests may inject a manifest-backed runtime.
    public let weddingDayGate: WeddingDayGateOperations?

    public func handleIncomingURL(_ url: URL) {
        guard let deepLink = NativeDeepLinkParser.parse(url.absoluteString) else { return }

        switch deepLink {
        case .invitation(let invitation):
            pendingInvitationDeepLink = invitation
            selectedTab = .home
        case .pass:
            pendingInvitationDeepLink = nil
            selectedTab = .pass
        case .wedding:
            pendingInvitationDeepLink = nil
            selectedTab = .home
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
