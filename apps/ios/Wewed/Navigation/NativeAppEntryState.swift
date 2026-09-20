import Foundation

/// Everything the app can be doing between the home-screen icon and a workspace.
///
/// Launch decisions used to be scattered: the root view resolved a deep link, then checked
/// authentication, then resolved a context, each with its own early return. Nothing described the
/// lifecycle, so the invitation-before-login rule was an emergent property of statement order
/// rather than a stated one — and a reordering could silently send an invited guest to a sign-in
/// form.
///
/// This is that lifecycle, named. Both platforms follow the same states in the same order.
public enum NativeAppEntryState: Equatable {
    /// First frame. The OS launch window has just handed over; nothing is known yet.
    case launching
    /// The Wewed animated splash. Shown on every entry path, not only the guest journey.
    case splash
    /// A link or QR payload is being resolved against the repository.
    case resolvingDeepLink
    /// An invitation credential resolved to a real guest.
    ///
    /// Reachable WITHOUT authentication, and that is the point: the invitation token is itself the
    /// guest-entry authorization. An invited guest must never be asked to create an account to RSVP.
    case invitation(InvitationContext, InvitationEntryStage)
    /// A stored session is being validated against the server.
    case restoringSession
    /// No session and no invitation: the Wewed welcome surface.
    case welcome
    /// Signing in, creating an account, or recovering a password.
    case authentication(AuthenticationMode)
    /// First-run onboarding, after identity is established and authorization is known.
    case onboarding(AppRole)
    /// The account holds more than one genuinely authorized role.
    ///
    /// Distinct from the development persona picker: this lists only roles the server authorized,
    /// and it exists in production. The persona picker fabricates a role and is Shadow/UAT only.
    case roleSelection([AppRole])
    /// The role is settled but the wedding/business context is not (a planner's client list).
    case contextSelection(AppRole)
    /// A resolved role workspace.
    case workspace(AppRole)
    /// Entry failed in a way the person needs to see.
    case error(String, recoverable: Bool)
}

/// Where an invited guest lands, which depends on what they have already answered.
public enum InvitationEntryStage: Equatable {
    /// No response yet: the ivory invitation, then RSVP.
    case pending
    /// Already accepted: straight to the Wedding Pass. Never ask twice.
    case confirmed
    /// Already declined: the response state, not the RSVP form again.
    case declined
}

/// Which authentication surface is showing.
public enum AuthenticationMode: Equatable {
    case signIn
    case createAccount
    case forgotPassword
    case resetPassword
}

/// Decides where a launch goes.
///
/// Kept as a pure function of the inputs so the routing rules are testable without a device, and
/// so the invitation-before-login rule is a single assertable statement rather than a property of
/// where an early return happens to sit.
public enum LaunchRouter {

    /// The one rule that outranks everything else: an invitation credential wins.
    ///
    /// A person opening an invitation link, scanning an invitation QR or entering an invitation
    /// code goes to the invitation — not to a sign-in form, not to a role chooser — whether or not
    /// they have a session, and whether or not they have an account.
    public static func route(
        invitation: InvitationContext?,
        hasValidSession: Bool,
        authorizedRoles: [AppRole],
        hasResolvedContext: Bool,
        needsOnboarding: Bool = false,
        /// The card the active Guest is recognised by, if any.
        ///
        /// Distinct from `invitation`, which is a link being opened right now. This is the
        /// standing recognition of a Guest who has already been admitted to a wedding — and under
        /// the Guest Ceremonial Entry Contract it opens every new entry session, whatever they
        /// answered.
        recognisedGuestInvitation: InvitationContext? = nil,
        /// True once this entry session has already presented the card.
        entrySessionPresentedCard: Bool = false
    ) -> NativeAppEntryState {
        if let invitation {
            return .invitation(invitation, stage(for: invitation))
        }

        // The Guest Ceremonial Entry Contract. A recognised Guest meets their card before the
        // Guest workspace, before the wedding site, and before their pass — on every new entry
        // session, not only the first. The card is how the Couple recognised them; it is the way
        // in, not a form they have finished with.
        //
        // It outranks a session because it IS their session's front door. It does not repeat
        // within one entry session, so a glance at another app does not restage the ceremony.
        if let recognised = recognisedGuestInvitation, !entrySessionPresentedCard {
            return .invitation(recognised, stage(for: recognised))
        }

        guard hasValidSession else { return .welcome }

        // Authenticated but the server authorized nothing this build can open.
        guard let first = authorizedRoles.first else {
            return .error("This account has no Wewed workspace yet.", recoverable: true)
        }

        if needsOnboarding { return .onboarding(first) }

        // Exactly one authorized role goes straight through; asking would be a pointless step.
        if authorizedRoles.count > 1 { return .roleSelection(authorizedRoles) }

        return hasResolvedContext ? .workspace(first) : .contextSelection(first)
    }

    /// A confirmed guest goes to their pass; only a pending guest is asked to RSVP.
    public static func stage(for invitation: InvitationContext) -> InvitationEntryStage {
        if invitation.isConfirmed { return .confirmed }
        if invitation.isDeclined { return .declined }
        return .pending
    }
}
