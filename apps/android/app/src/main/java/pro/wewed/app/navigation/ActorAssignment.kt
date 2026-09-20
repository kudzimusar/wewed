package pro.wewed.app.navigation

import pro.wewed.app.models.AppRole

/**
 * A verified relationship between an actor and the scope it may operate in (P0-2).
 *
 * This is the authority for "is this actor actually the planner for this wedding / the vendor on
 * this engagement / the usher on this gate / this guest". A role alone never answers that.
 *
 * Assignments come from an [ActorAssignmentSource]; no screen or root may construct one to make a
 * workspace open. That is what stops fabricated client/gate/engagement context (P0-3).
 */
data class ActorAssignment(
    val actorId: String,
    val role: AppRole,
    /** The wedding this assignment is for. Null only for system-scope roles. */
    val weddingId: String?,
    val clientId: String? = null,
    /** The vendor company this actor belongs to. Distinct from [engagementId] (P0-9). */
    val vendorId: String? = null,
    /** One service engagement of that vendor. A vendor may hold several. */
    val engagementId: String? = null,
    val gateId: String? = null,
    /** Guest identity binding — which guest record this actor *is* (P0-4). */
    val guestId: String? = null,
    /** The credential that authorises this actor's pass (P0-5). */
    val passToken: String? = null,
    /**
     * True when the relationship exists only as Shadow test authorisation rather than a real
     * production engagement. Surfaces must say so instead of implying a live relationship (P0-13).
     */
    val isShadowTestAccess: Boolean = false
) {
    /** System-scope assignments (Admin) are not tied to a single wedding. */
    val isSystemScope: Boolean get() = role == AppRole.ADMIN && weddingId == null
}

/**
 * Supplies the assignments an actor actually holds.
 *
 * Implementations read them from the active environment's authorisation data. During Shadow
 * qualification the source is explicit about test-only access rather than inventing a production
 * relationship.
 */
interface ActorAssignmentSource {
    suspend fun assignments(actorId: String): List<ActorAssignment>
}

/** An assignment source with no relationships at all — every scoped workspace is denied. */
object EmptyActorAssignmentSource : ActorAssignmentSource {
    override suspend fun assignments(actorId: String): List<ActorAssignment> = emptyList()
}

/** A fixed set of assignments, used by fixtures, Shadow provisioning and tests. */
class StaticActorAssignmentSource(
    private val all: List<ActorAssignment>
) : ActorAssignmentSource {
    override suspend fun assignments(actorId: String): List<ActorAssignment> =
        all.filter { it.actorId == actorId }
}
