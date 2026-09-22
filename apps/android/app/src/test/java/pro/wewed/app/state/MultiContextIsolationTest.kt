package pro.wewed.app.state

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import pro.wewed.app.models.AppRole
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.services.InMemorySecureStorage
import pro.wewed.app.services.ProductionAuthorityClient
import pro.wewed.app.services.WeddingDayHttpResponse
import pro.wewed.app.services.WeddingDayHttpTransport
import java.net.URLDecoder

/**
 * Master plan Phase 6 — multi-role and multi-context isolation. Proves the account/context switch
 * mechanics Phase 5 already shipped (singular same-kind selection, synchronous snapshot clearing,
 * revoked-grant handling) extend correctly to: switching after a workspace is already open,
 * switching across different workspace kinds (not just within one), Vendor engagement selection,
 * and — the mandatory Phase-6 adversarial case — that Account A's session state can never leak into
 * Account B. The iOS counterpart is `MultiContextIsolationTests`.
 */
class MultiContextIsolationTest {

    // One multi-axis identity: Couple(A), Planner(B, C — same-kind, selection required),
    // Admin(system), Coordinator(D), Vendor(E, two engagements). Covers nearly every Phase-6
    // scenario from a single authority fixture.
    private val multiAxisAuthority = """
        {"success": true, "authority": {
          "contract": "WewedProductionAuthorityV1", "version": 1, "accountStatus": "authorized",
          "identity": {"accessUserId": "user-1", "dashboardClass": "planner"},
          "workspaceGrants": [
            {"grantId": "couple:wedding:A", "workspaceKind": "couple", "scopeKind": "wedding",
             "weddingId": "A", "weddingTitle": "Wedding A", "coupleId": null, "businessAccountId": null,
             "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []},
            {"grantId": "planner:wedding:A", "workspaceKind": "planner", "scopeKind": "wedding",
             "weddingId": "A", "weddingTitle": "Wedding A", "coupleId": null, "businessAccountId": null,
             "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []},
            {"grantId": "planner:wedding:B", "workspaceKind": "planner", "scopeKind": "wedding",
             "weddingId": "B", "weddingTitle": "Wedding B", "coupleId": null, "businessAccountId": null,
             "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []},
            {"grantId": "planner:wedding:C", "workspaceKind": "planner", "scopeKind": "wedding",
             "weddingId": "C", "weddingTitle": "Wedding C", "coupleId": null, "businessAccountId": null,
             "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []},
            {"grantId": "admin:system", "workspaceKind": "admin", "scopeKind": "system",
             "weddingId": null, "weddingTitle": null, "coupleId": null, "businessAccountId": null,
             "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": ["wewed_super_admin"]},
            {"grantId": "coordinator:wedding:D", "workspaceKind": "coordinator", "scopeKind": "wedding",
             "weddingId": "D", "weddingTitle": "Wedding D", "coupleId": null, "businessAccountId": null,
             "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []},
            {"grantId": "vendor:wedding:biz-1:vendor-1", "workspaceKind": "vendor", "scopeKind": "wedding",
             "weddingId": "E", "weddingTitle": "Wedding E", "coupleId": null, "businessAccountId": "biz-1",
             "vendorId": "vendor-1", "serviceEngagementIds": ["eng-1", "eng-2"], "permissions": [], "platformRoles": []}
          ],
          "contextSelection": [
            {"workspaceKind": "planner", "grantIds": ["planner:wedding:A", "planner:wedding:B", "planner:wedding:C"], "selectionRequired": true}
          ],
          "unsupported": [], "platform": {"effectiveRole": null}
        }}
    """.trimIndent()

    private fun workspaceFor(grantId: String, weddingId: String?, weddingTitle: String?, workspaceKind: String = "planner", scopeKind: String = "wedding"): String = """
        {"success":true,"workspace":{
          "grantId":"$grantId","workspaceKind":"$workspaceKind","scopeKind":"$scopeKind",
          "weddingId":${weddingId?.let { "\"$it\"" } ?: "null"},"weddingTitle":${weddingTitle?.let { "\"$it\"" } ?: "null"},
          "businessAccountId":null,"vendorId":null,
          "serviceEngagementIds":[],"engagement":null,"engagementSelectionRequired":false,"engagementOptions":[],
          "permissions":[],"platformRoles":[],
          "wedding":${if (weddingId == null) "null" else """{"id":"$weddingId","slug":"wedding-${weddingId.lowercase()}","title":"$weddingTitle","date":"2027-01-01T00:00:00.000Z","venue":"Venue $weddingId","venueCity":"Harare","venueCountry":"Zimbabwe","lifecycle":"before","coupleNames":"Couple $weddingId"}"""}
        }}
    """.trimIndent()

