import Foundation

/// Sanitized, internally coherent reference implementation for the
/// Charity & Kudzie / Eleven Eleven Testing shadow scenario.
///
/// IMPORTANT:
/// - This is not a production snapshot.
/// - Values are synthetic and intentionally non-identifying.
/// - Gate credentials are development-only placeholders; canonical production
///   pass verification remains WW2 ECDSA and is not replaced by this repository.
public actor ShadowReferenceWeddingRepository: WeddingRepositoryProtocol {
    private var wedding: Wedding
    private var tasks: [PlannerTask]
    private var guests: [Guest]
    private var budget: BudgetSummary
    private var auditRecords: [CheckInAuditRecord] = []
    private var vendors: [VendorPresence]
    private var announcements: [WeddingAnnouncement]

    private let primaryPassSerial = "SHDWGSTA01"
    private let attendingToken = "shadow-attending-guest"
    private let pendingToken = "shadow-pending-guest"
    private let declinedToken = "shadow-declined-guest"

    public init() {
        wedding = Wedding(
            id: "shadow_ref_charity_kudzie",
            coupleNames: "Charity & Kudzie",
            date: "pending-production-discovery",
            venueName: "Reference Venue",
            venueAddress: "Sanitized venue address",
            city: "Reference City",
            country: "Zimbabwe",
            lifecycle: "before",
            programme: [
                ProgrammeItem(id: "shadow_p1", title: "Guest Arrival", time: "13:15", location: "Main Gate", description: "Guest welcome and gate admission"),
                ProgrammeItem(id: "shadow_p2", title: "Ceremony", time: "14:00", location: "Ceremony Area", description: "Ceremony programme"),
                ProgrammeItem(id: "shadow_p3", title: "Photography & Cocktails", time: "15:30", location: "Garden", description: "Portraits and guest refreshments"),
                ProgrammeItem(id: "shadow_p4", title: "Reception", time: "17:30", location: "Reception Space", description: "Dinner and celebration")
            ]
        )

        tasks = [
            PlannerTask(id: "shadow_task_1", title: "Resolve overdue venue readiness items", status: .blocked, priority: .urgent, category: "Venue & Logistics", dueDate: nil),
            PlannerTask(id: "shadow_task_2", title: "Follow up pending guest responses", status: .inProgress, priority: .high, category: "Guests & RSVP", dueDate: nil),
            PlannerTask(id: "shadow_task_3", title: "Complete remaining seating assignments", status: .inProgress, priority: .high, category: "Seating", dueDate: nil),
            PlannerTask(id: "shadow_task_4", title: "Review vendor contract decision", status: .todo, priority: .high, category: "Vendors", dueDate: nil),
            PlannerTask(id: "shadow_task_5", title: "Confirm final reception timeline", status: .todo, priority: .medium, category: "Timeline", dueDate: nil),
            PlannerTask(id: "shadow_task_6", title: "Invitation artwork and guest journey review", status: .done, priority: .high, category: "Invitations", dueDate: nil)
        ]

        guests = [
            Guest(id: "shadow_guest_a", name: "Guest Household A", householdName: "Household A", partySize: 2, side: "Couple", rsvpStatus: .attending, tableNumber: 2, tableName: "Jacaranda", checkedIn: false, checkedInCount: 0, passSerial: primaryPassSerial),
            Guest(id: "shadow_guest_b", name: "Guest Household B", householdName: "Household B", partySize: 4, side: "Couple", rsvpStatus: .attending, tableNumber: 1, tableName: "Baobab", checkedIn: false, checkedInCount: 0, passSerial: "SHDWGSTB04"),
            Guest(id: "shadow_guest_c", name: "Guest C", householdName: nil, partySize: 1, side: "Couple", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_d", name: "Guest Household D", householdName: "Household D", partySize: 3, side: "Couple", rsvpStatus: .declined, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil)
        ]

        budget = BudgetSummary(
            currency: "USD",
            totalBudget: 20000,
            totalAllocated: 19300,
            totalPaid: 13500,
            categories: [
                BudgetCategory(name: "Venue & Catering", allocated: 11800, spent: 8000),
                BudgetCategory(name: "Photography & Video", allocated: 3500, spent: 3500),
                BudgetCategory(name: "Decor & Florals", allocated: 3200, spent: 1500),
                BudgetCategory(name: "Music & Sound", allocated: 800, spent: 500)
            ]
        )

        vendors = [
            VendorPresence(id: "shadow_vendor_venue", vendorName: "Shadow Venue Partner", serviceCategory: "Venue & Catering", serviceArea: "Main Venue", state: .scheduled, expectedTime: "10:00"),
            VendorPresence(id: "shadow_vendor_visuals", vendorName: "Shadow Visuals", serviceCategory: "Photography & Video", serviceArea: "Preparation & Ceremony", state: .scheduled, expectedTime: "12:30"),
            VendorPresence(id: "shadow_vendor_decor", vendorName: "Shadow Events", serviceCategory: "Decor & Florals", serviceArea: "Ceremony & Reception", state: .scheduled, expectedTime: "09:30"),
            VendorPresence(id: "shadow_vendor_sound", vendorName: "Shadow Sound", serviceCategory: "Music & Sound", serviceArea: "Reception", state: .scheduled, expectedTime: "11:00")
        ]

        announcements = [
            WeddingAnnouncement(id: "shadow_ann_1", title: "Planning Environment", message: "This is a sanitized Shadow reference wedding. No production guests or vendors are being contacted.", urgency: .info),
            WeddingAnnouncement(id: "shadow_ann_2", title: "Invitation Flow Ready", message: "The Ivory Floral Gold invitation can be exercised before Wedding Pass access.", urgency: .info)
        ]
    }

    public func getWedding() async throws -> Wedding { wedding }
    public func getTasks() async throws -> [PlannerTask] { tasks }
    public func getGuests() async throws -> [Guest] { guests }
    public func getBudget() async throws -> BudgetSummary { budget }
    public func getAuditRecords() async throws -> [CheckInAuditRecord] { auditRecords }
    public func getVendors() async throws -> [VendorPresence] { vendors }
    public func getAnnouncements() async throws -> [WeddingAnnouncement] { announcements }

    public func createTask(title: String, priority: TaskPriority, category: String) async throws -> PlannerTask {
        let task = PlannerTask(id: "shadow_task_\(UUID().uuidString.prefix(8))", title: title, status: .todo, priority: priority, category: category)
        tasks.append(task)
        return task
    }

    public func toggleTask(taskId: String) async throws -> PlannerTask {
        guard let index = tasks.firstIndex(where: { $0.id == taskId }) else {
            throw NSError(domain: "ShadowReferenceWeddingRepository", code: 404, userInfo: [NSLocalizedDescriptionKey: "Task not found"])
        }
        tasks[index].status = tasks[index].status == .done ? .todo : .done
        return tasks[index]
    }

    public func getWeddingPass(token: String) async throws -> WeddingPass {
        let guest = try guestForToken(token)
        guard guest.rsvpStatus == .attending else {
            throw NSError(
                domain: "ShadowReferenceWeddingRepository",
                code: 403,
                userInfo: [NSLocalizedDescriptionKey: "Wedding Pass is available only to attending guests in Shadow."]
            )
        }
        return makePass(for: guest)
    }

    public func searchGuests(query: String) async throws -> [Guest] {
        let normalized = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else { return guests }
        return guests.filter {
            $0.name.lowercased().contains(normalized) ||
            ($0.householdName?.lowercased().contains(normalized) ?? false) ||
            ($0.tableName?.lowercased().contains(normalized) ?? false)
        }
    }

    public func checkInGuest(qrPayload: String, count: Int, usherId: String) async throws -> CheckInVerificationResult {
        guard let index = guests.firstIndex(where: { guest in
            guard let serial = guest.passSerial else { return false }
            return qrPayload.contains(serial)
        }) else {
            return CheckInVerificationResult(status: .invalidPass, guestName: "Unknown Guest", partySize: 0, alreadyCheckedInCount: 0, remainingCount: 0, gateMessage: "Shadow reference pass does not match an attending guest.")
        }

        var guest = guests[index]
        let remaining = max(0, guest.partySize - guest.checkedInCount)

        if remaining == 0 {
            return CheckInVerificationResult(status: .alreadyCheckedIn, guestName: guest.name, householdName: guest.householdName, partySize: guest.partySize, alreadyCheckedInCount: guest.checkedInCount, remainingCount: 0, tableNumber: guest.tableNumber, tableName: guest.tableName, gateMessage: "Duplicate Gate Entry: full shadow party already admitted.")
        }

        if count > remaining {
            return CheckInVerificationResult(status: .capacityExceeded, guestName: guest.name, householdName: guest.householdName, partySize: guest.partySize, alreadyCheckedInCount: guest.checkedInCount, remainingCount: remaining, tableNumber: guest.tableNumber, tableName: guest.tableName, gateMessage: "Capacity Alert: only \(remaining) guest(s) remain in this shadow party.")
        }

        guest.checkedInCount += count
        guest.checkedIn = guest.checkedInCount > 0
        guests[index] = guest

        auditRecords.append(CheckInAuditRecord(passSerial: guest.passSerial ?? "SHADOW", guestName: guest.name, countAdmitted: count, gateName: "Shadow Gate", usherId: usherId, isSynced: false))

        let newRemaining = max(0, guest.partySize - guest.checkedInCount)
        return CheckInVerificationResult(
            status: newRemaining == 0 ? .validPass : .partialCheckedIn,
            guestName: guest.name,
            householdName: guest.householdName,
            partySize: guest.partySize,
            alreadyCheckedInCount: guest.checkedInCount,
            remainingCount: newRemaining,
            tableNumber: guest.tableNumber,
            tableName: guest.tableName,
            gateMessage: newRemaining == 0 ? "Admitted: full shadow party cleared for entry." : "Admitted: partial shadow party arrival."
        )
    }

    public func updateVendorState(id: String, state: VendorPresenceState) async throws -> VendorPresence {
        guard let index = vendors.firstIndex(where: { $0.id == id }) else {
            throw NSError(domain: "ShadowReferenceWeddingRepository", code: 404, userInfo: [NSLocalizedDescriptionKey: "Vendor not found"])
        }
        vendors[index].state = state
        vendors[index].lastUpdated = Date()
        return vendors[index]
    }

    public func postAnnouncement(title: String, message: String, urgency: AnnouncementUrgency) async throws -> WeddingAnnouncement {
        let announcement = WeddingAnnouncement(title: title, message: message, urgency: urgency)
        announcements.insert(announcement, at: 0)
        return announcement
    }

    public func resolveInvitation(weddingSlug: String, token: String) async throws -> InvitationContext {
        let guest = try guestForToken(token)
        return InvitationContext(
            weddingSlug: weddingSlug,
            guestToken: token,
            coupleNames: wedding.coupleNames,
            guestName: guest.name,
            householdName: guest.householdName,
            partySize: guest.partySize,
            weddingDate: "Upcoming wedding",
            venueName: wedding.venueName,
            venueCity: "\(wedding.city), \(wedding.country)",
            cardStyle: "ivory-floral-gold",
            isConfirmed: guest.rsvpStatus == .attending
        )
    }

    public func confirmRsvp(weddingSlug: String, token: String, attending: Bool) async throws -> WeddingPass {
        guard let index = guestIndexForToken(token) else {
            throw NSError(
                domain: "ShadowReferenceWeddingRepository",
                code: 404,
                userInfo: [NSLocalizedDescriptionKey: "Shadow invitation token does not map to a reference guest."]
            )
        }

        var current = guests[index]
        current.rsvpStatus = attending ? .attending : .declined
        if attending && current.passSerial == nil {
            current.passSerial = "SHDW\(current.id.uppercased().suffix(8))"
        }
        guests[index] = current

        return attending ? makePass(for: current) : makeNonAdmissionPass(for: current)
    }

    private func guestIndexForToken(_ token: String) -> Int? {
        let guestId: String
        switch token {
        case attendingToken, "native-reference-guest":
            guestId = "shadow_guest_a"
        case pendingToken:
            guestId = "shadow_guest_c"
        case declinedToken:
            guestId = "shadow_guest_d"
        default:
            return nil
        }
        return guests.firstIndex(where: { $0.id == guestId })
    }

    private func guestForToken(_ token: String) throws -> Guest {
        guard let index = guestIndexForToken(token) else {
            throw NSError(
                domain: "ShadowReferenceWeddingRepository",
                code: 404,
                userInfo: [NSLocalizedDescriptionKey: "Unknown Shadow guest token."]
            )
        }
        return guests[index]
    }

    private func makePass(for guest: Guest) -> WeddingPass {
        let serial = guest.passSerial ?? primaryPassSerial
        return WeddingPass(
            token: "shadow-pass-\(guest.id)",
            weddingId: wedding.id,
            coupleNames: wedding.coupleNames,
            weddingDate: "Upcoming wedding",
            venueName: wedding.venueName,
            venueAddress: wedding.venueAddress,
            guestName: guest.name,
            householdName: guest.householdName,
            partySize: guest.partySize,
            tableNumber: guest.tableNumber,
            tableName: guest.tableName,
            seatNumber: guest.tableName == nil ? nil : "Shadow assignment",
            currentStage: .attending,
            qrPayload: "SHADOW_ONLY.WW2_PLACEHOLDER.\(serial).NOT_A_PRODUCTION_CREDENTIAL"
        )
    }

    private func makeNonAdmissionPass(for guest: Guest) -> WeddingPass {
        WeddingPass(
            token: "shadow-non-admission-\(guest.id)",
            weddingId: wedding.id,
            coupleNames: wedding.coupleNames,
            weddingDate: "Upcoming wedding",
            venueName: wedding.venueName,
            venueAddress: wedding.venueAddress,
            guestName: guest.name,
            householdName: guest.householdName,
            partySize: guest.partySize,
            currentStage: .invitation,
            qrPayload: "SHADOW_DECLINED_NO_ADMISSION"
        )
    }
}
