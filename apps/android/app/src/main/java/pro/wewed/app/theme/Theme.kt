package pro.wewed.app.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColorScheme = lightColorScheme(
    primary = WewedColors.Gold,
    secondary = WewedColors.Emerald,
    tertiary = WewedColors.Burgundy,
    background = WewedColors.Ivory,
    surface = WewedColors.CardLight,
    onPrimary = WewedColors.TextPrimaryLight,
    onSecondary = WewedColors.CardLight,
    onBackground = WewedColors.TextPrimaryLight,
    onSurface = WewedColors.TextPrimaryLight
)

private val DarkColorScheme = darkColorScheme(
    primary = WewedColors.GoldLight,
    secondary = WewedColors.EmeraldLight,
    tertiary = WewedColors.BurgundyLight,
    background = WewedColors.BackgroundDark,
    surface = WewedColors.CardDark,
    onPrimary = WewedColors.BackgroundDark,
    onSecondary = WewedColors.CardLight,
    onBackground = WewedColors.TextPrimaryDark,
    onSurface = WewedColors.TextPrimaryDark
)

@Composable
fun WewedTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
