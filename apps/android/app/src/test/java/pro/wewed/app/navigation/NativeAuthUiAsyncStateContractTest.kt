package pro.wewed.app.navigation

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Sign In surface must reflect SessionViewModel's asynchronous network state, not a local flag
 * that is reset immediately after launching the coroutine.
 */
class NativeAuthUiAsyncStateContractTest {
    private fun repoFile(relative: String): String {
        var cursor: File? = File(System.getProperty("user.dir"))
        while (cursor != null) {
            val candidate = File(cursor, relative)
            if (candidate.isFile) return candidate.readText()
            cursor = cursor.parentFile
        }
        error("Unable to locate $relative")
    }

    @Test
    fun loginScreenBindsToSessionAsyncState() {
        val source = repoFile("apps/android/app/src/main/java/pro/wewed/app/ui/auth/LoginScreen.kt")
        assertTrue(source.contains("sessionViewModel.isSigningIn.collectAsState()"))
        assertTrue(source.contains("sessionViewModel.authenticationError.collectAsState()"))
        assertTrue(source.contains("validationError ?: sessionError"))
        assertTrue(source.contains("sessionViewModel.clearAuthenticationError()"))
        assertFalse(source.contains("var submitting by remember"))
        assertFalse(source.contains("submitting = false"))
    }
}
