package pro.wewed.app.services

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/**
 * QRO05-PIQR01 — [ProductionWeddingRepository.loadPlannerInvitations] against a fake transport
 * (same pattern as [ProductionDomainRepositoriesTest]). Fixture links are synthetic placeholders,
 * never real invitation credentials.
 */
class PlannerInvitationsReaderTest {

    private class FakeTransport(private val responses: Map<String, WeddingDayHttpResponse>) : WeddingDayHttpTransport {
        val requests = mutableListOf<Triple<String, String, Map<String, String>>>()

        override suspend fun get(path: String, headers: Map<String, String>): WeddingDayHttpResponse {
            requests.add(Triple("GET", path, headers))
            return responses[path.substringBefore('?')] ?: WeddingDayHttpResponse(503, "")
        }

        override suspend fun post(path: String, headers: Map<String, String>, body: String): WeddingDayHttpResponse {
            requests.add(Triple("POST", path, headers))
            return WeddingDayHttpResponse(405, "")
        }

        override suspend fun patch(path: String, headers: Map<String, String>, body: String): WeddingDayHttpResponse {
            requests.add(Triple("PATCH", path, headers))
            return WeddingDayHttpResponse(405, "")
        }
    }

    private val invitationsPath = "api/native/wedding/invitations"
    private val physicalPath = "api/native/wedding/invitations/physical"

    private val invitationsBody = """
        {"success":true,"count":4,"missingTokens":1,
         "wedding":{"slug":"fixture","title":"Fixture Wedding","invitationCardStyle":"ivory-floral-gold",
                    "invitationCardMessage":"Join us","rsvpDeadline":"2026-11-01T00:00:00.000Z","childrenPolicy":"adults_only"},
         "data":[
          {"id":"g-attending","name":"Ada","tableNumber":4,"status":"attending","checkedIn":false,
           "invitationUrl":"https://fixture.invalid/one","qrValue":"https://fixture.invalid/one","shareMessage":"Hi Ada https://fixture.invalid/one"},
          {"id":"g-declined","name":"Ben","tableNumber":null,"status":"declined","checkedIn":false,
           "invitationUrl":"https://fixture.invalid/two","qrValue":"https://fixture.invalid/two","shareMessage":"Hi Ben https://fixture.invalid/two"},
          {"id":"g-pending","name":"Cy","tableNumber":3,"status":"pending","checkedIn":false,
           "invitationUrl":"https://fixture.invalid/three","qrValue":"https://fixture.invalid/three","shareMessage":"Hi Cy https://fixture.invalid/three"},
          {"id":"g-missing","name":"Di","tableNumber":null,"status":"pending","checkedIn":false,
           "invitationUrl":null,"qrValue":null,"shareMessage":null}
         ]}
    """.trimIndent()

    private val configuredPhysical = """
        {"success":true,"configured":true,"code":"ABCD-EFGH-23","rawCode":"ABCDEFGH23",
         "accessUrl":"https://fixture.invalid/i/printed","scanCount":7,"invitedCount":4,"createdAt":null,
         "wedding":{"slug":"fixture","title":"Fixture Wedding"}}
    """.trimIndent()

    private val unconfiguredPhysical = """
        {"success":true,"configured":false,"code":null,"rawCode":null,"accessUrl":null,"scanCount":0,"invitedCount":4,
         "createdAt":null,"wedding":{"slug":"fixture","title":"Fixture Wedding"}}
    """.trimIndent()

    private fun repo(transport: FakeTransport) =
        ProductionWeddingRepository(NativeDomainApiClient(transport), "test-session-token", "planner:wedding:wed-1", "wed-1")

    private fun transport(invitations: WeddingDayHttpResponse, physical: WeddingDayHttpResponse) =
        FakeTransport(mapOf(invitationsPath to invitations, physicalPath to physical))

    private fun loaded(load: PlannerInvitationsLoad): PlannerInvitationsSnapshot =
        (load as? PlannerInvitationsLoad.Loaded)?.snapshot ?: throw AssertionError("expected loaded, got $load")

