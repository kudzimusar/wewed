import Foundation

/// Production boundary repository for Phase 5.
///
/// Production workspace data is loaded through the grant-revalidated native-account workspace API,
/// not through the legacy mutable repository protocols. These adapters deliberately serve nothing:
/// an old screen cannot fall back to fixture/Shadow data and cannot accidentally enable writes.
public enum ProductionReadOnlyDomainError: Error, Equatable, Sendable {
    case unavailable
}

public struct ProductionBoundaryWeddingRepository: WeddingRepositoryProtocol {
    public init() {}
    private func denied<T>() throws -> T { throw ProductionReadOnlyDomainError.unavailable }

    public func availableWeddingIds() async throws -> [String] { [] }
    public func resolveGuestIdentity(token: String) async throws -> GuestIdentity? { try denied() }
    public func getWedding(weddingId: String) async throws -> Wedding { try denied() }
    public func getTasks(weddingId: String) async throws -> [PlannerTask] { try denied() }
    public func createTask(weddingId: String, title: String, priority: TaskPriority, category: String) async throws -> PlannerTask { try denied() }
    public func toggleTask(weddingId: String, taskId: String) async throws -> PlannerTask { try denied() }
    public func getGuests(weddingId: String) async throws -> [Guest] { try denied() }
    public func getBudget(weddingId: String) async throws -> BudgetSummary { try denied() }
    public func checkInGuest(weddingId: String, qrPayload: String, count: Int, usherId: String) async throws -> CheckInVerificationResult { try denied() }
    public func searchGuests(weddingId: String, query: String) async throws -> [Guest] { try denied() }
    public func getAuditRecords(weddingId: String) async throws -> [CheckInAuditRecord] { try denied() }
    public func getVendors(weddingId: String) async throws -> [VendorPresence] { try denied() }
    public func updateVendorState(weddingId: String, id: String, state: VendorPresenceState) async throws -> VendorPresence { try denied() }
    public func getAnnouncements(weddingId: String) async throws -> [WeddingAnnouncement] { try denied() }
    public func postAnnouncement(weddingId: String, title: String, message: String, urgency: AnnouncementUrgency) async throws -> WeddingAnnouncement { try denied() }
    public func getWeddingPass(token: String) async throws -> WeddingPass { try denied() }
    public func resolveInvitation(weddingSlug: String, token: String) async throws -> InvitationContext { try denied() }
    public func confirmRsvp(weddingSlug: String, token: String, attending: Bool) async throws -> WeddingPass { try denied() }
}

public struct ProductionBoundaryPlannerRepository: PlannerDashboardRepositoryProtocol {
    public init() {}
    private func denied<T>() throws -> T { throw ProductionReadOnlyDomainError.unavailable }
    public func getDashboard() async throws -> PlannerDashboardSnapshot { try denied() }
    public func getBudgetLines() async throws -> [PlannerBudgetLine] { try denied() }
    public func getContributions() async throws -> [PlannerContributionRecord] { try denied() }
    public func getVendorEngagements() async throws -> [PlannerVendorEngagement] { try denied() }
    public func getSeatingTables() async throws -> [PlannerSeatingTable] { try denied() }
    public func getTimelineEntries() async throws -> [PlannerTimelineEntry] { try denied() }
    public func getDocuments() async throws -> [PlannerDocumentRecord] { try denied() }
}
