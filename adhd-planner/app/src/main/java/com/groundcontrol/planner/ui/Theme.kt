package com.groundcontrol.planner.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.groundcontrol.planner.data.Categories

/** The flight-strip palette: cool slate desk, cobalt ink, amber for anything that is due. */
object Palette {
    val Desk = Color(0xFFE7EAF0)
    val DeskDark = Color(0xFF10131A)
    val Strip = Color(0xFFFFFFFF)
    val StripDark = Color(0xFF1C212C)
    val Ink = Color(0xFF161B26)
    val InkDark = Color(0xFFE5E9F2)
    val Cobalt = Color(0xFF2A4FB0)
    val CobaltDark = Color(0xFF7FA0EC)
    val Signal = Color(0xFFB0740C)
    val SignalDark = Color(0xFFE0A63C)
    val Alert = Color(0xFFA63A2B)
    val AlertDark = Color(0xFFE07A63)
    val Ok = Color(0xFF2C7359)
    val OkDark = Color(0xFF64BC9A)

    private val catLight = mapOf(
        Categories.WORK to Color(0xFF2A4FB0),
        Categories.PERSONAL to Color(0xFF7A4BA0),
        Categories.HEALTH to Color(0xFF2C7359),
        Categories.ERRANDS to Color(0xFFB0740C),
        Categories.SOCIAL to Color(0xFFAC3C66),
        Categories.OTHER to Color(0xFF6A7385),
    )
    private val catDark = mapOf(
        Categories.WORK to Color(0xFF7FA0EC),
        Categories.PERSONAL to Color(0xFFB48AD6),
        Categories.HEALTH to Color(0xFF64BC9A),
        Categories.ERRANDS to Color(0xFFE0A63C),
        Categories.SOCIAL to Color(0xFFE0799F),
        Categories.OTHER to Color(0xFF98A1B3),
    )

    fun category(slug: String, dark: Boolean): Color =
        (if (dark) catDark else catLight)[slug] ?: (if (dark) catDark else catLight).getValue(Categories.OTHER)
}

private val Light = lightColorScheme(
    primary = Palette.Cobalt,
    onPrimary = Color.White,
    secondary = Palette.Signal,
    background = Palette.Desk,
    onBackground = Palette.Ink,
    surface = Palette.Strip,
    onSurface = Palette.Ink,
    surfaceVariant = Color(0xFFDDE1EA),
    onSurfaceVariant = Color(0xFF576073),
    error = Palette.Alert,
    outline = Color(0xFFC9CFDB),
)

private val Dark = darkColorScheme(
    primary = Palette.CobaltDark,
    onPrimary = Color(0xFF0D1016),
    secondary = Palette.SignalDark,
    background = Palette.DeskDark,
    onBackground = Palette.InkDark,
    surface = Palette.StripDark,
    onSurface = Palette.InkDark,
    surfaceVariant = Color(0xFF161A23),
    onSurfaceVariant = Color(0xFF99A2B4),
    error = Palette.AlertDark,
    outline = Color(0xFF2C3340),
)

private val GroundControlType = Typography(
    headlineMedium = TextStyle(fontSize = 30.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.5.sp),
    titleLarge = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.SemiBold),
    titleMedium = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Medium),
    bodyLarge = TextStyle(fontSize = 16.sp),
    bodyMedium = TextStyle(fontSize = 14.sp),
    labelLarge = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.sp),
    labelMedium = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.2.sp),
    labelSmall = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Medium, letterSpacing = 0.8.sp),
)

@Composable
fun GroundControlTheme(
    dark: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (dark) Dark else Light,
        typography = GroundControlType,
        content = content,
    )
}
