package pro.wewed.app.services

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import pro.wewed.app.models.*
import java.io.File
import java.util.UUID

/**
 * Production-derived Private Real Shadow implementation for authentic Charity & Kudzie UAT testing.
 * Loads the authentic private row-level snapshot from local protected storage.
 * Fails explicitly if the private real shadow file is missing (no silent fallback).
 */
class PrivateRealShadowWeddingRepository(jsonString: String? = null, customPath: String? = null) : WeddingRepository {
    private val mutex = Mutex()
    private val attendingToken = "shadow-attending-guest"
    private val pendingToken = "shadow-pending-guest"
    private val declinedToken = "shadow-declined-guest"
    private val partyFourToken = "shadow-party4-guest"

    private val wedding: Wedding
    private val tasks: MutableList<PlannerTask>
    private val guests: MutableList<Guest>
    private val budget: BudgetSummary
    private val auditRecords = mutableListOf<CheckInAuditRecord>()
    private val vendors: MutableList<VendorPresence>
    private val announcements: MutableList<WeddingAnnouncement>

    companion object {
        fun defaultSnapshotPath(): String {
            val envPath = System.getenv("WEWED_PRIVATE_SHADOW_PATH")
            if (!envPath.isNullOrBlank() && File(envPath).exists()) return envPath

            val userHome = System.getProperty("user.home")
            val homePath = "$userHome/.wewed-shadow/charity-kudzie/charity-kudzie-private-real-shadow.json"
            if (File(homePath).exists()) return homePath

            // Android emulator / device fallback paths
            val tmpPath = "/data/local/tmp/charity-kudzie-private-real-shadow.json"
            if (File(tmpPath).exists()) return tmpPath

            val sdcardPath = "/sdcard/charity-kudzie-private-real-shadow.json"
            if (File(sdcardPath).exists()) return sdcardPath

            val appDataPath = "/data/data/pro.wewed.app/files/charity-kudzie-private-real-shadow.json"
            if (File(appDataPath).exists()) return appDataPath

            return envPath ?: homePath
        }

        fun loadSnapshotString(path: String = defaultSnapshotPath()): String {
            val file = File(path)
            if (!file.exists()) {
                throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing(
                    "Private real shadow fixture not found at $path. Set WEWED_PRIVATE_SHADOW_PATH or place file at ~/.wewed-shadow/charity-kudzie/charity-kudzie-private-real-shadow.json. Falling back to demo data is strictly prohibited."
                )
            }
            return file.readText()
        }
    }

