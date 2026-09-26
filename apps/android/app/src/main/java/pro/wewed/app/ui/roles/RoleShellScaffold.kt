package pro.wewed.app.ui.roles

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.NativeDeepLink
import pro.wewed.app.navigation.DeepLinkRouter
import pro.wewed.app.navigation.Entitlements
import pro.wewed.app.navigation.IANavigationContract
import pro.wewed.app.navigation.NavigationContext
import pro.wewed.app.navigation.PrimaryDestination
import pro.wewed.app.navigation.RoleShellAuthorization
import pro.wewed.app.theme.WeddingIdentityPalette

/**
 * Contract-driven Level-1 shell shared by every IA V2 role.
 *
 * Bottom navigation is rendered from [IANavigationContract] rather than hand-written per role, so
 * labels and order cannot drift between roles or platforms. Every destination switch resolves
 * through [Entitlements.resolve] with the active [NavigationContext] carried forward unchanged.
 */
@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun RoleShellScaffold(
    context: NavigationContext,
    onSwitchPersona: (() -> Unit)? = null,
    /** A parsed but not yet authorized deep link / notification target (P0-8). */
    pendingDeepLink: NativeDeepLink? = null,
    sectionMemory: WorkspaceSectionMemory,
    onDeepLinkHandled: (() -> Unit)? = null,
    content: @Composable (destination: PrimaryDestination, context: NavigationContext) -> Unit
) {
    val navigation = remember(context.activeRole) { IANavigationContract.forRole(context.activeRole) }
    // Keyed on the whole context: a different wedding, assignment or scope is re-resolved from
    // the start rather than inheriting an authorization granted to another context.
    var authorization by remember(context) { mutableStateOf(RoleShellAuthorization.initial(context)) }
    // The tab that reads as selected is the last AUTHORIZED one — never an unresolved safe return.
    val selectedId = authorization.authorizedDestinationId

    val roleTag = context.activeRole.roleId

    // P0-8: the WHOLE deep link is resolved here — target wedding, destination, Level-2 section
    // and entity id — through the same gate as a tap. Nothing is discarded before authorization.
    LaunchedEffect(pendingDeepLink) {
        val link = pendingDeepLink ?: return@LaunchedEffect
        when (val resolution = DeepLinkRouter.resolve(link, context)) {
            is Entitlements.Resolution.Allowed -> {
                authorization = authorization.applying(resolution)
                // Level-2 deep links land on the requested section, not the workspace default.
                sectionMemory.applyRequested(
                    context = context,
                    destinationId = resolution.destination.id,
                    requested = (link as? NativeDeepLink.Workspace)?.section,
                    available = resolution.destination.sections
                )
            }
            is Entitlements.Resolution.Denied -> authorization = authorization.applying(resolution)
        }
        onDeepLinkHandled?.invoke()
    }

    // IA V2 §15.2 — tablets promote Level-1 into a navigation rail. The taxonomy is identical;
    // only the presentation adapts, so there is no separate tablet information architecture.
    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val useRail = maxWidth >= TABLET_RAIL_BREAKPOINT

        val onSelect: (PrimaryDestination) -> Unit = { destination ->
            authorization = authorization.selecting(context, destination.id)
        }

        // Content renders ONLY for a destination Entitlements.resolve allowed for this context.
        // Anything else is the access boundary, including when nothing was ever authorized.
        val workspace: @Composable () -> Unit = {
            val visible = authorization.visibleDestinationId?.let { navigation.destination(it) }
            if (visible != null) {
                content(visible, context)
            } else {
                AccessBoundaryNotice(
                    reason = authorization.denial?.reason
                        ?: "This workspace is not authorized for this session.",
                    onDismiss = if (authorization.canDismissDenial) {
                        { authorization = authorization.dismissingDenial() }
                    } else {
                        null
                    }
                )
            }
        }

        Scaffold(
            modifier = Modifier
                .semantics { testTagsAsResourceId = true }
                .testTag("role-shell-$roleTag")
                .testTag(if (useRail) "layout-rail" else "layout-bottom-bar"),
            containerColor = WeddingIdentityPalette.Ivory,
            topBar = {
                RoleContextBar(context = context, onSwitchPersona = onSwitchPersona)
            },
            bottomBar = {
                if (!useRail) {
                    Column(modifier = Modifier.background(WeddingIdentityPalette.IvorySoft)) {
                        HorizontalDivider(thickness = 1.dp, color = WeddingIdentityPalette.Hairline)
                        NavigationBar(
                            containerColor = WeddingIdentityPalette.IvorySoft,
                            tonalElevation = 0.dp
                        ) {
                            navigation.primary.forEach { destination ->
                                NavigationBarItem(
                                    modifier = Modifier.testTag("nav-$roleTag-${destination.id}"),
                                    selected = selectedId == destination.id,
                                    onClick = { onSelect(destination) },
                                    icon = {
                                        Icon(iconFor(destination.id), contentDescription = destination.label)
                                    },
                                    label = {
                                Text(
                                    destination.label,
                                    fontSize = 11.sp,
                                    maxLines = 1,
                                    // "Wedding Day" was being clipped to "Wedding". Scale the
                                    // label to fit instead of losing a word (accessibility +
                                    // Android/iOS label parity).
                                    softWrap = false,
                                    overflow = androidx.compose.ui.text.style.TextOverflow.Visible,
                                    style = androidx.compose.ui.text.TextStyle(
                                        fontSize = 11.sp,
                                        platformStyle = null
                                    ),
                                    modifier = Modifier.fillMaxWidth(),
                                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                                )
                            },
                                    colors = NavigationBarItemDefaults.colors(
                                        selectedIconColor = WeddingIdentityPalette.ChampagneDeep,
                                        selectedTextColor = WeddingIdentityPalette.ChampagneDeep,
                                        indicatorColor = Color.Transparent,
                                        unselectedIconColor = WeddingIdentityPalette.Muted,
                                        unselectedTextColor = WeddingIdentityPalette.Muted
                                    )
                                )
                            }
                        }
                    }
                }
            }
        ) { innerPadding ->
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                if (useRail) {
                    NavigationRail(
                        containerColor = WeddingIdentityPalette.IvorySoft,
                        // The rail must be given an explicit width. Inside a Row it otherwise
                        // accepts the whole proposal — measured at [0,1600] on a tablet — leaving
                        // the content's weight(1f) box zero width, so every tablet workspace
                        // rendered as an empty ivory page beside a stretched rail. The width is
                        // wide enough for "Wedding Day" at 11sp without truncating it.
                        modifier = Modifier
                            .width(TABLET_RAIL_WIDTH)
                            .fillMaxHeight()
                            .testTag("nav-rail-$roleTag")
                    ) {
                        navigation.primary.forEach { destination ->
                            NavigationRailItem(
                                modifier = Modifier.testTag("nav-$roleTag-${destination.id}"),
                                selected = selectedId == destination.id,
                                onClick = { onSelect(destination) },
                                icon = {
                                    Icon(iconFor(destination.id), contentDescription = destination.label)
                                },
                                label = {
                                Text(
                                    destination.label,
                                    fontSize = 11.sp,
                                    maxLines = 1,
                                    // "Wedding Day" was being clipped to "Wedding". Scale the
                                    // label to fit instead of losing a word (accessibility +
                                    // Android/iOS label parity).
                                    softWrap = false,
                                    overflow = androidx.compose.ui.text.style.TextOverflow.Visible,
                                    style = androidx.compose.ui.text.TextStyle(
                                        fontSize = 11.sp,
                                        platformStyle = null
                                    ),
                                    modifier = Modifier.fillMaxWidth(),
                                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                                )
                            },
                                colors = NavigationRailItemDefaults.colors(
                                    selectedIconColor = WeddingIdentityPalette.ChampagneDeep,
                                    selectedTextColor = WeddingIdentityPalette.ChampagneDeep,
                                    indicatorColor = Color.Transparent,
                                    unselectedIconColor = WeddingIdentityPalette.Muted,
                                    unselectedTextColor = WeddingIdentityPalette.Muted
                                )
                            )
                        }
                    }
                    VerticalDivider(thickness = 1.dp, color = WeddingIdentityPalette.Hairline)
                }

                Box(modifier = Modifier.weight(1f)) { workspace() }
            }
        }
    }
}

