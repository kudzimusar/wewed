package pro.wewed.app.services

import pro.wewed.app.models.*

interface PlannerDashboardRepository {
    suspend fun getDashboard(): PlannerDashboardSnapshot
}

class FixturePlannerDashboardRepository : PlannerDashboardRepository {
    override suspend fun getDashboard(): PlannerDashboardSnapshot {
        return PlannerDashboardSnapshot(
            weddingId = "shadow_ref_charity_kudzie",
            coupleNames = "Charity & Kudzie",
            weddingDateLabel = "Upcoming wedding",
            lifecycle = "before",
            plannerContext = "Eleven Eleven Testing",
            readinessScore = 78,
            attentionItems = listOf(
                PlannerAttentionItem("attn_tasks", "3 overdue tasks", "Venue, invitations and logistics need attention.", PlannerAttentionSeverity.URGENT),
                PlannerAttentionItem("attn_rsvp", "12 RSVPs pending", "Guest follow-up is affecting seating readiness.", PlannerAttentionSeverity.WARNING),
                PlannerAttentionItem("attn_seating", "8 guests unseated", "Complete household table assignments.", PlannerAttentionSeverity.WARNING),
                PlannerAttentionItem("attn_vendor", "2 vendor decisions", "Confirm open service and contract decisions.", PlannerAttentionSeverity.WARNING),
                PlannerAttentionItem("attn_payment", "3 payments due", "Review outstanding wedding payments.", PlannerAttentionSeverity.INFO)
            ),
            modules = listOf(
                PlannerModuleSummary("tasks", "Tasks", "38 / 47", "3 overdue", "tasks"),
                PlannerModuleSummary("budget", "Budget", "$18.4k", "3 payments due", "budget"),
                PlannerModuleSummary("contributions", "Contributions", "$3.2k", "2 unverified", "contributions"),
                PlannerModuleSummary("vendors", "Vendors", "9 booked", "2 decisions", "vendors"),
                PlannerModuleSummary("guests", "Guests", "92", "12 awaiting RSVP", "guests"),
                PlannerModuleSummary("seating", "Seating", "84 / 92", "8 unseated", "seating"),
                PlannerModuleSummary("timeline", "Timeline", "24 events", "1 conflict", "timeline")
            ),
            recentActivity = listOf(
                PlannerActivityItem("act_1", "Planner task updated", "A venue readiness task moved forward.", "Today"),
                PlannerActivityItem("act_2", "Contribution allocated", "Funding attribution changed a budget item.", "Today"),
                PlannerActivityItem("act_3", "RSVP activity", "New guest responses changed the planning totals.", "Yesterday"),
                PlannerActivityItem("act_4", "Seating updated", "A household table assignment changed.", "Yesterday")
            ),
            sourceLabel = "Sanitized reference fixture — NOT production snapshot"
        )
    }
}
