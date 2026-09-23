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
import pro.wewed.app.navigation.ActorAssignmentSources
import pro.wewed.app.services.InMemorySecureStorage
import pro.wewed.app.services.ProductionAuthorityClient
import pro.wewed.app.services.WeddingDayHttpResponse
import pro.wewed.app.services.WeddingDayHttpTransport

/**
 * `SessionViewModel` real production sign-in/restore (master plan Phase 5). Uses a fake transport
 * rather than a real network, so every case is deterministic and offline. The iOS counterpart is
 * `SessionStoreAccountAuthorityTests`.
 */
class SessionAccountAuthorityTest {

    private val singleCoupleGrantAuthority = """
        {"success": true, "authority": {
          "contract": "WewedProductionAuthorityV1", "version": 1, "accountStatus": "authorized",
          "identity": {"accessUserId": "user-1", "dashboardClass": "couple"},
          "workspaceGrants": [{
            "grantId": "couple:wedding:A", "workspaceKind": "couple", "scopeKind": "wedding",
            "weddingId": "A", "weddingTitle": "Wedding A", "coupleId": null, "businessAccountId": null,
            "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []
          }],
          "contextSelection": [], "unsupported": [], "platform": {"effectiveRole": null}
        }}
    """.trimIndent()

    private val coupleWorkspace = """
        {"success":true,"workspace":{
          "grantId":"couple:wedding:A","workspaceKind":"couple","scopeKind":"wedding",
          "weddingId":"A","weddingTitle":"Wedding A","businessAccountId":null,"vendorId":null,
          "serviceEngagementIds":[],"permissions":[],"platformRoles":[],
          "wedding":{"id":"A","slug":"wedding-a","title":"Wedding A","date":"2027-01-01T00:00:00.000Z",
          "venue":"Real Venue","venueCity":"Harare","venueCountry":"Zimbabwe","lifecycle":"before",
          "coupleNames":"A & B"}
        }}
    """.trimIndent()

    private val multiPlannerAuthority = """
        {"success": true, "authority": {
          "contract":"WewedProductionAuthorityV1","version":1,"accountStatus":"authorized",
          "identity":{"accessUserId":"planner-1","dashboardClass":"planner"},
          "workspaceGrants":[
            {"grantId":"planner:wedding:A","workspaceKind":"planner","scopeKind":"wedding",
             "weddingId":"A","weddingTitle":"Wedding A","coupleId":null,"businessAccountId":null,
             "vendorId":null,"serviceEngagementIds":[],"permissions":[],"platformRoles":[]},
            {"grantId":"planner:wedding:B","workspaceKind":"planner","scopeKind":"wedding",
             "weddingId":"B","weddingTitle":"Wedding B","coupleId":null,"businessAccountId":null,
             "vendorId":null,"serviceEngagementIds":[],"permissions":[],"platformRoles":[]}
          ],
          "contextSelection":[{"workspaceKind":"planner","grantIds":["planner:wedding:A","planner:wedding:B"],"selectionRequired":true}],
          "unsupported":[],"platform":{"effectiveRole":null}
        }}
    """.trimIndent()

    private val plannerPortfolioAuthority = """
        {"success": true, "authority": {
          "contract":"WewedProductionAuthorityV1","version":1,"accountStatus":"authorized",
          "identity":{"accessUserId":"planner-1","dashboardClass":"planner"},
          "workspaceGrants":[{
            "grantId":"planner:portfolio:business-1","workspaceKind":"planner","scopeKind":"portfolio",
            "weddingId":null,"weddingTitle":null,"coupleId":null,"businessAccountId":"business-1",
            "vendorId":null,"serviceEngagementIds":[],"permissions":[],"platformRoles":[]
          }],
          "contextSelection":[{"workspaceKind":"planner","grantIds":["planner:portfolio:business-1"],"selectionRequired":false}],
          "unsupported":[],"platform":{"effectiveRole":null}
        }}
    """.trimIndent()

