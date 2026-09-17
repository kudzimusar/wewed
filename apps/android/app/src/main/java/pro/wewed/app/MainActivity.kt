package pro.wewed.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.state.SessionViewModel
import pro.wewed.app.theme.WewedTheme
import pro.wewed.app.ui.RootScreen

class MainActivity : ComponentActivity() {
    private val sessionViewModel = SessionViewModel()
    private val appViewModel = AppViewModel()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            WewedTheme {
                RootScreen(
                    sessionViewModel = sessionViewModel,
                    appViewModel = appViewModel
                )
            }
        }
    }
}
