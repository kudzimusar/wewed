package pro.wewed.app.navigation

import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import pro.wewed.app.invitation.GuestOnlyEntryState
import pro.wewed.app.invitation.InvitationEntry

/**
 * The guest-only shell's entry channel.
 *
 * This exists because of a defect the coordinator tests could not see. `onNewIntent` forwarded
 * links only to `AppViewModel`, and in production that view model is deliberately never built — so
 * Guest B arriving while Guest A's shell was on screen was received by Android and then dropped,
 * because the only listener did not exist.
 *
 * The state is what both entry points publish into, so these tests are about replacement rather
 * than about parsing.
 */
class GuestOnlyEntryStateTest {

    @Before
    fun reset() = GuestOnlyEntryState.reset()

    @After
    fun tearDown() = GuestOnlyEntryState.reset()

    /** A cold launch carrying a link publishes it. */
    @Test
    fun aColdLaunchPublishesItsInvitation() {
        assertTrue(
            GuestOnlyEntryState.publish("https://wewed.pro/invite/charity-and-kudzie?rsvp=TOKEN-A")
        )
        assertEquals(
            InvitationEntry.PrivateInvitation("charity-and-kudzie", "TOKEN-A"),
            GuestOnlyEntryState.entry.value
        )
    }

    /**
     * The warm case, and the whole reason this exists: Guest B replaces Guest A while the shell
     * is already running.
     */
    @Test
    fun aWarmLinkReplacesTheActiveGuest() {
        GuestOnlyEntryState.publish("https://wewed.pro/invite/charity-and-kudzie?rsvp=TOKEN-A")
        assertTrue(
            GuestOnlyEntryState.publish("https://wewed.pro/invite/charity-and-kudzie?rsvp=TOKEN-B")
        )
        assertEquals(
            InvitationEntry.PrivateInvitation("charity-and-kudzie", "TOKEN-B"),
            GuestOnlyEntryState.entry.value
        )
        // Guest A's entry is gone, not merely shadowed by B's.
        assertNotEquals(
            InvitationEntry.PrivateInvitation("charity-and-kudzie", "TOKEN-A"),
            GuestOnlyEntryState.entry.value
        )
    }

    /** The package-targeted bridge intent is an entry point too. */
    @Test
    fun aBridgeIntentExtraPublishesAHandoff() {
        val handoff = "A".repeat(43)
        assertTrue(GuestOnlyEntryState.publish(rawUrl = null, intentExtra = handoff))
        assertEquals(InvitationEntry.Handoff(handoff), GuestOnlyEntryState.entry.value)
    }

    /**
     * A refused link is still published. Failing closed has to be visible, and dropping it here
     * would leave the previous guest's card on screen as though nothing had happened.
     */
    @Test
    fun aRefusedLinkIsPublishedRatherThanDropped() {
        GuestOnlyEntryState.publish("https://wewed.pro/invite/charity-and-kudzie?rsvp=TOKEN-A")
        assertTrue(
            GuestOnlyEntryState.publish("https://wewed.pro/invite/resume?h=too-short")
        )
        assertEquals(
            InvitationEntry.Rejected(InvitationEntry.Reason.MALFORMED_HANDOFF),
            GuestOnlyEntryState.entry.value
        )
    }

    /** An ordinary launch is not invitation entry, and must not disturb what is on screen. */
    @Test
    fun anOrdinaryLaunchPublishesNothing() {
        GuestOnlyEntryState.publish("https://wewed.pro/invite/charity-and-kudzie?rsvp=TOKEN-A")
        val before = GuestOnlyEntryState.entry.value

        assertFalse(GuestOnlyEntryState.publish("wewed://pass"))
        assertFalse(GuestOnlyEntryState.publish(null))
        assertEquals("an unrelated launch must not replace the guest", before,
                     GuestOnlyEntryState.entry.value)
    }
}
