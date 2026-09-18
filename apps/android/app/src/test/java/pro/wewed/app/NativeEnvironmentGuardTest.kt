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
    fun shadowAcceptsLocalhost() {
        NativeEnvironmentGuard.validate("http://127.0.0.1:8787", NativeDataEnvironment.SHADOW)
    }

    @Test(expected = NativeEnvironmentGuardError.ProductionDisabled::class)
    fun productionRuntimeIsDisabledDuringShadowSprint() {
        NativeEnvironmentGuard.validate("https://wewed.pro", NativeDataEnvironment.PRODUCTION)
    }
}
