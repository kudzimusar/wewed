package pro.wewed.app.services

import org.json.JSONObject
import pro.wewed.app.models.*

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8.
 *
 * Real production adapter for a single, already-authorized, wedding-scoped grant (Couple, Planner,
 * or Coordinator — the permission difference between them is enforced server-side by the grant's
 * own permissions, never branched on here). Every read/write calls `/api/native/wedding/...`, which
 * re-resolves the grant fresh on every request — this class caches nothing across calls beyond the
 * `grantId`/`weddingId` it was constructed for.
 *
 * Deliberately fail-closed for every method that belongs to Wedding Day / Usher-Gate operational
 * authority (master plan §19; Phase 10/11): [resolveGuestIdentity], [checkInGuest],
 * [updateVendorState], [postAnnouncement], [getWeddingPass], [resolveInvitation], [confirmRsvp].
 * Those are unrelated to this phase's mature planning domains and must never silently start
 * working just because a wedding-scoped grant now renders through the real role shell.
 *
 * [getVendors]/[getAnnouncements]/[getAuditRecords] are also Wedding-Day concepts (vendor
 * presence/arrival tracking, live announcements, check-in audit — not the planning-side Vendor
 * list, which is [ProductionPlannerDashboardRepository.getVendorEngagements]). They are required,
 * no-default `WeddingRepository` methods that `rememberWeddingGraph` calls unconditionally inside
 * one un-caught try/catch shared with Tasks/Budget/Guests — throwing here would take down the
 * domains this phase DID wire, not just these. Returning an honest empty list is the same idiom
 * this interface already documents for "a source that holds none of this" (see its own KDoc).
 */
