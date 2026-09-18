import Foundation

public enum GuestJourneyStage: String, Codable, CaseIterable, Sendable {
    case splash
    case invitation
    case confirmedAttending
    case declined
}

public struct GuestJourneyReference: Codable, Equatable, Sendable {
    public let invitation: InvitationContext
    public let initialStage: GuestJourneyStage

    public init(invitation: InvitationContext, initialStage: GuestJourneyStage = .splash) {
        self.invitation = invitation
        self.initialStage = initialStage
    }
}
