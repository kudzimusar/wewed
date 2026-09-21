package pro.wewed.app.navigation

import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import pro.wewed.app.invitation.GuestSessionClient
import pro.wewed.app.invitation.GuestSessionException
import pro.wewed.app.invitation.RsvpSaveResult
import pro.wewed.app.services.InMemorySecureStorage
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.ServerSocket
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread

/**
 * The native client of the guest-session authority, held to the protocol's security rules.
 *
 * These are behavioural, not cosmetic. Each one corresponds to a way the invitation protocol can
 * be quietly broken while still appearing to work:
 *
 *  - storing the raw RSVP credential turns a door key into a permanent identity;
 *  - clearing the session before validating a new link lets an invalid Guest B link log Guest A out;
 *  - sending Guest A's session on an exchange invites the server to keep Guest A;
 *  - ignoring `STALE_GUEST_CONTEXT` writes Guest A's answer onto Guest B.
 */
class GuestSessionClientTest {

    /**
     * A minimal HTTP stub.
     *
     * Deliberately a raw socket rather than a library: the point of these tests is the exact bytes
     * on the wire — which header carries the session, whether a body was sent at all — and a stub
     * that hides those is a stub that cannot prove them.
     */
    private lateinit var server: ServerSocket
    private lateinit var storage: InMemorySecureStorage
    private lateinit var client: GuestSessionClient

    private class Reply(
        val status: Int,
        val body: String = "",
        val session: String? = null,
        val location: String? = null
    )

    private val routes = mutableMapOf<String, Reply>()
    private val seenCookies = CopyOnWriteArrayList<String>()
    private val seenBodies = CopyOnWriteArrayList<String>()
    /** "(none)" marks a request that presented no session, so absence is assertable. */
    private val noCookie = "(none)"

    private val guestASession = "GUEST-A-SESSION-TOKEN"
    private val guestBSession = "GUEST-B-SESSION-TOKEN"
    private val rawToken = "RAW-PRIVATE-RSVP-CREDENTIAL"

    @Before
    fun start() {
        server = ServerSocket(0)
        storage = InMemorySecureStorage()
        client = GuestSessionClient("http://127.0.0.1:${server.localPort}", storage)
        thread(isDaemon = true) {
            while (!server.isClosed) {
                val socket = runCatching { server.accept() }.getOrNull() ?: break
                runCatching {
                    socket.use {
                        val reader = BufferedReader(InputStreamReader(it.getInputStream()))
                        val requestLine = reader.readLine() ?: return@use
                        val parts = requestLine.split(" ")
                        val method = parts.getOrElse(0) { "" }
                        val path = parts.getOrElse(1) { "" }.substringBefore('?')

                        var cookie: String? = null
                        var length = 0
                        while (true) {
                            val header = reader.readLine() ?: break
                            if (header.isEmpty()) break
                            val name = header.substringBefore(':').trim().lowercase()
                            val value = header.substringAfter(':').trim()
                            if (name == "cookie") cookie = value
                            if (name == "content-length") length = value.toIntOrNull() ?: 0
                        }
                        seenCookies.add(cookie ?: noCookie)
                        val body = if (length > 0) {
                            val buffer = CharArray(length)
                            reader.read(buffer, 0, length)
                            String(buffer)
                        } else ""
                        seenBodies.add(body)

                        val reply = routes["$method $path"] ?: Reply(404)
                        val payload = reply.body.toByteArray(Charsets.UTF_8)
                        val headers = StringBuilder("HTTP/1.1 ${reply.status} X\r\n")
                        headers.append("Content-Type: application/json\r\n")
                        headers.append("Content-Length: ${payload.size}\r\n")
                        reply.session?.let { value ->
                            headers.append(
                                "Set-Cookie: ${GuestSessionClient.SESSION_COOKIE}=$value; " +
                                    "Path=/; HttpOnly; SameSite=Lax\r\n"
                            )
                        }
                        reply.location?.let { value -> headers.append("Location: $value\r\n") }
                        headers.append("Connection: close\r\n\r\n")
                        it.getOutputStream().apply {
                            write(headers.toString().toByteArray(Charsets.UTF_8))
                            write(payload)
                            flush()
                        }
                    }
                }
            }
        }
    }

