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
