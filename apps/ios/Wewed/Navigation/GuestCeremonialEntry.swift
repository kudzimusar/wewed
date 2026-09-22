import Foundation

/// Where the wedding is in its own life.
public enum WeddingLifecyclePhase: Equatable { case before, weddingDay, after }

/// What the card offers. Which of these appear depends on RSVP state and lifecycle phase.
public enum GuestCardAction: String, Equatable, CaseIterable {
    case rsvpNow = "RSVP Now"
    case viewDetails = "View Details"
    case openMaps = "Maps"
    case viewWeddingSite = "View Wedding Site"
    case viewPass = "View My Wedding Pass"
    case continueToWedding = "Continue to Wedding"
    case changeResponse = "Change My Response"
    case viewOurStory = "Our Story"
    case viewProgramme = "View Programme"
    case viewTable = "My Table"
    case viewGallery = "View Gallery"
    case viewMemories = "Memories"

    public var label: String { rawValue }
}

/// The card's current face: what it says, what it offers, and whether a pass exists behind it.
public struct GuestCardPresentation: Equatable {
    public let headline: String
    public let statusLabel: String?
    public let primaryAction: GuestCardAction
    public let secondaryActions: [GuestCardAction]
    /// Only an attending guest has an admission pass. A declined guest never does.
    public let issuesPass: Bool

    /// True when the card is still asking the guest to answer.
    public var awaitsResponse: Bool { primaryAction == .rsvpNow }

    public func offers(_ action: GuestCardAction) -> Bool {
        primaryAction == action || secondaryActions.contains(action)
    }
}

/// The Guest Entry Contract (master plan §6.2, §6.3).
///
/// The invitation is the Guest's entrance to the wedding — the Couple's recognition of this person
/// — and the explicit arrival is where that ceremony happens:
///
///     private invitation link -> Wewed splash -> the configured Digital Invitation FIRST -> RSVP
///
/// An ordinary return is not a new arrival:
///
///     app icon -> remembered Guest validated -> Guest Home
///
/// and "My Digital Invitation" stays one tap away, reopening the same saved card. Replaying the
/// whole card every time someone checks their table would be tiresome rather than ceremonial.
///
/// This file used to state a different rule — the card at the start of EVERY entry session —
/// which the production Guest shell never implemented; only the Shadow workspace root did. Two
/// contracts meant the Shadow harness qualified behaviour production did not have (master plan
/// §8.3, §8.11). There is now one, and both the production Guest shells and the Shadow root read it
/// from here.
///
/// The card does not disappear once RSVP is answered. What changes is what it ASKS: a guest who has
/// already replied is never asked again, and the same card becomes their reminder, their admission
/// on the day, then a thank-you afterwards.
public enum GuestCeremonialEntry {

    /// Whether a Guest entry opens on the invitation (true) or on Guest Home (false).
    ///
    /// Only an explicit invitation arrival — a private link, a redeemed handoff — opens on the
    /// card. A remembered Guest returning through the app icon opens on Home.
    public static func opensOnInvitation(isExplicitInvitationArrival: Bool) -> Bool {
        isExplicitInvitationArrival
    }

    /// What the card should say, given what the guest has already answered and where the wedding
    /// is in its own life.
    public static func presentation(
        rsvp: RSVPStatus,
        lifecycle: WeddingLifecyclePhase
    ) -> GuestCardPresentation {
        switch lifecycle {
        // After the wedding the card stops being an invitation at all. Leaving it reading
        // "RSVP Confirmed" would suggest an event that has not happened yet.
        case .after:
            return GuestCardPresentation(
                headline: "Thank you for celebrating with us",
                statusLabel: nil,
                primaryAction: .viewGallery,
                secondaryActions: [.viewWeddingSite, .viewMemories],
                issuesPass: false
            )

        case .weddingDay:
            switch rsvp {
            // On the day an attending guest needs their pass, the room and the running order —
            // the card becomes operational without ceasing to be the card.
            case .attending:
                return GuestCardPresentation(
                    headline: "Today",
                    statusLabel: "You're expected today",
                    primaryAction: .viewPass,
                    secondaryActions: [.openMaps, .viewProgramme, .viewTable],
                    issuesPass: true
                )
            case .declined:
                return GuestCardPresentation(
                    headline: "Today",
                    statusLabel: "Response recorded — not attending",
                    primaryAction: .viewWeddingSite,
                    secondaryActions: [.viewOurStory],
                    issuesPass: false
                )
            case .pending:
                return GuestCardPresentation(
                    headline: "Today",
                    statusLabel: "We haven't heard from you yet",
                    primaryAction: .rsvpNow,
                    secondaryActions: [.openMaps, .viewDetails],
                    issuesPass: false
                )
            }

        case .before:
            switch rsvp {
            // Already answered: never ask twice. The card becomes the reminder and the way in.
            case .attending:
                return GuestCardPresentation(
                    headline: "You're going",
                    statusLabel: "RSVP confirmed",
                    primaryAction: .viewPass,
                    secondaryActions: [.continueToWedding, .viewWeddingSite],
                    issuesPass: true
                )
            // A declined guest is still a guest. They keep the wedding's public content, and may
            // change their mind where the couple allows it — but never an admission pass.
            case .declined:
                return GuestCardPresentation(
                    headline: "Response recorded",
                    statusLabel: "Not attending",
                    primaryAction: .viewWeddingSite,
                    secondaryActions: [.viewOurStory, .changeResponse],
                    issuesPass: false
                )
            case .pending:
                return GuestCardPresentation(
                    headline: "You're invited",
                    statusLabel: nil,
                    primaryAction: .rsvpNow,
                    secondaryActions: [.viewDetails, .openMaps, .viewWeddingSite],
                    issuesPass: false
                )
            }
        }
    }

    /// A human count of the time remaining, for the card's reminder line.
    ///
    /// Derived from the wedding date rather than written anywhere, so it stays true without anyone
    /// maintaining it.
    public static func countdownLabel(daysRemaining: Int) -> String {
        switch daysRemaining {
        case let d where d > 7: return "\(d) days to go"
        case 2...7: return "This week"
        case 1: return "Tomorrow"
        case 0: return "Today"
        default: return "Thank you for celebrating with us"
        }
    }

    /// Where the wedding is in its own life, derived from its date.
    public static func phase(daysRemaining: Int) -> WeddingLifecyclePhase {
        if daysRemaining > 0 { return .before }
        if daysRemaining == 0 { return .weddingDay }
        return .after
    }
}
