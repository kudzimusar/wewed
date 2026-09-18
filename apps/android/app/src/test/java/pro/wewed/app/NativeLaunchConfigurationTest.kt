package pro.wewed.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.state.NativeLaunchConfiguration

class NativeLaunchConfigurationTest {
    @Test
    fun defaultsToFixture() {
        val config = NativeLaunchConfiguration.resolve(null, null)
        assertEquals(NativeDataEnvironment.FIXTURE, config.environment)
        assertNull(config.baseUrl)
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