    init {
        val raw = jsonString ?: loadSnapshotString(customPath ?: defaultSnapshotPath())
        val root = JSONObject(raw)

        // 1. Wedding
        val weddingObj = root.optJSONObject("wedding")
            ?: throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required wedding metadata missing in private real shadow fixture.")
        val weddingId = weddingObj.optString("id")
        val coupleTitle = weddingObj.optString("title")
        val dateStr = weddingObj.optString("dateRaw")
        val venueStr = weddingObj.optString("venue")
        val cityStr = weddingObj.optString("venueCity")
        val countryStr = weddingObj.optString("venueCountry")
        val lifecycleStr = weddingObj.optString("lifecycle")

        if (weddingId.isEmpty() || coupleTitle.isEmpty() || dateStr.isEmpty() || venueStr.isEmpty() || cityStr.isEmpty() || countryStr.isEmpty() || lifecycleStr.isEmpty()) {
            throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required wedding fields missing in private real shadow fixture.")
        }

        // 2. Programme
        val progArray = root.optJSONArray("programme")
            ?: throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required programme list missing in private real shadow fixture.")
        val progItems = mutableListOf<ProgrammeItem>()
        for (i in 0 until progArray.length()) {
            val item = progArray.getJSONObject(i)
            val id = item.optString("id")
            val title = item.optString("title")
            val time = item.optString("time")
            if (id.isEmpty() || title.isEmpty() || time.isEmpty()) {
                throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required programme item fields missing in private real shadow fixture.")
            }
            progItems.add(
                ProgrammeItem(
                    id = id,
                    title = title,
                    time = time,
                    location = if (item.isNull("location")) venueStr else item.optString("location", venueStr),
                    description = item.optString("description", "")
                )
            )
        }

        wedding = Wedding(
            id = weddingId,
            coupleNames = coupleTitle,
            date = dateStr,
            venueName = venueStr,
            venueAddress = "$venueStr, $cityStr",
            city = cityStr,
            country = countryStr,
            lifecycle = lifecycleStr,
            programme = progItems
        )

        // 3. Tasks (42 tasks)
        val taskArray = root.optJSONArray("tasks")
            ?: throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required tasks list missing in private real shadow fixture.")
        tasks = mutableListOf()
        for (i in 0 until taskArray.length()) {
            val item = taskArray.getJSONObject(i)
            val id = item.optString("id")
            val title = item.optString("title")
            val statusRaw = item.optString("status").lowercase()
            val priorityRaw = item.optString("priority").lowercase()
            val category = item.optString("category")
            if (id.isEmpty() || title.isEmpty() || statusRaw.isEmpty() || priorityRaw.isEmpty() || category.isEmpty()) {
                throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required task fields missing in private real shadow fixture.")
            }
            val status = when (statusRaw) {
                "done", "completed" -> TaskStatus.DONE
                "in_progress", "inprogress" -> TaskStatus.IN_PROGRESS
                "blocked" -> TaskStatus.BLOCKED
                else -> TaskStatus.TODO
            }
            val priority = when (priorityRaw) {
                "high", "urgent" -> TaskPriority.HIGH
                "low" -> TaskPriority.LOW
                else -> TaskPriority.MEDIUM
            }
            val dueDate = if (item.isNull("dueDate")) null else item.optString("dueDate")
            tasks.add(
                PlannerTask(
                    id = id,
                    title = title,
                    status = status,
                    priority = priority,
                    category = category,
                    dueDate = dueDate
                )
            )
        }

        // Seating tables mapping
        val tablesArray = root.optJSONArray("seatingTables")
        val tableMap = mutableMapOf<String, String>()
        if (tablesArray != null) {
            for (i in 0 until tablesArray.length()) {
                val t = tablesArray.getJSONObject(i)
                tableMap[t.getString("id")] = t.getString("name")
            }
        }

        // 4. Guests (174 guests with real names)
        val guestArray = root.optJSONArray("guests")
            ?: throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required guests list missing in private real shadow fixture.")
        guests = mutableListOf()
        for (i in 0 until guestArray.length()) {
            val item = guestArray.getJSONObject(i)
            val id = item.optString("id")
            val name = item.optString("name")
            val rsvpRaw = item.optString("rsvpStatus").lowercase()
            if (id.isEmpty() || name.isEmpty() || rsvpRaw.isEmpty() || !item.has("partySize") || !item.has("checkedIn")) {
                throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required guest fields missing in private real shadow fixture.")
            }
            val side = if (item.isNull("side")) "family" else item.optString("side", "family")
            val checkedIn = item.optBoolean("checkedIn", false)
            val checkedInCount = item.optInt("checkedInCount", if (checkedIn) 1 else 0)
            val partySize = item.optInt("partySize", 1)
            val seatingTableId = if (item.isNull("seatingTableId")) null else item.optString("seatingTableId")
            val tableName = seatingTableId?.let { tableMap[it] }

            val rsvp = when (rsvpRaw) {
                "attending", "confirmed" -> RSVPStatus.ATTENDING
                "declined" -> RSVPStatus.DECLINED
                else -> RSVPStatus.PENDING
            }

            val passSerial = if (rsvp == RSVPStatus.ATTENDING) {
                if (partySize > 1) "SHDWGSTP04" else "SHDWGSTA01"
            } else null

            guests.add(
                Guest(
                    id = id,
                    name = name,
                    householdName = null,
                    partySize = partySize,
                    side = side,
                    rsvpStatus = rsvp,
                    tableNumber = null,
                    tableName = tableName,
                    checkedIn = checkedIn,
                    checkedInCount = checkedInCount,
                    passSerial = passSerial
                )
            )
        }

        // 5. Budget (22 items)
        val budgetArray = root.optJSONArray("budgetItems")
            ?: throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required budgetItems missing in private real shadow fixture.")
        val catAllocated = mutableMapOf<String, Double>()
        val catSpent = mutableMapOf<String, Double>()
        var totalEst = 0.0
        var totalAct = 0.0
        var totalPd = 0.0

        for (i in 0 until budgetArray.length()) {
            val b = budgetArray.getJSONObject(i)
            val id = b.optString("id")
            val cat = b.optString("category")
            if (id.isEmpty() || cat.isEmpty() || !b.has("estimatedCost") || !b.has("actualCost") || !b.has("paidAmount")) {
                throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required budget item fields missing in private real shadow fixture.")
            }
            val catTitle = cat.replaceFirstChar { it.uppercase() }
            val est = b.optDouble("estimatedCost", 0.0)
            val act = b.optDouble("actualCost", 0.0)
            val pd = b.optDouble("paidAmount", 0.0)
            totalEst += est
            totalAct += act
            totalPd += pd
            catAllocated[catTitle] = (catAllocated[catTitle] ?: 0.0) + if (act > 0) act else est
            catSpent[catTitle] = (catSpent[catTitle] ?: 0.0) + pd
        }

        val categories = catAllocated.keys.sorted().map { cat ->
            BudgetCategory(cat, catAllocated[cat] ?: 0.0, catSpent[cat] ?: 0.0)
        }

        budget = BudgetSummary(
            currency = "USD",
            totalBudget = totalEst,
            totalAllocated = totalAct,
            totalPaid = totalPd,
            categories = categories
        )

        // 6. Vendors (7 vendors)
        val vendorsArray = root.optJSONArray("vendors")
            ?: throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required vendors list missing in private real shadow fixture.")
        vendors = mutableListOf()
        for (i in 0 until vendorsArray.length()) {
            val v = vendorsArray.getJSONObject(i)
            val id = v.optString("id")
            val name = v.optString("name")
            val cat = v.optString("category")
            if (id.isEmpty() || name.isEmpty() || cat.isEmpty()) {
                throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required vendor fields missing in private real shadow fixture.")
            }
            vendors.add(
                VendorPresence(
                    id = id,
                    vendorName = name,
                    serviceCategory = cat.replaceFirstChar { it.uppercase() },
                    serviceArea = venueStr,
                    state = VendorPresenceState.NOT_RECORDED,
                    expectedTime = "Not recorded"
                )
            )
        }

        announcements = mutableListOf()
    }

