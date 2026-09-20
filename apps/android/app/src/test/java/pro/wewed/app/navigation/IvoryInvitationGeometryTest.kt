package pro.wewed.app.navigation

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import pro.wewed.app.models.InvitationPresentationState
import pro.wewed.app.models.RSVPStatus
import pro.wewed.app.ui.invitation.ivory.IvoryGeometry
import pro.wewed.app.ui.invitation.ivory.IvoryRsvpAnswer
import pro.wewed.app.ui.invitation.ivoryRsvpStateFrom
import java.io.File

/**
 * The Ivory Floral Gold renderer must reproduce the approved stationery, not resemble it.
 *
 * "Ivory background + gold border + a floral ornament" is explicitly not a pass. What makes it the
 * same object is the artwork, the geometry it is laid out on and the motion it opens with, so those
 * are pinned in `mobile/contracts/ivory-invitation-art-provenance.json` and asserted on both
 * platforms rather than living only in whichever file was edited last.
 */
class IvoryInvitationGeometryTest {

    private val contract: JSONObject by lazy { JSONObject(contractFile().readText()) }
    private val geometry: JSONObject by lazy { contract.getJSONObject("geometry") }

    private fun contractFile(): File {
        var dir: File? = File(System.getProperty("user.dir") ?: ".").absoluteFile
        while (dir != null) {
            val candidate = File(dir, "mobile/contracts/ivory-invitation-art-provenance.json")
            if (candidate.isFile) return candidate
            dir = dir.parentFile
        }
        throw IllegalStateException("Ivory art provenance contract not found")
    }

    private fun box(name: String): FloatArray {
        val array = geometry.getJSONObject("regions").getJSONArray(name)
        return FloatArray(array.length()) { array.getDouble(it).toFloat() }
    }

    private fun hit(name: String): FloatArray {
        val array = geometry.getJSONObject("hits").getJSONArray(name)
        return FloatArray(array.length()) { array.getDouble(it).toFloat() }
    }

    @Test
    fun stageMatchesTheApprovedStage() {
        val width = geometry.getDouble("aspectWidth").toFloat()
        val height = geometry.getDouble("aspectHeight").toFloat()
        assertEquals(width / height, IvoryGeometry.ASPECT, 0.0001f)
        assertEquals(geometry.getDouble("perspectivePx").toFloat(), IvoryGeometry.PERSPECTIVE_PX, 0.01f)
        assertEquals(geometry.getInt("openingMillis"), IvoryGeometry.OPENING_MILLIS)
        assertEquals(
            geometry.getDouble("maxStageWidthPx").toFloat(),
            IvoryGeometry.MAX_STAGE_WIDTH_DP,
            0.01f
        )
    }

    /** Every text region sits where the web puts it, to the tenth of a percent. */
    @Test
    fun regionBoxesMatchTheContract() {
        val expected = mapOf(
            "names" to IvoryGeometry.NAMES,
            "message" to IvoryGeometry.MESSAGE,
            "date" to IvoryGeometry.DATE,
            "location" to IvoryGeometry.LOCATION,
            "tagline" to IvoryGeometry.TAGLINE,
            "guest" to IvoryGeometry.GUEST,
            "monogram" to IvoryGeometry.MONOGRAM,
            "detailCouple" to IvoryGeometry.DETAIL_COUPLE,
            "detailNoteIntro" to IvoryGeometry.DETAIL_NOTE_INTRO,
            "detailVenue" to IvoryGeometry.DETAIL_VENUE,
            "detailNote" to IvoryGeometry.DETAIL_NOTE
        )
        expected.forEach { (name, actual) ->
            assertArrayEquals("region '$name'", box(name), actual, 0.001f)
        }
    }

