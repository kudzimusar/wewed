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
import pro.wewed.app.services.ContractsRepository
import pro.wewed.app.services.EmptyContractsRepository
import pro.wewed.app.services.FixturePlannerDashboardRepository
import pro.wewed.app.services.FixtureWeddingRepository
import pro.wewed.app.services.PlannerDashboardRepository
import pro.wewed.app.services.NativeEnvironmentGuard
import pro.wewed.app.services.NativeRepositoryFactory
import pro.wewed.app.services.NativeRepositoryOutcome
import pro.wewed.app.services.EmptyVendorEngagementRepository
import pro.wewed.app.services.ShadowAdminSystemRepository
import pro.wewed.app.services.VendorEngagementRepository
import pro.wewed.app.services.WeddingDayGateAwareRepository
import pro.wewed.app.services.WeddingDayGateOperations
import pro.wewed.app.services.ScopedWeddingRepository
import pro.wewed.app.services.WeddingRepository
import pro.wewed.app.services.forWedding

/**
 * Master plan Phase 8 closure round 3 §4/§5, hardened in round 4 §1 — one repository domain, three
 * states: never bound at all in this process ([Unbound]), or bound to a specific, verified
 * `(accessUserId, grantId[, engagementId])` key ([Bound]). A `grantId` string alone is not account-
 * scoped — two different accounts can independently resolve an identical grant id (`admin:system`,
 * or `coordinator:wedding:<id>` for a wedding both genuinely have separate memberships on) — so
 * comparing `grantId` alone cannot tell "this is still Account A's binding" apart from "Account B's
 * grantId happens to coincide". Carrying `accessUserId` in the same key makes that structurally
 * impossible: two different accounts never share one, so a stale binding can never satisfy a fresh
 * account's requirement by coincidence. [engagementId] extends the same discipline one level
 * further for the ONE domain where a single `(accessUserId, grantId)` pair can legitimately serve
 * more than one live value: a Vendor's `vendor:wedding:...` grant may carry several
 * `serviceEngagementIds`, so the engagement actually selected is part of the binding identity too,
 * not just an argument baked into the bound value.
 */
sealed interface ProductionBinding<out T> {
    data object Unbound : ProductionBinding<Nothing>
    data class Bound<T>(
        val accessUserId: String,
        val grantId: String,
        val value: T,
        val engagementId: String? = null,
    ) : ProductionBinding<T>
}

/**
 * Master plan Phase 8 closure round 4 §1 — thrown when a production role shell (or anything else)
 * reads a mature-domain repository property before [ProductionBinding.Bound] exists for that
 * domain. This is deliberately NOT the same type `ProductionReadOnlyDomainUnavailable` uses for "a
 * bound repository's live call just failed" — those are different facts (never bound vs. bound-but-
 * failing), and the render gate in `RootScreen.kt` is what is supposed to make this exception
 * unreachable in practice by waiting for [ProductionBinding.Bound] before ever composing a role
 * shell; reaching this exception at all means that gate has a bug, not that a network call failed.
 */
