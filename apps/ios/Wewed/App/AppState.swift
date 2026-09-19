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

    public let repository: WeddingRepositoryProtocol
    public let plannerRepository: PlannerDashboardRepositoryProtocol
    public let dataEnvironment: NativeDataEnvironment
    public let dataBaseURL: URL?
    public let launch: NativeLaunchConfiguration
    /// SHA-256 of the private snapshot bytes this app loaded (nil for compiled-in datasets).
    public let dataFingerprint: String?
    private let adminAuditLog = AdminAuditLog()
    /// Nil by default. Isolated integration builds/tests may inject a manifest-backed runtime.
    public let weddingDayGate: WeddingDayGateOperations?

    public static func make(
        environment: NativeDataEnvironment,
        baseURL: URL? = nil,
        launch: NativeLaunchConfiguration? = nil
    ) throws -> AppState {
        let bundle = try NativeRepositoryFactory.make(environment: environment, baseURL: baseURL)
        return AppState(
            repository: bundle.wedding,
            plannerRepository: bundle.planner,
            dataEnvironment: bundle.environment,
            dataBaseURL: bundle.baseURL,
            launch: launch ?? NativeLaunchConfiguration(environment: bundle.environment, baseURL: bundle.baseURL),
            dataFingerprint: bundle.dataFingerprint
        )
    }

    /// The only data gateway handed to non-couple shells; bound to one grant's capabilities and scope.
    public func access(for grant: RoleGrant) -> RoleScopedAccess {
        RoleScopedAccess(grant: grant, wedding: repository, planner: plannerRepository, audit: adminAuditLog)
    }

    public init(
        repository: WeddingRepositoryProtocol = FixtureWeddingRepository(),
        plannerRepository: PlannerDashboardRepositoryProtocol = FixturePlannerDashboardRepository(),
        dataEnvironment: NativeDataEnvironment = .fixture,
        dataBaseURL: URL? = nil,
        launch: NativeLaunchConfiguration? = nil,
        dataFingerprint: String? = nil,
        weddingDayGate: WeddingDayGateOperations? = nil
    ) {
        self.dataFingerprint = dataFingerprint
        self.launch = launch ?? NativeLaunchConfiguration(environment: dataEnvironment, baseURL: dataBaseURL)
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
