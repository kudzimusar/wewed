package pro.wewed.app.services

import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import pro.wewed.app.invitation.InvitationDeadlineFormat

/**
 * NATIVE-MOBILE-QRO08 — the Planner Invitations command center's data layer: delivery/open/contact
 * mapping, search and filters, summary counts, the native write twins and their error mapping.
 * Fixture links are synthetic placeholders, never real invitation credentials.
 */
class PlannerInvitationCommandCenterTest {

    private class RecordingTransport(private val reply: WeddingDayHttpResponse) : WeddingDayHttpTransport {
        data class Call(val method: String, val path: String, val headers: Map<String, String>, val body: String?)
        val calls = mutableListOf<Call>()

        override suspend fun get(path: String, headers: Map<String, String>): WeddingDayHttpResponse {
            calls.add(Call("GET", path, headers, null)); return reply
        }
        override suspend fun post(path: String, headers: Map<String, String>, body: String): WeddingDayHttpResponse {
            calls.add(Call("POST", path, headers, body)); return reply
        }
        override suspend fun patch(path: String, headers: Map<String, String>, body: String): WeddingDayHttpResponse {
            calls.add(Call("PATCH", path, headers, body)); return reply
        }
        override suspend fun delete(path: String, headers: Map<String, String>, body: String?): WeddingDayHttpResponse {
            calls.add(Call("DELETE", path, headers, body)); return reply
        }
    }

    private val projection = JSONObject(
        """
        {"success":true,"missingTokens":1,
         "wedding":{"title":"Fixture Wedding","invitationCardStyle":"ivory-floral-gold","invitationCardMessage":null,
                    "rsvpDeadline":"2026-11-01T23:59:59.999Z","childrenPolicy":"adults_only"},
         "data":[
          {"id":"g1","name":"Ada Lovelace","email":"ada@fixture.invalid","phone":"+44 7700 900123","tableNumber":4,
           "status":"attending","checkedIn":false,"qrValue":"https://fixture.invalid/1","shareMessage":"Hi https://fixture.invalid/1",
           "deliveryStatus":"sent","deliveryChannel":"whatsapp","deliveredAt":"2026-09-29T10:00:00.000Z","deliveredBy":"Pat Planner",
           "openedAt":"2026-09-29T11:00:00.000Z"},
          {"id":"g2","name":"Ben Brown","email":null,"phone":null,"tableNumber":null,
           "status":"pending","checkedIn":false,"qrValue":"https://fixture.invalid/2","shareMessage":"Hi https://fixture.invalid/2",
           "deliveryStatus":"not_sent","deliveryChannel":null,"deliveredAt":null,"deliveredBy":null,"openedAt":null},
          {"id":"g3","name":"Cy Chen","email":null,"phone":"0771234567","tableNumber":7,
           "status":"declined","checkedIn":false,"qrValue":"https://fixture.invalid/3","shareMessage":"Hi https://fixture.invalid/3",
           "deliveryStatus":"sent","deliveryChannel":"sms","deliveredAt":"2026-09-28T10:00:00.000Z","deliveredBy":"Sam Couple","openedAt":null},
          {"id":"g4","name":"Di Unlinked","email":"di@fixture.invalid","phone":null,"tableNumber":null,
           "status":"pending","checkedIn":false,"qrValue":null,"shareMessage":null,
           "deliveryStatus":"not_sent","deliveryChannel":null,"deliveredAt":null,"deliveredBy":null,"openedAt":null}
         ]}
        """.trimIndent()
    )

    private val guests = PlannerInvitationsMapping.guests(projection)!!
    private fun byId(id: String) = guests.first { it.id == id }

    @Test fun mapsContactDeliveryAndOpenFieldsFromTheCanonicalProjection() {
        val ada = byId("g1")
        assertEquals("ada@fixture.invalid", ada.email)
        assertEquals("+44 7700 900123", ada.phone)
        assertEquals(PlannerInvitationDeliveryStatus.SENT, ada.deliveryStatus)
        assertEquals(InvitationDeliveryChannel.WHATSAPP, ada.deliveryChannel)
        assertEquals("2026-09-29T10:00:00.000Z", ada.deliveredAt)
        assertEquals("Pat Planner", ada.deliveredBy)
        assertEquals("2026-09-29T11:00:00.000Z", ada.openedAt)
        assertTrue(ada.isSent && ada.isOpened && ada.hasContact)

        val ben = byId("g2")
        assertEquals(PlannerInvitationDeliveryStatus.NOT_SENT, ben.deliveryStatus)
        assertNull(ben.deliveryChannel)
        assertFalse(ben.isOpened)
        assertFalse(ben.hasContact)
        // Redacted diagnostics never carry the private link.
        assertFalse(ada.toString().contains("fixture.invalid"))
        assertFalse(ada.toString().contains("ada@"))
    }

