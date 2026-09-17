package pro.wewed.app.services

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import pro.wewed.app.models.*
import java.util.UUID

interface WeddingRepository {
    suspend fun getWedding(): Wedding
    suspend fun getTasks(): List<PlannerTask>
    suspend fun createTask(title: String, priority: TaskPriority, category: String): PlannerTask
    suspend fun toggleTask(taskId: String): PlannerTask
    suspend fun getGuests(): List<Guest>
    suspend fun getBudget(): BudgetSummary
    suspend fun getWeddingPass(token: String): WeddingPass
    suspend fun searchGuests(query: String): List<Guest>
    suspend fun checkInGuest(qrPayload: String, count: Int, usherId: String): CheckInVerificationResult
    suspend fun getAuditRecords(): List<CheckInAuditRecord>
}

class FixtureWeddingRepository : WeddingRepository {
    private val mutex = Mutex()

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

    override suspend fun getWedding(): Wedding = mutex.withLock { wedding }

    override suspend fun getTasks(): List<PlannerTask> = mutex.withLock { tasks.toList() }

    override suspend fun createTask(title: String, priority: TaskPriority, category: String): PlannerTask = mutex.withLock {
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

    override suspend fun toggleTask(taskId: String): PlannerTask = mutex.withLock {
        val index = tasks.indexOfFirst { it.id == taskId }
        if (index == -1) throw IllegalArgumentException("Task not found")
        val current = tasks[index]
        val updated = current.copy(
            status = if (current.status == TaskStatus.DONE) TaskStatus.TODO else TaskStatus.DONE
        )
        tasks[index] = updated
        updated
    }

    override suspend fun getGuests(): List<Guest> = mutex.withLock { guests.toList() }

    override suspend fun getBudget(): BudgetSummary = mutex.withLock { budget }

    override suspend fun getWeddingPass(token: String): WeddingPass = mutex.withLock { pass }

    override suspend fun getAuditRecords(): List<CheckInAuditRecord> = mutex.withLock { auditRecords.toList() }

    override suspend fun searchGuests(query: String): List<Guest> = mutex.withLock {
        if (query.isBlank()) return@withLock guests.toList()
        val lower = query.lowercase()
        guests.filter {
            it.name.lowercase().contains(lower) ||
            (it.householdName?.lowercase()?.contains(lower) == true) ||
            (it.tableName?.lowercase()?.contains(lower) == true)
        }
    }

    override suspend fun checkInGuest(qrPayload: String, count: Int, usherId: String): CheckInVerificationResult = mutex.withLock {
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
}
