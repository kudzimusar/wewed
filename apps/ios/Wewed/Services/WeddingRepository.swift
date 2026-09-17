import Foundation

public protocol WeddingRepositoryProtocol: Sendable {
    func getWedding() async throws -> Wedding
    func getTasks() async throws -> [PlannerTask]
    func createTask(title: String, priority: TaskPriority, category: String) async throws -> PlannerTask
    func toggleTask(taskId: String) async throws -> PlannerTask
    func getGuests() async throws -> [Guest]
    func getBudget() async throws -> BudgetSummary
    func getWeddingPass(token: String) async throws -> WeddingPass
    func checkInGuest(qrPayload: String, count: Int, usherId: String) async throws -> CheckInVerificationResult
    func searchGuests(query: String) async throws -> [Guest]
    func getAuditRecords() async throws -> [CheckInAuditRecord]
}

public actor FixtureWeddingRepository: WeddingRepositoryProtocol {
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

    public func getWedding() async throws -> Wedding {
        return wedding
    }

    public func getTasks() async throws -> [PlannerTask] {
        return tasks
    }

    public func createTask(title: String, priority: TaskPriority, category: String) async throws -> PlannerTask {
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

    public func toggleTask(taskId: String) async throws -> PlannerTask {
        guard let index = tasks.firstIndex(where: { $0.id == taskId }) else {
            throw NSError(domain: "Wewed", code: 404, userInfo: [NSLocalizedDescriptionKey: "Task not found"])
        }
        let current = tasks[index]
        let nextStatus: TaskStatus = (current.status == .done) ? .todo : .done
        tasks[index].status = nextStatus
        return tasks[index]
    }

    public func getGuests() async throws -> [Guest] {
        return guests
    }

    public func getBudget() async throws -> BudgetSummary {
        return budget
    }

    public func getWeddingPass(token: String) async throws -> WeddingPass {
        return pass
    }

    public func getAuditRecords() async throws -> [CheckInAuditRecord] {
        return auditRecords
    }

    public func searchGuests(query: String) async throws -> [Guest] {
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

    public func checkInGuest(qrPayload: String, count: Int, usherId: String) async throws -> CheckInVerificationResult {
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
}
