package pro.wewed.app.services

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import pro.wewed.app.models.*

/** Admin support reads are recorded before any data is returned. */
class AdminAuditLog {
    private val mutex = Mutex()
    private val entries = mutableListOf<AdminAuditEntry>()

    suspend fun record(section: String, weddingId: String, nowMillis: Long = System.currentTimeMillis()) = mutex.withLock {
        entries.add(0, AdminAuditEntry(section, weddingId, nowMillis))
    }

    suspend fun all(): List<AdminAuditEntry> = mutex.withLock { entries.toList() }
}

/**
 * The only data gateway a role shell receives. Each call checks the grant's capabilities and scope,
 * so a guest, vendor or usher shell cannot read the roster, budget or financials even if a screen tried.
 */
class RoleScopedAccess(
    val grant: RoleGrant,
    private val wedding: WeddingRepository,
    private val planner: PlannerDashboardRepository,
    private val audit: AdminAuditLog = AdminAuditLog()
) {
    val role: AppRole get() = grant.role

    fun can(capability: Capability): Boolean = CapabilityPolicy.allows(grant.role, capability)

    private fun require(capability: Capability) {
        if (!can(capability)) throw AccessDeniedException(grant.role, capability)
    }

    // Public wedding information

    suspend fun weddingSummary(): Wedding {
        require(Capability.VIEW_WEDDING_SUMMARY)
        return wedding.getWedding()
    }

    suspend fun programme(): List<PlannerTimelineEntry> {
        require(Capability.VIEW_PROGRAMME)
        return planner.getTimelineEntries()
    }

    suspend fun announcements(): List<WeddingAnnouncement> {
        require(Capability.VIEW_WEDDING_SUMMARY)
        return wedding.getAnnouncements()
    }

    // Wedding management (Couple / Planner)

    suspend fun dashboard(): PlannerDashboardSnapshot {
        require(Capability.VIEW_PLANNING_DASHBOARD)
        return planner.getDashboard()
    }

    suspend fun tasks(): List<PlannerTask> {
        require(Capability.VIEW_TASKS)
        return wedding.getTasks()
    }

    suspend fun createTask(title: String, priority: TaskPriority, category: String): PlannerTask {
        require(Capability.MANAGE_TASKS)
        return wedding.createTask(title, priority, category)
    }

    suspend fun toggleTask(taskId: String): PlannerTask {
        require(Capability.MANAGE_TASKS)
        return wedding.toggleTask(taskId)
    }

    suspend fun guestRoster(): List<Guest> {
        require(Capability.VIEW_GUEST_ROSTER)
        return wedding.getGuests()
    }

    suspend fun searchGuests(query: String): List<Guest> {
        require(Capability.VIEW_GUEST_ROSTER)
        return wedding.searchGuests(query)
    }

    suspend fun budget(): BudgetSummary {
        require(Capability.VIEW_BUDGET)
        return wedding.getBudget()
    }

    suspend fun budgetLines(): List<PlannerBudgetLine> {
        require(Capability.VIEW_BUDGET)
        return planner.getBudgetLines()
    }

    suspend fun contributions(): List<PlannerContributionRecord> {
        require(Capability.VIEW_CONTRIBUTIONS)
        val showIdentity = can(Capability.VIEW_CONTRIBUTOR_IDENTITY)
        return planner.getContributions().map { record -> redactContributor(record, showIdentity) }
    }

    suspend fun vendorEngagements(): List<PlannerVendorEngagement> {
        val all = planner.getVendorEngagements()
        return when {
            can(Capability.VIEW_ALL_VENDOR_ENGAGEMENTS) -> all
            can(Capability.VIEW_OWN_VENDOR_ENGAGEMENT) -> {
                val vendorId = grant.vendorId ?: return emptyList()
                all.filter { it.vendorId == vendorId }
            }
            else -> throw AccessDeniedException(grant.role, Capability.VIEW_OWN_VENDOR_ENGAGEMENT)
        }
    }

    suspend fun vendorPresence(): List<VendorPresence> {
        val all = wedding.getVendors()
        return when {
            can(Capability.VIEW_VENDOR_PRESENCE) -> all
            can(Capability.UPDATE_OWN_VENDOR_PRESENCE) -> {
                val vendorId = grant.vendorId ?: return emptyList()
                all.filter { it.id == vendorId }
            }
            else -> throw AccessDeniedException(grant.role, Capability.VIEW_VENDOR_PRESENCE)
        }
    }

    suspend fun updateOwnVendorPresence(state: VendorPresenceState): VendorPresence {
        require(Capability.UPDATE_OWN_VENDOR_PRESENCE)
        val vendorId = grant.vendorId ?: throw AccessDeniedException(grant.role, Capability.UPDATE_OWN_VENDOR_PRESENCE)
        return wedding.updateVendorState(vendorId, state)
    }

    suspend fun seating(): List<PlannerSeatingTable> {
        require(Capability.VIEW_SEATING)
        return planner.getSeatingTables()
    }

    suspend fun documents(): List<PlannerDocumentRecord> {
        require(Capability.VIEW_DOCUMENTS)
        return planner.getDocuments()
    }

    suspend fun updateWeddingDetails(update: WeddingDetailsUpdate): Wedding {
        require(Capability.EDIT_WEDDING_DETAILS)
        return wedding.updateWeddingDetails(update)
    }

    suspend fun previewGuestPass(token: String): WeddingPass {
        require(Capability.PREVIEW_GUEST_PASSES)
        return wedding.getWeddingPass(token)
    }

    suspend fun postAnnouncement(title: String, message: String, urgency: AnnouncementUrgency): WeddingAnnouncement {
        require(Capability.POST_ANNOUNCEMENT)
        return wedding.postAnnouncement(title, message, urgency)
    }

    // Guest: own invitation, RSVP and pass only

    private fun ownGuestToken(capability: Capability): String {
        require(capability)
        return grant.guestId ?: throw AccessDeniedException(grant.role, capability)
    }

    suspend fun ownInvitation(): InvitationContext {
        val token = ownGuestToken(Capability.VIEW_OWN_INVITATION)
        return wedding.resolveInvitation(grant.weddingId, token)
    }

    suspend fun respondToOwnInvitation(attending: Boolean): WeddingPass {
        val token = ownGuestToken(Capability.RESPOND_OWN_RSVP)
        return wedding.confirmRsvp(grant.weddingId, token, attending)
    }

    /** Null until the guest has accepted; a declined or pending guest has no admission pass. */
    suspend fun ownPass(): WeddingPass? {
        val token = ownGuestToken(Capability.VIEW_OWN_PASS)
        val invitation = wedding.resolveInvitation(grant.weddingId, token)
        if (!invitation.isConfirmed) return null
        return wedding.getWeddingPass(token)
    }

    // Gate operations (Usher / Coordinator / Couple / Planner)

    suspend fun admit(qrPayload: String, count: Int, operatorId: String): CheckInVerificationResult {
        require(Capability.SCAN_ADMISSION)
        return wedding.checkInGuest(qrPayload, count, operatorId)
    }

    suspend fun admissionLookup(query: String): List<AdmissionLookupRow> {
        require(Capability.LOOKUP_ADMISSION)
        val normalized = query.trim().lowercase()
        if (normalized.length < 2) return emptyList()
        return wedding.getGuests()
            .filter { it.rsvpStatus == RSVPStatus.ATTENDING && it.name.lowercase().contains(normalized) }
            .map { AdmissionLookupRow(it.id, it.name, it.partySize, it.checkedInCount, it.tableName) }
    }

    suspend fun admissionSummary(): AdmissionSummary {
        require(Capability.VIEW_ADMISSION_SUMMARY)
        val attending = wedding.getGuests().filter { it.rsvpStatus == RSVPStatus.ATTENDING }
        return AdmissionSummary(
            attendingParties = attending.size,
            expectedGuests = attending.sumOf { it.partySize },
            admittedGuests = attending.sumOf { it.checkedInCount }
        )
    }

    suspend fun admissionHistory(): List<CheckInAuditRecord> {
        require(Capability.SCAN_ADMISSION)
        return wedding.getAuditRecords()
    }

    // Admin: explicit, audited support reads

    suspend fun <T> supportRead(
        section: String,
        block: suspend (WeddingRepository, PlannerDashboardRepository) -> T
    ): T {
        require(Capability.ADMIN_SUPPORT)
        audit.record(section, grant.weddingId)
        return block(wedding, planner)
    }

    suspend fun auditEntries(): List<AdminAuditEntry> {
        require(Capability.ADMIN_SUPPORT)
        return audit.all()
    }

    companion object {
        fun redactContributor(record: PlannerContributionRecord, roleMayIdentify: Boolean): PlannerContributionRecord {
            if (record.contributorResolution == ContributorResolution.NOT_RECORDED) return record
            val anonymous = record.privacyLabel.equals("Anonymous", ignoreCase = true)
            return if (roleMayIdentify && !anonymous) record else record.copy(
                contributorLabel = if (anonymous) "Anonymous" else "Contributor hidden",
                contributorGuestId = null,
                contributorResolution = ContributorResolution.HIDDEN
            )
        }
    }
}
