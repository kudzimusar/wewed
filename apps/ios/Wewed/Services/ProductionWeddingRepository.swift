import Foundation

/// Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8.
///
/// Real production adapter for a single, already-authorized, wedding-scoped grant (Couple, Planner,
/// or Coordinator — the permission difference between them is enforced server-side by the grant's
/// own permissions, never branched on here). Every read/write calls `/api/native/wedding/...`, which
/// re-resolves the grant fresh on every request — this type caches nothing across calls beyond the
/// `grantId`/`weddingId` it was constructed for.
///
/// Deliberately fail-closed for every method that belongs to Wedding Day / Usher-Gate operational
/// authority (master plan §19; Phase 10/11): `resolveGuestIdentity`, `checkInGuest`,
/// `updateVendorState`, `postAnnouncement`, `getWeddingPass`, `resolveInvitation`, `confirmRsvp`.
/// Those are unrelated to this phase's mature planning domains and must never silently start working
/// just because a wedding-scoped grant now renders through the real role shell.
///
/// `getVendors`/`getAnnouncements`/`getAuditRecords` are also Wedding-Day concepts (vendor
/// presence/arrival tracking, live announcements, check-in audit — not the planning-side Vendor
/// list, which is `ProductionPlannerDashboardRepository.getVendorEngagements`). They are required,
/// no-default `WeddingRepositoryProtocol` methods that `WeddingGraphState.load` (the
/// `rememberWeddingGraph` equivalent) calls unconditionally inside one shared, un-caught
/// `do`/`catch` alongside Tasks/Budget/Guests — throwing here would clear the whole graph, not just
/// these fields. Returning an honest empty list is the same idiom this protocol's own default
/// extension already documents for "a source that holds none of this".
public struct ProductionWeddingRepository: WeddingRepositoryProtocol {
    private let client: NativeDomainApiClient
    private let sessionToken: String
    private let grantId: String
    private let weddingId: String

    public init(client: NativeDomainApiClient, sessionToken: String, grantId: String, weddingId: String) {
        self.client = client
        self.sessionToken = sessionToken
        self.grantId = grantId
        self.weddingId = weddingId
    }

    private func denied<T>() throws -> T { throw ProductionReadOnlyDomainError.unavailable }

    public func availableWeddingIds() async throws -> [String] { [weddingId] }

    public func resolveGuestIdentity(token: String) async throws -> GuestIdentity? { try denied() }

    public func getWedding(weddingId: String) async throws -> Wedding {
        guard case let .success(overview) = await client.overview(sessionToken: sessionToken, grantId: grantId) else {
            throw ProductionReadOnlyDomainError.unavailable
        }
        guard let weddingJSON = overview.wwObject("wedding") else {
            throw ProductionReadOnlyDomainError.unavailable
        }
        guard case let .success(timelineArray) = await client.timeline(sessionToken: sessionToken, grantId: grantId) else {
            throw ProductionReadOnlyDomainError.unavailable
        }
        let programme = timelineArray.map { $0.wwProgrammeItem() }
        return Wedding(
            id: weddingJSON.wwRequiredString("id"),
            coupleNames: weddingJSON.wwString("coupleNames") ?? "",
            date: weddingJSON.wwString("date") ?? "",
            venueName: weddingJSON.wwString("venue") ?? "",
            venueAddress: "",
            city: "",
            country: "",
            lifecycle: weddingJSON.wwString("lifecycle") ?? "",
            programme: programme
        )
    }

    public func getTasks(weddingId: String) async throws -> [PlannerTask] {
        guard case let .success(array) = await client.tasks(sessionToken: sessionToken, grantId: grantId) else {
            throw ProductionReadOnlyDomainError.unavailable
        }
        return array.map { $0.wwPlannerTask() }
    }

    public func createTask(weddingId: String, title: String, priority: TaskPriority, category: String) async throws -> PlannerTask {
        let body: NativeJSONObject = ["title": title, "priority": priority.rawValue, "category": category]
        guard case let .success(json) = await client.createTask(sessionToken: sessionToken, grantId: grantId, body: body) else {
            throw ProductionReadOnlyDomainError.unavailable
        }
        return json.wwPlannerTask()
    }