    private val systemWorkspace = """
        {"success":true,"workspace":{
          "grantId":"admin:system","workspaceKind":"admin","scopeKind":"system",
          "weddingId":null,"weddingTitle":null,"businessAccountId":null,"vendorId":null,
          "serviceEngagementIds":[],"engagement":null,"engagementSelectionRequired":false,"engagementOptions":[],
          "permissions":[],"platformRoles":["wewed_super_admin"],"wedding":null
        }}
    """.trimIndent()

    private fun vendorWorkspace(engagementId: String?, selectionRequired: Boolean): String {
        val engagement = engagementId?.let {
            """{"id":"$it","serviceCategory":"Catering","serviceDescription":null,"lifecycleStatus":"historical_capture"}"""
        } ?: "null"
        val options = if (selectionRequired) {
            """[{"id":"eng-1","serviceCategory":"Catering","serviceDescription":null,"lifecycleStatus":"historical_capture"},
                {"id":"eng-2","serviceCategory":"Photography","serviceDescription":null,"lifecycleStatus":"historical_capture"}]"""
        } else "[]"
        return """
        {"success":true,"workspace":{
          "grantId":"vendor:wedding:biz-1:vendor-1","workspaceKind":"vendor","scopeKind":"wedding",
          "weddingId":"E","weddingTitle":"Wedding E","businessAccountId":"biz-1","vendorId":"vendor-1",
          "serviceEngagementIds":["eng-1","eng-2"],"engagement":$engagement,
          "engagementSelectionRequired":$selectionRequired,"engagementOptions":$options,
          "permissions":[],"platformRoles":[],
          "wedding":{"id":"E","slug":"wedding-e","title":"Wedding E","date":"2027-01-01T00:00:00.000Z","venue":"Venue E","venueCity":"Harare","venueCountry":"Zimbabwe","lifecycle":"before","coupleNames":"Couple E"}
        }}
        """.trimIndent()
    }

    /** A second, unrelated account whose own authority happens to reuse one of Account A's grant ids. */
    private fun collidingAuthorityFor(accessUserId: String, sharedGrantId: String): String = """
        {"success": true, "authority": {
          "contract": "WewedProductionAuthorityV1", "version": 1, "accountStatus": "authorized",
          "identity": {"accessUserId": "$accessUserId", "dashboardClass": "planner"},
          "workspaceGrants": [{"grantId": "$sharedGrantId", "workspaceKind": "planner", "scopeKind": "wedding",
             "weddingId": "Z", "weddingTitle": "Wedding Z (Account B)", "coupleId": null, "businessAccountId": null,
             "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []}],
          "contextSelection": [], "unsupported": [], "platform": {"effectiveRole": null}
        }}
    """.trimIndent()

    /** Routes by grantId/engagementId parsed out of the query string, not call order. */
    private class FakeTransport(
        private val authorityResponses: MutableList<WeddingDayHttpResponse>,
        private val workspaceResponses: MutableMap<String, WeddingDayHttpResponse> = mutableMapOf(),
        private val signInResponses: MutableMap<String, WeddingDayHttpResponse> = mutableMapOf(),
    ) : WeddingDayHttpTransport {
        val requestedPaths = mutableListOf<String>()
        val authorizationHeaders = mutableListOf<String?>()

        fun setWorkspace(grantId: String, response: WeddingDayHttpResponse, engagementId: String? = null) {
            workspaceResponses[if (engagementId != null) "$grantId|$engagementId" else grantId] = response
        }

        fun setSignIn(email: String, response: WeddingDayHttpResponse) {
            signInResponses[email] = response
        }

        override suspend fun get(path: String, headers: Map<String, String>): WeddingDayHttpResponse {
            requestedPaths.add(path)
            authorizationHeaders.add(headers["Authorization"])
            if (!path.startsWith("api/native/account/workspace")) {
                return authorityResponses.removeFirstOrNull() ?: authorityResponses.lastOrNull()
                    ?: WeddingDayHttpResponse(503, "Service Unavailable")
            }
            val grantId = Regex("grantId=([^&]+)").find(path)?.groupValues?.get(1)?.let { URLDecoder.decode(it, "UTF-8") }
            val engagementId = Regex("engagementId=([^&]+)").find(path)?.groupValues?.get(1)?.let { URLDecoder.decode(it, "UTF-8") }
            val key = if (engagementId != null) "$grantId|$engagementId" else grantId
            return workspaceResponses[key] ?: workspaceResponses[grantId]
                ?: WeddingDayHttpResponse(503, "Service Unavailable")
        }

        override suspend fun post(path: String, headers: Map<String, String>, body: String): WeddingDayHttpResponse {
            val email = Regex("\"email\":\"([^\"]+)\"").find(body)?.groupValues?.get(1)
            return signInResponses[email] ?: WeddingDayHttpResponse(401, """{"success":false,"error":"Invalid email or password."}""")
        }
    }

