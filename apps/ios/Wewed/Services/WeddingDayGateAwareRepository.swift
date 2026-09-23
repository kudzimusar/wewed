import Foundation

/// Preserves all existing native surfaces while routing Gate QR admission through Wedding Day.
public actor WeddingDayGateAwareRepository: WeddingRepositoryProtocol {
    private let base: WeddingRepositoryProtocol
    private let gate: WeddingDayGateOperations

    public init(base: WeddingRepositoryProtocol, gate: WeddingDayGateOperations) {
        self.base = base
        self.gate = gate
    }

    public func availableWeddingIds() async throws -> [String] { try await base.availableWeddingIds() }
    public func resolveGuestIdentity(token: String) async throws -> GuestIdentity? {
        try await base.resolveGuestIdentity(token: token)
    }
    public func getWedding(weddingId: String) async throws -> Wedding { try await base.getWedding(weddingId: weddingId) }
    public func getTasks(weddingId: String) async throws -> [PlannerTask] { try await base.getTasks(weddingId: weddingId) }
    public func createTask(weddingId: String, title: String, priority: TaskPriority, category: String) async throws -> PlannerTask {
        try await base.createTask(weddingId: weddingId, title: title, priority: priority, category: category)
    }
    public func toggleTask(weddingId: String, taskId: String) async throws -> PlannerTask {
        try await base.toggleTask(weddingId: weddingId, taskId: taskId)
    }
    public func getGuests(weddingId: String) async throws -> [Guest] { try await base.getGuests(weddingId: weddingId) }
    public func getBudget(weddingId: String) async throws -> BudgetSummary { try await base.getBudget(weddingId: weddingId) }
    public func getWeddingPass(token: String) async throws -> WeddingPass { try await base.getWeddingPass(token: token) }
    public func searchGuests(weddingId: String, query: String) async throws -> [Guest] {
        try await base.searchGuests(weddingId: weddingId, query: query)
    }
    public func getAuditRecords(weddingId: String) async throws -> [CheckInAuditRecord] {
        try await base.getAuditRecords(weddingId: weddingId)
    }
    public func getVendors(weddingId: String) async throws -> [VendorPresence] { try await base.getVendors(weddingId: weddingId) }
    public func updateVendorState(weddingId: String, id: String, state: VendorPresenceState) async throws -> VendorPresence {
        try await base.updateVendorState(weddingId: weddingId, id: id, state: state)
    }
    public func getAnnouncements(weddingId: String) async throws -> [WeddingAnnouncement] {
        try await base.getAnnouncements(weddingId: weddingId)
    }
    public func postAnnouncement(weddingId: String, title: String, message: String, urgency: AnnouncementUrgency) async throws -> WeddingAnnouncement {
        try await base.postAnnouncement(weddingId: weddingId, title: title, message: message, urgency: urgency)
    }
    public func resolveInvitation(weddingSlug: String, token: String) async throws -> InvitationContext {
        try await base.resolveInvitation(weddingSlug: weddingSlug, token: token)
    }
    public func confirmRsvp(weddingSlug: String, token: String, attending: Bool) async throws -> WeddingPass {
        try await base.confirmRsvp(weddingSlug: weddingSlug, token: token, attending: attending)
    }

    /// Gate admission stays routed through Wedding Day, but still inside the wedding scope.
    public func checkInGuest(weddingId: String, qrPayload: String, count: Int, usherId: String) async throws -> CheckInVerificationResult {
        let available = try await base.availableWeddingIds()
        guard available.contains(weddingId) else {
            throw WeddingScopeMismatch(requestedWeddingId: weddingId, availableWeddingIds: available)
        }
        guard weddingId == gate.gateContext.weddingId else {
            throw WeddingScopeMismatch(
                requestedWeddingId: weddingId,
                availableWeddingIds: [gate.gateContext.weddingId]
            )
        }
        // usherId exists only on the legacy repository protocol; it is intentionally ignored.
        return try await gate.checkIn(qrPayload: qrPayload, count: count)
    }
}
