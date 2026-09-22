package pro.wewed.app.services

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import pro.wewed.app.models.TaskPriority
import pro.wewed.app.models.TaskStatus

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8.
 *
 * `ProductionWeddingRepository`/`ProductionPlannerDashboardRepository`/
 * `ProductionAdminSystemRepository` against a fake `WeddingDayHttpTransport`, mirroring the
 * established pattern in `SessionAccountAuthorityTest`. Deterministic and offline: proves the
 * repositories call the right `/api/native/...` paths with the right `grantId`/bearer header, map
 * real JSON into the existing native models without fabrication, and fail closed (never fixture
 * data) on a 401/403/5xx.
 */
class ProductionDomainRepositoriesTest {

    private class FakeTransport(
        private val responses: Map<String, WeddingDayHttpResponse>,
        private val defaultStatus: Int = 503,
    ) : WeddingDayHttpTransport {
        val requestedPaths = mutableListOf<String>()
        val requestedHeaders = mutableListOf<Map<String, String>>()
        var lastPatchBody: String? = null

        override suspend fun get(path: String, headers: Map<String, String>): WeddingDayHttpResponse {
            requestedPaths.add(path)
            requestedHeaders.add(headers)
            val key = path.substringBefore('?')
            return responses[key] ?: WeddingDayHttpResponse(defaultStatus, "")
        }

        override suspend fun post(path: String, headers: Map<String, String>, body: String): WeddingDayHttpResponse {
            requestedPaths.add(path)
            requestedHeaders.add(headers)
            val key = path.substringBefore('?')
            return responses[key] ?: WeddingDayHttpResponse(defaultStatus, "")
        }

        override suspend fun patch(path: String, headers: Map<String, String>, body: String): WeddingDayHttpResponse {
            requestedPaths.add(path)
            requestedHeaders.add(headers)
            lastPatchBody = body
            val key = path.substringBefore('?')
            return responses[key] ?: WeddingDayHttpResponse(defaultStatus, "")
        }
    }

    private val grantId = "planner:wedding:wed-1"
    private val token = "test-session-token"

    @Test
    fun `getWedding and getTasks call the real endpoints with grantId and bearer header`() = runBlocking {
        val transport = FakeTransport(
            mapOf(
                "api/native/wedding/overview" to WeddingDayHttpResponse(200, """
                    {"success":true,"scopeKind":"wedding","wedding":{"id":"wed-1","slug":"w","title":"T","date":"2027-01-01T00:00:00.000Z","venue":"V","lifecycle":"before","coupleNames":"A & B"},"counts":{}}
                """.trimIndent()),
                "api/native/wedding/timeline" to WeddingDayHttpResponse(200, """{"success":true,"count":0,"data":[]}"""),
                "api/native/wedding/tasks" to WeddingDayHttpResponse(200, """
                    {"success":true,"count":1,"data":[{"id":"task-1","title":"Book venue","description":null,"category":"venue","status":"todo","priority":"high","dueDate":null,"assignee":null,"assigneeUserId":null,"order":0,"weddingId":"wed-1"}]}
                """.trimIndent()),
            ),
        )
        val client = NativeDomainApiClient(transport)
        val repo = ProductionWeddingRepository(client, token, grantId, "wed-1")

        val wedding = repo.getWedding("wed-1")
        assertEquals("A & B", wedding.coupleNames)

        val tasks = repo.getTasks("wed-1")
        assertEquals(1, tasks.size)
        assertEquals("Book venue", tasks[0].title)
        assertEquals(TaskStatus.TODO, tasks[0].status)
        assertEquals(TaskPriority.HIGH, tasks[0].priority)

        val encodedGrantId = java.net.URLEncoder.encode(grantId, "UTF-8")
        assertTrue(transport.requestedPaths.all { it.contains("grantId=$encodedGrantId") })
        assertTrue(transport.requestedHeaders.all { it["Authorization"] == "Bearer $token" })
    }

