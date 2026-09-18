import Foundation

/// Planner-side repository for the production-derived Charity & Kudzie / Eleven Eleven Testing
/// shadow reference scenario.
public actor ShadowReferencePlannerRepository: PlannerDashboardRepositoryProtocol {
    private let budgetLines: [PlannerBudgetLine]
    private let contributions: [PlannerContributionRecord]
    private let vendorEngagements: [PlannerVendorEngagement]
    private let seatingTables: [PlannerSeatingTable]
    private let timelineEntries: [PlannerTimelineEntry]

    public init() {
        budgetLines = [
            PlannerBudgetLine(id: "shadow_bitem_01", category: "attire", vendorName: "TBD", estimated: 1800, actual: 250, paid: 250, dueDateLabel: nil, fundingLabel: "Couple funded", statusLabel: "Paid"),
            PlannerBudgetLine(id: "shadow_bitem_02", category: "attire", vendorName: nil, estimated: 800, actual: 170, paid: 0, dueDateLabel: nil, fundingLabel: "Couple funded", statusLabel: "Unpaid"),
            PlannerBudgetLine(id: "shadow_bitem_03", category: "attire", vendorName: nil, estimated: 2400, actual: 0, paid: 0, dueDateLabel: nil, fundingLabel: "Couple funded", statusLabel: "Unpaid"),
            PlannerBudgetLine(id: "shadow_bitem_04", category: "attire", vendorName: "American Swiss/Stands/Bella Margerate", estimated: 500, actual: 300, paid: 375, dueDateLabel: "2026-12-16 00:00:00", fundingLabel: "Couple funded", statusLabel: "Paid"),
            PlannerBudgetLine(id: "shadow_bitem_05", category: "attire", vendorName: "Shein", estimated: 100, actual: 100, paid: 0, dueDateLabel: "2026-11-30 00:00:00", fundingLabel: "Couple funded", statusLabel: "Unpaid"),
            PlannerBudgetLine(id: "shadow_bitem_06", category: "attire", vendorName: "Zimbabwe", estimated: 250, actual: 240, paid: 0, dueDateLabel: "2026-12-17 00:00:00", fundingLabel: "Couple funded", statusLabel: "Unpaid"),
            PlannerBudgetLine(id: "shadow_bitem_07", category: "attire", vendorName: "Makeup Artist", estimated: 150, actual: 150, paid: 0, dueDateLabel: "2026-12-23 00:00:00", fundingLabel: "Couple funded", statusLabel: "Unpaid"),
            PlannerBudgetLine(id: "shadow_bitem_08", category: "catering", vendorName: nil, estimated: 6000, actual: 1500, paid: 0, dueDateLabel: nil, fundingLabel: "Couple funded", statusLabel: "Unpaid"),
            PlannerBudgetLine(id: "shadow_bitem_09", category: "catering", vendorName: nil, estimated: 600, actual: 350, paid: 100, dueDateLabel: nil, fundingLabel: "Couple funded", statusLabel: "Deposit paid"),
            PlannerBudgetLine(id: "shadow_bitem_10", category: "decor", vendorName: nil, estimated: 2500, actual: 150, paid: 50, dueDateLabel: nil, fundingLabel: "Couple funded", statusLabel: "Deposit paid"),
            PlannerBudgetLine(id: "shadow_bitem_11", category: "decor", vendorName: nil, estimated: 1200, actual: 0, paid: 0, dueDateLabel: nil, fundingLabel: "Couple funded", statusLabel: "Unpaid"),
            PlannerBudgetLine(id: "shadow_bitem_12", category: "decor", vendorName: "Shein", estimated: 400, actual: 150, paid: 0, dueDateLabel: "2026-11-30 00:00:00", fundingLabel: "Couple funded", statusLabel: "Unpaid"),
            PlannerBudgetLine(id: "shadow_bitem_13", category: "miscellaneous", vendorName: nil, estimated: 1500, actual: 200, paid: 0, dueDateLabel: nil, fundingLabel: "Couple funded", statusLabel: "Unpaid"),
            PlannerBudgetLine(id: "shadow_bitem_14", category: "miscellaneous", vendorName: "Tony", estimated: 320, actual: 320, paid: 100, dueDateLabel: "2026-12-24 00:00:00", fundingLabel: "Couple funded", statusLabel: "Deposit paid"),
            PlannerBudgetLine(id: "shadow_bitem_15", category: "miscellaneous", vendorName: nil, estimated: 500, actual: 500, paid: 0, dueDateLabel: nil, fundingLabel: "Couple funded", statusLabel: "Unpaid"),
            PlannerBudgetLine(id: "shadow_bitem_16", category: "music", vendorName: nil, estimated: 1500, actual: 230, paid: 100, dueDateLabel: nil, fundingLabel: "Couple funded", statusLabel: "Deposit paid"),
            PlannerBudgetLine(id: "shadow_bitem_17", category: "photo_video", vendorName: nil, estimated: 3200, actual: 500, paid: 180, dueDateLabel: nil, fundingLabel: "Couple funded", statusLabel: "Deposit paid"),
            PlannerBudgetLine(id: "shadow_bitem_18", category: "stationery", vendorName: nil, estimated: 700, actual: 120, paid: 120, dueDateLabel: nil, fundingLabel: "Couple funded", statusLabel: "Paid"),
            PlannerBudgetLine(id: "shadow_bitem_19", category: "transport", vendorName: nil, estimated: 900, actual: 500, paid: 0, dueDateLabel: nil, fundingLabel: "Couple funded", statusLabel: "Unpaid"),
            PlannerBudgetLine(id: "shadow_bitem_20", category: "venue", vendorName: "Imba Manor", estimated: 4500, actual: 2400, paid: 2400, dueDateLabel: nil, fundingLabel: "Couple funded", statusLabel: "Paid"),
            PlannerBudgetLine(id: "shadow_bitem_21", category: "venue", vendorName: nil, estimated: 460, actual: 460, paid: 200, dueDateLabel: nil, fundingLabel: "Couple funded", statusLabel: "Deposit paid"),
            PlannerBudgetLine(id: "shadow_bitem_22", category: "venue", vendorName: "munokokwa  events", estimated: 100, actual: 100, paid: 0, dueDateLabel: nil, fundingLabel: "Couple funded", statusLabel: "Unpaid"),
        ]

        contributions = [
            PlannerContributionRecord(id: "shadow_contrib_01", contributorLabel: "Guest Contributor", typeLabel: "Blessing", value: 0, statusLabel: "Approved", allocationLabel: "Guest Messages", verified: true),
            PlannerContributionRecord(id: "shadow_contrib_02", contributorLabel: "Guest Contributor", typeLabel: "Wish", value: 0, statusLabel: "Featured", allocationLabel: "Guest Messages", verified: true),
            PlannerContributionRecord(id: "shadow_contrib_03", contributorLabel: "Guest Contributor", typeLabel: "Funny Story", value: 0, statusLabel: "Approved", allocationLabel: "Guest Messages", verified: true),
            PlannerContributionRecord(id: "shadow_contrib_04", contributorLabel: "Guest Contributor", typeLabel: "Memory", value: 0, statusLabel: "Approved", allocationLabel: "Guest Messages", verified: true),
        ]

        vendorEngagements = [
            PlannerVendorEngagement(id: "shadow_vnd_01", vendorName: "Cake Gourmet", category: "caterer", bookingStatus: "Confirmed", contractStatus: "Pending", paymentStatus: "Deposit", nextAction: "Operational review"),
            PlannerVendorEngagement(id: "shadow_vnd_02", vendorName: "MC Aloe The Avangelist", category: "dj", bookingStatus: "Confirmed", contractStatus: "Pending", paymentStatus: "Unpaid", nextAction: "Operational review"),
            PlannerVendorEngagement(id: "shadow_vnd_03", vendorName: "The Glass Petal Atelier", category: "florist", bookingStatus: "Confirmed", contractStatus: "Signed", paymentStatus: "Deposit", nextAction: "Operational review"),
            PlannerVendorEngagement(id: "shadow_vnd_04", vendorName: "Makeup Artist", category: "other", bookingStatus: "Confirmed", contractStatus: "Pending", paymentStatus: "Unpaid", nextAction: "Operational review"),
            PlannerVendorEngagement(id: "shadow_vnd_05", vendorName: "TBD", category: "other", bookingStatus: "Confirmed", contractStatus: "Pending", paymentStatus: "Unpaid", nextAction: "Operational review"),
            PlannerVendorEngagement(id: "shadow_vnd_06", vendorName: "FAUME MEDIA", category: "photographer", bookingStatus: "Confirmed", contractStatus: "Signed", paymentStatus: "Unpaid", nextAction: "Operational review"),
            PlannerVendorEngagement(id: "shadow_vnd_07", vendorName: "Imba Manor", category: "venue", bookingStatus: "Confirmed", contractStatus: "Negotiating", paymentStatus: "Paid", nextAction: "Operational review"),
        ]

        seatingTables = [
            PlannerSeatingTable(id: "shadow_tbl_01", name: "Table 1 — Family", zone: "Family", capacity: 8, assigned: 7, attentionLabel: "1 seats free"),
            PlannerSeatingTable(id: "shadow_tbl_02", name: "Table 2 — Family", zone: "Family", capacity: 8, assigned: 4, attentionLabel: "4 seats free"),
            PlannerSeatingTable(id: "shadow_tbl_03", name: "Table 3 — Bridal Party", zone: "Bridal Party", capacity: 8, assigned: 5, attentionLabel: "3 seats free"),
            PlannerSeatingTable(id: "shadow_tbl_04", name: "Table 4 — Bridal Party", zone: "Bridal Party", capacity: 8, assigned: 0, attentionLabel: "8 seats free"),
            PlannerSeatingTable(id: "shadow_tbl_05", name: "Table 5 — Friends", zone: "Friends", capacity: 8, assigned: 2, attentionLabel: "6 seats free"),
            PlannerSeatingTable(id: "shadow_tbl_06", name: "Table 6 — Friends", zone: "Friends", capacity: 8, assigned: 1, attentionLabel: "7 seats free"),
            PlannerSeatingTable(id: "shadow_tbl_07", name: "Table 7 — Colleagues", zone: "Colleagues", capacity: 8, assigned: 2, attentionLabel: "6 seats free"),
            PlannerSeatingTable(id: "shadow_tbl_08", name: "Table 8 — VIPs", zone: "VIP", capacity: 8, assigned: 1, attentionLabel: "7 seats free"),
        ]

        timelineEntries = [
            PlannerTimelineEntry(id: "shadow_prog_01", time: "14:00", title: "Ceremony Begins", location: "Imba Manor", statusLabel: "Scheduled", linkedVendor: nil),
            PlannerTimelineEntry(id: "shadow_prog_02", time: "13:00", title: "Guest Arrival", location: "Imba Manor", statusLabel: "Scheduled", linkedVendor: nil),
            PlannerTimelineEntry(id: "shadow_prog_03", time: "14:45", title: "Confetti & Congratulations", location: "Imba Manor", statusLabel: "Scheduled", linkedVendor: nil),
            PlannerTimelineEntry(id: "shadow_prog_04", time: "15:30", title: "Cocktail Hour", location: "Imba Manor", statusLabel: "Scheduled", linkedVendor: nil),
            PlannerTimelineEntry(id: "shadow_prog_05", time: "16:30", title: "Reception Entrance", location: "Imba Manor", statusLabel: "Scheduled", linkedVendor: nil),
            PlannerTimelineEntry(id: "shadow_prog_06", time: "17:00", title: "First Dance", location: "Imba Manor", statusLabel: "Scheduled", linkedVendor: nil),
            PlannerTimelineEntry(id: "shadow_prog_07", time: "17:30", title: "Dinner is Served", location: "Imba Manor", statusLabel: "Scheduled", linkedVendor: nil),
            PlannerTimelineEntry(id: "shadow_prog_08", time: "18:30", title: "Speeches & Toasts", location: "Imba Manor", statusLabel: "Scheduled", linkedVendor: nil),
            PlannerTimelineEntry(id: "shadow_prog_09", time: "19:30", title: "Cake Cutting", location: "Imba Manor", statusLabel: "Scheduled", linkedVendor: nil),
            PlannerTimelineEntry(id: "shadow_prog_10", time: "11:45", title: "UAT-TIMELINE-001 Vendor access and setup", location: "Imba Manor service entrance", statusLabel: "Scheduled", linkedVendor: nil),
            PlannerTimelineEntry(id: "shadow_prog_11", time: "20:00", title: "Dance Floor Opens", location: "Imba Manor", statusLabel: "Scheduled", linkedVendor: nil),
            PlannerTimelineEntry(id: "shadow_prog_12", time: "22:00", title: "Last Dance", location: "Imba Manor", statusLabel: "Scheduled", linkedVendor: nil),
            PlannerTimelineEntry(id: "shadow_prog_13", time: "22:30", title: "Sparkler Send-Off", location: "Imba Manor", statusLabel: "Scheduled", linkedVendor: nil),
        ]
    }

    public func getDashboard() async throws -> PlannerDashboardSnapshot {
        PlannerDashboardSnapshot(
            weddingId: "shadow_ref_charity_kudzie",
            coupleNames: "Charity & Kudzie",
            weddingDateLabel: "2026-12-23 14:00:00",
            lifecycle: "before",
            plannerContext: "Eleven Eleven Testing",
            readinessScore: 17,
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
                PlannerModuleSummary(id: "vendors", title: "Vendors", value: "7 booked", attention: "1 contract signed", systemImage: "storefront.fill"),
                PlannerModuleSummary(id: "guests", title: "Guests", value: "174", attention: "172 awaiting RSVP", systemImage: "person.3.fill"),
                PlannerModuleSummary(id: "seating", title: "Seating", value: "22 / 64", attention: "42 seats free", systemImage: "table.furniture.fill"),
                PlannerModuleSummary(id: "timeline", title: "Timeline", value: "13 events", attention: "Programme locked", systemImage: "calendar.badge.clock")
            ],
            recentActivity: [
                PlannerActivityItem(id: "act_1", title: "Venue confirmed", detail: "Imba Manor confirmed for ceremony and reception.", relativeTime: "Today"),
                PlannerActivityItem(id: "act_2", title: "Guest contribution submitted", detail: "New wedding blessing added to the memory stream.", relativeTime: "Today"),
                PlannerActivityItem(id: "act_3", title: "RSVP party check-in verified", detail: "Party admission tested with QR verification.", relativeTime: "Yesterday"),
                PlannerActivityItem(id: "act_4", title: "Seating updated", detail: "Table 1 Family allocations reviewed.", relativeTime: "Yesterday")
            ],
            sourceLabel: "Production-derived reference fixture"
        )
    }

    public func getBudgetLines() async throws -> [PlannerBudgetLine] { budgetLines }
    public func getContributions() async throws -> [PlannerContributionRecord] { contributions }
    public func getVendorEngagements() async throws -> [PlannerVendorEngagement] { vendorEngagements }
    public func getSeatingTables() async throws -> [PlannerSeatingTable] { seatingTables }
    public func getTimelineEntries() async throws -> [PlannerTimelineEntry] { timelineEntries }
}
