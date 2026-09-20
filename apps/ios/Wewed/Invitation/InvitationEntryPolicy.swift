import Foundation

/// What the app should do about invitation entry on this launch.
///
/// Separated from the UI on purpose: "which guest is this, and may they take over?" is a security
/// decision, and a security decision buried in a view is one nobody can test.
public enum InvitationEntryDecision: Equatable, Sendable {
    /// Nothing invitation-shaped happened. Ordinary launch rules apply.
    case none
    /// Exchange this credential with the server, then present the invitation. Nothing is replaced
    /// yet: the active guest survives until the server has accepted the new one.
    case establish(InvitationEntry)
    /// Restore the guest this device already holds a session for. Only ever on an ordinary launch,
    /// and never over a privileged workspace.
    case restoreRememberedGuest
    /// Fail closed and say so. Never a silent fallback to whoever was active.
    case reject(InvitationRejection)
}

/// The precedence rules for invitation entry.
///
/// Every rule here exists because its absence is a specific, believable bug:
///
///  - a stale install record resurfacing months later and hijacking an ordinary launch;
///  - an invalid Guest B link silently presenting Guest A, so the wrong person's card opens;
///  - remembered guest state taking over a Planner's authenticated workspace;
///  - an explicit link being ignored because a record was already processed.
public enum InvitationEntryPolicy {

    /// - Parameters:
    ///   - launchEntry: invitation entry parsed from *this* launch, if any.
    ///   - deferredInstallEntry: entry recovered from a deferred-install record, if any.
    ///   - deferredInstallAlreadyProcessed: whether that record has been consumed before. It is
    ///     marked processed before it is acted on, so an interrupted launch cannot replay it.
    ///   - hasRememberedGuestSession: whether this device already holds a guest session.
    ///   - hasPrivilegedWorkspace: whether a Couple/Planner/Admin/Vendor workspace is active.
    public static func decide(
        launchEntry: InvitationEntry?,
        deferredInstallEntry: InvitationEntry? = nil,
        deferredInstallAlreadyProcessed: Bool = true,
        hasRememberedGuestSession: Bool = false,
        hasPrivilegedWorkspace: Bool = false
    ) -> InvitationEntryDecision {
        // An explicit link is present user intent and outranks everything, including a privileged
        // workspace: tapping your own invitation on a planner's phone should open your invitation.
        if let launchEntry {
            if case let .rejected(reason) = launchEntry { return .reject(reason) }
            return .establish(launchEntry)
        }

        // A deferred-install record says how the app was obtained, possibly long ago. It is weaker
        // than a tap, and it is honoured at most once.
        if let deferredInstallEntry, !deferredInstallAlreadyProcessed {
            if case let .rejected(reason) = deferredInstallEntry { return .reject(reason) }
            return .establish(deferredInstallEntry)
        }

        // Remembered guest state is the weakest claim of all. It restores an ordinary launch and
        // never displaces someone who is signed in to run a wedding.
        if hasRememberedGuestSession && !hasPrivilegedWorkspace {
            return .restoreRememberedGuest
        }

        return .none
    }
}
