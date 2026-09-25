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
    fun nm03GuestTabsHaveDistinctResponsibilities() {
        val source = repositoryFile(
            "apps/android/app/src/main/java/pro/wewed/app/ui/invitation/LiveGuestShell.kt"
        ).readText()

        fun section(start: String, end: String): String =
            source.substringAfter(start).substringBefore(end)

        val home = section("private fun LiveGuestHome(", "private fun LiveGuestHero(")
        assertTrue(home.contains("Directions to Venue"))
        assertTrue(home.contains("guest-home-pass"))
        assertTrue(home.contains("guest-home-digital-invitation"))
        assertTrue(home.contains("guest-home-next-programme"))
        assertTrue(home.contains("guest-home-announcement"))
        listOf("\"Meal\"", "\"Dietary / access\"", "\"Your message\"", "\"Your table\"").forEach {
            assertFalse("Home must not become Profile again via $it", home.contains(it))
        }

        val weddingDay = section("private fun LiveGuestWeddingDay(", "private fun LiveGuestMore(")
        val programme = weddingDay.indexOf("GuestSectionHeading(\"Programme\"")
        val venue = weddingDay.indexOf("GuestSectionHeading(\"Venue & directions\"")
        val announcements = weddingDay.indexOf("GuestSectionHeading(\"Announcements\"")
        val arrival = weddingDay.indexOf("GuestSectionHeading(\"Arrival\"")
        assertTrue(programme >= 0 && venue > programme && announcements > venue && arrival > announcements)

        val more = section("private fun LiveGuestMore(", "private fun GuestSectionHeading(")
        listOf("Our Story", "Couple Website", "Gift & Contribution Info", "Help", "Privacy & Legal",
            "My details", "This device").forEach {
            assertTrue("More is missing $it", more.contains(it))
        }
        listOf("\"Meal\"", "\"Plus one\"", "\"Dietary / access\"", "\"Your message\"", "\"Table\"").forEach {
            assertFalse("More must not lead with profile duplication via $it", more.contains(it))
        }
    }

    @Test
    fun nm03GuestActionsUseWewedPaletteAndNoAlternateAuthority() {
        val invitation = repositoryFile(
            "apps/android/app/src/main/java/pro/wewed/app/ui/invitation/LiveGuestInvitationScreen.kt"
        ).readText()
        val shell = repositoryFile(
            "apps/android/app/src/main/java/pro/wewed/app/ui/invitation/LiveGuestShell.kt"
        ).readText()

        listOf(invitation, shell).forEach { source ->
            assertFalse(source.contains("WewedColors.Emerald"))
            assertFalse(source.contains("WeddingGraphState"))
            assertFalse(source.contains("QRCodeWriter"))
            assertFalse(source.contains("WeddingQRCodeView("))
        }
        assertTrue(invitation.contains("WeddingIdentityPalette.ChampagneDeep"))
        assertTrue(shell.contains("WeddingIdentityPalette.ChampagneDeep"))
        assertTrue(shell.contains("Directions to Venue"))
        assertTrue(shell.contains("WeddingReferencePassScreen"))
        assertTrue(shell.contains("Update RSVP in Invitation"))
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
