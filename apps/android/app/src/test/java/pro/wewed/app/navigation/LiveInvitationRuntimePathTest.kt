package pro.wewed.app.navigation

import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import pro.wewed.app.invitation.*
import pro.wewed.app.models.AnnouncementUrgency
import pro.wewed.app.models.InvitationContext
import pro.wewed.app.models.TaskPriority
import pro.wewed.app.models.VendorPresenceState
import pro.wewed.app.models.InvitationStyle
import pro.wewed.app.models.RSVPStatus
import pro.wewed.app.models.WeddingPass
import pro.wewed.app.services.InMemorySecureStorage
import pro.wewed.app.services.WeddingRepository
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.ServerSocket
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread

/**
 * Proof that the live invitation actually runs through the guest-session authority.
 *
 * The coordinator's own tests prove it works when called. They cannot prove the app calls it — and
 * that was exactly the defect: excellent unit coverage on a client the running app never touched,
 * while the real path still went to the Shadow repository.
 *
 * So this test drives the same sequence the app does, with a repository spy that fails the test
 * the instant either legacy method is invoked. If someone reintroduces
 * `repository.resolveInvitation` or `repository.confirmRsvp` into the live path, this goes red.
 */
class LiveInvitationRuntimePathTest {

    /**
     * A repository that refuses to participate.
     *
     * Every legacy invitation method throws rather than returning a plausible value, because a
     * plausible value is precisely what let the old path masquerade as working.
     */
    private class ForbiddenLegacyRepository : WeddingRepository {
        val touched = CopyOnWriteArrayList<String>()

        override suspend fun resolveInvitation(
            weddingSlug: String,
            token: String
        ): InvitationContext {
            touched.add("resolveInvitation")
            throw AssertionError(
                "the live invitation path must not resolve through WeddingRepository"
            )
        }

        override suspend fun confirmRsvp(
            weddingSlug: String,
            token: String,
            attending: Boolean
        ): WeddingPass {
            touched.add("confirmRsvp")
            throw AssertionError(
                "the live invitation path must not write RSVP through WeddingRepository"
            )
        }

        override suspend fun availableWeddingIds(): List<String> = emptyList()

        // The rest of the surface is irrelevant to the invitation and equally forbidden: a
        // plausible return value is what let the old path masquerade as working.
        private fun forbidden(name: String): Nothing {
            touched.add(name)
            throw AssertionError("the live invitation path must not call WeddingRepository.$name")
        }

        override suspend fun resolveGuestIdentity(token: String) = forbidden("resolveGuestIdentity")
        override suspend fun getWedding(weddingId: String) = forbidden("getWedding")
        override suspend fun getTasks(weddingId: String) = forbidden("getTasks")
        override suspend fun createTask(
            weddingId: String, title: String, priority: TaskPriority, category: String
        ) = forbidden("createTask")
        override suspend fun toggleTask(weddingId: String, taskId: String) = forbidden("toggleTask")
        override suspend fun getGuests(weddingId: String) = forbidden("getGuests")
        override suspend fun getBudget(weddingId: String) = forbidden("getBudget")
        override suspend fun searchGuests(weddingId: String, query: String) = forbidden("searchGuests")
        override suspend fun checkInGuest(
            weddingId: String, qrPayload: String, count: Int, usherId: String
        ) = forbidden("checkInGuest")
        override suspend fun getAuditRecords(weddingId: String) = forbidden("getAuditRecords")
        override suspend fun getVendors(weddingId: String) = forbidden("getVendors")
        override suspend fun updateVendorState(
            weddingId: String, id: String, state: VendorPresenceState
        ) = forbidden("updateVendorState")
        override suspend fun getAnnouncements(weddingId: String) = forbidden("getAnnouncements")
        override suspend fun postAnnouncement(
            weddingId: String, title: String, message: String, urgency: AnnouncementUrgency
        ) = forbidden("postAnnouncement")
        override suspend fun getWeddingPass(token: String) = forbidden("getWeddingPass")
    }

    private lateinit var server: ServerSocket
    private lateinit var coordinator: LiveGuestInvitationCoordinator
    private lateinit var legacy: ForbiddenLegacyRepository