    override suspend fun getWedding(): Wedding = mutex.withLock { wedding }
    override suspend fun getTasks(): List<PlannerTask> = mutex.withLock { tasks.toList() }
    override suspend fun getGuests(): List<Guest> = mutex.withLock { guests.toList() }
    override suspend fun getBudget(): BudgetSummary = mutex.withLock { budget }
    override suspend fun getAuditRecords(): List<CheckInAuditRecord> = mutex.withLock { auditRecords.toList() }
    override suspend fun getVendors(): List<VendorPresence> = mutex.withLock { vendors.toList() }
    override suspend fun getAnnouncements(): List<WeddingAnnouncement> = mutex.withLock { announcements.toList() }

    override suspend fun createTask(title: String, priority: TaskPriority, category: String): PlannerTask = mutex.withLock {
        val task = PlannerTask(
            id = "real_task_${UUID.randomUUID().toString().take(8)}",
            title = title,
            status = TaskStatus.TODO,
            priority = priority,
            category = category,
            dueDate = null
        )
        tasks.add(task)
        task
    }

    override suspend fun toggleTask(taskId: String): PlannerTask = mutex.withLock {
        val index = tasks.indexOfFirst { it.id == taskId }
        if (index == -1) throw NoSuchElementException("Task not found")
        val current = tasks[index]
        val updated = current.copy(status = if (current.status == TaskStatus.DONE) TaskStatus.TODO else TaskStatus.DONE)
        tasks[index] = updated
        updated
    }

