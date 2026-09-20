package pro.wewed.app.services

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import pro.wewed.app.models.*
import java.util.UUID

/**
 * Raised when a repository is asked for a wedding graph it does not serve.
 *
 * This is the mechanism that makes [NavigationContext.activeWeddingId] a real scope rather than a
 * reload key: a source holding wedding A cannot answer a request for wedding B by returning A.
 */
class WeddingScopeMismatch(
    val requestedWeddingId: String,
    val availableWeddingIds: List<String>
) : IllegalStateException(
    "Repository does not serve wedding '$requestedWeddingId' (serves: ${availableWeddingIds.joinToString()})"
)

/**
 * Wedding-scoped data source.
 *
 * Every graph read takes the wedding it belongs to, and implementations must reject a wedding they
 * do not hold. Screens never call this directly — they go through [ScopedWeddingRepository], which
 * binds exactly one wedding for the lifetime of a workspace.
 *
 * Token-addressed reads (pass, invitation, RSVP) are credential-scoped rather than wedding-scoped:
 * the token itself identifies both the wedding and the guest.
 */
interface WeddingRepository {
    /** Wedding identities this source can serve for the current actor. */
    suspend fun availableWeddingIds(): List<String>

    suspend fun getWedding(weddingId: String): Wedding
    suspend fun getTasks(weddingId: String): List<PlannerTask>
    suspend fun createTask(weddingId: String, title: String, priority: TaskPriority, category: String): PlannerTask
    suspend fun toggleTask(weddingId: String, taskId: String): PlannerTask
    suspend fun getGuests(weddingId: String): List<Guest>
    suspend fun getBudget(weddingId: String): BudgetSummary
    suspend fun searchGuests(weddingId: String, query: String): List<Guest>
    suspend fun checkInGuest(weddingId: String, qrPayload: String, count: Int, usherId: String): CheckInVerificationResult
    suspend fun getAuditRecords(weddingId: String): List<CheckInAuditRecord>
    suspend fun getVendors(weddingId: String): List<VendorPresence>
    suspend fun updateVendorState(weddingId: String, id: String, state: VendorPresenceState): VendorPresence
    suspend fun getAnnouncements(weddingId: String): List<WeddingAnnouncement>
    suspend fun postAnnouncement(weddingId: String, title: String, message: String, urgency: AnnouncementUrgency): WeddingAnnouncement

    // Credential-scoped: the token identifies the wedding and the guest.
    suspend fun getWeddingPass(token: String): WeddingPass
    suspend fun resolveInvitation(weddingSlug: String, token: String): InvitationContext
    suspend fun confirmRsvp(weddingSlug: String, token: String, attending: Boolean): WeddingPass
}

/**
 * A repository bound to one wedding.
 *
 * Constructed through [WeddingRepository.forWedding], which verifies up front that the source
 * actually serves that wedding. Because the workspace UI only ever holds one of these, a screen
 * cannot accidentally read an unscoped graph, and a context switch cannot keep rendering the
 * previous wedding.
 */
class ScopedWeddingRepository internal constructor(
    private val source: WeddingRepository,
    val weddingId: String
) {
    suspend fun getWedding(): Wedding = source.getWedding(weddingId)
    suspend fun getTasks(): List<PlannerTask> = source.getTasks(weddingId)
    suspend fun createTask(title: String, priority: TaskPriority, category: String): PlannerTask =
        source.createTask(weddingId, title, priority, category)
    suspend fun toggleTask(taskId: String): PlannerTask = source.toggleTask(weddingId, taskId)
    suspend fun getGuests(): List<Guest> = source.getGuests(weddingId)
    suspend fun getBudget(): BudgetSummary = source.getBudget(weddingId)
    suspend fun searchGuests(query: String): List<Guest> = source.searchGuests(weddingId, query)
    suspend fun checkInGuest(qrPayload: String, count: Int, usherId: String): CheckInVerificationResult =
        source.checkInGuest(weddingId, qrPayload, count, usherId)
    suspend fun getAuditRecords(): List<CheckInAuditRecord> = source.getAuditRecords(weddingId)
    suspend fun getVendors(): List<VendorPresence> = source.getVendors(weddingId)
    suspend fun updateVendorState(id: String, state: VendorPresenceState): VendorPresence =
        source.updateVendorState(weddingId, id, state)
    suspend fun getAnnouncements(): List<WeddingAnnouncement> = source.getAnnouncements(weddingId)
    suspend fun postAnnouncement(title: String, message: String, urgency: AnnouncementUrgency): WeddingAnnouncement =
        source.postAnnouncement(weddingId, title, message, urgency)

    suspend fun getWeddingPass(token: String): WeddingPass = source.getWeddingPass(token)
    suspend fun resolveInvitation(weddingSlug: String, token: String): InvitationContext =
        source.resolveInvitation(weddingSlug, token)
    suspend fun confirmRsvp(weddingSlug: String, token: String, attending: Boolean): WeddingPass =
        source.confirmRsvp(weddingSlug, token, attending)
}

