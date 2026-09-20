import Foundation

/// IA V2 §14 / playbook §19 — deep links and notifications resolve through the same gate as
/// in-app navigation.
///
///   parse entity/context -> resolve authorized role -> verify entitlement -> navigate,
///   or fail safely with an explained boundary and a safe return route.
///
/// A link never carries its own authority: `NativeDeepLinkParser` only reads intent, and this
/// router decides whether the current actor may act on it.
public enum DeepLinkRouter {

    /// The destination a link targets for a given role. The same link can legitimately land in
    /// different workspaces per role — a Wedding Pass link opens the guest's `Pass` workspace but
    /// the couple's `Wedding Day` workspace, because that is where each role owns the pass.
    public static func destinationFor(_ deepLink: NativeDeepLink, role: AppRole) -> String? {
        switch deepLink {
        case .invitation:
            switch role {
            case .guest: return "invitation"
            case .couple: return "guests"
            case .planner: return "workspace"
            default: return nil
            }
        case .pass:
            switch role {
            case .guest: return "pass"
            case .couple, .planner: return "wedding_day"
            case .usher: return "scan"
            default: return nil
            }
        case .wedding:
            return IANavigationContract.forRole(role).primary[0].id
        case let .workspace(workspace):
            return workspace.destinationId
        }
    }

    /// Resolves a link against the active context. Returns `.denied` with a safe return route when
    /// the actor may not open the target, so an unauthorized link neither navigates nor leaks what
    /// lives there.
    /// The credential a link carries, if any. P0-9: a pass link's token must reach the Pass
    /// workspace so it resolves *that* pass rather than a default guest.
    public static func credentialToken(_ deepLink: NativeDeepLink) -> String? {
        switch deepLink {
        case let .pass(token): return token
        case let .invitation(invitation): return invitation.rsvpToken
        default: return nil
        }
    }

    public static func resolve(_ deepLink: NativeDeepLink, context: NavigationContext) -> Entitlements.Resolution {
        let navigation = IANavigationContract.forRole(context.activeRole)
        let safeReturn = navigation.primary[0].id

        guard let destinationId = destinationFor(deepLink, role: context.activeRole) else {
            return .denied(
                reason: "This link is not available for the \(navigation.displayName) workspace.",
                safeReturnDestinationId: safeReturn
            )
        }

        // A link that names a different wedding must not silently rebind the active context.
        if case let .workspace(workspace) = deepLink,
           let targetWeddingId = workspace.weddingId,
           !targetWeddingId.isEmpty,
           targetWeddingId != context.activeWeddingId {
            return .denied(
                reason: "This link belongs to a different wedding than the one currently open.",
                safeReturnDestinationId: safeReturn
            )
        }

        // P0-9: a pass link carrying someone else's credential must not open this actor's pass.
        if case let .pass(token) = deepLink,
           let linkToken = token,
           let heldToken = context.activePassToken,
           linkToken != heldToken {
            return .denied(
                reason: "This Wedding Pass link belongs to a different guest.",
                safeReturnDestinationId: safeReturn
            )
        }

        return Entitlements.resolve(context, destinationId: destinationId)
    }

    /// Convenience for callers that only need to know whether to navigate.
    public static func allowedDestination(_ deepLink: NativeDeepLink, context: NavigationContext) -> String? {
        if case let .allowed(destination, _) = resolve(deepLink, context: context) {
            return destination.id
        }
        return nil
    }
}