    override suspend fun getWeddingPass(token: String): WeddingPass = mutex.withLock {
        val guest = guestForToken(token)
        if (guest.rsvpStatus != RSVPStatus.ATTENDING) {
            throw IllegalStateException("Wedding Pass is available only to attending guests in Private Real Shadow.")
        }
        makePass(guest)
    }

    override suspend fun searchGuests(query: String): List<Guest> = mutex.withLock {
        val normalized = query.trim().lowercase()
        if (normalized.isEmpty()) guests.toList()
        else guests.filter {
            it.name.lowercase().contains(normalized) ||
                (it.householdName?.lowercase()?.contains(normalized) == true) ||
                (it.tableName?.lowercase()?.contains(normalized) == true)
        }
    }

    override suspend fun checkInGuest(qrPayload: String, count: Int, usherId: String): CheckInVerificationResult = mutex.withLock {
        val index = guests.indexOfFirst { guest ->
            val serial = guest.passSerial ?: return@indexOfFirst false
            qrPayload.contains(serial)
        }

        if (index == -1) {
            return@withLock CheckInVerificationResult(
                status = CheckInStatus.INVALID_PASS,
                guestName = "Unknown Guest",
                partySize = 0,
                alreadyCheckedInCount = 0,
                remainingCount = 0,
                gateMessage = "Pass does not match an attending guest."
            )
        }

        val guest = guests[index]
        val remaining = (guest.partySize - guest.checkedInCount).coerceAtLeast(0)

        if (remaining == 0) {
            return@withLock CheckInVerificationResult(
                status = CheckInStatus.ALREADY_CHECKED_IN,
                guestName = guest.name,
                householdName = guest.householdName,
                partySize = guest.partySize,
                alreadyCheckedInCount = guest.checkedInCount,
                remainingCount = 0,
                tableNumber = guest.tableNumber,
                tableName = guest.tableName,
                gateMessage = "Duplicate Gate Entry: full party already admitted."
            )
        }

        if (count > remaining) {
            return@withLock CheckInVerificationResult(
                status = CheckInStatus.CAPACITY_EXCEEDED,
                guestName = guest.name,
                householdName = guest.householdName,
                partySize = guest.partySize,
                alreadyCheckedInCount = guest.checkedInCount,
                remainingCount = remaining,
                tableNumber = guest.tableNumber,
                tableName = guest.tableName,
                gateMessage = "Capacity Alert: only $remaining guest(s) remain in this party."
            )
        }

        val updatedCheckedInCount = guest.checkedInCount + count
        val updated = guest.copy(
            checkedInCount = updatedCheckedInCount,
            checkedIn = updatedCheckedInCount > 0
        )
        guests[index] = updated

        auditRecords.add(
            CheckInAuditRecord(
                passSerial = guest.passSerial ?: "REAL_SHADOW",
                guestName = guest.name,
                countAdmitted = count,
                gateName = "Main Gate",
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
            gateMessage = if (newRemaining == 0) "Admitted: full party cleared for entry." else "Admitted: partial party arrival."
        )
    }

    override suspend fun updateVendorState(id: String, state: VendorPresenceState): VendorPresence = mutex.withLock {
        val index = vendors.indexOfFirst { it.id == id }
        if (index == -1) throw NoSuchElementException("Vendor not found")
        val updated = vendors[index].copy(state = state, lastUpdatedMillis = System.currentTimeMillis())
        vendors[index] = updated
        updated
    }

    override suspend fun postAnnouncement(title: String, message: String, urgency: AnnouncementUrgency): WeddingAnnouncement = mutex.withLock {
        val announcement = WeddingAnnouncement(
            id = "real_ann_${UUID.randomUUID().toString().take(6)}",
            title = title,
            message = message,
            urgency = urgency
        )
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
            weddingDate = wedding.date,
            venueName = wedding.venueName,
            venueCity = "${wedding.city}, ${wedding.country}",
            cardStyle = "ivory-floral-gold",
            isConfirmed = guest.rsvpStatus == RSVPStatus.ATTENDING
        )
    }

