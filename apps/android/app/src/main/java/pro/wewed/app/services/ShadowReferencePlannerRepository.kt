package pro.wewed.app.services

import pro.wewed.app.models.*

/**
 * Planner-side repository for the production-derived Charity & Kudzie / Eleven Eleven Testing
 * shadow reference scenario.
 */
class ShadowReferencePlannerRepository : PlannerDashboardRepository {
    private val budgetLines = listOf(
        PlannerBudgetLine("shadow_bitem_01", "attire", "TBD", 1800.0, 250.0, 250.0, null, "Couple funded", "Paid"),
        PlannerBudgetLine("shadow_bitem_02", "attire", null, 800.0, 170.0, 0.0, null, "Couple funded", "Unpaid"),
        PlannerBudgetLine("shadow_bitem_03", "attire", null, 2400.0, 0.0, 0.0, null, "Couple funded", "Unpaid"),
        PlannerBudgetLine("shadow_bitem_04", "attire", "American Swiss/Stands/Bella Margerate", 500.0, 300.0, 375.0, "2026-12-16 00:00:00", "Couple funded", "Paid"),
        PlannerBudgetLine("shadow_bitem_05", "attire", "Shein", 100.0, 100.0, 0.0, "2026-11-30 00:00:00", "Couple funded", "Unpaid"),
        PlannerBudgetLine("shadow_bitem_06", "attire", "Zimbabwe", 250.0, 240.0, 0.0, "2026-12-17 00:00:00", "Couple funded", "Unpaid"),
        PlannerBudgetLine("shadow_bitem_07", "attire", "Makeup Artist", 150.0, 150.0, 0.0, "2026-12-23 00:00:00", "Couple funded", "Unpaid"),
        PlannerBudgetLine("shadow_bitem_08", "catering", null, 6000.0, 1500.0, 0.0, null, "Couple funded", "Unpaid"),
        PlannerBudgetLine("shadow_bitem_09", "catering", null, 600.0, 350.0, 100.0, null, "Couple funded", "Deposit paid"),
        PlannerBudgetLine("shadow_bitem_10", "decor", null, 2500.0, 150.0, 50.0, null, "Couple funded", "Deposit paid"),
        PlannerBudgetLine("shadow_bitem_11", "decor", null, 1200.0, 0.0, 0.0, null, "Couple funded", "Unpaid"),
        PlannerBudgetLine("shadow_bitem_12", "decor", "Shein", 400.0, 150.0, 0.0, "2026-11-30 00:00:00", "Couple funded", "Unpaid"),
        PlannerBudgetLine("shadow_bitem_13", "miscellaneous", null, 1500.0, 200.0, 0.0, null, "Couple funded", "Unpaid"),
        PlannerBudgetLine("shadow_bitem_14", "miscellaneous", "Tony", 320.0, 320.0, 100.0, "2026-12-24 00:00:00", "Couple funded", "Deposit paid"),
        PlannerBudgetLine("shadow_bitem_15", "miscellaneous", null, 500.0, 500.0, 0.0, null, "Couple funded", "Unpaid"),
        PlannerBudgetLine("shadow_bitem_16", "music", null, 1500.0, 230.0, 100.0, null, "Couple funded", "Deposit paid"),
        PlannerBudgetLine("shadow_bitem_17", "photo_video", null, 3200.0, 500.0, 180.0, null, "Couple funded", "Deposit paid"),
        PlannerBudgetLine("shadow_bitem_18", "stationery", null, 700.0, 120.0, 120.0, null, "Couple funded", "Paid"),
        PlannerBudgetLine("shadow_bitem_19", "transport", null, 900.0, 500.0, 0.0, null, "Couple funded", "Unpaid"),
        PlannerBudgetLine("shadow_bitem_20", "venue", "Imba Manor", 4500.0, 2400.0, 2400.0, null, "Couple funded", "Paid"),
        PlannerBudgetLine("shadow_bitem_21", "venue", null, 460.0, 460.0, 200.0, null, "Couple funded", "Deposit paid"),
        PlannerBudgetLine("shadow_bitem_22", "venue", "munokokwa  events", 100.0, 100.0, 0.0, null, "Couple funded", "Unpaid"),
    )

