package pro.wewed.app.services

import pro.wewed.app.models.*

/**
 * Preserves all existing native surfaces while routing Gate QR admission through Wedding Day.
 * When [server] is provided, server-backed API routes are preferred for announcements and vendor
 * state transitions; all other operations delegate to [base].
 * [searchGuests] and [getAuditRecords] always delegate to [base] (offline-first device manifest)
 * for field reliability on low-connectivity networks.
 */
class WeddingDayGateAwareRepository(
    private val base: WeddingRepository,
    private val gate: WeddingDayGateOperations,
    /** Optional server-backed API client injected by AppComposition in isolated/production modes. */
    private val server: ServerBackedWeddingDayOperations? = null
) : WeddingRepository {
    override suspend fun getWedding(): Wedding = base.getWedding()
    override suspend fun getTasks(): List<PlannerTask> = base.getTasks()
    override suspend fun createTask(title: String, priority: TaskPriority, category: String): PlannerTask =
        base.createTask(title, priority, category)
    override suspend fun toggleTask(taskId: String): PlannerTask = base.toggleTask(taskId)
    override suspend fun getGuests(): List<Guest> = base.getGuests()
    override suspend fun getBudget(): BudgetSummary = base.getBudget()
    override suspend fun getWeddingPass(token: String): WeddingPass = base.getWeddingPass(token)
    /** Intentionally delegated to base (offline-first device manifest) for low-connectivity reliability. */
    override suspend fun searchGuests(query: String): List<Guest> = base.searchGuests(query)
    /** Intentionally delegated to base (device audit journal) for offline-first field reliability. */
    override suspend fun getAuditRecords(): List<CheckInAuditRecord> = base.getAuditRecords()
    override suspend fun getVendors(): List<VendorPresence> = base.getVendors()
    override suspend fun updateVendorState(id: String, state: VendorPresenceState): VendorPresence {
        server?.updateVendorState(id, state)?.let { return it }
        return base.updateVendorState(id, state)
    }
    override suspend fun getAnnouncements(): List<WeddingAnnouncement> {
        server?.getAnnouncements()?.takeIf { it.isNotEmpty() }?.let { return it }
        return base.getAnnouncements()
    }
    override suspend fun postAnnouncement(
        title: String,
        message: String,
        urgency: AnnouncementUrgency
    ): WeddingAnnouncement {
        server?.postAnnouncement(title, message, urgency)?.let { return it }
        return base.postAnnouncement(title, message, urgency)
    }
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