    override suspend fun confirmRsvp(weddingSlug: String, token: String, attending: Boolean): WeddingPass = mutex.withLock {
        val index = guestIndexForToken(token) ?: throw NoSuchElementException("Invitation token does not map to a guest.")
        val current = guests[index]
        val updatedRsvp = if (attending) RSVPStatus.ATTENDING else RSVPStatus.DECLINED
        val passSerial = if (attending && current.passSerial == null) "SHDW${current.id.uppercase().takeLast(8)}" else current.passSerial
        val updated = current.copy(rsvpStatus = updatedRsvp, passSerial = passSerial)
        guests[index] = updated

        if (attending) makePass(updated) else makeNonAdmissionPass(updated)
    }

    private fun guestIndexForToken(token: String): Int? {
        if (guests.isEmpty()) return null
        return when (token) {
            attendingToken, "native-reference-guest" -> guests.indexOfFirst { it.rsvpStatus == RSVPStatus.ATTENDING && it.partySize == 1 }.takeIf { it != -1 } ?: guests.indexOfFirst { it.rsvpStatus == RSVPStatus.ATTENDING }
            partyFourToken -> guests.indexOfFirst { it.partySize >= 4 }.takeIf { it != -1 } ?: 0
            pendingToken -> guests.indexOfFirst { it.rsvpStatus == RSVPStatus.PENDING }
            declinedToken -> guests.indexOfFirst { it.rsvpStatus == RSVPStatus.DECLINED }.takeIf { it != -1 } ?: if (guests.size > 1) 1 else 0
            else -> guests.indexOfFirst { it.id == token }
        }.takeIf { it != -1 }
    }

    private fun guestForToken(token: String): Guest {
        val index = guestIndexForToken(token) ?: throw NoSuchElementException("Unknown guest token in Private Real Shadow.")
        return guests[index]
    }

    private fun makePass(guest: Guest): WeddingPass {
        val serial = guest.passSerial ?: ("SHDW" + guest.id.uppercase().takeLast(8))
        return WeddingPass(
            token = "real-pass-${guest.id}",
            weddingId = wedding.id,
            coupleNames = wedding.coupleNames,
            weddingDate = wedding.date,
            venueName = wedding.venueName,
            venueAddress = wedding.venueAddress,
            guestName = guest.name,
            householdName = guest.householdName,
            partySize = guest.partySize,
            tableNumber = guest.tableNumber,
            tableName = guest.tableName,
            seatNumber = if (guest.tableName == null) null else "Assigned Seat",
            currentStage = PassStage.ATTENDING,
            qrPayload = "REAL_SHADOW_ONLY.WW2_PLACEHOLDER.$serial.NOT_A_PRODUCTION_CREDENTIAL"
        )
    }

    private fun makeNonAdmissionPass(guest: Guest): WeddingPass {
        return WeddingPass(
            token = "real-non-admission-${guest.id}",
            weddingId = wedding.id,
            coupleNames = wedding.coupleNames,
            weddingDate = wedding.date,
            venueName = wedding.venueName,
            venueAddress = wedding.venueAddress,
            guestName = guest.name,
            householdName = guest.householdName,
            partySize = guest.partySize,
            currentStage = PassStage.INVITATION,
            qrPayload = "DECLINED_NO_ADMISSION"
        )
    }
}
