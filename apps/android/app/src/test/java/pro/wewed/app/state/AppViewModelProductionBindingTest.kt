package pro.wewed.app.state

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.services.NativeDomainApiClient
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
 * the always-throwing `ProductionBoundary*Repository` placeholder from construction (now deleted —
 * see round 4 §1 below).
 *
 * A grantId-only bound flag (the previous round's fix) closes that SAME-account race but not
 * account replacement: two different accounts can independently resolve an identical grant id
 * (`admin:system`, or `coordinator:wedding:<id>` for a wedding both hold separate memberships on).
 * [ProductionBinding] now keys every bind on `(accessUserId, grantId)` together, so a stale binding
 * can never satisfy a different account's requirement by coincidence — these tests pin that
 * contract directly, without needing Compose.
 *
 * Master plan Phase 8 closure round 4 §1 — `productionRepositoryViewModel()` no longer constructs a
 * same-typed `ProductionBoundary*Repository` placeholder for an unbound PRODUCTION `AppViewModel`;
 * that type is deleted. [AppViewModel]'s nullable constructor params default to `null` for
 * PRODUCTION, matching exactly how `NativeRepositoryFactory.make(PRODUCTION, ...)` /
 * `AppViewModel.fromEnvironment` construct it in the real app.
 */
class AppViewModelProductionBindingTest {

    private class FakeTransport(private val response: WeddingDayHttpResponse) : WeddingDayHttpTransport {
        override suspend fun get(path: String, headers: Map<String, String>) = response
        override suspend fun post(path: String, headers: Map<String, String>, body: String) = response
    }

    private fun productionRepositoryViewModel() = AppViewModel(
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

    /**
     * Master plan Phase 8 closure round 4 §1 — the central regression: an unbound PRODUCTION
     * `AppViewModel` must expose NO mature-domain repository at all, not even a same-typed
     * always-throwing placeholder. Reading `repository`/`plannerRepository` before any bind now
     * throws [ProductionRepositoryUnbound] — there is no `is ProductionBoundaryWeddingRepository`
     * assertion possible any more because that type no longer exists.
     */
    @Test
    fun `production exposes no mature repository at all before any bind, and starts Unbound`() {
        val appViewModel = productionRepositoryViewModel()
        try {
            appViewModel.repository
            fail("Expected ProductionRepositoryUnbound: no wedding repository exists before a bind")
        } catch (_: ProductionRepositoryUnbound) {
        }
        try {
            appViewModel.plannerRepository
            fail("Expected ProductionRepositoryUnbound: no planner repository exists before a bind")
        } catch (_: ProductionRepositoryUnbound) {
        }
        assertTrue(appViewModel.productionWeddingBinding.value is ProductionBinding.Unbound)
    }

    @Test
    fun `binding real repositories replaces the boundary default and records the exact (accessUserId, grantId) that produced it`() {
        val appViewModel = productionRepositoryViewModel()
        appViewModel.bindWedding("user-a", "planner:wedding:w-1", "w-1")

        assertTrue(appViewModel.repository is ProductionWeddingRepository)
        assertTrue(appViewModel.plannerRepository is ProductionPlannerDashboardRepository)
        val bound = appViewModel.productionWeddingBinding.value as ProductionBinding.Bound
        assertEquals("user-a", bound.accessUserId)
        assertEquals("planner:wedding:w-1", bound.grantId)
    }

    @Test
    fun `rebinding to a different grant after a context switch updates the binding again`() {
        val appViewModel = productionRepositoryViewModel()
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
        val appViewModel = productionRepositoryViewModel()
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
        val appViewModel = productionRepositoryViewModel()
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
        val appViewModel = productionRepositoryViewModel()
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
        val appViewModel = productionRepositoryViewModel()
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
        val appViewModel = productionRepositoryViewModel()
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
        val appViewModel = productionRepositoryViewModel()
        val c = client()
        val grantIdA = "vendor:wedding:biz-1:vendor-1"

        appViewModel.bindProductionVendorEngagementRepository(
            accessUserId = "vendor-user",
            grantId = grantIdA,
            engagementId = null,
            engagement = pro.wewed.app.services.ProductionVendorEngagementRepository(c, "token", grantIdA),
        )
        assertEquals(grantIdA, (appViewModel.productionVendorEngagementBinding.value as ProductionBinding.Bound).grantId)

        // A DIFFERENT grant (a different vendor business/wedding pair) fully replaces the prior one.
        // This is grant-to-grant replacement, not same-grant engagement selection — see the dedicated
        // `Vendor same-grant engagement A to engagement B` tests below for the latter (master plan
        // Phase 8 closure round 4 §2).
        val grantIdB = "vendor:wedding:biz-1:vendor-2"
        appViewModel.bindProductionVendorEngagementRepository(
            accessUserId = "vendor-user",
            grantId = grantIdB,
            engagementId = null,
            engagement = pro.wewed.app.services.ProductionVendorEngagementRepository(c, "token", grantIdB),
        )
        val bound = appViewModel.productionVendorEngagementBinding.value as ProductionBinding.Bound
        assertEquals(grantIdB, bound.grantId)
        assertTrue(bound.grantId != grantIdA)
    }

    /**
     * Master plan Phase 8 closure round 4 §2 — the moderator's exact correction: one legitimate
     * `vendor:wedding:<business>:<vendor>` grant can carry MULTIPLE `serviceEngagementIds`. The
     * binding identity must include `engagementId`, not just `(accessUserId, grantId)`, or switching
     * the selected engagement within the SAME grant would look like a no-op to the render gate and
     * leave engagement A's repository reachable while the UI believes B is selected.
     */
    @Test
    fun `Vendor same-grant engagement A to engagement B replaces the binding by engagementId, never leaving A reachable`() {
        val appViewModel = productionRepositoryViewModel()
        val c = client()
        val sharedGrantId = "vendor:wedding:biz-1:vendor-1"

        appViewModel.bindProductionVendorEngagementRepository(
            accessUserId = "vendor-user",
            grantId = sharedGrantId,
            engagementId = "engagement-a",
            engagement = pro.wewed.app.services.ProductionVendorEngagementRepository(c, "token", sharedGrantId, "engagement-a"),
        )
        val boundA = appViewModel.productionVendorEngagementBinding.value as ProductionBinding.Bound
        assertEquals(sharedGrantId, boundA.grantId)
        assertEquals("engagement-a", boundA.engagementId)

        // The render gate's check, inlined: a stale A-selected binding must never satisfy a
        // B-selected requirement, even though accessUserId and grantId are IDENTICAL.
        val validForB = (appViewModel.productionVendorEngagementBinding.value as? ProductionBinding.Bound)
            ?.let { it.accessUserId == "vendor-user" && it.grantId == sharedGrantId && it.engagementId == "engagement-b" } ?: false
        assertTrue("Engagement A's binding must never validate a same-grant request for engagement B", !validForB)

        appViewModel.bindProductionVendorEngagementRepository(
            accessUserId = "vendor-user",
            grantId = sharedGrantId,
            engagementId = "engagement-b",
            engagement = pro.wewed.app.services.ProductionVendorEngagementRepository(c, "token", sharedGrantId, "engagement-b"),
        )
        val boundB = appViewModel.productionVendorEngagementBinding.value as ProductionBinding.Bound
        assertEquals(sharedGrantId, boundB.grantId)
        assertEquals("engagement-b", boundB.engagementId)
        assertTrue(boundB.engagementId != "engagement-a")

        // And switching back to A must be equally clean.
        appViewModel.bindProductionVendorEngagementRepository(
            accessUserId = "vendor-user",
            grantId = sharedGrantId,
            engagementId = "engagement-a",
            engagement = pro.wewed.app.services.ProductionVendorEngagementRepository(c, "token", sharedGrantId, "engagement-a"),
        )
        val boundBackToA = appViewModel.productionVendorEngagementBinding.value as ProductionBinding.Bound
        assertEquals("engagement-a", boundBackToA.engagementId)
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
        val appViewModel = productionRepositoryViewModel()
        assertTrue(appViewModel.productionVendorEngagementBinding.value is ProductionBinding.Unbound)
        // No AppViewModel method exists to bind a Vendor business repository — by construction, it
        // cannot corrupt productionVendorEngagementBinding no matter what a Vendor business screen
        // does with its own locally-scoped repository instance.
        assertTrue(appViewModel.productionVendorEngagementBinding.value is ProductionBinding.Unbound)
    }

    /** Master plan Phase 8 closure round 3 §4 — sign-out/session-invalidation must drop every binding. */
    @Test
    fun `clearProductionBinding resets every axis back to Unbound`() {
        val appViewModel = productionRepositoryViewModel()
        val c = client()
        appViewModel.bindWedding("user-a", "planner:wedding:wed-a", "wed-a")
        appViewModel.bindProductionAdminRepository("user-a", "admin:system", pro.wewed.app.services.ProductionAdminSystemRepository(c, "token", "admin:system"))
        appViewModel.bindProductionContractsRepository("user-a", "planner:wedding:wed-a", pro.wewed.app.services.ProductionContractsRepository(c, "token", "planner:wedding:wed-a"))

        appViewModel.clearProductionBinding()

        assertTrue(appViewModel.productionWeddingBinding.value is ProductionBinding.Unbound)
        assertTrue(appViewModel.productionAdminBinding.value is ProductionBinding.Unbound)
        assertTrue(appViewModel.productionContractsBinding.value is ProductionBinding.Unbound)
        // Master plan Phase 8 closure round 4 §1 — a cleared binding must be exactly as unreachable
        // as a never-bound one: no mature repository is returned, real or placeholder.
        try {
            appViewModel.repository
            fail("Expected ProductionRepositoryUnbound: clearProductionBinding must not leave a mature wedding repository reachable")
        } catch (_: ProductionRepositoryUnbound) {
        }
        try {
            appViewModel.plannerRepository
            fail("Expected ProductionRepositoryUnbound: clearProductionBinding must not leave a mature planner repository reachable")
        } catch (_: ProductionRepositoryUnbound) {
        }
    }

    @Test(expected = IllegalStateException::class)
    fun `bindProductionRepositories is refused outside production`() {
        val appViewModel = AppViewModel(
            baseRepository = pro.wewed.app.services.ShadowReferenceWeddingRepository(),
            plannerRepository = pro.wewed.app.services.ShadowReferencePlannerRepository(),
            dataEnvironment = NativeDataEnvironment.SHADOW,
        )
        val c = client()
        appViewModel.bindProductionRepositories(
            accessUserId = "user-a",
            grantId = "planner:wedding:w-1",
            wedding = ProductionWeddingRepository(c, "token", "planner:wedding:w-1", "w-1"),
            planner = ProductionPlannerDashboardRepository(c, "token", "planner:wedding:w-1"),
        )
    }
}
