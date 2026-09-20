import Foundation

/// Planner-side repository for the Private Real Shadow scenario (Charity & Kudzie / Eleven Eleven Testing).
public actor PrivateRealShadowPlannerRepository: PlannerDashboardRepositoryProtocol {
    private let budgetLines: [PlannerBudgetLine]
    private let contributions: [PlannerContributionRecord]
    private let vendorEngagements: [PlannerVendorEngagement]
    private let seatingTables: [PlannerSeatingTable]
    private let timelineEntries: [PlannerTimelineEntry]
    private let documents: [PlannerDocumentRecord]
    private let weddingTitle: String
    private let weddingId: String
    private let weddingDate: String
    private let weddingVenue: String
    private let weddingLifecycle: String
    private let plannerTitle: String
    private let doneTasksCount: Int
    private let totalTasksCount: Int
    private let highPriorityTasksCount: Int
    private let totalEstBudget: Double
    private let totalActBudget: Double
    private let totalPdBudget: Double
    private let totalGuestsCount: Int
    private let pendingRsvpCount: Int
    private let attendingGuestsCount: Int
    private let totalSeatingCapacity: Int
    private let assignedInvitedCapacity: Int
    private let remainingTableCapacity: Int
    private let vendorsCount: Int
    private let serviceEngagementsCount: Int

    public init(jsonData: Data? = nil, path: String = PrivateRealShadowWeddingRepository.defaultSnapshotPath()) throws {
        let data: Data
        if let provided = jsonData {
            data = provided
        } else {
            data = try PrivateRealShadowWeddingRepository.loadSnapshotData(path: path)
        }

        guard let envelope = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Invalid JSON format in private real shadow fixture.")
        }

        // Both repositories read ONE canonical snapshot. Reading the same schema here is what
        // stops the planner workspace and the couple workspace from disagreeing about the same
        // wedding, which is exactly what happened while two "real" snapshots coexisted.
        let schemaVersion = (envelope["metadata"] as? [String: Any])?["schemaVersion"] as? String
        guard schemaVersion == PrivateRealShadowWeddingRepository.requiredSchemaVersion else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing(
                "Private Real UAT snapshot schema is '\(schemaVersion ?? "none")' but this build requires '\(PrivateRealShadowWeddingRepository.requiredSchemaVersion)'. Re-provision the device."
            )
        }
        guard let json = envelope["domains"] as? [String: Any] else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Snapshot has no domains block.")
        }

        guard let weddingDict = envelope["wedding"] as? [String: Any],
              let wId = weddingDict["id"] as? String, !wId.isEmpty,
              let coupleTitle = weddingDict["title"] as? String, !coupleTitle.isEmpty,
              let dateStr = weddingDict["date"] as? String, !dateStr.isEmpty,
              let venueStr = weddingDict["venue"] as? String, !venueStr.isEmpty,
              let lifecycleStr = weddingDict["lifecycle"] as? String, !lifecycleStr.isEmpty else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required wedding metadata missing in Private Real UAT snapshot.")
        }
        self.weddingId = wId
        self.weddingTitle = coupleTitle
        self.weddingDate = dateStr
        self.weddingVenue = venueStr
        self.weddingLifecycle = lifecycleStr

        // The planner identity is the real PlannerProfile production holds for this wedding's
        // enquiry — Eleven Eleven Testing — not a name invented for the workspace header.
        guard let plannerContext = envelope["plannerContext"] as? [String: Any],
              let plannerDict = plannerContext["profile"] as? [String: Any],
              let pTitle = plannerDict["displayName"] as? String, !pTitle.isEmpty else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required planner metadata missing in Private Real UAT snapshot.")
        }
        self.plannerTitle = pTitle

        // Tasks stats
        guard let tasksRaw = json["tasks"] as? [[String: Any]] else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required tasks list missing in private real shadow fixture.")
        }
        self.totalTasksCount = tasksRaw.count
        var doneCount = 0
        var highCount = 0
        for t in tasksRaw {
            guard let title = t["title"] as? String, !title.isEmpty,
                  let st = t["status"] as? String, !st.isEmpty,
                  let prio = t["priority"] as? String, !prio.isEmpty else {
                throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required task fields missing in private real shadow fixture.")
            }
            if st.lowercased() == "done" || st.lowercased() == "completed" {
                doneCount += 1
            }
            if prio.lowercased() == "high" || prio.lowercased() == "urgent" {
                highCount += 1
            }
        }
        self.doneTasksCount = doneCount
        self.highPriorityTasksCount = highCount

        // Budget lines (22 items)
        guard let bItemsRaw = json["budgetItems"] as? [[String: Any]] else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required budgetItems missing in private real shadow fixture.")
        }
        var totalEst: Double = 0
        var totalAct: Double = 0
        var totalPd: Double = 0
        self.budgetLines = try bItemsRaw.map { item in
            guard let id = item["id"] as? String, !id.isEmpty,
                  let cat = item["category"] as? String, !cat.isEmpty,
                  let estNum = item["estimatedCost"] as? NSNumber,
                  let actNum = item["actualCost"] as? NSNumber,
                  let pdNum = item["paidAmount"] as? NSNumber else {
                throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required budget item fields missing in private real shadow fixture.")
            }
            let est = estNum.doubleValue
            let act = actNum.doubleValue
            let pd = pdNum.doubleValue
            totalEst += est
            totalAct += act
            totalPd += pd
            let vName = (item["vendorName"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank
            let sourceLabel = ["name", "title", "itemName", "description"]
                .compactMap { (item[$0] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank }
                .first
            let displayLabel = sourceLabel ?? cat.capitalized
            let fundingLabel = ["fundingLabel", "fundingSource", "paymentSource", "fundingType"]
                .compactMap { (item[$0] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank }
                .first ?? "Funding source not recorded"
            let due = (item["dueDate"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank
            let status = pd >= act && act > 0 ? "Paid" : (pd > 0 ? "Deposit paid" : "Unpaid")
            return PlannerBudgetLine(
                id: id,
                category: displayLabel,
                vendorName: vName,
                estimated: est,
                actual: act,
                paid: pd,
                dueDateLabel: due,
                fundingLabel: fundingLabel,
                statusLabel: status
            )
        }
        self.totalEstBudget = totalEst
        self.totalActBudget = totalAct
        self.totalPdBudget = totalPd

        // RSVP is its own production table keyed by guest; attendance and party size are read from
        // there rather than from a flattened field that production never had.
        let rsvpRows = (json["rsvps"] as? [[String: Any]]) ?? []
        var attendingByGuest: [String: Bool?] = [:]
        var partySizeByGuest: [String: Int] = [:]
        for r in rsvpRows {
            guard let gId = r["guestId"] as? String, !gId.isEmpty else { continue }
            attendingByGuest[gId] = r["attending"] as? Bool
            partySizeByGuest[gId] = 1 + (((r["plusOne"] as? Bool) == true) ? 1 : 0) + ((r["kidsCount"] as? Int) ?? 0)
        }

        // Guest Map for name resolution
        guard let guestsRaw = json["guests"] as? [[String: Any]] else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required guests list missing in Private Real UAT snapshot.")
        }
        self.totalGuestsCount = guestsRaw.count
        var guestNameMap: [String: String] = [:]
        var tableAssignedCapacity: [String: Int] = [:]
        var totalAssignedCap = 0
        var pendingCount = 0
        var attendingCount = 0

        for g in guestsRaw {
            guard let gId = g["id"] as? String, !gId.isEmpty,
                  let gName = g["name"] as? String, !gName.isEmpty else {
                throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required guest fields missing in Private Real UAT snapshot.")
            }
            let attending = attendingByGuest[gId] ?? nil
            let partySize = partySizeByGuest[gId] ?? 1
            guestNameMap[gId] = gName
            if attending == true {
                attendingCount += 1
            } else if attending == nil {
                pendingCount += 1
            }

            if let tId = g["seatingTableId"] as? String, !tId.isEmpty {
                totalAssignedCap += partySize
                tableAssignedCapacity[tId, default: 0] += partySize
            }
        }
        self.pendingRsvpCount = pendingCount
        self.attendingGuestsCount = attendingCount
        self.assignedInvitedCapacity = totalAssignedCap

        // Contributions (4 records mapped to real guest names, $0 monetary value)
        guard let contribRaw = json["contributions"] as? [[String: Any]] else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required contributions missing in private real shadow fixture.")
        }
        self.contributions = try contribRaw.map { item in
            guard let id = item["id"] as? String, !id.isEmpty,
                  let guestId = item["guestId"] as? String, !guestId.isEmpty,
                  let type = item["type"] as? String, !type.isEmpty,
                  let status = item["status"] as? String, !status.isEmpty else {
                throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required contribution fields missing in private real shadow fixture.")
            }
            guard let contributorName = guestNameMap[guestId] else {
                throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing(
                    "Contribution \(id) references unknown guest \(guestId)."
                )
            }
            let formattedType = type.replacingOccurrences(of: "_", with: " ").capitalized
            let formattedStatus = status.replacingOccurrences(of: "_", with: " ").capitalized
            let privacy = (item["privacy"] as? String)?.capitalized ?? "Public"
            let wordCount = item["wordCount"] as? Int ?? 0
            let rawText = ["message", "content", "story", "note", "text"]
                .compactMap { (item[$0] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank }
                .first
            let contributionText = rawText ?? (wordCount > 0 ? "\(formattedType) message (\(wordCount) words • \(privacy))" : "\(formattedType) (\(privacy))")
            let verifiedStatuses: Set<String> = ["verified", "approved", "published", "received", "accepted", "recorded"]
            return PlannerContributionRecord(
                id: id,
                contributorLabel: contributorName,
                typeLabel: formattedType,
                value: 0.0,
                statusLabel: formattedStatus,
                allocationLabel: contributionText,
                verified: verifiedStatuses.contains(status.lowercased())
            )
        }

        // Seating Tables (8 tables with capacity calculation)
        guard let tablesRaw = json["seatingTables"] as? [[String: Any]] else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required seatingTables missing in private real shadow fixture.")
        }
        var totalCap = 0
        self.seatingTables = try tablesRaw.map { item in
            guard let id = item["id"] as? String, !id.isEmpty,
                  let name = item["name"] as? String, !name.isEmpty,
                  let cap = item["capacity"] as? Int else {
                throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required seating table fields missing in private real shadow fixture.")
            }
            totalCap += cap
            let assigned = tableAssignedCapacity[id] ?? 0
            let free = cap - assigned
            guard free >= 0 else {
                throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Integrity failure: table \(name) assigned capacity \(assigned) exceeds table capacity \(cap).")
            }
            let sourceZone = (item["zone"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank
            let zone = sourceZone ?? (
                name.localizedCaseInsensitiveContains("Family") ? "Family" :
                name.localizedCaseInsensitiveContains("Bridal") ? "Bridal Party" :
                name.localizedCaseInsensitiveContains("VIP") ? "VIP" :
                name.localizedCaseInsensitiveContains("Colleagues") ? "Colleagues" :
                name.localizedCaseInsensitiveContains("Friends") ? "Friends" :
                "Not recorded"
            )
            return PlannerSeatingTable(
                id: id,
                name: name,
                zone: zone,
                capacity: cap,
                assigned: assigned,
                attentionLabel: "\(free) seats free"
            )
        }
        self.totalSeatingCapacity = totalCap
        let remainingCap = totalCap - totalAssignedCap
        guard remainingCap >= 0 else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Integrity failure: total assigned capacity \(totalAssignedCap) exceeds total seating capacity \(totalCap).")
        }
        self.remainingTableCapacity = remainingCap

        // Vendors & Service Engagements (7 vendors / 8 service engagements)
        guard let vendorsRaw = json["vendors"] as? [[String: Any]] else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required vendors missing in private real shadow fixture.")
        }
        self.vendorsCount = vendorsRaw.count

        let engagementsRaw = json["serviceEngagements"] as? [[String: Any]] ?? []
        self.serviceEngagementsCount = engagementsRaw.count

        var vendorsById: [String: [String: Any]] = [:]
        for vendor in vendorsRaw {
            if let vendorId = vendor["id"] as? String, !vendorId.isEmpty {
                vendorsById[vendorId] = vendor
            }
        }

        var mappedEngagements: [PlannerVendorEngagement] = []
        var vendorsWithEngagements = Set<String>()

        for se in engagementsRaw {
            guard let engagementId = se["id"] as? String, !engagementId.isEmpty,
                  let vendorId = se["vendorId"] as? String, !vendorId.isEmpty else {
                throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing(
                    "Required service engagement id/vendorId missing in private real shadow fixture."
                )
            }
            guard let vendor = vendorsById[vendorId] else {
                throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing(
                    "Service engagement \(engagementId) references unknown vendor \(vendorId)."
                )
            }
            guard let name = vendor["name"] as? String, !name.isEmpty,
                  let cat = vendor["category"] as? String, !cat.isEmpty else {
                throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing(
                    "Required vendor fields missing for service engagement \(engagementId)."
                )
            }
            vendorsWithEngagements.insert(vendorId)

            let paymentStatus = (vendor["paymentStatus"] as? String).flatMap { raw -> String? in
                let cleaned = raw.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !cleaned.isEmpty else { return nil }
                return cleaned.replacingOccurrences(of: "_", with: " ").capitalized
            } ?? "Not recorded"
            let serviceDesc = (se["serviceDescription"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank ?? "Service details not recorded"
            let lifecycleStatus = (se["lifecycleStatus"] as? String).flatMap { raw -> String? in
                let cleaned = raw.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !cleaned.isEmpty else { return nil }
                return cleaned.replacingOccurrences(of: "_", with: " ").capitalized
            } ?? "Not recorded"
            let externalAgreementStatus = (se["externalAgreementStatus"] as? String).flatMap { raw -> String? in
                let cleaned = raw.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !cleaned.isEmpty else { return nil }
                return cleaned.replacingOccurrences(of: "_", with: " ").capitalized
            } ?? "Not recorded"

            mappedEngagements.append(
                PlannerVendorEngagement(
                    id: engagementId,
                    vendorName: name,
                    category: cat.capitalized,
                    bookingStatus: lifecycleStatus,
                    contractStatus: externalAgreementStatus,
                    paymentStatus: paymentStatus,
                    nextAction: serviceDesc
                )
            )
        }

        self.vendorEngagements = mappedEngagements

        // Timeline (13 programme items)
        guard let progRaw = json["programme"] as? [[String: Any]] else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required programme missing in private real shadow fixture.")
        }
        self.timelineEntries = try progRaw.map { item in
            guard let id = item["id"] as? String, !id.isEmpty,
                  let time = item["time"] as? String, !time.isEmpty,
                  let title = item["title"] as? String, !title.isEmpty else {
                throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required programme fields missing in private real shadow fixture.")
            }
            let loc = (item["location"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank ?? venueStr
            return PlannerTimelineEntry(
                id: id,
                time: time,
                title: title,
                location: loc,
                statusLabel: dateStr,
                linkedVendor: nil
            )
        }


        // Documents / contracts. The current account is expected to have zero rows,
        // but the destination remains connected to the selected private snapshot.
        var mappedDocuments: [PlannerDocumentRecord] = []

        if let contractsRaw = json["contracts"] as? [[String: Any]] {
            for item in contractsRaw {
                guard let id = item["id"] as? String, !id.isEmpty else {
                    throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing(
                        "Contract row missing id in private real shadow fixture."
                    )
                }
                let title = ["title", "name", "contractType", "serviceDescription"]
                    .compactMap { (item[$0] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank }
                    .first ?? "Contract"
                let status = ["status", "contractStatus", "lifecycleStatus"]
                    .compactMap { (item[$0] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank }
                    .first?
                    .replacingOccurrences(of: "_", with: " ")
                    .capitalized
                mappedDocuments.append(
                    PlannerDocumentRecord(id: id, title: title, kind: "Contract", statusLabel: status)
                )
            }
        }

        if let vaultRaw = json["vaultObjects"] as? [[String: Any]] {
            for item in vaultRaw {
                guard let id = item["id"] as? String, !id.isEmpty else {
                    throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing(
                        "Vault object row missing id in private real shadow fixture."
                    )
                }
                let title = ["title", "name", "fileName", "objectName"]
                    .compactMap { (item[$0] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank }
                    .first ?? "Document"
                let status = ["status", "state"]
                    .compactMap { (item[$0] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank }
                    .first?
                    .replacingOccurrences(of: "_", with: " ")
                    .capitalized
                mappedDocuments.append(
                    PlannerDocumentRecord(id: id, title: title, kind: "Document", statusLabel: status)
                )
            }
        }
        self.documents = mappedDocuments
    }

    public func getDashboard() async throws -> PlannerDashboardSnapshot {
        let contractCount = documents.filter { $0.kind.caseInsensitiveCompare("Contract") == .orderedSame }.count
        let timelineDateLabel = weddingDate.components(separatedBy: " ").first.flatMap { $0.isEmpty ? nil : $0 } ?? weddingDate

        return PlannerDashboardSnapshot(
            weddingId: weddingId,
            coupleNames: weddingTitle,
            weddingDateLabel: weddingDate,
            lifecycle: weddingLifecycle,
            plannerContext: plannerTitle,
            readinessScore: nil,
            taskCompletionLabel: "\(doneTasksCount) / \(totalTasksCount)",
            attentionItems: [
                PlannerAttentionItem(id: "attn_tasks", title: "\(highPriorityTasksCount) high priority tasks", detail: "Active checklist tasks requiring coordination.", severity: .urgent),
                PlannerAttentionItem(id: "attn_rsvp", title: "\(pendingRsvpCount) RSVPs pending", detail: "\(attendingGuestsCount) confirmed guests across \(totalGuestsCount) invited records.", severity: .warning),
                PlannerAttentionItem(id: "attn_seating", title: "\(assignedInvitedCapacity) of \(totalSeatingCapacity) table seats allocated", detail: "\(remainingTableCapacity) seats free across \(seatingTables.count) tables.", severity: .info),
                PlannerAttentionItem(id: "attn_vendor", title: "\(vendorsCount) vendors recorded", detail: "\(contractCount) active contracts recorded for this wedding.", severity: .info),
                PlannerAttentionItem(id: "attn_payment", title: "Budget & Expenses", detail: "$\(Int(totalPdBudget)) paid of $\(Int(totalActBudget)) actual expenses ($\(Int(totalEstBudget)) estimated).", severity: .info)
            ],
            modules: [
                PlannerModuleSummary(id: "tasks", title: "Tasks", value: "\(doneTasksCount) / \(totalTasksCount)", attention: "\(highPriorityTasksCount) high priority", systemImage: "checklist"),
                PlannerModuleSummary(id: "budget", title: "Budget", value: "$\(String(format: "%.1fk", totalEstBudget / 1000.0))", attention: "$\(String(format: "%.1fk", totalPdBudget / 1000.0)) paid", systemImage: "creditcard.fill"),
                PlannerModuleSummary(id: "contributions", title: "Contributions", value: "\(contributions.count) messages", attention: "Non-monetary", systemImage: "gift.fill"),
                PlannerModuleSummary(id: "vendors", title: "Vendors", value: "\(vendorsCount) vendors", attention: "\(serviceEngagementsCount) service engagements • \(contractCount) contracts", systemImage: "storefront.fill"),
                PlannerModuleSummary(id: "guests", title: "Guests", value: "\(totalGuestsCount)", attention: "\(pendingRsvpCount) pending", systemImage: "person.3.fill"),
                PlannerModuleSummary(id: "seating", title: "Seating", value: "\(assignedInvitedCapacity) / \(totalSeatingCapacity)", attention: "\(remainingTableCapacity) seats free", systemImage: "table.furniture.fill"),
                PlannerModuleSummary(id: "timeline", title: "Timeline", value: "\(timelineEntries.count) items", attention: timelineDateLabel, systemImage: "calendar.badge.clock")
            ],
            recentActivity: [],
            sourceLabel: "Private real-wedding row snapshot"
        )
    }

    public func getBudgetLines() async throws -> [PlannerBudgetLine] { budgetLines }
    public func getContributions() async throws -> [PlannerContributionRecord] { contributions }
    public func getVendorEngagements() async throws -> [PlannerVendorEngagement] { vendorEngagements }
    public func getSeatingTables() async throws -> [PlannerSeatingTable] { seatingTables }
    public func getTimelineEntries() async throws -> [PlannerTimelineEntry] { timelineEntries }
    public func getDocuments() async throws -> [PlannerDocumentRecord] { documents }
}



private extension String {
    var nilIfBlank: String? {
        isEmpty ? nil : self
    }
}