    private val singleGateAuthority = """
        {"success": true, "authority": {
          "contract":"WewedProductionAuthorityV1","version":1,"accountStatus":"authorized",
          "identity":{"accessUserId":"usher-1","dashboardClass":"viewer"},
          "workspaceGrants":[],"contextSelection":[],
          "operationalGrants":[{
            "grantId":"gate_operator:W:gate-A","kind":"gate_operator","assignmentId":"ga-A",
            "weddingId":"W","weddingTitle":"Wedding W","gateId":"gate-A","gateName":"Main Gate",
            "operatorUserId":"usher-1",
            "capabilities":["gate.manifest.read","gate.checkin.write","gate.guest_search.read","gate.audit.read"]
          }],
          "gateContextSelection":{"kind":"gate_operator","grantIds":["gate_operator:W:gate-A"],"selectionRequired":false},
          "unsupported":[{"authority":"guest","reason":"Guest Session"}],"platform":{"effectiveRole":null}
        }}
    """.trimIndent()

    private val multipleGateAuthority = """
        {"success": true, "authority": {
          "contract":"WewedProductionAuthorityV1","version":1,"accountStatus":"authorized",
          "identity":{"accessUserId":"usher-1","dashboardClass":"viewer"},
          "workspaceGrants":[],"contextSelection":[],
          "operationalGrants":[
            {"grantId":"gate_operator:W:gate-A","kind":"gate_operator","assignmentId":"ga-A",
             "weddingId":"W","weddingTitle":"Wedding W","gateId":"gate-A","gateName":"Main Gate",
             "operatorUserId":"usher-1","capabilities":["gate.checkin.write"]},
            {"grantId":"gate_operator:W:gate-B","kind":"gate_operator","assignmentId":"ga-B",
             "weddingId":"W","weddingTitle":"Wedding W","gateId":"gate-B","gateName":"Side Gate",
             "operatorUserId":"usher-1","capabilities":["gate.checkin.write"]}
          ],
          "gateContextSelection":{"kind":"gate_operator",
            "grantIds":["gate_operator:W:gate-A","gate_operator:W:gate-B"],"selectionRequired":true},
          "unsupported":[{"authority":"guest","reason":"Guest Session"}],"platform":{"effectiveRole":null}
        }}
    """.trimIndent()

    private val onlyGateBAuthority = """
        {"success": true, "authority": {
          "contract":"WewedProductionAuthorityV1","version":1,"accountStatus":"authorized",
          "identity":{"accessUserId":"usher-1","dashboardClass":"viewer"},
          "workspaceGrants":[],"contextSelection":[],
          "operationalGrants":[{
            "grantId":"gate_operator:W:gate-B","kind":"gate_operator","assignmentId":"ga-B",
            "weddingId":"W","weddingTitle":"Wedding W","gateId":"gate-B","gateName":"Side Gate",
            "operatorUserId":"usher-1","capabilities":["gate.checkin.write"]
          }],
          "gateContextSelection":{"kind":"gate_operator","grantIds":["gate_operator:W:gate-B"],"selectionRequired":false},
          "unsupported":[{"authority":"guest","reason":"Guest Session"}],"platform":{"effectiveRole":null}
        }}
    """.trimIndent()

    private val workspaceAndGateAuthority = """
        {"success": true, "authority": {
          "contract":"WewedProductionAuthorityV1","version":1,"accountStatus":"authorized",
          "identity":{"accessUserId":"user-1","dashboardClass":"couple"},
          "workspaceGrants":[{
            "grantId":"couple:wedding:A","workspaceKind":"couple","scopeKind":"wedding",
            "weddingId":"A","weddingTitle":"Wedding A","coupleId":null,"businessAccountId":null,
            "vendorId":null,"serviceEngagementIds":[],"permissions":["*"],"platformRoles":[]
          }],
          "contextSelection":[{"workspaceKind":"couple","grantIds":["couple:wedding:A"],"selectionRequired":false}],
          "operationalGrants":[{
            "grantId":"gate_operator:A:gate-A","kind":"gate_operator","assignmentId":"ga-A",
            "weddingId":"A","weddingTitle":"Wedding A","gateId":"gate-A","gateName":"Main Gate",
            "operatorUserId":"user-1","capabilities":["gate.checkin.write"]
          }],
          "gateContextSelection":{"kind":"gate_operator","grantIds":["gate_operator:A:gate-A"],"selectionRequired":false},
          "unsupported":[{"authority":"guest","reason":"Guest Session"}],"platform":{"effectiveRole":null}
        }}
    """.trimIndent()

