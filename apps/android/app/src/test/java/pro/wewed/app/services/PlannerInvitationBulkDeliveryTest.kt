package pro.wewed.app.services

import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * QRO08 P2 — bulk Mark sent / Reset over selections larger than the server's 500-Guest limit.
 * Driven through the real [NativeDomainApiClient] over a fake transport, so the request bodies the
 * server would receive are asserted, not assumed.
 */
class PlannerInvitationBulkDeliveryTest {

    /** Records every delivery request; optionally refuses the Nth call (1-based). */
    private class DeliveryTransport(private val failOnCall: Int? = null, private val failStatus: Int = 500) : WeddingDayHttpTransport {
        val bodies = mutableListOf<Pair<String, JSONObject>>()
        private fun respond(method: String, body: String?): WeddingDayHttpResponse {
            val json = JSONObject(body ?: "{}")
            bodies.add(method to json)
            if (bodies.size == failOnCall) {
                return WeddingDayHttpResponse(failStatus, """{"success":false,"error":"Unable to record invitation delivery."}""")
            }
            val n = json.optJSONArray("guestIds")?.length() ?: 0
            // Mirror the server contract: 1..500 Guests per call.
            if (n < 1 || n > INVITATION_DELIVERY_MAX_BATCH) {
                return WeddingDayHttpResponse(400, """{"success":false,"error":"Select between 1 and 500 guests."}""")
            }
            return WeddingDayHttpResponse(200, """{"success":true,"count":$n}""")
        }
        override suspend fun get(path: String, headers: Map<String, String>) = WeddingDayHttpResponse(405, "")
        override suspend fun post(path: String, headers: Map<String, String>, body: String) = respond("POST", body)
        override suspend fun delete(path: String, headers: Map<String, String>, body: String?) = respond("DELETE", body)
    }

    private fun ids(n: Int) = (1..n).map { "g-%04d".format(it) }

    private fun markSent(transport: DeliveryTransport, guestIds: List<String>) = runBlocking {
        val client = NativeDomainApiClient(transport)
        runChunkedDelivery(guestIds) { chunk -> client.markInvitationsSent("t", "grant", chunk, InvitationDeliveryChannel.WHATSAPP) }
    }

    private fun reset(transport: DeliveryTransport, guestIds: List<String>) = runBlocking {
        val client = NativeDomainApiClient(transport)
        runChunkedDelivery(guestIds) { chunk -> client.resetInvitationDelivery("t", "grant", chunk) }
    }

    private fun sentIds(transport: DeliveryTransport) =
        transport.bodies.flatMap { (_, body) -> (0 until body.getJSONArray("guestIds").length()).map { body.getJSONArray("guestIds").getString(it) } }

    @Test fun oneGuestIsOneCall() {
        val transport = DeliveryTransport()
        val outcome = markSent(transport, ids(1))
        assertTrue(outcome.complete)
        assertEquals(1, transport.bodies.size)
        assertEquals("whatsapp", transport.bodies.single().second.getString("channel"))
        assertNull(outcome.partialMessage("Marked sent"))
    }

    @Test fun exactly500IsOneCall() {
        val transport = DeliveryTransport()
        val outcome = markSent(transport, ids(500))
        assertTrue(outcome.complete)
        assertEquals(listOf(500), transport.bodies.map { it.second.getJSONArray("guestIds").length() })
    }

    @Test fun fiveHundredAndOneIsTwoOrderedChunks() {
        val transport = DeliveryTransport()
        val outcome = markSent(transport, ids(501))
        assertTrue(outcome.complete)
        assertEquals(listOf(500, 1), transport.bodies.map { it.second.getJSONArray("guestIds").length() })
        assertEquals(ids(501), sentIds(transport))
    }

    @Test fun moreThanAThousandIsFullyCoveredWithNoGuestSkippedOrRepeated() {
        val transport = DeliveryTransport()
        val outcome = markSent(transport, ids(1_234))
        assertTrue(outcome.complete)
        assertEquals(1_234, outcome.succeeded)
        assertEquals(listOf(500, 500, 234), transport.bodies.map { it.second.getJSONArray("guestIds").length() })
        assertEquals(ids(1_234), sentIds(transport))
        assertTrue(transport.bodies.all { it.first == "POST" && it.second.getString("channel") == "whatsapp" })
    }

    @Test fun resetDeliveryChunksTheSameWayWithDelete() {
        val transport = DeliveryTransport()
        val outcome = reset(transport, ids(1_001))
        assertTrue(outcome.complete)
        assertEquals(listOf(500, 500, 1), transport.bodies.map { it.second.getJSONArray("guestIds").length() })
        assertTrue(transport.bodies.all { it.first == "DELETE" && !it.second.has("channel") })
    }

    @Test fun aFailureInALaterChunkIsReportedAsPartialAndStopsTheRun() {
        val transport = DeliveryTransport(failOnCall = 3)
        val outcome = markSent(transport, ids(1_600))
        assertFalse(outcome.complete)
        assertEquals(1_000, outcome.succeeded)
        assertEquals(600, outcome.remaining)
        assertEquals(3, transport.bodies.size) // chunk 4 is never sent after chunk 3 fails
        val message = outcome.partialMessage("Marked sent via WhatsApp")!!
        assertTrue(message, message.startsWith("Marked sent via WhatsApp for 1000 of 1600 guests."))
        assertTrue(message.contains("The remaining 600 were not changed."))
    }

    @Test fun aFirstChunkFailureChangesNothingAndSaysSo() {
        val transport = DeliveryTransport(failOnCall = 1, failStatus = 423)
        val outcome = reset(transport, ids(700))
        assertEquals(0, outcome.succeeded)
        assertTrue(outcome.partialMessage("Reset delivery")!!.startsWith("No guests were changed."))
    }

    @Test fun duplicateSelectionsAreSentOnce() {
        val transport = DeliveryTransport()
        val outcome = markSent(transport, ids(3) + ids(3))
        assertEquals(3, outcome.requested)
        assertEquals(ids(3), sentIds(transport))
    }

    @Test fun selectAllFilteredOverALargeListIsNotCapped() {
        val guests = (1..1_200).map {
            PlannerGuestInvitation(
                id = "g-$it", name = "Guest $it", status = PlannerInvitationRsvpStatus.PENDING, tableNumber = null,
                checkedIn = false, qrValue = "https://fixture.invalid/$it", shareMessage = "Hi",
                deliveryStatus = if (it % 2 == 0) PlannerInvitationDeliveryStatus.SENT else PlannerInvitationDeliveryStatus.NOT_SENT,
            )
        }
        val notSent = PlannerInvitationFilter(sent = InvitationSentFilter.NOT_SENT).apply(guests)
        assertEquals(600, notSent.size)
        // "Select all shown" hands every filtered Guest to the bulk run, which then chunks 500 + 100.
        val transport = DeliveryTransport()
        val outcome = markSent(transport, notSent.map { it.id })
        assertTrue(outcome.complete)
        assertEquals(listOf(500, 100), transport.bodies.map { it.second.getJSONArray("guestIds").length() })
    }

    @Test fun clientServerLimitsAgree() {
        val server = java.io.File(
            listOf("../../src/lib", "../../../src/lib").map { java.io.File(it) }.first { it.exists() },
            "planner-invitation-operations.ts"
        ).readText()
        assertTrue(server.contains("export const INVITATION_DELIVERY_MAX_BATCH = $INVITATION_DELIVERY_MAX_BATCH"))
    }
}
