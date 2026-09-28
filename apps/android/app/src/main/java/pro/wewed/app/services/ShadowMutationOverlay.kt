package pro.wewed.app.services

import pro.wewed.app.models.DataProvenance

/**
 * Local UAT mutations, kept separate from the production-derived snapshot they sit on top of.
 *
 * The repositories used to mutate their loaded rows in place. Once a UAT operator toggled a task or
 * checked a guest in, the snapshot in memory no longer matched the production export it came from,
 * and nothing could tell which rows had been changed here and which were production facts. Reset
 * meant reloading the file, and comparing a UAT session against production truth was impossible.
 *
 *     base production-derived snapshot
 *       + local UAT mutation overlay
 *       = current UAT view
 *
 * The base is never written to. That makes the view reproducible (reset clears the overlay), makes
 * provenance answerable per record, and makes it structurally impossible for a UAT mutation to be
 * mistaken for a production fact.
 *
 * No mutation recorded here ever flows back to production. There is no write path.
 */
class ShadowMutationOverlay {

    /** Task ids whose status was changed locally, with the status now shown. */
    private val taskStatus = mutableMapOf<String, String>()

    /** Tasks created during this UAT session. These exist only in the overlay. */
    private val createdTaskIds = mutableSetOf<String>()

    /** Guest ids whose RSVP was changed locally, with the attendance now shown. */
    private val rsvpAttendance = mutableMapOf<String, Boolean>()

    /** Guest ids checked in locally, with the number of people admitted. */
    private val checkedIn = mutableMapOf<String, Int>()

    /** Vendor ids whose operational state was changed locally. */
    private val vendorState = mutableMapOf<String, String>()

    /** Announcements posted locally. */
    private val postedAnnouncementIds = mutableSetOf<String>()

    fun recordTaskStatus(taskId: String, status: String) {
        taskStatus[taskId] = status
    }

    fun recordTaskCreated(taskId: String) {
        createdTaskIds += taskId
    }

    fun recordRsvp(guestId: String, attending: Boolean) {
        rsvpAttendance[guestId] = attending
    }

    fun recordCheckIn(guestId: String, admitted: Int) {
        checkedIn[guestId] = (checkedIn[guestId] ?: 0) + admitted
    }

    fun recordVendorState(vendorId: String, state: String) {
        vendorState[vendorId] = state
    }

    fun recordAnnouncement(announcementId: String) {
        postedAnnouncementIds += announcementId
    }

    fun taskStatusFor(taskId: String): String? = taskStatus[taskId]
    fun rsvpFor(guestId: String): Boolean? = rsvpAttendance[guestId]
    fun checkedInFor(guestId: String): Int? = checkedIn[guestId]
    fun vendorStateFor(vendorId: String): String? = vendorState[vendorId]

    /**
     * Where a record's current value came from.
     *
     * A record the overlay has touched is a SHADOW_MUTATION; everything else is still exactly what
     * the authorized production read produced.
     */
    fun provenanceForTask(taskId: String): DataProvenance = when {
        taskId in createdTaskIds -> DataProvenance.SHADOW_MUTATION
        taskId in taskStatus -> DataProvenance.SHADOW_MUTATION
        else -> DataProvenance.PRODUCTION_DERIVED
    }

    fun provenanceForGuest(guestId: String): DataProvenance =
        if (guestId in rsvpAttendance || guestId in checkedIn) {
            DataProvenance.SHADOW_MUTATION
        } else {
            DataProvenance.PRODUCTION_DERIVED
        }

    fun provenanceForVendor(vendorId: String): DataProvenance =
        if (vendorId in vendorState) DataProvenance.SHADOW_MUTATION else DataProvenance.PRODUCTION_DERIVED

    /** Total records this UAT session has changed. Zero means the view equals the snapshot. */
    val mutationCount: Int
        get() = taskStatus.size + createdTaskIds.size + rsvpAttendance.size +
            checkedIn.size + vendorState.size + postedAnnouncementIds.size

    /** True when nothing has been changed locally, so the view is the production-derived truth. */
    val isPristine: Boolean get() = mutationCount == 0

    /** A short summary of what this session changed. Counts only; no private values. */
    fun summary(): Map<String, Int> = mapOf(
        "taskStatus" to taskStatus.size,
        "tasksCreated" to createdTaskIds.size,
        "rsvpChanged" to rsvpAttendance.size,
        "checkedIn" to checkedIn.size,
        "vendorState" to vendorState.size,
        "announcementsPosted" to postedAnnouncementIds.size
    ).filterValues { it > 0 }

    /** Discards every local change, returning the view to the production-derived snapshot. */
    fun reset() {
        taskStatus.clear()
        createdTaskIds.clear()
        rsvpAttendance.clear()
        checkedIn.clear()
        vendorState.clear()
        postedAnnouncementIds.clear()
    }
}
