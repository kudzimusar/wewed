import Foundation

/// Admin support reads are recorded before any data is returned.
public actor AdminAuditLog {
    private var entries: [AdminAuditEntry] = []

    public init() {}

    public func record(section: String, weddingId: String, at date: Date = Date()) {
        entries.insert(AdminAuditEntry(section: section, weddingId: weddingId, recordedAt: date), at: 0)
    }

    public func all() -> [AdminAuditEntry] { entries }
}

/// The only data gateway a role shell receives. Each call checks the grant's capabilities and scope,
/// so a guest, vendor or usher shell cannot read the roster, budget or financials even if a screen tried.
/// Mirrors Android `RoleScopedAccess`.
public final class RoleScopedAccess: @unchecked Sendable {
    public let grant: RoleGrant
    private let wedding: WeddingRepositoryProtocol
    private let planner: PlannerDashboardRepositoryProtocol
    private let audit: AdminAuditLog

    public init(
        grant: RoleGrant,
        wedding: WeddingRepositoryProtocol,
        planner: PlannerDashboardRepositoryProtocol,
        audit: AdminAuditLog = AdminAuditLog()
    ) {
        self.grant = grant
        self.wedding = wedding
        self.planner = planner
        self.audit = audit
    }

    public var role: AppRole { grant.role }

    public func can(_ capability: Capability) -> Bool {
        CapabilityPolicy.allows(grant.role, capability)
    }

    private func require(_ capability: Capability) throws {
        guard can(capability) else { throw AccessDeniedError(role: grant.role, capability: capability) }
    }

    // MARK: Public wedding information

    public func weddingSummary() async throws -> Wedding {
        try require(.viewWeddingSummary)
        return try await wedding.getWedding()
    }

    public func programme() async throws -> [PlannerTimelineEntry] {
        try require(.viewProgramme)
        return try await planner.getTimelineEntries()
    }

    public func announcements() async throws -> [WeddingAnnouncement] {
        try require(.viewWeddingSummary)
        return try await wedding.getAnnouncements()
    }

    // MARK: Wedding management (Couple / Planner)

    public func dashboard() async throws -> PlannerDashboardSnapshot {
        try require(.viewPlanningDashboard)
        return try await planner.getDashboard()
    }

    public func tasks() async throws -> [PlannerTask] {
        try require(.viewTasks)
        return try await wedding.getTasks()
    }

    public func createTask(title: String, priority: TaskPriority, category: String) async throws -> PlannerTask {
        try require(.manageTasks)
        return try await wedding.createTask(title: title, priority: priority, category: category)
    }

    public func toggleTask(taskId: String) async throws -> PlannerTask {
        try require(.manageTasks)
        return try await wedding.toggleTask(taskId: taskId)
    }

    public func guestRoster() async throws -> [Guest] {
        try require(.viewGuestRoster)
        return try await wedding.getGuests()
    }

    public func searchGuests(query: String) async throws -> [Guest] {
        try require(.viewGuestRoster)
        return try await wedding.searchGuests(query: query)
    }

    public func budget() async throws -> BudgetSummary {
        try require(.viewBudget)
        return try await wedding.getBudget()
    }

    public func budgetLines() async throws -> [PlannerBudgetLine] {
        try require(.viewBudget)
        return try await planner.getBudgetLines()
    }

    public func contributions() async throws -> [PlannerContributionRecord] {
        try require(.viewContributions)
        let showIdentity = can(.viewContributorIdentity)
        return try await planner.getContributions().map { Self.redactContributor($0, roleMayIdentify: showIdentity) }
    }

    public func vendorEngagements() async throws -> [PlannerVendorEngagement] {
        let all = try await planner.getVendorEngagements()
        if can(.viewAllVendorEngagements) { return all }
        if can(.viewOwnVendorEngagement) {
            guard let vendorId = grant.vendorId else { return [] }
            return all.filter { $0.vendorId == vendorId }
        }
        throw AccessDeniedError(role: grant.role, capability: .viewOwnVendorEngagement)
    }

    public func vendorPresence() async throws -> [VendorPresence] {
        let all = try await wedding.getVendors()
        if can(.viewVendorPresence) { return all }
        if can(.updateOwnVendorPresence) {
            guard let vendorId = grant.vendorId else { return [] }
            return all.filter { $0.id == vendorId }
        }
        throw AccessDeniedError(role: grant.role, capability: .viewVendorPresence)
    }

    public func updateOwnVendorPresence(_ state: VendorPresenceState) async throws -> VendorPresence {
        try require(.updateOwnVendorPresence)
        guard let vendorId = grant.vendorId else {
            throw AccessDeniedError(role: grant.role, capability: .updateOwnVendorPresence)
        }
        return try await wedding.updateVendorState(id: vendorId, state: state)
    }

    public func seating() async throws -> [PlannerSeatingTable] {
        try require(.viewSeating)
        return try await planner.getSeatingTables()
    }

