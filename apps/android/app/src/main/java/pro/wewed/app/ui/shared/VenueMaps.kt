package pro.wewed.app.ui.shared

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Directions
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.VenueLocation
import pro.wewed.app.services.MapsLinkBuilder
import pro.wewed.app.services.MapsLinks

/** Opens any maps app with the geo link; if none is installed, opens the web map. Returns false if nothing could open it. */
fun openInMaps(context: Context, links: MapsLinks): Boolean {
    try {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(links.geoUri)))
        return true
    } catch (_: ActivityNotFoundException) {
        // No app handles geo: links; fall back to the browser.
    }
    return openExternal(context, links.webUrl)
}

/** Opens a web, mailto or other link in another app. Returns false if no app can handle it. */
fun openExternal(context: Context, uri: String): Boolean = try {
    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(uri)))
    true
} catch (_: ActivityNotFoundException) {
    false
}

/**
 * "Open in Maps" built only from the recorded venue (spec §5). When the record has nothing usable
 * the button is replaced with "Venue location not recorded".
 */
@Composable
fun OpenInMapsButton(
    venue: VenueLocation?,
    tag: String,
    modifier: Modifier = Modifier,
    fallback: VenueLocation? = null,
    tint: Color = Ui.Accent
) {
    val context = LocalContext.current
    val links = remember(venue, fallback) {
        venue?.let { MapsLinkBuilder.build(it) } ?: fallback?.let { MapsLinkBuilder.build(it) }
    }
    var failed by remember { mutableStateOf(false) }

    if (links == null) {
        Text(
            "Venue location not recorded",
            color = Ui.Muted,
            fontSize = 15.sp,
            modifier = modifier.testTag("$tag-unavailable")
        )
        return
    }

    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        TextButton(
            onClick = { failed = !openInMaps(context, links) },
            modifier = Modifier.heightIn(min = MinTouchTarget).testTag(tag)
        ) {
            Icon(Icons.Default.Directions, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(6.dp))
            Text("Open in Maps", color = tint, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        }
        if (failed) {
            Text(
                "No maps app or web browser is available on this device.",
                color = Ui.Problem,
                fontSize = 14.sp
            )
        }
    }
}