    @After
    fun stop() {
        server.close()
    }

    private fun exchangeSucceeds(slug: String, guestId: String, name: String, session: String) {
        routes["POST /api/weddings/$slug/guest-session"] = Reply(
            200,
            """{"success":true,"authorized":true,"wedding":{"slug":"$slug"},""" +
                """"guest":{"id":"$guestId","name":"$name"}}""",
            session = session
        )
    }

    private fun invitationReads(slug: String, guestId: String, name: String, attending: Any?) {
        routes["GET /api/weddings/$slug/guest-session"] = Reply(
            200,
            """{"success":true,"authorized":true,""" +
                """"wedding":{"slug":"$slug","title":"Charity & Kudzie","monogram":"C&K",""" +
                """"tagline":"23.12.26","date":"2026-12-23T14:00:00","venue":"Imba Manor",""" +
                """"venueCity":"Harare","venueCountry":"Zimbabwe",""" +
                """"invitationCardStyle":"ivory-floral-gold","invitationCardMessage":null,""" +
                """"rsvpDeadline":null,"childrenPolicy":"welcome"},""" +
                """"guest":{"id":"$guestId","name":"$name"},""" +
                """"rsvp":{"attending":$attending,"checkedIn":false}}"""
        )
    }

    @Test fun refreshedCredentialsPersistAndRevocationClearsStorage() = runBlocking {
        exchangeSucceeds("synthetic", "a", "Synthetic", "v1-session")
        client.exchangePrivateInvitation("synthetic", "private-fixture")
        invitationReads("synthetic", "a", "Synthetic", null)
        val get = "GET /api/weddings/synthetic/guest-session"
        routes[get] = Reply(200, routes[get]!!.body, session = "v2-session")
        client.loadInvitation()
        assertEquals("v2-session", storage.get("wewed.guest.session"))
        routes["PUT /api/weddings/synthetic/guest-session"] = Reply(200, """{"success":true,"rsvp":{"attending":true}}""", session = "v2-refreshed")
        client.saveRsvp("synthetic", "a", true)
        assertEquals("v2-refreshed", storage.get("wewed.guest.session"))
        routes[get] = Reply(401)
        try { client.loadInvitation(); fail("revoked session accepted") } catch (_: GuestSessionException) { }
        assertFalse(client.hasActiveSession())
        assertNull(client.activeSessionSlug())
    }

    // --- The credential rules -------------------------------------------------------------

    /** The raw credential opens the door once. It must never become stored identity. */
    @Test
    fun rawInvitationCredentialIsNeverPersisted() = runBlocking {
        exchangeSucceeds("charity-and-kudzie", "guest_a", "Guest A", guestASession)
        client.exchangePrivateInvitation("charity-and-kudzie", rawToken)

        val stored = storage.let { s ->
            listOf("wewed.guest.session", "wewed.guest.session.slug").mapNotNull { s.get(it) }
        }
        assertTrue("a session must be stored", stored.isNotEmpty())
        stored.forEach {
            assertNotEquals("the raw RSVP credential must not be stored", rawToken, it)
            assertFalse("the raw RSVP credential must not appear in stored values", it.contains(rawToken))
        }
    }

    /** Only what the server issued is kept, and it is what later calls present. */
    @Test
    fun theServerIssuedSessionIsWhatSubsequentCallsPresent() = runBlocking {
        exchangeSucceeds("charity-and-kudzie", "guest_a", "Guest A", guestASession)
        invitationReads("charity-and-kudzie", "guest_a", "Guest A", null)

        client.exchangePrivateInvitation("charity-and-kudzie", rawToken)
        seenCookies.clear()
        client.loadInvitation("charity-and-kudzie")

        assertEquals(
            listOf("${GuestSessionClient.SESSION_COOKIE}=$guestASession"),
            seenCookies.toList()
        )
    }