    @Test
    fun detailHitsMatchTheContract() {
        assertEquals(geometry.getDouble("hitLeftPercent").toFloat(), IvoryGeometry.HIT_LEFT, 0.001f)
        assertEquals(geometry.getDouble("hitWidthPercent").toFloat(), IvoryGeometry.HIT_WIDTH, 0.001f)
        val expected = mapOf(
            "rsvp" to IvoryGeometry.HIT_RSVP,
            "calendar" to IvoryGeometry.HIT_CALENDAR,
            "venue" to IvoryGeometry.HIT_VENUE,
            "registry" to IvoryGeometry.HIT_REGISTRY,
            "note" to IvoryGeometry.HIT_NOTE
        )
        expected.forEach { (name, actual) ->
            assertArrayEquals("hit '$name'", hit(name), actual, 0.001f)
        }
    }

    /** The artwork is imported, never redrawn: the contract names a source commit for each file. */
    @Test
    fun everyArtworkAssetDeclaresItsSource() {
        val assets = contract.getJSONObject("assets")
        assertTrue(assets.length() >= 6)
        assets.keys().forEach { key ->
            val asset = assets.getJSONObject(key)
            assertTrue("$key source", asset.getString("source").startsWith("origin/main:"))
            assertEquals("$key sha", 64, asset.getString("sourceSha256").length)
            assertTrue("$key android", asset.getString("android").isNotBlank())
            assertTrue("$key ios", asset.getString("ios").isNotBlank())
        }
    }

    /**
     * Presentation and RSVP are separate axes.
     *
     * Collapsing them is the original defect: a confirmed guest was handed a different screen
     * instead of their invitation. Every combination has to be expressible.
     */
    @Test
    fun presentationStateIsIndependentOfRsvpState() {
        val combinations = InvitationPresentationState.entries.flatMap { presentation ->
            RSVPStatus.entries.map { presentation to ivoryRsvpStateFrom(it) }
        }
        assertEquals(
            InvitationPresentationState.entries.size * RSVPStatus.entries.size,
            combinations.size
        )
        // Specifically: a returning confirmed guest starts CLOSED, like everyone else.
        val confirmedClosed = InvitationPresentationState.CLOSED to
            ivoryRsvpStateFrom(RSVPStatus.ATTENDING)
        assertEquals(IvoryRsvpAnswer.ATTENDING, confirmedClosed.second.answer)
        assertEquals(InvitationPresentationState.CLOSED, confirmedClosed.first)
    }

    /** An answered guest is never asked again, whichever way they answered. */
    @Test
    fun anAnsweredGuestIsNeverAskedAgain() {
        assertTrue(ivoryRsvpStateFrom(RSVPStatus.PENDING).awaitsResponse)
        assertFalse(ivoryRsvpStateFrom(RSVPStatus.ATTENDING).awaitsResponse)
        assertFalse(ivoryRsvpStateFrom(RSVPStatus.DECLINED).awaitsResponse)
    }

    /** A declined guest keeps the invitation and never gets a pass. */
    @Test
    fun aDeclinedGuestNeverGetsAPass() {
        assertFalse(ivoryRsvpStateFrom(RSVPStatus.DECLINED).offersPass)
        assertFalse(ivoryRsvpStateFrom(RSVPStatus.PENDING).offersPass)
        assertTrue(ivoryRsvpStateFrom(RSVPStatus.ATTENDING).offersPass)
    }

    /** Attending and declined are distinguishable outcomes, not one "answered" state. */
    @Test
    fun theTwoAnsweredStatesAreDistinguishable() {
        val attending = ivoryRsvpStateFrom(RSVPStatus.ATTENDING)
        val declined = ivoryRsvpStateFrom(RSVPStatus.DECLINED)
        assertNotEquals(attending.answer, declined.answer)
        assertNotEquals(attending.statusLabel, declined.statusLabel)
        assertNotNull(attending.statusLabel)
        assertNotNull(declined.statusLabel)
        assertNull(ivoryRsvpStateFrom(RSVPStatus.PENDING).statusLabel)
    }
}
