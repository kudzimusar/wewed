import Foundation

/// Resolves actor assignments for the non-production environments, verifying every scoped id
/// against the canonical repository before it is trusted (P0-2, P0-3).
///
/// Nothing here invents a scope. A vendor engagement must exist as a real `VendorPresence` on the
/// wedding; a guest identity must be resolvable from a real credential; a gate must be declared in
/// the Shadow assignment table below. When the repository cannot confirm the relationship, no
/// assignment is returned and the workspace is denied rather than opened with a placeholder.
public struct ShadowActorAssignmentSource: ActorAssignmentSource {

    /// Declared Shadow gate assignments, keyed by actor.
    ///
    /// This is the Shadow environment's assignment record. It is deliberately explicit and
    /// auditable; an actor absent from this table has no gate and is denied the Gate workspace.
    public static let shadowGateAssignments: [String: String] = [
        "gate_usher": "gate_main_entrance"
    ]

    /// Credentials that identify each Shadow guest actor. Two distinct guests are declared so
    /// identity binding cannot pass by collection order (P0-4).
    public static let shadowGuestCredentials: [String: String] = [
        "attending_guest": "shadow-attending-guest",
        "attending_guest_party4": "shadow-party4-guest"
    ]

    private let repository: WeddingRepositoryProtocol
    private let personas: [DevelopmentPersona]
    private let gateAssignments: [String: String]
    private let guestCredentials: [String: String]

    public init(
        repository: WeddingRepositoryProtocol,
        personas: [DevelopmentPersona] = DevelopmentPersona.allPersonas,
        gateAssignments: [String: String] = ShadowActorAssignmentSource.shadowGateAssignments,
        guestCredentials: [String: String] = ShadowActorAssignmentSource.shadowGuestCredentials
    ) {
        self.repository = repository
        self.personas = personas
        self.gateAssignments = gateAssignments
        self.guestCredentials = guestCredentials
    }

    public func assignments(actorId: String) async -> [ActorAssignment] {
        guard let persona = personas.first(where: { $0.id == actorId }) else { return [] }

        // The wedding identity is whatever the environment's repository actually serves. A persona
        // carries the production wedding id, which a Shadow snapshot deliberately does not use, so
        // trusting the persona's id would bind the context to a wedding no source can answer for.
        guard let weddingId = try? await repository.availableWeddingIds().first,
              let scoped = try? await repository.forWedding(weddingId) else {
            return []
        }
        let shadowTest = persona.role != .couple

        switch persona.role {
        case .couple, .planner, .coordinator:
            return [
                ActorAssignment(
                    actorId: actorId,
                    role: persona.role,
                    weddingId: weddingId,
                    // No verified client record exists in Shadow; client stays unresolved rather
                    // than being set to the wedding id (P0-3).
                    clientId: nil,
                    isShadowTestAccess: shadowTest
                )
            ]

        case .vendor:
            // The engagement must exist on this wedding, matched by the vendor's own identity.
            guard let vendors = try? await scoped.getVendors(),
                  let engagement = vendors.first(where: {
                      $0.vendorName.compare(persona.name, options: .caseInsensitive) == .orderedSame
                  }) else { return [] }
            return [
                ActorAssignment(
                    actorId: actorId,
                    role: .vendor,
                    weddingId: weddingId,
                    engagementId: engagement.id,
                    isShadowTestAccess: true
                )
            ]

        case .guest:
            guard let token = guestCredentials[actorId],
                  // Identity comes from the credential, resolved by the repository (P0-4/P0-5).
                  let identity = try? await scoped.resolveGuestIdentity(token: token),
                  identity.weddingId == weddingId else { return [] }
            return [
                ActorAssignment(
                    actorId: actorId,
                    role: .guest,
                    weddingId: weddingId,
                    guestId: identity.guestId,
                    passToken: identity.passToken,
                    isShadowTestAccess: true
                )
            ]

        case .usher:
            // A gate assignment is a declared Shadow record, not a display string invented by the
            // root. Without one, the gate role has no authorised scope.
            guard let gateId = gateAssignments[actorId] else { return [] }
            return [
                ActorAssignment(
                    actorId: actorId,
                    role: .usher,
                    weddingId: weddingId,
                    gateId: gateId,
                    isShadowTestAccess: true
                )
            ]

        case .admin:
            // Admin is system-scoped: no wedding is required to open the console (P0-15).
            return [
                ActorAssignment(actorId: actorId, role: .admin, weddingId: nil, isShadowTestAccess: true)
            ]
        }
    }
}
