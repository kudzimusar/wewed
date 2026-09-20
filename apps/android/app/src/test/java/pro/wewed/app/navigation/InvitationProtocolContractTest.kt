package pro.wewed.app.navigation

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import pro.wewed.app.invitation.InvitationEntry
import pro.wewed.app.invitation.InvitationEntryParser
import java.io.File

/**
 * Native must speak the invitation protocol that already exists.
 *
 * A private invitation is a security protocol, not a URL convention: a second implementation that
 * merely looks similar is a second auth model. `mobile/contracts/invitation-protocol.json` is
 * generated from `origin/main`, and this test holds the native parser to it — including the
 * refusals, which are the part most easily lost.
 */
class InvitationProtocolContractTest {

    private val contract: JSONObject by lazy { JSONObject(contractFile().readText()) }
    private val handoff: JSONObject by lazy { contract.getJSONObject("handoff") }

    private fun contractFile(): File {
        var dir: File? = File(System.getProperty("user.dir") ?: ".").absoluteFile
        while (dir != null) {
            val candidate = File(dir, "mobile/contracts/invitation-protocol.json")
            if (candidate.isFile) return candidate
            dir = dir.parentFile
        }
        throw IllegalStateException("Invitation protocol contract not found")
    }

    /** A handoff that is 43 base64url characters, as the server issues. */
    private val validHandoff = "A".repeat(43)

    @Test
    fun contractIsDerivedFromProductionMain() {
        assertEquals("wewed-invitation-protocol/1", contract.getString("contract"))
        assertEquals("origin/main", contract.getString("authority"))
    }

    @Test
    fun handoffShapeMatchesTheServerPattern() {
        val pattern = Regex("^${handoff.getString("secretPattern")}$")
        assertTrue(pattern.matches(validHandoff))
        assertTrue(InvitationEntryParser.isValidHandoff(validHandoff))

        // One character short, one too long, and one outside the alphabet.
        listOf("A".repeat(42), "A".repeat(44), "A".repeat(42) + "+").forEach {
            assertFalse("'$it' must not be accepted", InvitationEntryParser.isValidHandoff(it))
        }
    }

    @Test
    fun androidIntentExtraAndReferrerKeyMatchTheServer() {
        assertEquals(
            handoff.getString("androidIntentExtra"),
            InvitationEntryParser.ANDROID_INTENT_EXTRA
        )
        assertEquals(
            handoff.getString("playInstallReferrerKey"),
            InvitationEntryParser.PLAY_REFERRER_KEY
        )
    }

    @Test
    fun privateInvitationLinkIsParsed() {
        val entry = InvitationEntryParser.fromUrl(
            "https://wewed.pro/invite/charity-and-kudzie?rsvp=SECRET-TOKEN&card=ivory-floral-gold"
        )
        assertEquals(
            InvitationEntry.PrivateInvitation("charity-and-kudzie", "SECRET-TOKEN"),
            entry
        )
    }

    /**
     * The saved wedding design is authoritative. A forwarded or long-lived link must not be able
     * to select someone else's stationery, so `card` is read by nobody on this side.
     */
    @Test
    fun cardParameterIsAdvisoryOnly() {
        assertTrue(contract.getJSONObject("entry").getBoolean("cardQueryParamIsAdvisoryOnly"))
        val withStaleCard = InvitationEntryParser.fromUrl(
            "https://wewed.pro/invite/charity-and-kudzie?rsvp=T&card=midnight"
        )
        val withoutCard = InvitationEntryParser.fromUrl(
            "https://wewed.pro/invite/charity-and-kudzie?rsvp=T"
        )
        assertEquals(withoutCard, withStaleCard)
    }

    @Test
    fun resumeLinkYieldsAnOpaqueHandoff() {
        val path = handoff.getString("resumePath")
        val param = handoff.getString("resumeQueryParam")
        val entry = InvitationEntryParser.fromUrl("https://wewed.pro$path?$param=$validHandoff")
        assertEquals(InvitationEntry.Handoff(validHandoff), entry)
    }

