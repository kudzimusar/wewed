import Foundation

/// What an invited Guest may reach. One name per capability, so views ask rather than decide.
public enum GuestCapability: String, CaseIterable, Sendable {
    case home, invitation, rsvp, weddingDetails, venue, coupleWebsite, registry, profile
    /// Attending only: an admission credential is not issued to anyone else.
    case weddingPass, partyDetails, seating, weddingDayProgramme, announcements, checkInState
}

/// What a Guest may do, given what they have answered.
///
/// The invitation establishes identity; RSVP completion gates the persistent Guest experience.
/// A pending Guest remains inside the invitation ceremony and its wedding-authorized actions.
/// Attending and declined Guests may both enter the persistent shell; only attending Guests gain
/// admission and Wedding Day capabilities.
///
/// A pure function on purpose. Scattering `attending == true` checks through views is how a
/// declined guest ends up holding an admission credential in one place and not another.
public enum GuestCapabilityPolicy {

    /// Invitation-side actions available before an RSVP answer exists.
    private static let invitationOnly: Set<GuestCapability> = [
        .invitation, .weddingDetails, .venue, .coupleWebsite, .registry,
    ]

    /// Persistent Guest application capabilities shared by attending and declined Guests.
    private static let persistent: Set<GuestCapability> = [
        .home, .invitation, .weddingDetails, .venue, .coupleWebsite, .registry, .profile,
    ]

    /// Everything that follows from actually coming.
    private static let attendingOnly: Set<GuestCapability> = [
        .weddingPass, .partyDetails, .seating, .weddingDayProgramme, .announcements, .checkInState,
    ]

    /// - Parameter attending: nil when the guest has not answered; true attending; false declined.
    public static func capabilities(attending: Bool?) -> Set<GuestCapability> {
        switch attending {
        // Pending: invitation ceremony only. No Home/Profile shell before RSVP completion.
        case .none: return invitationOnly.union([.rsvp])
        case .some(true): return persistent.union(attendingOnly)
        // Declined Guests remain invited and may enter their Guest application, but never admission.
        case .some(false): return persistent
        }
    }

    public static func allows(attending: Bool?, _ capability: GuestCapability) -> Bool {
        capabilities(attending: attending).contains(capability)
    }

    /// The navigation/state-machine gate; views must not substitute tab hiding for this rule.
    public static func mayEnterPersistentExperience(attending: Bool?) -> Bool {
        attending != nil
    }

    /// Whether the RSVP question should still be asked.
    ///
    /// An answered guest is never asked again, whichever way they answered.
    public static func awaitsResponse(attending: Bool?) -> Bool { attending == nil }
}
