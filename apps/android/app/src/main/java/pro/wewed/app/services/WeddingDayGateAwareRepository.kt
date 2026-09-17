package pro.wewed.app.services

import pro.wewed.app.models.*

/** Preserves all existing native surfaces while routing Gate QR admission through Wedding Day. */
class WeddingDayGateAwareRepository(
    private val base: WeddingRepository,
    private val gate: WeddingDayGateOperations
) : WeddingRepository {
    override suspend fun getWedding(): Wedding = base.getWedding()
    override suspend fun getTasks(): List<PlannerTask> = base.getTasks()
    override suspend fun createTask(title: String, priority: TaskPriority, category: String): PlannerTask =
        base.createTask(title, priority, category)
    override suspend fun toggleTask(taskId: String): PlannerTask = base.toggleTask(taskId)
    override suspend fun getGuests(): List<Guest> = base.getGuests()
    override suspend fun getBudget(): BudgetSummary = base.getBudget()
    override suspend fun getWeddingPass(token: String): WeddingPass = base.getWeddingPass(token)
    override suspend fun searchGuests(query: String): List<Guest> = base.searchGuests(query)
    override suspend fun getAuditRecords(): List<CheckInAuditRecord> = base.getAuditRecords()
    override suspend fun getVendors(): List<VendorPresence> = base.getVendors()
    override suspend fun updateVendorState(id: String, state: VendorPresenceState): VendorPresence =
        base.updateVendorState(id, state)
    override suspend fun getAnnouncements(): List<WeddingAnnouncement> = base.getAnnouncements()
    override suspend fun postAnnouncement(
        title: String,
        message: String,
        urgency: AnnouncementUrgency
    ): WeddingAnnouncement = base.postAnnouncement(title, message, urgency)
    override suspend fun resolveInvitation(weddingSlug: String, token: String): InvitationContext =
        base.resolveInvitation(weddingSlug, token)
    override suspend fun confirmRsvp(weddingSlug: String, token: String, attending: Boolean): WeddingPass =
        base.confirmRsvp(weddingSlug, token, attending)

    override suspend fun checkInGuest(
        qrPayload: String,
        count: Int,
        usherId: String
    ): CheckInVerificationResult = gate.checkIn(qrPayload, count, usherId)
}
