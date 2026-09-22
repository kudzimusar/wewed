package pro.wewed.app.navigation

/**
 * Real production assignments — master plan Phase 5.
 *
 * Wraps one already-fetched [ProductionAuthority] plus the grant ids the person has explicitly
 * selected (only meaningful where more than one grant of a kind exists). It never calls
 * `AppRole.fromId` on server data and never invents an assignment:
 *
 *  - a grant kind [ProductionGrantMapper] maps directly (couple/planner/coordinator wedding,
 *    vendor wedding, admin system) becomes an [ActorAssignment] once it is either the only grant
 *    of its kind or explicitly selected;
 *  - a grant kind that [ProductionGrantMapper] reports as `RequiresWeddingSelection` (Planner
 *    portfolio, Vendor business) NEVER becomes an assignment here — a portfolio with zero weddings
 *    stays a portfolio, not a fabricated wedding;
 *  - an unusable authority (wrong contract/version, not `authorized`) or an actor id that does not
 *    match the authority's own `accessUserId` yields nothing.
 *
 * A grant id in [selectedGrantIds] that no longer appears in a freshly-fetched [authority] simply
 * has no effect — this source only ever iterates the authority's OWN current grants, so a revoked
 * grant clears itself the next time the authority is refreshed.
 */
class ProductionActorAssignmentSource(
    private val authority: ProductionAuthority,
    private val selectedGrantIds: Set<String> = emptySet(),
    private val selectedEngagementId: String? = null,
) : ActorAssignmentSource {

    override suspend fun assignments(actorId: String): List<ActorAssignment> {
        if (!ProductionGrantMapper.isUsable(authority)) return emptyList()
        if (authority.accessUserId != actorId) return emptyList()

        val ambiguousKinds = authority.grants
            .filter { it.grantId in selectedGrantIds }
            .groupBy { it.workspaceKindWire }
            .filterValues { it.size > 1 }
            .keys

        return authority.grants
            .filter { grant ->
                grant.workspaceKindWire !in ambiguousKinds &&
                    (grant.grantId in selectedGrantIds || !requiresExplicitSelection(grant))
            }
            .mapNotNull { grant ->
                when (val outcome = ProductionGrantMapper.map(authority, grant.grantId, selectedEngagementId)) {
                    is ProductionGrantMapper.Outcome.Assigned -> outcome.assignment
                    is ProductionGrantMapper.Outcome.RequiresWeddingSelection -> null
                    is ProductionGrantMapper.Outcome.Denied -> null
                }
            }
    }

    /** True when more than one grant shares this grant's workspace kind, so none is picked implicitly. */
    private fun requiresExplicitSelection(grant: ProductionWorkspaceGrant): Boolean =
        authority.contextSelection
            .firstOrNull { it.workspaceKindWire == grant.workspaceKindWire }
            ?.selectionRequired == true
}
