import Foundation

public protocol PlannerDashboardRepositoryProtocol: Sendable {
    func getDashboard() async throws -> PlannerDashboardSnapshot
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
}
