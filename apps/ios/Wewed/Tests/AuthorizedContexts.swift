import Foundation
@testable import WewedKit

/// Builders for contexts that hold a *verified* assignment, plus deliberately broken ones.
///
/// Tests must construct authorization the same way production does — actor + role + scope +
/// relationship — so a test cannot accidentally prove more than the app actually allows.
enum AuthorizedContexts {

    static let wedding = "cmqos70cb0004q6vxe9g9aiu5"
    static let otherWedding = "wed_other_001"
    static let vendor = "shadow_vnd_06"
    static let otherVendor = "shadow_vnd_02"
    static let engagement = "shadow_eng_06"
    static let otherEngagement = "shadow_vnd_02"
    static let gate = "gate_main_entrance"
    static let otherGate = "gate_side_entrance"
    static let guest = "shadow_guest_011"
    static let otherGuest = "shadow_guest_007"
    static let passToken = "shadow-attending-guest"

    static func assignment(
        _ role: AppRole,
        actorId: String? = nil,
        weddingId: String = wedding
    ) -> ActorAssignment {
        ActorAssignment(
            actorId: actorId ?? "actor_\(role.roleId)",
            role: role,
            weddingId: role == .admin ? nil : weddingId,
            vendorId: role == .vendor ? vendor : nil,
            engagementId: role == .vendor ? engagement : nil,
            gateId: role == .usher ? gate : nil,
            guestId: role == .guest ? guest : nil,
            passToken: role == .guest ? passToken : nil,
            isShadowTestAccess: role != .couple
        )
    }

    /// A fully authorized context for `role`.
    static func authorized(
        _ role: AppRole,
        environment: NativeDataEnvironment = .fixture,
        weddingId: String = wedding
    ) -> NavigationContext {
        let a = assignment(role, weddingId: weddingId)
        let systemScoped = IANavigationContract.forRole(role).isSystemScoped
        return NavigationContext(
            actorId: a.actorId,
            activeRole: role,
            activeWeddingId: systemScoped ? "" : weddingId,
            activeWeddingTitle: systemScoped ? "" : "Charity & Kudzie",
            environment: environment,
            activeClientId: a.clientId,
            activeVendorId: a.vendorId,
            activeEngagementId: a.engagementId,
            activeGateId: a.gateId,
            activeGuestId: a.guestId,
            activePassToken: a.passToken,
            assignment: a
        )
    }

    /// An actor holding the role but with no assignment at all.
    static func unassigned(_ role: AppRole) -> NavigationContext {
        let c = authorized(role)
        return NavigationContext(
            actorId: c.actorId, activeRole: c.activeRole, activeWeddingId: c.activeWeddingId,
            activeWeddingTitle: c.activeWeddingTitle, environment: c.environment,
            activeClientId: c.activeClientId, activeVendorId: c.activeVendorId,
            activeEngagementId: c.activeEngagementId,
            activeGateId: c.activeGateId, activeGuestId: c.activeGuestId,
            activePassToken: c.activePassToken, assignment: nil
        )
    }

    /// Copy helper for the deliberately-broken cases.
    static func mutate(
        _ c: NavigationContext,
        weddingId: String? = nil,
        vendorId: String?? = nil,
        engagementId: String?? = nil,
        gateId: String?? = nil,
        guestId: String?? = nil,
        assignment: ActorAssignment?? = nil
    ) -> NavigationContext {
        NavigationContext(
            actorId: c.actorId,
            activeRole: c.activeRole,
            activeWeddingId: weddingId ?? c.activeWeddingId,
            activeWeddingTitle: c.activeWeddingTitle,
            environment: c.environment,
            activeClientId: c.activeClientId,
            activeVendorId: vendorId ?? c.activeVendorId,
            activeEngagementId: engagementId ?? c.activeEngagementId,
            activeGateId: gateId ?? c.activeGateId,
            activeGuestId: guestId ?? c.activeGuestId,
            activePassToken: c.activePassToken,
            assignment: assignment ?? c.assignment
        )
    }
}
