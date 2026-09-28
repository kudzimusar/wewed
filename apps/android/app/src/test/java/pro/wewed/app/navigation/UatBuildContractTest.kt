package pro.wewed.app.navigation

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pins the emulator UAT variant to production-like runtime behavior without using the Play package.
 */
class UatBuildContractTest {
    private fun buildGradleSource(): String {
        val relative = "apps/android/app/build.gradle.kts"
        var cursor: File? = File(System.getProperty("user.dir"))
        while (cursor != null) {
            val candidate = File(cursor, relative)
            if (candidate.isFile) return candidate.readText()
            val moduleCandidate = File(cursor, "app/build.gradle.kts")
            if (moduleCandidate.isFile) return moduleCandidate.readText()
            cursor = cursor.parentFile
        }
        error("Unable to locate apps/android/app/build.gradle.kts")
    }

    @Test
    fun uatVariantIsReleaseLikeButCannotUsePlayIdentity() {
        val source = buildGradleSource()
        assertTrue(source.contains("create(\"uat\")"))
        assertTrue(source.contains("initWith(getByName(\"release\"))"))
        assertTrue(source.contains("applicationIdSuffix = \".uatdev\""))
        assertTrue(source.contains("versionNameSuffix = \"-uatdev\""))
        assertTrue(source.contains("signingConfig = signingConfigs.getByName(\"debug\")"))
        assertFalse(source.contains("create(\"uat\") {\n            isDebuggable = true"))
    }
}