    private val bannedAuthority = """
        {"success": true, "authority": {
          "contract": "WewedProductionAuthorityV1", "version": 1, "accountStatus": "banned_identity",
          "identity": null, "workspaceGrants": [], "contextSelection": [], "unsupported": [],
          "platform": {"effectiveRole": null}
        }}
    """.trimIndent()

    private class FakeTransport(
        private val signInResponse: WeddingDayHttpResponse,
        private val authorityResponse: WeddingDayHttpResponse,
        private val workspaceResponse: WeddingDayHttpResponse? = null,
    ) : WeddingDayHttpTransport {
        var lastAuthorizationHeader: String? = null

        override suspend fun get(path: String, headers: Map<String, String>): WeddingDayHttpResponse {
            lastAuthorizationHeader = headers["Authorization"]
            return if (path.startsWith("api/native/account/workspace")) {
                // Most authority tests are not workspace-data tests. An omitted response models a
                // transient downstream failure, which must withhold data without revoking the
                // freshly-proven grant. Explicit revocation tests pass 403/404 themselves.
                workspaceResponse ?: WeddingDayHttpResponse(503, "Service Unavailable")
            } else {
                authorityResponse
            }
        }

        override suspend fun post(path: String, headers: Map<String, String>, body: String): WeddingDayHttpResponse =
            signInResponse
    }

    private fun sessionWith(transport: WeddingDayHttpTransport, storage: InMemorySecureStorage = InMemorySecureStorage()) =
        SessionViewModel(
            storage = storage,
            environment = NativeDataEnvironment.PRODUCTION,
            authorityClient = ProductionAuthorityClient(transport),
            scope = CoroutineScope(Dispatchers.Unconfined),
        )

    @Test
    fun signInResolvesRealAuthorityAndOpensExactlyOneGrantedWedding() {
        val transport = FakeTransport(
            signInResponse = WeddingDayHttpResponse(200, """{"success": true, "sessionToken": "session-abc"}"""),
            authorityResponse = WeddingDayHttpResponse(200, singleCoupleGrantAuthority),
        )
        val session = sessionWith(transport)

        session.signIn("couple@example.com", "correct horse battery staple")

        assertTrue(session.isAuthenticated.value)
        assertEquals(AppRole.COUPLE, session.currentRole.value)
        assertEquals("A", session.weddingId.value)
        assertEquals(listOf(AppRole.COUPLE), session.authorizedRoles.value)
        assertNull(session.authenticationError.value)
        // The Bearer token used for the authority call is the server-issued identity session, and
        // nothing about role or wedding is ever sent by the client to obtain it.
        assertEquals("Bearer session-abc", transport.lastAuthorizationHeader)
    }

    @Test
    fun invalidCredentialsNeverAuthenticate() {
        val transport = FakeTransport(
            signInResponse = WeddingDayHttpResponse(401, """{"success": false, "error": "Invalid email or password."}"""),
            authorityResponse = WeddingDayHttpResponse(200, singleCoupleGrantAuthority),
        )
        val session = sessionWith(transport)

        session.signIn("nobody@example.com", "wrong-password")

        assertFalse(session.isAuthenticated.value)
        assertNull(session.currentRole.value)
        assertEquals("Invalid email or password.", session.authenticationError.value)
    }

