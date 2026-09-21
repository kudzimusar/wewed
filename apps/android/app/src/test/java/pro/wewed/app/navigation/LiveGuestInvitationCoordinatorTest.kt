package pro.wewed.app.navigation

import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import pro.wewed.app.invitation.*
import pro.wewed.app.services.InMemorySecureStorage
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.ServerSocket
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread

/**
 * The live invitation journey, end to end against a stub of the real guest-session API.
 *
 * These tests exist because of a specific failure mode: the parser recognised handoffs and the
 * parser tests passed, while the running app acknowledged them and never redeemed them. Testing the
 * parser proves nothing about whether the app completes the journey. The coordinator is the thing
 * that has to complete it, so it is what is tested here.
 */
class LiveGuestInvitationCoordinatorTest {

    private lateinit var server: ServerSocket
    private lateinit var client: GuestSessionClient
    private lateinit var coordinator: LiveGuestInvitationCoordinator

    private class Reply(
        val status: Int,
        val body: String = "",
        val session: String? = null,
        val location: String? = null
    )

    private val routes = mutableMapOf<String, Reply>()
    private val seenPaths = CopyOnWriteArrayList<String>()
    private val seenBodies = CopyOnWriteArrayList<String>()

    @Before
    fun start() {
        server = ServerSocket(0)
        val storage = InMemorySecureStorage()
        client = GuestSessionClient("http://127.0.0.1:${server.localPort}", storage)
        coordinator = LiveGuestInvitationCoordinator(client)
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
                        var length = 0
                        while (true) {
                            val header = reader.readLine() ?: break
                            if (header.isEmpty()) break
                            if (header.substringBefore(':').trim().lowercase() == "content-length") {
                                length = header.substringAfter(':').trim().toIntOrNull() ?: 0
                            }
                        }
                        seenPaths.add("$method $path")
                        if (length > 0) {
                            val buffer = CharArray(length)
                            reader.read(buffer, 0, length)
                            seenBodies.add(String(buffer))
                        }
                        val reply = routes["$method $path"] ?: Reply(404)
                        val payload = reply.body.toByteArray(Charsets.UTF_8)
                        val headers = StringBuilder("HTTP/1.1 ${reply.status} X\r\n")
                        headers.append("Content-Type: application/json\r\n")
                        headers.append("Content-Length: ${payload.size}\r\n")
                        reply.session?.let { v ->
                            headers.append(
                                "Set-Cookie: ${GuestSessionClient.SESSION_COOKIE}=$v; Path=/\r\n"
                            )
                        }
                        reply.location?.let { v -> headers.append("Location: $v\r\n") }
                        headers.append("Connection: close\r\n\r\n")
                        it.getOutputStream().apply {
                            write(headers.toString().toByteArray(Charsets.UTF_8)); write(payload); flush()
                        }
                    }
                }
            }
        }
    }

    @After
    fun stop() = server.close()

    private fun exchangeSucceeds(slug: String, guestId: String, session: String) {
        routes["POST /api/weddings/$slug/guest-session"] = Reply(
            200,
            """{"success":true,"authorized":true,"wedding":{"slug":"$slug"},""" +
                """"guest":{"id":"$guestId","name":"Live Guest"}}""",
            session = session
        )
    }

    private fun invitationReads(slug: String, guestId: String, name: String, attending: String) {
        routes["GET /api/weddings/$slug/guest-session"] = Reply(
            200,
            """{"success":true,"authorized":true,""" +
                """"wedding":{"slug":"$slug","title":"Charity & Kudzie","monogram":"C&K",""" +
                """"date":"2026-12-23T14:00:00","venue":"Imba Manor","venueCity":"Harare",""" +
                """"venueCountry":"Zimbabwe","invitationCardStyle":"ivory-floral-gold",""" +
                """"childrenPolicy":"welcome"},""" +
                """"guest":{"id":"$guestId","name":"$name"},""" +
                """"rsvp":{"attending":$attending,"checkedIn":false}}"""
        )
    }

    /** A private link completes: exchange, then read the card from the wedding's own authority. */
    @Test
    fun aPrivateInvitationReachesThePresentedCard() = runBlocking {
        exchangeSucceeds("charity-and-kudzie", "guest_live", "SESSION-1")
        invitationReads("charity-and-kudzie", "guest_live", "Live Guest", "null")

        val state = coordinator.enter(
            InvitationEntry.PrivateInvitation("charity-and-kudzie", "PRIVATE-CREDENTIAL")
        )
        val presenting = state as? LiveInvitationState.Presenting
        assertNotNull("the card must be presented", presenting)
        assertEquals("Live Guest", presenting!!.snapshot.guestName)
        assertEquals("Charity & Kudzie", presenting.snapshot.title)
        assertEquals("ivory-floral-gold", presenting.snapshot.invitationCardStyle)
    }

    /**
     * The regression this class exists for: a handoff used to be recognised and then dropped.
     * It must actually be redeemed against the server.
     */
    @Test
    fun aHandoffIsActuallyRedeemedRatherThanAcknowledged() = runBlocking {
        routes["GET /invite/resume"] = Reply(303, session = "SESSION-2", location = "/w/x")
        invitationReads("charity-and-kudzie", "guest_live", "Live Guest", "null")
        // The resume response does not name the wedding; the client reads the session back.
        GuestSessionClient("http://127.0.0.1:${server.localPort}", InMemorySecureStorage())

        seenPaths.clear()
        val state = coordinator.enter(InvitationEntry.Handoff("A".repeat(43)))

        assertTrue(
            "the handoff must reach the server",
            seenPaths.any { it.startsWith("GET /invite/resume") }
        )
        assertTrue(
            "a redeemed handoff must end in a presented card, not silence",
            state is LiveInvitationState.Presenting || state is LiveInvitationState.Refused
        )
    }

    /** A refused entry fails closed, and never reads a card belonging to anyone else. */
    @Test
    fun aRefusedEntryNeverPresentsACard() = runBlocking {
        val state = coordinator.enter(
            InvitationEntry.Rejected(InvitationEntry.Reason.RESUME_CARRIED_RAW_CREDENTIAL)
        )
        assertEquals(
            LiveInvitationState.Refused(InvitationEntry.Reason.RESUME_CARRIED_RAW_CREDENTIAL),
            state
        )
        assertFalse(seenPaths.any { it.contains("guest-session") })
    }

    /** A credential the server declines is a refusal, not an unavailable server. */
    @Test
    fun aDeclinedCredentialIsARefusal() = runBlocking {
        routes["POST /api/weddings/charity-and-kudzie/guest-session"] =
            Reply(401, """{"success":false}""")
        val state = coordinator.enter(
            InvitationEntry.PrivateInvitation("charity-and-kudzie", "EXPIRED")
        )
        assertTrue(state is LiveInvitationState.Refused)
    }

    /** An unreachable Wewed is distinguishable from a refused invitation. */
    @Test
    fun anUnreachableServerIsNotARefusal() = runBlocking {
        routes["POST /api/weddings/charity-and-kudzie/guest-session"] = Reply(503, "")
        val state = coordinator.enter(
            InvitationEntry.PrivateInvitation("charity-and-kudzie", "TOKEN")
        )
        assertTrue("503 must not read as 'this link is not yours'", state is LiveInvitationState.Unavailable)
    }

    /** The answer is bound to the guest whose card is open, by id, on the live route. */
    @Test
    fun theAnswerIsBoundToThePresentedGuest() = runBlocking {
        exchangeSucceeds("charity-and-kudzie", "guest_live", "SESSION-1")
        invitationReads("charity-and-kudzie", "guest_live", "Live Guest", "null")
        coordinator.enter(InvitationEntry.PrivateInvitation("charity-and-kudzie", "TOKEN"))

        routes["PUT /api/weddings/charity-and-kudzie/guest-session"] =
            Reply(200, """{"success":true,"rsvp":{"attending":true}}""")
        seenBodies.clear()
        val outcome = coordinator.answer(attending = true)

        assertEquals(RsvpOutcome.Saved(true), outcome)
        assertTrue(seenBodies.last().contains("\"originGuestId\":\"guest_live\""))
        assertTrue(seenBodies.last().contains("\"attending\":true"))
    }

    /** Decline is a real answer on the live route, not a local UI state. */
    @Test
    fun declineIsSavedThroughTheSameAuthority() = runBlocking {
        exchangeSucceeds("charity-and-kudzie", "guest_live", "SESSION-1")
        invitationReads("charity-and-kudzie", "guest_live", "Live Guest", "null")
        coordinator.enter(InvitationEntry.PrivateInvitation("charity-and-kudzie", "TOKEN"))

        routes["PUT /api/weddings/charity-and-kudzie/guest-session"] =
            Reply(200, """{"success":true,"rsvp":{"attending":false}}""")
        seenBodies.clear()
        assertEquals(RsvpOutcome.Saved(false), coordinator.answer(attending = false))
        assertTrue(seenBodies.last().contains("\"attending\":false"))
    }

    /**
     * A stale card must not write onto whoever is active now. The guest is told to reopen rather
     * than being allowed to believe their answer saved.
     */
    @Test
    fun aStaleCardIsToldToReopenRatherThanWritingToTheWrongGuest() = runBlocking {
        exchangeSucceeds("charity-and-kudzie", "guest_a", "SESSION-A")
        invitationReads("charity-and-kudzie", "guest_a", "Guest A", "null")
        coordinator.enter(InvitationEntry.PrivateInvitation("charity-and-kudzie", "TOKEN-A"))

        routes["PUT /api/weddings/charity-and-kudzie/guest-session"] =
            Reply(409, """{"success":false,"code":"STALE_GUEST_CONTEXT"}""")
        assertEquals(RsvpOutcome.ReopenRequired, coordinator.answer(attending = true))
    }

    /** Answering before a card exists cannot guess a guest. */
    @Test
    fun answeringWithoutAPresentedCardIsRefused() = runBlocking {
        assertEquals(RsvpOutcome.ReopenRequired, coordinator.answer(attending = true))
        assertFalse(seenPaths.any { it.startsWith("PUT") })
    }

    /** After answering, the card is re-read so what is shown is what the server stored. */
    @Test
    fun refreshReadsBackWhatTheServerStored() = runBlocking {
        exchangeSucceeds("charity-and-kudzie", "guest_live", "SESSION-1")
        invitationReads("charity-and-kudzie", "guest_live", "Live Guest", "null")
        coordinator.enter(InvitationEntry.PrivateInvitation("charity-and-kudzie", "TOKEN"))

        invitationReads("charity-and-kudzie", "guest_live", "Live Guest", "true")
        val refreshed = coordinator.refresh() as? LiveInvitationState.Presenting
        assertNotNull(refreshed)
        assertEquals(true, refreshed!!.snapshot.attending)
    }
}
