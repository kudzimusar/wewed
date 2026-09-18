package pro.wewed.app.services

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import pro.wewed.app.models.*
import java.util.UUID

/**
 * Sanitized, internally coherent reference implementation for the
 * Charity & Kudzie / Eleven Eleven Testing shadow scenario.
 *
 * This is not a production snapshot. Gate credentials are development-only
 * placeholders and do not replace canonical WW2 ECDSA verification.
 */
class ShadowReferenceWeddingRepository : WeddingRepository {
    private val mutex = Mutex()
    private val primaryPassSerial = "SHDWGSTA01"
    private val attendingToken = "shadow-attending-guest"
    private val pendingToken = "shadow-pending-guest"
    private val declinedToken = "shadow-declined-guest"

    private val wedding = Wedding(
        id = "shadow_ref_charity_kudzie",
        coupleNames = "Charity & Kudzie",
        date = "pending-production-discovery",
        venueName = "Reference Venue",
        venueAddress = "Sanitized venue address",
        city = "Reference City",
        country = "Zimbabwe",
        lifecycle = "before",
        programme = listOf(
            ProgrammeItem("shadow_p1", "Guest Arrival", "13:15", "Main Gate", "Guest welcome and gate admission"),
            ProgrammeItem("shadow_p2", "Ceremony", "14:00", "Ceremony Area", "Ceremony programme"),
            ProgrammeItem("shadow_p3", "Photography & Cocktails", "15:30", "Garden", "Portraits and guest refreshments"),
            ProgrammeItem("shadow_p4", "Reception", "17:30", "Reception Space", "Dinner and celebration")
        )
    )

    private val tasks = mutableListOf(
        PlannerTask("shadow_task_1", "Resolve overdue venue readiness items", TaskStatus.BLOCKED, TaskPriority.URGENT, "Venue & Logistics", null),
        PlannerTask("shadow_task_2", "Follow up pending guest responses", TaskStatus.IN_PROGRESS, TaskPriority.HIGH, "Guests & RSVP", null),
        PlannerTask("shadow_task_3", "Complete remaining seating assignments", TaskStatus.IN_PROGRESS, TaskPriority.HIGH, "Seating", null),
        PlannerTask("shadow_task_4", "Review vendor contract decision", TaskStatus.TODO, TaskPriority.HIGH, "Vendors", null),
        PlannerTask("shadow_task_5", "Confirm final reception timeline", TaskStatus.TODO, TaskPriority.MEDIUM, "Timeline", null),
        PlannerTask("shadow_task_6", "Invitation artwork and guest journey review", TaskStatus.DONE, TaskPriority.HIGH, "Invitations", null)
    )

