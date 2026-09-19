package pro.wewed.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.services.ShadowAccount
import pro.wewed.app.state.NativeLaunchConfiguration

class NativeLaunchConfigurationTest {
    @Test
    fun defaultIsDeterministicallySanitizedNeverImplicitPrivate() {
        // Private real data must be requested explicitly, even when a snapshot exists on this machine.
        val config = NativeLaunchConfiguration.resolve(null, null)
        assertEquals(NativeDataEnvironment.SANITIZED_SHADOW, config.environment)
        assertNull(config.baseUrl)
        assertEquals(ShadowAccount.COUPLE, config.shadowAccount)
        assertNull(config.invitationToken)
    }

    @Test
    fun shadowAccountAndInvitationTokenParsing() {
        val guest = NativeLaunchConfiguration.resolve("private_real_shadow", null, "guest", "  shadow-pending-guest ")
        assertEquals(ShadowAccount.GUEST, guest.shadowAccount)
        assertEquals("shadow-pending-guest", guest.invitationToken)

        assertEquals(ShadowAccount.COUPLE_AND_PLANNER, NativeLaunchConfiguration.resolve(null, null, "couple-planner").shadowAccount)
        // Unknown account strings never grant a broader role; they fall back to the wedding owner.
        assertEquals(ShadowAccount.COUPLE, NativeLaunchConfiguration.resolve(null, null, "superuser").shadowAccount)
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
}
