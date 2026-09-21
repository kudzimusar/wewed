import Foundation

/// Where an invitation-bound Guest is in their own experience.
///
/// This is deliberately a different axis from account onboarding. An invited Guest has already been
/// provisioned by the couple and has already authenticated themselves by opening their private
/// link; they are not a stranger who needs an email and a password. The states below describe a
/// guest moving around *their own wedding*, never a signup funnel.
public enum LiveGuestExperienceState: Equatable, Sendable {
    /// Checking whether this device still holds a valid Guest session.
    case restoring
    /// The ceremonial entry: the configured digital invitation, shown first. Not a gate — `home`
    /// is reachable without answering.
    case invitation(LiveInvitationPresentation)
    /// The persistent Guest experience: their wedding, their details, their pass if attending.
    case home(LiveInvitationPresentation)
    /// Wewed could not be reached. Distinct from being refused.
    case unavailable(status: Int?)
    /// No valid Guest session on this device — nothing stored, or what was stored is no longer
    /// good. The Guest is asked to reopen their invitation, never shown someone else's wedding.
    case needsInvitation(InvitationRejection?)
}