    private val guests = mutableListOf(
        Guest("shadow_guest_a", "Guest Household A", "Household A", 2, "Couple", RSVPStatus.ATTENDING, 2, "Jacaranda", false, 0, primaryPassSerial),
        Guest("shadow_guest_b", "Guest Household B", "Household B", 4, "Couple", RSVPStatus.ATTENDING, 1, "Baobab", false, 0, "SHDWGSTB04"),
        Guest("shadow_guest_c", "Guest C", null, 1, "Couple", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_d", "Guest Household D", "Household D", 3, "Couple", RSVPStatus.DECLINED, null, null, false, 0, null)
    )

    private val budget = BudgetSummary(
        currency = "USD",
        totalBudget = 20000.0,
        totalAllocated = 19300.0,
        totalPaid = 13500.0,
        categories = listOf(
            BudgetCategory("Venue & Catering", 11800.0, 8000.0),
            BudgetCategory("Photography & Video", 3500.0, 3500.0),
            BudgetCategory("Decor & Florals", 3200.0, 1500.0),
            BudgetCategory("Music & Sound", 800.0, 500.0)
        )
    )

    private val vendors = mutableListOf(
        VendorPresence("shadow_vendor_venue", "Shadow Venue Partner", "Venue & Catering", "Main Venue", VendorPresenceState.SCHEDULED, "10:00"),
        VendorPresence("shadow_vendor_visuals", "Shadow Visuals", "Photography & Video", "Preparation & Ceremony", VendorPresenceState.SCHEDULED, "12:30"),
        VendorPresence("shadow_vendor_decor", "Shadow Events", "Decor & Florals", "Ceremony & Reception", VendorPresenceState.SCHEDULED, "09:30"),
        VendorPresence("shadow_vendor_sound", "Shadow Sound", "Music & Sound", "Reception", VendorPresenceState.SCHEDULED, "11:00")
    )

    private val announcements = mutableListOf(
        WeddingAnnouncement("shadow_ann_1", "Planning Environment", "This is a sanitized Shadow reference wedding. No production guests or vendors are being contacted.", AnnouncementUrgency.INFO),
        WeddingAnnouncement("shadow_ann_2", "Invitation Flow Ready", "The Ivory Floral Gold invitation can be exercised before Wedding Pass access.", AnnouncementUrgency.INFO)
    )

    private val auditRecords = mutableListOf<CheckInAuditRecord>()

    override suspend fun getWedding(): Wedding = mutex.withLock { wedding }
    override suspend fun getTasks(): List<PlannerTask> = mutex.withLock { tasks.toList() }
    override suspend fun getGuests(): List<Guest> = mutex.withLock { guests.toList() }
    override suspend fun getBudget(): BudgetSummary = mutex.withLock { budget }
    override suspend fun getAuditRecords(): List<CheckInAuditRecord> = mutex.withLock { auditRecords.toList() }
    override suspend fun getVendors(): List<VendorPresence> = mutex.withLock { vendors.toList() }
    override suspend fun getAnnouncements(): List<WeddingAnnouncement> = mutex.withLock { announcements.toList() }

    override suspend fun createTask(title: String, priority: TaskPriority, category: String): PlannerTask = mutex.withLock {
        val task = PlannerTask(
            id = "shadow_task_${UUID.randomUUID().toString().take(8)}",
            title = title,
            status = TaskStatus.TODO,
            priority = priority,
            category = category
        )
        tasks.add(task)
        task
    }

    override suspend fun toggleTask(taskId: String): PlannerTask = mutex.withLock {
        val index = tasks.indexOfFirst { it.id == taskId }
        require(index >= 0) { "Task not found" }
        val current = tasks[index]
        val updated = current.copy(status = if (current.status == TaskStatus.DONE) TaskStatus.TODO else TaskStatus.DONE)
        tasks[index] = updated
        updated
    }

    override suspend fun getWeddingPass(token: String): WeddingPass = mutex.withLock {
        val guest = guestForToken(token)
        require(guest.rsvpStatus == RSVPStatus.ATTENDING) {
            "Wedding Pass is available only to attending guests in Shadow."
        }
        makePass(guest)
    }

    override suspend fun searchGuests(query: String): List<Guest> = mutex.withLock {
        val normalized = query.trim().lowercase()
        if (normalized.isEmpty()) return@withLock guests.toList()
        guests.filter {
            it.name.lowercase().contains(normalized) ||
                (it.householdName?.lowercase()?.contains(normalized) == true) ||
                (it.tableName?.lowercase()?.contains(normalized) == true)
        }
    }

    override suspend fun checkInGuest(qrPayload: String, count: Int, usherId: String): CheckInVerificationResult = mutex.withLock {
        val index = guests.indexOfFirst { guest -> guest.passSerial?.let { qrPayload.contains(it) } == true }

        if (index < 0) {
            return@withLock CheckInVerificationResult(
                status = CheckInStatus.INVALID_PASS,
                guestName = "Unknown Guest",
                partySize = 0,
                alreadyCheckedInCount = 0,
                remainingCount = 0,
                gateMessage = "Shadow reference pass does not match an attending guest."
            )
        }

        val current = guests[index]
        val remaining = (current.partySize - current.checkedInCount).coerceAtLeast(0)

        if (remaining == 0) {
            return@withLock CheckInVerificationResult(
                status = CheckInStatus.ALREADY_CHECKED_IN,
                guestName = current.name,
                householdName = current.householdName,
                partySize = current.partySize,
                alreadyCheckedInCount = current.checkedInCount,
                remainingCount = 0,
                tableNumber = current.tableNumber,
                tableName = current.tableName,
                gateMessage = "Duplicate Gate Entry: full shadow party already admitted."
            )
        }

        if (count > remaining) {
            return@withLock CheckInVerificationResult(
                status = CheckInStatus.CAPACITY_EXCEEDED,
                guestName = current.name,
                householdName = current.householdName,
                partySize = current.partySize,
                alreadyCheckedInCount = current.checkedInCount,
                remainingCount = remaining,
                tableNumber = current.tableNumber,
                tableName = current.tableName,
                gateMessage = "Capacity Alert: only $remaining guest(s) remain in this shadow party."
            )
        }

        val updated = current.copy(checkedIn = true, checkedInCount = current.checkedInCount + count)
        guests[index] = updated

        auditRecords.add(
            CheckInAuditRecord(
                passSerial = updated.passSerial ?: "SHADOW",
                guestName = updated.name,
                countAdmitted = count,
                gateName = "Shadow Gate",
                usherId = usherId,
                isSynced = false
            )
        )

        val newRemaining = (updated.partySize - updated.checkedInCount).coerceAtLeast(0)
        CheckInVerificationResult(
            status = if (newRemaining == 0) CheckInStatus.VALID_PASS else CheckInStatus.PARTIAL_CHECKED_IN,
            guestName = updated.name,
            householdName = updated.householdName,
            partySize = updated.partySize,
            alreadyCheckedInCount = updated.checkedInCount,
            remainingCount = newRemaining,
            tableNumber = updated.tableNumber,
            tableName = updated.tableName,
            gateMessage = if (newRemaining == 0) "Admitted: full shadow party cleared for entry." else "Admitted: partial shadow party arrival."
        )
    }

    override suspend fun updateVendorState(id: String, state: VendorPresenceState): VendorPresence = mutex.withLock {
        val index = vendors.indexOfFirst { it.id == id }
        require(index >= 0) { "Vendor not found" }
        val updated = vendors[index].copy(state = state, lastUpdatedMillis = System.currentTimeMillis())
        vendors[index] = updated
        updated
    }

    override suspend fun postAnnouncement(title: String, message: String, urgency: AnnouncementUrgency): WeddingAnnouncement = mutex.withLock {
        val announcement = WeddingAnnouncement(title = title, message = message, urgency = urgency)
        announcements.add(0, announcement)
        announcement
    }

    override suspend fun resolveInvitation(weddingSlug: String, token: String): InvitationContext = mutex.withLock {
        val guest = guestForToken(token)
        InvitationContext(
            weddingSlug = weddingSlug,
            guestToken = token,
            coupleNames = wedding.coupleNames,
            guestName = guest.name,
            householdName = guest.householdName,
            partySize = guest.partySize,
            weddingDate = "Upcoming wedding",
            venueName = wedding.venueName,
            venueCity = "${wedding.city}, ${wedding.country}",
            cardStyle = "ivory-floral-gold",
            isConfirmed = guest.rsvpStatus == RSVPStatus.ATTENDING
        )
    }

    override suspend fun confirmRsvp(weddingSlug: String, token: String, attending: Boolean): WeddingPass = mutex.withLock {
        val index = guestIndexForToken(token)
        require(index >= 0) { "Shadow invitation token does not map to a reference guest." }

        val current = guests[index]
        val updated = current.copy(
            rsvpStatus = if (attending) RSVPStatus.ATTENDING else RSVPStatus.DECLINED,
            passSerial = if (attending) current.passSerial ?: "SHDW${current.id.uppercase().takeLast(8)}" else current.passSerial
        )
        guests[index] = updated

        if (attending) makePass(updated) else makeNonAdmissionPass(updated)
    }

    private fun guestIndexForToken(token: String): Int {
        val guestId = when (token) {
            attendingToken, "native-reference-guest" -> "shadow_guest_a"
            pendingToken -> "shadow_guest_c"
            declinedToken -> "shadow_guest_d"
            else -> return -1
        }
        return guests.indexOfFirst { it.id == guestId }
    }

    private fun guestForToken(token: String): Guest {
        val index = guestIndexForToken(token)
        require(index >= 0) { "Unknown Shadow guest token." }
        return guests[index]
    }

    private fun makePass(guest: Guest): WeddingPass {
        val serial = guest.passSerial ?: primaryPassSerial
        return WeddingPass(
            token = "shadow-pass-${guest.id}",
            weddingId = wedding.id,
            coupleNames = wedding.coupleNames,
            weddingDate = "Upcoming wedding",
            venueName = wedding.venueName,
            venueAddress = wedding.venueAddress,
            guestName = guest.name,
            householdName = guest.householdName,
            partySize = guest.partySize,
            tableNumber = guest.tableNumber,
            tableName = guest.tableName,
            seatNumber = if (guest.tableName == null) null else "Shadow assignment",
            currentStage = PassStage.ATTENDING,
            qrPayload = "SHADOW_ONLY.WW2_PLACEHOLDER.$serial.NOT_A_PRODUCTION_CREDENTIAL"
        )
    }

    private fun makeNonAdmissionPass(guest: Guest): WeddingPass = WeddingPass(
        token = "shadow-non-admission-${guest.id}",
        weddingId = wedding.id,
        coupleNames = wedding.coupleNames,
        weddingDate = "Upcoming wedding",
        venueName = wedding.venueName,
        venueAddress = wedding.venueAddress,
        guestName = guest.name,
        householdName = guest.householdName,
        partySize = guest.partySize,
        currentStage = PassStage.INVITATION,
        qrPayload = "SHADOW_DECLINED_NO_ADMISSION"
    )
}
