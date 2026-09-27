package pro.wewed.app

import java.io.File
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.navigation.GrantScopeKind
import pro.wewed.app.navigation.GrantWorkspaceKind
import pro.wewed.app.navigation.ProductionWorkspaceGrant
import pro.wewed.app.state.NativeLaunchConfiguration
import pro.wewed.app.state.NativeServerLane
import pro.wewed.app.state.NativeServerOrigin
import pro.wewed.app.ui.workspace.WorkspaceGrantPresentation

/**
 * QRO04-UI01 regression guards (D-084/D-085). Shadow is a qualification harness, never product
 * evidence: production_preview must resolve the real production runtime, never apply a persona or
 * offer persona switching, route an invitation-bound Guest to the final Live Guest shell, and the
 * workspace selector / context switcher must never show an internal identifier. Mirrors iOS
 * `FinalNativeUiLaneRegressionTests`.
 */
class FinalNativeUiLaneRegressionTest {
    @After fun resetLane() = NativeServerOrigin.activate(NativeServerLane.Production)

    private fun preview() = NativeLaunchConfiguration.resolve(
        rawEnvironment = "production_preview",
        shadowBaseUrl = null,
        isDebugBuild = true,
        previewOrigin = "https://wewed-abc123def-11-11.vercel.app",
    )

    @Test fun productionPreviewResolvesTheProductionEnvironment() {
        val config = preview()
        assertEquals(NativeDataEnvironment.PRODUCTION, config.environment)
        assertTrue(config.lane is NativeServerLane.ProductionPreview)
    }

    @Test fun productionPreviewCannotApplyADevelopmentPersonaOrOfferTheShadowEntry() {
        assertFalse(preview().environment.allowsDevelopmentPersonaSwitching)
        for (environment in listOf(NativeDataEnvironment.PRODUCTION, NativeDataEnvironment.PRODUCTION_READ_VERIFY)) {
            assertFalse("$environment", environment.allowsDevelopmentPersonaSwitching)
            assertFalse("$environment", environment.allowsMutableNativeDevelopment)
        }
        val activity = source("MainActivity.kt")
        assertTrue(activity.contains("if (launch.environment.allowsDevelopmentPersonaSwitching) {\n            intent.getStringExtra(EXTRA_NATIVE_PERSONA)"))
        val root = source("ui/RootScreen.kt")
        assertTrue("the persona picker only renders where switching is allowed", root.contains("if (showPersonaPicker && personaSwitchingAllowed) {"))
        val login = source("ui/auth/LoginScreen.kt")
        assertTrue("the Shadow sign-in entry is gated", login.contains("if (environment.allowsDevelopmentPersonaSwitching) {"))
    }

    @Test fun invitationBoundProductionGuestDispatchesToTheLiveGuestShell() {
        val activity = source("MainActivity.kt")
        assertTrue(activity.contains("if (hasInvitation || hasRememberedGuest) {"))
        assertTrue(activity.contains("GuestOnlyInvitationShell("))
        val guestOnly = source("ui/invitation/GuestOnlyInvitationShell.kt")
        assertTrue(guestOnly.contains("LiveGuestInvitationScreen("))
        assertTrue(guestOnly.contains("LiveGuestShell("))
        assertFalse("the final Guest-only shell must never host the Shadow GuestShell",
            Regex("(?<!Live)GuestShell\\(").containsMatchIn(guestOnly))
        val root = source("ui/RootScreen.kt")
        assertTrue(root.contains("is LiveInvitationState.Presenting ->"))
        assertTrue(root.contains("LiveGuestInvitationScreen(\n                    presentation = LiveInvitationPresentation.from(live.snapshot)"))
    }

    @Test fun pendingGuestCannotBypassRsvpAndCanLeaveRememberedWedding() {
        val invitation = source("ui/invitation/LiveGuestInvitationScreen.kt")
        assertTrue(invitation.contains("onContinue = if (presentation.attending == null) null else onContinue"))
        assertTrue(invitation.contains("invitation-leave-wedding"))
        val shell = source("ui/invitation/GuestOnlyInvitationShell.kt")
        assertTrue(shell.contains("GuestCapabilityPolicy.mayEnterPersistentExperience"))
        assertTrue(shell.contains("onLeaveWedding = onForgetWedding"))
        val activity = source("MainActivity.kt")
        assertTrue(activity.contains("private fun leaveGuestMode()"))
        assertTrue(activity.contains("GuestInvitationBootstrap.forgetGuest(applicationContext)"))
    }

