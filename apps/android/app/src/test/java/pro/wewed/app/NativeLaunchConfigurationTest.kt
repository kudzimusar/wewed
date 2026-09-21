package pro.wewed.app

import org.junit.Assert.assertNull
import org.junit.Assert.*
import org.junit.Test
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.state.NativeLaunchConfiguration

class NativeLaunchConfigurationTest {
    @Test
    fun defaultNeverSilentlyUsesFixture() {
        val config = NativeLaunchConfiguration.resolve(null, null)
        assertTrue(config.environment == NativeDataEnvironment.PRIVATE_REAL_SHADOW || config.environment == NativeDataEnvironment.SANITIZED_SHADOW)
        assertNull(config.baseUrl)
    }

    @Test
    fun fixtureRequiresExplicitSelection() {
        val config = NativeLaunchConfiguration.resolve("fixture", null)
        assertEquals(NativeDataEnvironment.FIXTURE, config.environment)
    }

    @Test
    fun shadowUsesExplicitBaseUrl() {
        val config = NativeLaunchConfiguration.resolve("shadow", "http://127.0.0.1:8787")
        assertEquals(NativeDataEnvironment.SHADOW, config.environment)
        assertEquals("http://127.0.0.1:8787", config.baseUrl)
    }

    @Test
    fun productionStringDoesNotSilentlyDowngrade() {
        val config = NativeLaunchConfiguration.resolve("production", null)
        assertEquals(NativeDataEnvironment.PRODUCTION, config.environment)
    }

    @Test
    fun sanitizedAndPrivateRealShadowParsing() {
        val sanitized = NativeLaunchConfiguration.resolve("sanitized_shadow", null)
        assertEquals(NativeDataEnvironment.SANITIZED_SHADOW, sanitized.environment)

        val privateReal = NativeLaunchConfiguration.resolve("private_real_shadow", null)
        assertEquals(NativeDataEnvironment.PRIVATE_REAL_SHADOW, privateReal.environment)
    }

    /**
     * An ordinary launch must not depend on a qualification artefact.
     *
     * This is the defect the UAT qualification found: the resolver checked whether the Private
     * Real Shadow snapshot existed on disk and silently selected that environment when it did. The
     * guest invitation journey — an App Link from Chrome, a tap in WhatsApp — therefore changed
     * data source depending on a file, and surfaced "Private Real Shadow is not available" in the
     * middle of an ordinary invitation when that file could not be read.
     */
    @Test
    fun anOrdinaryLaunchNeverSelectsPrivateRealShadow() {
        listOf(null, "", "   ", "unrecognised-environment").forEach { raw ->
            val resolved = NativeLaunchConfiguration.resolve(
                rawEnvironment = raw,
                shadowBaseUrl = null,
                isDebugBuild = true
            )
            assertNotEquals(
                "an ordinary launch must not open Private Real Shadow",
                NativeDataEnvironment.PRIVATE_REAL_SHADOW,
                resolved.environment
            )
            assertEquals(NativeDataEnvironment.SANITIZED_SHADOW, resolved.environment)
        }
    }

    /** Private Real Shadow is a qualification configuration, entered only when asked for. */
    @Test
    fun privateRealShadowRequiresAnExplicitRequest() {
        listOf("private", "private_shadow", "private-real-shadow", "private_real_shadow").forEach {
            assertEquals(
                NativeDataEnvironment.PRIVATE_REAL_SHADOW,
                NativeLaunchConfiguration.resolve(it, null, isDebugBuild = true).environment
            )
        }
    }

    /**
     * A release build with no environment named falls through to production, which the repository
     * factory refuses. Refusing to start is correct for a release build with no live data path;
     * silently showing a real guest demo data is not.
     */
    @Test
    fun aReleaseBuildNeverSilentlyFallsBackToDemoData() {
        val resolved = NativeLaunchConfiguration.resolve(
            rawEnvironment = null,
            shadowBaseUrl = null,
            isDebugBuild = false
        )
        assertEquals(NativeDataEnvironment.PRODUCTION, resolved.environment)
        assertFalse(
            "a release build must not open a development data environment",
            resolved.environment.allowsMutableNativeDevelopment
        )
    }
}
