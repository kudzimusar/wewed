package pro.wewed.app.navigation

import org.junit.Assert.*
import org.junit.Test
import pro.wewed.app.invitation.GuestCapability
import pro.wewed.app.invitation.GuestCapabilityPolicy

/**
 * What an invited Guest may do.
 *
 * The rule under test is the one that is easy to get backwards: the invitation establishes
 * identity, and RSVP determines capability. A guest who has not answered is an invited guest who
 * has not answered — not a stranger at the door.
 */
class GuestCapabilityPolicyTest {

    /** A guest who has not answered still has a wedding, an invitation and a profile. */
    @Test
    fun aPendingGuestMayEnterTheirOwnExperience() {
        val pending = GuestCapabilityPolicy.capabilities(null)
        listOf(
            GuestCapability.HOME,
            GuestCapability.INVITATION,
            GuestCapability.WEDDING_DETAILS,
            GuestCapability.VENUE,
            GuestCapability.COUPLE_WEBSITE,
            GuestCapability.REGISTRY,
            GuestCapability.PROFILE
        ).forEach { assertTrue("$it must be available while pending", it in pending) }
    }

    /** And is asked the question, because they have not answered it. */
    @Test
    fun aPendingGuestIsOfferedRsvp() {
        assertTrue(GuestCapabilityPolicy.allows(null, GuestCapability.RSVP))
        assertTrue(GuestCapabilityPolicy.awaitsResponse(null))
    }

    /** But holds no admission credential: they have not said they are coming. */
    @Test
    fun aPendingGuestHasNoPass() {
        assertFalse(GuestCapabilityPolicy.allows(null, GuestCapability.WEDDING_PASS))
    }

    /** Accepting is what unlocks the day itself. */
    @Test
    fun anAttendingGuestGainsTheDayCapabilities() {
        val attending = GuestCapabilityPolicy.capabilities(true)
        listOf(
            GuestCapability.WEDDING_PASS,
            GuestCapability.PARTY_DETAILS,
            GuestCapability.SEATING,
            GuestCapability.WEDDING_DAY_PROGRAMME,
            GuestCapability.ANNOUNCEMENTS,
            GuestCapability.CHECK_IN_STATE
        ).forEach { assertTrue("$it must follow from attending", it in attending) }
    }

    /** An answered guest is never asked again, whichever way they answered. */
    @Test
    fun anAnsweredGuestIsNotAskedAgain() {
        assertFalse(GuestCapabilityPolicy.awaitsResponse(true))
        assertFalse(GuestCapabilityPolicy.awaitsResponse(false))
        assertFalse(GuestCapabilityPolicy.allows(true, GuestCapability.RSVP))
        assertFalse(GuestCapabilityPolicy.allows(false, GuestCapability.RSVP))
    }

    /**
     * Declining does not un-invite anyone.
     *
     * They keep their invitation and their profile — they were invited, and that does not stop
     * being true because they cannot come.
     */
    @Test
    fun aDeclinedGuestKeepsTheirInvitationAndProfile() {
        val declined = GuestCapabilityPolicy.capabilities(false)
        assertTrue(GuestCapability.INVITATION in declined)
        assertTrue(GuestCapability.PROFILE in declined)
        assertTrue(GuestCapability.HOME in declined)
        assertTrue(GuestCapability.COUPLE_WEBSITE in declined)
    }

    /** What they do not get is admission, or anything that presumes it. */
    @Test
    fun aDeclinedGuestReceivesNoAdmission() {
        listOf(
            GuestCapability.WEDDING_PASS,
            GuestCapability.SEATING,
            GuestCapability.CHECK_IN_STATE,
            GuestCapability.WEDDING_DAY_PROGRAMME
        ).forEach {
            assertFalse("$it must not follow a decline", GuestCapabilityPolicy.allows(false, it))
        }
    }

    /** The pass is the one capability that separates attending from every other state. */
    @Test
    fun onlyAttendingEverYieldsAPass() {
        assertTrue(GuestCapabilityPolicy.allows(true, GuestCapability.WEDDING_PASS))
        listOf(null, false).forEach {
            assertFalse(GuestCapabilityPolicy.allows(it, GuestCapability.WEDDING_PASS))
        }
    }
}
