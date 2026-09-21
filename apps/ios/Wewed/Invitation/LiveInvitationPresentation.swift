import Foundation

/// What the live card renders from.
///
/// Everything here is safe to hold: it is what the wedding's own authority said about this guest.
/// There is deliberately **no RSVP credential**. The token opened the door once, during exchange;
/// carrying it into the view model would turn a one-time key into the app's identity, which is the
/// exact model the invitation protocol exists to avoid.
///
/// The Shadow-era `InvitationContext` carries `guestToken` because its RSVP write needed it. The
/// live route does not: the answer is bound by ``guestId``, which the server checks.
public struct LiveInvitationPresentation: Equatable, Sendable {
    public let weddingSlug: String
    public let guestId: String
    public let guestName: String

    public let coupleNames: String
    public let monogram: String?
    public let tagline: String?

    public let weddingDate: String?
    public let venue: String?
    public let venueCity: String?
    public let venueCountry: String?
    public let venueMapUrl: String?

    public let invitationCardStyle: InvitationStyle
    public let invitationCardMessage: String?
    public let rsvpDeadline: String?
    public let childrenPolicy: String?

    public let attending: Bool?
    public let dietaryNotes: String?
    public let message: String?
    public let checkedIn: Bool

    /// Three states, because "not attending" is not "not answered".
    public var rsvpStatus: RSVPStatus {
        switch attending {
        case .some(true): return .attending
        case .some(false): return .declined
        case .none: return .pending
        }
    }

    /// "Harare, Zimbabwe" — joined here so the card never has to know either may be absent.
    public var venueCityCountry: String {
        [venueCity, venueCountry]
            .compactMap { $0?.isEmpty == false ? $0 : nil }
            .joined(separator: ", ")
    }

    /// Builds the presentation from what the server returned.
    ///
    /// The style comes from the wedding's saved `invitationCardStyle` and nothing else — not from
    /// the link, which may be forwarded or long-lived.
    public static func from(_ snapshot: GuestInvitationSnapshot) -> LiveInvitationPresentation {
        LiveInvitationPresentation(
            weddingSlug: snapshot.weddingSlug,
            guestId: snapshot.guestId,
            guestName: snapshot.guestName,
            coupleNames: snapshot.title,
            monogram: snapshot.monogram,
            tagline: snapshot.tagline,
            weddingDate: snapshot.date,
            venue: snapshot.venue,
            venueCity: snapshot.venueCity,
            venueCountry: snapshot.venueCountry,
            venueMapUrl: snapshot.venueMapUrl,
            invitationCardStyle: InvitationStyle.fromWire(snapshot.invitationCardStyle),
            invitationCardMessage: snapshot.invitationCardMessage,
            rsvpDeadline: snapshot.rsvpDeadline,
            childrenPolicy: snapshot.childrenPolicy,
            attending: snapshot.attending,
            dietaryNotes: snapshot.dietaryNotes,
            message: snapshot.message,
            checkedIn: snapshot.checkedIn
        )
    }
}
