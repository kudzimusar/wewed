package pro.wewed.app.services

import pro.wewed.app.models.*

/**
 * Production boundary repository for Phase 5.
 *
 * Production workspace data is loaded through the grant-revalidated native account workspace API,
 * not through the legacy mutable repository protocols. Keeping this repository deliberately empty
 * prevents any old screen from silently falling back to fixture/Shadow data or enabling writes.
 */
class ProductionReadOnlyDomainUnavailable :
    IllegalStateException("This production domain is not enabled until the read-only adapter explicitly serves it.")

class ProductionBoundaryWeddingRepository : WeddingRepository {
    private fun denied(): Nothing = throw ProductionReadOnlyDomainUnavailable()

    override suspend fun availableWeddingIds(): List<String> = emptyList()
    override suspend fun resolveGuestIdentity(token: String): GuestIdentity? = denied()
    override suspend fun getWedding(weddingId: String): Wedding = denied()
    override suspend fun getTasks(weddingId: String): List<PlannerTask> = denied()
    override suspend fun createTask(weddingId: String, title: String, priority: TaskPriority, category: String): PlannerTask = denied()
    override suspend fun toggleTask(weddingId: String, taskId: String): PlannerTask = denied()
    override suspend fun getGuests(weddingId: String): List<Guest> = denied()
    override suspend fun getBudget(weddingId: String): BudgetSummary = denied()
    override suspend fun searchGuests(weddingId: String, query: String): List<Guest> = denied()
    override suspend fun checkInGuest(weddingId: String, qrPayload: String, count: Int, usherId: String): CheckInVerificationResult = denied()
    override suspend fun getAuditRecords(weddingId: String): List<CheckInAuditRecord> = denied()
    override suspend fun getVendors(weddingId: String): List<VendorPresence> = denied()
    override suspend fun updateVendorState(weddingId: String, id: String, state: VendorPresenceState): VendorPresence = denied()
    override suspend fun getAnnouncements(weddingId: String): List<WeddingAnnouncement> = denied()
    override suspend fun postAnnouncement(weddingId: String, title: String, message: String, urgency: AnnouncementUrgency): WeddingAnnouncement = denied()
    override suspend fun getWeddingPass(token: String): WeddingPass = denied()
    override suspend fun resolveInvitation(weddingSlug: String, token: String): InvitationContext = denied()
    override suspend fun confirmRsvp(weddingSlug: String, token: String, attending: Boolean): WeddingPass = denied()
}

class ProductionBoundaryPlannerRepository : PlannerDashboardRepository {
    private fun denied(): Nothing = throw ProductionReadOnlyDomainUnavailable()
    override suspend fun getDashboard(): PlannerDashboardSnapshot = denied()
    override suspend fun getBudgetLines(): List<PlannerBudgetLine> = denied()
    override suspend fun getContributions(): List<PlannerContributionRecord> = denied()
    override suspend fun getVendorEngagements(): List<PlannerVendorEngagement> = denied()
    override suspend fun getSeatingTables(): List<PlannerSeatingTable> = denied()
    override suspend fun getTimelineEntries(): List<PlannerTimelineEntry> = denied()
    override suspend fun getDocuments(): List<PlannerDocumentRecord> = denied()
}
