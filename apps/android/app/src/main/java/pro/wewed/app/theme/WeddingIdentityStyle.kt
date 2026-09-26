package pro.wewed.app.theme

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.R

object WeddingIdentityPalette {
    val Ivory = Color(0xFFFBF7EF)
    val IvorySoft = Color(0xFFFFFDF8)
    val Champagne = Color(0xFFD5B47A)
    val ChampagneDeep = Color(0xFFA77322)
    val Forest = Color(0xFF0E5A3F)
    val ForestSoft = Color(0xFFEAF3EE)
    val Ink = Color(0xFF13212B)
    val Muted = Color(0xFF667381)
    val Hairline = Color(0xFFE9E1D5)
}


@Composable
fun WeddingBrandMark(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.size(width = 30.dp, height = 26.dp),
        contentAlignment = Alignment.Center
    ) {
        Box(
            modifier = Modifier
                .size(width = 12.dp, height = 20.dp)
                .offset(x = (-4).dp)
                .rotate(38f)
                .border(2.dp, WeddingIdentityPalette.Champagne, RoundedCornerShape(8.dp))
        )
        Box(
            modifier = Modifier
                .size(width = 12.dp, height = 20.dp)
                .offset(x = 4.dp)
                .rotate(-38f)
                .border(2.dp, WeddingIdentityPalette.Champagne, RoundedCornerShape(8.dp))
        )
    }
}

@Composable
fun WeddingMonogramBadge(
    names: String,
    modifier: Modifier = Modifier,
    size: Int = 58
) {
    Box(
        modifier = modifier
            .size(size.dp)
            .clip(CircleShape)
            .background(WeddingIdentityPalette.IvorySoft)
            .border(1.2.dp, WeddingIdentityPalette.Champagne.copy(alpha = 0.85f), CircleShape),
        contentAlignment = Alignment.Center
    ) {
        Image(
            painter = painterResource(R.drawable.ornament_frame),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.matchParentSize().alpha(0.09f)
        )
        WeddingMonogram(names = names, sizeSp = (size * 0.42f).toInt())
    }
}

@Composable
fun WeddingMonogram(names: String, modifier: Modifier = Modifier, sizeSp: Int = 36) {
    val parts = names.split("&").map { it.trim() }.filter { it.isNotBlank() }
    val monogram = if (parts.size >= 2) {
        "${parts[0].first()}&${parts[1].first()}"
    } else {
        "♡"
    }

    Text(
        text = monogram,
        modifier = modifier,
        color = WeddingIdentityPalette.ChampagneDeep,
        fontFamily = FontFamily.Serif,
        fontStyle = FontStyle.Italic,
        fontWeight = FontWeight.Medium,
        fontSize = sizeSp.sp
    )
}

@Composable
fun WeddingMetricTile(
    title: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(15.dp))
            .background(WeddingIdentityPalette.IvorySoft)
            .border(1.dp, WeddingIdentityPalette.Hairline, RoundedCornerShape(15.dp))
            .padding(vertical = 12.dp, horizontal = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(7.dp)
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(WeddingIdentityPalette.Champagne.copy(alpha = 0.14f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = WeddingIdentityPalette.ChampagneDeep,
                modifier = Modifier.size(20.dp)
            )
        }
        Text(
            text = title,
            color = WeddingIdentityPalette.Ink,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold
        )
        Text(
            text = value,
            color = WeddingIdentityPalette.Muted,
            fontSize = 11.sp,
            maxLines = 1
        )
    }
}

@Composable
fun WeddingListRowIcon(icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Box(
        modifier = Modifier
            .size(42.dp)
            .clip(CircleShape)
            .background(WeddingIdentityPalette.Champagne.copy(alpha = 0.14f)),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = WeddingIdentityPalette.ChampagneDeep,
            modifier = Modifier.size(19.dp)
        )
    }
}


@Composable
fun WeddingOrnamentBackdrop(
    modifier: Modifier = Modifier,
    alpha: Float = 0.08f
) {
    Box(modifier = modifier.background(WeddingIdentityPalette.Ivory)) {
        Image(
            painter = painterResource(R.drawable.ornament_frame),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.matchParentSize().alpha(alpha)
        )
    }
}

@Composable
fun WeddingHeaderOrnament(modifier: Modifier = Modifier) {
    Image(
        painter = painterResource(R.drawable.ornament_frame),
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = modifier
            .size(width = 112.dp, height = 92.dp)
            .alpha(0.24f)
    )
}

/**
 * The official Wewed logo, on transparency.
 *
 * [WeddingBrandMark] is two rotated rounded rectangles approximating interlocking rings. As a
 * small decorative accent inside the wedding hero that is fine — it reads as ornament. As "the
 * Wewed brand mark" on the splash, the welcome and the sign-in surfaces it was a placeholder
 * standing in for an asset the repository already ships, so the OS launch screen showed the real
 * logo and the very next frame showed a geometric approximation of it.
 *
 * Brand surfaces use this. Decorative ring accents keep using [WeddingBrandMark].
 */
@Composable
fun WewedLogo(
    modifier: Modifier = Modifier,
    size: Int = 96,
    contentDescription: String? = "Wewed"
) {
    androidx.compose.foundation.Image(
        painter = androidx.compose.ui.res.painterResource(id = pro.wewed.app.R.drawable.wewed_logo),
        contentDescription = contentDescription,
        contentScale = androidx.compose.ui.layout.ContentScale.Fit,
        modifier = modifier.size(size.dp)
    )
}
