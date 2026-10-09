package pro.wewed.app.invitation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Agent A v16 regression: historical /w/<slug>?rsvp=... personal links are still claimed by the
 * release manifest, so native must converge them before generic wedding/account routing can win.
 */
class LegacyPersonalInvitationEntryTest {

    @Test
    fun `legacy personal invitation app link resolves to the canonical private invitation entry`() {
        val entry = InvitationEntryParser.fromUrl(
            "https://wewed.pro/w/charity-and-kudzie?rsvp=legacy-private-token"
        )

        assertTrue(entry is InvitationEntry.PrivateInvitation)
        entry as InvitationEntry.PrivateInvitation
        assertEquals("charity-and-kudzie", entry.weddingSlug)
        assertEquals("legacy-private-token", entry.rsvpToken)
    }

    @Test
    fun `legacy personal invitation outranks a stale bridge extra`() {
        val staleHandoff = "A".repeat(43)
        val entry = InvitationEntryParser.fromLaunch(
            "https://wewed.pro/w/example-wedding?rsvp=current-private-token",
            staleHandoff
        )

        assertTrue(entry is InvitationEntry.PrivateInvitation)
        entry as InvitationEntry.PrivateInvitation
        assertEquals("example-wedding", entry.weddingSlug)
        assertEquals("current-private-token", entry.rsvpToken)
    }

    @Test
    fun `ordinary legacy wedding link without RSVP authority is not reclassified as invitation entry`() {
        assertNull(InvitationEntryParser.fromUrl("https://wewed.pro/w/example-wedding"))
    }

    @Test
    fun `legacy invitation on a foreign host is ignored`() {
        assertNull(
            InvitationEntryParser.fromUrl(
                "https://attacker.example/w/example-wedding?rsvp=private-token"
            )
        )
    }

    @Test
    fun `release manifest still claims legacy wedding app links so parser coverage is required`() {
        val root = listOf(File("app"), File(".")).first { File(it, "build.gradle.kts").exists() }
        val manifest = File(root, "src/main/AndroidManifest.xml").readText()

        assertTrue(manifest.contains("android:host=\"wewed.pro\""))
        assertTrue(manifest.contains("android:pathPrefix=\"/w/\""))
    }
}