    /**
     * The exchange is how a *different* guest takes over. Presenting the current session invites
     * the server to keep the current guest, which is how Guest B silently became Guest A.
     */
    @Test
    fun theExchangeDoesNotPresentTheExistingSession() = runBlocking {
        exchangeSucceeds("charity-and-kudzie", "guest_a", "Guest A", guestASession)
        client.exchangePrivateInvitation("charity-and-kudzie", rawToken)

        seenCookies.clear()
        exchangeSucceeds("charity-and-kudzie", "guest_b", "Guest B", guestBSession)
        client.exchangePrivateInvitation("charity-and-kudzie", rawToken)

        assertEquals("the exchange must be unauthenticated", listOf(noCookie), seenCookies)
    }

    // --- Atomic replacement ---------------------------------------------------------------

    /** Guest B replaces Guest A only after the server has accepted Guest B. */
    @Test
    fun aValidSecondInvitationReplacesTheFirst() = runBlocking {
        exchangeSucceeds("charity-and-kudzie", "guest_a", "Guest A", guestASession)
        val first = client.exchangePrivateInvitation("charity-and-kudzie", rawToken)
        assertEquals("guest_a", first.guestId)

        exchangeSucceeds("charity-and-kudzie", "guest_b", "Guest B", guestBSession)
        val second = client.exchangePrivateInvitation("charity-and-kudzie", rawToken)
        assertEquals("guest_b", second.guestId)

        invitationReads("charity-and-kudzie", "guest_b", "Guest B", null)
        seenCookies.clear()
        client.loadInvitation("charity-and-kudzie")
        assertEquals(
            listOf("${GuestSessionClient.SESSION_COOKIE}=$guestBSession"),
            seenCookies.toList()
        )
    }

    /**
     * The failure this protects against: an invalid or expired second link must not log the
     * current guest out. Only a redeemed credential may replace an active one.
     */
    @Test
    fun anInvalidSecondInvitationLeavesTheActiveGuestUntouched() = runBlocking {
        exchangeSucceeds("charity-and-kudzie", "guest_a", "Guest A", guestASession)
        client.exchangePrivateInvitation("charity-and-kudzie", rawToken)

        routes["POST /api/weddings/charity-and-kudzie/guest-session"] = Reply(401, """{"success":false,"error":"This invitation is invalid."}""")
        val failure = runCatching {
            client.exchangePrivateInvitation("charity-and-kudzie", "EXPIRED")
        }.exceptionOrNull()
        assertTrue(failure is GuestSessionException)

        invitationReads("charity-and-kudzie", "guest_a", "Guest A", null)
        seenCookies.clear()
        val snapshot = client.loadInvitation("charity-and-kudzie")
        assertEquals("guest_a", snapshot.guestId)
        assertEquals(
            listOf("${GuestSessionClient.SESSION_COOKIE}=$guestASession"),
            seenCookies.toList()
        )
    }

    /** A rejected handoff behaves the same way: redirect without a session, active guest kept. */
    @Test
    fun aRejectedHandoffLeavesTheActiveGuestUntouched() = runBlocking {
        exchangeSucceeds("charity-and-kudzie", "guest_a", "Guest A", guestASession)
        client.exchangePrivateInvitation("charity-and-kudzie", rawToken)

        routes["GET /invite/resume"] =
            Reply(303, location = "/guest-access-help?reason=invitation-resume")
        val failure = runCatching { client.redeemHandoff("B".repeat(43)) }.exceptionOrNull()
        assertTrue(failure is GuestSessionException)
        assertTrue("the active session must survive", client.hasActiveSession())
        assertEquals("charity-and-kudzie", client.activeSessionSlug())

        // And it is still Guest A's session, not a half-written one.
        invitationReads("charity-and-kudzie", "guest_a", "Guest A", null)
        seenCookies.clear()
        assertEquals("guest_a", client.loadInvitation("charity-and-kudzie").guestId)
        assertEquals(
            listOf("${GuestSessionClient.SESSION_COOKIE}=$guestASession"),
            seenCookies.toList()
        )
    }

