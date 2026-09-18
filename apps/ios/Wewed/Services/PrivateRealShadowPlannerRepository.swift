import Foundation

/// Planner-side repository for the Private Real Shadow scenario (Charity & Kudzie / Eleven Eleven Testing).
public actor PrivateRealShadowPlannerRepository: PlannerDashboardRepositoryProtocol {
    private let budgetLines: [PlannerBudgetLine]
    private let contributions: [PlannerContributionRecord]
    private let vendorEngagements: [PlannerVendorEngagement]
    private let seatingTables: [PlannerSeatingTable]
    private let timelineEntries: [PlannerTimelineEntry]
    private let weddingTitle: String
    private let weddingId: String
    private let weddingDate: String
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
              let lifecycleStr = weddingDict["lifecycle"] as? String, !lifecycleStr.isEmpty else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required wedding metadata missing in private real shadow fixture.")
        }
        self.weddingId = wId
        self.weddingTitle = coupleTitle
        self.weddingDate = dateStr
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
            let vName = item["vendorName"] as? String
            let due = item["dueDate"] as? String
            let status = pd >= act && act > 0 ? "Paid" : (pd > 0 ? "Deposit paid" : "Unpaid")
            return PlannerBudgetLine(
                id: id,
                category: cat.capitalized,
                vendorName: vName,
                estimated: est,
                actual: act,
                paid: pd,
                dueDateLabel: due,
                fundingLabel: "Direct expense",
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
            let contributorName = guestNameMap[guestId] ?? "Guest"
            let formattedType = type.replacingOccurrences(of: "_", with: " ").capitalized
            let formattedStatus = status.capitalized
            return PlannerContributionRecord(
                id: id,
                contributorLabel: contributorName,
                typeLabel: formattedType,
                value: 0.0,
                statusLabel: formattedStatus,
                allocationLabel: "Guest Story & Blessing",
                verified: true
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
            let zone = name.contains("Family") ? "Family" : (name.contains("Bridal") ? "Bridal Party" : (name.contains("VIP") ? "VIP" : (name.contains("Colleagues") ? "Colleagues" : "Friends")))
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

        var engagementsByVendor: [String: [String: Any]] = [:]
        for se in engagementsRaw {
            if let vId = se["vendorId"] as? String {
                engagementsByVendor[vId] = se
            }
        }

        self.vendorEngagements = try vendorsRaw.map { item in
            guard let id = item["id"] as? String, !id.isEmpty,
                  let name = item["name"] as? String, !name.isEmpty,
                  let cat = item["category"] as? String, !cat.isEmpty else {
                throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Required vendor fields missing in private real shadow fixture.")
            }
            let paymentStatus = (item["paymentStatus"] as? String)?.capitalized ?? "Unpaid"
            let se = engagementsByVendor[id]
            let serviceDesc = se?["serviceDescription"] as? String ?? "\(cat.capitalized) services"
            let lifecycleStatus = (se?["lifecycleStatus"] as? String)?.replacingOccurrences(of: "_", with: " ").capitalized ?? "Recorded"
            let externalAgreementStatus = (se?["externalAgreementStatus"] as? String)?.capitalized ?? "None"

            return PlannerVendorEngagement(
                id: id,
                vendorName: name,
                category: cat.capitalized,
                bookingStatus: lifecycleStatus,
                contractStatus: externalAgreementStatus,
                paymentStatus: paymentStatus,
                nextAction: serviceDesc
            )
        }

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
            let loc = (item["location"] as? String) ?? "Imba Manor"
            return PlannerTimelineEntry(
                id: id,
                time: time,
                title: title,
                location: loc,
                statusLabel: "23 Dec 2026",
                linkedVendor: nil
            )
        }
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
                PlannerModuleSummary(id: "vendors", title: "Vendors", value: "\(vendorsCount) recorded", attention: "0 contracts", systemImage: "storefront.fill"),
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
}