    @Test
    fun aBannedOrInactiveAccountKeepsNoWorkspaceEvenThoughTheIdentitySessionIsValid() {
        val transport = FakeTransport(
            signInResponse = WeddingDayHttpResponse(200, """{"success": true, "sessionToken": "session-abc"}"""),
            authorityResponse = WeddingDayHttpResponse(200, bannedAuthority),
        )
        val session = sessionWith(transport)

        session.signIn("couple@example.com", "correct horse battery staple")

        // The identity session itself was proven valid by the server (200, not 401): the person is
        // not bounced back to a login form. But no role, wedding or authorized-roles entry exists.
        assertTrue(session.isAuthenticated.value)
        assertNull(session.currentRole.value)
        assertTrue(session.authorizedRoles.value.isEmpty())
    }

    @Test
    fun restoreSessionWithNoStoredCredentialNeverCallsTheServer() {
        val transport = FakeTransport(
            signInResponse = WeddingDayHttpResponse(200, """{"success": true, "sessionToken": "unused"}"""),
            authorityResponse = WeddingDayHttpResponse(200, singleCoupleGrantAuthority),
        )
        val session = sessionWith(transport)

        assertTrue(session.sessionRestored.value)
        assertFalse(session.isAuthenticated.value)
        assertNull(transport.lastAuthorizationHeader)
    }

    @Test
    fun restoreSessionRevalidatesAStoredCredentialAgainstTheServerBeforeGrantingAnything() {
        val storage = InMemorySecureStorage()
        storage.save("wewed.account.session", "session-from-a-previous-launch")
        val transport = FakeTransport(
            signInResponse = WeddingDayHttpResponse(200, """{"success": true, "sessionToken": "unused"}"""),
            authorityResponse = WeddingDayHttpResponse(200, singleCoupleGrantAuthority),
        )
        val session = sessionWith(transport, storage)

        assertTrue(session.sessionRestored.value)
        assertTrue(session.isAuthenticated.value)
        assertEquals(AppRole.COUPLE, session.currentRole.value)
        assertEquals("Bearer session-from-a-previous-launch", transport.lastAuthorizationHeader)
    }

    @Test
    fun aServerRejectedSessionIsFullyClearedNotJustDeniedAWorkspace() {
        val storage = InMemorySecureStorage()
        storage.save("wewed.account.session", "revoked-session")
        storage.save("wewed.account.selected-grants", "planner:wedding:B")
        val transport = FakeTransport(
            signInResponse = WeddingDayHttpResponse(200, """{"success": true, "sessionToken": "unused"}"""),
            authorityResponse = WeddingDayHttpResponse(401, """{"success": false, "error": "invalid"}"""),
        )
        val session = sessionWith(transport, storage)

        assertTrue(session.sessionRestored.value)
        assertFalse(session.isAuthenticated.value)
        assertNull(session.currentRole.value)
        assertNull(storage.get("wewed.account.session"))
        assertNull(storage.get("wewed.account.selected-grants"))
    }

    @Test
    fun aTransientNetworkFailureOnRestoreNeitherSignsInNorDestroysTheStoredCredential() {
        val storage = InMemorySecureStorage()
        storage.save("wewed.account.session", "still-possibly-good")
        val transport = FakeTransport(
            signInResponse = WeddingDayHttpResponse(200, """{"success": true, "sessionToken": "unused"}"""),
            authorityResponse = WeddingDayHttpResponse(503, "Service Unavailable"),
        )
        val session = sessionWith(transport, storage)

        assertTrue(session.sessionRestored.value)
        assertFalse(session.isAuthenticated.value)
        assertEquals("still-possibly-good", storage.get("wewed.account.session"))
    }

    @Test
    fun selectingAGrantThatDoesNotExistInTheCurrentAuthorityIsIgnored() {
        val transport = FakeTransport(
            signInResponse = WeddingDayHttpResponse(200, """{"success": true, "sessionToken": "session-abc"}"""),
            authorityResponse = WeddingDayHttpResponse(200, singleCoupleGrantAuthority),
        )
        val session = sessionWith(transport)
        session.signIn("couple@example.com", "correct horse battery staple")

        session.selectGrant("planner:wedding:does-not-exist")

        assertTrue(session.selectedGrantIds.value.isEmpty())
        assertEquals(AppRole.COUPLE, session.currentRole.value)
    }