/** Width at which Level-1 moves from a bottom bar to a navigation rail (IA V2 §15.2). */
internal val TABLET_RAIL_BREAKPOINT = 600.dp

/** The rail's own width. Wide enough for the longest destination label without truncation. */
internal val TABLET_RAIL_WIDTH = 104.dp

/** IA V2 §1.2 — role and active wedding must never be ambiguous. */
@Composable
private fun RoleContextBar(
    context: NavigationContext,
    onSwitchPersona: (() -> Unit)?
) {
    Surface(color = WeddingIdentityPalette.IvorySoft) {
        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 10.dp)
                    .testTag("role-context-bar"),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        IANavigationContract.forRole(context.activeRole).displayName,
                        color = WeddingIdentityPalette.Ink,
                        fontFamily = FontFamily.Serif,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 17.sp,
                        maxLines = 1,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                    )
                    Text(
                        context.activeWeddingTitle,
                        color = WeddingIdentityPalette.Muted,
                        fontSize = 12.sp,
                        maxLines = 1,
                        // Without this the title is hard-clipped mid-word on a small phone —
                        // "Charity & Kudzie" became "Charity &", which reads as a rendering bug
                        // rather than as truncation.
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                        modifier = Modifier.testTag("active-wedding-label")
                    )
                }
                Surface(
                    shape = RoundedCornerShape(50),
                    color = WeddingIdentityPalette.ForestSoft
                ) {
                    Text(
                        context.environment.title,
                        color = WeddingIdentityPalette.Forest,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                            .testTag("environment-badge")
                    )
                }
                onSwitchPersona?.let {
                    IconButton(onClick = it, modifier = Modifier.testTag("role-switch-button")) {
                        Icon(
                            Icons.Default.ManageAccounts,
                            contentDescription = "Switch role",
                            tint = WeddingIdentityPalette.ChampagneDeep
                        )
                    }
                }
            }
            HorizontalDivider(thickness = 1.dp, color = WeddingIdentityPalette.Hairline)
        }
    }
}

