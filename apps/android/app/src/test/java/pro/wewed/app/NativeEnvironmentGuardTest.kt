package pro.wewed.app

import org.junit.Assert.fail
import org.junit.Test
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.services.NativeEnvironmentGuard
import pro.wewed.app.services.NativeEnvironmentGuardError

class NativeEnvironmentGuardTest {

    @Test
    fun shadowRejectsProductionHost() {
        try {
            NativeEnvironmentGuard.validate("https://wewed.pro/api", NativeDataEnvironment.SHADOW)
            fail("Expected shadow production-host rejection")
        } catch (_: NativeEnvironmentGuardError.ShadowPointsToProductionHost) {
        }
    }

    @Test
    fun everyMutableShadowRuntimeRejectsProductionHost() {
        val environments = listOf(
            NativeDataEnvironment.SHADOW,
            NativeDataEnvironment.SANITIZED_SHADOW,
            NativeDataEnvironment.PRIVATE_REAL_SHADOW
        )

        environments.forEach { environment ->
            try {
                NativeEnvironmentGuard.validate("https://wewed.pro/api", environment)
                fail("Expected production-host rejection for $environment")
            } catch (_: NativeEnvironmentGuardError.ShadowPointsToProductionHost) {
            }
        }
    }

    @Test
    fun shadowAcceptsLocalhost() {
        NativeEnvironmentGuard.validate("http://127.0.0.1:8787", NativeDataEnvironment.SHADOW)
        NativeEnvironmentGuard.validate("http://127.0.0.1:8787", NativeDataEnvironment.SANITIZED_SHADOW)
        NativeEnvironmentGuard.validate("http://127.0.0.1:8787", NativeDataEnvironment.PRIVATE_REAL_SHADOW)
    }

    @Test
    fun productionRuntimeIsAllowedForPhase5ReadOnlyBootstrap() {
        NativeEnvironmentGuard.validate("https://wewed.pro", NativeDataEnvironment.PRODUCTION)
    }
}
