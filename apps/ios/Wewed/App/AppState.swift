import Foundation
import Combine

public enum AppTab: String, CaseIterable, Identifiable, Sendable {
    case home = "Home"
    case plan = "Plan"
    case guests = "Guests"
    case pass = "Pass"
    case live = "Live"

    public var id: String { rawValue }

    public var systemImage: String {
        switch self {
        case .home: return "heart.fill"
        case .plan: return "checklist"
        case .guests: return "person.2.fill"
        case .pass: return "qrcode"
        case .live: return "bubble.left.and.bubble.right.fill"
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
    /// Nil by default. Isolated integration builds/tests may inject a manifest-backed runtime.
    public let weddingDayGate: WeddingDayGateOperations?

    public init(
        repository: WeddingRepositoryProtocol = FixtureWeddingRepository(),
        plannerRepository: PlannerDashboardRepositoryProtocol = FixturePlannerDashboardRepository(),
        dataEnvironment: NativeDataEnvironment = .fixture,
        weddingDayGate: WeddingDayGateOperations? = nil
    ) {
        self.plannerRepository = plannerRepository
        self.dataEnvironment = dataEnvironment
        self.weddingDayGate = weddingDayGate
        if let weddingDayGate {
            self.repository = WeddingDayGateAwareRepository(base: repository, gate: weddingDayGate)
        } else {
            self.repository = repository
        }
    }
}
