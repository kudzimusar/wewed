package pro.wewed.app.state

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import pro.wewed.app.invitation.InvitationEntry
import pro.wewed.app.invitation.InvitationEntryParser
import pro.wewed.app.models.InvitationDeepLink
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.models.NativeDeepLink
import pro.wewed.app.models.NativeDeepLinkParser
import pro.wewed.app.services.AdminSystemRepository
import pro.wewed.app.services.FixturePlannerDashboardRepository
import pro.wewed.app.services.FixtureWeddingRepository
import pro.wewed.app.services.PlannerDashboardRepository
import pro.wewed.app.services.NativeEnvironmentGuard
import pro.wewed.app.services.ProductionBoundaryAdminSystemRepository
import pro.wewed.app.services.ShadowAdminSystemRepository
import pro.wewed.app.services.WeddingDayGateAwareRepository
import pro.wewed.app.services.WeddingDayGateOperations
import pro.wewed.app.services.ScopedWeddingRepository
import pro.wewed.app.services.WeddingRepository
import pro.wewed.app.services.forWedding

/**
 * Couple Level-1 destinations, mirroring the IA V2 couple taxonomy
 * (Home | Plan | Guests | Wedding Day | More).
 *
 * [destinationId] ties each tab to the shared navigation contract so deep links resolve to a
 * contract destination rather than a screen name.
 */
enum class AppTab(val title: String, val destinationId: String) {
    HOME("Home", "home"),
    PLAN("Plan", "plan"),
    GUESTS("Guests", "guests"),
    WEDDING_DAY("Wedding Day", "wedding_day"),
    MORE("More", "more");

    companion object {
        fun fromDestinationId(id: String): AppTab =
            entries.find { it.destinationId == id } ?: HOME
    }
}

