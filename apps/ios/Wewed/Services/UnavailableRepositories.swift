import Foundation

/// Repositories for a launch where none could be built.
///
/// Every call throws. That is the point: a placeholder that returned empty collections would let a
/// workspace render as though a real wedding had no guests, no tasks and no budget — which looks
/// like data rather than like an unavailable environment.
struct UnavailableEnvironment: Error {}

final class UnavailableWeddingRepository: WeddingRepositoryProtocol, @unchecked Sendable {
    func availableWeddingIds() async throws -> [String] { throw UnavailableEnvironment() }
    func resolveGuestIdentity(token: String) async throws -> GuestIdentity? {
        throw UnavailableEnvironment()
    }
    func getWedding(weddingId: String) async throws -> Wedding { throw UnavailableEnvironment() }
    func getTasks(weddingId: String) async throws -> [PlannerTask] { throw UnavailableEnvironment() }
    func createTask(
        weddingId: String, title: String, priority: TaskPriority, category: String
    ) async throws -> PlannerTask { throw UnavailableEnvironment() }
    func toggleTask(weddingId: String, taskId: String) async throws -> PlannerTask {
        throw UnavailableEnvironment()
    }
    func getGuests(weddingId: String) async throws -> [Guest] { throw UnavailableEnvironment() }
    func getBudget(weddingId: String) async throws -> BudgetSummary { throw UnavailableEnvironment() }
    func checkInGuest(
        weddingId: String, qrPayload: String, count: Int, usherId: String
    ) async throws -> CheckInVerificationResult { throw UnavailableEnvironment() }
    func searchGuests(weddingId: String, query: String) async throws -> [Guest] {
        throw UnavailableEnvironment()
    }
    func getAuditRecords(weddingId: String) async throws -> [CheckInAuditRecord] {
        throw UnavailableEnvironment()
    }
    func getVendors(weddingId: String) async throws -> [VendorPresence] {
        throw UnavailableEnvironment()
    }
    func updateVendorState(
        weddingId: String, id: String, state: VendorPresenceState
    ) async throws -> VendorPresence { throw UnavailableEnvironment() }
    func getAnnouncements(weddingId: String) async throws -> [WeddingAnnouncement] {
        throw UnavailableEnvironment()
    }
    func postAnnouncement(
        weddingId: String, title: String, message: String, urgency: AnnouncementUrgency
    ) async throws -> WeddingAnnouncement { throw UnavailableEnvironment() }
    func getWeddingPass(token: String) async throws -> WeddingPass { throw UnavailableEnvironment() }
    func resolveInvitation(weddingSlug: String, token: String) async throws -> InvitationContext {
        throw UnavailableEnvironment()
    }
    func confirmRsvp(
        weddingSlug: String, token: String, attending: Bool
    ) async throws -> WeddingPass { throw UnavailableEnvironment() }
}

final class UnavailablePlannerRepository: PlannerDashboardRepositoryProtocol, @unchecked Sendable {
    func getDashboard() async throws -> PlannerDashboardSnapshot { throw UnavailableEnvironment() }
    func getBudgetLines() async throws -> [PlannerBudgetLine] { throw UnavailableEnvironment() }
    func getContributions() async throws -> [PlannerContributionRecord] { throw UnavailableEnvironment() }
    func getVendorEngagements() async throws -> [PlannerVendorEngagement] { throw UnavailableEnvironment() }
    func getSeatingTables() async throws -> [PlannerSeatingTable] { throw UnavailableEnvironment() }
    func getTimelineEntries() async throws -> [PlannerTimelineEntry] { throw UnavailableEnvironment() }
    func getDocuments() async throws -> [PlannerDocumentRecord] { throw UnavailableEnvironment() }
}
