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
    fun `domain client distinguishes permission denial resource missing revocation and invalid session`() = runBlocking {
        var sessionInvalid = 0
        val revoked = mutableListOf<String>()
        val grant = "planner:wedding:wed-1"

        fun clientFor(status: Int, body: String) = NativeDomainApiClient(
            transport = FakeTransport(mapOf("api/native/wedding/tasks" to WeddingDayHttpResponse(status, body))),
            onSessionInvalid = { sessionInvalid += 1 },
            onGrantRevoked = { revoked += it },
        )

        val permission = clientFor(403, """{"success":false,"code":"PERMISSION_DENIED"}""").tasks(token, grant)
        assertTrue(permission is NativeDomainFetch.Forbidden)
        assertEquals(0, revoked.size)

        val missing = clientFor(404, """{"success":false,"error":"Task not found"}""").tasks(token, grant)
        assertTrue(missing is NativeDomainFetch.Transport)
        assertEquals(0, revoked.size)

        val revokedFetch = clientFor(403, """{"success":false,"code":"GRANT_REVOKED"}""").tasks(token, grant)
        assertTrue(revokedFetch is NativeDomainFetch.GrantRevoked)
        assertEquals(listOf(grant), revoked)

        val invalid = clientFor(401, """{"success":false,"code":"SESSION_INVALID"}""").tasks(token, grant)
        assertTrue(invalid is NativeDomainFetch.SessionInvalid)
        assertEquals(1, sessionInvalid)
    }

    @Test
    fun `live planner domain failure throws instead of masquerading as an empty dataset`() = runBlocking {
        val repo = ProductionPlannerDashboardRepository(
            NativeDomainApiClient(FakeTransport(mapOf("api/native/wedding/budget" to WeddingDayHttpResponse(503, """{"success":false}""")))),
            token,
            grantId,
        )
        try {
            repo.getBudgetLines()
            fail("Expected live budget failure to throw instead of returning an empty list")
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
    fun `Documents maps real rows from the same Vault catalog the PWA uses, and throws on live failure`() = runBlocking {
        val transport = FakeTransport(
            mapOf(
                "api/native/wedding/vault" to WeddingDayHttpResponse(200, """
                    {"success":true,"count":1,"data":[{"id":"doc-1","displayName":"Venue contract.pdf","category":"wedding_document","available":true}]}
                """.trimIndent()),
            ),
        )
        val repo = ProductionPlannerDashboardRepository(NativeDomainApiClient(transport), token, grantId)
        val documents = repo.getDocuments()
        assertEquals(1, documents.size)
        assertEquals("Venue contract.pdf", documents[0].title)
        assertEquals("wedding_document", documents[0].kind)
        assertEquals(null, documents[0].statusLabel)

        val failingRepo = ProductionPlannerDashboardRepository(NativeDomainApiClient(FakeTransport(emptyMap())), token, grantId)
        try {
            failingRepo.getDocuments()
            fail("Expected a live Documents/Vault failure to throw instead of returning an empty list")
        } catch (e: ProductionReadOnlyDomainUnavailable) {
            // Expected — matches the same "live failure never masquerades as empty" rule as Budget/Contributions.
        }
    }

    /**
     * Master plan Phase 8 closure round 3 §2 — the exact 5-outcome matrix the moderator asked for,
     * for BOTH Documents and Contributions: successful data (covered by the mapping test above),
     * successful empty (an authoritative EMPTY, not a failure), transport failure, permission
     * denial, and grant revocation (both of the latter two are still live-domain failures at this
     * repository layer — the UI-level `rememberProductionLoad`/`ProductionLoadState` in
     * `RoleWorkspaceContent.kt` is what turns "the repository threw" into a distinct Unavailable
     * render, so proving every one of these five HTTP outcomes maps to the correct
     * success-vs-throw contract here is what makes that UI-level distinction trustworthy).
     */
    @Test
    fun `Documents - successful empty, transport failure, permission denial and grant revocation are each handled correctly`() = runBlocking {
        suspend fun documentsFor(response: WeddingDayHttpResponse) =
            ProductionPlannerDashboardRepository(NativeDomainApiClient(FakeTransport(mapOf("api/native/wedding/vault" to response))), token, grantId)
                .getDocuments()

        // Successful empty: a real 200 with a genuinely empty array is NOT a failure.
        assertTrue(documentsFor(WeddingDayHttpResponse(200, """{"success":true,"count":0,"data":[]}""")).isEmpty())

        val failureCases = mapOf(
            "transport failure (5xx)" to WeddingDayHttpResponse(503, """{"success":false,"error":"Service unavailable"}"""),
            "permission denial (403 PERMISSION_DENIED)" to WeddingDayHttpResponse(403, """{"success":false,"code":"PERMISSION_DENIED","error":"Forbidden"}"""),
            "grant revocation (403 GRANT_REVOKED)" to WeddingDayHttpResponse(403, """{"success":false,"code":"GRANT_REVOKED","error":"revoked"}"""),
        )
        for ((label, response) in failureCases) {
            try {
                documentsFor(response)
                fail("Expected $label to throw instead of returning data or an empty list")
            } catch (e: ProductionReadOnlyDomainUnavailable) {
                // Expected for all three — the UI layer, not this repository, is what shows a
                // uniform "unavailable" state for any of them; this repository must never let one
                // masquerade as the successful-empty case proven above.
            }
        }
    }

    @Test
    fun `Contributions maps real rows from the same engine the PWA uses, and throws on live failure`() = runBlocking {
        val transport = FakeTransport(
            mapOf(
                "api/native/wedding/contributions" to WeddingDayHttpResponse(200, """
                    {"success":true,"count":1,"data":[{"id":"contrib-1","weddingId":"wed-1","type":"CASH_TO_COUPLE","amount":500.0,"commitmentState":"CONFIRMED","fulfillmentState":"RECEIVED","verificationState":"RECONCILED","allocatedAmount":250.0,"contributor":{"displayName":"Aunt Grace"}}],"summaryByCurrency":{},"counts":{}}
                """.trimIndent()),
            ),
        )
        val repo = ProductionPlannerDashboardRepository(NativeDomainApiClient(transport), token, grantId)
        val contributions = repo.getContributions()
        assertEquals(1, contributions.size)
        assertEquals("Aunt Grace", contributions[0].contributorLabel)
        assertEquals("Cash to couple", contributions[0].typeLabel)
        assertEquals(500.0, contributions[0].value, 0.001)
        assertTrue(contributions[0].verified)
        assertTrue(contributions[0].allocationLabel.contains("Allocated"))

        val failingRepo = ProductionPlannerDashboardRepository(NativeDomainApiClient(FakeTransport(emptyMap())), token, grantId)
        try {
            failingRepo.getContributions()
            fail("Expected a live Contributions failure to throw instead of returning an empty list")
        } catch (e: ProductionReadOnlyDomainUnavailable) {
            // Expected — matches the same "live failure never masquerades as empty" rule as Budget.
        }
    }

    /** Master plan Phase 8 closure round 3 §2 — same 5-outcome matrix as Documents, for Contributions. */
    @Test
    fun `Contributions - successful empty, transport failure, permission denial and grant revocation are each handled correctly`() = runBlocking {
        suspend fun contributionsFor(response: WeddingDayHttpResponse) =
            ProductionPlannerDashboardRepository(NativeDomainApiClient(FakeTransport(mapOf("api/native/wedding/contributions" to response))), token, grantId)
                .getContributions()

        assertTrue(contributionsFor(WeddingDayHttpResponse(200, """{"success":true,"count":0,"data":[],"summaryByCurrency":{},"counts":{}}""")).isEmpty())

        val failureCases = mapOf(
            "transport failure (5xx)" to WeddingDayHttpResponse(503, """{"success":false,"error":"Service unavailable"}"""),
            "permission denial (403 PERMISSION_DENIED)" to WeddingDayHttpResponse(403, """{"success":false,"code":"PERMISSION_DENIED","error":"Forbidden"}"""),
            "grant revocation (403 GRANT_REVOKED)" to WeddingDayHttpResponse(403, """{"success":false,"code":"GRANT_REVOKED","error":"revoked"}"""),
        )
        for ((label, response) in failureCases) {
            try {
                contributionsFor(response)
                fail("Expected $label to throw instead of returning data or an empty list")
            } catch (e: ProductionReadOnlyDomainUnavailable) {
                // Expected.
            }
        }
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
    fun `ProductionAdminSystemRepository throws on a live failure, never a silently nulled-out snapshot`() = runBlocking {
        // Master plan Phase 8 closure round 3 §7, revised round 4 §1 — a bound repository whose live
        // call fails is a different fact from "never bound at all" (AppViewModel.adminRepository now
        // throws ProductionRepositoryUnbound for that case instead of returning a same-typed
        // placeholder object). Collapsing the two made a failed fetch indistinguishable from a
        // genuinely empty console. This must throw, exactly like getContributions()/getDocuments()
        // do, so the UI's rememberProductionLoad can render it as Unavailable rather than an
        // authoritative empty.
        val repo = ProductionAdminSystemRepository(NativeDomainApiClient(FakeTransport(emptyMap())), token, "admin:system")
        try {
            repo.snapshot()
            fail("Expected a live Admin overview failure to throw instead of returning a nulled-out snapshot")
        } catch (e: ProductionReadOnlyDomainUnavailable) {
            // Expected.
        }
    }

    /** Master plan Phase 8 closure round 3 §7 — same 5-outcome matrix as Documents/Contributions. */
    @Test
    fun `Admin overview - successful empty, transport failure, permission denial and grant revocation are each handled correctly`() = runBlocking {
        suspend fun snapshotFor(response: WeddingDayHttpResponse) =
            ProductionAdminSystemRepository(NativeDomainApiClient(FakeTransport(mapOf("api/native/admin/overview" to response))), token, "admin:system")
                .snapshot()

        val emptySnapshot = snapshotFor(WeddingDayHttpResponse(200, """{"success":true,"scopeKind":"system","platformRoles":["wewed_support_admin"],"counts":{"pendingOnboarding":0},"summary":{"businessAccounts":0},"accounts":[],"supportCases":[],"incidents":[]}"""))
        assertEquals(0, emptySnapshot.pendingOnboardingCount)
        assertEquals(0, emptySnapshot.businessAccountsTotal)
        assertTrue(emptySnapshot.accounts.isEmpty())

        val failureCases = mapOf(
            "transport failure (5xx)" to WeddingDayHttpResponse(503, """{"success":false,"error":"Service unavailable"}"""),
            "permission denial (403 PERMISSION_DENIED)" to WeddingDayHttpResponse(403, """{"success":false,"code":"PERMISSION_DENIED","error":"Forbidden"}"""),
            "grant revocation (403 GRANT_REVOKED)" to WeddingDayHttpResponse(403, """{"success":false,"code":"GRANT_REVOKED","error":"revoked"}"""),
        )
        for ((label, response) in failureCases) {
            try {
                snapshotFor(response)
                fail("Expected $label to throw instead of returning a nulled-out snapshot")
            } catch (e: ProductionReadOnlyDomainUnavailable) {
                // Expected.
            }
        }
    }

    @Test
    fun `ProductionAdminSystemRepository maps real summary, accounts, support cases and incidents from the same loadAdminOverview the PWA uses`() = runBlocking {
        val transport = FakeTransport(
            mapOf(
                "api/native/admin/overview" to WeddingDayHttpResponse(200, """
                    {
                      "success": true, "scopeKind": "system", "platformRoles": ["wewed_super_admin"],
                      "counts": {"pendingOnboarding": 3},
                      "summary": {"businessAccounts": 42, "activeAccounts": 30, "pendingReviewAccounts": 5, "openSupportCases": 2, "openIncidents": 1},
                      "accounts": [{"id": "biz-1", "name": "Eleven Eleven", "type": "planning_company", "status": "active", "onboardingStatus": "complete", "riskFlags": ["billing_attention"]}],
                      "supportCases": [{"id": "case-1", "title": "Cannot upload logo", "status": "open", "priority": "urgent", "businessAccountName": "Eleven Eleven"}],
                      "incidents": [{"id": "incident-1", "title": "Elevated API latency", "status": "monitoring", "severity": "minor"}]
                    }
                """.trimIndent()),
            ),
        )
        val repo = ProductionAdminSystemRepository(NativeDomainApiClient(transport), token, "admin:system")
        val snapshot = repo.snapshot()

        assertEquals(42, snapshot.businessAccountsTotal)
        assertEquals(30, snapshot.activeAccountsTotal)
        assertEquals(5, snapshot.pendingReviewAccountsTotal)
        assertEquals(2, snapshot.openSupportCasesTotal)
        assertEquals(1, snapshot.openIncidentsTotal)

        assertEquals(1, snapshot.accounts.size)
        assertEquals("Eleven Eleven", snapshot.accounts[0].name)
        assertEquals(listOf("billing_attention"), snapshot.accounts[0].riskFlags)

        assertEquals(1, snapshot.supportCases.size)
        assertEquals("Cannot upload logo", snapshot.supportCases[0].title)
        assertEquals("urgent", snapshot.supportCases[0].priority)

        assertEquals(1, snapshot.incidents.size)
        assertEquals("Elevated API latency", snapshot.incidents[0].title)

        // The two now-connected streams no longer appear in the honest unsupported list.
        assertFalse(snapshot.unsupportedStreams.any { it.contains("Full overview", ignoreCase = true) })
        assertFalse(snapshot.unsupportedStreams.any { it.contains("Client operations", ignoreCase = true) })
        assertTrue(snapshot.unsupportedStreams.any { it.contains("Bookings", ignoreCase = true) })
    }

    /** Master plan Phase 8 closure round 3 §3 — Contracts, reusing the mature engagement-list engine. */
    @Test
    fun `ProductionContractsRepository maps real engagement and contract rows, and throws on live failure`() = runBlocking {
        val transport = FakeTransport(
            mapOf(
                "api/native/wedding/engagements" to WeddingDayHttpResponse(200, """
                    {"success":true,"count":1,"data":[{"id":"eng-1","serviceCategory":"photography","lifecycleStatus":"effective","agreedAmount":"2500.00","currency":"USD","vendor":{"name":"Shandy Events"},"contracts":[{"id":"con-1","contractNumber":"WW-0001","status":"ISSUED","currentVersionNumber":2}]}]}
                """.trimIndent()),
            ),
        )
        val repo = ProductionContractsRepository(NativeDomainApiClient(transport), token, grantId)
        val engagements = repo.getServiceEngagements()
        assertEquals(1, engagements.size)
        assertEquals("Shandy Events", engagements[0].vendorName)
        assertEquals("2500.00", engagements[0].agreedAmount)
        assertEquals(1, engagements[0].contracts.size)
        assertEquals("WW-0001", engagements[0].contracts[0].contractNumber)
        assertEquals(2, engagements[0].contracts[0].currentVersionNumber)

        val failureCases = mapOf(
            "transport failure" to WeddingDayHttpResponse(503, """{"success":false}"""),
            "permission denial" to WeddingDayHttpResponse(403, """{"success":false,"code":"PERMISSION_DENIED"}"""),
            "grant revocation" to WeddingDayHttpResponse(403, """{"success":false,"code":"GRANT_REVOKED"}"""),
        )
        for ((label, response) in failureCases) {
            val failingRepo = ProductionContractsRepository(NativeDomainApiClient(FakeTransport(mapOf("api/native/wedding/engagements" to response))), token, grantId)
            try {
                failingRepo.getServiceEngagements()
                fail("Expected $label to throw instead of returning data or an empty list")
            } catch (e: ProductionReadOnlyDomainUnavailable) {
                // Expected.
            }
        }
    }

    /**
     * Master plan Phase 8 closure round 4 §3 — the mature Deal Room, reachable from the native
     * client for the first time this round. Reuses `getServiceEngagementDealRoom` verbatim server-side
     * (`/api/native/wedding/engagements/{id}/deal-room`); this test proves the CLIENT side: opening
     * engagement A loads exactly A's Deal Room (never fabricated, never another engagement's), and
     * every non-success outcome (foreign engagement 404, permission denial, session-invalid, grant
     * revocation) throws instead of returning an empty or partially-fabricated room.
     */
    @Test
    fun `ProductionContractsRepository getDealRoom loads the exact requested engagement's Deal Room, and throws on any live failure`() = runBlocking {
        val transport = FakeTransport(
            mapOf(
                "api/native/wedding/engagements/eng-1/deal-room" to WeddingDayHttpResponse(200, """
                    {"success":true,"data":{
                        "id":"eng-1","serviceCategory":"photography","serviceDescription":"Full day coverage",
                        "agreedAmount":"2500.00","currency":"USD","serviceDate":"2026-11-14","serviceLocation":"Imba Manor",
                        "lifecycleStatus":"effective",
                        "vendor":{"id":"vendor-1","name":"Shandy Events","category":"photography","email":"hi@shandy.test","phone":null},
                        "parties":[{"id":"party-1","partyRole":"vendor","displayName":"Shandy Events","email":"hi@shandy.test","phone":null,"requiredForReview":true}],
                        "budgetItems":[{"id":"bi-1","description":"Deposit","estimatedCost":"1250.00","actualCost":"1250.00","paidAmount":"1250.00","currency":"USD"}],
                        "payments":[{"id":"pay-1","amount":"1250.00","currency":"USD","paidAt":"2026-08-01T00:00:00.000Z","reference":"REF-1"}],
                        "contracts":[{"id":"con-1","contractNumber":"WW-0001","status":"ISSUED","title":"Photography Agreement","currentVersionNumber":2,"issuedAt":"2026-08-01T00:00:00.000Z","versions":[{"id":"ver-1","versionNumber":2,"status":"ISSUED","issuedAt":"2026-08-01T00:00:00.000Z","createdAt":"2026-07-30T00:00:00.000Z"}]}],
                        "documents":[{"id":"doc-1","displayName":"Signed contract","originalFilename":"contract.pdf","mimeType":"application/pdf","byteSize":1024,"storageState":"stored","scanState":"clean","createdAt":"2026-07-30T00:00:00.000Z"}]
                    }}
                """.trimIndent()),
            ),
        )
        val repo = ProductionContractsRepository(NativeDomainApiClient(transport), token, grantId)
        val dealRoom = repo.getDealRoom("eng-1")
        assertEquals("eng-1", dealRoom.id)
        assertEquals("Shandy Events", dealRoom.vendor.name)
        assertEquals("2500.00", dealRoom.agreedAmount)
        assertEquals(1, dealRoom.parties.size)
        assertTrue(dealRoom.parties[0].requiredForReview)
        assertEquals(1, dealRoom.contracts.size)
        assertEquals("WW-0001", dealRoom.contracts[0].contractNumber)
        assertEquals(1, dealRoom.contracts[0].versions.size)
        assertEquals(1, dealRoom.budgetItems.size)
        assertEquals(1, dealRoom.payments.size)
        assertEquals(1, dealRoom.documents.size)
        assertEquals(
            "api/native/wedding/engagements/eng-1/deal-room?grantId=${java.net.URLEncoder.encode(grantId, "UTF-8")}",
            transport.requestedPaths.last(),
        )

        val failureCases = mapOf(
            "foreign engagement (404)" to WeddingDayHttpResponse(404, """{"success":false,"error":"Service engagement was not found."}"""),
            "permission denial" to WeddingDayHttpResponse(403, """{"success":false,"code":"PERMISSION_DENIED"}"""),
            "session invalid" to WeddingDayHttpResponse(401, """{"success":false}"""),
            "grant revocation" to WeddingDayHttpResponse(403, """{"success":false,"code":"GRANT_REVOKED"}"""),
        )
        for ((label, response) in failureCases) {
            val failingRepo = ProductionContractsRepository(
                NativeDomainApiClient(FakeTransport(mapOf("api/native/wedding/engagements/eng-1/deal-room" to response))),
                token,
                grantId,
            )
            try {
                failingRepo.getDealRoom("eng-1")
                fail("Expected $label to throw instead of returning data or a fabricated empty Deal Room")
            } catch (e: ProductionReadOnlyDomainUnavailable) {
                // Expected.
            }
        }
    }

    /** Master plan Phase 8 closure round 3 §6 — the Vendor's own engagement, reusing the same Deal Room engine. */
    @Test
    fun `ProductionVendorEngagementRepository maps the Vendor's own engagement, and throws on live failure`() = runBlocking {
        val transport = FakeTransport(
            mapOf(
                "api/native/vendor/engagement" to WeddingDayHttpResponse(200, """
                    {"success":true,"engagementIds":["eng-1"],"data":{"id":"eng-1","weddingId":"wed-1","serviceCategory":"catering","lifecycleStatus":"effective","agreedAmount":"4200.00","currency":"USD","contracts":[{"id":"con-2","contractNumber":"WW-0002","status":"AWAITING_ACCEPTANCE","currentVersionNumber":1}]}}
                """.trimIndent()),
            ),
        )
        val repo = ProductionVendorEngagementRepository(NativeDomainApiClient(transport), token, "vendor:wedding:biz-1:vendor-1")
        val engagement = repo.getMyEngagement()
        assertEquals("eng-1", engagement.id)
        assertEquals("wed-1", engagement.weddingId)
        assertEquals("catering", engagement.serviceCategory)
        assertEquals(1, engagement.contracts.size)
        assertEquals("AWAITING_ACCEPTANCE", engagement.contracts[0].status)

        val failingRepo = ProductionVendorEngagementRepository(NativeDomainApiClient(FakeTransport(emptyMap())), token, "vendor:wedding:biz-1:vendor-1")
        try {
            failingRepo.getMyEngagement()
            fail("Expected a live Vendor-engagement failure to throw instead of returning fabricated data")
        } catch (e: ProductionReadOnlyDomainUnavailable) {
            // Expected.
        }
    }
}