    @Test fun unknownDeliveryWireValuesFailSafeToNotSent() {
        val row = JSONObject(projection.toString())
        row.getJSONArray("data").getJSONObject(0).put("deliveryStatus", "bounced").put("deliveryChannel", "pigeon")
        val ada = PlannerInvitationsMapping.guests(row)!!.first()
        assertEquals(PlannerInvitationDeliveryStatus.NOT_SENT, ada.deliveryStatus)
        assertNull(ada.deliveryChannel)
    }

    @Test fun searchCoversNameEmailPhoneTableAndSender() {
        fun ids(query: String) = PlannerInvitationFilter(query = query).apply(guests).map { it.id }
        assertEquals(listOf("g1"), ids("lovelace"))
        assertEquals(listOf("g4"), ids("di@fixture"))
        assertEquals(listOf("g1"), ids("7700900123"))
        assertEquals(listOf("g3"), ids("077 123"))
        assertEquals(listOf("g3"), ids("table 7"))
        assertEquals(listOf("g3"), ids("sam couple"))
        assertEquals(guests.map { it.id }, ids("  "))
    }

    @Test fun filtersCombineRsvpDeliveryOpenedAndContact() {
        fun ids(filter: PlannerInvitationFilter) = filter.apply(guests).map { it.id }
        assertEquals(listOf("g1"), ids(PlannerInvitationFilter(rsvp = PlannerInvitationRsvpStatus.ATTENDING)))
        assertEquals(listOf("g2", "g4"), ids(PlannerInvitationFilter(rsvp = PlannerInvitationRsvpStatus.PENDING)))
        assertEquals(listOf("g1", "g3"), ids(PlannerInvitationFilter(sent = InvitationSentFilter.SENT)))
        assertEquals(listOf("g2", "g4"), ids(PlannerInvitationFilter(sent = InvitationSentFilter.NOT_SENT)))
        assertEquals(listOf("g1"), ids(PlannerInvitationFilter(opened = InvitationOpenedFilter.OPENED)))
        assertEquals(listOf("g3"), ids(PlannerInvitationFilter(sent = InvitationSentFilter.SENT, opened = InvitationOpenedFilter.NOT_OPENED)))
        assertEquals(listOf("g2"), ids(PlannerInvitationFilter(contact = InvitationContactFilter.MISSING_CONTACT)))
        assertEquals(listOf("g1", "g3", "g4"), ids(PlannerInvitationFilter(contact = InvitationContactFilter.HAS_CONTACT)))
        assertFalse(PlannerInvitationFilter().isActive)
        assertTrue(PlannerInvitationFilter(opened = InvitationOpenedFilter.OPENED).isActive)
    }

    @Test fun summaryCountsComeFromTheServerRows() {
        val summary = PlannerInvitationSummary.of(guests)
        assertEquals(PlannerInvitationSummary(
            total = 4, sent = 2, notSent = 2, opened = 1,
            attending = 1, declined = 1, pending = 2,
            missingContact = 1, missingLinks = 1,
        ), summary)
    }

    @Test fun emptyMessageAndDeadlineAreReadFromTheServer() {
        val design = PlannerInvitationsMapping.design(projection)!!
        assertNull("an empty message means no note", design.message)
        assertEquals("2026-11-01T23:59:59.999Z", design.rsvpDeadline)
        assertEquals("Adults only", design.childrenPolicyLabel)
    }

