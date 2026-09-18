import Foundation

/// Planner-side repository for the sanitized Charity & Kudzie / Eleven Eleven Testing
/// shadow reference scenario.
///
/// This type is intentionally distinct from FixturePlannerDashboardRepository so
/// environment selection cannot accidentally make a Shadow build look like the
/// legacy generic fixture environment.
public actor ShadowReferencePlannerRepository: PlannerDashboardRepositoryProtocol {
    private let base = FixturePlannerDashboardRepository()

    public init() {}

    public func getDashboard() async throws -> PlannerDashboardSnapshot {
        try await base.getDashboard()
    }

    public func getBudgetLines() async throws -> [PlannerBudgetLine] {
        try await base.getBudgetLines()
    }

    public func getContributions() async throws -> [PlannerContributionRecord] {
        try await base.getContributions()
    }

    public func getVendorEngagements() async throws -> [PlannerVendorEngagement] {
        try await base.getVendorEngagements()
    }

    public func getSeatingTables() async throws -> [PlannerSeatingTable] {
        try await base.getSeatingTables()
    }

    public func getTimelineEntries() async throws -> [PlannerTimelineEntry] {
        try await base.getTimelineEntries()
    }
}
