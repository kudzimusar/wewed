import Foundation

/// Raised when a repository is asked for a wedding graph it does not serve.
///
/// This is the mechanism that makes `NavigationContext.activeWeddingId` a real scope rather than a
/// reload key: a source holding wedding A cannot answer a request for wedding B by returning A.
public struct WeddingScopeMismatch: Error, Equatable {
    public let requestedWeddingId: String
    public let availableWeddingIds: [String]

    public init(requestedWeddingId: String, availableWeddingIds: [String]) {
        self.requestedWeddingId = requestedWeddingId
        self.availableWeddingIds = availableWeddingIds
    }
}

/// Wedding-scoped data source.
///
/// Every graph read takes the wedding it belongs to, and implementations must reject a wedding they
/// do not hold. Views never call this directly — they go through `ScopedWeddingRepository`, which
/// binds exactly one wedding for the lifetime of a workspace.
///
/// Token-addressed reads (pass, invitation, RSVP) are credential-scoped rather than wedding-scoped:
/// the token itself identifies both the wedding and the guest.
/// Who a credential belongs to (P0-4/P0-5).
///
/// Guest identity originates here — from an invitation or pass token resolved by the repository —
/// and never from the position of a row in a collection.
public struct GuestIdentity: Equatable, Sendable {
    public let guestId: String
    public let guestName: String
    public let weddingId: String
    public let passToken: String

    public init(guestId: String, guestName: String, weddingId: String, passToken: String) {
        self.guestId = guestId
        self.guestName = guestName
        self.weddingId = weddingId
        self.passToken = passToken
    }
}

public protocol WeddingRepositoryProtocol: Sendable {
    /// Wedding identities this source can serve for the current actor.
    func availableWeddingIds() async throws -> [String]

    /// Resolves the guest a credential identifies, or nil when the token is not recognised.
    /// This is the only sanctioned origin of guest identity.
    func resolveGuestIdentity(token: String) async throws -> GuestIdentity?

    func getWedding(weddingId: String) async throws -> Wedding
    func getTasks(weddingId: String) async throws -> [PlannerTask]
    func createTask(weddingId: String, title: String, priority: TaskPriority, category: String) async throws -> PlannerTask
    func toggleTask(weddingId: String, taskId: String) async throws -> PlannerTask
    func getGuests(weddingId: String) async throws -> [Guest]
    func getBudget(weddingId: String) async throws -> BudgetSummary
    func checkInGuest(weddingId: String, qrPayload: String, count: Int, usherId: String) async throws -> CheckInVerificationResult
    func searchGuests(weddingId: String, query: String) async throws -> [Guest]
    func getAuditRecords(weddingId: String) async throws -> [CheckInAuditRecord]
    func getVendors(weddingId: String) async throws -> [VendorPresence]
    func updateVendorState(weddingId: String, id: String, state: VendorPresenceState) async throws -> VendorPresence
    func getAnnouncements(weddingId: String) async throws -> [WeddingAnnouncement]
    func postAnnouncement(weddingId: String, title: String, message: String, urgency: AnnouncementUrgency) async throws -> WeddingAnnouncement

    // Credential-scoped: the token identifies the wedding and the guest.
    func getWeddingPass(token: String) async throws -> WeddingPass
    func resolveInvitation(weddingSlug: String, token: String) async throws -> InvitationContext
    func confirmRsvp(weddingSlug: String, token: String, attending: Bool) async throws -> WeddingPass

    // -------------------------------------------------------------------------------------
    // Production-derived domains (Private Real UAT graph).
    //
    // These default to "this source holds none", which is the honest answer for the fixture and
    // sanitized sources. A source that DOES hold the rows overrides them. The distinction between
    // an empty list here and a missing adapter is carried by `snapshotManifest()`: when a manifest
    // reports a non-zero count for a domain that reads back empty, that is a defect, and the
    // runtime tests assert exactly that.
    // -------------------------------------------------------------------------------------

