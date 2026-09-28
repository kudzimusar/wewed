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

    /** Pending is invitation-only: identity is known, but persistent Guest entry is not yet open. */
    @Test
    fun aPendingGuestCannotEnterThePersistentExperience() {
        val pending = GuestCapabilityPolicy.capabilities(null)
        listOf(
            GuestCapability.INVITATION,
            GuestCapability.WEDDING_DETAILS,
            GuestCapability.VENUE,
            GuestCapability.COUPLE_WEBSITE,
            GuestCapability.REGISTRY
        ).forEach { assertTrue("$it must remain available from the invitation", it in pending) }
        assertFalse(GuestCapability.HOME in pending)
        assertFalse(GuestCapability.PROFILE in pending)
        assertFalse(GuestCapabilityPolicy.mayEnterPersistentExperience(null))
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

    /** Any completed RSVP unlocks the persistent Guest application. */
    @Test
    fun answeredGuestsMayEnterThePersistentExperience() {
        assertTrue(GuestCapabilityPolicy.mayEnterPersistentExperience(true))
        assertTrue(GuestCapabilityPolicy.mayEnterPersistentExperience(false))
    }

    /** Both answered states may see the shared wedding-day information. */
    @Test
    fun answeredGuestsCanSeeSharedWeddingDayDetails() {
        listOf(true, false).forEach { attending ->
            val capabilities = GuestCapabilityPolicy.capabilities(attending)
            listOf(
                GuestCapability.PARTY_DETAILS,
                GuestCapability.WEDDING_DAY_PROGRAMME,
                GuestCapability.ANNOUNCEMENTS
            ).forEach { assertTrue("$it must remain available to invited guests", it in capabilities) }
        }
    }

    /** Attending alone unlocks venue-admission and attendance operations. */
    @Test
    fun anAttendingGuestGainsAdmissionCapabilities() {
        val attending = GuestCapabilityPolicy.capabilities(true)
        listOf(
            GuestCapability.WEDDING_PASS,
            GuestCapability.SEATING,
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

    /** Declining removes venue-admission operations, not the benefit of remaining an invited Guest. */
    @Test
    fun aDeclinedGuestReceivesNoVenueAdmission() {
        listOf(
            GuestCapability.WEDDING_PASS,
            GuestCapability.SEATING,
            GuestCapability.CHECK_IN_STATE
        ).forEach {
            assertFalse("$it must not follow a decline", GuestCapabilityPolicy.allows(false, it))
        }
        assertTrue(GuestCapabilityPolicy.allows(false, GuestCapability.WEDDING_DAY_PROGRAMME))
        assertTrue(GuestCapabilityPolicy.allows(false, GuestCapability.ANNOUNCEMENTS))
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