/** IA V2 §14 — explain the boundary, leak no destination data, offer a safe return. */
@Composable
private fun AccessBoundaryNotice(reason: String, onDismiss: (() -> Unit)?) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
            .testTag("access-boundary-notice"),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            Icons.Default.Lock,
            contentDescription = null,
            tint = WeddingIdentityPalette.Muted,
            modifier = Modifier.size(34.dp)
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            "Not available for this role",
            color = WeddingIdentityPalette.Ink,
            fontFamily = FontFamily.Serif,
            fontWeight = FontWeight.SemiBold,
            fontSize = 18.sp
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            reason,
            color = WeddingIdentityPalette.Muted,
            fontSize = 13.sp
        )
        Spacer(modifier = Modifier.height(16.dp))
        // Offered only when there is an authorized destination to go back to.
        if (onDismiss != null) {
            TextButton(onClick = onDismiss, modifier = Modifier.testTag("access-boundary-dismiss")) {
                Text("Go back", color = WeddingIdentityPalette.ChampagneDeep, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

/**
 * Level-2 workspace selector. Renders the documented section taxonomy as chips; depth lives here
 * rather than in the bottom bar (IA V2 §1.1).
 */
@Composable
fun WorkspaceSectionChips(
    sections: List<String>,
    selected: String,
    testTagPrefix: String,
    onSelect: (String) -> Unit
) {
    if (sections.isEmpty()) return
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 14.dp, vertical = 8.dp)
            .testTag("$testTagPrefix-sections"),
        horizontalArrangement = Arrangement.spacedBy(7.dp)
    ) {
        sections.forEach { section ->
            val isSelected = section == selected
            Surface(
                shape = RoundedCornerShape(50),
                color = if (isSelected) WeddingIdentityPalette.ChampagneDeep else WeddingIdentityPalette.IvorySoft,
                border = if (isSelected) null else androidx.compose.foundation.BorderStroke(1.dp, WeddingIdentityPalette.Hairline),
                onClick = { onSelect(section) },
                modifier = Modifier.testTag("$testTagPrefix-section-${section.slug()}")
            ) {
                Text(
                    section,
                    color = if (isSelected) WeddingIdentityPalette.IvorySoft else WeddingIdentityPalette.Muted,
                    fontSize = 11.sp,
                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                    maxLines = 1,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp)
                )
            }
        }
    }
}

internal fun String.slug(): String =
    lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-')

private fun iconFor(destinationId: String): ImageVector = when (destinationId) {
    "home" -> Icons.Default.Home
    "plan", "workspace" -> Icons.Default.CalendarMonth
    "guests" -> Icons.Default.Group
    "wedding_day" -> Icons.Default.Celebration
    "clients" -> Icons.Default.FolderSpecial
    "daily_ops" -> Icons.Default.Bolt
    "invitation" -> Icons.Default.MailOutline
    "pass" -> Icons.Default.QrCode
    "jobs" -> Icons.Default.Storefront
    "schedule" -> Icons.Default.Schedule
    "messages" -> Icons.Default.Email
    "scan" -> Icons.Default.QrCodeScanner
    "admissions" -> Icons.Default.HowToReg
    "incidents" -> Icons.Default.ReportProblem
    "today" -> Icons.Default.Today
    "run_sheet" -> Icons.Default.Checklist
    "team" -> Icons.Default.Groups
    "dashboard" -> Icons.Default.Dns
    "cases" -> Icons.Default.SupportAgent
    "accounts" -> Icons.Default.ManageAccounts
    "audit" -> Icons.Default.Shield
    else -> Icons.Default.Menu
}
