package pro.wewed.app.navigation

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Phase 13 release contract: HTTPS App Link ownership must match the native parser's
 * deliberately supported public/workspace routes without intercepting the server-owned
 * physical-invitation QR resolver.
 *
 * DeepLinkRouter remains the authority boundary; manifest ownership only selects Wewed
 * as the URL handler and never grants access to a workspace.
 */
class ReleaseAppLinkManifestContractTest {

    private fun manifestFile(): File {
        var dir: File? = File(System.getProperty("user.dir") ?: ".").absoluteFile
        while (dir != null) {
            val candidate = File(dir, "apps/android/app/src/main/AndroidManifest.xml")
            if (candidate.isFile) return candidate

            val appRelative = File(dir, "app/src/main/AndroidManifest.xml")
            if (appRelative.isFile) return appRelative

            dir = dir.parentFile
        }
        throw IllegalStateException(
            "AndroidManifest.xml not found from ${System.getProperty("user.dir")}"
        )
    }

    @Test
    fun `release manifest claims the approved wewed pro app link surface`() {
        val manifest = manifestFile().readText()

        assertTrue(manifest.contains("""android:autoVerify="true""""))
        assertTrue(manifest.contains("""android:scheme="https" android:host="wewed.pro""""))

        listOf(
            """android:pathPrefix="/invite/"""",
            """android:path="/pass"""",
            """android:pathPrefix="/pass/"""",
            """android:pathPrefix="/w/"""",
            """android:pathPrefix="/planner/"""",
            """android:pathPrefix="/vendor/"""",
            """android:pathPrefix="/gate/"""",
            """android:pathPrefix="/wedding/"""",
        ).forEach { expected ->
            assertTrue("Missing release App Link declaration: $expected", manifest.contains(expected))
        }
    }

    @Test
    fun `release manifest never intercepts the server owned physical invitation resolver`() {
        val manifest = manifestFile().readText()
        assertFalse(manifest.contains("""android:pathPrefix="/i/""""))
        assertFalse(manifest.contains("""android:path="/i""""))
    }

    @Test
    fun `release manifest does not claim admin as a browser universal route`() {
        val manifest = manifestFile().readText()
        assertFalse(manifest.contains("""android:pathPrefix="/admin/""""))
        assertFalse(manifest.contains("""android:path="/admin""""))
    }
}