    /** A handoff that is not the server's shape never reaches the network at all. */
    @Test
    fun aMalformedHandoffIsRefusedLocally() = runBlocking {
        val before = seenBodies.size
        val failure = runCatching { client.redeemHandoff("too-short") }.exceptionOrNull()
        assertTrue(failure is GuestSessionException)
        assertEquals("no request should have been made", before, seenBodies.size)
    }

    /**
     * A deferred install: no previous session, no stored wedding, nothing but the handoff.
     *
     * This is the case the whole handoff path exists for, and it used to fail. The client asked
     * storage which wedding it was, which on a fresh install answers nothing. An earlier version
     * of this test pre-seeded the slug immediately before redeeming, which made the bug invisible.
     * Nothing is seeded here.
     */
    @Test
    fun aFreshInstallRedeemsAHandoffWithNothingStored() = runBlocking {
        assertNull("the test must start with empty storage", storage.get("wewed.guest.session"))
        assertNull(storage.get("wewed.guest.session.slug"))

        routes["GET /invite/resume"] = Reply(
            303,
            session = guestBSession,
            location = "/w/charity-and-kudzie?invitation=1&card=ivory-floral-gold&source=android-app"
        )
        invitationReads("charity-and-kudzie", "guest_b", "Guest B", null)

        val identity = client.redeemHandoff("B".repeat(43))
        assertEquals("guest_b", identity.guestId)
        assertEquals("Guest B", identity.guestName)
        // The wedding came from the redirect, which is the only place it could have come from.
        assertEquals("charity-and-kudzie", identity.weddingSlug)
        assertEquals("charity-and-kudzie", client.activeSessionSlug())
    }

    /** A valid second handoff replaces the guest who was already here. */
    @Test
    fun aValidHandoffReplacesTheActiveGuest() = runBlocking {
        exchangeSucceeds("charity-and-kudzie", "guest_a", "Guest A", guestASession)
        client.exchangePrivateInvitation("charity-and-kudzie", rawToken)

        routes["GET /invite/resume"] =
            Reply(303, session = guestBSession, location = "/w/charity-and-kudzie?invitation=1")
        invitationReads("charity-and-kudzie", "guest_b", "Guest B", null)

        assertEquals("guest_b", client.redeemHandoff("B".repeat(43)).guestId)
        seenCookies.clear()
        client.loadInvitation("charity-and-kudzie")
        assertEquals(
            listOf("${GuestSessionClient.SESSION_COOKIE}=$guestBSession"),
            seenCookies.toList()
        )
    }

    /**
     * A redirect that does not name a wedding is not a successful redemption.
     *
     * The recovery page is exactly this shape, and treating it as success would establish a
     * session pointing at nothing.
     */
    @Test
    fun aResumeWithoutAWeddingDestinationIsRefused() = runBlocking {
        routes["GET /invite/resume"] = Reply(
            303,
            session = guestBSession,
            location = "/guest-access-help?reason=invitation-resume"
        )
        val failure = runCatching { client.redeemHandoff("B".repeat(43)) }.exceptionOrNull()
        assertTrue(failure is GuestSessionException)
        assertFalse("nothing may be persisted", client.hasActiveSession())
    }

    /** A redirect pointing off-origin is a claim, not an instruction. */
    @Test
    fun aResumeRedirectingOffOriginIsRefused() = runBlocking {
        routes["GET /invite/resume"] =
            Reply(303, session = guestBSession, location = "https://evil.example/w/charity-and-kudzie")
        val failure = runCatching { client.redeemHandoff("B".repeat(43)) }.exceptionOrNull()
        assertTrue(failure is GuestSessionException)
        assertFalse(client.hasActiveSession())
    }

