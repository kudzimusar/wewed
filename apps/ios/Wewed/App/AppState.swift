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
    /// Nil by default. Isolated integration builds/tests may inject a manifest-backed runtime.
    public let weddingDayGate: WeddingDayGateOperations?
    /// Active guest pass token injected by AppComposition; nil means fixture/anonymous mode.
    public let activePassToken: String?
    /// When true, UI surfaces may render simulation/demo controls (fixture & isolated modes only).
    public let showDemoSimulations: Bool

    public init(
        repository: WeddingRepositoryProtocol = FixtureWeddingRepository(),
        weddingDayGate: WeddingDayGateOperations? = nil,
        activePassToken: String? = nil,
        showDemoSimulations: Bool = true
    ) {
        self.weddingDayGate = weddingDayGate
        self.activePassToken = activePassToken
        self.showDemoSimulations = showDemoSimulations
        if let weddingDayGate {
            self.repository = WeddingDayGateAwareRepository(base: repository, gate: weddingDayGate)
        } else {
            self.repository = repository
        }
    }

    /// Convenience initializer from a fully composed AppComposition.
    public convenience init(composition: AppComposition, activePassToken: String? = nil) {
        self.init(
            repository: composition.repository,
            weddingDayGate: composition.gate,
            activePassToken: activePassToken,
            showDemoSimulations: composition.showDemoSimulations
        )
    }
}