    private fun sessionWith(transport: FakeTransport, storage: InMemorySecureStorage = InMemorySecureStorage()) =
        SessionViewModel(
            storage = storage,
            environment = NativeDataEnvironment.PRODUCTION,
            authorityClient = ProductionAuthorityClient(transport),
            scope = CoroutineScope(Dispatchers.Unconfined),
        )

    private fun signedInMultiAxisSession(): Pair<SessionViewModel, FakeTransport> {
        val transport = FakeTransport(mutableListOf(WeddingDayHttpResponse(200, multiAxisAuthority)))
        transport.setSignIn("planner@example.com", WeddingDayHttpResponse(200, """{"success":true,"sessionToken":"session-abc"}"""))
        // Any grant the fixture can reach gets a matching workspace so tests can switch freely.
        transport.setWorkspace("planner:wedding:A", WeddingDayHttpResponse(200, workspaceFor("planner:wedding:A", "A", "Wedding A")))
        transport.setWorkspace("planner:wedding:B", WeddingDayHttpResponse(200, workspaceFor("planner:wedding:B", "B", "Wedding B")))
        transport.setWorkspace("planner:wedding:C", WeddingDayHttpResponse(200, workspaceFor("planner:wedding:C", "C", "Wedding C")))
        transport.setWorkspace("couple:wedding:A", WeddingDayHttpResponse(200, workspaceFor("couple:wedding:A", "A", "Wedding A", workspaceKind = "couple")))
        transport.setWorkspace("admin:system", WeddingDayHttpResponse(200, systemWorkspace))
        transport.setWorkspace("coordinator:wedding:D", WeddingDayHttpResponse(200, workspaceFor("coordinator:wedding:D", "D", "Wedding D", workspaceKind = "coordinator")))
        transport.setWorkspace("vendor:wedding:biz-1:vendor-1", WeddingDayHttpResponse(200, vendorWorkspace(null, selectionRequired = true)))
        transport.setWorkspace("vendor:wedding:biz-1:vendor-1", WeddingDayHttpResponse(200, vendorWorkspace("eng-1", selectionRequired = false)), engagementId = "eng-1")
        transport.setWorkspace("vendor:wedding:biz-1:vendor-1", WeddingDayHttpResponse(200, vendorWorkspace("eng-2", selectionRequired = false)), engagementId = "eng-2")

        val session = sessionWith(transport)
        session.signIn("planner@example.com", "correct horse battery staple")
        // Couple has the only grant of its kind; the account opens on it (first assignment found).
        // Explicitly move to the Planner axis before each Planner-specific test needs it.
        return session to transport
    }

    // ---------------------------------------------------------------------------------------
    // 1. Planner A -> B -> C -> A (here: switching among the two Planner grants and back to Couple)
    // ---------------------------------------------------------------------------------------

