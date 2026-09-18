package pro.wewed.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.state.NativeLaunchConfiguration
import pro.wewed.app.state.SessionViewModel
import pro.wewed.app.theme.WewedTheme
import pro.wewed.app.ui.RootScreen

class MainActivity : ComponentActivity() {
    private val sessionViewModel = SessionViewModel()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val launch = NativeLaunchConfiguration.resolve(
            rawEnvironment = intent.getStringExtra(EXTRA_NATIVE_ENV),
            shadowBaseUrl = intent.getStringExtra(EXTRA_SHADOW_BASE_URL)
        )
        val appViewModel = AppViewModel.fromEnvironment(
            environment = launch.environment,
            baseUrl = launch.baseUrl
        )

        setContent {
            WewedTheme {
                RootScreen(
                    sessionViewModel = sessionViewModel,
                    appViewModel = appViewModel
                )
            }
        }
    }

    companion object {
        const val EXTRA_NATIVE_ENV = "wewed_native_env"
        const val EXTRA_SHADOW_BASE_URL = "wewed_shadow_base_url"
    }
}
