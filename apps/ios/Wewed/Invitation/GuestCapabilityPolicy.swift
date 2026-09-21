import Foundation

/// What an invited Guest may reach. One name per capability, so views ask rather than decide.
public enum GuestCapability: String, CaseIterable, Sendable {
    case home, invitation, rsvp, weddingDetails, venue, coupleWebsite, registry, profile
    /// Attending only: an admission credential is not issued to anyone else.
    case weddingPass, partyDetails, seating, weddingDayProgramme, announcements, checkInState
}

/// What a Guest may do, given what they have answered.
///
/// The rule this encodes is the product rule, and it is easy to get backwards: **the invitation
/// establishes identity; RSVP determines capability.** A guest who has not answered is not a
/// stranger to be turned away — they are an invited guest who has not answered yet, and they may
/// see their wedding, their invitation and their own profile.
///
/// A pure function on purpose. Scattering `attending == true` checks through views is how a
/// declined guest ends up holding an admission credential in one place and not another.
public enum GuestCapabilityPolicy {

    /// Everything an invited Guest may reach regardless of their answer.
    private static let always: Set<GuestCapability> = [
        .home, .invitation, .weddingDetails, .venue, .coupleWebsite, .registry, .profile,
    ]

    /// Everything that follows from actually coming.
    private static let attendingOnly: Set<GuestCapability> = [
        .weddingPass, .partyDetails, .seating, .weddingDayProgramme, .announcements, .checkInState,
    ]

    /// - Parameter attending: nil when the guest has not answered; true attending; false declined.
    public static func capabilities(attending: Bool?) -> Set<GuestCapability> {
        switch attending {
        // Not answered: everything except the pass, plus the question itself.
        case .none: return always.union([.rsvp])
        case .some(true): return always.union(attendingOnly)
        // Declined. They keep their invitation and their profile — they were invited, and that
        // does not stop being true because they cannot come. What they do not get is admission.
        case .some(false): return always
        }
    }

    public static func allows(attending: Bool?, _ capability: GuestCapability) -> Bool {
        capabilities(attending: attending).contains(capability)
    }

    /// Whether the RSVP question should still be asked.
    ///
    /// An answered guest is never asked again, whichever way they answered.
    public static func awaitsResponse(attending: Bool?) -> Bool { attending == nil }
}