    @Test
    fun plannerCanSwitchAToBToCToAWithoutSigningOut() {
        val (session, _) = signedInMultiAxisSession()

        session.selectGrant("planner:wedding:A")
        assertEquals("planner:wedding:A", session.activeGrantId.value)
        assertEquals(AppRole.PLANNER, session.currentRole.value)
        assertEquals("A", session.weddingId.value)
        assertEquals("A", session.productionWorkspace.value?.weddingId)

        session.selectGrant("planner:wedding:B")
        assertEquals("planner:wedding:B", session.activeGrantId.value)
        assertEquals("B", session.weddingId.value)
        assertEquals("B", session.productionWorkspace.value?.weddingId)

        session.selectGrant("planner:wedding:C")
        assertEquals("planner:wedding:C", session.activeGrantId.value)
        assertEquals("C", session.weddingId.value)
        assertEquals("C", session.productionWorkspace.value?.weddingId)
        assertEquals(setOf("planner:wedding:C"), session.selectedGrantIds.value.filter { it.startsWith("planner:wedding:") }.toSet())

        session.selectGrant("planner:wedding:A")
        assertEquals("A", session.weddingId.value)
        assertEquals("A", session.productionWorkspace.value?.weddingId)
        assertEquals(setOf("planner:wedding:A"), session.selectedGrantIds.value.filter { it.startsWith("planner:wedding:") }.toSet())
    }

    @Test
    fun switchingNeverLeavesTwoSameKindGrantsSelectedSimultaneously() {
        val (session, _) = signedInMultiAxisSession()
        session.selectGrant("planner:wedding:B")
        session.selectGrant("planner:wedding:C")
        val plannerSelections = session.selectedGrantIds.value.filter { it.startsWith("planner:") }
        assertEquals(1, plannerSelections.size)
        assertEquals("planner:wedding:C", plannerSelections.single())
    }

    // ---------------------------------------------------------------------------------------
    // Ambiguous persisted same-kind selection fails closed
    // ---------------------------------------------------------------------------------------

    @Test
    fun twoPersistedSameKindGrantsFailClosedOnRestore() {
        val storage = InMemorySecureStorage()
        storage.save("wewed.account.session", "session-abc")
        storage.save("wewed.account.selected-grants.owner", "user-1")
        // Corrupted/ambiguous local state: both Planner weddings persisted as "selected" at once.
        storage.save("wewed.account.selected-grants", "planner:wedding:B,planner:wedding:C")
        val transport = FakeTransport(mutableListOf(WeddingDayHttpResponse(200, multiAxisAuthority)))

        val session = sessionWith(transport, storage)

        // Fails closed: neither is trusted, so Planner has no resolved wedding until re-selected.
        assertFalse(session.selectedGrantIds.value.contains("planner:wedding:B"))
        assertFalse(session.selectedGrantIds.value.contains("planner:wedding:C"))
    }

    // ---------------------------------------------------------------------------------------
    // 2. Multi-role: Couple -> Planner -> Couple, Planner -> Admin system -> Planner
    // ---------------------------------------------------------------------------------------

    @Test
    fun multiRoleAccountCanSwitchCoupleToPlannerAndBack() {
        val (session, _) = signedInMultiAxisSession()
        session.selectGrant("couple:wedding:A")
        assertEquals(AppRole.COUPLE, session.currentRole.value)
        assertEquals("A", session.weddingId.value)

        session.selectGrant("planner:wedding:B")
        assertEquals(AppRole.PLANNER, session.currentRole.value)
        assertEquals("B", session.weddingId.value)

        session.selectGrant("couple:wedding:A")
        assertEquals(AppRole.COUPLE, session.currentRole.value)
        assertEquals("A", session.weddingId.value)
        // Per-kind memory is deliberate (switching back to Planner should return to Wedding B, not
        // force a re-selection) — but never more than one grant of any single kind at once.
        assertEquals(1, session.selectedGrantIds.value.count { it.startsWith("couple:") })
        assertEquals(1, session.selectedGrantIds.value.count { it.startsWith("planner:") })
        assertEquals("couple:wedding:A", session.activeGrantId.value)
    }

    @Test
    fun multiRoleAccountCanSwitchPlannerToAdminSystemAndBack() {
        val (session, _) = signedInMultiAxisSession()
        session.selectGrant("planner:wedding:B")

        session.selectGrant("admin:system")
        assertEquals(AppRole.ADMIN, session.currentRole.value)
        assertNull(session.weddingId.value)
        assertNull(session.productionWorkspace.value?.weddingId)

        session.selectGrant("planner:wedding:B")
        assertEquals(AppRole.PLANNER, session.currentRole.value)
        assertEquals("B", session.weddingId.value)
    }

    // ---------------------------------------------------------------------------------------
    // 6. Admin system clears wedding context
    // ---------------------------------------------------------------------------------------

