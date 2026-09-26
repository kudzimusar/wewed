import Foundation

public enum ShadowAPIError: Error, Equatable, Sendable {
    case invalidEnvironment
    case transportNotConfigured
    case invalidResponse
}

public struct ShadowRepositoryConfiguration: Equatable, Sendable {
    public let baseURL: URL
    public let environment: NativeDataEnvironment

    public init(baseURL: URL, environment: NativeDataEnvironment = .shadow) throws {
        guard environment == .shadow else {
            throw ShadowAPIError.invalidEnvironment
        }
        try NativeEnvironmentGuard.validate(baseURL: baseURL, environment: environment)
        self.baseURL = baseURL
        self.environment = environment
    }
}

public protocol ShadowAPITransportProtocol: Sendable {
    func get(path: String) async throws -> Data
    func post(path: String, body: Data) async throws -> Data
    func patch(path: String, body: Data) async throws -> Data
}

/// Deliberate default for this sprint. It makes the HTTP repository boundary
/// compilable and testable without accidentally adding real networking.
public struct UnconfiguredShadowAPITransport: ShadowAPITransportProtocol {
    public init() {}

    public func get(path: String) async throws -> Data {
        throw ShadowAPIError.transportNotConfigured
    }

    public func post(path: String, body: Data) async throws -> Data {
        throw ShadowAPIError.transportNotConfigured
    }

    public func patch(path: String, body: Data) async throws -> Data {
        throw ShadowAPIError.transportNotConfigured
    }
}

public enum ShadowEndpoint {
    public static let plannerDashboard = "/mobile-shadow/planner/overview"
    public static let plannerBudget = "/mobile-shadow/planner/budget"
    public static let plannerContributions = "/mobile-shadow/planner/contributions"
    public static let plannerVendors = "/mobile-shadow/planner/vendors"
    public static let plannerSeating = "/mobile-shadow/planner/seating"
    public static let plannerTimeline = "/mobile-shadow/planner/timeline"
    public static let weddingContext = "/mobile-shadow/wedding"
    public static let guests = "/mobile-shadow/guests"
    public static let invitation = "/mobile-shadow/invitation"
    public static let pass = "/mobile-shadow/pass"
}

/// Prepared HTTP adapter for the Planner read surface. It cannot perform
/// network traffic until an explicit ShadowAPITransport is injected.
public struct ShadowPlannerHTTPRepository: PlannerDashboardRepositoryProtocol {
    private let transport: ShadowAPITransportProtocol
    private let decoder: JSONDecoder

    public init(
        configuration: ShadowRepositoryConfiguration,
        transport: ShadowAPITransportProtocol = UnconfiguredShadowAPITransport()
    ) {
        _ = configuration
        self.transport = transport
        self.decoder = JSONDecoder()
    }

    public func getDashboard() async throws -> PlannerDashboardSnapshot {
        try decoder.decode(
            PlannerDashboardSnapshot.self,
            from: await transport.get(path: ShadowEndpoint.plannerDashboard)
        )
    }

    public func getBudgetLines() async throws -> [PlannerBudgetLine] {
        try decoder.decode(
            [PlannerBudgetLine].self,
            from: await transport.get(path: ShadowEndpoint.plannerBudget)
        )
    }

    public func getContributions() async throws -> [PlannerContributionRecord] {
        try decoder.decode(
            [PlannerContributionRecord].self,
            from: await transport.get(path: ShadowEndpoint.plannerContributions)
        )
    }

    public func getVendorEngagements() async throws -> [PlannerVendorEngagement] {
        try decoder.decode(
            [PlannerVendorEngagement].self,
            from: await transport.get(path: ShadowEndpoint.plannerVendors)
        )
    }

    public func getSeatingTables() async throws -> [PlannerSeatingTable] {
        try decoder.decode(
            [PlannerSeatingTable].self,
            from: await transport.get(path: ShadowEndpoint.plannerSeating)
        )
    }

    public func getTimelineEntries() async throws -> [PlannerTimelineEntry] {
        try decoder.decode(
            [PlannerTimelineEntry].self,
            from: await transport.get(path: ShadowEndpoint.plannerTimeline)
        )
    }

    public func getDocuments() async throws -> [PlannerDocumentRecord] {
        // The HTTP Shadow contract has no documents endpoint yet. Private Real Shadow
        // reads contracts/vault objects directly from the selected local account graph.
        []
    }
}
