package pro.wewed.app

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
            shadowBaseUrl = intent.getStringExtra(EXTRA_SHADOW_BASE_URL),
            rawAccount = intent.getStringExtra(EXTRA_SHADOW_ACCOUNT),
            invitationToken = intent.getStringExtra(EXTRA_INVITATION_TOKEN)
        )
        val appViewModel = AppViewModel.fromEnvironment(
            environment = launch.environment,
            baseUrl = launch.baseUrl
        )

        setContent {
            WewedTheme {
                RootScreen(
                    sessionViewModel = sessionViewModel,
                    appViewModel = appViewModel,
                    launch = launch
                )
            }
        }
    }

    companion object {
        const val EXTRA_NATIVE_ENV = "wewed_native_env"
        const val EXTRA_SHADOW_BASE_URL = "wewed_shadow_base_url"
        const val EXTRA_SHADOW_ACCOUNT = "wewed_shadow_account"
        const val EXTRA_INVITATION_TOKEN = "wewed_invitation_token"
    }
}