    /// Identifies the snapshot actually loaded, or nil for sources that are not snapshot-backed.
    func snapshotManifest() async throws -> UatSnapshotManifest?
    /// The full RSVP record behind a guest, including meal, dietary, plus-one and kids detail.
    func getRsvpDetail(weddingId: String, guestId: String) async throws -> GuestRsvpDetail?
    /// Authorized contact/profile fields for a guest. Role gating is applied by the caller.
    func getGuestContact(weddingId: String, guestId: String) async throws -> GuestContactDetail?
    /// Every wedding-content row: story, gallery, venue, FAQ, travel, the day, after, memory.
    func getWeddingContent(weddingId: String) async throws -> [WeddingContentEntry]
    /// Content-management revision history. Never surfaced to guests.
    func getContentRevisions(weddingId: String) async throws -> [ContentRevisionRecord]
    /// The couple's songbook.
    func getSongs(weddingId: String) async throws -> [SongEntry]
    /// Real scan destinations. Routing configuration only — never pass signing material.
    func getQrDestinations(weddingId: String) async throws -> [QrDestination]
    /// Completed data imports, without rollback or preview payloads.
    func getImportJobs(weddingId: String) async throws -> [ImportJobRecord]
    /// Public wedding-wall messages. Not planner correspondence.
    func getWallMessages(weddingId: String) async throws -> [WallMessage]
    /// Named parties to the wedding's service engagements.
    func getEngagementParties(weddingId: String) async throws -> [EngagementPartyRecord]
    /// Wedding-scoped audit trail. Gated on Admin authorization by the caller.
    func getAuditEvents(weddingId: String) async throws -> [AuditEventRecord]
    /// How the active planner reaches this wedding, or nil when no planner context applies.
    func plannerAccessContext(weddingId: String) async throws -> PlannerAccessContext?
    /// Why Admin surfaces have nothing to show, when that is an authorization boundary.
    func adminAccessContext() async throws -> AdminAccessContext?
}

/// Default "this source holds none" implementations, so the fixture and sanitized sources are not
/// forced to restate an empty answer for every production-derived domain.
public extension WeddingRepositoryProtocol {
    func snapshotManifest() async throws -> UatSnapshotManifest? { nil }
    func getRsvpDetail(weddingId: String, guestId: String) async throws -> GuestRsvpDetail? { nil }
    func getGuestContact(weddingId: String, guestId: String) async throws -> GuestContactDetail? { nil }
    func getWeddingContent(weddingId: String) async throws -> [WeddingContentEntry] { [] }
    func getContentRevisions(weddingId: String) async throws -> [ContentRevisionRecord] { [] }
    func getSongs(weddingId: String) async throws -> [SongEntry] { [] }
    func getQrDestinations(weddingId: String) async throws -> [QrDestination] { [] }
    func getImportJobs(weddingId: String) async throws -> [ImportJobRecord] { [] }
    func getWallMessages(weddingId: String) async throws -> [WallMessage] { [] }
    func getEngagementParties(weddingId: String) async throws -> [EngagementPartyRecord] { [] }
    func getAuditEvents(weddingId: String) async throws -> [AuditEventRecord] { [] }
    func plannerAccessContext(weddingId: String) async throws -> PlannerAccessContext? { nil }
    func adminAccessContext() async throws -> AdminAccessContext? { nil }
}

/// A repository bound to one wedding.
///
/// Constructed through `WeddingRepositoryProtocol.forWedding(_:)`, which verifies up front that the
/// source actually serves that wedding. Because the workspace UI only ever holds one of these, a
/// view cannot accidentally read an unscoped graph, and a context switch cannot keep rendering the
/// previous wedding.
public struct ScopedWeddingRepository: Sendable {
    private let source: WeddingRepositoryProtocol
    public let weddingId: String

    init(source: WeddingRepositoryProtocol, weddingId: String) {
        self.source = source
        self.weddingId = weddingId
    }

