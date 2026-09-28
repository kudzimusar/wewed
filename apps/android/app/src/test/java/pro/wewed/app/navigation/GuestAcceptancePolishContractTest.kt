package pro.wewed.app.navigation

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GuestAcceptancePolishContractTest {
    private fun source(relative: String): String {
        var dir: File? = File(System.getProperty("user.dir") ?: ".").absoluteFile
        while (dir != null) {
            for (candidate in listOf(
                File(dir, "app/src/main/java/$relative"),
                File(dir, "src/main/java/$relative"),
                File(dir, "apps/android/app/src/main/java/$relative"),
            )) {
                if (candidate.isFile) return candidate.readText()
            }
            dir = dir.parentFile
        }
        error("$relative not found")
    }

    @Test
    fun featureRoute401CannotEraseGuestIdentity() {
        val text = source("pro/wewed/app/invitation/GuestSessionClient.kt")
        assertTrue(text.contains("clearSessionOnUnauthorized: Boolean = false"))
        assertTrue(text.contains("status == 401 && clearSessionOnUnauthorized"))
        assertTrue(text.contains("clearSessionOnUnauthorized = true"))
    }

    @Test
    fun calendarInsertDoesNotForceANextDayEnd() {
        val text = source("pro/wewed/app/ui/invitation/LiveGuestInvitationScreen.kt")
        assertTrue(text.contains("EXTRA_EVENT_ALL_DAY"))
        assertTrue(text.contains("EXTRA_EVENT_BEGIN_TIME"))
        assertFalse(text.contains("EXTRA_EVENT_END_TIME"))
    }

    @Test
    fun envelopeMonogramFallbackMatchesThePassAndWebForm() {
        for (file in listOf(
            "pro/wewed/app/ui/invitation/LiveGuestInvitationScreen.kt",
            "pro/wewed/app/ui/invitation/NativeInvitationExperience.kt",
        )) {
            val text = source(file)
            assertTrue(file, text.contains(".joinToString(\"&\")"))
            assertFalse(file, text.contains("firstOrNull()?.uppercase() }\n            .joinToString(\" \")"))
        }
    }

    @Test
    fun emptyCoupleNoteHasNoDeadAffordanceAndTransientPassFailureCanRetry() {
        val ivory = source("pro/wewed/app/ui/invitation/ivory/IvoryFloralGoldNative.kt")
        assertTrue(ivory.contains("if (actions.onNote != null)"))
        // The note card is baked into the artwork; hiding the text alone left a dead-looking card.
        assertTrue(ivory.contains("else R.drawable.ivory_details_surface_no_note"))
        val shell = source("pro/wewed/app/ui/invitation/LiveGuestShell.kt")
        assertTrue(shell.contains("wedding-pass-retry"))
        assertTrue(shell.contains("Text(\"Try again\")"))
    }

    @Test
    fun childrenAttendingNeverSavesAZeroCount() {
        val text = source("pro/wewed/app/ui/invitation/LiveGuestInvitationScreen.kt")
        assertTrue(text.contains("if (it && kidsCount < 1) kidsCount = 1"))
        assertTrue(text.contains("kidsAttending) kidsCount.coerceAtLeast(1) else null"))
        assertTrue(text.contains("\"Number of children\""))
    }

    @Test
    fun declinedGuestSeesNoAttendanceOnlyArrivalOrPartyWording() {
        val shell = source("pro/wewed/app/ui/invitation/LiveGuestShell.kt")
        assertTrue(shell.contains("if (showsTable || GuestCapability.CHECK_IN_STATE in capabilities) {"))
        assertTrue(shell.contains("if (profile.attending == true) \"Your wedding party\" else \"Not attending\""))
    }

    @Test
    fun profileMealIsReadableAndIncludesThePlusOne() {
        val shell = source("pro/wewed/app/ui/invitation/LiveGuestShell.kt")
        assertTrue(shell.contains("profile.mealChoice?.takeIf { it.isNotBlank() }\n                ?.replaceFirstChar { it.titlecase() }"))
        assertTrue(shell.contains("profile.plusOneMeal?.takeIf { it.isNotBlank() && profile.plusOne }"))
    }
}