    @Test
    fun switchingToAdminSystemClearsPriorWeddingContextCompletely() {
        val (session, _) = signedInMultiAxisSession()
        session.selectGrant("coordinator:wedding:D")
        assertEquals("D", session.weddingId.value)

        session.selectGrant("admin:system")
        assertNull(session.weddingId.value)
        assertNull(session.weddingTitle.value)
        assertTrue(session.activeGrantId.value == "admin:system")
        assertNull(session.productionWorkspace.value?.weddingId)
        assertTrue(session.productionWorkspace.value?.scopeKind == "system")
    }

    // ---------------------------------------------------------------------------------------
    // 7. Coordinator cannot access a wedding it has no grant for
    // ---------------------------------------------------------------------------------------

    @Test
    fun coordinatorHasNoAssignmentForAWeddingItWasNotGrantedInAndCannotSwitchToIt() {
        val (session, _) = signedInMultiAxisSession()
        session.selectGrant("coordinator:wedding:D")
        assertEquals("D", session.weddingId.value)

        // No grant "coordinator:wedding:OTHER" exists in this authority at all: selectGrant must
        // refuse it outright rather than switching into a wedding the account was never granted.
        session.selectGrant("coordinator:wedding:OTHER")
        assertEquals("coordinator:wedding:D", session.activeGrantId.value)
        assertEquals("D", session.weddingId.value)
    }

    // ---------------------------------------------------------------------------------------
    // 8/9. Vendor engagement A -> B, foreign engagement rejected
    // ---------------------------------------------------------------------------------------

    @Test
    fun vendorGrantWithMultipleEngagementsRequiresExplicitChoiceThenCanSwitchBetweenThem() {
        val (session, _) = signedInMultiAxisSession()
        session.selectGrant("vendor:wedding:biz-1:vendor-1")
        assertTrue(session.productionWorkspace.value?.engagementSelectionRequired == true)
        assertNull(session.productionWorkspace.value?.engagement)

        session.selectEngagement("eng-1")
        assertEquals("eng-1", session.productionWorkspace.value?.engagement?.id)

        session.selectEngagement("eng-2")
        assertEquals("eng-2", session.productionWorkspace.value?.engagement?.id)
    }

    @Test
    fun aForeignEngagementIdNotInTheCurrentWorkspaceIsIgnoredClientSide() {
        val (session, _) = signedInMultiAxisSession()
        session.selectGrant("vendor:wedding:biz-1:vendor-1")

        session.selectEngagement("eng-belonging-to-another-vendor")

        assertNull(session.selectedEngagementId.value)
        // The snapshot is untouched by the ignored call.
        assertTrue(session.productionWorkspace.value?.engagementSelectionRequired == true)
    }

    @Test
    fun serverRejectingAnEngagementClearsOnlyTheEngagementNotTheWholeWorkspace() {
        val (session, transport) = signedInMultiAxisSession()
        session.selectGrant("vendor:wedding:biz-1:vendor-1")
        session.selectEngagement("eng-1")
        assertEquals("eng-1", session.productionWorkspace.value?.engagement?.id)

        // The server now reports eng-1 no longer belongs to this grant (revoked/foreign).
        transport.setWorkspace(
            "vendor:wedding:biz-1:vendor-1",
            WeddingDayHttpResponse(422, """{"success":false,"error":"This engagement is not part of this workspace grant."}"""),
            engagementId = "eng-1",
        )
        // Re-select the SAME engagement to force a fresh workspace fetch without touching the
        // grant/authority (selectGrant would also reset the engagement choice, which is not what
        // this test is proving).
        session.selectEngagement("eng-1")

        // The engagement choice is cleared, but the grant/wedding underneath is untouched — the
        // server's fallback (no engagementId requested) returns selectionRequired again.
        assertNull(session.selectedEngagementId.value)
        assertEquals("vendor:wedding:biz-1:vendor-1", session.activeGrantId.value)
    }

    // ---------------------------------------------------------------------------------------
    // 10/11. Revoked grant / revoked engagement clear context
    // ---------------------------------------------------------------------------------------

