import Foundation

/// Local UAT mutations, kept separate from the production-derived snapshot they sit on top of.
///
/// The repositories used to mutate their loaded rows in place. Once a UAT operator toggled a task
/// or checked a guest in, the snapshot in memory no longer matched the production export it came
/// from, and nothing could tell which rows had been changed here and which were production facts.
/// Reset meant reloading the file, and comparing a UAT session against production truth was
/// impossible.
///
///     base production-derived snapshot
///       + local UAT mutation overlay
///       = current UAT view
///
/// The base is never written to. That makes the view reproducible (reset clears the overlay), makes
/// provenance answerable per record, and makes it structurally impossible for a UAT mutation to be
/// mistaken for a production fact.
///
/// No mutation recorded here ever flows back to production. There is no write path.
public final class ShadowMutationOverlay: @unchecked Sendable {

    /// Task ids whose status was changed locally, with the status now shown.
    private var taskStatus: [String: String] = [:]
    /// Tasks created during this UAT session. These exist only in the overlay.
    private var createdTaskIds: Set<String> = []
    /// Guest ids whose RSVP was changed locally, with the attendance now shown.
    private var rsvpAttendance: [String: Bool] = [:]
    /// Guest ids checked in locally, with the number of people admitted.
    private var checkedIn: [String: Int] = [:]
    /// Vendor ids whose operational state was changed locally.
    private var vendorState: [String: String] = [:]
    /// Announcements posted locally.
    private var postedAnnouncementIds: Set<String> = []

    public init() {}

    public func recordTaskStatus(_ taskId: String, status: String) { taskStatus[taskId] = status }
    public func recordTaskCreated(_ taskId: String) { createdTaskIds.insert(taskId) }
    public func recordRsvp(_ guestId: String, attending: Bool) { rsvpAttendance[guestId] = attending }
    public func recordCheckIn(_ guestId: String, admitted: Int) {
        checkedIn[guestId] = (checkedIn[guestId] ?? 0) + admitted
    }
    public func recordVendorState(_ vendorId: String, state: String) { vendorState[vendorId] = state }
    public func recordAnnouncement(_ announcementId: String) { postedAnnouncementIds.insert(announcementId) }

    public func taskStatusFor(_ taskId: String) -> String? { taskStatus[taskId] }
    public func rsvpFor(_ guestId: String) -> Bool? { rsvpAttendance[guestId] }
    public func checkedInFor(_ guestId: String) -> Int? { checkedIn[guestId] }
    public func vendorStateFor(_ vendorId: String) -> String? { vendorState[vendorId] }

    /// Where a record's current value came from.
    ///
    /// A record the overlay has touched is a `.shadowMutation`; everything else is still exactly
    /// what the authorized production read produced.
    public func provenanceForTask(_ taskId: String) -> DataProvenance {
        (createdTaskIds.contains(taskId) || taskStatus[taskId] != nil) ? .shadowMutation : .productionDerived
    }

    public func provenanceForGuest(_ guestId: String) -> DataProvenance {
        (rsvpAttendance[guestId] != nil || checkedIn[guestId] != nil) ? .shadowMutation : .productionDerived
    }

    public func provenanceForVendor(_ vendorId: String) -> DataProvenance {
        vendorState[vendorId] != nil ? .shadowMutation : .productionDerived
    }

    /// Total records this UAT session has changed. Zero means the view equals the snapshot.
    public var mutationCount: Int {
        taskStatus.count + createdTaskIds.count + rsvpAttendance.count
            + checkedIn.count + vendorState.count + postedAnnouncementIds.count
    }

    /// True when nothing has been changed locally, so the view is the production-derived truth.
    public var isPristine: Bool { mutationCount == 0 }

    /// A short summary of what this session changed. Counts only; no private values.
    public func summary() -> [String: Int] {
        [
            "taskStatus": taskStatus.count,
            "tasksCreated": createdTaskIds.count,
            "rsvpChanged": rsvpAttendance.count,
            "checkedIn": checkedIn.count,
            "vendorState": vendorState.count,
            "announcementsPosted": postedAnnouncementIds.count
        ].filter { $0.value > 0 }
    }

    /// Discards every local change, returning the view to the production-derived snapshot.
    public func reset() {
        taskStatus.removeAll()
        createdTaskIds.removeAll()
        rsvpAttendance.removeAll()
        checkedIn.removeAll()
        vendorState.removeAll()
        postedAnnouncementIds.removeAll()
    }
}
