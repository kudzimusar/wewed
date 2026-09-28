package pro.wewed.app.ui.workspace

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import pro.wewed.app.navigation.GrantScopeKind
import pro.wewed.app.navigation.GrantWorkspaceKind
import pro.wewed.app.navigation.ProductionAuthority
import pro.wewed.app.navigation.ProductionWorkspaceGrant
import pro.wewed.app.theme.WeddingIdentityPalette

/**
 * Human-readable labels for a production workspace grant (QRO04-UI01). Internal identifiers —
 * grantId, businessAccountId, vendorId, wedding/couple IDs, UUIDs — are never shown. The title
 * prefers the wedding title, then the authorized vendor or business presentation name, then a safe
 * role name. Presentation only: it neither widens authority nor invents a grant. Mirrors iOS
 * `WorkspaceGrantPresentation`.
 */
data class WorkspaceGrantPresentation(val title: String, val roleLabel: String, val scopeLabel: String) {
    companion object {
        private val identifierPatterns = listOf(
            Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"),
            Regex("^c[a-z0-9]{20,}$"),
            Regex("^(planner|couple|coordinator|vendor|admin|usher|grant|business)[-:_][A-Za-z0-9:_-]+$"),
        )

        fun looksLikeIdentifier(value: String): Boolean = identifierPatterns.any { it.containsMatchIn(value) }

        fun of(
            grant: ProductionWorkspaceGrant,
            vendorNamesById: Map<String, String> = emptyMap(),
            businessNamesById: Map<String, String> = emptyMap(),
        ): WorkspaceGrantPresentation {
            val identifiers = listOfNotNull(grant.grantId, grant.businessAccountId, grant.vendorId, grant.weddingId, grant.coupleId).toSet()
            fun usable(candidate: String?): String? =
                candidate?.trim()?.takeIf { it.isNotEmpty() && it !in identifiers && !looksLikeIdentifier(it) }
            val kind = grant.workspaceKind
            val scope = grant.scopeKind
            val title = if (scope == GrantScopeKind.SYSTEM || kind == GrantWorkspaceKind.ADMIN) {
                "Wewed Administration"
            } else {
                usable(grant.weddingTitle)
                    ?: usable(grant.vendorId?.let(vendorNamesById::get))
                    ?: usable(grant.businessAccountId?.let(businessNamesById::get))
                    ?: fallbackTitle(kind, scope)
            }
            return WorkspaceGrantPresentation(title, roleLabel(kind, scope), scopeLabel(scope))
        }

        fun gate(gateName: String, weddingTitle: String) = WorkspaceGrantPresentation(weddingTitle, "Gate Usher", gateName)

        fun fallbackTitle(kind: GrantWorkspaceKind, scope: GrantScopeKind): String = when (kind) {
            GrantWorkspaceKind.PLANNER -> "Planner Portfolio"
            GrantWorkspaceKind.VENDOR -> "Vendor Business"
            GrantWorkspaceKind.COORDINATOR -> "Coordinator Workspace"
            GrantWorkspaceKind.COUPLE -> "Our Wedding"
            GrantWorkspaceKind.ADMIN -> "Wewed Administration"
            GrantWorkspaceKind.UNKNOWN -> if (scope == GrantScopeKind.SYSTEM) "Wewed Administration" else "Wewed Workspace"
        }

        fun roleLabel(kind: GrantWorkspaceKind, scope: GrantScopeKind): String = when (kind) {
            GrantWorkspaceKind.COUPLE -> "Couple"
            GrantWorkspaceKind.PLANNER -> "Professional Planner"
            GrantWorkspaceKind.COORDINATOR -> "Day-of Coordinator"
            GrantWorkspaceKind.VENDOR -> "Vendor & Staff"
            GrantWorkspaceKind.ADMIN -> "Wewed Administration"
            GrantWorkspaceKind.UNKNOWN -> if (scope == GrantScopeKind.SYSTEM) "Wewed Administration" else "Workspace"
        }

        fun scopeLabel(scope: GrantScopeKind): String = when (scope) {
            GrantScopeKind.WEDDING -> "Wedding workspace"
            GrantScopeKind.PORTFOLIO -> "All weddings in your portfolio"
            GrantScopeKind.BUSINESS -> "Business workspace"
            GrantScopeKind.SYSTEM -> "Platform administration"
            GrantScopeKind.UNKNOWN -> "Workspace"
        }
    }
}

/**
 * The real context selector master plan §9 requires: more than one grant of the same kind and none
 * chosen on the person's behalf. Wewed ivory/champagne cards with human-readable labels; never an
 * internal identifier (QRO04-UI01). iOS counterpart: `GrantSelectionView`.
 */