    public func documents() async throws -> [PlannerDocumentRecord] {
        try require(.viewDocuments)
        return try await planner.getDocuments()
    }

    public func updateWeddingDetails(_ update: WeddingDetailsUpdate) async throws -> Wedding {
        try require(.editWeddingDetails)
        return try await wedding.updateWeddingDetails(update)
    }

    public func previewGuestPass(token: String) async throws -> WeddingPass {
        try require(.previewGuestPasses)
        return try await wedding.getWeddingPass(token: token)
    }

    public func postAnnouncement(title: String, message: String, urgency: AnnouncementUrgency) async throws -> WeddingAnnouncement {
        try require(.postAnnouncement)
        return try await wedding.postAnnouncement(title: title, message: message, urgency: urgency)
    }

    // MARK: Guest: own invitation, RSVP and pass only

    private func ownGuestToken(_ capability: Capability) throws -> String {
        try require(capability)
        guard let guestId = grant.guestId else { throw AccessDeniedError(role: grant.role, capability: capability) }
        return guestId
    }

    public func ownInvitation() async throws -> InvitationContext {
        let token = try ownGuestToken(.viewOwnInvitation)
        return try await wedding.resolveInvitation(weddingSlug: grant.weddingId, token: token)
    }

    public func respondToOwnInvitation(attending: Bool) async throws -> WeddingPass {
        let token = try ownGuestToken(.respondOwnRsvp)
        return try await wedding.confirmRsvp(weddingSlug: grant.weddingId, token: token, attending: attending)
    }

    /// Nil until the guest has accepted; a declined or pending guest has no admission pass.
    public func ownPass() async throws -> WeddingPass? {
        let token = try ownGuestToken(.viewOwnPass)
        let invitation = try await wedding.resolveInvitation(weddingSlug: grant.weddingId, token: token)
        guard invitation.isConfirmed else { return nil }
        return try await wedding.getWeddingPass(token: token)
    }

    // MARK: Gate operations (Usher / Coordinator / Couple / Planner)

    public func admit(qrPayload: String, count: Int, operatorId: String) async throws -> CheckInVerificationResult {
        try require(.scanAdmission)
        return try await wedding.checkInGuest(qrPayload: qrPayload, count: count, usherId: operatorId)
    }

    public func admissionLookup(query: String) async throws -> [AdmissionLookupRow] {
        try require(.lookupAdmission)
        let normalized = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard normalized.count >= 2 else { return [] }
        return try await wedding.getGuests()
            .filter { $0.rsvpStatus == .attending && $0.name.lowercased().contains(normalized) }
            .map {
                AdmissionLookupRow(
                    guestId: $0.id,
                    displayName: $0.name,
                    partySize: $0.partySize,
                    admittedCount: $0.checkedInCount,
                    tableName: $0.tableName
                )
            }
    }

    public func admissionSummary() async throws -> AdmissionSummary {
        try require(.viewAdmissionSummary)
        let attending = try await wedding.getGuests().filter { $0.rsvpStatus == .attending }
        return AdmissionSummary(
            attendingParties: attending.count,
            expectedGuests: attending.reduce(0) { $0 + $1.partySize },
            admittedGuests: attending.reduce(0) { $0 + $1.checkedInCount }
        )
    }

    public func admissionHistory() async throws -> [CheckInAuditRecord] {
        try require(.scanAdmission)
        return try await wedding.getAuditRecords()
    }

    // MARK: Admin: explicit, audited support reads

    public func supportRead<T>(
        section: String,
        _ block: (WeddingRepositoryProtocol, PlannerDashboardRepositoryProtocol) async throws -> T
    ) async throws -> T {
        try require(.adminSupport)
        await audit.record(section: section, weddingId: grant.weddingId)
        return try await block(wedding, planner)
    }

    public func auditEntries() async throws -> [AdminAuditEntry] {
        try require(.adminSupport)
        return await audit.all()
    }

    public static func redactContributor(_ record: PlannerContributionRecord, roleMayIdentify: Bool) -> PlannerContributionRecord {
        if record.contributorResolution == .notRecorded { return record }
        let anonymous = record.privacyLabel?.caseInsensitiveCompare("Anonymous") == .orderedSame
        if roleMayIdentify && !anonymous { return record }
        return PlannerContributionRecord(
            id: record.id,
            contributorLabel: anonymous ? "Anonymous" : "Contributor hidden",
            typeLabel: record.typeLabel,
            value: record.value,
            statusLabel: record.statusLabel,
            allocationLabel: record.allocationLabel,
            verified: record.verified,
            contributorGuestId: nil,
            contributorResolution: .hidden,
            privacyLabel: record.privacyLabel,
            wordCount: record.wordCount,
            submittedAtLabel: record.submittedAtLabel,
            messageText: record.messageText
        )
    }
}
