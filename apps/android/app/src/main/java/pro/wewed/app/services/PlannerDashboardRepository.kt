package pro.wewed.app.services

import pro.wewed.app.models.*

interface PlannerDashboardRepository {
    suspend fun getDashboard(): PlannerDashboardSnapshot
    suspend fun getBudgetLines(): List<PlannerBudgetLine>
    suspend fun getContributions(): List<PlannerContributionRecord>
    suspend fun getVendorEngagements(): List<PlannerVendorEngagement>
    suspend fun getSeatingTables(): List<PlannerSeatingTable>
    suspend fun getTimelineEntries(): List<PlannerTimelineEntry>
    suspend fun getDocuments(): List<PlannerDocumentRecord>
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

    override suspend fun getBudgetLines(): List<PlannerBudgetLine> = listOf(
        PlannerBudgetLine("budget_venue", "Venue & Catering", "Shadow Venue Partner", 12000.0, 11800.0, 8000.0, "Balance due before event", "Couple + contributor funding", "Partially paid"),
        PlannerBudgetLine("budget_photo", "Photography & Video", "Shadow Visuals", 3500.0, 3500.0, 3500.0, null, "Couple funded", "Paid"),
        PlannerBudgetLine("budget_decor", "Decor & Florals", "Shadow Events", 3000.0, 3200.0, 1500.0, "Final balance pending", "Contributor + couple", "Deposit paid"),
        PlannerBudgetLine("budget_sound", "Music & Sound", "Shadow Sound", 1500.0, 1650.0, 500.0, "Payment milestone open", "Couple funded", "Balance pending")
    )

    override suspend fun getContributions(): List<PlannerContributionRecord> = listOf(
        PlannerContributionRecord("contrib_1", "Contributor A", "Cash contribution", 1200.0, "Received", "Venue & Catering", true),
        PlannerContributionRecord("contrib_2", "Contributor B", "Direct vendor payment", 900.0, "Verified", "Decor & Florals", true),
        PlannerContributionRecord("contrib_3", "Contributor C", "In-kind service", 650.0, "Pending verification", "Transport", false),
        PlannerContributionRecord("contrib_4", "Contributor D", "Pledge", 450.0, "Pledged", "Unallocated", false)
    )

    override suspend fun getVendorEngagements(): List<PlannerVendorEngagement> = listOf(
        PlannerVendorEngagement(id = "vendor_1", vendorId = "vendor_1", vendorName = "Shadow Venue Partner", category = "Venue & Catering", bookingStatus = "Booked", contractStatus = "Signed", paymentStatus = "Balance due", nextAction = "Confirm final headcount"),
        PlannerVendorEngagement(id = "vendor_2", vendorId = "vendor_2", vendorName = "Shadow Visuals", category = "Photography & Video", bookingStatus = "Booked", contractStatus = "Signed", paymentStatus = "Paid", nextAction = "Confirm shot list"),
        PlannerVendorEngagement(id = "vendor_3", vendorId = "vendor_3", vendorName = "Shadow Events", category = "Decor & Florals", bookingStatus = "Booked", contractStatus = "Needs review", paymentStatus = "Deposit paid", nextAction = "Approve floral substitutions"),
        PlannerVendorEngagement(id = "vendor_4", vendorId = "vendor_4", vendorName = "Shadow Sound", category = "Music & Sound", bookingStatus = "Booked", contractStatus = "Signed", paymentStatus = "Balance pending", nextAction = "Lock reception playlist")
    )

    override suspend fun getSeatingTables(): List<PlannerSeatingTable> = listOf(
        PlannerSeatingTable("table_1", "Baobab", "Family", 10, 10, null),
        PlannerSeatingTable("table_2", "Jacaranda", "Friends", 10, 8, "2 seats free"),
        PlannerSeatingTable("table_3", "Acacia", "Family", 10, 9, "1 seat free"),
        PlannerSeatingTable("table_4", "Flame Lily", "VIP", 8, 7, "1 assignment pending")
    )

    override suspend fun getTimelineEntries(): List<PlannerTimelineEntry> = listOf(
        PlannerTimelineEntry("time_1", "10:00", "Venue setup verification", "Main venue", "Planning", "Shadow Venue Partner"),
        PlannerTimelineEntry("time_2", "12:30", "Photography arrival & detail shots", "Preparation suite", "Confirmed", "Shadow Visuals"),
        PlannerTimelineEntry("time_3", "13:15", "Guest arrival", "Main gate", "Upcoming", null),
        PlannerTimelineEntry("time_4", "14:00", "Ceremony", "Ceremony area", "Upcoming", null),
        PlannerTimelineEntry("time_5", "17:30", "Reception", "Reception space", "Upcoming", "Shadow Sound")
    )

    override suspend fun getDocuments(): List<PlannerDocumentRecord> = emptyList()
}
