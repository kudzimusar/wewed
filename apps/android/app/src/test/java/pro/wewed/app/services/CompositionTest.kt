package pro.wewed.app.services

import org.junit.Assert.*
import org.junit.Test
import pro.wewed.app.models.*
import pro.wewed.app.state.AppComposition
import pro.wewed.app.state.AppCompositionMode
import java.io.File
import kotlin.io.path.createTempDirectory

class CompositionTest {

    @Test
    fun testFixtureModeEnablesDemoSimulations() {
        val comp = AppComposition.fixture()
        assertTrue(comp.showDemoSimulations)
        assertEquals(AppCompositionMode.FIXTURE, comp.mode)
        assertNull(comp.server)
        assertNull(comp.gate)
    }

    @Test
    fun testIsolatedModeEnablesDemoSimulations() {
        val comp = AppComposition.isolatedWeddingDay(
            baseUrl = "http://127.0.0.1:3000",
            bearerToken = "test_bearer",
            weddingId = "wed_test"
        )
        assertTrue(comp.showDemoSimulations)
        assertEquals(AppCompositionMode.ISOLATED_WEDDING_DAY, comp.mode)
        assertNotNull(comp.server)
        assertNotNull(comp.gate)
    }

    @Test
    fun testProductionModeDisablesDemoSimulations() {
        val customRepo = CustomMockWeddingRepository()
        val tempDir = createTempDirectory("wewed_prod_test").toFile()
        val comp = AppComposition.production(
            baseUrl = "http://127.0.0.1:3000",
            bearerToken = "prod_bearer",
            weddingId = "wed_prod",
            trustedRootPublicKeyDerBase64 = "dummyKey",
            base = customRepo,
            storageDir = tempDir
        )
        assertFalse(comp.showDemoSimulations)
        assertEquals(AppCompositionMode.PRODUCTION, comp.mode)
        assertNotNull(comp.server)
        assertNotNull(comp.gate)
    }

    @Test(expected = IllegalArgumentException::class)
    fun testProductionModeRejectsFixtureRepository() {
        val fixtureRepo = FixtureWeddingRepository()
        val tempDir = createTempDirectory("wewed_prod_reject_test").toFile()
        AppComposition.production(
            baseUrl = "http://127.0.0.1:3000",
            bearerToken = "prod_bearer",
            weddingId = "wed_prod",
            trustedRootPublicKeyDerBase64 = "dummyKey",
            base = fixtureRepo,
            storageDir = tempDir
        )
    }

    private class CustomMockWeddingRepository : WeddingRepository {
        override suspend fun getWedding(): Wedding = throw UnsupportedOperationException()
        override suspend fun getTasks(): List<PlannerTask> = emptyList()
        override suspend fun createTask(title: String, priority: TaskPriority, category: String): PlannerTask =
            throw UnsupportedOperationException()
        override suspend fun toggleTask(taskId: String): PlannerTask = throw UnsupportedOperationException()
        override suspend fun getGuests(): List<Guest> = emptyList()
        override suspend fun getBudget(): BudgetSummary =
            BudgetSummary("USD", 0.0, 0.0, 0.0, emptyList())
        override suspend fun getWeddingPass(token: String): WeddingPass = throw UnsupportedOperationException()
        override suspend fun searchGuests(query: String): List<Guest> = emptyList()
        override suspend fun getAuditRecords(): List<CheckInAuditRecord> = emptyList()
        override suspend fun getVendors(): List<VendorPresence> = emptyList()
        override suspend fun updateVendorState(id: String, state: VendorPresenceState): VendorPresence =
            throw UnsupportedOperationException()
        override suspend fun getAnnouncements(): List<WeddingAnnouncement> = emptyList()
        override suspend fun postAnnouncement(
            title: String,
            message: String,
            urgency: AnnouncementUrgency
        ): WeddingAnnouncement = throw UnsupportedOperationException()
        override suspend fun resolveInvitation(weddingSlug: String, token: String): InvitationContext =
            throw UnsupportedOperationException()
        override suspend fun confirmRsvp(weddingSlug: String, token: String, attending: Boolean): WeddingPass =
            throw UnsupportedOperationException()
        override suspend fun checkInGuest(
            qrPayload: String,
            count: Int,
            usherId: String
        ): CheckInVerificationResult = throw UnsupportedOperationException()
    }
}
