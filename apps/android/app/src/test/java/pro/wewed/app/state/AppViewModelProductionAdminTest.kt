package pro.wewed.app.state

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.services.NativeDomainApiClient
import pro.wewed.app.services.ProductionAdminSystemRepository
import pro.wewed.app.services.ProductionBoundaryAdminSystemRepository
import pro.wewed.app.services.ShadowAdminSystemRepository
import pro.wewed.app.services.WeddingDayHttpResponse
import pro.wewed.app.services.WeddingDayHttpTransport

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure §B/§12/§13.
 *
 * `AppViewModel.adminRepository` must never be `ShadowAdminSystemRepository` in production, and
 * must become the real `ProductionAdminSystemRepository` once bound — this is exactly the defect
 * the moderator flagged in `AdminShell` (it used to construct `ShadowAdminSystemRepository`
 * unconditionally). Non-production keeps its existing Shadow-over-wedding-graph default.
 */
class AppViewModelProductionAdminTest {

    private class FakeTransport(private val response: WeddingDayHttpResponse) : WeddingDayHttpTransport {
        override suspend fun get(path: String, headers: Map<String, String>) = response
        override suspend fun post(path: String, headers: Map<String, String>, body: String) = response
    }

    @Test
    fun `production defaults to the boundary admin repository, never Shadow`() {
        val appViewModel = AppViewModel(dataEnvironment = NativeDataEnvironment.PRODUCTION, dataBaseUrl = "https://example.test")
        assertTrue(appViewModel.adminRepository is ProductionBoundaryAdminSystemRepository)
        assertTrue(appViewModel.adminRepository !is ShadowAdminSystemRepository)
    }

    @Test
    fun `non-production keeps the existing Shadow admin repository`() {
        val appViewModel = AppViewModel(dataEnvironment = NativeDataEnvironment.SHADOW)
        assertTrue(appViewModel.adminRepository is ShadowAdminSystemRepository)
    }

    @Test
    fun `binding a real admin repository in production replaces the boundary default`() = runBlocking {
        val appViewModel = AppViewModel(dataEnvironment = NativeDataEnvironment.PRODUCTION, dataBaseUrl = "https://example.test")
        val response = WeddingDayHttpResponse(200, """{"success":true,"scopeKind":"system","platformRoles":["wewed_super_admin"],"counts":{"pendingOnboarding":2}}""")
        val client = NativeDomainApiClient(FakeTransport(response))
        appViewModel.bindProductionAdminRepository(ProductionAdminSystemRepository(client, "token", "admin:system"))

        assertTrue(appViewModel.adminRepository is ProductionAdminSystemRepository)
        assertEquals(2, appViewModel.adminRepository.snapshot().pendingOnboardingCount)
    }

    @Test
    fun `an unbound production boundary admin repository is honestly null, never a fabricated zero`() = runBlocking {
        val appViewModel = AppViewModel(dataEnvironment = NativeDataEnvironment.PRODUCTION, dataBaseUrl = "https://example.test")
        assertNull(appViewModel.adminRepository.snapshot().pendingOnboardingCount)
    }

    @Test(expected = IllegalStateException::class)
    fun `bindProductionAdminRepository is refused outside production`() {
        val appViewModel = AppViewModel(dataEnvironment = NativeDataEnvironment.SHADOW)
        appViewModel.bindProductionAdminRepository(ProductionBoundaryAdminSystemRepository())
    }
}