    @Test
    fun signInLoadsARevalidatedReadOnlyWorkspaceSnapshot() {
        val transport = FakeTransport(
            signInResponse = WeddingDayHttpResponse(200, """{"success":true,"sessionToken":"session-abc"}"""),
            authorityResponse = WeddingDayHttpResponse(200, singleCoupleGrantAuthority),
            workspaceResponse = WeddingDayHttpResponse(200, coupleWorkspace),
        )
        val session = sessionWith(transport)
        session.signIn("couple@example.com", "correct")

        assertEquals("couple:wedding:A", session.activeGrantId.value)
        assertEquals("Wedding A", session.productionWorkspace.value?.wedding?.title)
        assertEquals("Real Venue", session.productionWorkspace.value?.wedding?.venue)
    }

    @Test
    fun selectingASecondPlannerWeddingReplacesTheFirstSameKindSelection() {
        val transport = FakeTransport(
            signInResponse = WeddingDayHttpResponse(200, """{"success":true,"sessionToken":"session-abc"}"""),
            authorityResponse = WeddingDayHttpResponse(200, multiPlannerAuthority),
        )
        val session = sessionWith(transport)
        session.signIn("planner@example.com", "correct")

        assertNull(session.currentRole.value)
        assertNull(session.activeGrantId.value)

        session.selectGrant("planner:wedding:A")
        assertEquals(setOf("planner:wedding:A"), session.selectedGrantIds.value)
        assertEquals("A", session.weddingId.value)

        session.selectGrant("planner:wedding:B")
        assertEquals(setOf("planner:wedding:B"), session.selectedGrantIds.value)
        assertEquals("planner:wedding:B", session.activeGrantId.value)
        assertEquals("B", session.weddingId.value)
    }

    @Test
    fun solePlannerPortfolioIsRealAuthorityWithoutAFakeWeddingAssignment() {
        val transport = FakeTransport(
            signInResponse = WeddingDayHttpResponse(200, """{"success":true,"sessionToken":"session-abc"}"""),
            authorityResponse = WeddingDayHttpResponse(200, plannerPortfolioAuthority),
        )
        val session = sessionWith(transport)
        session.signIn("planner@example.com", "correct")

        assertTrue(session.isAuthenticated.value)
        assertNull(session.currentRole.value)
        assertNull(session.weddingId.value)
        assertEquals("planner:portfolio:business-1", session.activeGrantId.value)
    }

    @Test
    fun signInWithNoAuthorityClientConfiguredStillRefusesExactlyAsBefore() {
        val session = SessionViewModel(environment = NativeDataEnvironment.PRODUCTION)
        try {
            session.signIn("someone@example.com", "a-password")
            org.junit.Assert.fail("expected IllegalStateException")
        } catch (expected: IllegalStateException) {
            assertTrue(expected.message!!.contains("not connected"))
        }
        assertFalse(session.isAuthenticated.value)
    }

    @Test
    fun pureUsherNeedsNoPlanningWorkspaceAndOpensFromSoleOperationalGrant() {
        val transport = FakeTransport(
            signInResponse = WeddingDayHttpResponse(200, """{"success":true,"sessionToken":"session-usher"}"""),
            authorityResponse = WeddingDayHttpResponse(200, singleGateAuthority),
        )
        val session = sessionWith(transport)
        session.signIn("usher@example.com", "correct")

        assertTrue(session.isAuthenticated.value)
        assertEquals(AppRole.USHER, session.currentRole.value)
        assertEquals(listOf(AppRole.USHER), session.authorizedRoles.value)
        assertEquals("W", session.weddingId.value)
        assertNull(session.activeGrantId.value)
        assertEquals("gate-A", session.activeGateContext.value?.gateId)
        assertEquals("usher-1", session.activeGateContext.value?.operatorUserId)
    }