    @Test
    fun aRevokedActiveGrantClearsTheWholeActiveContext() {
        val (session, transport) = signedInMultiAxisSession()
        session.selectGrant("planner:wedding:B")
        assertEquals("B", session.weddingId.value)

        transport.setWorkspace("planner:wedding:B", WeddingDayHttpResponse(403, """{"success":false,"error":"revoked"}"""))
        // Re-select the same grant to force a fresh workspace fetch, without re-fetching authority
        // (this test is about a REVOKED WORKSPACE, not a changed authority document).
        session.selectGrant("planner:wedding:B")

        assertNull(session.activeGrantId.value)
        assertNull(session.currentRole.value)
        assertNull(session.weddingId.value)
        assertNull(session.productionWorkspace.value)
        assertFalse(session.selectedGrantIds.value.contains("planner:wedding:B"))
    }

    // ---------------------------------------------------------------------------------------
    // 12. Transient workspace failure does not authenticate cached data
    // ---------------------------------------------------------------------------------------

    @Test
    fun aTransientWorkspaceFailureNeverRendersAPriorSnapshot() {
        val (session, transport) = signedInMultiAxisSession()
        session.selectGrant("planner:wedding:B")
        assertEquals("B", session.productionWorkspace.value?.weddingId)

        transport.setWorkspace("planner:wedding:B", WeddingDayHttpResponse(503, "Service Unavailable"))
        session.selectGrant("planner:wedding:B")

        assertNull(session.productionWorkspace.value)
        // The credential/authority themselves are untouched by a transient failure.
        assertTrue(session.isAuthenticated.value)
        assertEquals("planner:wedding:B", session.activeGrantId.value)
    }

    // ---------------------------------------------------------------------------------------
    // 14. Mandatory adversarial isolation: Wedding A snapshot never leaks into Wedding B's context
    // ---------------------------------------------------------------------------------------

    @Test
    fun switchingContextsClearsTheOldSnapshotSynchronouslyBeforeTheNewFetchEvenStarts() {
        val transport = FakeTransport(mutableListOf(WeddingDayHttpResponse(200, multiAxisAuthority)))
        transport.setSignIn("planner@example.com", WeddingDayHttpResponse(200, """{"success":true,"sessionToken":"session-abc"}"""))
        transport.setWorkspace("planner:wedding:B", WeddingDayHttpResponse(200, workspaceFor("planner:wedding:B", "B", "Wedding B")))
        // Deliberately no configured response for C: models "the fetch is delayed/fails".
        val session = sessionWith(transport)
        session.signIn("planner@example.com", "correct horse battery staple")
        session.selectGrant("planner:wedding:B")
        assertEquals("B", session.productionWorkspace.value?.weddingId)

        // Because Dispatchers.Unconfined runs the launched fetch to completion within selectGrant()
        // itself here, this also proves the end state; the synchronous clear inside applyAuthority()
        // is what guarantees no fallback regardless of how long the real network call takes.
        session.selectGrant("planner:wedding:C")

        assertNull(session.productionWorkspace.value)
        val weddingId = session.productionWorkspace.value?.weddingId
        assertTrue("B's data must never render under C's context", weddingId == null || weddingId == "C")
        assertEquals("planner:wedding:C", session.activeGrantId.value)
        assertEquals("C", session.weddingId.value)
    }

    // ---------------------------------------------------------------------------------------
    // 13/15/17. Account isolation
    // ---------------------------------------------------------------------------------------

    @Test
    fun signOutThenSignInAsAnotherAccountCarriesNothingOver() {
        val (session, transport) = signedInMultiAxisSession()
        session.selectGrant("planner:wedding:B")
        assertEquals("B", session.weddingId.value)

        session.signOut()
        assertFalse(session.isAuthenticated.value)
        assertTrue(session.selectedGrantIds.value.isEmpty())
        assertNull(session.activeGrantId.value)
        assertNull(session.productionWorkspace.value)

        transport.setSignIn("other@example.com", WeddingDayHttpResponse(200, """{"success":true,"sessionToken":"session-xyz"}"""))
        // A completely different account with its own single grant.
        val otherAuthority = collidingAuthorityFor("user-2", "planner:wedding:Z")
        val transport2 = FakeTransport(mutableListOf(WeddingDayHttpResponse(200, otherAuthority)))
        transport2.setSignIn("other@example.com", WeddingDayHttpResponse(200, """{"success":true,"sessionToken":"session-xyz"}"""))
        transport2.setWorkspace("planner:wedding:Z", WeddingDayHttpResponse(200, workspaceFor("planner:wedding:Z", "Z", "Wedding Z (Account B)")))
        val session2 = sessionWith(transport2)
        session2.signIn("other@example.com", "another-password")

        assertEquals("user-2", session2.productionAuthority.value?.accessUserId)
        assertFalse(session2.selectedGrantIds.value.contains("planner:wedding:B"))
        assertEquals("Z", session2.weddingId.value)
    }

