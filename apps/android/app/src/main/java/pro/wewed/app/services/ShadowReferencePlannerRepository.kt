package pro.wewed.app.services

import pro.wewed.app.models.*

/**
 * Planner-side repository for the sanitized Charity & Kudzie / Eleven Eleven Testing
 * shadow reference scenario.
 *
 * Kept distinct from FixturePlannerDashboardRepository so a SHADOW runtime has an
 * explicit semantic boundary even before the real Shadow backend is connected.
 */
class ShadowReferencePlannerRepository(
    private val base: PlannerDashboardRepository = FixturePlannerDashboardRepository()
) : PlannerDashboardRepository {
    override suspend fun getDashboard(): PlannerDashboardSnapshot = base.getDashboard()
    override suspend fun getBudgetLines(): List<PlannerBudgetLine> = base.getBudgetLines()
    override suspend fun getContributions(): List<PlannerContributionRecord> = base.getContributions()
    override suspend fun getVendorEngagements(): List<PlannerVendorEngagement> = base.getVendorEngagements()
    override suspend fun getSeatingTables(): List<PlannerSeatingTable> = base.getSeatingTables()
    override suspend fun getTimelineEntries(): List<PlannerTimelineEntry> = base.getTimelineEntries()
}
