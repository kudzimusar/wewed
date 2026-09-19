package pro.wewed.app.ui.shared

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CancellationException
import pro.wewed.app.models.AccessDeniedException
import pro.wewed.app.models.RoleGrant
import pro.wewed.app.theme.WeddingIdentityPalette

/** Minimum touch target for every tappable element (spec §4). */
val MinTouchTarget = 48.dp

/**
 * Popups (dialogs, sheets, menus) are separate windows, so the root's testTagsAsResourceId does not reach them.
 * Every popup root applies this so its identifiers stay visible to UI automation.
 */
@OptIn(ExperimentalComposeUiApi::class)
fun Modifier.exposeTestTags(): Modifier = this.semantics { testTagsAsResourceId = true }

object Ui {
    val Background = WeddingIdentityPalette.Ivory
    val Card = WeddingIdentityPalette.IvorySoft
    val Ink = WeddingIdentityPalette.Ink
    val Muted = WeddingIdentityPalette.Muted
    val Accent = WeddingIdentityPalette.ChampagneDeep
    val Positive = WeddingIdentityPalette.Forest
    val Hairline = WeddingIdentityPalette.Hairline
    val Notice = Color(0xFFFFF4DE)
    val NoticeBorder = Color(0xFFE8C98E)
    val Problem = Color(0xFF9B1C1C)
}

/** Result of loading data for a screen. Failures carry plain words, never exception text. */
sealed interface Load<out T> {
    data object Loading : Load<Nothing>
    data class Ready<T>(val value: T) : Load<T>
    data class Failed(val message: String) : Load<Nothing>
}

fun friendlyError(error: Throwable): String = when (error) {
    is AccessDeniedException -> "This information isn't available for your role."
    else -> "This information couldn't be loaded. Please try again."
}

/** Loads once per key; recomposes to Ready or Failed. */
@Composable
fun <T> rememberLoad(vararg keys: Any?, block: suspend () -> T): Load<T> {
    val state = produceState<Load<T>>(initialValue = Load.Loading, *keys) {
        value = try {
            Load.Ready(block())
        } catch (cancel: CancellationException) {
            throw cancel
        } catch (error: Throwable) {
            Load.Failed(friendlyError(error))
        }
    }
    return state.value
}

@Composable
fun <T> LoadContent(
    load: Load<T>,
    modifier: Modifier = Modifier,
    content: @Composable (T) -> Unit
) {
    when (load) {
        Load.Loading -> LoadingIndicator(modifier)
        is Load.Failed -> ProblemText(load.message, modifier.padding(16.dp))
        is Load.Ready -> content(load.value)
    }
}

@Composable
fun LoadingIndicator(modifier: Modifier = Modifier) {
    Box(modifier = modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(
            color = Ui.Accent,
            modifier = Modifier.semantics { contentDescription = "Loading" }
        )
    }
}

@Composable
fun ProblemText(message: String, modifier: Modifier = Modifier) {
    Text(
        message,
        color = Ui.Problem,
        fontSize = 16.sp,
        modifier = modifier.testTag("screen-problem")
    )
}

/** Shown at the top of every shell whose grant is a UAT overlay. Invisible for real relationships. */
@Composable
fun TestAccessNotice(grant: RoleGrant, modifier: Modifier = Modifier) {
    if (!grant.isTestOverlay) return
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Ui.Notice)
            .border(1.dp, Ui.NoticeBorder, RoundedCornerShape(12.dp))
            .semantics(mergeDescendants = true) {}
            .testTag("test-access-notice")
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Icon(Icons.Outlined.Info, contentDescription = "Notice", tint = Ui.Accent, modifier = Modifier.size(20.dp))
        Text(grant.provenanceNote, color = Ui.Ink, fontSize = 14.sp, lineHeight = 19.sp)
    }
}

/** A full screen reached from another screen. Back (system or arrow) always returns. */
@Composable
fun SubScreen(
    title: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    BackHandler(onBack = onBack)
    Column(modifier = modifier.fillMaxSize().background(Ui.Background)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack, modifier = Modifier.testTag("sub-screen-back")) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Ui.Ink)
            }
            Text(
                title,
                color = Ui.Ink,
                fontFamily = FontFamily.Serif,
                fontWeight = FontWeight.SemiBold,
                fontSize = 21.sp,
                modifier = Modifier.weight(1f).semantics { heading() }
            )
        }
        HorizontalDivider(color = Ui.Hairline)
        Column(modifier = Modifier.fillMaxSize(), content = content)
    }
}

@Composable
fun ScreenHeading(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        color = Ui.Ink,
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 20.sp,
        modifier = modifier.semantics { heading() }
    )
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        color = Ui.Ink,
        fontWeight = FontWeight.SemiBold,
        fontSize = 17.sp,
        modifier = modifier.padding(top = 4.dp).semantics { heading() }
    )
}

@Composable
fun BodyText(text: String, modifier: Modifier = Modifier, color: Color = Ui.Ink) {
    Text(text, color = color, fontSize = 16.sp, lineHeight = 22.sp, modifier = modifier)
}

@Composable
fun SupportingText(text: String, modifier: Modifier = Modifier) {
    Text(text, color = Ui.Muted, fontSize = 14.sp, lineHeight = 19.sp, modifier = modifier)
}

@Composable
fun InfoCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Ui.Card)
            .border(1.dp, Ui.Hairline, RoundedCornerShape(16.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
        content = content
    )
}

/** "Label: value" pair that reads naturally aloud. */
@Composable
fun LabeledValue(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier.semantics(mergeDescendants = true) {}) {
        Text(label, color = Ui.Muted, fontSize = 13.sp)
        Text(value, color = Ui.Ink, fontSize = 16.sp, fontWeight = FontWeight.Medium)
    }
}

/** Status is always text; the pill shape only supports it. */
@Composable
fun StatusText(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        color = Ui.Ink,
        fontSize = 13.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = modifier
            .clip(RoundedCornerShape(50))
            .border(1.dp, Ui.Hairline, RoundedCornerShape(50))
            .background(Color.White)
            .padding(horizontal = 10.dp, vertical = 4.dp)
    )
}

@Composable
fun EmptyStateText(message: String, tag: String, modifier: Modifier = Modifier) {
    Text(
        message,
        color = Ui.Muted,
        fontSize = 16.sp,
        lineHeight = 22.sp,
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 16.dp)
            .testTag(tag)
    )
}

@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    enabled: Boolean = true,
    containerColor: Color = Ui.Positive
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.heightIn(min = MinTouchTarget),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = containerColor, contentColor = Color.White)
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun SecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    enabled: Boolean = true
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.heightIn(min = MinTouchTarget),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, if (enabled) WeddingIdentityPalette.Champagne else Ui.Hairline),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = Ui.Ink)
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(20.dp), tint = Ui.Accent)
            Spacer(Modifier.width(8.dp))
        }
        Text(text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
    }
}

/** A tappable list row that leads to another screen. */
@Composable
fun NavigationRow(
    title: String,
    subtitle: String?,
    tag: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 60.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(Ui.Card)
            .border(1.dp, Ui.Hairline, RoundedCornerShape(14.dp))
            .clickable(role = Role.Button, onClick = onClick)
            .testTag(tag)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = Ui.Accent, modifier = Modifier.size(22.dp))
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = Ui.Ink, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
            if (!subtitle.isNullOrBlank()) SupportingText(subtitle)
        }
        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Ui.Muted)
    }
}