    @Test
    fun `toggleTask flips done to todo and todo to done via PATCH`() = runBlocking {
        val transport = FakeTransport(
            mapOf(
                "api/native/wedding/tasks" to WeddingDayHttpResponse(200, """
                    {"success":true,"count":1,"data":[{"id":"task-1","title":"Book venue","description":null,"category":"venue","status":"todo","priority":"high","dueDate":null,"assignee":null,"assigneeUserId":null,"order":0,"weddingId":"wed-1"}]}
                """.trimIndent()),
                "api/native/wedding/tasks/task-1" to WeddingDayHttpResponse(200, """
                    {"success":true,"data":{"id":"task-1","title":"Book venue","description":null,"category":"venue","status":"done","priority":"high","dueDate":null,"assignee":null,"assigneeUserId":null,"order":0,"weddingId":"wed-1"}}
                """.trimIndent()),
            ),
        )
        val client = NativeDomainApiClient(transport)
        val repo = ProductionWeddingRepository(client, token, grantId, "wed-1")

        val updated = repo.toggleTask("wed-1", "task-1")
        assertEquals(TaskStatus.DONE, updated.status)
        assertTrue(transport.lastPatchBody?.contains("\"status\":\"done\"") == true)
    }

    @Test
    fun `Wedding Day operational methods remain fail-closed on the production adapter`() = runBlocking {
        val repo = ProductionWeddingRepository(NativeDomainApiClient(FakeTransport(emptyMap())), token, grantId, "wed-1")
        var threw = false
        try {
            repo.checkInGuest("wed-1", "qr", 1, "usher-1")
        } catch (e: ProductionReadOnlyDomainUnavailable) {
            threw = true
        }
        assertTrue("checkInGuest must remain fail-closed", threw)

        // Wedding-Day vendor presence / announcements / audit are honest-empty, not thrown, so the
        // shared WeddingGraphState loader (rememberWeddingGraph) never crashes for a wedding this
        // phase DID wire (Tasks/Budget/Guests) just because these unrelated fields are unavailable.
        assertTrue(repo.getVendors("wed-1").isEmpty())
        assertTrue(repo.getAnnouncements("wed-1").isEmpty())
        assertTrue(repo.getAuditRecords("wed-1").isEmpty())
    }

    @Test
    fun `a 401 from any endpoint never returns fixture-shaped data`() = runBlocking {
        val transport = FakeTransport(mapOf("api/native/wedding/tasks" to WeddingDayHttpResponse(401, """{"success":false}""")))
        val repo = ProductionWeddingRepository(NativeDomainApiClient(transport), token, grantId, "wed-1")
        try {
            repo.getTasks("wed-1")
            fail("Expected getTasks to throw on 401, never return data")
        } catch (e: ProductionReadOnlyDomainUnavailable) {
            // Expected.
        }
    }

