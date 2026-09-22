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
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure §1 — NativeRepositoryFactory
 * PRODUCTION closure.
 *
 * RootScreen used to gate a role shell's render purely on the resolved workspace snapshot looking
 * right, then bind the real production repository from a `LaunchedEffect` that starts
 * asynchronously relative to that same composition — leaving a real, reachable window where a
 * shell that "appears functional" could still read `appViewModel.repository` while it was still
 * the always-throwing `ProductionBoundary*Repository` placeholder from construction. `repository`
 * and `plannerRepository` default to that placeholder in PRODUCTION and only [boundProductionGrantId]
 * is the honest, order-correct signal of when the swap has actually happened — these tests pin
 * that contract directly, without needing Compose.
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

    @Test
    fun `production starts with the boundary repositories and no bound grant`() {
        val appViewModel = productionBoundaryViewModel()
        assertTrue(appViewModel.repository is ProductionBoundaryWeddingRepository)
        assertTrue(appViewModel.plannerRepository is ProductionBoundaryPlannerRepository)
        assertNull(appViewModel.boundProductionGrantId.value)
    }

    @Test
    fun `binding real repositories replaces the boundary default and flips boundProductionGrantId to that exact grant`() {
        val appViewModel = productionBoundaryViewModel()
        val response = WeddingDayHttpResponse(200, """{"success":true}""")
        val client = NativeDomainApiClient(FakeTransport(response))

        appViewModel.bindProductionRepositories(
            grantId = "planner:wedding:w-1",
            wedding = ProductionWeddingRepository(client, "token", "planner:wedding:w-1", "w-1"),
            planner = ProductionPlannerDashboardRepository(client, "token", "planner:wedding:w-1"),
        )

        assertTrue(appViewModel.repository is ProductionWeddingRepository)
        assertTrue(appViewModel.plannerRepository is ProductionPlannerDashboardRepository)
        assertEquals("planner:wedding:w-1", appViewModel.boundProductionGrantId.value)
    }

    @Test
    fun `rebinding to a different grant after a context switch updates boundProductionGrantId again`() {
        val appViewModel = productionBoundaryViewModel()
        val response = WeddingDayHttpResponse(200, """{"success":true}""")
        val client = NativeDomainApiClient(FakeTransport(response))

        appViewModel.bindProductionRepositories(
            grantId = "planner:wedding:w-1",
            wedding = ProductionWeddingRepository(client, "token", "planner:wedding:w-1", "w-1"),
            planner = ProductionPlannerDashboardRepository(client, "token", "planner:wedding:w-1"),
        )
        appViewModel.bindProductionRepositories(
            grantId = "planner:wedding:w-2",
            wedding = ProductionWeddingRepository(client, "token", "planner:wedding:w-2", "w-2"),
            planner = ProductionPlannerDashboardRepository(client, "token", "planner:wedding:w-2"),
        )

        // The render gate compares this against the newly active grantId; a stale value here would
        // let a shell for wedding B render while still holding wedding A's bound repository for one
        // frame, exactly the class of cross-context leak master plan §7 forbids.
        assertEquals("planner:wedding:w-2", appViewModel.boundProductionGrantId.value)
    }

    /**
     * Master plan Phase 8 closure §7 — Planner → Admin is one of the explicit cross-context
     * transitions that must be re-proved once new repositories/domains are introduced. `AdminShell`
     * never touches `appViewModel.repository`/`plannerRepository` — only `adminRepository`/
     * `boundAdminGrantId` — so a stale wedding-scoped repository object CAN remain referenced by
     * `appViewModel.repository` after switching to Admin. That is safe only because
     * [AppViewModel.bindActiveWedding] is called with an EMPTY weddingId for Admin's context
     * (RootScreen.kt: `context.activeWeddingId` is `""` for Admin, never a stale wedding id), which
     * clears `_activeWeddingId` to null — so [AppViewModel.scopedRepository] throws instead of
     * silently reading wedding A's graph through the still-referenced old repository object. This
     * test pins that safety property directly rather than leaving it as an unverified inference.
     */
    @Test
    fun `switching from a wedding-scoped context to Admin clears wedding-graph reachability even though the old repository object is still referenced`() = runBlocking {
        val appViewModel = productionBoundaryViewModel()
        val response = WeddingDayHttpResponse(200, """{"success":true}""")
        val client = NativeDomainApiClient(FakeTransport(response))

        // Planner opens wedding A.
        appViewModel.bindProductionRepositories(
            grantId = "planner:wedding:wed-a",
            wedding = ProductionWeddingRepository(client, "token", "planner:wedding:wed-a", "wed-a"),
            planner = ProductionPlannerDashboardRepository(client, "token", "planner:wedding:wed-a"),
        )
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

        // The wedding-scoped repository/bound-grant state is untouched by the Admin switch itself —
        // proving the two axes (wedding vs admin) are tracked independently, not by one clobbering
        // the other; the safety above comes entirely from the separate _activeWeddingId gate.
        assertEquals("planner:wedding:wed-a", appViewModel.boundProductionGrantId.value)
        assertNull(appViewModel.boundAdminGrantId.value)
    }

    @Test(expected = IllegalStateException::class)
    fun `bindProductionRepositories is refused outside production`() {
        val appViewModel = AppViewModel(dataEnvironment = NativeDataEnvironment.SHADOW)
        appViewModel.bindProductionRepositories(
            grantId = "planner:wedding:w-1",
            wedding = ProductionBoundaryWeddingRepository(),
            planner = ProductionBoundaryPlannerRepository(),
        )
    }
}
