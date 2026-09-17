import Foundation
import Combine

public enum AppTab: String, CaseIterable, Identifiable, Sendable {
    case home = "Home"
    case plan = "Plan"
    case guests = "Guests"
    case pass = "Wedding Pass"
    case live = "Live Wall"

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

    public init(repository: WeddingRepositoryProtocol = FixtureWeddingRepository()) {
        self.repository = repository
    }
}
