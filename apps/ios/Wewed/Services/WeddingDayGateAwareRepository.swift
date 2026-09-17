import Foundation

/// Repository adapter that preserves every existing native surface while routing only Gate QR
/// admission through the explicitly injected manifest-backed Wedding Day runtime.
/// When `server` is provided, server-backed Wedding Day API routes (announcements, vendor state)
/// are preferred; all other reads and writes delegate to `base`.
/// `searchGuests` and `getAuditRecords` always delegate to `base` (offline-first device manifest)
/// to maintain field reliability on low-connectivity networks.
public actor WeddingDayGateAwareRepository: WeddingRepositoryProtocol {
    private let base: WeddingRepositoryProtocol
    private let gate: WeddingDayGateOperations
    /// Optional server-backed API client injected by AppComposition in isolated/production modes.
    private let server: ServerBackedWeddingDayOperations?

    public init(
        base: WeddingRepositoryProtocol,
        gate: WeddingDayGateOperations,
        server: ServerBackedWeddingDayOperations? = nil
    ) {
        self.base = base
        self.gate = gate
        self.server = server
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
    /// Intentionally delegated to base (offline-first device manifest) for low-connectivity reliability.
    public func searchGuests(query: String) async throws -> [Guest] { try await base.searchGuests(query: query) }
    /// Intentionally delegated to base (device audit journal) for offline-first field reliability.
    public func getAuditRecords() async throws -> [CheckInAuditRecord] { try await base.getAuditRecords() }
    public func getVendors() async throws -> [VendorPresence] { try await base.getVendors() }
    public func updateVendorState(id: String, state: VendorPresenceState) async throws -> VendorPresence {
        try await base.updateVendorState(id: id, state: state)
    }
    public func getAnnouncements() async throws -> [WeddingAnnouncement] {
        if let server {
            let result = try await server.getAnnouncements()
            if !result.isEmpty { return result }
        }
        return try await base.getAnnouncements()
    }
    public func postAnnouncement(title: String, message: String, urgency: AnnouncementUrgency) async throws -> WeddingAnnouncement {
        if let server, let created = try await server.postAnnouncement(title: title, message: message, urgency: urgency) {
            return created
        }
        return try await base.postAnnouncement(title: title, message: message, urgency: urgency)
    }
    public func resolveInvitation(weddingSlug: String, token: String) async throws -> InvitationContext {
        try await base.resolveInvitation(weddingSlug: weddingSlug, token: token)
    }
    public func confirmRsvp(weddingSlug: String, token: String, attending: Bool) async throws -> WeddingPass {
        try await base.confirmRsvp(weddingSlug: weddingSlug, token: token, attending: attending)
    }

    public func checkInGuest(qrPayload: String, count: Int, usherId: String) async throws -> CheckInVerificationResult {
        try await gate.checkIn(qrPayload: qrPayload, count: count, usherId: usherId)
    }
}