    @Test fun productionReadOnlySurfaceDoesNotExposeRawPermissionKeysOrBlueFallbackLinks() {
        val readOnly = source("ui/roles/ProductionReadOnlyWorkspaceContent.kt")
        assertFalse(readOnly.contains("snapshot.permissions.joinToString"))
        assertTrue(readOnly.contains("authorized capabilities"))
        assertTrue(readOnly.contains("Switch workspace"))
        assertTrue(readOnly.contains("WeddingIdentityPalette.Champagne"))
    }

    @Test fun sharedRoleHeaderRespectsAndroidStatusBarInsets() {
        val shell = source("ui/roles/RoleShellScaffold.kt")
        assertTrue(
            "the shared role header must stay below camera/status-bar insets",
            shell.contains("Column(modifier = Modifier.statusBarsPadding())")
        )
    }


    @Test fun grantTitlesPreferHumanNamesAndNeverFallBackToIdentifiers() {
        val portfolio = grant("planner-dea0757e-cc3d-42f6-a394-abf18e9cf742", GrantWorkspaceKind.PLANNER, GrantScopeKind.PORTFOLIO,
            business = "planner-dea0757e-cc3d-42f6-a394-abf18e9cf742")
        val unnamed = WorkspaceGrantPresentation.of(portfolio)
        assertEquals("Planner Portfolio", unnamed.title)
        assertEquals("Professional Planner", unnamed.roleLabel)
        assertNoIdentifier(unnamed, portfolio)
        assertEquals("Eleven Eleven Events",
            WorkspaceGrantPresentation.of(portfolio, businessNamesById = mapOf(portfolio.businessAccountId!! to "Eleven Eleven Events")).title)

        val wedding = grant("planner:wedding:cmqos70cb0004q6vxe9g9aiu5", GrantWorkspaceKind.PLANNER, GrantScopeKind.WEDDING,
            weddingId = "cmqos70cb0004q6vxe9g9aiu5", title = "Charity & Kudzie")
        assertEquals("Charity & Kudzie", WorkspaceGrantPresentation.of(wedding).title)

        val vendor = grant("vendor-7f0c2a4e-1111-4222-8333-944455556666", GrantWorkspaceKind.VENDOR, GrantScopeKind.BUSINESS,
            vendor = "cm1vendor00000000000000000")
        assertEquals("Vendor Business", WorkspaceGrantPresentation.of(vendor).title)
        assertEquals("FAUME MEDIA", WorkspaceGrantPresentation.of(vendor, vendorNamesById = mapOf("cm1vendor00000000000000000" to "FAUME MEDIA")).title)
        assertNoIdentifier(WorkspaceGrantPresentation.of(vendor), vendor)

        assertEquals("Wewed Administration", WorkspaceGrantPresentation.of(grant("admin:system", GrantWorkspaceKind.ADMIN, GrantScopeKind.SYSTEM)).title)
        // A "name" that is itself an identifier is refused, never displayed.
        assertEquals("Planner Portfolio",
            WorkspaceGrantPresentation.of(portfolio, businessNamesById = mapOf(portfolio.businessAccountId!! to portfolio.grantId)).title)
    }

    @Test fun selectorAndSwitcherSourcesNeverRenderAGrantIdentifier() {
        val selection = source("ui/workspace/WorkspaceSelection.kt")
        assertFalse(selection.contains("?: grant.grantId"))
        assertFalse(selection.contains("?: grant.businessAccountId"))
        assertFalse(Regex("""Text\([^)]*grant\.(grantId|businessAccountId|vendorId)""").containsMatchIn(selection))
        val root = source("ui/RootScreen.kt")
        assertFalse("the old raw-identifier selector must not return", root.contains("grant.weddingTitle ?: grant.businessAccountId ?: grant.grantId"))
        assertFalse(root.contains("else -> \"\$kindLabel · \${grant.grantId}\""))
        assertTrue(root.contains("WorkspaceGrantSelectionScreen(") && root.contains("WorkspaceContextSwitcherDialog("))
    }

    private fun assertNoIdentifier(p: WorkspaceGrantPresentation, g: ProductionWorkspaceGrant) {
        for (visible in listOf(p.title, p.roleLabel, p.scopeLabel)) {
            for (id in listOfNotNull(g.grantId, g.businessAccountId, g.vendorId, g.weddingId)) {
                assertFalse("$visible exposes $id", visible.contains(id))
            }
            assertFalse(visible, WorkspaceGrantPresentation.looksLikeIdentifier(visible))
        }
    }

    private fun grant(
        id: String, kind: GrantWorkspaceKind, scope: GrantScopeKind,
        weddingId: String? = null, title: String? = null, business: String? = null, vendor: String? = null,
    ) = ProductionWorkspaceGrant(
        grantId = id, workspaceKindWire = kind.wire ?: "unknown", workspaceKind = kind,
        scopeKindWire = scope.wire ?: "unknown", scopeKind = scope, weddingId = weddingId, weddingTitle = title,
        coupleId = null, businessAccountId = business, vendorId = vendor,
        serviceEngagementIds = emptyList(), permissions = emptyList(), platformRoles = emptyList(),
    )


