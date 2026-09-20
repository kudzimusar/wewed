package pro.wewed.app

import android.content.Intent
import android.os.Bundle
import android.graphics.Color
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.core.view.WindowCompat
import pro.wewed.app.models.DevelopmentPersona
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.state.NativeLaunchConfiguration
import pro.wewed.app.state.SessionViewModel
import pro.wewed.app.theme.WewedTheme
import pro.wewed.app.ui.RootScreen
import pro.wewed.app.ui.entry.NativeEnvironmentUnavailableScreen

@OptIn(ExperimentalComposeUiApi::class)
class MainActivity : ComponentActivity() {
    private val sessionViewModel = SessionViewModel()
    private lateinit var appViewModel: AppViewModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.statusBarColor = Color.rgb(251, 247, 239)
        window.navigationBarColor = Color.rgb(255, 253, 248)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = true
        }

        val launch = NativeLaunchConfiguration.resolve(
            rawEnvironment = intent.getStringExtra(EXTRA_NATIVE_ENV),
            shadowBaseUrl = intent.getStringExtra(EXTRA_SHADOW_BASE_URL)
        )
        // A missing protected snapshot must not take the process down. The app refuses to fall
        // back to demo data — that refusal is the point — but it says so on screen instead of
        // disappearing back to the launcher with no explanation.
        val resolved = AppViewModel.fromEnvironmentOrNull(
            environment = launch.environment,
            baseUrl = launch.baseUrl
        )
        if (resolved == null) {
            val reason = AppViewModel.lastEnvironmentFailure
                ?: "This data environment could not be opened."
            setContent {
                WewedTheme {
                    Box(modifier = Modifier.semantics { testTagsAsResourceId = true }) {
                        NativeEnvironmentUnavailableScreen(
                            environmentName = launch.environment.displayName,
                            reason = reason
                        )
                    }
                }
            }
            return
        }
        appViewModel = resolved
        appViewModel.handleIncomingUrl(intent?.dataString)

        // Development/Shadow qualification only (P0-16): lets automated role traversal start as a
        // specific authorized persona. Ignored entirely in production and production-read-verify.
        if (launch.environment.allowsDevelopmentPersonaSwitching) {
            intent.getStringExtra(EXTRA_NATIVE_PERSONA)
                ?.let { requested -> DevelopmentPersona.allPersonas.firstOrNull { it.id == requested } }
                ?.let { sessionViewModel.switchPersona(it) }
        }

        setContent {
            WewedTheme {
                // testTagsAsResourceId was applied deep inside the authenticated tree, so the
                // splash, welcome and sign-in surfaces exposed no test ids at all — a UI flow
                // could see their text but could not address a single control on them. Set once
                // at the root, it propagates to every surface including the entry ones.
                Box(modifier = Modifier.semantics { testTagsAsResourceId = true }) {
                    RootScreen(
                        sessionViewModel = sessionViewModel,
                        appViewModel = appViewModel
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (::appViewModel.isInitialized) {
            appViewModel.handleIncomingUrl(intent.dataString)
        }
    }

    companion object {
        const val EXTRA_NATIVE_ENV = "wewed_native_env"
        const val EXTRA_SHADOW_BASE_URL = "wewed_shadow_base_url"
        const val EXTRA_NATIVE_PERSONA = "wewed_native_persona"
    }
}
