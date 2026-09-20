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

/// The outcome of opening an invitation while another guest is active.
public enum GuestReplacement: Equatable {
    /// The incoming guest becomes active. Everything belonging to the previous one is dropped.
    case activate(InvitationContext)
    /// The incoming claim is invalid. The previous guest is cleared and never restored.
    case rejectAndClear
}

/// The Guest Ceremonial Entry Contract.
///
/// The invitation was being treated as an onboarding page: shown once, answered, then discarded.
/// That is wrong about what the card *is*. The Couple recognised this person; the card is that
/// recognition. It is the Guest's entrance to the wedding, and it belongs at the start of every
/// visit — not only the first.
///
/// So for a recognised Guest:
///
///     Wewed launch -> motion splash -> the personalised card -> the Guest continues from it
///
/// The card does not disappear once RSVP is answered. What changes is what it ASKS. A guest who
/// has already replied is never asked again; the same card becomes their reminder, then their
/// admission on the day, then a thank-you afterwards. One card, one identity, a whole lifecycle.
///
/// This is a release invariant, asserted in tests on both platforms.
public enum GuestCeremonialEntry {

    /// Whether this app-entry session must open with the card.
    ///
    /// "Every time the app opens" means every new ENTRY SESSION — a cold launch, a relaunch after
    /// termination, a fresh deep link, or a restore after process death. It does not mean every
    /// return from the background: interrupting someone with a ceremony every time they glance at
    /// another app would be an irritation, not a welcome.
    public static func shouldPresentCard(
        isRecognisedGuest: Bool,
        entrySessionPresentedCard: Bool
    ) -> Bool {
        isRecognisedGuest && !entrySessionPresentedCard
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

    /// Replacing the active guest.
    ///
    /// Opening Guest B's invitation while Guest A is active must leave nothing of A behind — not
    /// their party, not their table, not their pass, not a half-filled RSVP form. And if B's claim
    /// turns out to be invalid, the app must NOT quietly fall back to A: showing one person
    /// another person's invitation is the worst outcome available here.
    public static func replaceActiveGuest(
        current: InvitationContext?,
        incoming: InvitationContext?
    ) -> GuestReplacement {
        if let incoming { return .activate(incoming) }
        return .rejectAndClear
    }
}
