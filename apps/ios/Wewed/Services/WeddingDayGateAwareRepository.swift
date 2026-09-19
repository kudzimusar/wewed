import Foundation

/// Repository adapter that preserves every existing native surface while routing only Gate QR
/// admission through the explicitly injected manifest-backed Wedding Day runtime.
public actor WeddingDayGateAwareRepository: WeddingRepositoryProtocol {
    private let base: WeddingRepositoryProtocol
    private let gate: WeddingDayGateOperations

    public init(base: WeddingRepositoryProtocol, gate: WeddingDayGateOperations) {
        self.base = base
        self.gate = gate
    }

    public func getWedding() async throws -> Wedding { try await base.getWedding() }
    public func getTasks() async throws -> [PlannerTask] { try await base.getTasks() }
    public func createTask(title: String, priority: TaskPriority, category: String) async throws -> PlannerTask {
        try await base.createTask(title: title, priority: priority, category: category)
    }
    public func toggleTask(taskId: String) async throws -> PlannerTask { try await base.toggleTask(taskId: taskId) }
    public func getGuests() async throws -> [Guest] { try await base.getGuests() }
    public func getBudget() async throws -> BudgetSummary { try await base.getBudget() }
    public func getWeddingPass(token: String) async throws -> WeddingPass { try await base.getWeddingPass(token: token) }
    public func searchGuests(query: String) async throws -> [Guest] { try await base.searchGuests(query: query) }
    public func getAuditRecords() async throws -> [CheckInAuditRecord] { try await base.getAuditRecords() }
    public func getVendors() async throws -> [VendorPresence] { try await base.getVendors() }
    public func updateVendorState(id: String, state: VendorPresenceState) async throws -> VendorPresence {
        try await base.updateVendorState(id: id, state: state)
    }
    public func getAnnouncements() async throws -> [WeddingAnnouncement] { try await base.getAnnouncements() }
    public func postAnnouncement(title: String, message: String, urgency: AnnouncementUrgency) async throws -> WeddingAnnouncement {
        try await base.postAnnouncement(title: title, message: message, urgency: urgency)
    }
    public func resolveInvitation(weddingSlug: String, token: String) async throws -> InvitationContext {
        try await base.resolveInvitation(weddingSlug: weddingSlug, token: token)
    }
    public func confirmRsvp(weddingSlug: String, token: String, attending: Bool) async throws -> WeddingPass {
        try await base.confirmRsvp(weddingSlug: weddingSlug, token: token, attending: attending)
    }
    public func updateWeddingDetails(_ update: WeddingDetailsUpdate) async throws -> Wedding {
        try await base.updateWeddingDetails(update)
    }

    public func checkInGuest(qrPayload: String, count: Int, usherId: String) async throws -> CheckInVerificationResult {
        try await gate.checkIn(qrPayload: qrPayload, count: count, usherId: usherId)
    }
}
