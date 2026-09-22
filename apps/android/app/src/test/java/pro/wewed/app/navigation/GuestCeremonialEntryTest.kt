package pro.wewed.app.navigation

import org.junit.Assert.*
import org.junit.Test
import pro.wewed.app.models.AppRole
import pro.wewed.app.models.InvitationContext
import pro.wewed.app.models.RSVPStatus
import pro.wewed.app.models.RsvpSubmissionResult

/**
 * The Guest Entry Contract (master plan §6.2, §6.3), as a set of assertions.
 *
 * An explicit invitation arrival opens on the configured card. An ordinary return by a remembered
 * Guest opens on Guest Home, with the invitation one tap away. The earlier contract here — the card
 * on EVERY entry session — was never production behaviour, and asserting it only qualified the
 * Shadow harness against a rule the Guest shell does not follow (master plan §8.11).
 */
class GuestCeremonialEntryTest {

    private fun invitation(
        confirmed: Boolean = false,
        declined: Boolean = false,
        guest: String = "Invited Guest"
    ) = InvitationContext(
        weddingSlug = "charity-and-kudzie",
        guestToken = "token-$guest",
        coupleNames = "Charity & Kudzie",
        guestName = guest,
        partySize = 2,
        weddingDate = "2026-12-23T14:00:00",
        venueName = "Imba Manor",
        venueCity = "Harare, Zimbabwe",
        isConfirmed = confirmed,
        isDeclined = declined
    )

    // -----------------------------------------------------------------------------------
    // Explicit arrival opens on the card; an ordinary return opens on Home
    // -----------------------------------------------------------------------------------

    @Test
    fun anExplicitInvitationArrivalOpensOnTheCard() {
        assertTrue(GuestCeremonialEntry.opensOnInvitation(isExplicitInvitationArrival = true))
    }

    @Test
    fun anOrdinaryReturnOpensOnGuestHomeNotTheCard() {
        assertFalse(GuestCeremonialEntry.opensOnInvitation(isExplicitInvitationArrival = false))
    }

    /** An explicit link meets the card whatever the Guest has already answered. */
    @Test
    fun anExplicitLinkMeetsTheCardWhateverWasAnswered() {
        listOf(invitation(), invitation(confirmed = true), invitation(declined = true)).forEach {
            val state = LaunchRouter.route(
                invitation = it,
                hasValidSession = false,
                authorizedRoles = emptyList(),
                hasResolvedContext = false
            )
            assertTrue("an explicit link must open on the card", state is NativeAppEntryState.Invitation)
        }
    }

    /** A returning Guest workspace is not routed back through the card by the router. */
    @Test
    fun aReturningGuestWithoutALinkIsNotRoutedToTheCard() {
        val state = LaunchRouter.route(
            invitation = null,
            hasValidSession = true,
            authorizedRoles = listOf(AppRole.GUEST),
            hasResolvedContext = true
        )
        assertEquals(NativeAppEntryState.Workspace(AppRole.GUEST), state)
    }

    /** Only Guests have an invitation entrance; nothing here changes how other roles enter. */
    @Test
    fun aCoupleEntryIsUnaffectedByTheGuestContract() {
        val state = LaunchRouter.route(
            invitation = null,
            hasValidSession = true,
            authorizedRoles = listOf(AppRole.COUPLE),
            hasResolvedContext = true
        )
        assertEquals(NativeAppEntryState.Workspace(AppRole.COUPLE), state)
    }

    /** A link being opened now outranks an existing session. */
    @Test
    fun anIncomingInvitationOutranksAnExistingSession() {
        val state = LaunchRouter.route(
            invitation = invitation(guest = "Guest B"),
            hasValidSession = true,
            authorizedRoles = listOf(AppRole.GUEST),
            hasResolvedContext = true
        ) as NativeAppEntryState.Invitation
        assertEquals("Guest B", state.invitation.guestName)
    }

    // -----------------------------------------------------------------------------------
    // What the card asks, across the wedding's life
    // -----------------------------------------------------------------------------------

    @Test
    fun aPendingGuestIsAskedToRespond() {
        val card = GuestCeremonialEntry.presentation(RSVPStatus.PENDING, WeddingLifecyclePhase.BEFORE)
        assertEquals(GuestCardAction.RSVP_NOW, card.primaryAction)
        assertTrue(card.awaitsResponse)
        assertFalse("a guest who has not replied has no pass", card.issuesPass)
    }