    public func getWedding() async throws -> Wedding { try await source.getWedding(weddingId: weddingId) }
    public func getTasks() async throws -> [PlannerTask] { try await source.getTasks(weddingId: weddingId) }
    public func createTask(title: String, priority: TaskPriority, category: String) async throws -> PlannerTask {
        try await source.createTask(weddingId: weddingId, title: title, priority: priority, category: category)
    }
    public func toggleTask(taskId: String) async throws -> PlannerTask {
        try await source.toggleTask(weddingId: weddingId, taskId: taskId)
    }
    public func getGuests() async throws -> [Guest] { try await source.getGuests(weddingId: weddingId) }
    public func getBudget() async throws -> BudgetSummary { try await source.getBudget(weddingId: weddingId) }
    public func checkInGuest(qrPayload: String, count: Int, usherId: String) async throws -> CheckInVerificationResult {
        try await source.checkInGuest(weddingId: weddingId, qrPayload: qrPayload, count: count, usherId: usherId)
    }
    public func searchGuests(query: String) async throws -> [Guest] {
        try await source.searchGuests(weddingId: weddingId, query: query)
    }
    public func getAuditRecords() async throws -> [CheckInAuditRecord] { try await source.getAuditRecords(weddingId: weddingId) }
    public func getVendors() async throws -> [VendorPresence] { try await source.getVendors(weddingId: weddingId) }
    public func updateVendorState(id: String, state: VendorPresenceState) async throws -> VendorPresence {
        try await source.updateVendorState(weddingId: weddingId, id: id, state: state)
    }
    public func getAnnouncements() async throws -> [WeddingAnnouncement] { try await source.getAnnouncements(weddingId: weddingId) }
    public func postAnnouncement(title: String, message: String, urgency: AnnouncementUrgency) async throws -> WeddingAnnouncement {
        try await source.postAnnouncement(weddingId: weddingId, title: title, message: message, urgency: urgency)
    }

    public func snapshotManifest() async throws -> UatSnapshotManifest? {
        try await source.snapshotManifest()
    }
    public func getRsvpDetail(guestId: String) async throws -> GuestRsvpDetail? {
        try await source.getRsvpDetail(weddingId: weddingId, guestId: guestId)
    }
    public func getGuestContact(guestId: String) async throws -> GuestContactDetail? {
        try await source.getGuestContact(weddingId: weddingId, guestId: guestId)
    }
    public func getWeddingContent() async throws -> [WeddingContentEntry] {
        try await source.getWeddingContent(weddingId: weddingId)
    }
    public func getContentRevisions() async throws -> [ContentRevisionRecord] {
        try await source.getContentRevisions(weddingId: weddingId)
    }
    public func getSongs() async throws -> [SongEntry] { try await source.getSongs(weddingId: weddingId) }
    public func getQrDestinations() async throws -> [QrDestination] {
        try await source.getQrDestinations(weddingId: weddingId)
    }
    public func getImportJobs() async throws -> [ImportJobRecord] {
        try await source.getImportJobs(weddingId: weddingId)
    }
    public func getWallMessages() async throws -> [WallMessage] {
        try await source.getWallMessages(weddingId: weddingId)
    }
    public func getEngagementParties() async throws -> [EngagementPartyRecord] {
        try await source.getEngagementParties(weddingId: weddingId)
    }
    public func getAuditEvents() async throws -> [AuditEventRecord] {
        try await source.getAuditEvents(weddingId: weddingId)
    }
    public func plannerAccessContext() async throws -> PlannerAccessContext? {
        try await source.plannerAccessContext(weddingId: weddingId)
    }
    public func adminAccessContext() async throws -> AdminAccessContext? {
        try await source.adminAccessContext()
    }

    /// Content for one section, ordered, with a display title.
    public func getWeddingContentSection(_ section: String) async throws -> WeddingContentSection {
        let entries = try await getWeddingContent()
            .filter { $0.section == section }
            .sorted { $0.order < $1.order }
        return WeddingContentSection(section: section,
                                     title: WeddingContentSection.titleFor(section),
                                     entries: entries)
    }