    private val contributions = listOf(
        PlannerContributionRecord("shadow_contrib_01", "Guest Contributor", "Blessing", 0.0, "Approved", "Guest Messages", true),
        PlannerContributionRecord("shadow_contrib_02", "Guest Contributor", "Wish", 0.0, "Featured", "Guest Messages", true),
        PlannerContributionRecord("shadow_contrib_03", "Guest Contributor", "Funny Story", 0.0, "Approved", "Guest Messages", true),
        PlannerContributionRecord("shadow_contrib_04", "Guest Contributor", "Memory", 0.0, "Approved", "Guest Messages", true),
    )

    private val vendorEngagements = listOf(
        PlannerVendorEngagement("shadow_vnd_01", "Cake Gourmet", "caterer", "Confirmed", "Pending", "Deposit", "Operational review"),
        PlannerVendorEngagement("shadow_vnd_02", "MC Aloe The Avangelist", "dj", "Confirmed", "Pending", "Unpaid", "Operational review"),
        PlannerVendorEngagement("shadow_vnd_03", "The Glass Petal Atelier", "florist", "Confirmed", "Pending", "Deposit", "Operational review"),
        PlannerVendorEngagement("shadow_vnd_04", "Makeup Artist", "other", "Confirmed", "Pending", "Unpaid", "Operational review"),
        PlannerVendorEngagement("shadow_vnd_05", "TBD", "other", "Confirmed", "Pending", "Unpaid", "Operational review"),
        PlannerVendorEngagement("shadow_vnd_06", "FAUME MEDIA", "photographer", "Confirmed", "Pending", "Unpaid", "Operational review"),
        PlannerVendorEngagement("shadow_vnd_07", "Imba Manor", "venue", "Confirmed", "Pending", "Paid", "Operational review"),
    )

    private val seatingTables = listOf(
        PlannerSeatingTable("shadow_tbl_01", "Table 1 — Family", "Family", 8, 7, "1 seats free"),
        PlannerSeatingTable("shadow_tbl_02", "Table 2 — Family", "Family", 8, 4, "4 seats free"),
        PlannerSeatingTable("shadow_tbl_03", "Table 3 — Bridal Party", "Bridal Party", 8, 5, "3 seats free"),
        PlannerSeatingTable("shadow_tbl_04", "Table 4 — Bridal Party", "Bridal Party", 8, 0, "8 seats free"),
        PlannerSeatingTable("shadow_tbl_05", "Table 5 — Friends", "Friends", 8, 2, "6 seats free"),
        PlannerSeatingTable("shadow_tbl_06", "Table 6 — Friends", "Friends", 8, 1, "7 seats free"),
        PlannerSeatingTable("shadow_tbl_07", "Table 7 — Colleagues", "Colleagues", 8, 2, "6 seats free"),
        PlannerSeatingTable("shadow_tbl_08", "Table 8 — VIPs", "VIP", 8, 1, "7 seats free"),
    )