class AppViewModel(
    baseRepository: WeddingRepository = FixtureWeddingRepository(),
    plannerRepository: PlannerDashboardRepository = FixturePlannerDashboardRepository(),
    val dataEnvironment: NativeDataEnvironment = NativeDataEnvironment.FIXTURE,
    val dataBaseUrl: String? = null,
    val weddingDayGate: WeddingDayGateOperations? = null
) {
    init {
        NativeEnvironmentGuard.validate(dataBaseUrl, dataEnvironment)
    }

    var repository: WeddingRepository = if (weddingDayGate != null) {
        WeddingDayGateAwareRepository(baseRepository, weddingDayGate)
    } else {
        baseRepository
    }
        private set

    var plannerRepository: PlannerDashboardRepository = plannerRepository
        private set

    /**
     * Master plan Phase 8 closure §B/§12 — never `ShadowAdminSystemRepository` in production. Non-
     * production keeps the existing Shadow-over-wedding-graph behavior unchanged; production starts
     * honestly unbound (`ProductionBoundaryAdminSystemRepository`) until a real `admin:system`
     * grant resolves and `bindProductionAdminRepository` swaps in `ProductionAdminSystemRepository`.
     */
    var adminRepository: AdminSystemRepository = if (dataEnvironment == NativeDataEnvironment.PRODUCTION) {
        ProductionBoundaryAdminSystemRepository()
    } else {
        ShadowAdminSystemRepository(repository, dataEnvironment)
    }
        private set

    /**
     * The grantId actually backing [repository]/[plannerRepository] right now, or null while
     * PRODUCTION still holds its unbound `ProductionBoundary*Repository` placeholder.
     *
     * Master plan Phase 8 closure §1 (NativeRepositoryFactory.PRODUCTION closure) — the rebind in
     * [bindProductionRepositories] runs from a `LaunchedEffect`, which starts asynchronously
     * relative to the composition that decided a role shell is eligible to render. Composition
     * itself continues immediately past that `LaunchedEffect` call to the shell's own body in the
     * same pass, so a naive "does the workspace snapshot look right" render gate could let a shell
     * begin reading `repository` before this rebind actually executes — silently backed by the
     * always-throwing Boundary placeholder for one race window. Exposing the bind as its own
     * observable `StateFlow`, flipped only *after* the field assignment below, lets the render gate
     * wait for the confirmed bind instead of assuming effect-ordering it cannot guarantee.
     */
    private val _boundProductionGrantId = MutableStateFlow<String?>(null)
    val boundProductionGrantId: StateFlow<String?> = _boundProductionGrantId.asStateFlow()

    /** Same determinism guarantee as [boundProductionGrantId], for the separate Admin binding. */
    private val _boundAdminGrantId = MutableStateFlow<String?>(null)
    val boundAdminGrantId: StateFlow<String?> = _boundAdminGrantId.asStateFlow()

    /**
     * Master plan Phase 8 — rebinds this view model's domain repositories to real, grant-scoped
     * production adapters once a wedding-scoped grant is active. Only ever called for
     * `dataEnvironment == PRODUCTION`; every other environment keeps its constructor-supplied
     * repositories for the whole app lifetime, exactly as before. The Wedding Day gate wrapper, if
     * any, is preserved around the new base repository so operational fail-closed behavior is
     * unchanged.
     */
    fun bindProductionRepositories(grantId: String, wedding: WeddingRepository, planner: PlannerDashboardRepository) {
        check(dataEnvironment == NativeDataEnvironment.PRODUCTION) {
            "bindProductionRepositories is only valid for the PRODUCTION environment."
        }
        repository = if (weddingDayGate != null) WeddingDayGateAwareRepository(wedding, weddingDayGate) else wedding
        plannerRepository = planner
        _boundProductionGrantId.value = grantId
    }

    /** Master plan Phase 8 closure §B/§1 — rebinds Admin to a real, grant-scoped production adapter. */
    fun bindProductionAdminRepository(grantId: String, admin: AdminSystemRepository) {
        check(dataEnvironment == NativeDataEnvironment.PRODUCTION) {
            "bindProductionAdminRepository is only valid for the PRODUCTION environment."
        }
        adminRepository = admin
        _boundAdminGrantId.value = grantId
    }

    /**
     * The wedding every graph read is scoped to (P0-1).
     *
     * Bound once by the root from the resolved NavigationContext. It is deliberately not defaulted:
     * an unbound view model cannot read a wedding graph at all, so there is no ambient fallback for
     * a screen to accidentally rely on.
     */
    private val _activeWeddingId = MutableStateFlow<String?>(null)
    val activeWeddingId: StateFlow<String?> = _activeWeddingId.asStateFlow()

    fun bindActiveWedding(weddingId: String) {
        _activeWeddingId.value = weddingId.takeIf { it.isNotBlank() }
    }

    /**
     * The only way a screen reads the wedding graph. Throws if no wedding is bound, and
     * [forWedding] rejects a wedding this source does not serve.
     */
    suspend fun scopedRepository(): ScopedWeddingRepository {
        val weddingId = _activeWeddingId.value
            ?: error("No active wedding is bound; a wedding graph cannot be read without a scope.")
        return repository.forWedding(weddingId)
    }

    private val _selectedTab = MutableStateFlow(AppTab.HOME)
    val selectedTab: StateFlow<AppTab> = _selectedTab.asStateFlow()

    private val _isOffline = MutableStateFlow(false)
    val isOffline: StateFlow<Boolean> = _isOffline.asStateFlow()

    private val _pendingInvitationDeepLink = MutableStateFlow<InvitationDeepLink?>(null)
    val pendingInvitationDeepLink: StateFlow<InvitationDeepLink?> =
        _pendingInvitationDeepLink.asStateFlow()

    /**
     * A parsed but *unauthorized* route request. The root resolves it through
     * `DeepLinkRouter` against the active role and context; parsing alone never navigates.
     */
    private val _pendingRouteDeepLink = MutableStateFlow<NativeDeepLink?>(null)
    val pendingRouteDeepLink: StateFlow<NativeDeepLink?> = _pendingRouteDeepLink.asStateFlow()

    /**
     * A launch that looked like an invitation and is refused.
     *
     * Held as its own state rather than dropped, because failing closed has to be *visible*. An
     * invalid or expired link that silently does nothing looks identical to the app opening as
     * whoever was already signed in — which is exactly the confusion that lets the wrong person's
     * invitation appear.
     */
    private val _rejectedInvitation = MutableStateFlow<InvitationEntry.Reason?>(null)
    val rejectedInvitation: StateFlow<InvitationEntry.Reason?> = _rejectedInvitation.asStateFlow()

    fun clearRejectedInvitation() {
        _rejectedInvitation.value = null
    }

    /**
     * The invitation entry this launch carries, waiting to be exchanged.
     *
     * Both credential-bearing shapes travel through here — a private link and an opaque handoff —
     * because after exchange the two are indistinguishable and the coordinator treats them the
     * same. The handoff in particular used to be recognised and then dropped on the floor, so the
     * parser tests passed while the app never redeemed it. Carrying it as state is what makes the
     * journey completable.
     */
    private val _pendingInvitationEntry = MutableStateFlow<InvitationEntry?>(null)
    val pendingInvitationEntry: StateFlow<InvitationEntry?> = _pendingInvitationEntry.asStateFlow()

    /** Consumed by the coordinator once, so a re-render cannot replay an exchange. */
    fun consumePendingInvitationEntry(): InvitationEntry? =
        _pendingInvitationEntry.value.also { _pendingInvitationEntry.value = null }

    fun handleIncomingUrl(rawUrl: String?) {
        // Invitation entry is resolved first and by its own parser, because it is the only launch
        // shape that carries a credential and the only one with refusals of its own.
        when (val entry = InvitationEntryParser.fromUrl(rawUrl)) {
            is InvitationEntry.Rejected -> {
                _rejectedInvitation.value = entry.reason
                _pendingInvitationEntry.value = null
                _pendingInvitationDeepLink.value = null
                _pendingRouteDeepLink.value = null
                return
            }
            is InvitationEntry.Handoff -> {
                // Handed to the coordinator to redeem. It names nobody here, so there is nothing
                // to route on yet — but it must not be dropped, which is what used to happen.
                _rejectedInvitation.value = null
                _pendingInvitationEntry.value = entry
                _pendingRouteDeepLink.value = null
                return
            }
            is InvitationEntry.PrivateInvitation -> {
                _rejectedInvitation.value = null
                _pendingInvitationEntry.value = entry
            }
            null -> Unit
        }

        when (val deepLink = NativeDeepLinkParser.parse(rawUrl)) {
            is NativeDeepLink.Invitation -> {
                _pendingInvitationDeepLink.value = deepLink.value
                _pendingRouteDeepLink.value = null
                _selectedTab.value = AppTab.HOME
            }
            is NativeDeepLink.Pass -> {
                _pendingInvitationDeepLink.value = null
                _pendingRouteDeepLink.value = deepLink
                _selectedTab.value = AppTab.WEDDING_DAY
            }
            is NativeDeepLink.Wedding -> {
                _pendingInvitationDeepLink.value = null
                _pendingRouteDeepLink.value = deepLink
                _selectedTab.value = AppTab.HOME
            }
            is NativeDeepLink.Workspace -> {
                // Held unresolved: the root gates it against role/context before navigating.
                _pendingInvitationDeepLink.value = null
                _pendingRouteDeepLink.value = deepLink
            }
            null -> Unit
        }
    }

    fun consumePendingInvitationDeepLink() {
        _pendingInvitationDeepLink.value = null
    }

    fun consumePendingRouteDeepLink() {
        _pendingRouteDeepLink.value = null
    }

    fun selectTab(tab: AppTab) {
        _selectedTab.value = tab
    }

    companion object {
        /**
         * Builds the repositories for an environment, or reports why it could not.
         *
         * Constructing a PRIVATE_REAL_SHADOW repository on a device where the protected snapshot
         * is not provisioned threw out of `MainActivity.onCreate` and killed the process — the app
         * simply vanished back to the launcher, with nothing to tell anyone what was wrong. The
         * refusal to fall back to demo data is correct and stays; the crash is not.
         *
         * Returns null on failure, with [lastEnvironmentFailure] carrying the reason.
         */
        @Volatile
        var lastEnvironmentFailure: String? = null
            private set

        fun fromEnvironmentOrNull(
            environment: NativeDataEnvironment,
            baseUrl: String? = null
        ): AppViewModel? = runCatching { fromEnvironment(environment, baseUrl) }
            .onSuccess { lastEnvironmentFailure = null }
            .onFailure { lastEnvironmentFailure = it.message ?: "This data environment could not be opened." }
            .getOrNull()

        fun fromEnvironment(
            environment: NativeDataEnvironment,
            baseUrl: String? = null
        ): AppViewModel {
            val bundle = pro.wewed.app.services.NativeRepositoryFactory.make(environment, baseUrl)
            return AppViewModel(
                baseRepository = bundle.wedding,
                plannerRepository = bundle.planner,
                dataEnvironment = bundle.environment,
                dataBaseUrl = bundle.baseUrl
            )
        }
    }
}
