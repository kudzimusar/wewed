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
    ) : WeddingDayHttpTransport {
        var lastAuthorizationHeader: String? = null

        override suspend fun get(path: String, headers: Map<String, String>): WeddingDayHttpResponse {
            lastAuthorizationHeader = headers["Authorization"]
            return authorityResponse
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
    fun productionWithAResolvedAuthorityFeedsARealAssignmentSourceIntoActorAssignmentSources() {
        val transport = FakeTransport(
            signInResponse = WeddingDayHttpResponse(200, """{"success": true, "sessionToken": "session-abc"}"""),
            authorityResponse = WeddingDayHttpResponse(200, singleCoupleGrantAuthority),
        )
        val session = sessionWith(transport)
        session.signIn("couple@example.com", "correct horse battery staple")

        val source = ActorAssignmentSources.forEnvironment(
            NativeDataEnvironment.PRODUCTION,
            pro.wewed.app.services.ShadowReferenceWeddingRepository(),
            productionAuthority = session.productionAuthority.value,
            selectedGrantIds = session.selectedGrantIds.value,
        )
        val assignments = kotlinx.coroutines.runBlocking { source.assignments("user-1") }
        assertEquals("A", assignments.single().weddingId)
    }
}
