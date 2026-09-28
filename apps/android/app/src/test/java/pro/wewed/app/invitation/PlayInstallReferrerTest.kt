package pro.wewed.app.invitation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * QRO07-AT01 — the Play install referrer resumes only the opaque one-time invitation handoff.
 */
class PlayInstallReferrerTest {

    private val secret = "A".repeat(21) + "b-_" + "c".repeat(19) // 43 base64url characters

    @Test
    fun `an opaque handoff from Play resumes that invitation`() {
        val entry = PlayInstallReferrer.resolve("handoff=$secret&utm_source=wewed")
        assertEquals(secret, entry?.secret)
    }

    @Test
    fun `an organic install or foreign referrer resumes nothing`() {
        assertNull(PlayInstallReferrer.resolve(null))
        assertNull(PlayInstallReferrer.resolve(""))
        assertNull(PlayInstallReferrer.resolve("utm_source=google-play&utm_medium=organic"))
    }

    @Test
    fun `a referrer carrying a raw RSVP credential is refused, never used`() {
        assertNull(PlayInstallReferrer.resolve("rsvp=private-token&handoff=$secret"))
        assertNull(PlayInstallReferrer.resolve("rsvp=private-token"))
    }

    @Test
    fun `a tampered or malformed handoff resumes nothing`() {
        assertNull(PlayInstallReferrer.resolve("handoff=short"))
        assertNull(PlayInstallReferrer.resolve("handoff=${secret}x"))
        assertNull(PlayInstallReferrer.resolve("handoff=${secret.dropLast(1)}!"))
    }

    @Test
    fun `the release app actually reads the Play install referrer on first launch`() {
        // Guards the shipping blocker found in QRO07-AT01: the parser existed but nothing called it.
        val root = listOf(File("app"), File(".")).first { File(it, "build.gradle.kts").exists() }
        val gradle = File(root, "build.gradle.kts").readText()
        assertTrue(gradle.contains("com.android.installreferrer:installreferrer"))
        val activity = File(root, "src/main/java/pro/wewed/app/MainActivity.kt").readText()
        assertTrue(activity.contains("PlayInstallReferrer.isPending(applicationContext)"))
        assertTrue(activity.contains("PlayInstallReferrer.fetchOnce(applicationContext)"))
        assertTrue(activity.contains("if (hasInvitation) PlayInstallReferrer.markConsumed(applicationContext)"))
    }
}