@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun WorkspaceGrantSelectionScreen(
    grants: List<ProductionWorkspaceGrant>,
    vendorNamesById: Map<String, String>,
    businessNamesById: Map<String, String>,
    onSelect: (String) -> Unit,
    onSignOut: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .semantics { testTagsAsResourceId = true }
            .testTag("grant-selection"),
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(
            modifier = Modifier
                // Full-screen surface: keep content clear of the status bar/camera cutout and the
                // gesture area (QRO04-UI01-RC02).
                .statusBarsPadding()
                .navigationBarsPadding()
                .widthIn(max = 560.dp)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 22.dp, vertical = 28.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("WEWED", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 2.4.sp, color = WeddingIdentityPalette.ChampagneDeep)
            Text("Choose your workspace", fontSize = 28.sp, fontFamily = FontFamily.Serif, fontWeight = FontWeight.Medium, color = WeddingIdentityPalette.Ink)
            Text(
                "Your account can open more than one workspace. Choose where you'd like to begin — you can switch at any time.",
                fontSize = 14.sp,
                color = WeddingIdentityPalette.Muted,
            )
            Spacer(Modifier.heightIn(min = 4.dp))
            grants.forEach { grant ->
                val presentation = WorkspaceGrantPresentation.of(grant, vendorNamesById, businessNamesById)
                WorkspaceGrantCard(
                    presentation = presentation,
                    isCurrent = false,
                    modifier = Modifier.testTag("grant-option-${grant.grantId}"),
                    onClick = { onSelect(grant.grantId) },
                )
            }
            Box(
                modifier = Modifier
                    .padding(top = 8.dp)
                    .fillMaxWidth()
                    .heightIn(min = 46.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .border(1.dp, WeddingIdentityPalette.Hairline, RoundedCornerShape(14.dp))
                    .clickable(onClick = onSignOut)
                    .testTag("grant-selection-sign-out"),
                contentAlignment = Alignment.Center,
            ) {
                Text("Sign out", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = WeddingIdentityPalette.Ink)
            }
        }
    }
}

/**
 * Explicit production context switcher (master plan Phase 6 §1, §2, §11), reachable after a
 * workspace is open. Selecting calls the same existing selectGrant()/selectGateGrant(); this adds no
 * authority logic. Labels from [WorkspaceGrantPresentation]; the current workspace is marked.
 * iOS counterpart: `ContextSwitcherSheet`.
 */
@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun WorkspaceContextSwitcherDialog(
    authority: ProductionAuthority,
    activeGrantId: String?,
    activeGateGrantId: String?,
    onSelect: (String) -> Unit,
    onSelectGate: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(
            modifier = Modifier
                .padding(16.dp)
                .widthIn(max = 560.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .background(WeddingIdentityPalette.Ivory)
                .semantics { testTagsAsResourceId = true }
                .testTag("context-switcher")
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Switch workspace",
                    fontSize = 22.sp,
                    fontFamily = FontFamily.Serif,
                    fontWeight = FontWeight.Medium,
                    color = WeddingIdentityPalette.Ink,
                    modifier = Modifier.weight(1f),
                )
                TextButton(onClick = onDismiss, modifier = Modifier.testTag("context-switch-close")) {
                    Text("Close", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = WeddingIdentityPalette.ChampagneDeep)
                }
            }
            Text("Choose the workspace to open. Your current workspace is marked.", fontSize = 13.sp, color = WeddingIdentityPalette.Muted)
            authority.grants.forEach { grant ->
                val isCurrent = grant.grantId == activeGrantId
                WorkspaceGrantCard(
                    presentation = WorkspaceGrantPresentation.of(grant, authority.vendorNamesById, authority.businessNamesById),
                    isCurrent = isCurrent,
                    modifier = Modifier.testTag("context-switch-option-${grant.grantId}"),
                    onClick = if (isCurrent) null else ({ onSelect(grant.grantId); onDismiss() }),
                )
            }
            authority.operationalGrants.forEach { grant ->
                val isCurrent = grant.grantId == activeGateGrantId
                WorkspaceGrantCard(
                    presentation = WorkspaceGrantPresentation.gate(grant.gateName, grant.weddingTitle),
                    isCurrent = isCurrent,
                    modifier = Modifier.testTag("context-switch-option-${grant.grantId}"),
                    onClick = if (isCurrent) null else ({ onSelectGate(grant.grantId); onDismiss() }),
                )
            }
        }
    }
}

/** Wewed workspace card: ivory surface, champagne edge, role chip, serif forest title, scope line. */
@Composable
fun WorkspaceGrantCard(
    presentation: WorkspaceGrantPresentation,
    isCurrent: Boolean,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)?,
) {
    val shape = RoundedCornerShape(16.dp)
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(WeddingIdentityPalette.IvorySoft)
            .border(
                if (isCurrent) 1.5.dp else 1.dp,
                if (isCurrent) WeddingIdentityPalette.Forest.copy(alpha = 0.55f) else WeddingIdentityPalette.Champagne.copy(alpha = 0.55f),
                shape,
            )
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .semantics { contentDescription = "${presentation.title}, ${presentation.roleLabel}${if (isCurrent) ", current" else ""}" }
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                presentation.roleLabel.uppercase(),
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.2.sp,
                color = WeddingIdentityPalette.ChampagneDeep,
                modifier = Modifier
                    .clip(RoundedCornerShape(50))
                    .background(WeddingIdentityPalette.Champagne.copy(alpha = 0.16f))
                    .padding(horizontal = 8.dp, vertical = 3.dp),
            )
            Text(presentation.title, fontSize = 18.sp, fontFamily = FontFamily.Serif, fontWeight = FontWeight.Medium, color = WeddingIdentityPalette.Forest)
            Text(presentation.scopeLabel, fontSize = 12.sp, color = WeddingIdentityPalette.Muted)
        }
        if (isCurrent) {
            Text(
                "Current",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = WeddingIdentityPalette.Forest,
                modifier = Modifier
                    .clip(RoundedCornerShape(50))
                    .background(WeddingIdentityPalette.ForestSoft)
                    .padding(horizontal = 10.dp, vertical = 4.dp),
            )
        } else {
            Text("›", fontSize = 22.sp, color = WeddingIdentityPalette.ChampagneDeep)
        }
    }
}