class ProductionWeddingRepository(
    private val client: NativeDomainApiClient,
    private val sessionToken: String,
    private val grantId: String,
    private val weddingId: String,
) : WeddingRepository {

    private fun denied(): Nothing = throw ProductionReadOnlyDomainUnavailable()

    override suspend fun availableWeddingIds(): List<String> = listOf(weddingId)

    override suspend fun resolveGuestIdentity(token: String): pro.wewed.app.services.GuestIdentity? = denied()

    override suspend fun getWedding(weddingId: String): Wedding {
        val overview = when (val fetch = client.overview(sessionToken, grantId)) {
            is NativeDomainFetch.Success -> fetch.value
            else -> throw ProductionReadOnlyDomainUnavailable()
        }
        val wedding = overview.optJSONObject("wedding") ?: throw ProductionReadOnlyDomainUnavailable()
        val programme = when (val fetch = client.timeline(sessionToken, grantId)) {
            is NativeDomainFetch.Success -> fetch.value.toObjectList().map { it.toProgrammeItem() }
            else -> throw ProductionReadOnlyDomainUnavailable()
        }
        return Wedding(
            id = wedding.getString("id"),
            coupleNames = wedding.optString("coupleNames"),
            date = wedding.optString("date"),
            venueName = wedding.optString("venue"),
            venueAddress = "",
            city = "",
            country = "",
            lifecycle = wedding.optString("lifecycle"),
            programme = programme,
        )
    }

    override suspend fun getTasks(weddingId: String): List<PlannerTask> =
        when (val fetch = client.tasks(sessionToken, grantId)) {
            is NativeDomainFetch.Success -> fetch.value.toObjectList().map { it.toPlannerTask() }
            else -> throw ProductionReadOnlyDomainUnavailable()
        }

    override suspend fun createTask(weddingId: String, title: String, priority: TaskPriority, category: String): PlannerTask {
        val body = JSONObject().put("title", title).put("priority", priority.value).put("category", category)
        return when (val fetch = client.createTask(sessionToken, grantId, body)) {
            is NativeDomainFetch.Success -> fetch.value.toPlannerTask()
            else -> throw ProductionReadOnlyDomainUnavailable()
        }
    }

    override suspend fun toggleTask(weddingId: String, taskId: String): PlannerTask {
        // Mirrors the PWA/native protocol's own toggle semantics (done <-> todo); the server is the
        // one source of truth for the CURRENT status, so this reads it fresh rather than assuming.
        val current = getTasks(weddingId).firstOrNull { it.id == taskId }
            ?: throw NoSuchElementException("Task not found")
        val nextStatus = if (current.status == TaskStatus.DONE) TaskStatus.TODO else TaskStatus.DONE
        val body = JSONObject().put("status", nextStatus.value)
        return when (val fetch = client.updateTask(sessionToken, grantId, taskId, body)) {
            is NativeDomainFetch.Success -> fetch.value.toPlannerTask()
            else -> throw ProductionReadOnlyDomainUnavailable()
        }
    }

    override suspend fun getGuests(weddingId: String): List<Guest> =
        when (val fetch = client.guests(sessionToken, grantId)) {
            is NativeDomainFetch.Success -> fetch.value.toObjectList().map { it.toGuest() }
            else -> throw ProductionReadOnlyDomainUnavailable()
        }

    override suspend fun getBudget(weddingId: String): BudgetSummary {
        val root = when (val fetch = client.budget(sessionToken, grantId)) {
            is NativeDomainFetch.Success -> fetch.value
            else -> throw ProductionReadOnlyDomainUnavailable()
        }
        val totals = root.optJSONObject("totals") ?: JSONObject()
        val categories = totals.optJSONArray("categories")?.toObjectList().orEmpty().map {
            BudgetCategory(name = it.optString("category"), allocated = it.optDouble("estimated", 0.0), spent = it.optDouble("actual", 0.0))
        }
        return BudgetSummary(
            currency = totals.optString("currency", "USD"),
            totalBudget = totals.optDouble("totalEstimated", 0.0),
            totalAllocated = totals.optDouble("totalEstimated", 0.0),
            totalPaid = totals.optDouble("totalPaid", 0.0),
            categories = categories,
        )
    }

    override suspend fun searchGuests(weddingId: String, query: String): List<Guest> =
        when (val fetch = client.guests(sessionToken, grantId, query)) {
            is NativeDomainFetch.Success -> fetch.value.toObjectList().map { it.toGuest() }
            else -> throw ProductionReadOnlyDomainUnavailable()
        }

    override suspend fun checkInGuest(weddingId: String, qrPayload: String, count: Int, usherId: String) = denied()
    override suspend fun getAuditRecords(weddingId: String) = emptyList<CheckInAuditRecord>()
    override suspend fun getVendors(weddingId: String) = emptyList<pro.wewed.app.models.VendorPresence>()
    override suspend fun updateVendorState(weddingId: String, id: String, state: pro.wewed.app.models.VendorPresenceState) = denied()
    override suspend fun getAnnouncements(weddingId: String) = emptyList<pro.wewed.app.models.WeddingAnnouncement>()
    override suspend fun postAnnouncement(weddingId: String, title: String, message: String, urgency: pro.wewed.app.models.AnnouncementUrgency) = denied()
    override suspend fun getWeddingPass(token: String) = denied()
    override suspend fun resolveInvitation(weddingSlug: String, token: String) = denied()
    override suspend fun confirmRsvp(weddingSlug: String, token: String, attending: Boolean) = denied()
}

private fun JSONObject.toPlannerTask(): PlannerTask = PlannerTask(
    id = getString("id"),
    title = getString("title"),
    status = TaskStatus.fromValue(optString("status", "todo")),
    priority = TaskPriority.fromValue(optString("priority", "medium")),
    category = optString("category", "other"),
    dueDate = optString("dueDate").takeIf { !isNull("dueDate") && it.isNotBlank() },
    description = optString("description").takeIf { !isNull("description") && it.isNotBlank() },
    assignee = optString("assignee").takeIf { !isNull("assignee") && it.isNotBlank() },
)

private fun JSONObject.toGuest(): Guest = Guest(
    id = getString("id"),
    name = getString("name"),
    householdName = null,
    partySize = 1,
    side = optString("side").takeIf { !isNull("side") && it.isNotBlank() },
    rsvpStatus = RSVPStatus.fromValue(optString("rsvpStatus", "pending")),
    tableNumber = if (has("tableNumber") && !isNull("tableNumber")) optInt("tableNumber") else null,
    tableName = optString("tableName").takeIf { !isNull("tableName") && it.isNotBlank() },
    checkedIn = optBoolean("checkedIn", false),
    checkedInCount = 0,
    passSerial = null,
)

private fun JSONObject.toProgrammeItem(): ProgrammeItem = ProgrammeItem(
    id = getString("id"),
    title = getString("title"),
    time = optString("time"),
    location = optString("location").takeIf { !isNull("location") } ?: "",
    description = optString("description").takeIf { !isNull("description") } ?: "",
)
