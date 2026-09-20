package pro.wewed.app.ui.more

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import pro.wewed.app.models.WeddingContentSection
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.ui.roles.BundledWeddingMedia
import pro.wewed.app.ui.roles.GalleryContentSection
import pro.wewed.app.ui.roles.IACard
import pro.wewed.app.ui.roles.IAEmptySourceSection
import pro.wewed.app.ui.roles.IAOpenRow
import pro.wewed.app.ui.roles.IASectionList
import pro.wewed.app.ui.roles.WeddingContentSectionView

/**
 * The couple's Wedding Site, inside the app.
 *
 * The published wedding site was treated as a separate product that happened to belong to the same
 * couple. It is not: the site and the app read the same `WeddingContent` graph. Modelling it as
 * somewhere else is what produced native-only placeholder copy sitting beside a real published
 * site — two sources of truth for one wedding's story.
 *
 *     WeddingContent
 *        ├── the published wedding site (web)
 *        ├── Couple → Wedding Site        (this screen)
 *        ├── Guest → wedding information
 *        └── Planner → client content, where authorized
 *
 * One graph, several audiences. Change it on the web and this reflects it after a refresh, because
 * there is nothing else for it to read.
 *
 * Editing is deliberately absent rather than disabled-looking: production writes are gated, and a
 * save control that silently does nothing is worse than no control at all.
 */
@Composable
fun WeddingSiteScreen(
    coupleNames: String,
    weddingSlug: String?,
    sections: List<WeddingContentSection>,
    onBack: () -> Unit
) {
    BackHandler(onBack = onBack)

    var openSection by remember { mutableStateOf<String?>(null) }

    val current = openSection?.let { key -> sections.firstOrNull { it.section == key } }
    if (current != null) {
        BackHandler { openSection = null }
        if (current.section == "gallery") {
            GalleryContentSection(current, BundledWeddingMedia.names, "wedding-site-gallery")
        } else {
            WeddingContentSectionView(current, "wedding-site-${current.section}")
        }
        return
    }

    if (sections.isEmpty()) {
        IAEmptySourceSection(
            "Wedding Site",
            "No wedding site content has been published for this wedding yet.",
            "wedding-site"
        )
        return
    }

    // Presented in reading order — the order a visitor meets the site — rather than alphabetically.
    val order = listOf(
        "hero", "story", "gallery", "venue", "theday", "faq",
        "travel", "songbook", "guests", "vendors", "memory", "after"
    )
    val ordered = sections.sortedBy { section ->
        order.indexOf(section.section).takeIf { it >= 0 } ?: order.size
    }
    val totalEntries = sections.sumOf { it.entries.size }

    IASectionList("Wedding Site", coupleNames) {
        weddingSlug?.takeIf { it.isNotBlank() }?.let {
            IACard(
                title = "Published at",
                subtitle = "wewed.pro/w/$it",
                testTag = "wedding-site-address"
            )
        }
        IACard(
            title = "Published content",
            subtitle = "${sections.size} sections · $totalEntries entries",
            testTag = "wedding-site-summary"
        )

        Spacer(Modifier.height(4.dp))
        Text(
            "Sections",
            color = WeddingIdentityPalette.Muted,
            fontWeight = FontWeight.SemiBold,
            fontSize = 12.sp
        )

        ordered.forEach { section ->
            IACard(
                title = section.title,
                subtitle = "${section.entries.size} published entries",
                testTag = "wedding-site-section-${section.section}",
                onClick = { openSection = section.section }
            )
        }

        Spacer(Modifier.height(6.dp))
        Text(
            "This is the same published content your guests see on your wedding site. " +
                "Editing is available on the web while native writes remain gated.",
            color = WeddingIdentityPalette.Muted,
            fontSize = 11.sp
        )
    }
}