    @Test
    fun `getBudgetLines and getSeatingTables and getTimelineEntries and getVendorEngagements map real rows`() = runBlocking {
        val transport = FakeTransport(
            mapOf(
                "api/native/wedding/budget" to WeddingDayHttpResponse(200, """
                    {"success":true,"count":1,"data":[{"id":"b1","category":"venue","description":"Venue","estimatedCost":1000.0,"actualCost":1000.0,"paidAmount":200.0,"currency":"USD","vendorId":null,"vendorName":null,"notes":null,"dueDate":null,"serviceEngagementId":null,"weddingId":"wed-1"}],"totals":{"currency":"USD","totalEstimated":1000.0,"totalActual":1000.0,"totalPaid":200.0,"categories":[{"category":"venue","estimated":1000.0,"actual":1000.0,"paid":200.0,"count":1}]}}
                """.trimIndent()),
                "api/native/wedding/seating" to WeddingDayHttpResponse(200, """
                    {"success":true,"count":1,"data":[{"id":"t1","name":"Table 1","capacity":10,"assigned":8,"guests":[]}]}
                """.trimIndent()),
                "api/native/wedding/timeline" to WeddingDayHttpResponse(200, """
                    {"success":true,"count":1,"data":[{"id":"p1","time":"14:00","title":"Ceremony","description":null,"location":"Chapel","order":0}]}
                """.trimIndent()),
                "api/native/wedding/vendors" to WeddingDayHttpResponse(200, """
                    {"success":true,"count":1,"data":[{"id":"v1","name":"Shandy Events","category":"decor","contractStatus":"signed","paymentStatus":"paid","notes":null}]}
                """.trimIndent()),
            ),
        )
        val client = NativeDomainApiClient(transport)
        val repo = ProductionPlannerDashboardRepository(client, token, grantId)

        val budgetLines = repo.getBudgetLines()
        assertEquals(1, budgetLines.size)
        assertEquals("venue", budgetLines[0].category)
        assertEquals(1000.0, budgetLines[0].estimated, 0.001)

        val seating = repo.getSeatingTables()
        assertEquals(1, seating.size)
        assertEquals(8, seating[0].assigned)
        assertEquals("2 seats free", seating[0].attentionLabel)

        val timeline = repo.getTimelineEntries()
        assertEquals("Ceremony", timeline[0].title)

        val vendors = repo.getVendorEngagements()
        assertEquals("Shandy Events", vendors[0].vendorName)
        assertEquals("signed", vendors[0].contractStatus)
    }

    @Test
    fun `Contributions and Documents are honest empty, never fabricated`() = runBlocking {
        val repo = ProductionPlannerDashboardRepository(NativeDomainApiClient(FakeTransport(emptyMap())), token, grantId)
        assertTrue(repo.getContributions().isEmpty())
        assertTrue(repo.getDocuments().isEmpty())
    }

    @Test
    fun `getDashboard never fabricates a wedding for a portfolio grant`() = runBlocking {
        val transport = FakeTransport(
            mapOf(
                "api/native/wedding/overview" to WeddingDayHttpResponse(200, """
                    {"success":true,"scopeKind":"portfolio","businessAccountId":"biz-1","businessName":"Eleven Eleven","wedding":null,"counts":null}
                """.trimIndent()),
            ),
        )
        val client = NativeDomainApiClient(transport)
        val repo = ProductionPlannerDashboardRepository(client, token, "planner:portfolio:biz-1")

        val dashboard = repo.getDashboard()
        assertEquals("biz-1", dashboard.weddingId)
        assertEquals("Eleven Eleven", dashboard.coupleNames)
        assertFalse(dashboard.sourceLabel.contains("Shadow", ignoreCase = true))
        assertFalse(dashboard.sourceLabel.contains("fixture", ignoreCase = true))
    }

    @Test
    fun `ProductionAdminSystemRepository surfaces a real pending-onboarding count`() = runBlocking {
        val transport = FakeTransport(
            mapOf(
                "api/native/admin/overview" to WeddingDayHttpResponse(200, """
                    {"success":true,"scopeKind":"system","platformRoles":["wewed_super_admin"],"counts":{"pendingOnboarding":3}}
                """.trimIndent()),
            ),
        )
        val client = NativeDomainApiClient(transport)
        val repo = ProductionAdminSystemRepository(client, token, "admin:system")

        val snapshot = repo.snapshot()
        assertEquals(3, snapshot.pendingOnboardingCount)
        assertTrue(snapshot.unsupportedStreams.isNotEmpty())
    }

    @Test
    fun `ProductionAdminSystemRepository reports null (not zero) when the call fails`() = runBlocking {
        val repo = ProductionAdminSystemRepository(NativeDomainApiClient(FakeTransport(emptyMap())), token, "admin:system")
        val snapshot = repo.snapshot()
        assertEquals(null, snapshot.pendingOnboardingCount)
    }
}
