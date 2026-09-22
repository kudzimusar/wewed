import Foundation

/// What a role shell may render, derived only from `Entitlements` and `NavigationContext`.
///
/// This is not a second authorization model. Every transition goes through `Entitlements.resolve`,
/// and the workspace gate is `Entitlements.relationshipHolds` plus `NavigationContext.isComplete`.
/// It exists so the shell cannot reach content by any other road (Phase 1 independent review):
///
///  - the initial destination used to render without ever being resolved;
///  - a denial moved the selection to its safe return, so dismissing the notice showed that
///    destination's content without it ever having been authorized.
///
/// Content renders only for `visibleDestinationId`, which is always a destination that
/// `Entitlements.resolve` actually allowed for this context. With none, the actor stays at the
/// access boundary; no destination is invented for them. The Android counterpart is identical.
public struct RoleShellAuthorization: Equatable, Sendable {
    /// The last destination `Entitlements.resolve` allowed, or nil if none ever was.
    public private(set) var authorizedDestinationId: String?
    /// The reason for the boundary currently being explained, if any.
    public private(set) var denialReason: String?

    /// The destination whose content may render now; nil means the access boundary.
    public var visibleDestinationId: String? { denialReason == nil ? authorizedDestinationId : nil }

    /// Whether dismissing the notice leads anywhere. Without an authorized destination it cannot.
    public var canDismissDenial: Bool { denialReason != nil && authorizedDestinationId != nil }

    /// Applies a resolution from `Entitlements.resolve` or `DeepLinkRouter.resolve`.
    ///
    /// A denial keeps the last authorized destination; it never adopts the denial's safe return,
    /// because that destination has not been resolved for this context.
    public func applying(_ resolution: Entitlements.Resolution) -> RoleShellAuthorization {
        var next = self
        switch resolution {
        case let .allowed(destination, _):
            next.authorizedDestinationId = destination.id
            next.denialReason = nil
        case let .denied(reason, _):
            next.denialReason = reason
        }
        return next
    }

    /// A tab tap: resolved exactly like a deep link.
    public func selecting(_ context: NavigationContext, destinationId: String) -> RoleShellAuthorization {
        applying(Entitlements.resolve(context, destinationId: destinationId))
    }

    /// Returns to the last authorized destination, or stays at the boundary if there is none.
    public func dismissingDenial() -> RoleShellAuthorization {
        guard canDismissDenial else { return self }
        var next = self
        next.denialReason = nil
        return next
    }

    /// Whether a role workspace may be composed for `context` at all.
    ///
    /// An assignment is mandatory — a system-scoped Admin still needs a real system-scope
    /// assignment; a nil wedding is valid, a nil assignment is not. Every required scope must be
    /// resolved, and the assignment must actually hold for this actor, role and wedding.
    public static func admitsWorkspace(_ context: NavigationContext) -> Bool {
        context.assignment != nil && context.isComplete && Entitlements.relationshipHolds(context)
    }

    /// The shell's starting state: the contract's first destination, resolved like any other.
    public static func initial(_ context: NavigationContext) -> RoleShellAuthorization {
        let first = IANavigationContract.forRole(context.activeRole).primary[0].id
        return RoleShellAuthorization(authorizedDestinationId: nil, denialReason: nil)
            .selecting(context, destinationId: first)
    }
}