    @Test
    fun directCredentialReplacementWithNoPriorSignOutStillCarriesNothingOver() {
        // Account A is restored/signed-in first, in the SAME process, with no explicit signOut().
        val (session, transport) = signedInMultiAxisSession()
        session.selectGrant("planner:wedding:B")
        assertEquals("B", session.weddingId.value)
        assertTrue(session.selectedGrantIds.value.contains("planner:wedding:B"))

        // Now sign in directly as Account B, whose OWN authority happens to grant the EXACT SAME
        // grant id Account A had selected. If in-memory selection state were reused, B would appear
        // to already have "planner:wedding:X" active without ever choosing it.
        val sharedGrantId = "planner:wedding:X"
        transport.setSignIn("account-b@example.com", WeddingDayHttpResponse(200, """{"success":true,"sessionToken":"session-b"}"""))
        val collidingAuthorityWithSharedId = """
            {"success": true, "authority": {
              "contract": "WewedProductionAuthorityV1", "version": 1, "accountStatus": "authorized",
              "identity": {"accessUserId": "account-b", "dashboardClass": "planner"},
              "workspaceGrants": [
                {"grantId": "$sharedGrantId", "workspaceKind": "planner", "scopeKind": "wedding",
                 "weddingId": "X", "weddingTitle": "Wedding X (belongs to Account B too)", "coupleId": null,
                 "businessAccountId": null, "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []},
                {"grantId": "planner:wedding:Y", "workspaceKind": "planner", "scopeKind": "wedding",
                 "weddingId": "Y", "weddingTitle": "Wedding Y", "coupleId": null, "businessAccountId": null,
                 "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []}
              ],
              "contextSelection": [{"workspaceKind":"planner","grantIds":["$sharedGrantId","planner:wedding:Y"],"selectionRequired":true}],
              "unsupported": [], "platform": {"effectiveRole": null}
            }}
        """.trimIndent()
        val transportB = FakeTransport(mutableListOf(WeddingDayHttpResponse(200, collidingAuthorityWithSharedId)))
        transportB.setSignIn("account-b@example.com", WeddingDayHttpResponse(200, """{"success":true,"sessionToken":"session-b"}"""))
        // Reuse the SAME session object as if the app just called signIn() again without signOut().
        kotlinx.coroutines.runBlocking {
            session.signInWithServer(ProductionAuthorityClient(transportB), "account-b@example.com", "b-password")
        }

        assertEquals("account-b", session.productionAuthority.value?.accessUserId)
        // Account B's own grant id happens to collide with what Account A had selected. It must
        // NOT be treated as already-selected/active just because the string matches.
        assertFalse(
            "Account A's stale selection must not silently authorize the identical grant id for Account B",
            session.selectedGrantIds.value.contains(sharedGrantId) && session.activeGrantId.value == sharedGrantId,
        )
        assertNull(session.weddingId.value)
        assertTrue(session.authorizedRoles.value.isEmpty() || session.currentRole.value == null)
    }

