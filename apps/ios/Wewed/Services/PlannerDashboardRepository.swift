import Foundation

public protocol PlannerDashboardRepositoryProtocol: Sendable {
    func getDashboard() async throws -> PlannerDashboardSnapshot
    func getBudgetLines() async throws -> [PlannerBudgetLine]
    func getContributions() async throws -> [PlannerContributionRecord]
    func getVendorEngagements() async throws -> [PlannerVendorEngagement]
    func getSeatingTables() async throws -> [PlannerSeatingTable]
    func getTimelineEntries() async throws -> [PlannerTimelineEntry]
    func getDocuments() async throws -> [PlannerDocumentRecord]
}

public actor FixturePlannerDashboardRepository: PlannerDashboardRepositoryProtocol {
    public init() {}

    public func getDashboard() async throws -> PlannerDashboardSnapshot {
        PlannerDashboardSnapshot(
            weddingId: "shadow_ref_charity_kudzie",
            coupleNames: "Charity & Kudzie",
            weddingDateLabel: "Upcoming wedding",
            lifecycle: "before",
            plannerContext: "Eleven Eleven Testing",
            readinessScore: 78,
            taskCompletionLabel: "38 / 47",
            attentionItems: [
                PlannerAttentionItem(id: "attn_tasks", title: "3 overdue tasks", detail: "Venue, invitations and logistics need attention.", severity: .urgent),
                PlannerAttentionItem(id: "attn_rsvp", title: "12 RSVPs pending", detail: "Guest follow-up is affecting seating readiness.", severity: .warning),
                PlannerAttentionItem(id: "attn_seating", title: "8 guests unseated", detail: "Complete household table assignments.", severity: .warning),
                PlannerAttentionItem(id: "attn_vendor", title: "2 vendor decisions", detail: "Confirm open service and contract decisions.", severity: .warning),
                PlannerAttentionItem(id: "attn_payment", title: "3 payments due", detail: "Review outstanding wedding payments.", severity: .info)
            ],
            modules: [
                PlannerModuleSummary(id: "tasks", title: "Tasks", value: "38 / 47", attention: "3 overdue", systemImage: "checklist"),
                PlannerModuleSummary(id: "budget", title: "Budget", value: "$18.4k", attention: "3 payments due", systemImage: "creditcard.fill"),
                PlannerModuleSummary(id: "contributions", title: "Contributions", value: "$3.2k", attention: "2 unverified", systemImage: "gift.fill"),
                PlannerModuleSummary(id: "vendors", title: "Vendors", value: "9 booked", attention: "2 decisions", systemImage: "storefront.fill"),
                PlannerModuleSummary(id: "guests", title: "Guests", value: "92", attention: "12 awaiting RSVP", systemImage: "person.3.fill"),
                PlannerModuleSummary(id: "seating", title: "Seating", value: "84 / 92", attention: "8 unseated", systemImage: "table.furniture.fill"),
                PlannerModuleSummary(id: "timeline", title: "Timeline", value: "24 events", attention: "1 conflict", systemImage: "calendar.badge.clock")
            ],
            recentActivity: [
                PlannerActivityItem(id: "act_1", title: "Planner task updated", detail: "A venue readiness task moved forward.", relativeTime: "Today"),
                PlannerActivityItem(id: "act_2", title: "Contribution allocated", detail: "Funding attribution changed a budget item.", relativeTime: "Today"),
                PlannerActivityItem(id: "act_3", title: "RSVP activity", detail: "New guest responses changed the planning totals.", relativeTime: "Yesterday"),
                PlannerActivityItem(id: "act_4", title: "Seating updated", detail: "A household table assignment changed.", relativeTime: "Yesterday")
            ],
            sourceLabel: "Sanitized reference fixture — NOT production snapshot"
        )
    }

    public func getBudgetLines() async throws -> [PlannerBudgetLine] {
        [
            PlannerBudgetLine(id: "budget_venue", category: "Venue & Catering", vendorName: "Shadow Venue Partner", estimated: 12000, actual: 11800, paid: 8000, dueDateLabel: "Balance due before event", fundingLabel: "Couple + contributor funding", statusLabel: "Partially paid"),
            PlannerBudgetLine(id: "budget_photo", category: "Photography & Video", vendorName: "Shadow Visuals", estimated: 3500, actual: 3500, paid: 3500, dueDateLabel: nil, fundingLabel: "Couple funded", statusLabel: "Paid"),
            PlannerBudgetLine(id: "budget_decor", category: "Decor & Florals", vendorName: "Shadow Events", estimated: 3000, actual: 3200, paid: 1500, dueDateLabel: "Final balance pending", fundingLabel: "Contributor + couple", statusLabel: "Deposit paid"),
            PlannerBudgetLine(id: "budget_sound", category: "Music & Sound", vendorName: "Shadow Sound", estimated: 1500, actual: 1650, paid: 500, dueDateLabel: "Payment milestone open", fundingLabel: "Couple funded", statusLabel: "Balance pending")
        ]
    }

    public func getContributions() async throws -> [PlannerContributionRecord] {
        [
            PlannerContributionRecord(id: "contrib_1", contributorLabel: "Contributor A", typeLabel: "Cash contribution", value: 1200, statusLabel: "Received", allocationLabel: "Venue & Catering", verified: true),
            PlannerContributionRecord(id: "contrib_2", contributorLabel: "Contributor B", typeLabel: "Direct vendor payment", value: 900, statusLabel: "Verified", allocationLabel: "Decor & Florals", verified: true),
            PlannerContributionRecord(id: "contrib_3", contributorLabel: "Contributor C", typeLabel: "In-kind service", value: 650, statusLabel: "Pending verification", allocationLabel: "Transport", verified: false),
            PlannerContributionRecord(id: "contrib_4", contributorLabel: "Contributor D", typeLabel: "Pledge", value: 450, statusLabel: "Pledged", allocationLabel: "Unallocated", verified: false)
        ]
    }

    public func getVendorEngagements() async throws -> [PlannerVendorEngagement] {
        [
            PlannerVendorEngagement(id: "vendor_1", vendorName: "Shadow Venue Partner", category: "Venue & Catering", bookingStatus: "Booked", contractStatus: "Signed", paymentStatus: "Balance due", nextAction: "Confirm final headcount"),
            PlannerVendorEngagement(id: "vendor_2", vendorName: "Shadow Visuals", category: "Photography & Video", bookingStatus: "Booked", contractStatus: "Signed", paymentStatus: "Paid", nextAction: "Confirm shot list"),
            PlannerVendorEngagement(id: "vendor_3", vendorName: "Shadow Events", category: "Decor & Florals", bookingStatus: "Booked", contractStatus: "Needs review", paymentStatus: "Deposit paid", nextAction: "Approve floral substitutions"),
            PlannerVendorEngagement(id: "vendor_4", vendorName: "Shadow Sound", category: "Music & Sound", bookingStatus: "Booked", contractStatus: "Signed", paymentStatus: "Balance pending", nextAction: "Lock reception playlist")
        ]
    }

    public func getSeatingTables() async throws -> [PlannerSeatingTable] {
        [
            PlannerSeatingTable(id: "table_1", name: "Baobab", zone: "Family", capacity: 10, assigned: 10, attentionLabel: nil),
            PlannerSeatingTable(id: "table_2", name: "Jacaranda", zone: "Friends", capacity: 10, assigned: 8, attentionLabel: "2 seats free"),
            PlannerSeatingTable(id: "table_3", name: "Acacia", zone: "Family", capacity: 10, assigned: 9, attentionLabel: "1 seat free"),
            PlannerSeatingTable(id: "table_4", name: "Flame Lily", zone: "VIP", capacity: 8, assigned: 7, attentionLabel: "1 assignment pending")
        ]
    }

    public func getTimelineEntries() async throws -> [PlannerTimelineEntry] {
        [
            PlannerTimelineEntry(id: "time_1", time: "10:00", title: "Venue setup verification", location: "Main venue", statusLabel: "Planning", linkedVendor: "Shadow Venue Partner"),
            PlannerTimelineEntry(id: "time_2", time: "12:30", title: "Photography arrival & detail shots", location: "Preparation suite", statusLabel: "Confirmed", linkedVendor: "Shadow Visuals"),
            PlannerTimelineEntry(id: "time_3", time: "13:15", title: "Guest arrival", location: "Main gate", statusLabel: "Upcoming", linkedVendor: nil),
            PlannerTimelineEntry(id: "time_4", time: "14:00", title: "Ceremony", location: "Ceremony area", statusLabel: "Upcoming", linkedVendor: nil),
            PlannerTimelineEntry(id: "time_5", time: "17:30", title: "Reception", location: "Reception space", statusLabel: "Upcoming", linkedVendor: "Shadow Sound")
        ]
    }
    public func getDocuments() async throws -> [PlannerDocumentRecord] {
        []
    }

}