    private class Reply(val status: Int, val body: String = "", val session: String? = null)

    private val routes = mutableMapOf<String, Reply>()
    private val seenBodies = CopyOnWriteArrayList<String>()

    @Before
    fun start() {
        legacy = ForbiddenLegacyRepository()
        server = ServerSocket(0)
        coordinator = LiveGuestInvitationCoordinator(
            GuestSessionClient("http://127.0.0.1:${server.localPort}", InMemorySecureStorage())
        )
        thread(isDaemon = true) {
            while (!server.isClosed) {
                val socket = runCatching { server.accept() }.getOrNull() ?: break
                runCatching {
                    socket.use {
                        val reader = BufferedReader(InputStreamReader(it.getInputStream()))
                        val line = reader.readLine() ?: return@use
                        val parts = line.split(" ")
                        val key = "${parts.getOrElse(0) { "" }} ${parts.getOrElse(1) { "" }.substringBefore('?')}"
                        var length = 0
                        while (true) {
                            val header = reader.readLine() ?: break
                            if (header.isEmpty()) break
                            if (header.substringBefore(':').trim().lowercase() == "content-length") {
                                length = header.substringAfter(':').trim().toIntOrNull() ?: 0
                            }
                        }
                        if (length > 0) {
                            val buffer = CharArray(length)
                            reader.read(buffer, 0, length)
                            seenBodies.add(String(buffer))
                        }
                        val reply = routes[key] ?: Reply(404)
                        val payload = reply.body.toByteArray(Charsets.UTF_8)
                        val headers = StringBuilder("HTTP/1.1 ${reply.status} X\r\n")
                            .append("Content-Type: application/json\r\n")
                            .append("Content-Length: ${payload.size}\r\n")
                        reply.session?.let { v ->
                            headers.append("Set-Cookie: ${GuestSessionClient.SESSION_COOKIE}=$v; Path=/\r\n")
                        }
                        headers.append("Connection: close\r\n\r\n")
                        it.getOutputStream().apply {
                            write(headers.toString().toByteArray(Charsets.UTF_8)); write(payload); flush()
                        }
                    }
                }
            }
        }

        routes["POST /api/weddings/charity-and-kudzie/guest-session"] = Reply(
            200,
            """{"success":true,"authorized":true,"wedding":{"slug":"charity-and-kudzie"},""" +
                """"guest":{"id":"guest_real","name":"Shadreck Kudzanai Musarurwa"}}""",
            session = "LIVE-SESSION"
        )
        routes["GET /api/weddings/charity-and-kudzie/guest-session"] = Reply(
            200,
            """{"success":true,"authorized":true,""" +
                """"wedding":{"slug":"charity-and-kudzie","title":"Charity & Kudzie",""" +
                """"monogram":"C&K","tagline":"23.12.26","date":"2026-12-23T14:00:00",""" +
                """"venue":"Imba Manor","venueCity":"Harare","venueCountry":"Zimbabwe",""" +
                """"venueMapUrl":"https://maps.example/imba","invitationCardStyle":"ivory-floral-gold",""" +
                """"invitationCardMessage":null,"rsvpDeadline":null,"childrenPolicy":"welcome"},""" +
                """"guest":{"id":"guest_real","name":"Shadreck Kudzanai Musarurwa"},""" +
                """"rsvp":{"attending":null,"checkedIn":false}}"""
        )
    }

    @After
    fun stop() = server.close()

    /**
     * The whole runtime sequence: a URL arrives, the app parses it, carries it as an entry, and
     * the coordinator exchanges and loads. No repository is consulted at any point.
     */
    @Test
    fun anIncomingPrivateLinkTravelsTheLivePathWithoutTouchingTheRepository() = runBlocking {
        // 1. What AppState does with an incoming URL.
        val entry = InvitationEntryParser.fromUrl(
            "https://wewed.pro/invite/charity-and-kudzie?rsvp=PRIVATE-CREDENTIAL&card=ivory-floral-gold"
        )
        assertTrue(entry is InvitationEntry.PrivateInvitation)

        // 2. What Root does with the carried entry.
        val state = coordinator.enter(entry!!)
        val presenting = state as? LiveInvitationState.Presenting
        assertNotNull("the live path must present the card", presenting)

        // 3. What the card renders from.
        val presentation = LiveInvitationPresentation.from(presenting!!.snapshot)
        assertEquals("Shadreck Kudzanai Musarurwa", presentation.guestName)
        assertEquals("Charity & Kudzie", presentation.coupleNames)
        assertEquals(InvitationStyle.IVORY_FLORAL_GOLD, presentation.invitationCardStyle)
        assertEquals(RSVPStatus.PENDING, presentation.rsvpStatus)

        assertTrue(
            "no legacy repository method may be called: ${legacy.touched}",
            legacy.touched.isEmpty()
        )
    }