/**
 * Binds this source to one wedding, failing fast when the source cannot serve it.
 * @throws WeddingScopeMismatch when [weddingId] is not among [WeddingRepository.availableWeddingIds].
 */
suspend fun WeddingRepository.forWedding(weddingId: String): ScopedWeddingRepository {
    val available = availableWeddingIds()
    if (weddingId !in available) throw WeddingScopeMismatch(weddingId, available)
    return ScopedWeddingRepository(this, weddingId)
}

class FixtureWeddingRepository : WeddingRepository {
    private val mutex = Mutex()

    override suspend fun availableWeddingIds(): List<String> = listOf(wedding.id)

    /** Rejects a request for any wedding this source does not hold (P0-1). */
    private fun requireScope(weddingId: String) {
        if (weddingId != wedding.id) {
            throw WeddingScopeMismatch(weddingId, listOf(wedding.id))
        }
    }

    private var wedding = Wedding(
        id = "wed_tariro_shadreck_2026",
        coupleNames = "Tariro & Shadreck",
        date = "2026-10-24T14:00:00Z",
        venueName = "Imba Manor Estate",
        venueAddress = "Glen Lorne, Harare",
        city = "Harare",
        country = "Zimbabwe",
        lifecycle = "before",
        programme = listOf(
            ProgrammeItem("p1", "Guest Arrival", "13:15", "Manor Gardens", "Welcome iced tea"),
            ProgrammeItem("p2", "Ceremony & Vows", "14:00", "Chapel on the Hill", "Marriage register signing"),
            ProgrammeItem("p3", "Cocktail Hour", "15:30", "Pavilion Terrace", "Canapés and jazz"),
            ProgrammeItem("p4", "Grand Reception", "17:30", "The Grand Ballroom", "Dinner and dancing"),
            ProgrammeItem("p5", "After Party", "21:30", "The Courtyard", "DJ and sparklers")
        )
    )

    private val tasks = mutableListOf(
        PlannerTask("task_1", "Finalize seating chart with venue manager", TaskStatus.IN_PROGRESS, TaskPriority.URGENT, "Venue & Seating", "2026-10-15"),
        PlannerTask("task_2", "Order printed QR cardstock passes for elders", TaskStatus.TODO, TaskPriority.HIGH, "Invitations", "2026-10-10"),
        PlannerTask("task_3", "Confirm shuttle pickups at Meikles Hotel", TaskStatus.TODO, TaskPriority.MEDIUM, "Logistics", "2026-10-18"),
        PlannerTask("task_4", "Sample 3-tier red velvet and lemon drizzle cake", TaskStatus.DONE, TaskPriority.HIGH, "Catering", "2026-09-20"),
        PlannerTask("task_5", "Finalize Songbook playlist with DJ", TaskStatus.DONE, TaskPriority.LOW, "Entertainment", "2026-09-25")
    )

    private val guests = mutableListOf(
        Guest("gst_1", "Jane & Michael Doe", "Doe Household", 2, "Bride", RSVPStatus.ATTENDING, 8, "Jacaranda — 8", false, 0, "WWJD0824"),
        Guest("gst_2", "Musarurwa Family", "Musarurwa Household", 4, "Groom", RSVPStatus.ATTENDING, 1, "Baobab — 1", false, 0, "WWMF0104"),
        Guest("gst_3", "Sarah Moyo", "Sarah Moyo", 1, "Bride", RSVPStatus.ATTENDING, 8, "Jacaranda — 8", true, 1, "WWSM0801"),
        Guest("gst_4", "Tendai Chikore", "Chikore Household", 2, "Groom", RSVPStatus.PENDING, 3, "Acacia — 3", false, 0, "WWTC0302")
    )

    private val budget = BudgetSummary(
        currency = "USD",
        totalBudget = 35000.0,
        totalAllocated = 32400.0,
        totalPaid = 24800.0,
        categories = listOf(
            BudgetCategory("Venue & Decor", 12000.0, 10500.0),
            BudgetCategory("Catering & Bar", 9500.0, 7200.0),
            BudgetCategory("Photography & Video", 4200.0, 3500.0),
            BudgetCategory("Attire & Rings", 3800.0, 2100.0),
            BudgetCategory("Music & Sound", 2900.0, 1500.0)
        )
    )