class ProductionRepositoryUnbound(domain: String) : IllegalStateException(
    "This production $domain repository is not yet bound to a verified account and grant. " +
        "A role shell must wait for ProductionBinding.Bound before reading it."
)

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
    baseRepository: WeddingRepository? = null,
    plannerRepository: PlannerDashboardRepository? = null,
    val dataEnvironment: NativeDataEnvironment = NativeDataEnvironment.FIXTURE,
    val dataBaseUrl: String? = null,
    val weddingDayGate: WeddingDayGateOperations? = null
) {
    init {
        NativeEnvironmentGuard.validate(dataBaseUrl, dataEnvironment)
        // Master plan Phase 8 closure round 4 §1 — every non-production environment has a real,
        // fixed repository pair for its whole lifetime; only PRODUCTION legitimately starts with
        // none (there is no verified account/grant yet at construction time).
        if (dataEnvironment != NativeDataEnvironment.PRODUCTION) {
            checkNotNull(baseRepository) { "baseRepository is required outside PRODUCTION." }
            checkNotNull(plannerRepository) { "plannerRepository is required outside PRODUCTION." }
        }
    }

    // Fixed for the app's lifetime outside PRODUCTION — nothing below changes Shadow/Fixture/
    // PRIVATE_REAL_SHADOW behavior at all. Null exactly when dataEnvironment == PRODUCTION (the
    // `init` check above guarantees these are non-null everywhere else, so every read below that is
    // guarded by `dataEnvironment != PRODUCTION` is safe).
    private val nonProductionRepository: WeddingRepository? =
        baseRepository?.let { if (weddingDayGate != null) WeddingDayGateAwareRepository(it, weddingDayGate) else it }
    private val nonProductionPlannerRepository: PlannerDashboardRepository? = plannerRepository
    private val nonProductionAdminRepository: AdminSystemRepository? =
        nonProductionRepository?.let { ShadowAdminSystemRepository(it, dataEnvironment) }
    private val nonProductionContractsRepository: ContractsRepository = EmptyContractsRepository
    private val nonProductionVendorEngagementRepository: VendorEngagementRepository = EmptyVendorEngagementRepository

    /**
     * Master plan Phase 8 closure round 3 §4/§5 (NativeRepositoryFactory.PRODUCTION closure).
     *
     * PRODUCTION no longer represents "unbound" merely by defaulting to a `ProductionBoundary*
     * Repository` instance that is, by its type, indistinguishable from a real one sitting behind
     * `var repository`/`plannerRepository`/`adminRepository`. [ProductionBinding.Unbound] is now the
     * explicit, type-checked default, and the properties below derive their value from it on every
     * read rather than being separately-mutated `var`s that could in principle drift out of sync
     * with each other or with a same-shaped `boundXGrantId` flag. See [ProductionBinding]'s own doc
     * for why the key is `(accessUserId, grantId)`, not `grantId` alone.
     */
    private val _productionWeddingBinding =
        MutableStateFlow<ProductionBinding<Pair<WeddingRepository, PlannerDashboardRepository>>>(ProductionBinding.Unbound)
    val productionWeddingBinding: StateFlow<ProductionBinding<Pair<WeddingRepository, PlannerDashboardRepository>>> =
        _productionWeddingBinding.asStateFlow()

    private val _productionAdminBinding =
        MutableStateFlow<ProductionBinding<AdminSystemRepository>>(ProductionBinding.Unbound)
    val productionAdminBinding: StateFlow<ProductionBinding<AdminSystemRepository>> =
        _productionAdminBinding.asStateFlow()

    /** Master plan Phase 8 closure round 3 §3 — same binding discipline, for Contracts/Deal-Room. */
    private val _productionContractsBinding =
        MutableStateFlow<ProductionBinding<ContractsRepository>>(ProductionBinding.Unbound)
    val productionContractsBinding: StateFlow<ProductionBinding<ContractsRepository>> =
        _productionContractsBinding.asStateFlow()

    /** Master plan Phase 8 closure round 3 §6 — same binding discipline, for the Vendor's own wedding engagement. */
    private val _productionVendorEngagementBinding =
        MutableStateFlow<ProductionBinding<VendorEngagementRepository>>(ProductionBinding.Unbound)
    val productionVendorEngagementBinding: StateFlow<ProductionBinding<VendorEngagementRepository>> =
        _productionVendorEngagementBinding.asStateFlow()

    /**
     * The repository a role shell actually reads. Master plan Phase 8 closure round 4 §1 — while
     * [productionWeddingBinding] is [ProductionBinding.Unbound], this THROWS [ProductionRepositoryUnbound]
     * rather than handing back a same-typed boundary placeholder: a caller cannot obtain a
     * `WeddingRepository` value at all until a real binding exists, so "unbound" can never be
     * mistaken for "bound to something that happens to always fail". `RootScreen.kt`'s render gate
     * waits for the confirmed binding before any role shell is composed, so this is not expected to
     * ever actually throw in normal operation — reaching it means that gate has a bug. Every other
     * environment always returns the same constructor-supplied repository, unchanged.
     */
    val repository: WeddingRepository
        get() = if (dataEnvironment == NativeDataEnvironment.PRODUCTION) {
            (_productionWeddingBinding.value as? ProductionBinding.Bound)?.value?.first
                ?: throw ProductionRepositoryUnbound("wedding")
        } else nonProductionRepository!!

    val plannerRepository: PlannerDashboardRepository
        get() = if (dataEnvironment == NativeDataEnvironment.PRODUCTION) {
            (_productionWeddingBinding.value as? ProductionBinding.Bound)?.value?.second
                ?: throw ProductionRepositoryUnbound("planner")
        } else nonProductionPlannerRepository!!

    /**
     * Master plan Phase 8 closure §B/§12, hardened round 4 §1 — never `ShadowAdminSystemRepository`
     * in production, and never a same-typed boundary placeholder either; throws
     * [ProductionRepositoryUnbound] while unbound. Non-production keeps the existing Shadow-over-
     * wedding-graph behavior unchanged.
     */
    val adminRepository: AdminSystemRepository
        get() = if (dataEnvironment == NativeDataEnvironment.PRODUCTION) {
            (_productionAdminBinding.value as? ProductionBinding.Bound)?.value
                ?: throw ProductionRepositoryUnbound("admin")
        } else nonProductionAdminRepository!!

    /** Master plan Phase 8 closure round 3 §3, hardened round 4 §1 — Contracts/Deal-Room, same pattern as Admin. */
    val contractsRepository: ContractsRepository
        get() = if (dataEnvironment == NativeDataEnvironment.PRODUCTION) {
            (_productionContractsBinding.value as? ProductionBinding.Bound)?.value
                ?: throw ProductionRepositoryUnbound("contracts")
        } else nonProductionContractsRepository

    /**
     * Master plan Phase 8 closure round 3 §6, hardened round 4 §1/§2 — the Vendor's own wedding
     * engagement, same pattern. [productionVendorEngagementBinding]'s own `Bound.engagementId`
     * additionally exposes WHICH engagement is currently bound, so `RootScreen.kt`'s render gate can
     * confirm it matches the one actually selected before treating this repository as current.
     */
    val vendorEngagementRepository: VendorEngagementRepository
        get() = if (dataEnvironment == NativeDataEnvironment.PRODUCTION) {
            (_productionVendorEngagementBinding.value as? ProductionBinding.Bound)?.value
                ?: throw ProductionRepositoryUnbound("vendor engagement")
        } else nonProductionVendorEngagementRepository

    /**
     * Master plan Phase 8 — rebinds this view model's domain repositories to real, grant-scoped
     * production adapters once a wedding-scoped grant is active, and [accessUserId] to the account
     * that resolved them. Only ever called for `dataEnvironment == PRODUCTION`; every other
     * environment keeps its constructor-supplied repositories for the whole app lifetime, exactly as
     * before. The Wedding Day gate wrapper, if any, is preserved around the new base repository so
     * operational fail-closed behavior is unchanged.
     */
    fun bindProductionRepositories(accessUserId: String, grantId: String, wedding: WeddingRepository, planner: PlannerDashboardRepository) {
        check(dataEnvironment == NativeDataEnvironment.PRODUCTION) {
            "bindProductionRepositories is only valid for the PRODUCTION environment."
        }
        val gated = if (weddingDayGate != null) WeddingDayGateAwareRepository(wedding, weddingDayGate) else wedding
        _productionWeddingBinding.value = ProductionBinding.Bound(accessUserId, grantId, gated to planner)
    }

    /** Master plan Phase 8 closure §B/§1 — rebinds Admin to a real, grant-scoped production adapter. */
    fun bindProductionAdminRepository(accessUserId: String, grantId: String, admin: AdminSystemRepository) {
        check(dataEnvironment == NativeDataEnvironment.PRODUCTION) {
            "bindProductionAdminRepository is only valid for the PRODUCTION environment."
        }
        _productionAdminBinding.value = ProductionBinding.Bound(accessUserId, grantId, admin)
    }

    /** Master plan Phase 8 closure round 3 §3 — rebinds Contracts to a real, grant-scoped adapter. */
    fun bindProductionContractsRepository(accessUserId: String, grantId: String, contracts: ContractsRepository) {
        check(dataEnvironment == NativeDataEnvironment.PRODUCTION) {
            "bindProductionContractsRepository is only valid for the PRODUCTION environment."
        }
        _productionContractsBinding.value = ProductionBinding.Bound(accessUserId, grantId, contracts)
    }

    /**
     * Master plan Phase 8 closure round 3 §6, hardened round 4 §2 — rebinds the Vendor's own wedding
     * engagement. [engagementId] is part of the binding key (not just baked into [engagement]'s own
     * closure) because one `(accessUserId, grantId)` pair can legitimately serve more than one
     * engagement — a Vendor's grant may carry several `serviceEngagementIds` — so switching the
     * SELECTED engagement while the grant id stays the same must still be a distinguishable rebind,
     * not something the render gate could mistake for "nothing changed".
     */
    fun bindProductionVendorEngagementRepository(accessUserId: String, grantId: String, engagementId: String?, engagement: VendorEngagementRepository) {
        check(dataEnvironment == NativeDataEnvironment.PRODUCTION) {
            "bindProductionVendorEngagementRepository is only valid for the PRODUCTION environment."
        }
        _productionVendorEngagementBinding.value = ProductionBinding.Bound(accessUserId, grantId, engagement, engagementId)
    }

    /**
     * Master plan Phase 8 closure round 3 §4 — explicit, synchronous clear for sign-out/session-
     * invalidation/account replacement, so no bound repository (and the bearer token closed over
     * inside it) is reachable any longer than necessary. The `(accessUserId, grantId)` key on
     * [ProductionBinding.Bound] already makes a stale binding harmless for a *different* account by
     * construction even without this — but this drops the actual objects rather than leaving them
     * reachable in memory, and covers the same-account "authority became unusable" case too.
     */
    fun clearProductionBinding() {
        if (dataEnvironment != NativeDataEnvironment.PRODUCTION) return
        _productionWeddingBinding.value = ProductionBinding.Unbound
        _productionAdminBinding.value = ProductionBinding.Unbound
        _productionContractsBinding.value = ProductionBinding.Unbound
        _productionVendorEngagementBinding.value = ProductionBinding.Unbound
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
            // Master plan Phase 8 closure round 4 §1 — a ProductionBootstrap outcome carries no
            // wedding/planner repository at all; AppViewModel is constructed with none, and every
            // mature repository property throws ProductionRepositoryUnbound until a real
            // ProductionBinding.Bound exists.
            return when (val outcome = NativeRepositoryFactory.make(environment, baseUrl)) {
                is NativeRepositoryOutcome.NonProduction -> AppViewModel(
                    baseRepository = outcome.wedding,
                    plannerRepository = outcome.planner,
                    dataEnvironment = outcome.environment,
                    dataBaseUrl = outcome.baseUrl
                )
                is NativeRepositoryOutcome.ProductionBootstrap -> AppViewModel(
                    baseRepository = null,
                    plannerRepository = null,
                    dataEnvironment = NativeDataEnvironment.PRODUCTION,
                    dataBaseUrl = outcome.baseUrl
                )
            }
        }
    }
}
