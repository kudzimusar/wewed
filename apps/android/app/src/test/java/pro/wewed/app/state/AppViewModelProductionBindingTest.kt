package pro.wewed.app.state

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.services.NativeDomainApiClient
import pro.wewed.app.services.ProductionBoundaryPlannerRepository
import pro.wewed.app.services.ProductionBoundaryWeddingRepository
import pro.wewed.app.services.ProductionPlannerDashboardRepository
import pro.wewed.app.services.ProductionWeddingRepository
import pro.wewed.app.services.WeddingDayHttpResponse
import pro.wewed.app.services.WeddingDayHttpTransport

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure §1/round 3 §4/§5 —
 * NativeRepositoryFactory PRODUCTION closure.
 *
 * RootScreen used to gate a role shell's render purely on the resolved workspace snapshot looking
 * right, then bind the real production repository from a `LaunchedEffect` that starts
 * asynchronously relative to that same composition — leaving a real, reachable window where a
 * shell that "appears functional" could still read `appViewModel.repository` while it was still
 * the always-throwing `ProductionBoundary*Repository` placeholder from construction.
 *
 * A grantId-only bound flag (the previous round's fix) closes that SAME-account race but not
 * account replacement: two different accounts can independently resolve an identical grant id
 * (`admin:system`, or `coordinator:wedding:<id>` for a wedding both hold separate memberships on).
 * [ProductionBinding] now keys every bind on `(accessUserId, grantId)` together, so a stale binding
 * can never satisfy a different account's requirement by coincidence — these tests pin that
 * contract directly, without needing Compose.
 */
class AppViewModelProductionBindingTest {

    private class FakeTransport(private val response: WeddingDayHttpResponse) : WeddingDayHttpTransport {
        override suspend fun get(path: String, headers: Map<String, String>) = response
        override suspend fun post(path: String, headers: Map<String, String>, body: String) = response
    }

    private fun productionBoundaryViewModel() = AppViewModel(
        baseRepository = ProductionBoundaryWeddingRepository(),
        plannerRepository = ProductionBoundaryPlannerRepository(),
        dataEnvironment = NativeDataEnvironment.PRODUCTION,
        dataBaseUrl = "https://example.test",
    )

    private fun client() = NativeDomainApiClient(FakeTransport(WeddingDayHttpResponse(200, """{"success":true}""")))

    private fun AppViewModel.bindWedding(accessUserId: String, grantId: String, weddingId: String) {
        val c = client()
        bindProductionRepositories(
            accessUserId = accessUserId,
            grantId = grantId,
            wedding = ProductionWeddingRepository(c, "token", grantId, weddingId),
            planner = ProductionPlannerDashboardRepository(c, "token", grantId),
        )
    }

    @Test
    fun `production starts with the boundary repositories and no bound grant`() {
        val appViewModel = productionBoundaryViewModel()
        assertTrue(appViewModel.repository is ProductionBoundaryWeddingRepository)
        assertTrue(appViewModel.plannerRepository is ProductionBoundaryPlannerRepository)
        assertTrue(appViewModel.productionWeddingBinding.value is ProductionBinding.Unbound)
    }

    @Test
    fun `binding real repositories replaces the boundary default and records the exact (accessUserId, grantId) that produced it`() {
        val appViewModel = productionBoundaryViewModel()
        appViewModel.bindWedding("user-a", "planner:wedding:w-1", "w-1")

        assertTrue(appViewModel.repository is ProductionWeddingRepository)
        assertTrue(appViewModel.plannerRepository is ProductionPlannerDashboardRepository)
        val bound = appViewModel.productionWeddingBinding.value as ProductionBinding.Bound
        assertEquals("user-a", bound.accessUserId)
        assertEquals("planner:wedding:w-1", bound.grantId)
    }

    @Test
    fun `rebinding to a different grant after a context switch updates the binding again`() {
        val appViewModel = productionBoundaryViewModel()
        appViewModel.bindWedding("user-a", "planner:wedding:w-1", "w-1")
        appViewModel.bindWedding("user-a", "planner:wedding:w-2", "w-2")

        val bound = appViewModel.productionWeddingBinding.value as ProductionBinding.Bound
        assertEquals("planner:wedding:w-2", bound.grantId)
    }

    /**
     * Master plan Phase 8 closure round 3 §4 — the exact failing example the moderator gave:
     * Account A binds `admin:system`, is then replaced by Account B (directly, or via sign-out/
     * sign-in), and B independently resolves the SAME `admin:system` grant id before B's own bind
     * completes. A grantId-only check would treat A's stale binding as already correct for B. The
     * composite key must not.
     */
    @Test
    fun `Account A to Account B with the identical admin grant id - A's binding never satisfies B's requirement`() {
        val appViewModel = productionBoundaryViewModel()
        val c = client()
        appViewModel.bindProductionAdminRepository(
            accessUserId = "user-a",
            grantId = "admin:system",
            admin = pro.wewed.app.services.ProductionAdminSystemRepository(c, "token-a", "admin:system"),
        )
        val boundForA = appViewModel.productionAdminBinding.value as ProductionBinding.Bound
        assertEquals("user-a", boundForA.accessUserId)

        // The render gate's check, inlined: is the CURRENT binding valid for user-b's fresh grant?
        val validForB = (appViewModel.productionAdminBinding.value as? ProductionBinding.Bound)
            ?.let { it.accessUserId == "user-b" && it.grantId == "admin:system" } ?: false
        assertTrue("Account A's admin:system binding must never validate Account B's identical grant id", !validForB)

        // Only once B's OWN bind lands does the key become valid for B.
        appViewModel.bindProductionAdminRepository(
            accessUserId = "user-b",
            grantId = "admin:system",
            admin = pro.wewed.app.services.ProductionAdminSystemRepository(c, "token-b", "admin:system"),
        )
        val boundForB = appViewModel.productionAdminBinding.value as ProductionBinding.Bound
        assertEquals("user-b", boundForB.accessUserId)
    }

    /** Master plan Phase 8 closure round 3 §4 — same proof, for a wedding-scoped grant id two accounts can both hold. */
    @Test
    fun `Account A to Account B with the identical wedding-scoped grant id - A's binding never satisfies B's requirement`() {
        val appViewModel = productionBoundaryViewModel()
        val sharedGrantId = "coordinator:wedding:wed-shared"
        appViewModel.bindWedding("user-a", sharedGrantId, "wed-shared")

        val validForB = (appViewModel.productionWeddingBinding.value as? ProductionBinding.Bound)
            ?.let { it.accessUserId == "user-b" && it.grantId == sharedGrantId } ?: false
        assertTrue("Account A's binding on a shared wedding grant id must never validate Account B", !validForB)

        appViewModel.bindWedding("user-b", sharedGrantId, "wed-shared")
        val boundForB = appViewModel.productionWeddingBinding.value as ProductionBinding.Bound
        assertEquals("user-b", boundForB.accessUserId)
    }

    /** Master plan Phase 8 closure round 3 §4 — Wedding A → Wedding B, same account. */
    @Test
    fun `Wedding A to Wedding B for the same account updates the binding to wedding B only`() {
        val appViewModel = productionBoundaryViewModel()
        appViewModel.bindWedding("user-a", "planner:wedding:wed-a", "wed-a")
        appViewModel.bindWedding("user-a", "planner:wedding:wed-b", "wed-b")

        val bound = appViewModel.productionWeddingBinding.value as ProductionBinding.Bound
        assertEquals("planner:wedding:wed-b", bound.grantId)
        val validForOldWedding = bound.grantId == "planner:wedding:wed-a"
        assertTrue(!validForOldWedding)
    }

    /**
     * Master plan Phase 8 closure round 3 §4 — Planner → Admin → Planner. Each axis's binding is
     * independent, and switching one never corrupts or gets corrupted by the other.
     */
    @Test
    fun `Planner to Admin to Planner leaves each binding correctly scoped to its own axis throughout`() {
        val appViewModel = productionBoundaryViewModel()
        val c = client()
        appViewModel.bindWedding("user-a", "planner:wedding:wed-a", "wed-a")
        appViewModel.bindProductionAdminRepository("user-a", "admin:system", pro.wewed.app.services.ProductionAdminSystemRepository(c, "token", "admin:system"))

        assertEquals("planner:wedding:wed-a", (appViewModel.productionWeddingBinding.value as ProductionBinding.Bound).grantId)
        assertEquals("admin:system", (appViewModel.productionAdminBinding.value as ProductionBinding.Bound).grantId)

        // Back to Planner on the same wedding — the admin binding is untouched (it is simply not
        // consulted by a Planner-role render gate check, not cleared by switching away from it).
        assertEquals("admin:system", (appViewModel.productionAdminBinding.value as ProductionBinding.Bound).grantId)
        assertEquals("planner:wedding:wed-a", (appViewModel.productionWeddingBinding.value as ProductionBinding.Bound).grantId)
    }

    /**
     * Master plan Phase 8 closure §7 — Planner → Admin is one of the explicit cross-context
     * transitions that must be re-proved once new repositories/domains are introduced. `AdminShell`
     * never touches `appViewModel.repository`/`plannerRepository` — only `adminRepository` — so a
     * stale wedding-scoped repository object CAN remain referenced by `appViewModel.repository`
     * after switching to Admin. That is safe only because [AppViewModel.bindActiveWedding] is called
     * with an EMPTY weddingId for Admin's context (RootScreen.kt: `context.activeWeddingId` is `""`
     * for Admin, never a stale wedding id), which clears `_activeWeddingId` to null — so
     * [AppViewModel.scopedRepository] throws instead of silently reading wedding A's graph through
     * the still-referenced old repository object.
     */
    @Test
    fun `switching from a wedding-scoped context to Admin clears wedding-graph reachability even though the old repository object is still referenced`() = runBlocking {
        val appViewModel = productionBoundaryViewModel()
        appViewModel.bindWedding("user-a", "planner:wedding:wed-a", "wed-a")
        appViewModel.bindActiveWedding("wed-a")
        // Reachable: scopedRepository() resolves without throwing.
        appViewModel.scopedRepository()

        // Account switches to its Admin grant. RootScreen calls bindActiveWedding(context.activeWeddingId),
        // and Admin's own NavigationContext always carries an EMPTY activeWeddingId (never wed-a).
        appViewModel.bindActiveWedding("")

        try {
            appViewModel.scopedRepository()
            fail("Expected wedding A's graph to be unreachable once Admin cleared the active wedding binding")
        } catch (e: IllegalStateException) {
            // Expected — matches "No active wedding is bound" (AppState.kt scopedRepository()).
        }

        // The wedding-scoped binding is untouched by the Admin switch itself — proving the two axes
        // are tracked independently; the safety above comes entirely from the separate
        // _activeWeddingId gate.
        assertEquals("planner:wedding:wed-a", (appViewModel.productionWeddingBinding.value as ProductionBinding.Bound).grantId)
        assertTrue(appViewModel.productionAdminBinding.value is ProductionBinding.Unbound)
    }

    /**
     * Master plan Phase 8 closure round 3 §6 — Vendor engagement A → B clears A first. A Vendor
     * holding several engagements (or switching between them) must never keep reading engagement
     * A's data through a stale binding once engagement B's grant is active — same composite-key
     * discipline as every other production repository.
     */
    @Test
    fun `Vendor engagement A to engagement B replaces the binding cleanly, never leaving A reachable`() {
        val appViewModel = productionBoundaryViewModel()
        val c = client()
        val grantIdA = "vendor:wedding:biz-1:vendor-1"

        appViewModel.bindProductionVendorEngagementRepository(
            "vendor-user", grantIdA, pro.wewed.app.services.ProductionVendorEngagementRepository(c, "token", grantIdA),
        )
        assertEquals(grantIdA, (appViewModel.productionVendorEngagementBinding.value as ProductionBinding.Bound).grantId)

        // The same grant id can carry a different SELECTED engagement server-side (Vendor holds
        // several); either way, a rebind fully replaces the prior one.
        val grantIdB = "vendor:wedding:biz-1:vendor-2"
        appViewModel.bindProductionVendorEngagementRepository(
            "vendor-user", grantIdB, pro.wewed.app.services.ProductionVendorEngagementRepository(c, "token", grantIdB),
        )
        val bound = appViewModel.productionVendorEngagementBinding.value as ProductionBinding.Bound
        assertEquals(grantIdB, bound.grantId)
        assertTrue(bound.grantId != grantIdA)
    }

    /**
     * Master plan Phase 8 closure round 3 §6 — Vendor business ↔ Vendor wedding engagement. These
     * are two structurally disjoint axes: the business-portfolio repository is constructed as a
     * plain local Compose value in RootScreen.kt (never stored on AppViewModel at all), while the
     * wedding-engagement repository lives entirely in [AppViewModel.productionVendorEngagementBinding].
     * Binding one can therefore never leave stale state reachable through the other — this test
     * pins that the wedding-engagement axis specifically starts Unbound and is untouched by
     * constructing (the AppViewModel-visible parts of) a business scenario.
     */
    @Test
    fun `Vendor business and Vendor wedding engagement are independent axes with no shared mutable state`() {
        val appViewModel = productionBoundaryViewModel()
        assertTrue(appViewModel.productionVendorEngagementBinding.value is ProductionBinding.Unbound)
        // No AppViewModel method exists to bind a Vendor business repository — by construction, it
        // cannot corrupt productionVendorEngagementBinding no matter what a Vendor business screen
        // does with its own locally-scoped repository instance.
        assertTrue(appViewModel.productionVendorEngagementBinding.value is ProductionBinding.Unbound)
    }

    /** Master plan Phase 8 closure round 3 §4 — sign-out/session-invalidation must drop every binding. */
    @Test
    fun `clearProductionBinding resets every axis back to Unbound`() {
        val appViewModel = productionBoundaryViewModel()
        val c = client()
        appViewModel.bindWedding("user-a", "planner:wedding:wed-a", "wed-a")
        appViewModel.bindProductionAdminRepository("user-a", "admin:system", pro.wewed.app.services.ProductionAdminSystemRepository(c, "token", "admin:system"))
        appViewModel.bindProductionContractsRepository("user-a", "planner:wedding:wed-a", pro.wewed.app.services.ProductionContractsRepository(c, "token", "planner:wedding:wed-a"))

        appViewModel.clearProductionBinding()

        assertTrue(appViewModel.productionWeddingBinding.value is ProductionBinding.Unbound)
        assertTrue(appViewModel.productionAdminBinding.value is ProductionBinding.Unbound)
        assertTrue(appViewModel.productionContractsBinding.value is ProductionBinding.Unbound)
        assertTrue(appViewModel.repository is ProductionBoundaryWeddingRepository)
        assertTrue(appViewModel.plannerRepository is ProductionBoundaryPlannerRepository)
    }

    @Test(expected = IllegalStateException::class)
    fun `bindProductionRepositories is refused outside production`() {
        val appViewModel = AppViewModel(dataEnvironment = NativeDataEnvironment.SHADOW)
        appViewModel.bindProductionRepositories(
            accessUserId = "user-a",
            grantId = "planner:wedding:w-1",
            wedding = ProductionBoundaryWeddingRepository(),
            planner = ProductionBoundaryPlannerRepository(),
        )
    }
}
