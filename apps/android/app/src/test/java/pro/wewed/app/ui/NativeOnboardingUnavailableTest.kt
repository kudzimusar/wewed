package pro.wewed.app.ui

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 7 §16 — this phase reconciles the
 * server onboarding graph but does not build native onboarding. It requires proof that native's
 * existing "Create account" affordance remains a dead end: tappable, but never reaching a
 * distinct account-creation screen or a `/api/auth/register` call.
 *
 * This is a structural/source-level test, not an instrumented Compose UI test — mirroring the
 * server side's `native-account-contract.test.ts`, which pins route-shape invariants the same way.
 * Recompiling `RootScreen.kt` with a real CREATE_ACCOUNT branch, or wiring native registration
 * network code, must fail this test before it can reach a build.
 */
class NativeOnboardingUnavailableTest {

    private fun repoFile(relativePath: String): File {
        var dir: File? = File(System.getProperty("user.dir") ?: ".").absoluteFile
        while (dir != null) {
            val candidate = File(dir, relativePath)
            if (candidate.isFile) return candidate
            dir = dir.parentFile
        }
        throw IllegalStateException("Not found relative to any ancestor of user.dir: $relativePath")
    }

    private val rootScreenSource: String by lazy {
        repoFile("apps/android/app/src/main/java/pro/wewed/app/ui/RootScreen.kt").readText()
    }

    private val entryStateSource: String by lazy {
        repoFile("apps/android/app/src/main/java/pro/wewed/app/navigation/NativeAppEntryState.kt").readText()
    }

    @Test
    fun createAccountTapOnlySetsAuthModeAndNeverBranchesOnIt() {
        // The welcome screen's "Create account" affordance exists...
        assertTrue(
            "Expected WewedWelcomeScreen's onCreateAccount to set authMode = CREATE_ACCOUNT",
            rootScreenSource.contains("onCreateAccount = { authMode = AuthenticationMode.CREATE_ACCOUNT }"),
        )
        // ...but RootScreen must never read authMode back to decide what to render. The only
        // legitimate reads of `authMode` are: the welcome-screen guard (`authMode == null`) and
        // resetting it on back-navigation (`authMode = null`). Any OTHER read — a `when` on it, an
        // `if (authMode == AuthenticationMode.CREATE_ACCOUNT)`, or passing it into another
        // composable — would mean a distinct creation path now exists and this test must be
        // revisited deliberately, not silently pass.
        val illegalReads = listOf(
            "authMode == AuthenticationMode.CREATE_ACCOUNT",
            "when (authMode)",
            "when(authMode)",
        )
        for (pattern in illegalReads) {
            assertFalse(
                "RootScreen.kt now branches on CREATE_ACCOUNT ('$pattern') — native onboarding may " +
                    "have been activated. This requires a deliberate Phase 8+ decision, not a silent change.",
                rootScreenSource.contains(pattern),
            )
        }
    }

    @Test
    fun unauthenticatedStateAlwaysRendersLoginScreenRegardlessOfAuthMode() {
        // `if (!isAuthenticated) { LoginScreen(...) ; return }` must be unconditional: no
        // `authMode`-gated branch may sit between the welcome screen and this block.
        val loginBlockIndex = rootScreenSource.indexOf("if (!isAuthenticated) {")
        assertTrue("Expected an unconditional '!isAuthenticated' branch in RootScreen.kt", loginBlockIndex >= 0)
        val loginBlock = rootScreenSource.substring(loginBlockIndex, minOf(loginBlockIndex + 200, rootScreenSource.length))
        assertTrue("The !isAuthenticated branch must render LoginScreen", loginBlock.contains("LoginScreen("))
        assertFalse(
            "LoginScreen must not receive an authMode argument — it has no distinct creation UI to select",
            loginBlock.contains("authMode = AuthenticationMode") || loginBlock.contains("mode = authMode"),
        )
    }

    @Test
    fun noNativeCodeCallsTheRegistrationEndpoint() {
        val mainSourceRoot = repoFile("apps/android/app/src/main/java/pro/wewed/app/ui/RootScreen.kt")
            .parentFile?.parentFile?.parentFile?.parentFile
            ?: throw IllegalStateException("Could not resolve apps/android/app/src/main/java")
        val offenders = mainSourceRoot.walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .filter { it.readText().contains("/api/auth/register") }
            .toList()
        assertTrue(
            "No native source file should reference /api/auth/register yet (native onboarding is " +
                "not activated in this phase). Found: ${offenders.map { it.path }}",
            offenders.isEmpty(),
        )
    }

    @Test
    fun entryStateAuthenticationWrapperRemainsUnconstructedDeadCode() {
        // NativeAppEntryState.Authentication(mode) is declared but must remain unconstructed
        // anywhere in main source — if something starts building it, a second, entry-state-driven
        // creation path would exist alongside the welcome-screen affordance.
        assertTrue(
            "Expected NativeAppEntryState.Authentication to still be declared",
            entryStateSource.contains("data class Authentication(val mode: AuthenticationMode) : NativeAppEntryState()"),
        )
        val mainSourceRoot = repoFile("apps/android/app/src/main/java/pro/wewed/app/navigation/NativeAppEntryState.kt")
            .parentFile?.parentFile?.parentFile?.parentFile
            ?: throw IllegalStateException("Could not resolve apps/android/app/src/main/java")
        val constructions = mainSourceRoot.walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .filter { it.readText().contains("NativeAppEntryState.Authentication(") }
            .toList()
        assertEquals(
            "NativeAppEntryState.Authentication must remain unconstructed. Found in: ${constructions.map { it.path }}",
            0,
            constructions.size,
        )
    }
}
