package pro.wewed.app.ui.roles

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.RoleGrant
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.ui.shared.TestAccessNotice
import pro.wewed.app.ui.shared.Ui

data class ShellTab(val id: String, val label: String, val icon: ImageVector)

/**
 * Common frame for every non-couple shell: plain-words title, the wedding, the test-access notice
 * (only for overlay grants) and labelled bottom tabs.
 */
@Composable
fun RoleShellScaffold(
    grant: RoleGrant,
    rootTag: String,
    tabs: List<ShellTab>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    showHeader: Boolean = true,
    content: @Composable () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Ui.Background)
            .testTag(rootTag)
    ) {
        if (showHeader) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(WeddingIdentityPalette.IvorySoft)
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    grant.role.choiceLabel,
                    color = Ui.Ink,
                    fontFamily = FontFamily.Serif,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 22.sp,
                    modifier = Modifier.semantics { heading() }.testTag("shell-title")
                )
                Text(grant.weddingTitle, color = Ui.Muted, fontSize = 15.sp)
                TestAccessNotice(grant)
            }
            HorizontalDivider(color = Ui.Hairline)
        }

        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            content()
        }

        HorizontalDivider(color = Ui.Hairline)
        NavigationBar(containerColor = WeddingIdentityPalette.IvorySoft, tonalElevation = 0.dp) {
            tabs.forEachIndexed { index, tab ->
                NavigationBarItem(
                    selected = index == selectedIndex,
                    onClick = { onSelect(index) },
                    icon = { Icon(tab.icon, contentDescription = null) },
                    label = {
                        // Two lines so labels like "Wedding Info" stay whole at large text sizes.
                        Text(
                            tab.label,
                            fontSize = 12.sp,
                            lineHeight = 13.sp,
                            maxLines = 2,
                            textAlign = TextAlign.Center,
                            overflow = TextOverflow.Ellipsis
                        )
                    },
                    modifier = Modifier.testTag("$rootTag-tab-${tab.id}"),
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = WeddingIdentityPalette.ChampagneDeep,
                        selectedTextColor = WeddingIdentityPalette.ChampagneDeep,
                        indicatorColor = WeddingIdentityPalette.Champagne.copy(alpha = 0.18f),
                        unselectedIconColor = Ui.Muted,
                        unselectedTextColor = Ui.Muted
                    )
                )
            }
        }
    }
}
