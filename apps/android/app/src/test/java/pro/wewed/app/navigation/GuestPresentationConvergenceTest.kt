package pro.wewed.app.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import pro.wewed.app.invitation.GuestCapabilityPolicy
import pro.wewed.app.ui.invitation.GuestSection
import java.io.File

/**
 * NM 02 contract: presentation may converge on the qualified Wewed UI, but Guest authority,
 * state-machine semantics and the canonical WW2 Pass must not broaden or fork.
 */
class GuestPresentationConvergenceTest {
    private fun repositoryFile(path: String): File {
        var dir: File? = File(System.getProperty("user.dir") ?: ".").absoluteFile
        while (dir != null) {
            val candidate = File(dir, path)
            if (candidate.isFile) return candidate
            dir = dir.parentFile
        }
        throw IllegalStateException("Repository file not found: $path")
    }

    @Test
    fun guestNavigationRemainsExactlyFiveDestinations() {
        assertEquals(
            listOf("Home", "Invitation", "Pass", "Wedding Day", "More"),
            GuestSection.entries.map { it.label }
        )
    }

    @Test
    fun pendingGateAndAnsweredAccessRemainUnchanged() {
        assertFalse(GuestCapabilityPolicy.mayEnterPersistentExperience(null))
        assertTrue(GuestCapabilityPolicy.mayEnterPersistentExperience(true))
        assertTrue(GuestCapabilityPolicy.mayEnterPersistentExperience(false))
    }

    @Test
    fun guestShellReusesQualifiedPresentationWithoutCoupleRepositoryAuthority() {
        val source = repositoryFile(
            "apps/android/app/src/main/java/pro/wewed/app/ui/invitation/LiveGuestShell.kt"
        ).readText()

        assertTrue(source.contains("IASectionList"))
        assertTrue(source.contains("IACard"))
        assertTrue(source.contains("WeddingBrandMark()"))
        assertTrue(source.contains("R.drawable.hero_wedding"))
        assertTrue(source.contains("WeddingReferencePassScreen"))
        assertTrue(source.contains("GuestSection.PASS && profile.attending == true"))
        assertTrue(source.contains("No venue admission pass is currently issued"))

        listOf(
            "WeddingGraphState",
            "AppViewModel",
            "SessionViewModel",
            "scopedRepository(",
            "getBudget(",
            "getTasks(",
            "getGuests(",
            "getVendors("
        ).forEach { forbidden ->
            assertFalse("Live Guest must not bind Couple authority via $forbidden", source.contains(forbidden))
        }

        assertFalse("Live Guest must not introduce another QR renderer", source.contains("QRCodeWriter"))
        assertFalse("Live Guest must not introduce another QR renderer", source.contains("WeddingQRCodeView("))
    }

    @Test
    fun invitationKeepsCanonicalIvoryFullRsvpAndAuthoritativeNote() {
        val source = repositoryFile(
            "apps/android/app/src/main/java/pro/wewed/app/ui/invitation/LiveGuestInvitationScreen.kt"
        ).readText()

        assertTrue(source.contains("NativeInvitationExperience("))
        assertTrue(source.contains("presentation.invitationCardMessage"))
        assertTrue(source.contains("WeddingOrnamentBackdrop"))
        assertTrue(source.contains("WeddingBrandMark()"))
        assertTrue(source.contains("GuestRsvpUpdate("))

        listOf(
            "attending = accepting",
            "mealChoice = if (accepting)",
            "plusOne = if (accepting)",
            "plusOneName = if (accepting && plusOne)",
            "plusOneMeal = if (accepting && plusOne)",
            "kidsAttending = if (accepting && !adultsOnly)",
            "kidsCount = if (accepting && !adultsOnly && kidsAttending)",
            "dietaryNotes = if (accepting)",
            "message = message.trim()"
        ).forEach { field ->
            assertTrue("Full RSVP contract lost field: $field", source.contains(field))
        }
    }

    @Test
    fun invitationReopensThroughLiveIvoryInsteadOfShadowOrWebview() {
        val shell = repositoryFile(
            "apps/android/app/src/main/java/pro/wewed/app/ui/invitation/GuestOnlyInvitationShell.kt"
        ).readText()
        val invitation = repositoryFile(
            "apps/android/app/src/main/java/pro/wewed/app/ui/invitation/LiveGuestInvitationScreen.kt"
        ).readText()

        assertTrue(shell.contains("LiveGuestInvitationScreen("))
        assertTrue(shell.contains("GuestSection.INVITATION"))
        assertTrue(invitation.contains("NativeInvitationExperience("))
        assertFalse(shell.contains("WeddingRepository"))
        assertFalse(invitation.contains("WebView"))
    }
}
