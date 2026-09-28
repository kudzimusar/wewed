import Foundation

/// Real production assignments — master plan Phase 5.
///
/// Wraps one already-fetched `ProductionAuthority` plus the grant ids the person has explicitly
/// selected (only meaningful where more than one grant of a kind exists). It never calls
/// `AppRole(rawValue:)` on server data and never invents an assignment:
///
///  - a grant kind `ProductionGrantMapper` maps directly (couple/planner/coordinator wedding,
///    vendor wedding, admin system) becomes an `ActorAssignment` once it is either the only grant
///    of its kind or explicitly selected;
///  - a grant kind `ProductionGrantMapper` reports as `.requiresWeddingSelection` (Planner
///    portfolio, Vendor business) NEVER becomes an assignment here — a portfolio with zero
///    weddings stays a portfolio, not a fabricated wedding;
///  - an unusable authority (wrong contract/version, not `authorized`) or an actor id that does
///    not match the authority's own `accessUserId` yields nothing.
///
/// A grant id in `selectedGrantIds` that no longer appears in a freshly-fetched `authority` simply
/// has no effect — this source only ever iterates the authority's OWN current grants, so a revoked
/// grant clears itself the next time the authority is refreshed. The Android counterpart is
/// identical.
public struct ProductionActorAssignmentSource: ActorAssignmentSource {
    private let authority: ProductionAuthority
    private let selectedGrantIds: Set<String>
    private let selectedEngagementId: String?
    private let selectedGateGrantId: String?

    public init(
        authority: ProductionAuthority,
        selectedGrantIds: Set<String> = [],
        selectedEngagementId: String? = nil,
        selectedGateGrantId: String? = nil
    ) {
        self.authority = authority
        self.selectedGrantIds = selectedGrantIds
        self.selectedEngagementId = selectedEngagementId
        self.selectedGateGrantId = selectedGateGrantId
    }

    public func assignments(actorId: String) async -> [ActorAssignment] {
        guard ProductionGrantMapper.isUsable(authority) else { return [] }
        guard authority.accessUserId == actorId else { return [] }

        let ambiguousKinds = Set(
            Dictionary(
                grouping: authority.workspaceGrants.filter { selectedGrantIds.contains($0.grantId) },
                by: \.workspaceKindWire
            )
            .filter { $0.value.count > 1 }
            .map(\.key)
        )

        let workspaceAssignments: [ActorAssignment] = authority.workspaceGrants.compactMap { grant in
            if ambiguousKinds.contains(grant.workspaceKindWire) {
                return nil
            }
            if requiresExplicitSelection(grant) && !selectedGrantIds.contains(grant.grantId) {
                return nil
            }
            switch ProductionGrantMapper.map(authority, grantId: grant.grantId, selectedEngagementId: selectedEngagementId) {
            case let .assigned(assignment): return assignment
            case .requiresWeddingSelection, .denied: return nil
            }
        }

        let gateAssignment: ActorAssignment? = selectedGateGrantId.flatMap { grantId in
            guard case let .selected(context) = ProductionGateGrantMapper.map(authority, selectedGrantId: grantId) else {
                return nil
            }
            return ActorAssignment(
                actorId: context.operatorUserId,
                role: .usher,
                weddingId: context.weddingId,
                gateId: context.gateId
            )
        }
        return gateAssignment.map { workspaceAssignments + [$0] } ?? workspaceAssignments
    }

    /// True when more than one grant shares this grant's workspace kind, so none is picked implicitly.
    private func requiresExplicitSelection(_ grant: ProductionWorkspaceGrant) -> Bool {
        authority.contextSelection
            .first { $0.workspaceKind == grant.workspaceKindWire }?
            .selectionRequired == true
    }
}
