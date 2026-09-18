package pro.wewed.app

import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.services.FixturePlannerDashboardRepository

class PlannerDashboardRepositoryTest {

    @Test
    fun fixtureDashboardIsExplicitlySanitizedAndPlannerComplete() = runBlocking {
        val repository = FixturePlannerDashboardRepository()
        val dashboard = repository.getDashboard()

        assertEquals("Charity & Kudzie", dashboard.coupleNames)
        assertEquals("Eleven Eleven Testing", dashboard.plannerContext)
        assertEquals(78, dashboard.readinessScore)
        assertEquals(
            setOf("tasks", "budget", "contributions", "vendors", "guests", "seating", "timeline"),
            dashboard.modules.map { it.id }.toSet()
        )
        assertTrue(dashboard.sourceLabel.contains("NOT production snapshot"))
        assertTrue(dashboard.attentionItems.isNotEmpty())
    }

    @Test
    fun dataEnvironmentPreventsMutableProductionDevelopment() {
        assertTrue(NativeDataEnvironment.FIXTURE.allowsMutableNativeDevelopment)
        assertTrue(NativeDataEnvironment.SHADOW.allowsMutableNativeDevelopment)
        assertFalse(NativeDataEnvironment.PRODUCTION_READ_VERIFY.allowsMutableNativeDevelopment)
        assertFalse(NativeDataEnvironment.PRODUCTION.allowsMutableNativeDevelopment)
    }
}