    private val pass = WeddingPass(
        token = "w1-j8doe-7x9",
        weddingId = "wed_tariro_shadreck_2026",
        coupleNames = "Tariro & Shadreck",
        weddingDate = "2026-10-24T14:00:00Z",
        venueName = "Imba Manor Estate",
        venueAddress = "Glen Lorne, Harare",
        guestName = "Jane & Michael Doe",
        householdName = "Doe Household",
        partySize = 2,
        tableNumber = 8,
        tableName = "Jacaranda — 8",
        seatNumber = "Seats 3 & 4",
        currentStage = PassStage.ATTENDING,
        qrPayload = "WW1.wedts26.WWJD0824.0e.66f001ab.3f9a7c2b4d1e809f"
    )

    private val auditRecords = mutableListOf<CheckInAuditRecord>()

    override suspend fun getWedding(weddingId: String): Wedding = mutex.withLock {
        requireScope(weddingId)
        wedding }

    override suspend fun getTasks(weddingId: String): List<PlannerTask> = mutex.withLock {
        requireScope(weddingId)
        tasks.toList() }

    override suspend fun createTask(weddingId: String, title: String, priority: TaskPriority, category: String): PlannerTask = mutex.withLock {
        requireScope(weddingId)
        val newTask = PlannerTask(
            id = "task_${UUID.randomUUID().toString().take(8)}",
            title = title,
            status = TaskStatus.TODO,
            priority = priority,
            category = category
        )
        tasks.add(newTask)
        newTask
    }

    override suspend fun toggleTask(weddingId: String, taskId: String): PlannerTask = mutex.withLock {
        requireScope(weddingId)
        val index = tasks.indexOfFirst { it.id == taskId }
        if (index == -1) throw IllegalArgumentException("Task not found")
        val current = tasks[index]
        val updated = current.copy(
            status = if (current.status == TaskStatus.DONE) TaskStatus.TODO else TaskStatus.DONE
        )
        tasks[index] = updated
        updated
    }

    override suspend fun getGuests(weddingId: String): List<Guest> = mutex.withLock {
        requireScope(weddingId)
        guests.toList() }

    override suspend fun getBudget(weddingId: String): BudgetSummary = mutex.withLock {
        requireScope(weddingId)
        budget }

    override suspend fun getWeddingPass(token: String): WeddingPass = mutex.withLock { pass }

    override suspend fun getAuditRecords(weddingId: String): List<CheckInAuditRecord> = mutex.withLock {
        requireScope(weddingId)
        auditRecords.toList() }

    override suspend fun searchGuests(weddingId: String, query: String): List<Guest> = mutex.withLock {
        requireScope(weddingId)
        if (query.isBlank()) return@withLock guests.toList()
        val lower = query.lowercase()
        guests.filter {
            it.name.lowercase().contains(lower) ||
            (it.householdName?.lowercase()?.contains(lower) == true) ||
            (it.tableName?.lowercase()?.contains(lower) == true)
        }
    }

    override suspend fun checkInGuest(weddingId: String, qrPayload: String, count: Int, usherId: String): CheckInVerificationResult = mutex.withLock {
        requireScope(weddingId)
        val index = guests.indexOfFirst { it.passSerial != null && qrPayload.contains(it.passSerial) }
        if (index == -1) {
            return@withLock CheckInVerificationResult(
                status = CheckInStatus.INVALID_PASS,
                guestName = "Unknown Guest",
                householdName = null,
                partySize = 0,
                alreadyCheckedInCount = 0,
                remainingCount = 0,
                tableNumber = null,
                tableName = null,
                gateMessage = "Invalid Pass: No matching guest serial found in manifest."
            )
        }

        val target = guests[index]
        val alreadyAdmitted = target.checkedInCount
        val remaining = target.partySize - alreadyAdmitted

        if (remaining <= 0) {
            return@withLock CheckInVerificationResult(
                status = CheckInStatus.ALREADY_CHECKED_IN,
                guestName = target.name,
                householdName = target.householdName,
                partySize = target.partySize,
                alreadyCheckedInCount = alreadyAdmitted,
                remainingCount = 0,
                tableNumber = target.tableNumber,
                tableName = target.tableName,
                gateMessage = "Duplicate Gate Entry: Full party of ${target.partySize} has already entered."
            )
        }

        if (count > remaining) {
            return@withLock CheckInVerificationResult(
                status = CheckInStatus.CAPACITY_EXCEEDED,
                guestName = target.name,
                householdName = target.householdName,
                partySize = target.partySize,
                alreadyCheckedInCount = alreadyAdmitted,
                remainingCount = remaining,
                tableNumber = target.tableNumber,
                tableName = target.tableName,
                gateMessage = "Capacity Alert: Attempting to admit $count, but only $remaining of ${target.partySize} remaining."
            )
        }

        val newCheckedInCount = alreadyAdmitted + count
        val updated = target.copy(checkedInCount = newCheckedInCount, checkedIn = true)
        guests[index] = updated

        val audit = CheckInAuditRecord(
            passSerial = target.passSerial ?: "UNKNOWN",
            guestName = target.name,
            countAdmitted = count,
            gateName = "Gate A — Main Entrance",
            usherId = usherId,
            scannedAtMillis = System.currentTimeMillis(),
            isSynced = false
        )
        auditRecords.add(audit)

        val newRemaining = target.partySize - newCheckedInCount
        val status = if (newRemaining == 0) CheckInStatus.VALID_PASS else CheckInStatus.PARTIAL_CHECKED_IN
        val gateMsg = if (newRemaining == 0) {
            "Admitted: Full party ($newCheckedInCount/${target.partySize}) cleared for entry."
        } else {
            "Admitted: Partial entry ($count admitted, $newRemaining remaining in party)."
        }

        CheckInVerificationResult(
            status = status,
            guestName = target.name,
            householdName = target.householdName,
            partySize = target.partySize,
            alreadyCheckedInCount = newCheckedInCount,
            remainingCount = newRemaining,
            tableNumber = target.tableNumber,
            tableName = target.tableName,
            gateMessage = gateMsg
        )
    }

