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
        appViewModel.bindProductionAdminRepository("admin:system", ProductionAdminSystemRepository(client, "token", "admin:system"))

        assertTrue(appViewModel.adminRepository is ProductionAdminSystemRepository)
        assertEquals(2, appViewModel.adminRepository.snapshot().pendingOnboardingCount)
        assertEquals("admin:system", appViewModel.boundAdminGrantId.value)
    }

    @Test
    fun `an unbound production boundary admin repository is honestly null, never a fabricated zero`() = runBlocking {
        val appViewModel = AppViewModel(dataEnvironment = NativeDataEnvironment.PRODUCTION, dataBaseUrl = "https://example.test")
        assertNull(appViewModel.adminRepository.snapshot().pendingOnboardingCount)
    }

    @Test(expected = IllegalStateException::class)
    fun `bindProductionAdminRepository is refused outside production`() {
        val appViewModel = AppViewModel(dataEnvironment = NativeDataEnvironment.SHADOW)
        appViewModel.bindProductionAdminRepository("admin:system", ProductionBoundaryAdminSystemRepository())
    }

    /**
     * Master plan Phase 8 closure §1 (NativeRepositoryFactory.PRODUCTION closure). RootScreen's
     * render gate for AppRole.ADMIN now waits for `boundAdminGrantId == activeGrantId` before
     * composing AdminShell, specifically so a shell that "appears functional" can never be backed
     * by the always-throwing boundary repository during the async window between a workspace
     * snapshot resolving and this bind actually executing. This test proves the flag itself is an
     * honest, order-correct signal: null before any bind, and only ever the grantId of a
     * completed bind afterward.
     */
    @Test
    fun `boundAdminGrantId is null until bound and then reflects the bound grant exactly`() {
        val appViewModel = AppViewModel(dataEnvironment = NativeDataEnvironment.PRODUCTION, dataBaseUrl = "https://example.test")
        assertNull(appViewModel.boundAdminGrantId.value)

        val response = WeddingDayHttpResponse(200, """{"success":true,"scopeKind":"system","platformRoles":["wewed_super_admin"],"counts":{"pendingOnboarding":0}}""")
        val client = NativeDomainApiClient(FakeTransport(response))
        appViewModel.bindProductionAdminRepository("admin:system:acct-9", ProductionAdminSystemRepository(client, "token", "admin:system:acct-9"))

        assertEquals("admin:system:acct-9", appViewModel.boundAdminGrantId.value)
    }
}