    // --- RSVP ------------------------------------------------------------------------------

    /** Accept and decline are both real answers that reach the server. */
    @Test
    fun bothAcceptAndDeclineAreSaved() = runBlocking {
        exchangeSucceeds("charity-and-kudzie", "guest_a", "Guest A", guestASession)
        client.exchangePrivateInvitation("charity-and-kudzie", rawToken)

        routes["PUT /api/weddings/charity-and-kudzie/guest-session"] = Reply(200, """{"success":true,"rsvp":{"attending":true}}""")
        assertEquals(
            RsvpSaveResult.Saved(true),
            client.saveRsvp("charity-and-kudzie", "guest_a", attending = true)
        )
        assertTrue(seenBodies.last().contains("\"attending\":true"))
        assertTrue(seenBodies.last().contains("\"originGuestId\":\"guest_a\""))

        routes["PUT /api/weddings/charity-and-kudzie/guest-session"] = Reply(200, """{"success":true,"rsvp":{"attending":false}}""")
        assertEquals(
            RsvpSaveResult.Saved(false),
            client.saveRsvp("charity-and-kudzie", "guest_a", attending = false)
        )
        assertTrue(seenBodies.last().contains("\"attending\":false"))
    }

    /** A stale binding is surfaced, not swallowed: the answer belonged to a different card. */
    @Test
    fun aStaleGuestBindingIsSurfaced() = runBlocking {
        exchangeSucceeds("charity-and-kudzie", "guest_b", "Guest B", guestBSession)
        client.exchangePrivateInvitation("charity-and-kudzie", rawToken)

        routes["PUT /api/weddings/charity-and-kudzie/guest-session"] =
            Reply(409, """{"success":false,"code":"STALE_GUEST_CONTEXT","error":"changed"}""")
        assertEquals(
            RsvpSaveResult.StaleGuestContext,
            client.saveRsvp("charity-and-kudzie", "guest_a", attending = true)
        )
    }

    @Test
    fun anAdultsOnlyRefusalIsSurfaced() = runBlocking {
        exchangeSucceeds("charity-and-kudzie", "guest_a", "Guest A", guestASession)
        client.exchangePrivateInvitation("charity-and-kudzie", rawToken)
        routes["PUT /api/weddings/charity-and-kudzie/guest-session"] = Reply(400, """{"success":false,"code":"CHILDREN_NOT_ALLOWED"}""")
        assertEquals(
            RsvpSaveResult.ChildrenNotAllowed,
            client.saveRsvp("charity-and-kudzie", "guest_a", attending = true)
        )
    }

    // --- The card's content comes from the server -------------------------------------------

    /** The invitation is populated from the wedding's own authority, not from a fixture. */
    @Test
    fun theInvitationIsPopulatedFromTheServer() = runBlocking {
        exchangeSucceeds("charity-and-kudzie", "guest_a", "Gladmore Musarurwa", guestASession)
        invitationReads("charity-and-kudzie", "guest_a", "Gladmore Musarurwa", true)
        client.exchangePrivateInvitation("charity-and-kudzie", rawToken)

        val snapshot = client.loadInvitation("charity-and-kudzie")
        assertEquals("Charity & Kudzie", snapshot.title)
        assertEquals("Gladmore Musarurwa", snapshot.guestName)
        assertEquals("C&K", snapshot.monogram)
        assertEquals("23.12.26", snapshot.tagline)
        assertEquals("Imba Manor", snapshot.venue)
        assertEquals("ivory-floral-gold", snapshot.invitationCardStyle)
        assertEquals(true, snapshot.attending)
        // A JSON null must read as "not answered", never as the string "null".
        assertNull(snapshot.invitationCardMessage)
        assertNull(snapshot.rsvpDeadline)
    }
}