    private val vendors = mutableListOf(
        VendorPresence("v1", "Shandy Events", "Décor & Florals", "Main Marquee", VendorPresenceState.ARRIVED, "11:00"),
        VendorPresence("v2", "Kudzi Visuals", "Photography & Drone", "Chapel & Gardens", VendorPresenceState.EN_ROUTE, "12:30"),
        VendorPresence("v3", "Crown Sound Zimbabwe", "Sound & Audio", "Grand Ballroom", VendorPresenceState.SERVICE_ACTIVE, "10:00")
    )

    private val announcements = mutableListOf(
        WeddingAnnouncement("a1", "Welcome Drinks", "Welcome iced tea and mint water are now being served at the Manor Gardens.", AnnouncementUrgency.INFO),
        WeddingAnnouncement("a2", "Ceremony Seating", "All guests please make your way to the Chapel on the Hill. Doors open at 13:15.", AnnouncementUrgency.ACTION)
    )

    override suspend fun getVendors(weddingId: String): List<VendorPresence> = mutex.withLock {
        requireScope(weddingId)
        vendors.toList()
    }

    override suspend fun updateVendorState(weddingId: String, id: String, state: VendorPresenceState): VendorPresence = mutex.withLock {
        requireScope(weddingId)
        val index = vendors.indexOfFirst { it.id == id }
        if (index == -1) throw NoSuchElementException("Vendor not found")
        val updated = vendors[index].copy(state = state, lastUpdatedMillis = System.currentTimeMillis())
        vendors[index] = updated
        updated
    }

    override suspend fun getAnnouncements(weddingId: String): List<WeddingAnnouncement> = mutex.withLock {
        requireScope(weddingId)
        announcements.toList()
    }

    override suspend fun postAnnouncement(weddingId: String, title: String, message: String, urgency: AnnouncementUrgency): WeddingAnnouncement = mutex.withLock {
        requireScope(weddingId)
        val ann = WeddingAnnouncement(title = title, message = message, urgency = urgency)
        announcements.add(0, ann)
        ann
    }

    override suspend fun resolveInvitation(weddingSlug: String, token: String): InvitationContext = mutex.withLock {
        InvitationContext(
            weddingSlug = weddingSlug,
            guestToken = token,
            coupleNames = wedding.coupleNames,
            guestName = "Jane & Michael Doe",
            householdName = "Doe Household",
            partySize = 2,
            weddingDate = "Saturday, 24 October 2026",
            venueName = wedding.venueName,
            venueCity = "${wedding.city}, ${wedding.country}",
            cardStyle = "ivory-floral-gold",
            isConfirmed = false
        )
    }

    override suspend fun confirmRsvp(weddingSlug: String, token: String, attending: Boolean): WeddingPass = mutex.withLock {
        pass
    }
}


/**
 * Binds a single-wedding source to the one wedding it serves.
 *
 * This is a convenience for callers that already know the source holds exactly one wedding
 * (fixtures, shadow snapshots, tests). It still goes through [forWedding], so the scope is
 * resolved and validated rather than bypassed.
 */
suspend fun WeddingRepository.forOnlyWedding(): ScopedWeddingRepository {
    val available = availableWeddingIds()
    check(available.size == 1) {
        "forOnlyWedding() requires a single-wedding source; this one serves ${available.size}."
    }
    return forWedding(available.first())
}
