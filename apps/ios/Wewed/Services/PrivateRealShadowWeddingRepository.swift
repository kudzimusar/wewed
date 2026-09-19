import Foundation

/// Production-derived Private Real Shadow implementation for authentic Charity & Kudzie UAT testing.
/// Loads the authentic private row-level snapshot from local protected storage.
/// Fails explicitly if the private real shadow file is missing (no silent fallback).
public actor PrivateRealShadowWeddingRepository: WeddingRepositoryProtocol {
    private var wedding: Wedding
    private var tasks: [PlannerTask]
    private var guests: [Guest]
    private var budget: BudgetSummary
    private var auditRecords: [CheckInAuditRecord] = []
    private var vendors: [VendorPresence]
    private var announcements: [WeddingAnnouncement]

    private let attendingToken = "shadow-attending-guest"
    private let pendingToken = "shadow-pending-guest"
    private let declinedToken = "shadow-declined-guest"
    private let partyFourToken = "shadow-party4-guest"

    public static func defaultSnapshotPath() -> String {
        if let envPath = ProcessInfo.processInfo.environment["WEWED_PRIVATE_SHADOW_PATH"], !envPath.isEmpty, FileManager.default.fileExists(atPath: envPath) {
            return envPath
        }

        // Check Documents Directory (e.g. provisioned in app container)
        if let docsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
            let docsPath = docsDir.appendingPathComponent("charity-kudzie-private-real-shadow.json").path
            if FileManager.default.fileExists(atPath: docsPath) {
                return docsPath
            }
        }

        // Check Application Support Directory
        if let appSupportDir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first {
            let appSupportPath = appSupportDir.appendingPathComponent("wewed/charity-kudzie-private-real-shadow.json").path
            if FileManager.default.fileExists(atPath: appSupportPath) {
                return appSupportPath
            }
        }

        // Check standard user home directory
        let homePath = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".wewed-shadow/charity-kudzie/charity-kudzie-private-real-shadow.json")
            .path
        if FileManager.default.fileExists(atPath: homePath) {
            return homePath
        }

        return ProcessInfo.processInfo.environment["WEWED_PRIVATE_SHADOW_PATH"] ?? homePath
    }

    public static func loadSnapshotData(path: String = defaultSnapshotPath()) throws -> Data {
        let fileURL = URL(fileURLWithPath: path)
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing(
                "Private real shadow fixture not found at \(path). Set WEWED_PRIVATE_SHADOW_PATH or place file at ~/.wewed-shadow/charity-kudzie/charity-kudzie-private-real-shadow.json. Falling back to demo data is strictly prohibited."
            )
        }
        return try Data(contentsOf: fileURL)
    }

    public init(jsonData: Data? = nil, path: String = defaultSnapshotPath()) throws {
        let data: Data
        if let provided = jsonData {
            data = provided
        } else {
            data = try Self.loadSnapshotData(path: path)
        }

        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Invalid JSON format in private real shadow fixture.")
        }

        // 1. Wedding
        guard let weddingDict = json["wedding"] as? [String: Any],
              let weddingId = weddingDict["id"] as? String, !weddingId.isEmpty,
              let coupleTitle = weddingDict["title"] as? String, !coupleTitle.isEmpty,
              let dateStr = weddingDict["dateRaw"] as? String, !dateStr.isEmpty,
              let venueStr = weddingDict["venue"] as? String, !venueStr.isEmpty,
              let cityStr = weddingDict["venueCity"] as? String, !cityStr.isEmpty,
              let countryStr = weddingDict["venueCountry"] as? String, !countryStr.isEmpty,
              let lifecycleStr = weddingDict["lifecycle"] as? String, !lifecycleStr.isEmpty else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required wedding metadata missing in private real shadow fixture.")
        }

        // 2. Programme
        guard let progRaw = json["programme"] as? [[String: Any]] else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required programme list missing in private real shadow fixture.")
        }
        let progItems: [ProgrammeItem] = try progRaw.map { item in
            guard let id = item["id"] as? String, !id.isEmpty,
                  let title = item["title"] as? String, !title.isEmpty,
                  let time = item["time"] as? String, !time.isEmpty else {
                throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required programme item fields missing in private real shadow fixture.")
            }
            let loc = (item["location"] as? String) ?? venueStr
            let desc = (item["description"] as? String) ?? ""
            return ProgrammeItem(id: id, title: title, time: time, location: loc, description: desc)
        }

        self.wedding = Wedding(
            id: weddingId,
            coupleNames: coupleTitle,
            date: dateStr,
            venueName: venueStr,
            venueAddress: "\(venueStr), \(cityStr)",
            city: cityStr,
            country: countryStr,
            lifecycle: lifecycleStr,
            programme: progItems
        )

        // 3. Tasks
        guard let tasksRaw = json["tasks"] as? [[String: Any]] else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required tasks list missing in private real shadow fixture.")
        }
        self.tasks = try tasksRaw.map { item in
            guard let id = item["id"] as? String, !id.isEmpty,
                  let title = item["title"] as? String, !title.isEmpty,
                  let statusRaw = item["status"] as? String, !statusRaw.isEmpty,
                  let priorityRaw = item["priority"] as? String, !priorityRaw.isEmpty,
                  let category = item["category"] as? String, !category.isEmpty else {
                throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required task fields missing in private real shadow fixture.")
            }
            let dueDate = item["dueDate"] as? String

            let status: TaskStatus
            switch statusRaw.lowercased() {
            case "done", "completed": status = .done
            case "in_progress", "inprogress": status = .inProgress
            case "blocked": status = .blocked
            default: status = .todo
            }

            let priority: TaskPriority
            switch priorityRaw.lowercased() {
            case "high", "urgent": priority = .high
            case "low": priority = .low
            default: priority = .medium
            }

            return PlannerTask(id: id, title: title, status: status, priority: priority, category: category, dueDate: dueDate)
        }

        // Table mapping
        let tablesRaw = json["seatingTables"] as? [[String: Any]] ?? []
        var tableMap: [String: String] = [:]
        for tbl in tablesRaw {
            if let tId = tbl["id"] as? String, let tName = tbl["name"] as? String {
                tableMap[tId] = tName
            }
        }

        // 4. Guests
        guard let guestsRaw = json["guests"] as? [[String: Any]] else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required guests list missing in private real shadow fixture.")
        }
        self.guests = try guestsRaw.map { item in
            guard let id = item["id"] as? String, !id.isEmpty,
                  let name = item["name"] as? String, !name.isEmpty,
                  let rsvpRaw = item["rsvpStatus"] as? String, !rsvpRaw.isEmpty,
                  let partySize = item["partySize"] as? Int,
                  let checkedIn = item["checkedIn"] as? Bool else {
                throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required guest fields missing in private real shadow fixture.")
            }
            let rawSide = (item["side"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
            let side = (rawSide?.isEmpty == false) ? rawSide! : "Not recorded"
            let checkedInCount = (item["checkedInCount"] as? Int) ?? (checkedIn ? 1 : 0)
            let seatingTableId = item["seatingTableId"] as? String
            let tableName = seatingTableId.flatMap { tableMap[$0] }

            let rsvp: RSVPStatus
            switch rsvpRaw.lowercased() {
            case "attending", "confirmed": rsvp = .attending
            case "declined": rsvp = .declined
            default: rsvp = .pending
            }

            let passSerial: String?
            if rsvp == .attending {
                passSerial = "SHDW" + String(id.uppercased().suffix(8))
            } else {
                passSerial = nil
            }

            return Guest(
                id: id,
                name: name,
                householdName: nil,
                partySize: partySize,
                side: side,
                rsvpStatus: rsvp,
                tableNumber: nil,
                tableName: tableName,
                checkedIn: checkedIn,
                checkedInCount: checkedInCount,
                passSerial: passSerial
            )
        }

        // 5. Budget
        guard let budgetRaw = json["budgetItems"] as? [[String: Any]] else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required budgetItems missing in private real shadow fixture.")
        }
        var catAllocated: [String: Double] = [:]
        var catSpent: [String: Double] = [:]
        var totalEst: Double = 0
        var totalAct: Double = 0
        var totalPd: Double = 0

        for b in budgetRaw {
            guard let id = b["id"] as? String, !id.isEmpty,
                  let cat = b["category"] as? String, !cat.isEmpty,
                  let estNum = b["estimatedCost"] as? NSNumber,
                  let actNum = b["actualCost"] as? NSNumber,
                  let pdNum = b["paidAmount"] as? NSNumber else {
                throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required budget item fields missing in private real shadow fixture.")
            }
            let est = estNum.doubleValue
            let act = actNum.doubleValue
            let pd = pdNum.doubleValue
            totalEst += est
            totalAct += act
            totalPd += pd
            catAllocated[cat.capitalized, default: 0] += act > 0 ? act : est
            catSpent[cat.capitalized, default: 0] += pd
        }

        let categories = catAllocated.keys.sorted().map { cat in
            BudgetCategory(name: cat, allocated: catAllocated[cat] ?? 0, spent: catSpent[cat] ?? 0)
        }

        self.budget = BudgetSummary(
            currency: "USD",
            totalBudget: totalEst,
            totalAllocated: totalAct,
            totalPaid: totalPd,
            categories: categories
        )

        // 6. Vendors
        guard let vendorsRaw = json["vendors"] as? [[String: Any]] else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required vendors list missing in private real shadow fixture.")
        }
        self.vendors = try vendorsRaw.map { item in
            guard let id = item["id"] as? String, !id.isEmpty,
                  let name = item["name"] as? String, !name.isEmpty,
                  let cat = item["category"] as? String, !cat.isEmpty else {
                throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required vendor fields missing in private real shadow fixture.")
            }
            return VendorPresence(
                id: id,
                vendorName: name,
                serviceCategory: cat.capitalized,
                serviceArea: venueStr,
                state: .notRecorded,
                expectedTime: "Not recorded",
                lastUpdated: Date()
            )
        }

        self.announcements = []
    }

    public func getWedding() async throws -> Wedding { wedding }
    public func getTasks() async throws -> [PlannerTask] { tasks }
    public func getGuests() async throws -> [Guest] { guests }
    public func getBudget() async throws -> BudgetSummary { budget }
    public func getAuditRecords() async throws -> [CheckInAuditRecord] { auditRecords }
    public func getVendors() async throws -> [VendorPresence] { vendors }
    public func getAnnouncements() async throws -> [WeddingAnnouncement] { announcements }

    public func createTask(title: String, priority: TaskPriority, category: String) async throws -> PlannerTask {
        let task = PlannerTask(id: "real_task_\(UUID().uuidString.prefix(8))", title: title, status: .todo, priority: priority, category: category)
        tasks.append(task)
        return task
    }

    public func toggleTask(taskId: String) async throws -> PlannerTask {
        guard let index = tasks.firstIndex(where: { $0.id == taskId }) else {
            throw NSError(domain: "PrivateRealShadowWeddingRepository", code: 404, userInfo: [NSLocalizedDescriptionKey: "Task not found"])
        }
        tasks[index].status = tasks[index].status == .done ? .todo : .done
        return tasks[index]
    }

    public func getWeddingPass(token: String) async throws -> WeddingPass {
        let guest = try guestForToken(token)
        guard guest.rsvpStatus == .attending else {
            throw NSError(
                domain: "PrivateRealShadowWeddingRepository",
                code: 403,
                userInfo: [NSLocalizedDescriptionKey: "Wedding Pass is available only to attending guests in Private Real Shadow."]
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
            return CheckInVerificationResult(status: .invalidPass, guestName: "Unknown Guest", partySize: 0, alreadyCheckedInCount: 0, remainingCount: 0, gateMessage: "Pass does not match an attending guest.")
        }

        var guest = guests[index]
        let remaining = max(0, guest.partySize - guest.checkedInCount)

        if remaining == 0 {
            return CheckInVerificationResult(status: .alreadyCheckedIn, guestName: guest.name, householdName: guest.householdName, partySize: guest.partySize, alreadyCheckedInCount: guest.checkedInCount, remainingCount: 0, tableNumber: guest.tableNumber, tableName: guest.tableName, gateMessage: "Duplicate Gate Entry: full party already admitted.")
        }

        if count > remaining {
            return CheckInVerificationResult(status: .capacityExceeded, guestName: guest.name, householdName: guest.householdName, partySize: guest.partySize, alreadyCheckedInCount: guest.checkedInCount, remainingCount: remaining, tableNumber: guest.tableNumber, tableName: guest.tableName, gateMessage: "Capacity Alert: only \(remaining) guest(s) remain in this party.")
        }

        guest.checkedInCount += count
        guest.checkedIn = guest.checkedInCount > 0
        guests[index] = guest

        auditRecords.append(CheckInAuditRecord(passSerial: guest.passSerial ?? "REAL_SHADOW", guestName: guest.name, countAdmitted: count, gateName: "Main Gate", usherId: usherId, isSynced: false))

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
            gateMessage: newRemaining == 0 ? "Admitted: full party cleared for entry." : "Admitted: partial party arrival."
        )
    }

    public func updateVendorState(id: String, state: VendorPresenceState) async throws -> VendorPresence {
        guard let index = vendors.firstIndex(where: { $0.id == id }) else {
            throw NSError(domain: "PrivateRealShadowWeddingRepository", code: 404, userInfo: [NSLocalizedDescriptionKey: "Vendor not found"])
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
            weddingDate: wedding.date,
            venueName: wedding.venueName,
            venueCity: "\(wedding.city), \(wedding.country)",
            cardStyle: "ivory-floral-gold",
            isConfirmed: guest.rsvpStatus == .attending
        )
    }

    public func confirmRsvp(weddingSlug: String, token: String, attending: Bool) async throws -> WeddingPass {
        guard let index = guestIndexForToken(token) else {
            throw NSError(
                domain: "PrivateRealShadowWeddingRepository",
                code: 404,
                userInfo: [NSLocalizedDescriptionKey: "Invitation token does not map to a guest."]
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
        if guests.isEmpty { return nil }
        if token == attendingToken || token == "native-reference-guest" {
            return guests.firstIndex(where: { $0.rsvpStatus == .attending && $0.partySize == 1 }) ?? guests.firstIndex(where: { $0.rsvpStatus == .attending })
        } else if token == partyFourToken {
            return guests.firstIndex(where: { $0.partySize >= 4 }) ?? guests.indices.first
        } else if token == pendingToken {
            return guests.firstIndex(where: { $0.rsvpStatus == .pending })
        } else if token == declinedToken {
            return guests.firstIndex(where: { $0.rsvpStatus == .declined }) ?? (guests.count > 1 ? 1 : 0)
        } else if token.hasPrefix("real-pass-") {
            let id = String(token.dropFirst("real-pass-".count))
            return guests.firstIndex(where: { $0.id == id })
        } else if token.hasPrefix("real-non-admission-") {
            let id = String(token.dropFirst("real-non-admission-".count))
            return guests.firstIndex(where: { $0.id == id })
        } else {
            return guests.firstIndex(where: { $0.id == token || $0.passSerial == token })
        }
    }

    private func guestForToken(_ token: String) throws -> Guest {
        guard let index = guestIndexForToken(token) else {
            throw NSError(
                domain: "PrivateRealShadowWeddingRepository",
                code: 404,
                userInfo: [NSLocalizedDescriptionKey: "Unknown guest token in Private Real Shadow."]
            )
        }
        return guests[index]
    }

    private func makePass(for guest: Guest) -> WeddingPass {
        let serial = guest.passSerial ?? ("SHDW" + String(guest.id.uppercased().suffix(8)))
        return WeddingPass(
            token: "real-pass-\(guest.id)",
            weddingId: wedding.id,
            coupleNames: wedding.coupleNames,
            weddingDate: wedding.date,
            venueName: wedding.venueName,
            venueAddress: wedding.venueAddress,
            guestName: guest.name,
            householdName: guest.householdName,
            partySize: guest.partySize,
            tableNumber: guest.tableNumber,
            tableName: guest.tableName,
            seatNumber: guest.tableName == nil ? nil : "Assigned Seat",
            currentStage: .attending,
            qrPayload: "REAL_SHADOW_ONLY.WW2_PLACEHOLDER.\(serial).NOT_A_PRODUCTION_CREDENTIAL"
        )
    }

    private func makeNonAdmissionPass(for guest: Guest) -> WeddingPass {
        WeddingPass(
            token: "real-non-admission-\(guest.id)",
            weddingId: wedding.id,
            coupleNames: wedding.coupleNames,
            weddingDate: wedding.date,
            venueName: wedding.venueName,
            venueAddress: wedding.venueAddress,
            guestName: guest.name,
            householdName: guest.householdName,
            partySize: guest.partySize,
            currentStage: .invitation,
            qrPayload: "DECLINED_NO_ADMISSION"
        )
    }
}
