import Foundation

/// Planner-side repository for the Private Real Shadow scenario (Charity & Kudzie / Eleven Eleven Testing).
public actor PrivateRealShadowPlannerRepository: PlannerDashboardRepositoryProtocol {
    private let budgetLines: [PlannerBudgetLine]
    private let contributions: [PlannerContributionRecord]
    private let vendorEngagements: [PlannerVendorEngagement]
    private let seatingTables: [PlannerSeatingTable]
    private let timelineEntries: [PlannerTimelineEntry]
    private let weddingTitle: String
    private let plannerTitle: String

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

        let weddingDict = json["wedding"] as? [String: Any] ?? [:]
        self.weddingTitle = (weddingDict["title"] as? String) ?? "Charity & Kudzie"

        let plannerDict = json["planner"] as? [String: Any] ?? [:]
        self.plannerTitle = (plannerDict["displayName"] as? String) ?? "Eleven Eleven Testing"

        // Budget lines (22 items)
        let bItemsRaw = json["budgetItems"] as? [[String: Any]] ?? []
        self.budgetLines = bItemsRaw.enumerated().map { (idx, item) in
            let id = (item["id"] as? String) ?? "bitem_\(idx + 1)"
            let cat = (item["category"] as? String) ?? "general"
            let vName = item["vendorName"] as? String
            let est = (item["estimatedCost"] as? NSNumber)?.doubleValue ?? 0
            let act = (item["actualCost"] as? NSNumber)?.doubleValue ?? 0
            let pd = (item["paidAmount"] as? NSNumber)?.doubleValue ?? 0
            let due = item["dueDate"] as? String
            let status = pd >= act && act > 0 ? "Paid" : (pd > 0 ? "Deposit paid" : "Unpaid")
            return PlannerBudgetLine(
                id: id,
                category: cat,
                vendorName: vName,
                estimated: est,
                actual: act,
                paid: pd,
                dueDateLabel: due,
                fundingLabel: "Couple funded",
                statusLabel: status
            )
        }

        // Contributions (4 records)
        let contribRaw = json["contributions"] as? [[String: Any]] ?? []
        self.contributions = contribRaw.enumerated().map { (idx, item) in
            let id = (item["id"] as? String) ?? "contrib_\(idx + 1)"
            let type = (item["type"] as? String)?.capitalized ?? "Blessing"
            let status = (item["status"] as? String)?.capitalized ?? "Approved"
            return PlannerContributionRecord(
                id: id,
                contributorLabel: "Guest Contributor",
                typeLabel: type,
                value: 0,
                statusLabel: status,
                allocationLabel: "Guest Messages",
                verified: true
            )
        }

        // Vendor Engagements (7 vendors / 8 service engagements)
        let vendorsRaw = json["vendors"] as? [[String: Any]] ?? []
        self.vendorEngagements = vendorsRaw.enumerated().map { (idx, item) in
            let id = (item["id"] as? String) ?? "vnd_\(idx + 1)"
            let name = (item["name"] as? String) ?? "Vendor \(idx + 1)"
            let cat = (item["category"] as? String) ?? "other"
            let payStatus = (item["paymentStatus"] as? String)?.capitalized ?? "Unpaid"
            return PlannerVendorEngagement(
                id: id,
                vendorName: name,
                category: cat,
                bookingStatus: "Confirmed",
                contractStatus: "Pending",
                paymentStatus: payStatus,
                nextAction: "Operational review"
            )
        }

        // Seating Tables (8 tables)
        let tablesRaw = json["seatingTables"] as? [[String: Any]] ?? []
        let guestsRaw = json["guests"] as? [[String: Any]] ?? []
        var tableCounts: [String: Int] = [:]
        for g in guestsRaw {
            if let tId = g["seatingTableId"] as? String {
                tableCounts[tId, default: 0] += 1
            }
        }

        self.seatingTables = tablesRaw.enumerated().map { (idx, item) in
            let id = (item["id"] as? String) ?? "tbl_\(idx + 1)"
            let name = (item["name"] as? String) ?? "Table \(idx + 1)"
            let cap = (item["capacity"] as? Int) ?? 8
            let assigned = tableCounts[id] ?? 0
            let free = max(0, cap - assigned)
            let zone = name.contains("Family") ? "Family" : (name.contains("Bridal") ? "Bridal Party" : (name.contains("VIP") ? "VIP" : "Friends"))
            return PlannerSeatingTable(
                id: id,
                name: name,
                zone: zone,
                capacity: cap,
                assigned: assigned,
                attentionLabel: "\(free) seats free"
            )
        }

        // Timeline (13 items)
        let progRaw = json["programme"] as? [[String: Any]] ?? []
        self.timelineEntries = progRaw.enumerated().map { (idx, item) in
            let id = (item["id"] as? String) ?? "prog_\(idx + 1)"
            let time = (item["time"] as? String) ?? "12:00"
            let title = (item["title"] as? String) ?? "Event"
            let loc = (item["location"] as? String) ?? "Imba Manor"
            return PlannerTimelineEntry(
                id: id,
                time: time,
                title: title,
                location: loc,
                statusLabel: "Scheduled",
                linkedVendor: nil
            )
        }
    }

    public func getDashboard() async throws -> PlannerDashboardSnapshot {
        PlannerDashboardSnapshot(
            weddingId: "cmqos70cb0004q6vxe9g9aiu5",
            coupleNames: weddingTitle,
            weddingDateLabel: "2026-12-23 14:00:00",
            lifecycle: "before",
            plannerContext: plannerTitle,
            readinessScore: nil,
            taskCompletionLabel: "7 / 42",
            attentionItems: [
                PlannerAttentionItem(id: "attn_tasks", title: "8 high priority tasks", detail: "Venue, invitations and logistics need attention.", severity: .urgent),
                PlannerAttentionItem(id: "attn_rsvp", title: "172 RSVPs pending", detail: "Guest follow-up is affecting seating readiness.", severity: .warning),
                PlannerAttentionItem(id: "attn_seating", title: "152 guests unseated", detail: "Complete table allocations for invited party capacity.", severity: .warning),
                PlannerAttentionItem(id: "attn_vendor", title: "7 vendors booked", detail: "Operational contracts and logistics reviews in progress.", severity: .info),
                PlannerAttentionItem(id: "attn_payment", title: "Payments in progress", detail: "$3,875 paid out of $8,690 actual expenses.", severity: .info)
            ],
            modules: [
                PlannerModuleSummary(id: "tasks", title: "Tasks", value: "7 / 42", attention: "8 urgent", systemImage: "checklist"),
                PlannerModuleSummary(id: "budget", title: "Budget", value: "$30.4k", attention: "$3.9k paid", systemImage: "creditcard.fill"),
                PlannerModuleSummary(id: "contributions", title: "Contributions", value: "4 memories", attention: "4 approved", systemImage: "gift.fill"),
                PlannerModuleSummary(id: "vendors", title: "Vendors", value: "7 booked", attention: "0 contracts", systemImage: "storefront.fill"),
                PlannerModuleSummary(id: "guests", title: "Guests", value: "174", attention: "172 awaiting RSVP", systemImage: "person.3.fill"),
                PlannerModuleSummary(id: "seating", title: "Seating", value: "22 / 64", attention: "42 seats free", systemImage: "table.furniture.fill"),
                PlannerModuleSummary(id: "timeline", title: "Timeline", value: "13 events", attention: "Programme locked", systemImage: "calendar.badge.clock")
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
