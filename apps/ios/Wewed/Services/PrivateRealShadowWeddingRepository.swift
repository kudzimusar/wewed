import Foundation

/// Production-derived Private Real Shadow implementation for authentic Charity & Kudzie UAT testing.
/// Loads the authentic private row-level snapshot from local protected storage.
/// Fails explicitly if the private real shadow file is missing (no silent fallback).
public actor PrivateRealShadowWeddingRepository: WeddingRepositoryProtocol {

    public func availableWeddingIds() async throws -> [String] { [wedding.id] }

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
    private var auditRecords: [CheckInAuditRecord] = []
    private var vendors: [VendorPresence]
    private var announcements: [WeddingAnnouncement]

    /// Local UAT changes, layered over the snapshot rather than written into it.
    ///
    /// `baseTasks`, `baseGuests` and `baseVendors` stay exactly as the authorized production read
    /// produced them, so provenance is answerable per record and reset is a clear rather than a
    /// reload. Nothing recorded here reaches production; there is no write path.
    private let mutations = ShadowMutationOverlay()
    private var baseTasks: [PlannerTask] = []
    private var baseGuests: [Guest] = []
    private var baseVendors: [VendorPresence] = []

    // Production-derived graph loaded from the canonical Private Real UAT snapshot.
    /// Where this wedding's site is published.
    private var publishedSlug: String = ""
    /// The couple's saved invitation design, read from the production wedding row.
    private var savedInvitationStyle: String = ""
    /// The couple's own choices for their invitation, read once from the production wedding row.
    private var savedInvitationConfiguration: WeddingInvitationConfiguration?
    private let manifest: UatSnapshotManifest
    private let rsvpDetails: [String: GuestRsvpDetail]
    private let guestContacts: [String: GuestContactDetail]
    private let weddingContent: [WeddingContentEntry]
    private let contentRevisions: [ContentRevisionRecord]
    private let songs: [SongEntry]
    private let qrDestinations: [QrDestination]
    private let importJobs: [ImportJobRecord]
    private let wallMessages: [WallMessage]
    private let engagementParties: [EngagementPartyRecord]
    private let auditEvents: [AuditEventRecord]
    private let plannerAccess: PlannerAccessContext?
    private let adminAccess: AdminAccessContext?

    /// The only snapshot schema this build accepts. Bumping it forces a re-provision.
    public static let requiredSchemaVersion = "private-real-uat/2"

    /// Canonical Private Real UAT snapshot filename, shared with Android and the provisioner.
    public static let snapshotFilename = "charity-kudzie-private-real-uat-v2.json"

    private let attendingToken = "shadow-attending-guest"
    private let pendingToken = "shadow-pending-guest"
    private let declinedToken = "shadow-declined-guest"
    private let partyFourToken = "shadow-party4-guest"

    public static func defaultSnapshotPath() -> String {
        if let envPath = ProcessInfo.processInfo.environment["WEWED_PRIVATE_SHADOW_PATH"], !envPath.isEmpty, FileManager.default.fileExists(atPath: envPath) {
            return envPath
        }

        // Check Application Support Directory. Private production-derived
        // Shadow snapshots are intentionally excluded from Documents/iCloud.
        if let appSupportDir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first {
            let appSupportPath = appSupportDir.appendingPathComponent("wewed/\(snapshotFilename)").path
            if FileManager.default.fileExists(atPath: appSupportPath) {
                return appSupportPath
            }
        }

        #if os(iOS)
        if let appSupportDir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first {
            return appSupportDir
                .appendingPathComponent("wewed/\(snapshotFilename)")
                .path
        }
        return ProcessInfo.processInfo.environment["WEWED_PRIVATE_SHADOW_PATH"] ?? snapshotFilename
        #else
        // Desktop test tooling may use the operator's protected home-directory snapshot.
        let homePath = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".wewed-shadow/charity-kudzie/\(snapshotFilename)")
            .path
        if FileManager.default.fileExists(atPath: homePath) {
            return homePath
        }

        return ProcessInfo.processInfo.environment["WEWED_PRIVATE_SHADOW_PATH"] ?? homePath
        #endif
    }

    public static func loadSnapshotData(path: String = defaultSnapshotPath()) throws -> Data {
        let fileURL = URL(fileURLWithPath: path)
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing(
                "Private real shadow fixture not found at \(path). Use WEWED_PRIVATE_SHADOW_PATH for desktop tests or provision the protected file into Application Support. Documents/iCloud and demo-data fallback are prohibited."
            )
        }
        try hardenSnapshotFile(at: fileURL)
        return try Data(contentsOf: fileURL)
    }

    private static func hardenSnapshotFile(at fileURL: URL) throws {
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutableURL = fileURL
        try mutableURL.setResourceValues(values)

        #if os(iOS)
        try FileManager.default.setAttributes(
            [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
            ofItemAtPath: fileURL.path
        )
        #endif
    }

    public init(jsonData: Data? = nil, path: String = defaultSnapshotPath()) throws {
        let data: Data
        if let provided = jsonData {
            data = provided
        } else {
            data = try Self.loadSnapshotData(path: path)
        }

        guard let envelope = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Invalid JSON format in private real shadow fixture.")
        }

        // The canonical Private Real UAT snapshot is versioned. A stale or differently-shaped file
        // is rejected loudly here rather than parsed partially: provisioning has failed silently
        // before, leaving the device on an older graph while the environment badge still read
        // "Private Real".
        guard let metadata = envelope["metadata"] as? [String: Any] else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing(
                "Private Real UAT snapshot has no metadata block. Expected schema \(Self.requiredSchemaVersion); re-run the extract/build pipeline and re-provision."
            )
        }
        let schemaVersion = (metadata["schemaVersion"] as? String) ?? ""
        guard schemaVersion == Self.requiredSchemaVersion else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing(
                "Private Real UAT snapshot schema is '\(schemaVersion)' but this build requires '\(Self.requiredSchemaVersion)'. Re-run build_canonical_uat_snapshot.py and re-provision."
            )
        }
        guard let json = envelope["domains"] as? [String: Any] else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Snapshot has no domains block.")
        }

        self.publishedSlug = (envelope["wedding"] as? [String: Any])?["slug"] as? String ?? ""
        self.savedInvitationStyle = (envelope["wedding"] as? [String: Any])?["invitationCardStyle"] as? String ?? ""
        if let weddingRow = envelope["wedding"] as? [String: Any] {
            func text(_ key: String) -> String? {
                guard let value = weddingRow[key] as? String,
                      !value.isEmpty, value != "null" else { return nil }
                return value
            }
            // Contributions are a wedding capability, not a native default: the card offers gifts
            // only where the couple actually has somewhere for them to go.
            let giftUrl = ((envelope["domains"] as? [String: Any])?["qrDestinations"] as? [[String: Any]])?
                .first {
                    ($0["isActive"] as? Bool ?? false)
                        && (($0["type"] as? String) ?? "").lowercased().contains("contribution")
                }?["url"] as? String
            self.savedInvitationConfiguration = WeddingInvitationConfiguration(
                cardStyle: text("invitationCardStyle"),
                monogram: text("monogram"),
                tagline: text("tagline"),
                message: text("invitationCardMessage"),
                rsvpDeadline: text("rsvpDeadline"),
                venueMapUrl: text("venueMapUrl"),
                venueCountry: text("venueCountry"),
                giftDestinationUrl: giftUrl,
                provenance: .productionDerived
            )
        }
        self.manifest = UatSnapshotManifest(
            schemaVersion: schemaVersion,
            sourceWeddingId: (metadata["sourceWeddingId"] as? String) ?? "",
            generatedAt: (metadata["generatedAt"] as? String) ?? "",
            contentHashPrefix: String(((metadata["contentHash"] as? String) ?? "").prefix(16)),
            domainCounts: (metadata["domainCounts"] as? [String: Int]) ?? [:]
        )

        // 1. Wedding
        guard let weddingDict = envelope["wedding"] as? [String: Any],
              let weddingId = weddingDict["id"] as? String, !weddingId.isEmpty,
              let coupleTitle = weddingDict["title"] as? String, !coupleTitle.isEmpty,
              let dateStr = weddingDict["date"] as? String, !dateStr.isEmpty,
              let venueStr = weddingDict["venue"] as? String, !venueStr.isEmpty,
              let cityStr = weddingDict["venueCity"] as? String, !cityStr.isEmpty,
              let countryStr = weddingDict["venueCountry"] as? String, !countryStr.isEmpty,
              let lifecycleStr = weddingDict["lifecycle"] as? String, !lifecycleStr.isEmpty else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required wedding metadata missing in Private Real UAT snapshot.")
        }

        // 2. Programme
        let progRaw = (json["programme"] as? [[String: Any]]) ?? []
        let progItems: [ProgrammeItem] = progRaw.compactMap { item in
            guard let id = item["id"] as? String, !id.isEmpty,
                  let title = item["title"] as? String, !title.isEmpty else { return nil }
            return ProgrammeItem(
                id: id,
                title: title,
                time: (item["time"] as? String) ?? "",
                location: (item["location"] as? String) ?? venueStr,
                description: (item["description"] as? String) ?? ""
            )
        }.sorted { $0.time < $1.time }

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
        let tasksRaw = (json["tasks"] as? [[String: Any]]) ?? []
        self.tasks = tasksRaw.compactMap { item in
            guard let id = item["id"] as? String, !id.isEmpty,
                  let title = item["title"] as? String, !title.isEmpty else { return nil }
            let status: TaskStatus
            switch ((item["status"] as? String) ?? "").lowercased() {
            case "done", "completed": status = .done
            case "in_progress", "inprogress": status = .inProgress
            case "blocked": status = .blocked
            default: status = .todo
            }
            let priority: TaskPriority
            switch ((item["priority"] as? String) ?? "").lowercased() {
            case "high", "urgent": priority = .high
            case "low": priority = .low
            default: priority = .medium
            }
            let category = (item["category"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "General"
            return PlannerTask(id: id, title: title, status: status, priority: priority,
                               category: category, dueDate: item["dueDate"] as? String,
                               description: item["description"] as? String,
                               assignee: item["assignee"] as? String)
        }

        // 4. Seating tables
        let tablesRaw = (json["seatingTables"] as? [[String: Any]]) ?? []
        var tableMap: [String: String] = [:]
        for tbl in tablesRaw {
            if let tId = tbl["id"] as? String, let tName = tbl["name"] as? String {
                tableMap[tId] = tName
            }
        }

        // 5. RSVP graph, keyed by guest. Every production guest has exactly one RSVP row; the
        // detail here (meal, dietary, plus-one, kids, song request, message) is what the old flat
        // snapshot discarded entirely.
        let rsvpRaw = (json["rsvps"] as? [[String: Any]]) ?? []
        var rsvpByGuest: [String: GuestRsvpDetail] = [:]
        for row in rsvpRaw {
            guard let guestId = row["guestId"] as? String, !guestId.isEmpty else { continue }
            rsvpByGuest[guestId] = GuestRsvpDetail(
                id: (row["id"] as? String) ?? "",
                guestId: guestId,
                attending: row["attending"] as? Bool,
                mealChoice: row["mealChoice"] as? String,
                plusOne: (row["plusOne"] as? Bool) ?? false,
                plusOneName: row["plusOneName"] as? String,
                plusOneMeal: row["plusOneMeal"] as? String,
                kidsAttending: (row["kidsAttending"] as? Bool) ?? false,
                kidsCount: (row["kidsCount"] as? Int) ?? 0,
                songRequests: row["songRequests"] as? String,
                dietaryNotes: row["dietaryNotes"] as? String,
                message: row["message"] as? String,
                checkedIn: (row["checkedIn"] as? Bool) ?? false,
                checkedInAt: row["checkedInAt"] as? String
            )
        }
        self.rsvpDetails = rsvpByGuest

        // 6. Guests
        guard let guestsRaw = json["guests"] as? [[String: Any]] else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required guests list missing in Private Real UAT snapshot.")
        }
        var contacts: [String: GuestContactDetail] = [:]
        self.guests = try guestsRaw.map { item in
            guard let id = item["id"] as? String, !id.isEmpty,
                  let name = item["name"] as? String, !name.isEmpty else {
                throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required guest fields missing in Private Real UAT snapshot.")
            }
            let rsvpRow = rsvpByGuest[id]
            let rsvp: RSVPStatus
            switch rsvpRow?.attending {
            case .some(true): rsvp = .attending
            case .some(false): rsvp = .declined
            default: rsvp = .pending
            }
            // Production records no partySize column; the real party size is the guest plus their
            // confirmed plus-one and children. That is DERIVED, not invented.
            let partySize = 1 + ((rsvpRow?.plusOne == true) ? 1 : 0) + (rsvpRow?.kidsCount ?? 0)
            let checkedIn = rsvpRow?.checkedIn == true
            let rawSide = (item["side"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
            let side = (rawSide?.isEmpty == false) ? rawSide!.prefix(1).uppercased() + rawSide!.dropFirst() : "Not recorded"
            let seatingTableId = item["seatingTableId"] as? String

            contacts[id] = GuestContactDetail(
                guestId: id,
                email: item["email"] as? String,
                phone: item["phone"] as? String,
                role: item["role"] as? String,
                roleDetail: item["roleDetail"] as? String
            )

            return Guest(
                id: id,
                name: name,
                householdName: nil,
                partySize: partySize,
                side: String(side),
                rsvpStatus: rsvp,
                tableNumber: (item["tableNumber"] as? Int).flatMap { $0 > 0 ? $0 : nil },
                tableName: seatingTableId.flatMap { tableMap[$0] },
                checkedIn: checkedIn,
                checkedInCount: checkedIn ? partySize : 0,
                passSerial: rsvp == .attending ? "SHDW" + String(id.uppercased().suffix(8)) : nil
            )
        }
        self.guestContacts = contacts

        // 7. Budget
        let budgetRaw = (json["budgetItems"] as? [[String: Any]]) ?? []
        var catAllocated: [String: Double] = [:]
        var catSpent: [String: Double] = [:]
        var totalEst: Double = 0
        var totalAct: Double = 0
        var totalPd: Double = 0

        for b in budgetRaw {
            let cat = ((b["category"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "Uncategorised").capitalized
            let est = (b["estimatedCost"] as? NSNumber)?.doubleValue ?? 0
            let act = (b["actualCost"] as? NSNumber)?.doubleValue ?? 0
            let pd = (b["paidAmount"] as? NSNumber)?.doubleValue ?? 0
            totalEst += est
            totalAct += act
            totalPd += pd
            catAllocated[cat, default: 0] += act > 0 ? act : est
            catSpent[cat, default: 0] += pd
        }

        self.budget = BudgetSummary(
            currency: "USD",
            totalBudget: totalEst,
            totalAllocated: totalAct,
            totalPaid: totalPd,
            categories: catAllocated.keys.sorted().map {
                BudgetCategory(name: $0, allocated: catAllocated[$0] ?? 0, spent: catSpent[$0] ?? 0)
            }
        )

        // 8. Vendors
        let vendorsRaw = (json["vendors"] as? [[String: Any]]) ?? []
        self.vendors = vendorsRaw.compactMap { item in
            guard let id = item["id"] as? String, !id.isEmpty,
                  let name = item["name"] as? String, !name.isEmpty else { return nil }
            let cat = (item["category"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "Service"
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

        // 9. Production-derived domains the old snapshot dropped entirely.
        self.weddingContent = ((json["weddingContent"] as? [[String: Any]]) ?? []).compactMap { c in
            guard let id = c["id"] as? String, let section = c["section"] as? String,
                  let field = c["field"] as? String else { return nil }
            return WeddingContentEntry(
                id: id, section: section, field: field,
                value: (c["value"] as? String) ?? "",
                order: (c["order"] as? Int) ?? 0,
                metadata: c["metadata"] as? String
            )
        }

        self.contentRevisions = ((json["contentRevisions"] as? [[String: Any]]) ?? []).compactMap { r in
            guard let id = r["id"] as? String else { return nil }
            return ContentRevisionRecord(
                id: id,
                section: (r["section"] as? String) ?? "",
                fieldKey: (r["fieldKey"] as? String) ?? "",
                status: (r["status"] as? String) ?? "draft",
                publishedAt: r["publishedAt"] as? String,
                scheduledFor: r["scheduledFor"] as? String,
                authorId: r["authorId"] as? String,
                hasPreviousValue: r["previousValue"] is String
            )
        }

        self.songs = ((json["songs"] as? [[String: Any]]) ?? []).compactMap { s in
            guard let id = s["id"] as? String, let title = s["title"] as? String else { return nil }
            return SongEntry(
                id: id, title: title,
                artist: s["artist"] as? String,
                phase: s["phase"] as? String,
                moment: s["moment"] as? String,
                order: (s["order"] as? Int) ?? 0,
                votes: (s["votes"] as? Int) ?? 0,
                notes: s["notes"] as? String,
                playedAt: s["playedAt"] as? String,
                spotifyUrl: s["spotifyUrl"] as? String,
                appleUrl: s["appleUrl"] as? String
            )
        }.sorted { $0.order < $1.order }

        self.qrDestinations = ((json["qrDestinations"] as? [[String: Any]]) ?? []).compactMap { q in
            guard let id = q["id"] as? String else { return nil }
            return QrDestination(
                id: id,
                label: (q["label"] as? String) ?? "",
                type: (q["type"] as? String) ?? "",
                url: (q["url"] as? String) ?? "",
                isActive: (q["isActive"] as? Bool) ?? true,
                scanCount: (q["scanCount"] as? Int) ?? 0
            )
        }

        self.importJobs = ((json["importJobs"] as? [[String: Any]]) ?? []).compactMap { j in
            guard let id = j["id"] as? String else { return nil }
            return ImportJobRecord(
                id: id,
                moduleKey: (j["moduleKey"] as? String) ?? "",
                fileName: j["fileName"] as? String,
                status: (j["status"] as? String) ?? "unknown",
                totalRows: (j["totalRows"] as? Int) ?? 0,
                createdCount: (j["createdCount"] as? Int) ?? 0,
                updatedCount: (j["updatedCount"] as? Int) ?? 0,
                skippedCount: (j["skippedCount"] as? Int) ?? 0,
                errorCount: (j["errorCount"] as? Int) ?? 0,
                performedAt: j["createdAt"] as? String
            )
        }.sorted { ($0.performedAt ?? "") > ($1.performedAt ?? "") }

        self.wallMessages = ((json["messages"] as? [[String: Any]]) ?? []).compactMap { m in
            guard let id = m["id"] as? String else { return nil }
            return WallMessage(
                id: id,
                authorName: m["authorName"] as? String,
                content: (m["content"] as? String) ?? "",
                type: (m["type"] as? String) ?? "wall",
                isPublic: (m["isPublic"] as? Bool) ?? false,
                revealedAt: m["revealedAt"] as? String,
                createdAt: m["createdAt"] as? String
            )
        }

        self.engagementParties = ((json["engagementParties"] as? [[String: Any]]) ?? []).compactMap { e in
            guard let id = e["id"] as? String else { return nil }
            return EngagementPartyRecord(
                id: id,
                serviceEngagementId: (e["serviceEngagementId"] as? String) ?? "",
                partyKind: (e["partyKind"] as? String) ?? "",
                partyRole: (e["partyRole"] as? String) ?? "",
                displayName: (e["displayName"] as? String) ?? "",
                legalName: e["legalName"] as? String,
                email: e["email"] as? String,
                phone: e["phone"] as? String,
                authorityBasis: e["authorityBasis"] as? String,
                status: e["status"] as? String,
                requiredForReview: (e["requiredForReview"] as? Bool) ?? false
            )
        }

        self.auditEvents = ((json["auditEvents"] as? [[String: Any]]) ?? []).compactMap { a in
            guard let id = a["id"] as? String else { return nil }
            return AuditEventRecord(
                id: id,
                action: (a["action"] as? String) ?? "",
                actorId: a["actorId"] as? String,
                resourceType: a["resourceType"] as? String,
                resourceId: a["resourceId"] as? String,
                createdAt: a["createdAt"] as? String
            )
        }.sorted { ($0.createdAt ?? "") > ($1.createdAt ?? "") }

        // 10. Planner and Admin context, carried as facts rather than inferred at the UI.
        if let pc = envelope["plannerContext"] as? [String: Any] {
            let profile = pc["profile"] as? [String: Any]
            self.plannerAccess = PlannerAccessContext(
                businessName: profile?["displayName"] as? String,
                profileStatus: profile?["status"] as? String,
                teamSize: profile?["teamSize"] as? Int,
                completedWeddings: profile?["completedWeddings"] as? Int,
                enquiryStatus: (pc["enquiry"] as? [String: Any])?["status"] as? String,
                productionEngagementCount: (pc["productionEngagementCount"] as? Int) ?? 0,
                productionMembershipCount: (pc["productionMembershipCount"] as? Int) ?? 0,
                accessBasis: (pc["accessBasis"] as? String) == "PRODUCTION_ENGAGEMENT" ? .productionDerived : .uatOverlay
            )
        } else {
            self.plannerAccess = nil
        }

        if let ac = envelope["adminContext"] as? [String: Any] {
            self.adminAccess = AdminAccessContext(
                status: (ac["status"] as? String) ?? "",
                deniedDomains: (ac["deniedDomains"] as? [String]) ?? [],
                emptyDomains: (ac["emptyDomains"] as? [String]) ?? [],
                note: (ac["note"] as? String) ?? ""
            )
        } else {
            self.adminAccess = nil
        }

        self.announcements = []

        // Freeze the production-derived truth. Everything after this point is overlay.
        self.baseTasks = self.tasks
        self.baseGuests = self.guests
        self.baseVendors = self.vendors
    }

    /// True while the view still equals the production-derived snapshot.
    public func isPristine() -> Bool { mutations.isPristine }

    /// Counts of what this UAT session changed. No private values.
    public func mutationSummary() -> [String: Int] { mutations.summary() }

    /// Discards every local change, returning the view to the production-derived snapshot.
    public func resetMutations() {
        mutations.reset()
        tasks = baseTasks
        guests = baseGuests
        vendors = baseVendors
        auditRecords = []
        announcements = []
    }

    /// Where a task's current value came from.
    public func provenanceForTask(_ taskId: String) -> DataProvenance {
        mutations.provenanceForTask(taskId)
    }

    /// Where a guest's current value came from.
    public func provenanceForGuest(_ guestId: String) -> DataProvenance {
        mutations.provenanceForGuest(guestId)
    }

    public func getWedding(weddingId: String) async throws -> Wedding {
        try requireScope(weddingId)
        return wedding
    }
    public func getTasks(weddingId: String) async throws -> [PlannerTask] {
        try requireScope(weddingId)
        return tasks
    }
    public func getGuests(weddingId: String) async throws -> [Guest] {
        try requireScope(weddingId)
        return guests
    }
    public func getBudget(weddingId: String) async throws -> BudgetSummary {
        try requireScope(weddingId)
        return budget
    }
    public func getAuditRecords(weddingId: String) async throws -> [CheckInAuditRecord] {
        try requireScope(weddingId)
        return auditRecords
    }
    public func getVendors(weddingId: String) async throws -> [VendorPresence] {
        try requireScope(weddingId)
        return vendors
    }
    public func getAnnouncements(weddingId: String) async throws -> [WeddingAnnouncement] {
        try requireScope(weddingId)
        return announcements
    }

    public func createTask(weddingId: String, title: String, priority: TaskPriority, category: String) async throws -> PlannerTask {
        try requireScope(weddingId)
        let task = PlannerTask(id: "real_task_\(UUID().uuidString.prefix(8))", title: title, status: .todo, priority: priority, category: category)
        tasks.append(task)
        mutations.recordTaskCreated(task.id)
        return task
    }

    public func toggleTask(weddingId: String, taskId: String) async throws -> PlannerTask {
        try requireScope(weddingId)
        guard let index = tasks.firstIndex(where: { $0.id == taskId }) else {
            throw NSError(domain: "PrivateRealShadowWeddingRepository", code: 404, userInfo: [NSLocalizedDescriptionKey: "Task not found"])
        }
        tasks[index].status = tasks[index].status == .done ? .todo : .done
        mutations.recordTaskStatus(tasks[index].id, status: tasks[index].status.rawValue)
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

    public func searchGuests(weddingId: String, query: String) async throws -> [Guest] {
        try requireScope(weddingId)
        let normalized = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else { return guests }
        return guests.filter {
            $0.name.lowercased().contains(normalized) ||
            ($0.householdName?.lowercased().contains(normalized) ?? false) ||
            ($0.tableName?.lowercased().contains(normalized) ?? false)
        }
    }

    public func checkInGuest(weddingId: String, qrPayload: String, count: Int, usherId: String) async throws -> CheckInVerificationResult {
        try requireScope(weddingId)
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
        mutations.recordCheckIn(guest.id, admitted: count)

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

    public func updateVendorState(weddingId: String, id: String, state: VendorPresenceState) async throws -> VendorPresence {
        try requireScope(weddingId)
        guard let index = vendors.firstIndex(where: { $0.id == id }) else {
            throw NSError(domain: "PrivateRealShadowWeddingRepository", code: 404, userInfo: [NSLocalizedDescriptionKey: "Vendor not found"])
        }
        vendors[index].state = state
        vendors[index].lastUpdated = Date()
        mutations.recordVendorState(vendors[index].id, state: String(describing: state))
        return vendors[index]
    }

    public func postAnnouncement(weddingId: String, title: String, message: String, urgency: AnnouncementUrgency) async throws -> WeddingAnnouncement {
        try requireScope(weddingId)
        let announcement = WeddingAnnouncement(title: title, message: message, urgency: urgency)
        announcements.insert(announcement, at: 0)
        mutations.recordAnnouncement(announcement.id)
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
        mutations.recordRsvp(current.id, attending: attending)

        return attending ? makePass(for: current) : makeNonAdmissionPass(for: current)
    }
    public func resolveGuestIdentity(token: String) async throws -> GuestIdentity? {
        guard let index = guestIndexForToken(token) else { return nil }
        let guest = guests[index]
        return GuestIdentity(
            guestId: guest.id,
            guestName: guest.name,
            weddingId: wedding.id,
            passToken: token
        )
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

    // -------------------------------------------------------------------------------------
    // Production-derived domains.
    //
    // Each of these was previously reported as "unsupported" because the September snapshot did
    // not carry it. Production did. Role gating is applied by the caller, except where a model
    // exposes an explicitly narrowed projection (see GuestRsvpDetail.operationalOnly()).
    // -------------------------------------------------------------------------------------

    public func snapshotManifest() async throws -> UatSnapshotManifest? { manifest }

    public func getRsvpDetail(weddingId: String, guestId: String) async throws -> GuestRsvpDetail? {
        try requireScope(weddingId)
        return rsvpDetails[guestId]
    }

    public func getGuestContact(weddingId: String, guestId: String) async throws -> GuestContactDetail? {
        try requireScope(weddingId)
        return guestContacts[guestId]
    }

    public func getWeddingContent(weddingId: String) async throws -> [WeddingContentEntry] {
        try requireScope(weddingId)
        return weddingContent
    }

    public func getContentRevisions(weddingId: String) async throws -> [ContentRevisionRecord] {
        try requireScope(weddingId)
        return contentRevisions
    }

    public func getSongs(weddingId: String) async throws -> [SongEntry] {
        try requireScope(weddingId)
        return songs
    }

    public func getQrDestinations(weddingId: String) async throws -> [QrDestination] {
        try requireScope(weddingId)
        return qrDestinations
    }

    public func getImportJobs(weddingId: String) async throws -> [ImportJobRecord] {
        try requireScope(weddingId)
        return importJobs
    }

    public func getWallMessages(weddingId: String) async throws -> [WallMessage] {
        try requireScope(weddingId)
        return wallMessages
    }

    public func getEngagementParties(weddingId: String) async throws -> [EngagementPartyRecord] {
        try requireScope(weddingId)
        return engagementParties
    }

    public func getAuditEvents(weddingId: String) async throws -> [AuditEventRecord] {
        try requireScope(weddingId)
        return auditEvents
    }

    public func plannerAccessContext(weddingId: String) async throws -> PlannerAccessContext? {
        try requireScope(weddingId)
        return plannerAccess
    }

    public func adminAccessContext() async throws -> AdminAccessContext? { adminAccess }

    public func weddingSlug(weddingId: String) async throws -> String? {
        try requireScope(weddingId)
        return publishedSlug.isEmpty ? nil : publishedSlug
    }

    public func invitationCardStyle(weddingId: String) async throws -> String? {
        try requireScope(weddingId)
        return savedInvitationStyle.isEmpty ? nil : savedInvitationStyle
    }

    public func invitationCardStyleForSlug(_ weddingSlug: String) async throws -> String? {
        // Scoped by slug rather than id: a mismatch means the caller is asking about a wedding this
        // snapshot does not hold, and answering with this wedding's design would be a leak.
        guard weddingSlug.lowercased() == publishedSlug.lowercased() else { return nil }
        return savedInvitationStyle.isEmpty ? nil : savedInvitationStyle
    }

    public func invitationConfigurationForSlug(
        _ weddingSlug: String
    ) async throws -> WeddingInvitationConfiguration? {
        guard weddingSlug.lowercased() == publishedSlug.lowercased() else { return nil }
        return savedInvitationConfiguration
    }
}
