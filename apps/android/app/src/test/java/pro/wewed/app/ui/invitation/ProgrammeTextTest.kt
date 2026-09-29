package pro.wewed.app.ui.invitation

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Final C&K UAT (2026-09-29): a JSON-null location rendered as the text "null" on Wedding Day. */
class ProgrammeTextTest {
    private val item = JSONObject(
        """{"id":"p1","time":"13:00","title":"Guest Arrival","location":null,
            "description":"Welcome drinks and canapés at Imba Manor gardens","blank":"  "}"""
    )

    @Test fun jsonNullIsAbsentNotTheWordNull() {
        assertNull(item.programmeText("location"))
        assertNull(item.programmeText("missing"))
        assertNull(item.programmeText("blank"))
        assertEquals("13:00", item.programmeText("time"))
    }

    @Test fun descriptionIsTheFallbackSubtitleLikeTheWebsite() {
        assertEquals(
            "Welcome drinks and canapés at Imba Manor gardens",
            item.programmeText("location") ?: item.programmeText("description")
        )
    }

    @Test fun theWeddingDayScreenNeverReadsLocationThroughOptString() {
        val shell = java.io.File(
            listOf("app/src/main/java", "src/main/java").map { java.io.File(it) }.first { it.exists() },
            "pro/wewed/app/ui/invitation/LiveGuestShell.kt"
        ).readText()
        assertEquals(false, shell.contains("optString(\"location\")"))
    }
}

/** Owner decision (final C&K UAT 2026-09-29): a keepsake QR in the Guest's name before the Pass opens. */
class GuestPassKeepsakeContractTest {
    private val shell = java.io.File(
        listOf("app/src/main/java", "src/main/java").map { java.io.File(it) }.first { it.exists() },
        "pro/wewed/app/ui/invitation/LiveGuestShell.kt"
    ).readText()
    private val keepsake = shell.substring(shell.indexOf("private fun GuestPassComingSoon("), shell.indexOf("internal fun org.json.JSONObject.programmeText"))

    @Test fun keepsakeEncodesOnlyTheWeddingPageNeverACredential() {
        org.junit.Assert.assertTrue(keepsake.contains("guestWebUrl(\"/w/\${profile.weddingSlug}\")"))
        for (forbidden in listOf("rsvp", "token", "credential =", "weddingPass(")) {
            org.junit.Assert.assertFalse("keepsake must not use $forbidden", keepsake.contains(forbidden, ignoreCase = false))
        }
    }

    @Test fun keepsakeIsLabelledAndNeverThePassQr() {
        org.junit.Assert.assertTrue(keepsake.contains("pro.wewed.app.ui.qr.WewedQrCode("))
        org.junit.Assert.assertTrue(keepsake.contains("Invitation keepsake · not your venue pass"))
        org.junit.Assert.assertFalse(keepsake.contains("wedding-pass-qr"))
        org.junit.Assert.assertFalse(keepsake.contains("WeddingQrCode("))
        org.junit.Assert.assertTrue(shell.contains("availability?.state == pro.wewed.app.models.WeddingPassAvailabilityState.NOT_YET_ISSUABLE"))
    }
}
