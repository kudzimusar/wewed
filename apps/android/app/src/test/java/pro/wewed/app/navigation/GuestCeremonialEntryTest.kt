package pro.wewed.app.navigation

import org.junit.Assert.*
import org.junit.Test
import pro.wewed.app.models.AppRole
import pro.wewed.app.models.InvitationContext
import pro.wewed.app.models.RSVPStatus
import pro.wewed.app.models.RsvpSubmissionResult

/**
 * The Guest Ceremonial Entry Contract, as a set of assertions.
 *
 * The invitation was being treated as an onboarding page — shown once, answered, discarded. The
 * Couple recognised this person; the card is that recognition, and it belongs at the start of
 * every visit. These tests hold that rule in place, because it is the kind of rule a later
 * refactor silently undoes.
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
    // The card comes first — on every entry session, whatever was answered
    // -----------------------------------------------------------------------------------

    @Test
    fun aRecognisedPendingGuestMeetsTheCardBeforeTheGuestWorkspace() {
        val state = LaunchRouter.route(
            invitation = null,
            hasValidSession = true,
            authorizedRoles = listOf(AppRole.GUEST),
            hasResolvedContext = true,
            recognisedGuestInvitation = invitation(),
            entrySessionPresentedCard = false
        )
        assertTrue("the card must precede the Guest workspace", state is NativeAppEntryState.Invitation)
    }

    /** Having already answered does not retire the card. It changes what the card asks. */
    @Test
    fun aRecognisedAttendingGuestStillMeetsTheCardFirst() {
        val state = LaunchRouter.route(
            invitation = null,
            hasValidSession = true,
            authorizedRoles = listOf(AppRole.GUEST),
            hasResolvedContext = true,
            recognisedGuestInvitation = invitation(confirmed = true),
            entrySessionPresentedCard = false
        )
        assertTrue(state is NativeAppEntryState.Invitation)
        assertEquals(
            InvitationEntryStage.CONFIRMED,
            (state as NativeAppEntryState.Invitation).stage
        )
    }

    @Test
    fun aRecognisedDeclinedGuestStillMeetsTheCardFirst() {
        val state = LaunchRouter.route(
            invitation = null,
            hasValidSession = true,
            authorizedRoles = listOf(AppRole.GUEST),
            hasResolvedContext = true,
            recognisedGuestInvitation = invitation(declined = true),
            entrySessionPresentedCard = false
        )
        assertTrue(state is NativeAppEntryState.Invitation)
        assertEquals(
            InvitationEntryStage.DECLINED,
            (state as NativeAppEntryState.Invitation).stage
        )
    }

    /**
     * The ceremony marks a session, not a screen transition. Once the card has been presented in
     * this entry session, the Guest continues into the workspace and is not restaged.
     */
    @Test
    fun theCardDoesNotRepeatWithinOneEntrySession() {
        val state = LaunchRouter.route(
            invitation = null,
            hasValidSession = true,
            authorizedRoles = listOf(AppRole.GUEST),
            hasResolvedContext = true,
            recognisedGuestInvitation = invitation(confirmed = true),
            entrySessionPresentedCard = true
        )
        assertEquals(NativeAppEntryState.Workspace(AppRole.GUEST), state)
    }

    /** Only Guests are recognised this way; nothing here changes how other roles enter. */
    @Test
    fun aCoupleEntryIsUnaffectedByTheGuestContract() {
        val state = LaunchRouter.route(
            invitation = null,
            hasValidSession = true,
            authorizedRoles = listOf(AppRole.COUPLE),
            hasResolvedContext = true,
            recognisedGuestInvitation = null,
            entrySessionPresentedCard = false
        )
        assertEquals(NativeAppEntryState.Workspace(AppRole.COUPLE), state)
    }

    /** A link being opened now still outranks the standing recognition. */
    @Test
    fun anIncomingInvitationOutranksTheRecognisedGuest() {
        val incoming = invitation(guest = "Guest B")
        val state = LaunchRouter.route(
            invitation = incoming,
            hasValidSession = true,
            authorizedRoles = listOf(AppRole.GUEST),
            hasResolvedContext = true,
            recognisedGuestInvitation = invitation(guest = "Guest A", confirmed = true),
            entrySessionPresentedCard = false
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
    // Replacing the active guest
    // -----------------------------------------------------------------------------------

    @Test
    fun openingAnotherGuestsInvitationReplacesTheActiveOne() {
        val outcome = GuestCeremonialEntry.replaceActiveGuest(
            current = invitation(guest = "Guest A", confirmed = true),
            incoming = invitation(guest = "Guest B")
        )
        assertTrue(outcome is GuestReplacement.Activate)
        assertEquals("Guest B", (outcome as GuestReplacement.Activate).invitation.guestName)
    }

    /**
     * The worst outcome available here would be showing one person another person's invitation.
     * An invalid incoming claim clears the previous guest and restores nothing.
     */
    @Test
    fun anInvalidIncomingClaimNeverFallsBackToThePreviousGuest() {
        val outcome = GuestCeremonialEntry.replaceActiveGuest(
            current = invitation(guest = "Guest A", confirmed = true),
            incoming = null
        )
        assertEquals(GuestReplacement.RejectAndClear, outcome)
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
