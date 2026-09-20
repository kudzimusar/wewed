import Foundation

/// Where a guest's entry begins.
///
/// Deliberately only two values. There were once `confirmedAttending` and `declined` stages, and
/// having them meant RSVP state could choose a *destination* — which is how an answered guest came
/// to be sent somewhere other than their invitation. What a guest has answered now changes what the
/// invitation offers, never where they land.
public enum GuestJourneyStage: String, Codable, CaseIterable, Sendable {
    /// The Wewed brand moment, before the card.
    case splash
    /// The wedding's configured invitation. Every guest entry ends here, whatever they answered.
    case invitation
}

public struct GuestJourneyReference: Codable, Equatable, Sendable {
    public let invitation: InvitationContext
    public let initialStage: GuestJourneyStage

    public init(invitation: InvitationContext, initialStage: GuestJourneyStage = .splash) {
        self.invitation = invitation
        self.initialStage = initialStage
    }
}
