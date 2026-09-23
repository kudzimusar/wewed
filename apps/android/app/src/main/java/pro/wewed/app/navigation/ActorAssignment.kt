package pro.wewed.app.navigation

import pro.wewed.app.models.AppRole
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.services.PlannerDashboardRepository
import pro.wewed.app.services.WeddingRepository

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

/**
 * Chooses where assignments come from for an environment.
 *
 * Shadow authority exists only where Shadow personas do. Production and production-read-verify get
 * a real [ProductionActorAssignmentSource] once a [ProductionAuthority] has actually been fetched
 * and verified server-side (master plan Phase 5); until then — no identity session, no successful
 * authority fetch yet — they still get [EmptyActorAssignmentSource], so every scoped workspace is
 * denied rather than opened with Shadow test access. The root used to build the Shadow source
 * unconditionally (master plan §8.9).
 *
 * Master plan Phase 8 closure round 5 — split into three narrowly-typed constructors on purpose.
 * The previous single `forEnvironment(environment, repository, plannerRepository, ...)` function
 * required a `WeddingRepository` argument for EVERY environment, including PRODUCTION, even though
 * [forProduction]/[empty] never read one. Kotlin evaluates call-site arguments eagerly, so a caller
 * writing `ActorAssignmentSources.forEnvironment(env, appViewModel.repository, ...)` evaluated
 * `appViewModel.repository` — which throws `ProductionRepositoryUnbound` in PRODUCTION before any
 * bind has occurred (see `AppState.kt`) — before `forEnvironment` was ever entered, regardless of
 * what that function did internally with the value. [forProduction] and [empty] have NO repository
 * parameter at all, so it is not possible for a caller to accidentally reintroduce that read by
 * construction: there is nothing to pass, and nothing this object can misuse even if a caller wanted
 * to. [forShadow] is the only constructor that takes a repository, and only Shadow/dev-persona
 * environments have one to give it (`AppState`'s non-production repositories are always real and
 * non-throwing, unlike PRODUCTION's).
 */
object ActorAssignmentSources {
    /** Shadow/Fixture/dev-persona environments only — the repository is real and always available. */
    fun forShadow(
        repository: WeddingRepository,
        plannerRepository: PlannerDashboardRepository?,
        environment: NativeDataEnvironment,
    ): ActorAssignmentSource = ShadowActorAssignmentSource(repository, environment, plannerRepository)

    /** PRODUCTION/PRODUCTION_READ_VERIFY once a [ProductionAuthority] has been fetched and verified. No repository is read or required. */
    fun forProduction(
        productionAuthority: ProductionAuthority,
        selectedGrantIds: Set<String> = emptySet(),
        selectedEngagementId: String? = null,
        selectedGateGrantId: String? = null,
    ): ActorAssignmentSource = ProductionActorAssignmentSource(
        productionAuthority,
        selectedGrantIds,
        selectedEngagementId,
        selectedGateGrantId
    )

    /** No identity session yet, or no successful authority fetch yet. No repository is read or required. */
    fun empty(): ActorAssignmentSource = EmptyActorAssignmentSource
}

/** A fixed set of assignments, used by fixtures, Shadow provisioning and tests. */
class StaticActorAssignmentSource(
    private val all: List<ActorAssignment>
) : ActorAssignmentSource {
    override suspend fun assignments(actorId: String): List<ActorAssignment> =
        all.filter { it.actorId == actorId }
}

/**
 * Master plan Phase 8 closure round 5 — the exact pure decision `RootScreen.kt`'s
 * `remember(appViewModel, productionAuthority, selectedGrantIds, selectedEngagementId) { ... }`
 * block makes, extracted so it has a real executable unit test independent of Compose. This is the
 * ONLY place `appViewModel.repository`/`plannerRepository` may be read for the purpose of building
 * an [ActorAssignmentSource] — and only inside the branch where [pro.wewed.app.state.AppViewModel.dataEnvironment]
 * allows development persona switching. A caller passing a PRODUCTION `appViewModel` (bound or not)
 * never reaches that branch, so `ProductionRepositoryUnbound` is structurally unreachable from here.
 */
fun resolveActorAssignmentSource(
    appViewModel: pro.wewed.app.state.AppViewModel,
    productionAuthority: ProductionAuthority?,
    selectedGrantIds: Set<String>,
    selectedEngagementId: String?,
    selectedGateGrantId: String? = null,
): ActorAssignmentSource =
    if (appViewModel.dataEnvironment.allowsDevelopmentPersonaSwitching) {
        ActorAssignmentSources.forShadow(appViewModel.repository, appViewModel.plannerRepository, appViewModel.dataEnvironment)
    } else if (productionAuthority != null) {
        ActorAssignmentSources.forProduction(
            productionAuthority,
            selectedGrantIds,
            selectedEngagementId,
            selectedGateGrantId
        )
    } else {
        ActorAssignmentSources.empty()
    }