    @Test
    fun `configured snapshot maps design statuses tables and missing links`() = runBlocking {
        val snapshot = loaded(repo(transport(WeddingDayHttpResponse(200, invitationsBody), WeddingDayHttpResponse(200, configuredPhysical))).loadPlannerInvitations())

        assertEquals("ivory-floral-gold", snapshot.design.styleId)
        assertEquals("Ivory Floral Gold", snapshot.design.styleLabel)
        assertEquals("Join us", snapshot.design.message)
        assertEquals("Adults only", snapshot.design.childrenPolicyLabel)
        assertEquals(
            listOf(PlannerInvitationRsvpStatus.ATTENDING, PlannerInvitationRsvpStatus.DECLINED, PlannerInvitationRsvpStatus.PENDING, PlannerInvitationRsvpStatus.PENDING),
            snapshot.guests.map { it.status }
        )
        assertEquals(listOf("Table 4", "No table", "Table 3", "No table"), snapshot.guests.map { it.tableLabel })
        assertEquals(1, snapshot.missingLinks)
        assertFalse(snapshot.guests[3].hasInvitationLink)
        assertNull(snapshot.guests[3].shareMessage)
        assertEquals("https://fixture.invalid/one", snapshot.guests[0].qrValue)
        assertTrue(snapshot.physical.configured)
        assertEquals("ABCD-EFGH-23", snapshot.physical.code)
        assertEquals("https://fixture.invalid/i/printed", snapshot.physical.accessUrl)
        assertEquals(7, snapshot.physical.scanCount)
        assertEquals(4, snapshot.physical.invitedCount)
    }

    @Test
    fun `unconfigured printed invitation has no QR payload`() = runBlocking {
        val snapshot = loaded(repo(transport(WeddingDayHttpResponse(200, invitationsBody), WeddingDayHttpResponse(200, unconfiguredPhysical))).loadPlannerInvitations())
        assertFalse(snapshot.physical.configured)
        assertNull(snapshot.physical.accessUrl)
        assertNull(snapshot.physical.code)
        assertEquals(4, snapshot.physical.invitedCount)
    }

    @Test
    fun `reads are GET only with bearer and grant`() = runBlocking {
        val fake = transport(WeddingDayHttpResponse(200, invitationsBody), WeddingDayHttpResponse(200, configuredPhysical))
        repo(fake).loadPlannerInvitations()
        assertEquals(2, fake.requests.size)
        fake.requests.forEach { (method, path, headers) ->
            assertEquals("GET", method)
            assertEquals("Bearer test-session-token", headers["Authorization"])
            assertTrue(path, path.endsWith("?grantId=planner%3Awedding%3Awed-1"))
        }
        assertEquals(setOf(invitationsPath, physicalPath), fake.requests.map { it.second.substringBefore('?') }.toSet())
    }

    @Test
    fun `refusals and transport failures are unavailable never empty data`() = runBlocking {
        val cases = listOf(401 to "{}", 403 to """{"code":"GRANT_REVOKED"}""", 403 to """{"code":"FORBIDDEN"}""", 503 to "")
        for ((status, body) in cases) {
            val load = repo(transport(WeddingDayHttpResponse(status, body), WeddingDayHttpResponse(200, configuredPhysical))).loadPlannerInvitations()
            if (load !is PlannerInvitationsLoad.Unavailable) fail("status $status must be unavailable")
        }
        val physicalDown = repo(transport(WeddingDayHttpResponse(200, invitationsBody), WeddingDayHttpResponse(500, ""))).loadPlannerInvitations()
        assertTrue(physicalDown is PlannerInvitationsLoad.Unavailable)
    }

    @Test
    fun `malformed payloads are unavailable`() = runBlocking {
        val malformed = listOf("""{"success":true}""", """{"success":false,"data":[]}""", "not json",
            """{"success":true,"wedding":{"title":"x"},"data":[]}""")
        for (body in malformed) {
            val load = repo(transport(WeddingDayHttpResponse(200, body), WeddingDayHttpResponse(200, configuredPhysical))).loadPlannerInvitations()
            if (load !is PlannerInvitationsLoad.Unavailable) fail("malformed invitations body must be unavailable")
        }
        val badPhysical = repo(transport(WeddingDayHttpResponse(200, invitationsBody), WeddingDayHttpResponse(200, """{"success":true}"""))).loadPlannerInvitations()
        assertTrue(badPhysical is PlannerInvitationsLoad.Unavailable)
    }

    @Test
    fun `string forms redact credential-bearing values`() = runBlocking {
        val snapshot = loaded(repo(transport(WeddingDayHttpResponse(200, invitationsBody), WeddingDayHttpResponse(200, configuredPhysical))).loadPlannerInvitations())
        val dumped = "$snapshot ${snapshot.guests} ${snapshot.physical}"
        assertFalse("a logged model must never carry a link", dumped.contains("fixture.invalid"))
    }

    @Test
    fun `style names mirror the web catalogue`() {
        assertEquals("Garden Romance", PlannerInvitationDesign.styleName("botanical"))
        assertEquals("Midnight Gold", PlannerInvitationDesign.styleName("midnight"))
        assertEquals("New Future Style", PlannerInvitationDesign.styleName("new-future-style"))
        assertEquals(12, PlannerInvitationDesign.STYLE_NAMES.size)
    }
}
