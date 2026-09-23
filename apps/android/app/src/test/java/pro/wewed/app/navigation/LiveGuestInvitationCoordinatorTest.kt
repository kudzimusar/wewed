package pro.wewed.app.navigation

import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import pro.wewed.app.invitation.*
import pro.wewed.app.models.RSVPStatus
import pro.wewed.app.services.InMemorySecureStorage
import pro.wewed.app.ui.invitation.resolveLiveInvitationActions
import pro.wewed.app.ui.invitation.ivory.ivoryRsvpActionLabel
import pro.wewed.app.ui.invitation.ivoryRsvpStateFrom
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

    private fun invitationReadsFull(
        slug: String,
        guestId: String,
        name: String,
        attending: String,
        mealChoice: String? = null,
        plusOne: Boolean = false,
        plusOneName: String? = null,
        plusOneMeal: String? = null,
        kidsAttending: Boolean = false,
        kidsCount: Int? = null,
        dietaryNotes: String? = null,
        message: String? = null,
        childrenPolicy: String = "welcome"
    ) {
        val rsvpJson = JSONObject().apply {
            if (attending == "null") put("attending", JSONObject.NULL)
            else put("attending", attending.toBoolean())
            mealChoice?.let { put("mealChoice", it) } ?: put("mealChoice", JSONObject.NULL)
            put("plusOne", plusOne)
            plusOneName?.let { put("plusOneName", it) } ?: put("plusOneName", JSONObject.NULL)
            plusOneMeal?.let { put("plusOneMeal", it) } ?: put("plusOneMeal", JSONObject.NULL)
            put("kidsAttending", kidsAttending)
            kidsCount?.let { put("kidsCount", it) } ?: put("kidsCount", JSONObject.NULL)
            dietaryNotes?.let { put("dietaryNotes", it) } ?: put("dietaryNotes", JSONObject.NULL)
            message?.let { put("message", it) } ?: put("message", JSONObject.NULL)
            put("checkedIn", false)
        }
        val weddingJson = JSONObject().apply {
            put("slug", slug)
            put("title", "Charity & Kudzie")
            put("monogram", "C&K")
            put("date", "2026-12-23T14:00:00")
            put("venue", "Imba Manor")
            put("venueCity", "Harare")
            put("venueCountry", "Zimbabwe")
            put("invitationCardStyle", "ivory-floral-gold")
            put("childrenPolicy", childrenPolicy)
        }
        val guestJson = JSONObject().apply {
            put("id", guestId)
            put("name", name)
        }
        val responseJson = JSONObject().apply {
            put("success", true)
            put("authorized", true)
            put("wedding", weddingJson)
            put("guest", guestJson)
            put("rsvp", rsvpJson)
        }
        routes["GET /api/weddings/$slug/guest-session"] = Reply(200, responseJson.toString())
    }

    private fun answerSucceeds(
        slug: String,
        attending: Boolean?,
        mealChoice: String? = null,
        plusOne: Boolean = false,
        plusOneName: String? = null,
        plusOneMeal: String? = null,
        kidsAttending: Boolean = false,
        kidsCount: Int? = null,
        dietaryNotes: String? = null,
        message: String? = null
    ) {
        val rsvpJson = JSONObject().apply {
            if (attending == null) put("attending", JSONObject.NULL) else put("attending", attending)
            mealChoice?.let { put("mealChoice", it) } ?: put("mealChoice", JSONObject.NULL)
            put("plusOne", plusOne)
            plusOneName?.let { put("plusOneName", it) } ?: put("plusOneName", JSONObject.NULL)
            plusOneMeal?.let { put("plusOneMeal", it) } ?: put("plusOneMeal", JSONObject.NULL)
            put("kidsAttending", kidsAttending)
            kidsCount?.let { put("kidsCount", it) } ?: put("kidsCount", JSONObject.NULL)
            dietaryNotes?.let { put("dietaryNotes", it) } ?: put("dietaryNotes", JSONObject.NULL)
            message?.let { put("message", it) } ?: put("message", JSONObject.NULL)
        }
        val responseJson = JSONObject().apply {
            put("success", true)
            put("rsvp", rsvpJson)
        }
        routes["PUT /api/weddings/$slug/guest-session"] = Reply(200, responseJson.toString())
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
        // The redirect names the wedding, exactly as production's `/invite/resume` does. Nothing
        // is seeded: a deferred install has no previous session to read a slug out of.
        routes["GET /invite/resume"] = Reply(
            303,
            session = "SESSION-2",
            location = "/w/charity-and-kudzie?invitation=1&card=ivory-floral-gold"
        )
        invitationReads("charity-and-kudzie", "guest_live", "Live Guest", "null")

        seenPaths.clear()
        val state = coordinator.enter(InvitationEntry.Handoff("A".repeat(43)))

        assertTrue(
            "the handoff must reach the server",
            seenPaths.any { it.startsWith("GET /invite/resume") }
        )
        val presenting = state as? LiveInvitationState.Presenting
        assertNotNull("a redeemed handoff must end in a presented card, not silence", presenting)
        assertEquals("Live Guest", presenting!!.snapshot.guestName)
        assertEquals("charity-and-kudzie", presenting.snapshot.weddingSlug)
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

    private fun presentGuestA() = runBlocking {
        exchangeSucceeds("wedding-a", "guest_a", "SESSION-A")
        invitationReads("wedding-a", "guest_a", "Guest A", "true")
        val first = coordinator.enter(InvitationEntry.PrivateInvitation("wedding-a", "CREDENTIAL-A"))
        val presenting = first as? LiveInvitationState.Presenting
        assertNotNull("Guest A must be presented, was $first", presenting)
        assertEquals("Guest A", presenting!!.snapshot.guestName)
    }

    /** Nothing may act as Guest A while a replacement is refused or unreachable (master plan §6.5). */
    private fun assertGuestAIsNotActionable() = runBlocking {
        seenPaths.clear()
        assertEquals(
            "answering must not target the previously presented Guest",
            RsvpOutcome.ReopenRequired,
            coordinator.answer(GuestRsvpUpdate(attending = false))
        )
        assertFalse("no RSVP write for Guest A", seenPaths.any { it.startsWith("PUT ") })

        assertEquals(
            "refresh must not re-present the previously presented Guest",
            LiveInvitationState.Idle,
            coordinator.refresh()
        )
        assertTrue("no request at all — in particular no read of Guest A", seenPaths.isEmpty())
    }

    /**
     * Guest replacement (master plan §6.5). With Guest A presented, an invalid Guest B is refused;
     * from that moment nothing answers or refreshes as A. A's SECURE session is not destroyed, so an
     * explicit restore can still bring A back.
     */
    @Test
    fun anInvalidSecondGuestIsRefusedAndNeverAnswersWithTheFirstGuestsCard() = runBlocking {
        presentGuestA()

        routes["POST /api/weddings/wedding-b/guest-session"] = Reply(401, """{"success":false}""")
        val second = coordinator.enter(InvitationEntry.PrivateInvitation("wedding-b", "INVALID-B"))
        assertTrue("an invalid Guest B must be refused", second is LiveInvitationState.Refused)

        assertGuestAIsNotActionable()

        // Presentation binding != remembered session: A's stored session survived the refusal.
        assertEquals("wedding-a", client.activeSessionSlug())
        val restored = coordinator.restoreRememberedGuest()
        assertEquals(
            "an explicit restore may bring back the still-valid Guest A",
            "Guest A",
            (restored as LiveInvitationState.Presenting).snapshot.guestName
        )
    }

    /** An unreachable Wewed during B's entry leaves A exactly as unactionable as a refusal does. */
    @Test
    fun aTransportFailedSecondGuestLeavesTheFirstGuestUnactionable() = runBlocking {
        presentGuestA()

        routes["POST /api/weddings/wedding-b/guest-session"] = Reply(503)
        val second = coordinator.enter(InvitationEntry.PrivateInvitation("wedding-b", "CREDENTIAL-B"))
        assertTrue(second is LiveInvitationState.Unavailable)

        assertGuestAIsNotActionable()
        assertEquals("wedding-a", client.activeSessionSlug())
    }

    /** A rejected entry (malformed link) ends the presentation too, without any request. */
    @Test
    fun aRejectedSecondEntryAlsoEndsTheFirstGuestsPresentation() = runBlocking {
        presentGuestA()
        val second = coordinator.enter(
            InvitationEntry.Rejected(InvitationEntry.Reason.RESUME_CARRIED_RAW_CREDENTIAL)
        )
        assertTrue(second is LiveInvitationState.Refused)
        assertGuestAIsNotActionable()
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
        val outcome = coordinator.answer(GuestRsvpUpdate(attending = true))

        assertTrue(outcome is RsvpOutcome.Saved)
        assertEquals(true, (outcome as RsvpOutcome.Saved).rsvp.attending)
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
        val outcome = coordinator.answer(GuestRsvpUpdate(attending = false))
        assertTrue(outcome is RsvpOutcome.Saved)
        assertEquals(false, (outcome as RsvpOutcome.Saved).rsvp.attending)
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
        assertEquals(RsvpOutcome.ReopenRequired, coordinator.answer(GuestRsvpUpdate(attending = true)))
    }

    /** Answering before a card exists cannot guess a guest. */
    @Test
    fun answeringWithoutAPresentedCardIsRefused() = runBlocking {
        assertEquals(RsvpOutcome.ReopenRequired, coordinator.answer(GuestRsvpUpdate(attending = true)))
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

    /**
     * Regression test for independent moderator inspection finding:
     * The RSVP interaction must remain accessible across PENDING, ACCEPTED, and DECLINED states.
     * The card may show Accepted / Declined / Pending, but its RSVP action must remain usable.
     */
    @Test
    fun rsvpActionRemainsReachableAcrossAllStatuses() {
        val dummySnapshot = GuestInvitationSnapshot(
            weddingSlug = "charity-and-kudzie",
            title = "Charity & Kudzie",
            monogram = "C&K",
            tagline = null,
            date = "2026-12-23T14:00:00",
            venue = "Imba Manor",
            venueMapUrl = null,
            venueCity = "Harare",
            venueCountry = "Zimbabwe",
            invitationCardStyle = "ivory-floral-gold",
            invitationCardMessage = null,
            rsvpDeadline = null,
            childrenPolicy = "welcome",
            guestId = "guest_live",
            guestName = "Live Guest",
            email = null,
            tableNumber = null,
            tableName = null,
            attending = null,
            mealChoice = null,
            plusOne = false,
            plusOneName = null,
            plusOneMeal = null,
            kidsAttending = false,
            kidsCount = null,
            dietaryNotes = null,
            message = null,
            checkedIn = false,
            checkedInAt = null
        )

        // 1. Pending presentation: RSVP action exists, label is "RSVP"
        val pendingPres = LiveInvitationPresentation.from(dummySnapshot.copy(attending = null))
        assertEquals(RSVPStatus.PENDING, pendingPres.rsvpStatus)
        var pendingPrompted = false
        val pendingActions = resolveLiveInvitationActions(pendingPres, onRsvpPrompt = { pendingPrompted = true })
        assertNotNull("RSVP action must exist for pending presentation", pendingActions.onRsvp)
        pendingActions.onRsvp!!.invoke()
        assertTrue(pendingPrompted)
        assertEquals("RSVP", ivoryRsvpActionLabel(ivoryRsvpStateFrom(pendingPres.rsvpStatus)))

        // 2. Accepted presentation: RSVP action still exists, label is "Update RSVP"
        val acceptedPres = LiveInvitationPresentation.from(dummySnapshot.copy(attending = true, mealChoice = "beef"))
        assertEquals(RSVPStatus.ATTENDING, acceptedPres.rsvpStatus)
        var acceptedPrompted = false
        val acceptedActions = resolveLiveInvitationActions(acceptedPres, onRsvpPrompt = { acceptedPrompted = true })
        assertNotNull("RSVP action must still exist for accepted presentation", acceptedActions.onRsvp)
        acceptedActions.onRsvp!!.invoke()
        assertTrue(acceptedPrompted)
        assertEquals("Update RSVP", ivoryRsvpActionLabel(ivoryRsvpStateFrom(acceptedPres.rsvpStatus)))

        // 3. Declined presentation: RSVP action still exists, label is "Update RSVP"
        val declinedPres = LiveInvitationPresentation.from(dummySnapshot.copy(attending = false))
        assertEquals(RSVPStatus.DECLINED, declinedPres.rsvpStatus)
        var declinedPrompted = false
        val declinedActions = resolveLiveInvitationActions(declinedPres, onRsvpPrompt = { declinedPrompted = true })
        assertNotNull("RSVP action must still exist for declined presentation", declinedActions.onRsvp)
        declinedActions.onRsvp!!.invoke()
        assertTrue(declinedPrompted)
        assertEquals("Update RSVP", ivoryRsvpActionLabel(ivoryRsvpStateFrom(declinedPres.rsvpStatus)))
    }

    /**
     * Exercises the full mutation cycles through the existing Guest Session path:
     * 1. pending -> accept -> refresh -> accepted presentation -> reopen -> change meal/message -> save -> same RSVP record updated
     * 2. accepted -> reopen -> decline -> save -> refresh shows declined with dormant field preservation
     * 3. declined -> reopen -> accept -> restore saved dormant details -> save -> refresh shows accepted
     */
    @Test
    fun exerciseMutationCyclesThroughExistingGuestSessionPath() = runBlocking {
        // --- START: Pending presentation ---
        exchangeSucceeds("charity-and-kudzie", "guest_live", "SESSION-1")
        invitationReadsFull("charity-and-kudzie", "guest_live", "Live Guest", "null")
        val state0 = coordinator.enter(InvitationEntry.PrivateInvitation("charity-and-kudzie", "TOKEN"))
        val pres0 = LiveInvitationPresentation.from((state0 as LiveInvitationState.Presenting).snapshot)
        assertEquals(RSVPStatus.PENDING, pres0.rsvpStatus)
        assertNotNull(resolveLiveInvitationActions(pres0, onRsvpPrompt = {}).onRsvp)

        // --- CYCLE 1: pending -> accept -> refresh -> accepted presentation -> reopen -> change meal/message -> save ---
        answerSucceeds("charity-and-kudzie", attending = true, mealChoice = "beef", message = "Joyfully accept!")
        val saveOutcome1 = coordinator.answer(GuestRsvpUpdate(attending = true, mealChoice = "beef", message = "Joyfully accept!"))
        assertTrue(saveOutcome1 is RsvpOutcome.Saved)
        val rsvp1 = (saveOutcome1 as RsvpOutcome.Saved).rsvp
        assertEquals(true, rsvp1.attending)
        assertEquals("beef", rsvp1.mealChoice)
        assertEquals("Joyfully accept!", rsvp1.message)

        invitationReadsFull("charity-and-kudzie", "guest_live", "Live Guest", "true", mealChoice = "beef", message = "Joyfully accept!")
        val refreshed1 = coordinator.refresh() as LiveInvitationState.Presenting
        val pres1 = LiveInvitationPresentation.from(refreshed1.snapshot)
        assertEquals(RSVPStatus.ATTENDING, pres1.rsvpStatus)
        assertEquals("beef", pres1.mealChoice)
        assertEquals("Joyfully accept!", pres1.message)
        assertNotNull(resolveLiveInvitationActions(pres1, onRsvpPrompt = {}).onRsvp)

        // Reopen and edit details (change meal to chicken, update message)
        answerSucceeds("charity-and-kudzie", attending = true, mealChoice = "chicken", message = "Updated message: see you there!")
        val saveOutcome2 = coordinator.answer(GuestRsvpUpdate(attending = true, mealChoice = "chicken", message = "Updated message: see you there!"))
        assertTrue(saveOutcome2 is RsvpOutcome.Saved)
        val rsvp2 = (saveOutcome2 as RsvpOutcome.Saved).rsvp
        assertEquals(true, rsvp2.attending)
        assertEquals("chicken", rsvp2.mealChoice)
        assertEquals("Updated message: see you there!", rsvp2.message)

        invitationReadsFull("charity-and-kudzie", "guest_live", "Live Guest", "true", mealChoice = "chicken", message = "Updated message: see you there!")
        val refreshed2 = coordinator.refresh() as LiveInvitationState.Presenting
        val pres2 = LiveInvitationPresentation.from(refreshed2.snapshot)
        assertEquals("chicken", pres2.mealChoice)
        assertEquals("Updated message: see you there!", pres2.message)
        // Verify same RSVP record updated: both saves carried the same originGuestId
        assertTrue(seenBodies.any { it.contains("\"originGuestId\":\"guest_live\"") && it.contains("\"mealChoice\":\"beef\"") })
        assertTrue(seenBodies.any { it.contains("\"originGuestId\":\"guest_live\"") && it.contains("\"mealChoice\":\"chicken\"") })

        // --- CYCLE 2: accepted -> reopen -> decline -> save -> refresh shows declined with dormant field preservation ---
        // When declining, form omits mealChoice (null) and sets plusOne/kidsAttending false
        answerSucceeds("charity-and-kudzie", attending = false, mealChoice = "chicken", plusOne = false, kidsAttending = false, message = "Regretfully cannot attend")
        val saveOutcome3 = coordinator.answer(GuestRsvpUpdate(attending = false, plusOne = false, kidsAttending = false, message = "Regretfully cannot attend"))
        assertTrue(saveOutcome3 is RsvpOutcome.Saved)
        val rsvp3 = (saveOutcome3 as RsvpOutcome.Saved).rsvp
        assertEquals(false, rsvp3.attending)
        // Dormant meal is preserved on server
        assertEquals("chicken", rsvp3.mealChoice)

        invitationReadsFull("charity-and-kudzie", "guest_live", "Live Guest", "false", mealChoice = "chicken", plusOne = false, message = "Regretfully cannot attend")
        val refreshed3 = coordinator.refresh() as LiveInvitationState.Presenting
        val pres3 = LiveInvitationPresentation.from(refreshed3.snapshot)
        assertEquals(RSVPStatus.DECLINED, pres3.rsvpStatus)
        assertEquals(false, pres3.attending)
        assertEquals("chicken", pres3.mealChoice) // Dormant value retained on server
        assertNotNull(resolveLiveInvitationActions(pres3, onRsvpPrompt = {}).onRsvp)

        // --- CYCLE 3: declined -> reopen -> accept -> restore saved dormant details where appropriate -> save -> refresh shows accepted ---
        // Reopen recovers dormant meal ("chicken"), guest adds plus-one
        answerSucceeds("charity-and-kudzie", attending = true, mealChoice = "chicken", plusOne = true, plusOneName = "Sarah", plusOneMeal = "vegan", message = "Excited to join after all!")
        val saveOutcome4 = coordinator.answer(GuestRsvpUpdate(attending = true, mealChoice = "chicken", plusOne = true, plusOneName = "Sarah", plusOneMeal = "vegan", message = "Excited to join after all!"))
        assertTrue(saveOutcome4 is RsvpOutcome.Saved)
        val rsvp4 = (saveOutcome4 as RsvpOutcome.Saved).rsvp
        assertEquals(true, rsvp4.attending)
        assertEquals("chicken", rsvp4.mealChoice)
        assertEquals(true, rsvp4.plusOne)
        assertEquals("Sarah", rsvp4.plusOneName)
        assertEquals("vegan", rsvp4.plusOneMeal)

        invitationReadsFull("charity-and-kudzie", "guest_live", "Live Guest", "true", mealChoice = "chicken", plusOne = true, plusOneName = "Sarah", plusOneMeal = "vegan", message = "Excited to join after all!")
        val refreshed4 = coordinator.refresh() as LiveInvitationState.Presenting
        val pres4 = LiveInvitationPresentation.from(refreshed4.snapshot)
        assertEquals(RSVPStatus.ATTENDING, pres4.rsvpStatus)
        assertEquals(true, pres4.attending)
        assertEquals("chicken", pres4.mealChoice)
        assertEquals(true, pres4.plusOne)
        assertEquals("Sarah", pres4.plusOneName)
        assertEquals("vegan", pres4.plusOneMeal)
        assertNotNull(resolveLiveInvitationActions(pres4, onRsvpPrompt = {}).onRsvp)
    }

    /**
     * Blocker 1 Regression Test:
     * Tapping RSVP/Update RSVP must refresh server truth BEFORE opening the editor.
     * When guest details are updated on the PWA out-of-band, the native editor receives the fresh
     * server snapshot.
     */
    @Test
    fun rsvpReopenRefreshesServerTruthBeforeOpeningEditor() = runBlocking {
        // Initial state: accepted with meal choice "beef"
        exchangeSucceeds("charity-and-kudzie", "guest_live", "SESSION-1")
        invitationReadsFull("charity-and-kudzie", "guest_live", "Live Guest", "true", mealChoice = "beef", message = "See you there")
        val state = coordinator.enter(InvitationEntry.PrivateInvitation("charity-and-kudzie", "TOKEN"))
        val pres = LiveInvitationPresentation.from((state as LiveInvitationState.Presenting).snapshot)
        assertEquals("beef", pres.mealChoice)

        // PWA updates meal choice out-of-band to "vegan"
        invitationReadsFull("charity-and-kudzie", "guest_live", "Live Guest", "true", mealChoice = "vegan", message = "Switched to vegan")

        // Guest taps Update RSVP on native -> prepareRsvpEdit is called
        val prep = coordinator.prepareRsvpEdit("guest_live")
        assertTrue("prepareRsvpEdit must be Ready", prep is RsvpEditPreparation.Ready)
        val refreshedPres = (prep as RsvpEditPreparation.Ready).presentation
        assertEquals("Editor must open with fresh meal choice from server", "vegan", refreshedPres.mealChoice)
        assertEquals("Switched to vegan", refreshedPres.message)

        // Guest edits message and saves -> save keeps vegan mealChoice
        answerSucceeds("charity-and-kudzie", attending = true, mealChoice = "vegan", message = "Updated from native")
        val saveOutcome = coordinator.answer(GuestRsvpUpdate(attending = true, mealChoice = "vegan", message = "Updated from native"))
        assertTrue(saveOutcome is RsvpOutcome.Saved)
        assertEquals("vegan", (saveOutcome as RsvpOutcome.Saved).rsvp.mealChoice)
        assertEquals("Updated from native", (saveOutcome as RsvpOutcome.Saved).rsvp.message)
    }

    /**
     * Blocker 1 Failure Modes:
     * 1. Network unavailable: returns Unavailable; does NOT open stale editor.
     * 2. Revoked/Unauthorized: returns RevokedOrUnauthorized; does NOT open editor.
     * 3. Switched/Stale Guest context: returns StaleOrReplacedGuest; does NOT open editor.
     */
    @Test
    fun rsvpReopenDistinguishesFailureModesWithoutOpeningStaleEditor() = runBlocking {
        exchangeSucceeds("charity-and-kudzie", "guest_live", "SESSION-1")
        invitationReadsFull("charity-and-kudzie", "guest_live", "Live Guest", "true", mealChoice = "beef")
        coordinator.enter(InvitationEntry.PrivateInvitation("charity-and-kudzie", "TOKEN"))

        // 1. Network failure during refresh
        routes["GET /api/weddings/charity-and-kudzie/guest-session"] = Reply(503)
        val prepUnavailable = coordinator.prepareRsvpEdit("guest_live")
        assertTrue("Network error must result in Unavailable", prepUnavailable is RsvpEditPreparation.Unavailable)

        // 2. Revoked/Unauthorized session
        routes["GET /api/weddings/charity-and-kudzie/guest-session"] = Reply(401, """{"success":false}""")
        val prepRevoked = coordinator.prepareRsvpEdit("guest_live")
        assertTrue("Revocation must result in RevokedOrUnauthorized", prepRevoked is RsvpEditPreparation.RevokedOrUnauthorized)

        // 3. Stale guest context (e.g. server now returns a different guest session)
        invitationReadsFull("charity-and-kudzie", "guest_other", "Other Guest", "true")
        val prepStale = coordinator.prepareRsvpEdit("guest_live")
        assertTrue("Mismatched guest context must result in StaleOrReplacedGuest", prepStale is RsvpEditPreparation.StaleOrReplacedGuest)
    }
}

