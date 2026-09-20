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

    override suspend fun availableWeddingIds(): List<String> = listOf(wedding.id)

    /** Rejects a request for any wedding this source does not hold (P0-1). */
    private fun requireScope(weddingId: String) {
        if (weddingId != wedding.id) {
            throw WeddingScopeMismatch(weddingId, listOf(wedding.id))
        }
    }
    private val mutex = Mutex()
    private val attendingToken = "shadow-attending-guest"
    private val pendingToken = "shadow-pending-guest"
    private val declinedToken = "shadow-declined-guest"
    private val partyFourToken = "shadow-party4-guest"

    private val wedding: Wedding
    private val weddingSlug: String
    private val tasks: MutableList<PlannerTask>
    private val guests: MutableList<Guest>
    private val budget: BudgetSummary
    private val auditRecords = mutableListOf<CheckInAuditRecord>()
    private val vendors: MutableList<VendorPresence>
    private val announcements: MutableList<WeddingAnnouncement>

    /**
     * Local UAT changes, layered over the snapshot rather than written into it.
     *
     * `baseTasks`, `baseGuests` and `baseVendors` stay exactly as the authorized production read
     * produced them, so provenance is answerable per record and reset is a clear rather than a
     * reload. Nothing recorded here reaches production; there is no write path.
     */
    private val mutations = ShadowMutationOverlay()
    private val baseTasks: List<PlannerTask>
    private val baseGuests: List<Guest>
    private val baseVendors: List<VendorPresence>

    /** True while the view still equals the production-derived snapshot. */
    suspend fun isPristine(): Boolean = mutex.withLock { mutations.isPristine }

    /** Counts of what this UAT session changed. No private values. */
    suspend fun mutationSummary(): Map<String, Int> = mutex.withLock { mutations.summary() }

    /** Discards every local change, returning the view to the production-derived snapshot. */
    suspend fun resetMutations() = mutex.withLock {
        mutations.reset()
        tasks.clear(); tasks.addAll(baseTasks)
        guests.clear(); guests.addAll(baseGuests)
        vendors.clear(); vendors.addAll(baseVendors)
        auditRecords.clear()
        announcements.clear()
    }

    /** Where a task's current value came from. */
    suspend fun provenanceForTask(taskId: String): DataProvenance =
        mutex.withLock { mutations.provenanceForTask(taskId) }

    /** Where a guest's current value came from. */
    suspend fun provenanceForGuest(guestId: String): DataProvenance =
        mutex.withLock { mutations.provenanceForGuest(guestId) }

    // Production-derived graph loaded from the canonical Private Real UAT snapshot.
    private val manifest: UatSnapshotManifest
    private val rsvpDetails: Map<String, GuestRsvpDetail>
    private val guestContacts: Map<String, GuestContactDetail>
    private val weddingContent: List<WeddingContentEntry>
    private val contentRevisions: List<ContentRevisionRecord>
    private val songs: List<SongEntry>
    private val qrDestinations: List<QrDestination>
    private val importJobs: List<ImportJobRecord>
    private val wallMessages: List<WallMessage>
    private val engagementParties: List<EngagementPartyRecord>
    private val auditEvents: List<AuditEventRecord>
    private val plannerAccess: PlannerAccessContext?
    private val adminAccess: AdminAccessContext?

    companion object {
        /** The only snapshot schema this build accepts. Bumping it forces a re-provision. */
        const val REQUIRED_SCHEMA_VERSION = "private-real-uat/2"

        /** Canonical Private Real UAT snapshot filename, shared with iOS and the provisioner. */
        const val SNAPSHOT_FILENAME = "charity-kudzie-private-real-uat-v2.json"

        fun defaultSnapshotPath(): String {
            val envPath = System.getenv("WEWED_PRIVATE_SHADOW_PATH")
            if (!envPath.isNullOrBlank() && File(envPath).exists()) return envPath

            val userHome = System.getProperty("user.home")
            val homePath = "$userHome/.wewed-shadow/charity-kudzie/$SNAPSHOT_FILENAME"
            if (File(homePath).exists()) return homePath

            // Android private app storage only. Production-derived private
            // snapshots must never be read from /sdcard or /data/local/tmp.
            val appDataDevPath = "/data/data/pro.wewed.app.dev/files/$SNAPSHOT_FILENAME"
            if (File(appDataDevPath).exists()) return appDataDevPath

            val appDataUatPath = "/data/data/pro.wewed.app.uatdev/files/$SNAPSHOT_FILENAME"
            if (File(appDataUatPath).exists()) return appDataUatPath

            return envPath ?: homePath
        }

        fun loadSnapshotString(path: String = defaultSnapshotPath()): String {
            val file = File(path)
            if (!file.exists()) {
                throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing(
                    "Private real shadow fixture not found at $path. Use WEWED_PRIVATE_SHADOW_PATH on desktop tests or provision the protected file into app-private storage. Public tmp/sdcard fallback and demo-data fallback are prohibited."
                )
            }
            return file.readText()
        }
    }

    init {
        val raw = jsonString ?: loadSnapshotString(customPath ?: defaultSnapshotPath())
        val root = JSONObject(raw)

        // The canonical Private Real UAT snapshot is versioned. A stale or differently-shaped file
        // is rejected loudly here rather than parsed partially: provisioning has failed silently
        // before, leaving the device on an older graph while the environment badge still read
        // "Private Real".
        val metadata = root.optJSONObject("metadata")
            ?: throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing(
                "Private Real UAT snapshot has no metadata block. Expected schema " +
                    "$REQUIRED_SCHEMA_VERSION; re-run the extract/build pipeline and re-provision."
            )
        val schemaVersion = metadata.optString("schemaVersion")
        if (schemaVersion != REQUIRED_SCHEMA_VERSION) {
            throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing(
                "Private Real UAT snapshot schema is '$schemaVersion' but this build requires " +
                    "'$REQUIRED_SCHEMA_VERSION'. Re-run build_canonical_uat_snapshot.py and re-provision."
            )
        }

        val domains = root.optJSONObject("domains")
            ?: throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Snapshot has no domains block.")

        val countsObj = metadata.optJSONObject("domainCounts") ?: JSONObject()
        val counts = mutableMapOf<String, Int>()
        for (key in countsObj.keys()) counts[key] = countsObj.optInt(key)

        manifest = UatSnapshotManifest(
            schemaVersion = schemaVersion,
            sourceWeddingId = metadata.optString("sourceWeddingId"),
            generatedAt = metadata.optString("generatedAt"),
            contentHashPrefix = metadata.optString("contentHash").take(16),
            domainCounts = counts.toMap()
        )

        // 1. Wedding
        val weddingObj = root.optJSONObject("wedding")
            ?: throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required wedding metadata missing in Private Real UAT snapshot.")
        val weddingId = weddingObj.optString("id")
        val coupleTitle = weddingObj.optString("title")
        val dateStr = weddingObj.optString("date")
        val venueStr = weddingObj.optString("venue")
        val cityStr = weddingObj.optString("venueCity")
        val countryStr = weddingObj.optString("venueCountry")
        val lifecycleStr = weddingObj.optString("lifecycle")

        if (weddingId.isEmpty() || coupleTitle.isEmpty() || dateStr.isEmpty() || venueStr.isEmpty() ||
            cityStr.isEmpty() || countryStr.isEmpty() || lifecycleStr.isEmpty()
        ) {
            throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required wedding fields missing in Private Real UAT snapshot.")
        }
        weddingSlug = weddingObj.optString("slug").ifEmpty { "charity-and-kudzie" }

        // 2. Programme
        val progArray = domains.optJSONArray("programme") ?: org.json.JSONArray()
        val progItems = mutableListOf<ProgrammeItem>()
        for (i in 0 until progArray.length()) {
            val item = progArray.getJSONObject(i)
            val id = item.optString("id")
            val title = item.optString("title")
            val time = item.optString("time")
            if (id.isEmpty() || title.isEmpty()) continue
            progItems.add(
                ProgrammeItem(
                    id = id,
                    title = title,
                    time = time,
                    location = if (item.isNull("location")) venueStr else item.optString("location", venueStr),
                    description = if (item.isNull("description")) "" else item.optString("description", "")
                )
            )
        }
        progItems.sortBy { it.time }

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

        // 3. Tasks
        val taskArray = domains.optJSONArray("tasks") ?: org.json.JSONArray()
        tasks = mutableListOf()
        for (i in 0 until taskArray.length()) {
            val item = taskArray.getJSONObject(i)
            val id = item.optString("id")
            val title = item.optString("title")
            if (id.isEmpty() || title.isEmpty()) continue
            val status = when (item.optString("status").lowercase()) {
                "done", "completed" -> TaskStatus.DONE
                "in_progress", "inprogress" -> TaskStatus.IN_PROGRESS
                "blocked" -> TaskStatus.BLOCKED
                else -> TaskStatus.TODO
            }
            val priority = when (item.optString("priority").lowercase()) {
                "high", "urgent" -> TaskPriority.HIGH
                "low" -> TaskPriority.LOW
                else -> TaskPriority.MEDIUM
            }
            tasks.add(
                PlannerTask(
                    id = id,
                    title = title,
                    status = status,
                    priority = priority,
                    category = item.optString("category").ifEmpty { "General" },
                    dueDate = if (item.isNull("dueDate")) null else item.optString("dueDate"),
                    description = item.optStringOrNull("description"),
                    assignee = item.optStringOrNull("assignee")
                )
            )
        }

        // 4. Seating tables
        val tablesArray = domains.optJSONArray("seatingTables") ?: org.json.JSONArray()
        val tableMap = mutableMapOf<String, String>()
        for (i in 0 until tablesArray.length()) {
            val t = tablesArray.getJSONObject(i)
            tableMap[t.optString("id")] = t.optString("name")
        }

        // 5. RSVP graph, keyed by guest. Every production guest has exactly one RSVP row; the
        // detail here (meal, dietary, plus-one, kids, song request, message) is what the old flat
        // snapshot discarded entirely.
        val rsvpArray = domains.optJSONArray("rsvps") ?: org.json.JSONArray()
        val rsvpByGuest = mutableMapOf<String, GuestRsvpDetail>()
        for (i in 0 until rsvpArray.length()) {
            val r = rsvpArray.getJSONObject(i)
            val guestId = r.optString("guestId")
            if (guestId.isEmpty()) continue
            rsvpByGuest[guestId] = GuestRsvpDetail(
                id = r.optString("id"),
                guestId = guestId,
                attending = if (r.isNull("attending")) null else r.optBoolean("attending"),
                mealChoice = r.optStringOrNull("mealChoice"),
                plusOne = r.optBoolean("plusOne", false),
                plusOneName = r.optStringOrNull("plusOneName"),
                plusOneMeal = r.optStringOrNull("plusOneMeal"),
                kidsAttending = r.optBoolean("kidsAttending", false),
                kidsCount = r.optInt("kidsCount", 0),
                songRequests = r.optStringOrNull("songRequests"),
                dietaryNotes = r.optStringOrNull("dietaryNotes"),
                message = r.optStringOrNull("message"),
                checkedIn = r.optBoolean("checkedIn", false),
                checkedInAt = r.optStringOrNull("checkedInAt")
            )
        }
        rsvpDetails = rsvpByGuest

        // 6. Guests
        val guestArray = domains.optJSONArray("guests")
            ?: throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required guests list missing in Private Real UAT snapshot.")
        guests = mutableListOf()
        val contacts = mutableMapOf<String, GuestContactDetail>()
        for (i in 0 until guestArray.length()) {
            val item = guestArray.getJSONObject(i)
            val id = item.optString("id")
            val name = item.optString("name")
            if (id.isEmpty() || name.isEmpty()) {
                throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required guest fields missing in Private Real UAT snapshot.")
            }
            val rsvpRow = rsvpByGuest[id]
            val rsvp = when (rsvpRow?.attending) {
                true -> RSVPStatus.ATTENDING
                false -> RSVPStatus.DECLINED
                null -> RSVPStatus.PENDING
            }
            // Production records no partySize column; the real party size is the guest plus their
            // confirmed plus-one and children. That is DERIVED, not invented.
            val partySize = 1 +
                (if (rsvpRow?.plusOne == true) 1 else 0) +
                (rsvpRow?.kidsCount ?: 0)
            val checkedIn = rsvpRow?.checkedIn == true
            val seatingTableId = item.optStringOrNull("seatingTableId")
            val side = item.optStringOrNull("side")?.replaceFirstChar { it.uppercase() } ?: "Not recorded"

            contacts[id] = GuestContactDetail(
                guestId = id,
                email = item.optStringOrNull("email"),
                phone = item.optStringOrNull("phone"),
                role = item.optStringOrNull("role"),
                roleDetail = item.optStringOrNull("roleDetail")
            )

            guests.add(
                Guest(
                    id = id,
                    name = name,
                    householdName = null,
                    partySize = partySize,
                    side = side,
                    rsvpStatus = rsvp,
                    tableNumber = if (item.isNull("tableNumber")) null else item.optInt("tableNumber").takeIf { it > 0 },
                    tableName = seatingTableId?.let { tableMap[it] },
                    checkedIn = checkedIn,
                    checkedInCount = if (checkedIn) partySize else 0,
                    passSerial = if (rsvp == RSVPStatus.ATTENDING) "SHDW" + id.uppercase().takeLast(8) else null
                )
            )
        }
        guestContacts = contacts

        // 7. Budget
        val budgetArray = domains.optJSONArray("budgetItems") ?: org.json.JSONArray()
        val catAllocated = mutableMapOf<String, Double>()
        val catSpent = mutableMapOf<String, Double>()
        var totalEst = 0.0
        var totalAct = 0.0
        var totalPd = 0.0
        for (i in 0 until budgetArray.length()) {
            val b = budgetArray.getJSONObject(i)
            val cat = b.optString("category").ifEmpty { "Uncategorised" }
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
        budget = BudgetSummary(
            currency = "USD",
            totalBudget = totalEst,
            totalAllocated = totalAct,
            totalPaid = totalPd,
            categories = catAllocated.keys.sorted().map {
                BudgetCategory(it, catAllocated[it] ?: 0.0, catSpent[it] ?: 0.0)
            }
        )

        // 8. Vendors
        val vendorsArray = domains.optJSONArray("vendors") ?: org.json.JSONArray()
        vendors = mutableListOf()
        for (i in 0 until vendorsArray.length()) {
            val v = vendorsArray.getJSONObject(i)
            val id = v.optString("id")
            val name = v.optString("name")
            if (id.isEmpty() || name.isEmpty()) continue
            vendors.add(
                VendorPresence(
                    id = id,
                    vendorName = name,
                    serviceCategory = v.optString("category").ifEmpty { "Service" }
                        .replaceFirstChar { it.uppercase() },
                    serviceArea = venueStr,
                    state = VendorPresenceState.NOT_RECORDED,
                    expectedTime = "Not recorded"
                )
            )
        }

        // 9. Production-derived domains the old snapshot dropped entirely.
        weddingContent = domains.mapArray("weddingContent") { c ->
            WeddingContentEntry(
                id = c.optString("id"),
                section = c.optString("section"),
                field = c.optString("field"),
                value = c.optString("value"),
                order = c.optInt("order", 0),
                metadata = c.optStringOrNull("metadata")
            )
        }
        contentRevisions = domains.mapArray("contentRevisions") { r ->
            ContentRevisionRecord(
                id = r.optString("id"),
                section = r.optString("section"),
                fieldKey = r.optString("fieldKey"),
                status = r.optString("status").ifEmpty { "draft" },
                publishedAt = r.optStringOrNull("publishedAt"),
                scheduledFor = r.optStringOrNull("scheduledFor"),
                authorId = r.optStringOrNull("authorId"),
                hasPreviousValue = !r.isNull("previousValue")
            )
        }
        songs = domains.mapArray("songs") { s2 ->
            SongEntry(
                id = s2.optString("id"),
                title = s2.optString("title"),
                artist = s2.optStringOrNull("artist"),
                phase = s2.optStringOrNull("phase"),
                moment = s2.optStringOrNull("moment"),
                order = s2.optInt("order", 0),
                votes = s2.optInt("votes", 0),
                notes = s2.optStringOrNull("notes"),
                playedAt = s2.optStringOrNull("playedAt"),
                spotifyUrl = s2.optStringOrNull("spotifyUrl"),
                appleUrl = s2.optStringOrNull("appleUrl")
            )
        }.sortedBy { it.order }
        qrDestinations = domains.mapArray("qrDestinations") { q ->
            QrDestination(
                id = q.optString("id"),
                label = q.optString("label"),
                type = q.optString("type"),
                url = q.optString("url"),
                isActive = q.optBoolean("isActive", true),
                scanCount = q.optInt("scanCount", 0)
            )
        }
        importJobs = domains.mapArray("importJobs") { j ->
            ImportJobRecord(
                id = j.optString("id"),
                moduleKey = j.optString("moduleKey"),
                fileName = j.optStringOrNull("fileName"),
                status = j.optString("status").ifEmpty { "unknown" },
                totalRows = j.optInt("totalRows", 0),
                createdCount = j.optInt("createdCount", 0),
                updatedCount = j.optInt("updatedCount", 0),
                skippedCount = j.optInt("skippedCount", 0),
                errorCount = j.optInt("errorCount", 0),
                performedAt = j.optStringOrNull("createdAt")
            )
        }.sortedByDescending { it.performedAt ?: "" }
        wallMessages = domains.mapArray("messages") { m ->
            WallMessage(
                id = m.optString("id"),
                authorName = m.optStringOrNull("authorName"),
                content = m.optString("content"),
                type = m.optString("type").ifEmpty { "wall" },
                isPublic = m.optBoolean("isPublic", false),
                revealedAt = m.optStringOrNull("revealedAt"),
                createdAt = m.optStringOrNull("createdAt")
            )
        }
        engagementParties = domains.mapArray("engagementParties") { e ->
            EngagementPartyRecord(
                id = e.optString("id"),
                serviceEngagementId = e.optString("serviceEngagementId"),
                partyKind = e.optString("partyKind"),
                partyRole = e.optString("partyRole"),
                displayName = e.optString("displayName"),
                legalName = e.optStringOrNull("legalName"),
                email = e.optStringOrNull("email"),
                phone = e.optStringOrNull("phone"),
                authorityBasis = e.optStringOrNull("authorityBasis"),
                status = e.optStringOrNull("status"),
                requiredForReview = e.optBoolean("requiredForReview", false)
            )
        }
        auditEvents = domains.mapArray("auditEvents") { a ->
            AuditEventRecord(
                id = a.optString("id"),
                action = a.optString("action"),
                actorId = a.optStringOrNull("actorId"),
                resourceType = a.optStringOrNull("resourceType"),
                resourceId = a.optStringOrNull("resourceId"),
                createdAt = a.optStringOrNull("createdAt")
            )
        }.sortedByDescending { it.createdAt ?: "" }

        // 10. Planner and Admin context, carried as facts rather than inferred at the UI.
        val plannerObj = root.optJSONObject("plannerContext")
        plannerAccess = plannerObj?.let { pc ->
            val profile = pc.optJSONObject("profile")
            PlannerAccessContext(
                businessName = profile?.optStringOrNull("displayName"),
                profileStatus = profile?.optStringOrNull("status"),
                teamSize = profile?.optInt("teamSize")?.takeIf { it > 0 },
                completedWeddings = profile?.optInt("completedWeddings")?.takeIf { it >= 0 },
                enquiryStatus = pc.optJSONObject("enquiry")?.optStringOrNull("status"),
                productionEngagementCount = pc.optInt("productionEngagementCount", 0),
                productionMembershipCount = pc.optInt("productionMembershipCount", 0),
                accessBasis = if (pc.optString("accessBasis") == "PRODUCTION_ENGAGEMENT") {
                    DataProvenance.PRODUCTION_DERIVED
                } else {
                    DataProvenance.UAT_OVERLAY
                }
            )
        }

        val adminObj = root.optJSONObject("adminContext")
        adminAccess = adminObj?.let { ac ->
            AdminAccessContext(
                status = ac.optString("status"),
                deniedDomains = ac.optJSONArray("deniedDomains").toStringList(),
                emptyDomains = ac.optJSONArray("emptyDomains").toStringList(),
                note = ac.optString("note")
            )
        }

        announcements = mutableListOf()

        // Freeze the production-derived truth. Everything after this point is overlay.
        baseTasks = tasks.toList()
        baseGuests = guests.toList()
        baseVendors = vendors.toList()
    }

    override suspend fun getWedding(weddingId: String): Wedding = mutex.withLock {
        requireScope(weddingId)
        wedding }
    override suspend fun getTasks(weddingId: String): List<PlannerTask> = mutex.withLock {
        requireScope(weddingId)
        tasks.toList() }
    override suspend fun getGuests(weddingId: String): List<Guest> = mutex.withLock {
        requireScope(weddingId)
        guests.toList() }
    override suspend fun getBudget(weddingId: String): BudgetSummary = mutex.withLock {
        requireScope(weddingId)
        budget }
    override suspend fun getAuditRecords(weddingId: String): List<CheckInAuditRecord> = mutex.withLock {
        requireScope(weddingId)
        auditRecords.toList() }
    override suspend fun getVendors(weddingId: String): List<VendorPresence> = mutex.withLock {
        requireScope(weddingId)
        vendors.toList() }
    override suspend fun getAnnouncements(weddingId: String): List<WeddingAnnouncement> = mutex.withLock {
        requireScope(weddingId)
        announcements.toList() }

    override suspend fun createTask(weddingId: String, title: String, priority: TaskPriority, category: String): PlannerTask = mutex.withLock {
        requireScope(weddingId)
        val task = PlannerTask(
            id = "real_task_${UUID.randomUUID().toString().take(8)}",
            title = title,
            status = TaskStatus.TODO,
            priority = priority,
            category = category,
            dueDate = null
        )
        tasks.add(task)
        mutations.recordTaskCreated(task.id)
        task
    }

    override suspend fun toggleTask(weddingId: String, taskId: String): PlannerTask = mutex.withLock {
        requireScope(weddingId)
        val index = tasks.indexOfFirst { it.id == taskId }
        if (index == -1) throw NoSuchElementException("Task not found")
        val current = tasks[index]
        val updated = current.copy(status = if (current.status == TaskStatus.DONE) TaskStatus.TODO else TaskStatus.DONE)
        tasks[index] = updated
        mutations.recordTaskStatus(updated.id, updated.status.value)
        updated
    }

    override suspend fun getWeddingPass(token: String): WeddingPass = mutex.withLock {
        val guest = guestForToken(token)
        if (guest.rsvpStatus != RSVPStatus.ATTENDING) {
            throw IllegalStateException("Wedding Pass is available only to attending guests in Private Real Shadow.")
        }
        makePass(guest)
    }

    override suspend fun searchGuests(weddingId: String, query: String): List<Guest> = mutex.withLock {
        requireScope(weddingId)
        val normalized = query.trim().lowercase()
        if (normalized.isEmpty()) guests.toList()
        else guests.filter {
            it.name.lowercase().contains(normalized) ||
                (it.householdName?.lowercase()?.contains(normalized) == true) ||
                (it.tableName?.lowercase()?.contains(normalized) == true)
        }
    }

    override suspend fun checkInGuest(weddingId: String, qrPayload: String, count: Int, usherId: String): CheckInVerificationResult = mutex.withLock {
        requireScope(weddingId)
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
        mutations.recordCheckIn(guest.id, count)

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

    override suspend fun updateVendorState(weddingId: String, id: String, state: VendorPresenceState): VendorPresence = mutex.withLock {
        requireScope(weddingId)
        val index = vendors.indexOfFirst { it.id == id }
        if (index == -1) throw NoSuchElementException("Vendor not found")
        val updated = vendors[index].copy(state = state, lastUpdatedMillis = System.currentTimeMillis())
        vendors[index] = updated
        mutations.recordVendorState(updated.id, state.name)
        updated
    }

    override suspend fun postAnnouncement(weddingId: String, title: String, message: String, urgency: AnnouncementUrgency): WeddingAnnouncement = mutex.withLock {
        requireScope(weddingId)
        val announcement = WeddingAnnouncement(
            id = "real_ann_${UUID.randomUUID().toString().take(6)}",
            title = title,
            message = message,
            urgency = urgency
        )
        announcements.add(0, announcement)
        mutations.recordAnnouncement(announcement.id)
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
        mutations.recordRsvp(updated.id, attending)

        if (attending) makePass(updated) else makeNonAdmissionPass(updated)
    }


    override suspend fun resolveGuestIdentity(token: String): GuestIdentity? = mutex.withLock {
        val index = guestIndexForToken(token) ?: return@withLock null
        val guest = guests[index]
        GuestIdentity(
            guestId = guest.id,
            guestName = guest.name,
            weddingId = wedding.id,
            passToken = token
        )
    }

    private fun guestIndexForToken(token: String): Int? {
        if (guests.isEmpty()) return null
        return when {
            token == attendingToken || token == "native-reference-guest" -> guests.indexOfFirst { it.rsvpStatus == RSVPStatus.ATTENDING && it.partySize == 1 }.takeIf { it != -1 } ?: guests.indexOfFirst { it.rsvpStatus == RSVPStatus.ATTENDING }
            token == partyFourToken -> guests.indexOfFirst { it.partySize >= 4 }.takeIf { it != -1 } ?: 0
            token == pendingToken -> guests.indexOfFirst { it.rsvpStatus == RSVPStatus.PENDING }
            token == declinedToken -> guests.indexOfFirst { it.rsvpStatus == RSVPStatus.DECLINED }.takeIf { it != -1 } ?: if (guests.size > 1) 1 else 0
            token.startsWith("real-pass-") -> {
                val id = token.removePrefix("real-pass-")
                guests.indexOfFirst { it.id == id }
            }
            token.startsWith("real-non-admission-") -> {
                val id = token.removePrefix("real-non-admission-")
                guests.indexOfFirst { it.id == id }
            }
            else -> guests.indexOfFirst { it.id == token || it.passSerial == token }
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

    // ---------------------------------------------------------------------------------------
    // Production-derived domains.
    //
    // Each of these was previously reported as "unsupported" because the September snapshot did
    // not carry it. Production did. Role gating is applied by the caller, except where a model
    // exposes an explicitly narrowed projection (see GuestRsvpDetail.operationalOnly()).
    // ---------------------------------------------------------------------------------------

    override suspend fun snapshotManifest(): UatSnapshotManifest = manifest

    override suspend fun getRsvpDetail(weddingId: String, guestId: String): GuestRsvpDetail? = mutex.withLock {
        requireScope(weddingId)
        rsvpDetails[guestId]
    }

    override suspend fun getGuestContact(weddingId: String, guestId: String): GuestContactDetail? = mutex.withLock {
        requireScope(weddingId)
        guestContacts[guestId]
    }

    override suspend fun getWeddingContent(weddingId: String): List<WeddingContentEntry> = mutex.withLock {
        requireScope(weddingId)
        weddingContent
    }

    override suspend fun getContentRevisions(weddingId: String): List<ContentRevisionRecord> = mutex.withLock {
        requireScope(weddingId)
        contentRevisions
    }

    override suspend fun getSongs(weddingId: String): List<SongEntry> = mutex.withLock {
        requireScope(weddingId)
        songs
    }

    override suspend fun getQrDestinations(weddingId: String): List<QrDestination> = mutex.withLock {
        requireScope(weddingId)
        qrDestinations
    }

    override suspend fun getImportJobs(weddingId: String): List<ImportJobRecord> = mutex.withLock {
        requireScope(weddingId)
        importJobs
    }

    override suspend fun getWallMessages(weddingId: String): List<WallMessage> = mutex.withLock {
        requireScope(weddingId)
        wallMessages
    }

    override suspend fun getEngagementParties(weddingId: String): List<EngagementPartyRecord> = mutex.withLock {
        requireScope(weddingId)
        engagementParties
    }

    override suspend fun getAuditEvents(weddingId: String): List<AuditEventRecord> = mutex.withLock {
        requireScope(weddingId)
        auditEvents
    }

    override suspend fun plannerAccessContext(weddingId: String): PlannerAccessContext? = mutex.withLock {
        requireScope(weddingId)
        plannerAccess
    }

    override suspend fun adminAccessContext(): AdminAccessContext? = mutex.withLock { adminAccess }

    override suspend fun weddingSlug(weddingId: String): String? = mutex.withLock {
        requireScope(weddingId)
        weddingSlug.takeIf { it.isNotBlank() }
    }
}


/**
 * JSON helpers for the Private Real UAT snapshot.
 *
 * org.json turns a JSON null into the string "null", which is how "Not recorded" once became a
 * literal four-letter value on screen. These read a JSON null as a Kotlin null.
 */
internal fun JSONObject.optStringOrNull(key: String): String? {
    if (isNull(key)) return null
    val value = optString(key)
    return value.takeIf { it.isNotEmpty() && it != "null" }
}

internal fun org.json.JSONArray?.toStringList(): List<String> {
    if (this == null) return emptyList()
    return (0 until length()).mapNotNull { optString(it).takeIf { s -> s.isNotEmpty() } }
}

internal inline fun <T> JSONObject.mapArray(key: String, transform: (JSONObject) -> T): List<T> {
    val array = optJSONArray(key) ?: return emptyList()
    return (0 until array.length()).mapNotNull { index ->
        array.optJSONObject(index)?.let(transform)
    }
}