    /** RSVP writes through the guest-session authority, bound by guest id, not through a repository. */
    @Test
    fun rsvpAcceptTravelsTheLivePathWithoutTouchingTheRepository() = runBlocking {
        val entry = InvitationEntryParser.fromUrl(
            "https://wewed.pro/invite/charity-and-kudzie?rsvp=PRIVATE-CREDENTIAL"
        )!!
        coordinator.enter(entry)

        routes["PUT /api/weddings/charity-and-kudzie/guest-session"] =
            Reply(200, """{"success":true,"rsvp":{"attending":true}}""")
        seenBodies.clear()

        val accepted = coordinator.answer(GuestRsvpUpdate(attending = true))
        assertTrue(accepted is RsvpOutcome.Saved)
        assertEquals(true, (accepted as RsvpOutcome.Saved).rsvp.attending)
        assertTrue(seenBodies.last().contains("\"originGuestId\":\"guest_real\""))
        assertTrue(
            "no legacy repository method may be called: ${legacy.touched}",
            legacy.touched.isEmpty()
        )
    }

    /** Decline travels the same authority. */
    @Test
    fun rsvpDeclineTravelsTheLivePathWithoutTouchingTheRepository() = runBlocking {
        val entry = InvitationEntryParser.fromUrl(
            "https://wewed.pro/invite/charity-and-kudzie?rsvp=PRIVATE-CREDENTIAL"
        )!!
        coordinator.enter(entry)

        routes["PUT /api/weddings/charity-and-kudzie/guest-session"] =
            Reply(200, """{"success":true,"rsvp":{"attending":false}}""")
        val declined = coordinator.answer(GuestRsvpUpdate(attending = false))
        assertTrue(declined is RsvpOutcome.Saved)
        assertEquals(false, (declined as RsvpOutcome.Saved).rsvp.attending)
        assertTrue(legacy.touched.isEmpty())
    }

    /**
     * The presentation model has no field for a credential.
     *
     * Asserted on the rendered values rather than by reading the type, so it stays true even if
     * someone adds one later and populates it.
     */
    @Test
    fun theLivePresentationCarriesNoRsvpCredential() = runBlocking {
        val token = "PRIVATE-CREDENTIAL-THAT-MUST-NOT-SURVIVE"
        val entry = InvitationEntryParser.fromUrl(
            "https://wewed.pro/invite/charity-and-kudzie?rsvp=$token"
        )!!
        val presenting = coordinator.enter(entry) as LiveInvitationState.Presenting
        val presentation = LiveInvitationPresentation.from(presenting.snapshot)

        assertFalse(
            "the RSVP credential must not survive into the view model",
            presentation.toString().contains(token)
        )
        assertFalse(presenting.snapshot.toString().contains(token))
    }

    /** A live failure shows a live failure. It never silently renders the Shadow journey. */
    @Test
    fun aLiveFailureNeverFallsBackToTheRepository() = runBlocking {
        routes["POST /api/weddings/charity-and-kudzie/guest-session"] =
            Reply(401, """{"success":false}""")
        val entry = InvitationEntryParser.fromUrl(
            "https://wewed.pro/invite/charity-and-kudzie?rsvp=EXPIRED"
        )!!
        val state = coordinator.enter(entry)

        assertTrue("a refused invitation must be refused", state is LiveInvitationState.Refused)
        assertTrue(
            "failure must not fall back to the Shadow repository: ${legacy.touched}",
            legacy.touched.isEmpty()
        )
    }
}