    @Test
    fun multipleGateAssignmentsRequireExplicitSelection() {
        val transport = FakeTransport(
            signInResponse = WeddingDayHttpResponse(200, """{"success":true,"sessionToken":"session-usher"}"""),
            authorityResponse = WeddingDayHttpResponse(200, multipleGateAuthority),
        )
        val session = sessionWith(transport)
        session.signIn("usher@example.com", "correct")

        assertNull(session.currentRole.value)
        assertNull(session.activeGateContext.value)
        assertTrue(AppRole.USHER in session.authorizedRoles.value)

        session.selectGateGrant("gate_operator:W:gate-B")
        assertEquals(AppRole.USHER, session.currentRole.value)
        assertEquals("gate-B", session.activeGateContext.value?.gateId)
        assertEquals("gate_operator:W:gate-B", session.selectedGateGrantId.value)
    }

    @Test
    fun revokedSelectedGateNeverSilentlyFallsOverToAnotherGate() {
        val storage = InMemorySecureStorage()
        storage.save("wewed.account.selected-gate-grant.owner", "usher-1")
        storage.save("wewed.account.selected-gate-grant", "gate_operator:W:gate-A")
        val transport = FakeTransport(
            signInResponse = WeddingDayHttpResponse(200, """{"success":true,"sessionToken":"session-usher"}"""),
            authorityResponse = WeddingDayHttpResponse(200, onlyGateBAuthority),
        )
        val session = sessionWith(transport, storage)
        session.signIn("usher@example.com", "correct")

        assertNull(session.currentRole.value)
        assertNull(session.activeGateContext.value)
        assertEquals("gate_operator:W:gate-A", session.selectedGateGrantId.value)

        session.selectGateGrant("gate_operator:W:gate-B")
        assertEquals(AppRole.USHER, session.currentRole.value)
        assertEquals("gate-B", session.activeGateContext.value?.gateId)
    }

    @Test
    fun workspaceAndGateAxesCanBeSwitchedExplicitlyInBothDirections() {
        val transport = FakeTransport(
            signInResponse = WeddingDayHttpResponse(200, """{"success":true,"sessionToken":"session-multi"}"""),
            authorityResponse = WeddingDayHttpResponse(200, workspaceAndGateAuthority),
        )
        val session = sessionWith(transport)
        session.signIn("multi@example.com", "correct")

        assertEquals(AppRole.COUPLE, session.currentRole.value)
        assertEquals("couple:wedding:A", session.activeGrantId.value)
        assertTrue(AppRole.USHER in session.authorizedRoles.value)

        session.selectGateGrant("gate_operator:A:gate-A")
        assertEquals(AppRole.USHER, session.currentRole.value)
        assertNull(session.activeGrantId.value)
        assertEquals("gate-A", session.activeGateContext.value?.gateId)

        session.selectGrant("couple:wedding:A")
        assertEquals(AppRole.COUPLE, session.currentRole.value)
        assertEquals("couple:wedding:A", session.activeGrantId.value)
        assertNull(session.activeGateContext.value)
        assertEquals("gate_operator:A:gate-A", session.selectedGateGrantId.value)
    }

    @Test
    fun productionWithAResolvedAuthorityFeedsARealAssignmentSourceIntoActorAssignmentSources() {
        val transport = FakeTransport(
            signInResponse = WeddingDayHttpResponse(200, """{"success": true, "sessionToken": "session-abc"}"""),
            authorityResponse = WeddingDayHttpResponse(200, singleCoupleGrantAuthority),
        )
        val session = sessionWith(transport)
        session.signIn("couple@example.com", "correct horse battery staple")

        // Master plan Phase 8 closure round 5 — forProduction() takes no repository parameter at
        // all: this proves a real production ActorAssignmentSource is constructible from nothing
        // but the resolved authority, with no Shadow/Fixture repository needed or read.
        val source = ActorAssignmentSources.forProduction(
            productionAuthority = requireNotNull(session.productionAuthority.value),
            selectedGrantIds = session.selectedGrantIds.value,
        )
        val assignments = kotlinx.coroutines.runBlocking { source.assignments("user-1") }
        assertEquals("A", assignments.single().weddingId)
    }
}
