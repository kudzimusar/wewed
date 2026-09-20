package pro.wewed.app.navigation

import org.junit.Assert.*
import org.junit.Test
import pro.wewed.app.invitation.InvitationEntry
import pro.wewed.app.invitation.InvitationEntryDecision
import pro.wewed.app.invitation.InvitationEntryPolicy

/**
 * Who this launch belongs to.
 *
 * These are the ordering rules from the invitation protocol, each written as the bug it prevents
 * rather than as an abstract precedence table.
 */
class InvitationEntryPolicyTest {

    private val guestA = InvitationEntry.PrivateInvitation("charity-and-kudzie", "TOKEN-A")
    private val guestB = InvitationEntry.PrivateInvitation("charity-and-kudzie", "TOKEN-B")
    private val handoff = InvitationEntry.Handoff("A".repeat(43))

    /** Tapping a link is present intent. It is the strongest claim there is. */
    @Test
    fun anExplicitLinkEstablishesThatGuest() {
        assertEquals(
            InvitationEntryDecision.Establish(guestA),
            InvitationEntryPolicy.decide(launchEntry = guestA)
        )
    }

    /**
     * A guest tapping their own invitation on a planner's phone should see their invitation.
     * The privileged workspace is not a lock on the device.
     */
    @Test
    fun anExplicitLinkOutranksAPrivilegedWorkspace() {
        assertEquals(
            InvitationEntryDecision.Establish(guestB),
            InvitationEntryPolicy.decide(launchEntry = guestB, hasPrivilegedWorkspace = true)
        )
    }

    /**
     * The failure this prevents: an invalid Guest B link quietly presenting Guest A, so the wrong
     * person's card opens and the wrong person's RSVP is offered.
     */
    @Test
    fun anInvalidLinkFailsClosedRatherThanFallingBack() {
        val decision = InvitationEntryPolicy.decide(
            launchEntry = InvitationEntry.Rejected(InvitationEntry.Reason.MALFORMED_HANDOFF),
            hasRememberedGuestSession = true
        )
        assertEquals(
            InvitationEntryDecision.Reject(InvitationEntry.Reason.MALFORMED_HANDOFF),
            decision
        )
        assertNotEquals(InvitationEntryDecision.RestoreRememberedGuest, decision)
    }

    /** A resume URL carrying a raw credential is refused, not downgraded to an ordinary launch. */
    @Test
    fun aResumeCarryingARawCredentialIsRejected() {
        assertEquals(
            InvitationEntryDecision.Reject(InvitationEntry.Reason.RESUME_CARRIED_RAW_CREDENTIAL),
            InvitationEntryPolicy.decide(
                launchEntry = InvitationEntry.Rejected(
                    InvitationEntry.Reason.RESUME_CARRIED_RAW_CREDENTIAL
                )
            )
        )
    }

    /** A fresh tap beats an install record, which may be months old. */
    @Test
    fun anExplicitLinkOutranksADeferredInstallRecord() {
        assertEquals(
            InvitationEntryDecision.Establish(guestB),
            InvitationEntryPolicy.decide(
                launchEntry = guestB,
                deferredInstallEntry = handoff,
                deferredInstallAlreadyProcessed = false
            )
        )
    }

    /** An unconsumed install record is honoured when nothing newer exists. */
    @Test
    fun anUnprocessedDeferredInstallEstablishesTheGuest() {
        assertEquals(
            InvitationEntryDecision.Establish(handoff),
            InvitationEntryPolicy.decide(
                launchEntry = null,
                deferredInstallEntry = handoff,
                deferredInstallAlreadyProcessed = false
            )
        )
    }

    /**
     * Once consumed it stays consumed. Otherwise an install referrer surfaces again on an ordinary
     * launch weeks later and reopens someone else's invitation.
     */
    @Test
    fun aProcessedDeferredInstallIsNeverReplayed() {
        assertEquals(
            InvitationEntryDecision.None,
            InvitationEntryPolicy.decide(
                launchEntry = null,
                deferredInstallEntry = handoff,
                deferredInstallAlreadyProcessed = true
            )
        )
    }

    /** An ordinary cold launch restores the guest this device already holds. */
    @Test
    fun anOrdinaryLaunchRestoresTheRememberedGuest() {
        assertEquals(
            InvitationEntryDecision.RestoreRememberedGuest,
            InvitationEntryPolicy.decide(launchEntry = null, hasRememberedGuestSession = true)
        )
    }

    /**
     * Remembered guest state is the weakest claim. A planner signing in to run a wedding must not
     * find themselves inside a guest's invitation because that device once opened one.
     */
    @Test
    fun rememberedGuestStateNeverHijacksAPrivilegedWorkspace() {
        assertEquals(
            InvitationEntryDecision.None,
            InvitationEntryPolicy.decide(
                launchEntry = null,
                hasRememberedGuestSession = true,
                hasPrivilegedWorkspace = true
            )
        )
    }

    /** Someone who simply opened the app is not a guest of anyone's wedding. */
    @Test
    fun anOrdinaryLaunchWithNothingRememberedIsNotInvitationEntry() {
        assertEquals(InvitationEntryDecision.None, InvitationEntryPolicy.decide(launchEntry = null))
    }
}