    /// Every populated content section, in the couple's order.
    public func getWeddingContentSections() async throws -> [WeddingContentSection] {
        let grouped = Dictionary(grouping: try await getWeddingContent()) { $0.section }
        return grouped
            .map { section, entries in
                WeddingContentSection(section: section,
                                      title: WeddingContentSection.titleFor(section),
                                      entries: entries.sorted { $0.order < $1.order })
            }
            .sorted { $0.section < $1.section }
    }

    public func resolveGuestIdentity(token: String) async throws -> GuestIdentity? {
        try await source.resolveGuestIdentity(token: token)
    }
    public func getWeddingPass(token: String) async throws -> WeddingPass { try await source.getWeddingPass(token: token) }
    public func resolveInvitation(weddingSlug: String, token: String) async throws -> InvitationContext {
        try await source.resolveInvitation(weddingSlug: weddingSlug, token: token)
    }
    public func confirmRsvp(weddingSlug: String, token: String, attending: Bool) async throws -> WeddingPass {
        try await source.confirmRsvp(weddingSlug: weddingSlug, token: token, attending: attending)
    }
}

public extension WeddingRepositoryProtocol {
    /// Binds this source to one wedding, failing fast when the source cannot serve it.
    func forWedding(_ weddingId: String) async throws -> ScopedWeddingRepository {
        let available = try await availableWeddingIds()
        guard available.contains(weddingId) else {
            throw WeddingScopeMismatch(requestedWeddingId: weddingId, availableWeddingIds: available)
        }
        return ScopedWeddingRepository(source: self, weddingId: weddingId)
    }

    /// Binds a single-wedding source to the one wedding it serves.
    /// Still resolved and validated through `forWedding`, never bypassed.
    func forOnlyWedding() async throws -> ScopedWeddingRepository {
        let available = try await availableWeddingIds()
        guard available.count == 1, let only = available.first else {
            throw WeddingScopeMismatch(requestedWeddingId: "<single>", availableWeddingIds: available)
        }
        return try await forWedding(only)
    }
}

