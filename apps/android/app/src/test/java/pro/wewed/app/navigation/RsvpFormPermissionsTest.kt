package pro.wewed.app.navigation

import org.junit.Assert.*
import org.junit.Test
import pro.wewed.app.models.RsvpFormPermissions

/**
 * What an invitation permits is the couple's decision, not an inference from a number.
 *
 * "Party of 4" was being read as licence to name three more people. It is not: how many may come,
 * whether a plus-one is allowed and which questions are asked are terms of the invitation that was
 * issued. The server states them; the form is built from them.
 */
class RsvpFormPermissionsTest {

    private val household = RsvpFormPermissions(
        maxAttendees = 4,
        allowsPlusOne = true,
        allowsNamedPlusOne = true,
        allowsChildren = true,
        maxChildren = 2,
        asksMealChoice = true,
        mealOptions = listOf("chicken", "vegetarian"),
        asksDietaryNotes = true,
        asksSongRequest = true,
        asksMessage = true,
        allowsResponseChange = true
    )

    @Test
    fun anAnswerWithinTheInvitationsTermsIsPermitted() {
        assertTrue(household.permits(attendees = 2, plusOne = true, children = 1))
    }

    @Test
    fun moreAttendeesThanTheInvitationAllowsIsRefused() {
        assertFalse(household.permits(attendees = 5, plusOne = false, children = 0))
        assertFalse(household.permits(attendees = 0, plusOne = false, children = 0))
    }

    @Test
    fun aPlusOneIsRefusedWhenTheInvitationDoesNotOfferOne() {
        val single = RsvpFormPermissions.singleAttendeeOnly()
        assertFalse(single.permits(attendees = 1, plusOne = true, children = 0))
        assertTrue(single.permits(attendees = 1, plusOne = false, children = 0))
    }

    @Test
    fun childrenAreRefusedBeyondWhatTheInvitationAllows() {
        assertFalse(household.permits(attendees = 2, plusOne = false, children = 3))
        assertTrue(household.permits(attendees = 2, plusOne = false, children = 2))
    }

    /**
     * An unstated permission is refused, not granted. Defaulting the other way would let a gap in
     * the server's answer become a licence.
     */
    @Test
    fun anUnstatedInvitationDefaultsToTheNarrowestTerms() {
        val unstated = RsvpFormPermissions.singleAttendeeOnly()
        assertEquals(1, unstated.maxAttendees)
        assertFalse(unstated.allowsPlusOne)
        assertFalse(unstated.allowsChildren)
        assertFalse(unstated.allowsResponseChange)
        assertFalse(unstated.asksMealChoice)
    }
}