    @Test fun writesCallTheNativeTwinsWithBearerAndGrantOnly() = runBlocking {
        val transport = RecordingTransport(WeddingDayHttpResponse(200, """{"success":true,"count":2}"""))
        val client = NativeDomainApiClient(transport)
        client.markInvitationsSent("tok", "grant/1", listOf("g1", "g2"), InvitationDeliveryChannel.EMAIL)
        client.resetInvitationDelivery("tok", "grant/1", listOf("g3"))
        client.generateMissingInvitationLinks("tok", "grant/1")
        client.rotateInvitationLink("tok", "grant/1", "g1")
        client.createGuest("tok", "grant/1", "New Guest", " new@fixture.invalid ", "  ")
        client.updateGuest("tok", "grant/1", "g 2", "Ben Brown", null, "0771")
        client.deleteGuest("tok", "grant/1", "g4")

        val summary = transport.calls.map { "${it.method} ${it.path}" }
        assertEquals(listOf(
            "POST api/native/wedding/invitations/delivery?grantId=grant%2F1",
            "DELETE api/native/wedding/invitations/delivery?grantId=grant%2F1",
            "POST api/native/wedding/invitations?grantId=grant%2F1",
            "PATCH api/native/wedding/invitations?grantId=grant%2F1",
            "POST api/native/wedding/guests?grantId=grant%2F1",
            "PATCH api/native/wedding/guests/g+2?grantId=grant%2F1",
            "DELETE api/native/wedding/guests/g4?grantId=grant%2F1",
        ), summary)
        transport.calls.forEach { assertEquals("Bearer tok", it.headers["Authorization"]) }

        val mark = JSONObject(transport.calls[0].body!!)
        assertEquals("email", mark.getString("channel"))
        assertEquals(2, mark.getJSONArray("guestIds").length())
        assertFalse("the wedding comes from the grant, never the body", mark.has("weddingId"))
        assertEquals("g3", JSONObject(transport.calls[1].body!!).getJSONArray("guestIds").getString(0))
        assertEquals("g1", JSONObject(transport.calls[3].body!!).getString("guestId"))
        val created = JSONObject(transport.calls[4].body!!)
        assertEquals("new@fixture.invalid", created.getString("email"))
        assertTrue("blank phone is sent as null", created.isNull("phone"))
        val edited = JSONObject(transport.calls[5].body!!)
        assertTrue("clearing an email sends null", edited.isNull("email"))
        assertNull("guest delete carries no body", transport.calls[6].body)
    }

    @Test fun writeResultsMapServerRefusalsVerbatim() = runBlocking {
        fun client(status: Int, body: String, onInvalid: () -> Unit = {}, onRevoked: (String) -> Unit = {}) =
            NativeDomainApiClient(RecordingTransport(WeddingDayHttpResponse(status, body)), onInvalid, onRevoked)

        val ok = client(200, """{"success":true,"generated":3}""").generateMissingInvitationLinks("t", "g")
        assertEquals(3, (ok as NativeWriteResult.Ok).body.getInt("generated"))

        val duplicate = client(409, """{"success":false,"error":"A guest with this email already exists for this wedding.","field":"email"}""")
            .createGuest("t", "g", "X", "dup@fixture.invalid", null)
        assertEquals(NativeWriteResult.Rejected(409, "A guest with this email already exists for this wedding.", null, "email"), duplicate)
        assertEquals("A guest with this email already exists for this wedding.", duplicate.failureMessage())

        val preview = client(423, """{"success":false,"code":"PREVIEW_WRITE_BLOCKED","error":"Preview is read-only."}""")
            .markInvitationsSent("t", "g", listOf("a"), InvitationDeliveryChannel.OTHER)
        assertEquals("PREVIEW_WRITE_BLOCKED", (preview as NativeWriteResult.Rejected).code)

        var invalidated = false
        assertEquals(NativeWriteResult.SessionInvalid, client(401, "{}", onInvalid = { invalidated = true }).deleteGuest("t", "g", "a"))
        assertTrue(invalidated)

        var revoked: String? = null
        assertEquals(NativeWriteResult.GrantRevoked, client(403, """{"code":"GRANT_REVOKED"}""", onRevoked = { revoked = it }).rotateInvitationLink("t", "grant-9", "a"))
        assertEquals("grant-9", revoked)
        assertEquals(NativeWriteResult.Forbidden, client(403, """{"error":"nope"}""").resetInvitationDelivery("t", "g", listOf("a")))
        assertEquals(NativeWriteResult.Transport(500), client(500, """{"success":false,"error":"boom"}""").deleteGuest("t", "g", "a"))
        assertEquals(NativeWriteResult.Transport(200), client(200, "not json").deleteGuest("t", "g", "a"))
    }

    @Test fun rsvpDeadlineIsFormattedLikeTheWebInUtc() {
        assertEquals("1 November 2026", InvitationDeadlineFormat.label("2026-11-01T23:59:59.999Z"))
        assertEquals("1 November 2026", InvitationDeadlineFormat.label("2026-11-01"))
        assertEquals("30 November 2026", InvitationDeadlineFormat.label("30 November 2026"))
        assertNull(InvitationDeadlineFormat.label(null))
        assertNull(InvitationDeadlineFormat.label("  "))
    }
}