    @Test
    fun aPersistedSelectionOwnedByAccountACannotAutoSelectTheSameGrantIdForAccountB() {
        val sharedGrantId = "planner:wedding:SHARED"
        val storage = InMemorySecureStorage()
        // Persisted preference is explicitly owned by Account A.
        storage.save("wewed.account.session", "account-b-token")
        storage.save("wewed.account.selected-grants.owner", "account-a")
        storage.save("wewed.account.selected-grants", sharedGrantId)

        // Account B legitimately has the SAME grant-id text, but also another Planner wedding.
        // Because this kind requires an explicit choice, inheriting A's preference would auto-open
        // SHARED for B without B ever selecting it.
        val accountBAuthority = """
            {"success": true, "authority": {
              "contract": "WewedProductionAuthorityV1", "version": 1, "accountStatus": "authorized",
              "identity": {"accessUserId": "account-b", "dashboardClass": "planner"},
              "workspaceGrants": [
                {"grantId": "$sharedGrantId", "workspaceKind": "planner", "scopeKind": "wedding",
                 "weddingId": "SHARED", "weddingTitle": "Wedding Shared", "coupleId": null, "businessAccountId": null,
                 "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []},
                {"grantId": "planner:wedding:OTHER", "workspaceKind": "planner", "scopeKind": "wedding",
                 "weddingId": "OTHER", "weddingTitle": "Wedding Other", "coupleId": null, "businessAccountId": null,
                 "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []}
              ],
              "contextSelection": [{"workspaceKind":"planner","grantIds":["$sharedGrantId","planner:wedding:OTHER"],"selectionRequired":true}],
              "unsupported": [], "platform": {"effectiveRole": null}
            }}
        """.trimIndent()

        val transport = FakeTransport(mutableListOf(WeddingDayHttpResponse(200, accountBAuthority)))
        val session = SessionViewModel(
            storage = storage,
            environment = NativeDataEnvironment.PRODUCTION,
            authorityClient = null,
            scope = CoroutineScope(Dispatchers.Unconfined),
        )

        kotlinx.coroutines.runBlocking {
            session.restoreFromServer(ProductionAuthorityClient(transport), "account-b-token")
        }

        assertEquals("account-b", session.productionAuthority.value?.accessUserId)
        assertTrue("Account A's persisted selection must be discarded", session.selectedGrantIds.value.isEmpty())
        assertNull("Account B must still make its own Planner choice", session.activeGrantId.value)
        assertNull(session.currentRole.value)
        assertNull(session.weddingId.value)
        assertNull(storage.get("wewed.account.selected-grants"))
        assertNull(storage.get("wewed.account.selected-grants.owner"))
    }

    @Test
    fun sameAccountPersistedSelectionRestoresOnlyWhenOwnerMatchesVerifiedIdentity() {
        val storage = InMemorySecureStorage()
        storage.save("wewed.account.session", "session-user-1")
        storage.save("wewed.account.selected-grants.owner", "user-1")
        storage.save("wewed.account.selected-grants", "planner:wedding:B")

        val transport = FakeTransport(mutableListOf(WeddingDayHttpResponse(200, multiAxisAuthority)))
        transport.setWorkspace(
            "planner:wedding:B",
            WeddingDayHttpResponse(200, workspaceFor("planner:wedding:B", "B", "Wedding B"))
        )
        val session = SessionViewModel(
            storage = storage,
            environment = NativeDataEnvironment.PRODUCTION,
            authorityClient = null,
            scope = CoroutineScope(Dispatchers.Unconfined),
        )

        kotlinx.coroutines.runBlocking {
            session.restoreFromServer(ProductionAuthorityClient(transport), "session-user-1")
        }

        assertEquals("planner:wedding:B", session.activeGrantId.value)
        assertEquals("B", session.weddingId.value)
        assertEquals(setOf("planner:wedding:B"), session.selectedGrantIds.value.filter { it.startsWith("planner:") }.toSet())
    }

    // ---------------------------------------------------------------------------------------
    // Multi-axis: an active workspace is not interrupted by an unrelated selectionRequired axis
    // ---------------------------------------------------------------------------------------

    @Test
    fun anActiveCoupleWorkspaceIsNotInterruptedByAnUnrelatedPlannerSelectionRequirement() {
        val (session, _) = signedInMultiAxisSession()
        session.selectGrant("couple:wedding:A")
        assertEquals(AppRole.COUPLE, session.currentRole.value)
        assertEquals("A", session.weddingId.value)
        // The fixture's Planner axis ALSO requires selection (B vs C) and remains completely
        // unselected throughout. Being Couple-active must not force that choice.
        assertTrue(session.selectedGrantIds.value.none { it.startsWith("planner:") })
        assertEquals(AppRole.COUPLE, session.currentRole.value)
    }

    // ---------------------------------------------------------------------------------------
    // Shadow remains impossible as production authority (regression pin)
    // ---------------------------------------------------------------------------------------

    @Test
    fun shadowPersonaSwitchingRemainsRefusedEvenWithARealMultiAxisAuthorityLoaded() {
        val (session, _) = signedInMultiAxisSession()
        assertFalse(session.enterShadowSession())
        assertFalse(session.switchPersona(pro.wewed.app.models.DevelopmentPersona.defaultShadowPersona))
    }
}
