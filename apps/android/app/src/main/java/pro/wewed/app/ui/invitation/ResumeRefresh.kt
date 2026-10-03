package pro.wewed.app.ui.invitation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver

/**
 * NATIVE-MOBILE-QRO08 — counts returns to the foreground (0 until the first *re*-entry).
 *
 * The Guest's invitation card and Wedding Day are server projections a Planner can change at any
 * time (message, RSVP deadline, children policy, programme, table, announcements). Keying a reload on
 * this count makes a Planner change appear when the Guest comes back to the app, without a rebuild,
 * a reinstall or a second native copy of that data. The initial resume is not counted: the first
 * load already happens when the screen is composed.
 */
@Composable
fun rememberForegroundReentryCount(): Int {
    val owner = LocalLifecycleOwner.current
    var count by remember(owner) { mutableIntStateOf(0) }
    DisposableEffect(owner) {
        var seenFirstResume = false
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                if (seenFirstResume) count++ else seenFirstResume = true
            }
        }
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer) }
    }
    return count
}