    private val timelineEntries = listOf(
        PlannerTimelineEntry("shadow_prog_01", "14:00", "Ceremony Begins", "Imba Manor", "Scheduled", null),
        PlannerTimelineEntry("shadow_prog_02", "13:00", "Guest Arrival", "Imba Manor", "Scheduled", null),
        PlannerTimelineEntry("shadow_prog_03", "14:45", "Confetti & Congratulations", "Imba Manor", "Scheduled", null),
        PlannerTimelineEntry("shadow_prog_04", "15:30", "Cocktail Hour", "Imba Manor", "Scheduled", null),
        PlannerTimelineEntry("shadow_prog_05", "16:30", "Reception Entrance", "Imba Manor", "Scheduled", null),
        PlannerTimelineEntry("shadow_prog_06", "17:00", "First Dance", "Imba Manor", "Scheduled", null),
        PlannerTimelineEntry("shadow_prog_07", "17:30", "Dinner is Served", "Imba Manor", "Scheduled", null),
        PlannerTimelineEntry("shadow_prog_08", "18:30", "Speeches & Toasts", "Imba Manor", "Scheduled", null),
        PlannerTimelineEntry("shadow_prog_09", "19:30", "Cake Cutting", "Imba Manor", "Scheduled", null),
        PlannerTimelineEntry("shadow_prog_10", "11:45", "UAT-TIMELINE-001 Vendor access and setup", "Imba Manor service entrance", "Scheduled", null),
        PlannerTimelineEntry("shadow_prog_11", "20:00", "Dance Floor Opens", "Imba Manor", "Scheduled", null),
        PlannerTimelineEntry("shadow_prog_12", "22:00", "Last Dance", "Imba Manor", "Scheduled", null),
        PlannerTimelineEntry("shadow_prog_13", "22:30", "Sparkler Send-Off", "Imba Manor", "Scheduled", null),
    )

    override suspend fun getDashboard(): PlannerDashboardSnapshot {
        return PlannerDashboardSnapshot(
            weddingId = "shadow_ref_charity_kudzie",
            coupleNames = "Charity & Kudzie",
            weddingDateLabel = "2026-12-23 14:00:00",
            lifecycle = "before",
            plannerContext = "Eleven Eleven Testing",
            readinessScore = null,
            taskCompletionLabel = "7 / 42",
            attentionItems = listOf(
                PlannerAttentionItem("attn_tasks", "8 high priority tasks", "Venue, invitations and logistics need attention.", PlannerAttentionSeverity.URGENT),
                PlannerAttentionItem("attn_rsvp", "172 RSVPs pending", "Guest follow-up is affecting seating readiness.", PlannerAttentionSeverity.WARNING),
                PlannerAttentionItem("attn_seating", "152 guests unseated", "Complete table allocations for invited party capacity.", PlannerAttentionSeverity.WARNING),
                PlannerAttentionItem("attn_vendor", "7 vendors booked", "Operational contracts and logistics reviews in progress.", PlannerAttentionSeverity.INFO),
                PlannerAttentionItem("attn_payment", "Payments in progress", "$3,875 paid out of $8,690 actual expenses.", PlannerAttentionSeverity.INFO)
            ),
            modules = listOf(
                PlannerModuleSummary("tasks", "Tasks", "7 / 42", "8 urgent", "tasks"),
                PlannerModuleSummary("budget", "Budget", "$30.4k", "$3.9k paid", "budget"),
                PlannerModuleSummary("contributions", "Contributions", "4 memories", "4 approved", "contributions"),
                PlannerModuleSummary("vendors", "Vendors", "7 booked", "0 contracts", "vendors"),
                PlannerModuleSummary("guests", "Guests", "174", "172 awaiting RSVP", "guests"),
                PlannerModuleSummary("seating", "Seating", "22 / 64", "42 seats free", "seating"),
                PlannerModuleSummary("timeline", "Timeline", "13 events", "Programme locked", "timeline")
            ),
            recentActivity = emptyList(),
            sourceLabel = "Production-derived reference fixture"
        )
    }

    override suspend fun getBudgetLines(): List<PlannerBudgetLine> = budgetLines
    override suspend fun getContributions(): List<PlannerContributionRecord> = contributions
    override suspend fun getVendorEngagements(): List<PlannerVendorEngagement> = vendorEngagements
    override suspend fun getSeatingTables(): List<PlannerSeatingTable> = seatingTables
    override suspend fun getTimelineEntries(): List<PlannerTimelineEntry> = timelineEntries
}
