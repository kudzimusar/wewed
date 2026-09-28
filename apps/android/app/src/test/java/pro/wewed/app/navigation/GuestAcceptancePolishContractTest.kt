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
    fun emptyCoupleNoteHasNoDeadAffordanceAndTransientPassFailureCanRetry() {
        val ivory = source("pro/wewed/app/ui/invitation/ivory/IvoryFloralGoldNative.kt")
        assertTrue(ivory.contains("if (actions.onNote != null)"))
        // The note card is baked into the artwork; hiding the text alone left a dead-looking card.
        assertTrue(ivory.contains("else R.drawable.ivory_details_surface_no_note"))
        val shell = source("pro/wewed/app/ui/invitation/LiveGuestShell.kt")
        assertTrue(shell.contains("wedding-pass-retry"))
        assertTrue(shell.contains("Text(\"Try again\")"))
    }
}
