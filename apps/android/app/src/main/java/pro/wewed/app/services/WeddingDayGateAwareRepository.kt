package pro.wewed.app.services

import pro.wewed.app.models.*

/** Preserves all existing native surfaces while routing Gate QR admission through Wedding Day. */
class WeddingDayGateAwareRepository(
    private val base: WeddingRepository,
    private val gate: WeddingDayGateOperations
) : WeddingRepository {
    override suspend fun availableWeddingIds(): List<String> = base.availableWeddingIds()
    override suspend fun getWedding(weddingId: String): Wedding = base.getWedding(weddingId)
    override suspend fun getTasks(weddingId: String): List<PlannerTask> = base.getTasks(weddingId)
    override suspend fun createTask(weddingId: String, title: String, priority: TaskPriority, category: String): PlannerTask =
        base.createTask(weddingId, title, priority, category)
    override suspend fun toggleTask(weddingId: String, taskId: String): PlannerTask = base.toggleTask(weddingId, taskId)
    override suspend fun getGuests(weddingId: String): List<Guest> = base.getGuests(weddingId)
    override suspend fun getBudget(weddingId: String): BudgetSummary = base.getBudget(weddingId)
    override suspend fun getWeddingPass(token: String): WeddingPass = base.getWeddingPass(token)
    override suspend fun searchGuests(weddingId: String, query: String): List<Guest> = base.searchGuests(weddingId, query)
    override suspend fun getAuditRecords(weddingId: String): List<CheckInAuditRecord> = base.getAuditRecords(weddingId)
    override suspend fun getVendors(weddingId: String): List<VendorPresence> = base.getVendors(weddingId)
    override suspend fun updateVendorState(weddingId: String, id: String, state: VendorPresenceState): VendorPresence =
        base.updateVendorState(weddingId, id, state)
    override suspend fun getAnnouncements(weddingId: String): List<WeddingAnnouncement> = base.getAnnouncements(weddingId)
    override suspend fun postAnnouncement(
        weddingId: String,
        title: String,
        message: String,
        urgency: AnnouncementUrgency
    ): WeddingAnnouncement = base.postAnnouncement(weddingId, title, message, urgency)
    override suspend fun resolveInvitation(weddingSlug: String, token: String): InvitationContext =
        base.resolveInvitation(weddingSlug, token)
    override suspend fun confirmRsvp(weddingSlug: String, token: String, attending: Boolean): WeddingPass =
        base.confirmRsvp(weddingSlug, token, attending)

    /** Gate admission stays routed through Wedding Day, but still inside the wedding scope. */
    override suspend fun checkInGuest(
        weddingId: String,
        qrPayload: String,
        count: Int,
        usherId: String
    ): CheckInVerificationResult {
        val available = base.availableWeddingIds()
        if (weddingId !in available) throw WeddingScopeMismatch(weddingId, available)
        return gate.checkIn(qrPayload, count, usherId)
    }
}
