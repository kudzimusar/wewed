package pro.wewed.app

import java.io.File
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import pro.wewed.app.invitation.GuestInvitationSnapshot
import pro.wewed.app.invitation.NativeParityExporter
import pro.wewed.app.invitation.NativeParityRecord
import pro.wewed.app.state.NativeServerLane
import pro.wewed.app.state.NativeServerOrigin

/**
 * QRO 01 §13–§15 — the Android wewed.parity.v1 record must be byte-compatible with the server
 * checker and iOS (`mobile/contracts/wewed-parity-v1.json`).
 */
class NativeParityRecordTest {
    @After
    fun reset() {
        NativeServerOrigin.activate(NativeServerLane.Production)
        NativeParityExporter.configure(null, null, false)
    }

    private val contract: JSONObject by lazy {
        var dir: File? = File(System.getProperty("user.dir") ?: ".").absoluteFile
        while (dir != null) {
            val candidate = File(dir, "mobile/contracts/wewed-parity-v1.json")
            if (candidate.isFile) return@lazy JSONObject(candidate.readText())
            dir = dir.parentFile
        }
        throw IllegalStateException("wewed-parity-v1 contract not found")
    }

    private fun snapshot() = GuestInvitationSnapshot(
        weddingSlug = "synthetic", title = "Synthetic Parity Wedding", monogram = null, tagline = null,
        date = "2026-12-25T09:30:00.000Z", venue = "Synthetic Hall", venueMapUrl = null, venueCity = null,
        venueCountry = null, invitationCardStyle = "ivory-floral-gold", invitationCardMessage = "Synthetic authored message",
        rsvpDeadline = null, childrenPolicy = null, guestId = "guest-1", guestName = "Synthetic Guest", email = null,
        tableNumber = 3, tableName = "Acacia", attending = true, mealChoice = "beef", plusOne = true, plusOneName = null,
        plusOneMeal = null, kidsAttending = false, kidsCount = 0, dietaryNotes = null, message = null, checkedIn = false,
        checkedInAt = null, weddingId = "wedding-1", seatingTableId = "table-1", partySize = 2
    )

    @Test
    fun digestsMatchTheServerCheckerVectors() {
        val vectors = contract.getJSONArray("textDigestVectors")
        for (i in 0 until vectors.length()) {
            val vector = vectors.getJSONObject(i)
            assertEquals(vector.getString("input"), vector.getString("digest"), NativeParityRecord.textDigest(vector.getString("input")))
        }
        val pass = contract.getJSONObject("passDigestVector")
        assertEquals(pass.getString("digest"), NativeParityRecord.sha256Hex(pass.getString("input")))
        assertNull(NativeParityRecord.textDigest("   "))
    }

    @Test
    fun guestRecordHasExactlyTheContractFieldsAndIdentity() {
        val record = NativeParityRecord.guestRecord("G", "https://wewed-x-11-11.vercel.app", "abcdef1", snapshot(), "not_yet_issuable", null, null)
        val fields = contract.getJSONArray("fields").let { a -> (0 until a.length()).map { a.getString(it) } }
        assertEquals(fields.toSet(), record.keys().asSequence().toSet())
        assertEquals("android", record.getString("client"))
        assertEquals("wedding-1", record.getString("weddingId"))
        assertEquals("guest-1", record.getString("guestId"))
        assertEquals("table-1", record.getString("tableId"))
        assertEquals(2, record.getInt("partySize"))
        assertEquals("attending", record.getString("rsvpStatus"))
        assertEquals("2026-12-25", record.getString("weddingDate"))
        assertTrue("a Guest never carries account identity", record.isNull("accessUserId"))
        assertTrue(record.isNull("passDigest"))
    }

    @Test
    fun anActivePassIsRecordedOnlyAsItsDigestNeverTheToken() {
        val token = contract.getJSONObject("passDigestVector").getString("input")
        val record = NativeParityRecord.guestRecord("G", "https://wewed-x-11-11.vercel.app", "abcdef1", snapshot(), "active", "WWSYN-001", token)
        assertEquals(contract.getJSONObject("passDigestVector").getString("digest"), record.getString("passDigest"))
        assertFalse("the raw credential must never be written", record.toString().contains("WW2."))
    }

    @Test
    fun exportIsConfigurableOnlyInThePreviewLane() {
        NativeServerOrigin.activate(NativeServerLane.Production)
        NativeParityExporter.configure("G", "abcdef1", false)
        assertNull("production lane never exports", NativeParityExporter.request)

        NativeServerOrigin.activate(NativeServerLane.ProductionPreview("https://wewed-x-11-11.vercel.app", null))
        NativeParityExporter.configure("G", "abcdef1", false)
        assertEquals(NativeParityExporter.Request("G", "abcdef1", false), NativeParityExporter.request)
        NativeParityExporter.configure("guest name", "abcdef1", false)
        assertNull("labels are anonymized codes only", NativeParityExporter.request)
    }
}
