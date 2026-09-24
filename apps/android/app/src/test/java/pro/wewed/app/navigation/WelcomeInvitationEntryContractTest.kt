package pro.wewed.app.navigation

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pins the welcome-screen Guest door to the Guest identity domain.
 *
 * The regression this guards against wired "I Have an Invitation" directly to SIGN_IN even though
 * invitation credentials are guest-entry authority and never require an account.
 */
class WelcomeInvitationEntryContractTest {
    private fun rootScreenSource(): String {
        val relative = "apps/android/app/src/main/java/pro/wewed/app/ui/RootScreen.kt"
        val moduleRelative = "app/src/main/java/pro/wewed/app/ui/RootScreen.kt"
        var cursor: File? = File(System.getProperty("user.dir"))
        while (cursor != null) {
            val repoCandidate = File(cursor, relative)
            if (repoCandidate.isFile) return repoCandidate.readText()
            val moduleCandidate = File(cursor, moduleRelative)
            if (moduleCandidate.isFile) return moduleCandidate.readText()
            cursor = cursor.parentFile
        }
        error("Unable to locate RootScreen.kt")
    }

    @Test
    fun invitationWelcomeDoorNeverRoutesToAccountSignIn() {
        val source = rootScreenSource()
        assertTrue(source.contains("onOpenInvitation = { showingInvitationHelp = true }"))
        assertFalse(source.contains("onOpenInvitation = { authMode = AuthenticationMode.SIGN_IN }"))
        assertTrue(source.contains("InvitationLinkEntryScreen(onBack ="))
    }
}
