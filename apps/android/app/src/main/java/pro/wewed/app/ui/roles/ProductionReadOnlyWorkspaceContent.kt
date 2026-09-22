package pro.wewed.app.ui.roles

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.navigation.PrimaryDestination
import pro.wewed.app.services.ProductionWorkspaceSnapshot
import pro.wewed.app.theme.WeddingIdentityPalette

/**
 * Minimal Phase-5 production surface. It renders only the real, server-revalidated workspace
 * snapshot. Full task/budget/guest/vendor parity belongs to Phase 8.
 */
@Composable
fun ProductionReadOnlyWorkspaceContent(
    snapshot: ProductionWorkspaceSnapshot,
    destination: PrimaryDestination? = null,
    onSignOut: (() -> Unit)? = null,
    onSwitchContext: (() -> Unit)? = null,
    onSelectEngagement: ((String) -> Unit)? = null,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .padding(20.dp)
            .testTag("production-readonly-workspace"),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text(
            destination?.label ?: "Wewed workspace",
            fontSize = 22.sp,
            fontWeight = FontWeight.SemiBold,
            color = WeddingIdentityPalette.Ink
        )
        Text(
            "${snapshot.workspaceKind.replaceFirstChar { it.uppercase() }} · ${snapshot.scopeKind}",
            fontSize = 12.sp,
            color = WeddingIdentityPalette.Muted
        )

        snapshot.wedding?.let { wedding ->
            ReadOnlyRow("Wedding", wedding.coupleNames.ifBlank { wedding.title })
            ReadOnlyRow("Date", wedding.date)
            ReadOnlyRow("Venue", listOf(wedding.venue, wedding.venueCity, wedding.venueCountry).filter { it.isNotBlank() }.joinToString(", "))
            ReadOnlyRow("Lifecycle", wedding.lifecycle)
        } ?: run {
            (snapshot.businessName ?: snapshot.businessAccountId)?.let { ReadOnlyRow("Business", it) }
            if (snapshot.scopeKind == "system") ReadOnlyRow("Scope", "Wewed platform")
        }

        if (snapshot.permissions.isNotEmpty()) {
            ReadOnlyRow("Permissions", snapshot.permissions.joinToString(", "))
        }
        if (snapshot.platformRoles.isNotEmpty()) {
            ReadOnlyRow("Platform role", snapshot.platformRoles.joinToString(", "))
        }

        // Master plan Phase 6 §5 — a Vendor wedding grant with one engagement resolves it
        // automatically (server-side); with more than one, nothing is rendered as "the" engagement
        // until the person explicitly picks one from the account's own real options.
        snapshot.engagement?.let { engagement ->
            ReadOnlyRow("Engagement", engagement.serviceCategory + (engagement.serviceDescription?.let { " · $it" } ?: ""))
        }
        if (snapshot.engagementSelectionRequired && onSelectEngagement != null) {
            Text("Choose an engagement", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = WeddingIdentityPalette.Ink)
            snapshot.engagementOptions.forEach { option ->
                OutlinedButton(
                    onClick = { onSelectEngagement(option.id) },
                    modifier = Modifier.fillMaxWidth().testTag("engagement-option-${option.id}"),
                ) {
                    Text(option.serviceCategory + (option.serviceDescription?.let { " · $it" } ?: ""))
                }
            }
        }

        Text(
            "Read-only production access. Detailed ${destination?.label ?: "workspace"} data is enabled in the feature-parity phase.",
            fontSize = 12.sp,
            color = WeddingIdentityPalette.Muted,
            modifier = Modifier.testTag("production-readonly-boundary")
        )

        onSwitchContext?.let {
            TextButton(onClick = it, modifier = Modifier.testTag("production-readonly-switch-context")) {
                Text("Switch context")
            }
        }

        onSignOut?.let {
            TextButton(onClick = it, modifier = Modifier.testTag("production-readonly-sign-out")) {
                Text("Sign out")
            }
        }
    }
}

@Composable
private fun ReadOnlyRow(label: String, value: String) {
    if (value.isBlank()) return
    Surface(
        color = WeddingIdentityPalette.IvorySoft,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(Modifier.padding(12.dp)) {
            Text(label, fontSize = 11.sp, color = WeddingIdentityPalette.Muted)
            Text(value, fontSize = 14.sp, color = WeddingIdentityPalette.Ink)
        }
    }
}