    /** The single most important behaviour here: never ask someone the same question twice. */
    @Test
    fun anAttendingGuestIsNeverAskedToRespondAgain() {
        val card = GuestCeremonialEntry.presentation(RSVPStatus.ATTENDING, WeddingLifecyclePhase.BEFORE)
        assertFalse("an answered invitation must not re-ask", card.awaitsResponse)
        assertFalse(card.offers(GuestCardAction.RSVP_NOW))
        assertEquals("RSVP confirmed", card.statusLabel)
        assertEquals(GuestCardAction.VIEW_PASS, card.primaryAction)
        assertTrue(card.issuesPass)
    }

    @Test
    fun aDeclinedGuestIsNeverAskedAgainAndNeverGivenAPass() {
        val card = GuestCeremonialEntry.presentation(RSVPStatus.DECLINED, WeddingLifecyclePhase.BEFORE)
        assertFalse(card.awaitsResponse)
        assertEquals("Not attending", card.statusLabel)
        assertFalse("a declined guest is never admitted", card.issuesPass)
        assertFalse(card.offers(GuestCardAction.VIEW_PASS))
        // They keep the wedding, and may change their mind where the couple allows it.
        assertTrue(card.offers(GuestCardAction.VIEW_WEDDING_SITE))
        assertTrue(card.offers(GuestCardAction.CHANGE_RESPONSE))
    }

    /** On the day the card stops being an invitation and becomes the way in. */
    @Test
    fun onTheDayTheCardBecomesOperational() {
        val card = GuestCeremonialEntry.presentation(RSVPStatus.ATTENDING, WeddingLifecyclePhase.WEDDING_DAY)
        assertEquals("Today", card.headline)
        assertEquals(GuestCardAction.VIEW_PASS, card.primaryAction)
        assertTrue(card.offers(GuestCardAction.OPEN_MAPS))
        assertTrue(card.offers(GuestCardAction.VIEW_PROGRAMME))
        assertTrue(card.offers(GuestCardAction.VIEW_TABLE))
    }

    /** Afterwards it must stop implying an event that has already happened. */
    @Test
    fun afterTheWeddingTheCardThanksRatherThanConfirms() {
        val card = GuestCeremonialEntry.presentation(RSVPStatus.ATTENDING, WeddingLifecyclePhase.AFTER)
        assertEquals("Thank you for celebrating with us", card.headline)
        assertNull(card.statusLabel)
        assertFalse("a past wedding issues no pass", card.issuesPass)
        assertFalse(card.offers(GuestCardAction.RSVP_NOW))
        assertTrue(card.offers(GuestCardAction.VIEW_GALLERY))
    }

    @Test
    fun theLifecyclePhaseIsDerivedFromTheWeddingDate() {
        assertEquals(WeddingLifecyclePhase.BEFORE, GuestCeremonialEntry.phaseFor(93))
        assertEquals(WeddingLifecyclePhase.WEDDING_DAY, GuestCeremonialEntry.phaseFor(0))
        assertEquals(WeddingLifecyclePhase.AFTER, GuestCeremonialEntry.phaseFor(-1))
    }

    @Test
    fun theReminderLineReadsNaturallyAsTheDayApproaches() {
        assertEquals("93 days to go", GuestCeremonialEntry.countdownLabel(93))
        assertEquals("This week", GuestCeremonialEntry.countdownLabel(4))
        assertEquals("Tomorrow", GuestCeremonialEntry.countdownLabel(1))
        assertEquals("Today", GuestCeremonialEntry.countdownLabel(0))
    }

    // -----------------------------------------------------------------------------------
    // Answering is not admission
    // -----------------------------------------------------------------------------------

    /**
     * The old contract returned a WeddingPass from confirmRsvp. A declining guest is still
     * answering, and has no pass; this is now impossible to express.
     */
    @Test
    fun aDeclinedSubmissionCannotCarryAPass() {
        val declined = RsvpSubmissionResult.declined(guestId = "g1", partySize = 2)
        assertFalse(declined.passEligible)
        assertNull(declined.pass)

        assertThrows(IllegalArgumentException::class.java) {
            RsvpSubmissionResult(
                guestId = "g1",
                status = RSVPStatus.DECLINED,
                partySize = 2,
                confirmationMessage = "recorded",
                passEligible = true
            )
        }
    }

    /** Eligibility is the server's answer, so an attending guest may be confirmed without a pass yet. */
    @Test
    fun anAttendingSubmissionMayBeConfirmedBeforeAPassIsIssued()  {
        val attending = RsvpSubmissionResult.attending(
            guestId = "g1", partySize = 2, pass = null, idempotencyKey = "key-1"
        )
        assertTrue(attending.isAttending)
        assertTrue(attending.passEligible)
        assertNull("the pass is the server's to issue", attending.pass)
        assertEquals("key-1", attending.idempotencyKey)
    }
}