public actor FixtureWeddingRepository: WeddingRepositoryProtocol {

    public func availableWeddingIds() async throws -> [String] { [wedding.id] }

    public func resolveGuestIdentity(token: String) async throws -> GuestIdentity? {
        // The fixture issues exactly one pass; only its token identifies a guest.
        guard token == pass.token else { return nil }
        guard let guest = guests.first(where: { g in
            guard let serial = g.passSerial else { return false }
            return pass.qrPayload.contains(serial)
        }) else { return nil }
        return GuestIdentity(guestId: guest.id, guestName: guest.name, weddingId: wedding.id, passToken: token)
    }

    /// Rejects a request for any wedding this source does not hold (P0-1).
    private func requireScope(_ weddingId: String) throws {
        guard weddingId == wedding.id else {
            throw WeddingScopeMismatch(requestedWeddingId: weddingId, availableWeddingIds: [wedding.id])
        }
    }
    private var wedding: Wedding
    private var tasks: [PlannerTask]
    private var guests: [Guest]
    private var budget: BudgetSummary
    private var pass: WeddingPass
    private var auditRecords: [CheckInAuditRecord] = []

    public init() {
        self.wedding = Wedding(
            id: "wed_tariro_shadreck_2026",
            coupleNames: "Tariro & Shadreck",
            date: "2026-10-24T14:00:00Z",
            venueName: "Imba Manor Estate",
            venueAddress: "Glen Lorne, Harare",
            city: "Harare",
            country: "Zimbabwe",
            lifecycle: "before",
            programme: [
                ProgrammeItem(id: "p1", title: "Guest Arrival", time: "13:15", location: "Manor Gardens", description: "Welcome iced tea"),
                ProgrammeItem(id: "p2", title: "Ceremony & Vows", time: "14:00", location: "Chapel on the Hill", description: "Marriage register signing"),
                ProgrammeItem(id: "p3", title: "Cocktail Hour", time: "15:30", location: "Pavilion Terrace", description: "Canapés and jazz"),
                ProgrammeItem(id: "p4", title: "Grand Reception", time: "17:30", location: "The Grand Ballroom", description: "Dinner and dancing"),
                ProgrammeItem(id: "p5", title: "After Party", time: "21:30", location: "The Courtyard", description: "DJ and sparklers")
            ]
        )

        self.tasks = [
            PlannerTask(id: "task_1", title: "Finalize seating chart with venue manager", status: .inProgress, priority: .urgent, category: "Venue & Seating", dueDate: "2026-10-15"),
            PlannerTask(id: "task_2", title: "Order printed QR cardstock passes for elders", status: .todo, priority: .high, category: "Invitations", dueDate: "2026-10-10"),
            PlannerTask(id: "task_3", title: "Confirm shuttle pickups at Meikles Hotel", status: .todo, priority: .medium, category: "Logistics", dueDate: "2026-10-18"),
            PlannerTask(id: "task_4", title: "Sample 3-tier red velvet and lemon drizzle cake", status: .done, priority: .high, category: "Catering", dueDate: "2026-09-20"),
            PlannerTask(id: "task_5", title: "Finalize Songbook playlist with DJ", status: .done, priority: .low, category: "Entertainment", dueDate: "2026-09-25")
        ]

        self.guests = [
            Guest(id: "gst_1", name: "Jane & Michael Doe", householdName: "Doe Household", partySize: 2, side: "Bride", rsvpStatus: .attending, tableNumber: 8, tableName: "Jacaranda — 8", checkedIn: false, checkedInCount: 0, passSerial: "WWJD0824"),
            Guest(id: "gst_2", name: "Musarurwa Family", householdName: "Musarurwa Household", partySize: 4, side: "Groom", rsvpStatus: .attending, tableNumber: 1, tableName: "Baobab — 1", checkedIn: false, checkedInCount: 0, passSerial: "WWMF0104"),
            Guest(id: "gst_3", name: "Sarah Moyo", householdName: "Sarah Moyo", partySize: 1, side: "Bride", rsvpStatus: .attending, tableNumber: 8, tableName: "Jacaranda — 8", checkedIn: true, checkedInCount: 1, passSerial: "WWSM0801"),
            Guest(id: "gst_4", name: "Tendai Chikore", householdName: "Chikore Household", partySize: 2, side: "Groom", rsvpStatus: .pending, tableNumber: 3, tableName: "Acacia — 3", checkedIn: false, checkedInCount: 0, passSerial: "WWTC0302")
        ]

        self.budget = BudgetSummary(
            currency: "USD",
            totalBudget: 35000,
            totalAllocated: 32400,
            totalPaid: 24800,
            categories: [
                BudgetCategory(name: "Venue & Decor", allocated: 12000, spent: 10500),
                BudgetCategory(name: "Catering & Bar", allocated: 9500, spent: 7200),
                BudgetCategory(name: "Photography & Video", allocated: 4200, spent: 3500),
                BudgetCategory(name: "Attire & Rings", allocated: 3800, spent: 2100),
                BudgetCategory(name: "Music & Sound", allocated: 2900, spent: 1500)
            ]
        )

        self.pass = WeddingPass(
            token: "w1-j8doe-7x9",
            weddingId: "wed_tariro_shadreck_2026",
            coupleNames: "Tariro & Shadreck",
            weddingDate: "2026-10-24T14:00:00Z",
            venueName: "Imba Manor Estate",
            venueAddress: "Glen Lorne, Harare",
            guestName: "Jane & Michael Doe",
            householdName: "Doe Household",
            partySize: 2,
            tableNumber: 8,
            tableName: "Jacaranda — 8",
            seatNumber: "Seats 3 & 4",
            currentStage: .attending,
            qrPayload: "WW1.wedts26.WWJD0824.0e.66f001ab.3f9a7c2b4d1e809f"
        )
    }

    public func getWedding(weddingId: String) async throws -> Wedding {
        try requireScope(weddingId)
        return wedding
    }

    public func getTasks(weddingId: String) async throws -> [PlannerTask] {
        try requireScope(weddingId)
        return tasks
    }

    public func createTask(weddingId: String, title: String, priority: TaskPriority, category: String) async throws -> PlannerTask {
        try requireScope(weddingId)
        let newTask = PlannerTask(
            id: "task_\(UUID().uuidString.prefix(8))",
            title: title,
            status: .todo,
            priority: priority,
            category: category
        )
        tasks.append(newTask)
        return newTask
    }

    public func toggleTask(weddingId: String, taskId: String) async throws -> PlannerTask {
        try requireScope(weddingId)
        guard let index = tasks.firstIndex(where: { $0.id == taskId }) else {
            throw NSError(domain: "Wewed", code: 404, userInfo: [NSLocalizedDescriptionKey: "Task not found"])
        }
        let current = tasks[index]
        let nextStatus: TaskStatus = (current.status == .done) ? .todo : .done
        tasks[index].status = nextStatus
        return tasks[index]
    }

    public func getGuests(weddingId: String) async throws -> [Guest] {
        try requireScope(weddingId)
        return guests
    }

    public func getBudget(weddingId: String) async throws -> BudgetSummary {
        try requireScope(weddingId)
        return budget
    }

    public func getWeddingPass(token: String) async throws -> WeddingPass {
        return pass
    }

    public func getAuditRecords(weddingId: String) async throws -> [CheckInAuditRecord] {
        try requireScope(weddingId)
        return auditRecords
    }

    public func searchGuests(weddingId: String, query: String) async throws -> [Guest] {
        try requireScope(weddingId)
        if query.trimmingCharacters(in: .whitespaces).isEmpty {
            return guests
        }
        let lower = query.lowercased()
        return guests.filter {
            $0.name.lowercased().contains(lower) ||
            ($0.householdName?.lowercased().contains(lower) ?? false) ||
            ($0.tableName?.lowercased().contains(lower) ?? false)
        }
    }

    public func checkInGuest(weddingId: String, qrPayload: String, count: Int, usherId: String) async throws -> CheckInVerificationResult {
        try requireScope(weddingId)
        guard let index = guests.firstIndex(where: { $0.passSerial != nil && qrPayload.contains($0.passSerial!) }) else {
            return CheckInVerificationResult(
                status: .invalidPass,
                guestName: "Unknown Guest",
                householdName: nil,
                partySize: 0,
                alreadyCheckedInCount: 0,
                remainingCount: 0,
                tableNumber: nil,
                tableName: nil,
                gateMessage: "Invalid Pass: No matching guest serial found in manifest."
            )
        }

        var target = guests[index]
        let alreadyAdmitted = target.checkedInCount
        let remaining = target.partySize - alreadyAdmitted

        if remaining <= 0 {
            return CheckInVerificationResult(
                status: .alreadyCheckedIn,
                guestName: target.name,
                householdName: target.householdName,
                partySize: target.partySize,
                alreadyCheckedInCount: alreadyAdmitted,
                remainingCount: 0,
                tableNumber: target.tableNumber,
                tableName: target.tableName,
                gateMessage: "Duplicate Gate Entry: Full party of \(target.partySize) has already entered."
            )
        }

        if count > remaining {
            return CheckInVerificationResult(
                status: .capacityExceeded,
                guestName: target.name,
                householdName: target.householdName,
                partySize: target.partySize,
                alreadyCheckedInCount: alreadyAdmitted,
                remainingCount: remaining,
                tableNumber: target.tableNumber,
                tableName: target.tableName,
                gateMessage: "Capacity Alert: Attempting to admit \(count), but only \(remaining) of \(target.partySize) remaining."
            )
        }

        let newCheckedInCount = alreadyAdmitted + count
        target.checkedInCount = newCheckedInCount
        target.checkedIn = true
        guests[index] = target

        let audit = CheckInAuditRecord(
            passSerial: target.passSerial ?? "UNKNOWN",
            guestName: target.name,
            countAdmitted: count,
            gateName: "Gate A — Main Entrance",
            usherId: usherId,
            scannedAt: Date(),
            isSynced: false
        )
        auditRecords.append(audit)

        let newRemaining = target.partySize - newCheckedInCount
        let status: CheckInVerificationResult.Status = (newRemaining == 0) ? .validPass : .partialCheckedIn
        let gateMsg = (newRemaining == 0)
            ? "Admitted: Full party (\(newCheckedInCount)/\(target.partySize)) cleared for entry."
            : "Admitted: Partial entry (\(count) admitted, \(newRemaining) remaining in party)."

        return CheckInVerificationResult(
            status: status,
            guestName: target.name,
            householdName: target.householdName,
            partySize: target.partySize,
            alreadyCheckedInCount: newCheckedInCount,
            remainingCount: newRemaining,
            tableNumber: target.tableNumber,
            tableName: target.tableName,
            gateMessage: gateMsg
        )
    }

    private var vendors: [VendorPresence] = [
        VendorPresence(id: "v1", vendorName: "Shandy Events", serviceCategory: "Décor & Florals", serviceArea: "Main Marquee", state: .arrived, expectedTime: "11:00"),
        VendorPresence(id: "v2", vendorName: "Kudzi Visuals", serviceCategory: "Photography & Drone", serviceArea: "Chapel & Gardens", state: .enRoute, expectedTime: "12:30"),
        VendorPresence(id: "v3", vendorName: "Crown Sound Zimbabwe", serviceCategory: "Sound & Audio", serviceArea: "Grand Ballroom", state: .serviceActive, expectedTime: "10:00")
    ]

    private var announcements: [WeddingAnnouncement] = [
        WeddingAnnouncement(id: "a1", title: "Welcome Drinks", message: "Welcome iced tea and mint water are now being served at the Manor Gardens.", urgency: .info, timestamp: Date()),
        WeddingAnnouncement(id: "a2", title: "Ceremony Seating", message: "All guests please make your way to the Chapel on the Hill. Doors open at 13:15.", urgency: .action, timestamp: Date())
    ]

    public func getVendors(weddingId: String) async throws -> [VendorPresence] {
        try requireScope(weddingId)
        return vendors
    }

    public func updateVendorState(weddingId: String, id: String, state: VendorPresenceState) async throws -> VendorPresence {
        try requireScope(weddingId)
        guard let index = vendors.firstIndex(where: { $0.id == id }) else {
            throw NSError(domain: "WeddingRepository", code: 404, userInfo: [NSLocalizedDescriptionKey: "Vendor not found"])
        }
        var updated = vendors[index]
        updated.state = state
        updated.lastUpdated = Date()
        vendors[index] = updated
        return updated
    }

    public func getAnnouncements(weddingId: String) async throws -> [WeddingAnnouncement] {
        try requireScope(weddingId)
        return announcements
    }

    public func postAnnouncement(weddingId: String, title: String, message: String, urgency: AnnouncementUrgency) async throws -> WeddingAnnouncement {
        try requireScope(weddingId)
        let ann = WeddingAnnouncement(title: title, message: message, urgency: urgency, timestamp: Date())
        announcements.insert(ann, at: 0)
        return ann
    }

    public func resolveInvitation(weddingSlug: String, token: String) async throws -> InvitationContext {
        return InvitationContext(
            weddingSlug: weddingSlug,
            guestToken: token,
            coupleNames: wedding.coupleNames,
            guestName: "Jane & Michael Doe",
            householdName: "Doe Household",
            partySize: 2,
            weddingDate: "Saturday, 24 October 2026",
            venueName: wedding.venueName,
            venueCity: "\(wedding.city), \(wedding.country)",
            cardStyle: "ivory-floral-gold",
            isConfirmed: false
        )
    }

    public func confirmRsvp(weddingSlug: String, token: String, attending: Bool) async throws -> WeddingPass {
        return pass
    }
}