    @Test fun rsvpFormConsumesSystemBackInsteadOfClosingTheApp() {
        val screen = source("ui/invitation/LiveGuestInvitationScreen.kt")
        val form = screen.substring(screen.indexOf("fun LiveRsvpForm("))
        assertTrue("the RSVP form must close on Back, not finish the Activity",
            form.contains("BackHandler(enabled = !isSubmitting, onBack = onDismiss)"))
    }

    @Test fun workspaceSelectorKeepsContentOutOfTheSystemBars() {
        val selection = source("ui/workspace/WorkspaceSelection.kt")
        val screen = selection.substring(selection.indexOf("fun WorkspaceGrantSelectionScreen("), selection.indexOf("fun WorkspaceContextSwitcherDialog("))
        assertTrue(screen.contains(".statusBarsPadding()") && screen.contains(".navigationBarsPadding()"))
    }

    @Test fun fullScreenReadOnlyWorkspaceIsInsetAndShowsNoWireKinds() {
        val content = source("ui/roles/ProductionReadOnlyWorkspaceContent.kt")
        assertTrue(content.contains("if (applySystemBarInsets) Modifier.statusBarsPadding().navigationBarsPadding() else Modifier"))
        assertFalse("wire kind/scope must not be shown", content.contains("\${snapshot.workspaceKind.replaceFirstChar"))
        val root = source("ui/RootScreen.kt")
        assertEquals(2, Regex("applySystemBarInsets = true").findAll(root).count())
    }

    // QRO05-PIQR01 — Planner Invitations & QR reads real data, read-only.

    @Test fun productionPlannerInvitationsQrRendersRealDataNotThePlaceholder() {
        val workspaces = source("ui/roles/RoleWorkspaces.kt")
        assertTrue(workspaces.contains("PlannerInvitationsQrSection(load = { production.loadPlannerInvitations() })"))
        val sections = source("ui/roles/ProductionDataSections.kt")
        assertFalse("the not-loaded placeholder must be gone", sections.contains("The app does not load them yet."))
        val view = source("ui/roles/PlannerInvitationsQrSection.kt")
        for (heading in listOf("\"Invitation design\"", "\"Printed Invitation Access\"", "\"Guest Open Invitations\"")) {
            assertTrue(heading, view.contains(heading))
        }
    }

    @Test fun invitationQrsAreSeparateTrustDomainsFromTheWeddingPass() {
        val view = source("ui/roles/PlannerInvitationsQrSection.kt")
        assertTrue(view.contains("testTag = \"planner-physical-invitation-qr\""))
        assertTrue(view.contains("testTag = \"planner-guest-invitation-qr\""))
        assertFalse(view.contains("wedding-pass-qr"))
        assertFalse(view.contains("WeddingQrCode("))
        val pass = source("ui/pass/WeddingQrCode.kt")
        assertTrue(pass.contains("testTag = \"wedding-pass-qr\""))
    }

    @Test fun invitationLinksAreNeverRenderedAsTextLoggedOrStoredInTheGraph() {
        val view = source("ui/roles/PlannerInvitationsQrSection.kt")
        assertFalse(Regex("""Text\(\s*[^)]*(qrValue|shareMessage|accessUrl)""").containsMatchIn(view))
        assertFalse(Regex("""contentDescription = [^\n]*(qrValue|shareMessage|accessUrl)""").containsMatchIn(view))
        assertFalse(view.contains("Log.") || view.contains("println("))
        val graph = source("ui/roles/RoleWorkspaceContent.kt")
        assertFalse(graph.contains("loadPlannerInvitations"))
        assertFalse(graph.contains("PlannerGuestInvitation"))
        val repository = source("services/WeddingRepository.kt")
        assertFalse("must never join the graph-loading interface", repository.contains("loadPlannerInvitations"))
    }

    @Test fun nativeInvitationClientIsReadOnly() {
        val client = source("services/NativeDomainApiClient.kt")
        val lines = client.lines().filter { it.contains("api/native/wedding/invitations") }
        assertEquals(2, lines.size)
        lines.forEach { assertTrue("invitation routes are GET-only: $it", it.trim().startsWith("runGet(\"")) }
    }

    private fun source(relative: String): String {
        var dir: File? = File(System.getProperty("user.dir") ?: ".").absoluteFile
        while (dir != null) {
            for (base in listOf("app/src/main/java/pro/wewed/app", "src/main/java/pro/wewed/app")) {
                val candidate = File(dir, "$base/$relative")
                if (candidate.isFile) return candidate.readText()
            }
            dir = dir.parentFile
        }
        error("$relative not found")
    }
}
