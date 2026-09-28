package pro.wewed.app.invitation

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * QRO07-AT01 — "Already downloaded? Open Wewed".
 *
 * The web gate launches `intent://invite/resume#Intent;scheme=wewed;package=…;S.wewed_handoff=…`,
 * i.e. data `wewed://invite/resume` with the opaque handoff ONLY in the extra. Parsing the URL first
 * used to reject that as a malformed resume, so installed Android guests saw "This invitation link
 * can't be opened".
 */
class BridgeLaunchTest {

    private val handoff = "A".repeat(21) + "b-_" + "c".repeat(19) // 43 base64url characters
    private val otherHandoff = "Z".repeat(43)

    @After
    fun reset() = GuestOnlyEntryState.reset()

    @Test
    fun `the web gate bridge resumes the handoff carried in the extra`() {
        assertEquals(
            InvitationEntry.Handoff(handoff),
            InvitationEntryParser.fromLaunch("wewed://invite/resume", handoff)
        )
        assertEquals(
            InvitationEntry.Handoff(handoff),
            InvitationEntryParser.fromLaunch(null, handoff)
        )
    }

    @Test
    fun `a malformed bridge extra still fails closed`() {
        assertEquals(
            InvitationEntry.Rejected(InvitationEntry.Reason.MALFORMED_HANDOFF),
            InvitationEntryParser.fromLaunch("wewed://invite/resume", "too-short")
        )
    }

    @Test
    fun `a bridge resume without any handoff is still rejected`() {
        assertEquals(
            InvitationEntry.Rejected(InvitationEntry.Reason.MALFORMED_HANDOFF),
            InvitationEntryParser.fromLaunch("wewed://invite/resume", null)
        )
    }

    @Test
    fun `an explicit URL keeps precedence over an extra`() {
        assertEquals(
            InvitationEntry.Handoff(handoff),
            InvitationEntryParser.fromLaunch("wewed://invite/resume?h=$handoff", otherHandoff)
        )
        assertEquals(
            InvitationEntry.PrivateInvitation("charity-and-kudzie", "private-token"),
            InvitationEntryParser.fromLaunch("https://wewed.pro/invite/charity-and-kudzie?rsvp=private-token", otherHandoff)
        )
    }

    @Test
    fun `a bridge URL carrying a raw RSVP credential is refused even with a valid extra`() {
        assertEquals(
            InvitationEntry.Rejected(InvitationEntry.Reason.RESUME_CARRIED_RAW_CREDENTIAL),
            InvitationEntryParser.fromLaunch("wewed://invite/resume?rsvp=private-token", handoff)
        )
    }

    @Test
    fun `the guest-only shell receives the bridge handoff`() {
        assertTrue(GuestOnlyEntryState.publish("wewed://invite/resume", handoff))
        assertEquals(InvitationEntry.Handoff(handoff), GuestOnlyEntryState.entry.value)
    }
}