    public func toggleTask(weddingId: String, taskId: String) async throws -> PlannerTask {
        // Mirrors the PWA/native protocol's own toggle semantics (done <-> todo); the server is the
        // one source of truth for the CURRENT status, so this reads it fresh rather than assuming.
        guard let current = try await getTasks(weddingId: weddingId).first(where: { $0.id == taskId }) else {
            throw NSError(domain: "Wewed", code: 404, userInfo: [NSLocalizedDescriptionKey: "Task not found"])
        }
        let nextStatus: TaskStatus = current.status == .done ? .todo : .done
        let body: NativeJSONObject = ["status": nextStatus.rawValue]
        guard case let .success(json) = await client.updateTask(sessionToken: sessionToken, grantId: grantId, taskId: taskId, body: body) else {
            throw ProductionReadOnlyDomainError.unavailable
        }
        return json.wwPlannerTask()
    }

    public func getGuests(weddingId: String) async throws -> [Guest] {
        guard case let .success(array) = await client.guests(sessionToken: sessionToken, grantId: grantId) else {
            throw ProductionReadOnlyDomainError.unavailable
        }
        return array.map { $0.wwGuest() }
    }

    public func getBudget(weddingId: String) async throws -> BudgetSummary {
        guard case let .success(root) = await client.budget(sessionToken: sessionToken, grantId: grantId) else {
            throw ProductionReadOnlyDomainError.unavailable
        }
        let totals = root.wwObject("totals") ?? [:]
        let categories = (totals.wwArray("categories") ?? []).map { item in
            BudgetCategory(
                name: item.wwString("category") ?? "",
                allocated: item.wwDouble("estimated") ?? 0,
                spent: item.wwDouble("actual") ?? 0
            )
        }
        return BudgetSummary(
            currency: totals.wwString("currency") ?? "USD",
            totalBudget: totals.wwDouble("totalEstimated") ?? 0,
            totalAllocated: totals.wwDouble("totalEstimated") ?? 0,
            totalPaid: totals.wwDouble("totalPaid") ?? 0,
            categories: categories
        )
    }

    public func searchGuests(weddingId: String, query: String) async throws -> [Guest] {
        guard case let .success(array) = await client.guests(sessionToken: sessionToken, grantId: grantId, query: query) else {
            throw ProductionReadOnlyDomainError.unavailable
        }
        return array.map { $0.wwGuest() }
    }

    public func checkInGuest(weddingId: String, qrPayload: String, count: Int, usherId: String) async throws -> CheckInVerificationResult { try denied() }
    public func getAuditRecords(weddingId: String) async throws -> [CheckInAuditRecord] { [] }
    public func getVendors(weddingId: String) async throws -> [VendorPresence] { [] }
    public func updateVendorState(weddingId: String, id: String, state: VendorPresenceState) async throws -> VendorPresence { try denied() }
    public func getAnnouncements(weddingId: String) async throws -> [WeddingAnnouncement] { [] }
    public func postAnnouncement(weddingId: String, title: String, message: String, urgency: AnnouncementUrgency) async throws -> WeddingAnnouncement { try denied() }
    public func getWeddingPass(token: String) async throws -> WeddingPass { try denied() }
    public func resolveInvitation(weddingSlug: String, token: String) async throws -> InvitationContext { try denied() }
    public func confirmRsvp(weddingSlug: String, token: String, attending: Bool) async throws -> WeddingPass { try denied() }
}

extension NativeJSONObject {
    func wwPlannerTask() -> PlannerTask {
        PlannerTask(
            id: wwRequiredString("id"),
            title: wwRequiredString("title"),
            status: TaskStatus(rawValue: wwString("status") ?? "todo") ?? .todo,
            priority: TaskPriority(rawValue: wwString("priority") ?? "medium") ?? .medium,
            category: wwString("category") ?? "other",
            dueDate: wwString("dueDate")?.wwNilIfBlank,
            description: wwString("description")?.wwNilIfBlank,
            assignee: wwString("assignee")?.wwNilIfBlank
        )
    }

    func wwGuest() -> Guest {
        Guest(
            id: wwRequiredString("id"),
            name: wwRequiredString("name"),
            householdName: nil,
            partySize: 1,
            side: wwString("side")?.wwNilIfBlank,
            rsvpStatus: RSVPStatus(rawValue: wwString("rsvpStatus") ?? "pending") ?? .pending,
            tableNumber: wwInt("tableNumber"),
            tableName: wwString("tableName")?.wwNilIfBlank,
            checkedIn: wwBool("checkedIn") ?? false,
            checkedInCount: 0,
            passSerial: nil
        )
    }

    func wwProgrammeItem() -> ProgrammeItem {
        ProgrammeItem(
            id: wwRequiredString("id"),
            title: wwRequiredString("title"),
            time: wwString("time") ?? "",
            location: wwString("location") ?? "",
            description: wwString("description") ?? ""
        )
    }
}

extension String {
    var wwNilIfBlank: String? {
        trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : self
    }
}
