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

        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Invalid JSON format in private real shadow fixture.")
        }

        guard let weddingDict = json["wedding"] as? [String: Any],
              let wId = weddingDict["id"] as? String, !wId.isEmpty,
              let coupleTitle = weddingDict["title"] as? String, !coupleTitle.isEmpty,
              let dateStr = weddingDict["dateRaw"] as? String, !dateStr.isEmpty,
              let venueStr = weddingDict["venue"] as? String, !venueStr.isEmpty,
              let lifecycleStr = weddingDict["lifecycle"] as? String, !lifecycleStr.isEmpty else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required wedding metadata missing in private real shadow fixture.")
        }
        self.weddingId = wId
        self.weddingTitle = coupleTitle
        self.weddingDate = dateStr
        self.weddingVenue = venueStr
        self.weddingLifecycle = lifecycleStr

        guard let plannerDict = json["planner"] as? [String: Any],
              let pTitle = (plannerDict["displayName"] as? String ?? plannerDict["businessName"] as? String), !pTitle.isEmpty else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required planner metadata missing in private real shadow fixture.")
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

        // Guest Map for name resolution
        guard let guestsRaw = json["guests"] as? [[String: Any]] else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required guests list missing in private real shadow fixture.")
        }
        self.totalGuestsCount = guestsRaw.count
        var guestNameMap: [String: String] = [:]
        var tableAssignedCapacity: [String: Int] = [:]
        var totalAssignedCap = 0
        var pendingCount = 0
        var attendingCount = 0

        for g in guestsRaw {
            guard let gId = g["id"] as? String, !gId.isEmpty,
                  let gName = g["name"] as? String, !gName.isEmpty,
                  let partySize = g["partySize"] as? Int,
                  let rsvpRaw = g["rsvpStatus"] as? String else {
                throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required guest fields missing in private real shadow fixture.")
            }
            guestNameMap[gId] = gName
            if rsvpRaw.lowercased() == "attending" || rsvpRaw.lowercased() == "confirmed" {
                attendingCount += 1
            } else if rsvpRaw.lowercased() == "declined" {
                // declined
            } else {
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
            let contributionText = ["message", "content", "story", "note", "text"]
                .compactMap { (item[$0] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank }
                .first ?? "Non-monetary contribution"
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

        // Preserve vendors that exist but do not yet have a service engagement.
        for vendor in vendorsRaw {
            guard let id = vendor["id"] as? String, !id.isEmpty,
                  !vendorsWithEngagements.contains(id),
                  let name = vendor["name"] as? String, !name.isEmpty,
                  let cat = vendor["category"] as? String, !cat.isEmpty else {
                continue
            }
            let paymentStatus = (vendor["paymentStatus"] as? String).flatMap { raw -> String? in
                let cleaned = raw.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !cleaned.isEmpty else { return nil }
                return cleaned.replacingOccurrences(of: "_", with: " ").capitalized
            } ?? "Not recorded"

            mappedEngagements.append(
                PlannerVendorEngagement(
                    id: "vendor-\(id)",
                    vendorName: name,
                    category: cat.capitalized,
                    bookingStatus: "No service engagement recorded",
                    contractStatus: "Not recorded",
                    paymentStatus: paymentStatus,
                    nextAction: "Service details not recorded"
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
                .trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank ?? weddingVenue
            return PlannerTimelineEntry(
                id: id,
                time: time,
                title: title,
                location: loc,
                statusLabel: weddingDate,
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
        PlannerDashboardSnapshot(
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
                PlannerAttentionItem(id: "attn_vendor", title: "\(vendorsCount) vendors recorded", detail: "0 active contracts recorded for this wedding.", severity: .info),
                PlannerAttentionItem(id: "attn_payment", title: "Budget & Expenses", detail: "$\(Int(totalPdBudget)) paid of $\(Int(totalActBudget)) actual expenses ($\(Int(totalEstBudget)) estimated).", severity: .info)
            ],
            modules: [
                PlannerModuleSummary(id: "tasks", title: "Tasks", value: "\(doneTasksCount) / \(totalTasksCount)", attention: "\(highPriorityTasksCount) high priority", systemImage: "checklist"),
                PlannerModuleSummary(id: "budget", title: "Budget", value: "$\(String(format: "%.1fk", totalEstBudget / 1000.0))", attention: "$\(String(format: "%.1fk", totalPdBudget / 1000.0)) paid", systemImage: "creditcard.fill"),
                PlannerModuleSummary(id: "contributions", title: "Contributions", value: "\(contributions.count) messages", attention: "Non-monetary", systemImage: "gift.fill"),
                PlannerModuleSummary(id: "vendors", title: "Vendors", value: "\(vendorsCount) vendors", attention: "\(serviceEngagementsCount) service engagements • 0 contracts", systemImage: "storefront.fill"),
                PlannerModuleSummary(id: "guests", title: "Guests", value: "\(totalGuestsCount)", attention: "\(pendingRsvpCount) pending", systemImage: "person.3.fill"),
                PlannerModuleSummary(id: "seating", title: "Seating", value: "\(assignedInvitedCapacity) / \(totalSeatingCapacity)", attention: "\(remainingTableCapacity) seats free", systemImage: "table.furniture.fill"),
                PlannerModuleSummary(id: "timeline", title: "Timeline", value: "\(timelineEntries.count) items", attention: "23 Dec 2026", systemImage: "calendar.badge.clock")
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