    /**
     * The refusal that matters most: `buildAndroidInvitationIntentUrl` will not emit a resume URL
     * carrying `rsvp`, so one arriving here did not come from Wewed.
     */
    @Test
    fun resumeCarryingARawCredentialIsRefused() {
        val forbidden = handoff.getString("forbiddenResumeParam")
        val entry = InvitationEntryParser.fromUrl(
            "https://wewed.pro/invite/resume?h=$validHandoff&$forbidden=LEAKED"
        )
        assertEquals(
            InvitationEntry.Rejected(InvitationEntry.Reason.RESUME_CARRIED_RAW_CREDENTIAL),
            entry
        )
    }

    @Test
    fun malformedHandoffFailsClosed() {
        assertEquals(
            InvitationEntry.Rejected(InvitationEntry.Reason.MALFORMED_HANDOFF),
            InvitationEntryParser.fromUrl("https://wewed.pro/invite/resume?h=too-short")
        )
        assertEquals(
            InvitationEntry.Rejected(InvitationEntry.Reason.MALFORMED_HANDOFF),
            InvitationEntryParser.fromIntentExtra("too-short")
        )
    }

    @Test
    fun inviteLinkWithoutACredentialIdentifiesNobody() {
        assertEquals(
            InvitationEntry.Rejected(InvitationEntry.Reason.MISSING_CREDENTIAL),
            InvitationEntryParser.fromUrl("https://wewed.pro/invite/charity-and-kudzie")
        )
    }

    @Test
    fun bridgeIntentExtraYieldsAHandoff() {
        assertEquals(
            InvitationEntry.Handoff(validHandoff),
            InvitationEntryParser.fromIntentExtra(validHandoff)
        )
    }

    @Test
    fun installReferrerYieldsOnlyTheOpaqueHandoff() {
        val key = handoff.getString("playInstallReferrerKey")
        assertEquals(
            InvitationEntry.Handoff(validHandoff),
            InvitationEntryParser.fromInstallReferrer("$key=$validHandoff&utm_source=google-play")
        )
        // An ordinary organic install is not invitation entry.
        assertNull(InvitationEntryParser.fromInstallReferrer("utm_source=google-play"))
    }

    /** Play referrers are attacker-supplied. One offering a raw credential is refused outright. */
    @Test
    fun installReferrerOfferingARawCredentialIsRefused() {
        assertEquals(
            InvitationEntry.Rejected(InvitationEntry.Reason.RESUME_CARRIED_RAW_CREDENTIAL),
            InvitationEntryParser.fromInstallReferrer("rsvp=LEAKED&handoff=$validHandoff")
        )
    }

    /** Only Wewed's own origins are invitation entry. */
    @Test
    fun foreignOriginsAreNotInvitationEntry() {
        assertNull(InvitationEntryParser.fromUrl("https://evil.example/invite/x?rsvp=T"))
        assertNull(InvitationEntryParser.fromUrl("http://wewed.pro.evil/invite/x?rsvp=T"))
    }

    /** A fresh explicit link outranks a stale install referrer. */
    @Test
    fun explicitLaunchIsRecognised() {
        assertTrue(
            InvitationEntryParser.isExplicitInvitationLaunch(
                "https://wewed.pro/invite/slug?rsvp=T"
            )
        )
        assertFalse(InvitationEntryParser.isExplicitInvitationLaunch("wewed://pass"))
        assertFalse(InvitationEntryParser.isExplicitInvitationLaunch(null))
    }

    /** No credential may reach a log line through a default toString. */
    @Test
    fun credentialsAreRedactedInDescriptions() {
        val invitation = InvitationEntry.PrivateInvitation("slug", "SUPER-SECRET-TOKEN")
        assertFalse(invitation.toString().contains("SUPER-SECRET-TOKEN"))
        assertTrue(invitation.toString().contains("slug"))
        assertFalse(InvitationEntry.Handoff(validHandoff).toString().contains(validHandoff))
    }
}
