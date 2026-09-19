package pro.wewed.app

import android.content.Intent
import android.os.Bundle
import android.graphics.Color
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.state.NativeLaunchConfiguration
import pro.wewed.app.state.SessionViewModel
import pro.wewed.app.theme.WewedTheme
import pro.wewed.app.ui.RootScreen

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
        appViewModel = AppViewModel.fromEnvironment(
            environment = launch.environment,
            baseUrl = launch.baseUrl
        )
        appViewModel.handleIncomingUrl(intent?.dataString)

        setContent {
            WewedTheme {
                RootScreen(
                    sessionViewModel = sessionViewModel,
                    appViewModel = appViewModel
                )
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
    }
}
