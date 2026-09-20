import Foundation

/// A verified relationship between an actor and the scope it may operate in (P0-2).
///
/// This is the authority for "is this actor actually the planner for this wedding / the vendor on
/// this engagement / the usher on this gate / this guest". A role alone never answers that.
///
/// Assignments come from an `ActorAssignmentSource`; no view or root may construct one to make a
/// workspace open. That is what stops fabricated client/gate/engagement context (P0-3).
public struct ActorAssignment: Equatable, Sendable {
    public let actorId: String
    public let role: AppRole
    /// The wedding this assignment is for. Nil only for system-scope roles.
    public let weddingId: String?
    public let clientId: String?
    /// The vendor company this actor belongs to. Distinct from `engagementId` (P0-9).
    public let vendorId: String?
    public let engagementId: String?
    public let gateId: String?
    /// Guest identity binding — which guest record this actor *is* (P0-4).
    public let guestId: String?
    /// The credential that authorises this actor's pass (P0-5).
    public let passToken: String?
    /// True when the relationship exists only as Shadow test authorisation rather than a real
    /// production engagement. Surfaces must say so instead of implying a live relationship (P0-13).
    public let isShadowTestAccess: Bool

    public init(
        actorId: String,
        role: AppRole,
        weddingId: String?,
        clientId: String? = nil,
        vendorId: String? = nil,
        engagementId: String? = nil,
        gateId: String? = nil,
        guestId: String? = nil,
        passToken: String? = nil,
        isShadowTestAccess: Bool = false
    ) {
        self.actorId = actorId
        self.role = role
        self.weddingId = weddingId
        self.clientId = clientId
        self.vendorId = vendorId
        self.engagementId = engagementId
        self.gateId = gateId
        self.guestId = guestId
        self.passToken = passToken
        self.isShadowTestAccess = isShadowTestAccess
    }

    /// System-scope assignments (Admin) are not tied to a single wedding.
    public var isSystemScope: Bool { role == .admin && weddingId == nil }
}

/// Supplies the assignments an actor actually holds.
public protocol ActorAssignmentSource: Sendable {
    func assignments(actorId: String) async -> [ActorAssignment]
}

/// An assignment source with no relationships at all — every scoped workspace is denied.
public struct EmptyActorAssignmentSource: ActorAssignmentSource {
    public init() {}
    public func assignments(actorId: String) async -> [ActorAssignment] { [] }
}

/// A fixed set of assignments, used by fixtures, Shadow provisioning and tests.
public struct StaticActorAssignmentSource: ActorAssignmentSource {
    private let all: [ActorAssignment]
    public init(_ all: [ActorAssignment]) { self.all = all }
    public func assignments(actorId: String) async -> [ActorAssignment] {
        all.filter { $0.actorId == actorId }
    }
}
