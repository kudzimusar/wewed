package pro.wewed.app.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import pro.wewed.app.models.AppRole
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.models.NativeDeepLink
import pro.wewed.app.models.NativeDeepLinkParser

/** IA V2 §14 — a deep link must never bypass entitlement checks. */
class DeepLinkRouterTest {

    private fun context(role: AppRole, weddingId: String = AuthorizedContexts.WEDDING) =
        AuthorizedContexts.authorized(role, weddingId = weddingId)

    @Test
    fun `canonical workspace deep links parse to their documented destination`() {
        val plan = NativeDeepLinkParser.parse("wewed://wedding/wed_1/plan/tasks")
        assertTrue(plan is NativeDeepLink.Workspace)
        assertEquals("plan", (plan as NativeDeepLink.Workspace).destinationId)
        assertEquals("tasks", plan.section)

        val day = NativeDeepLinkParser.parse("wewed://wedding/wed_1/day/programme")
        assertEquals("wedding_day", (day as NativeDeepLink.Workspace).destinationId)

        val guests = NativeDeepLinkParser.parse("wewed://wedding/wed_1/guests")
        assertEquals("guests", (guests as NativeDeepLink.Workspace).destinationId)

        val clients = NativeDeepLinkParser.parse("wewed://planner/clients/wed_1")
        assertEquals("clients", (clients as NativeDeepLink.Workspace).destinationId)

        val jobs = NativeDeepLinkParser.parse("wewed://vendor/jobs/eng_1")
        assertEquals("jobs", (jobs as NativeDeepLink.Workspace).destinationId)
        assertEquals("eng_1", jobs.entityId)

        val scan = NativeDeepLinkParser.parse("wewed://gate/gate_a/scan")
        assertEquals("scan", (scan as NativeDeepLink.Workspace).destinationId)

        val cases = NativeDeepLinkParser.parse("wewed://admin/cases/case_1")
        assertEquals("cases", (cases as NativeDeepLink.Workspace).destinationId)
    }

    @Test
    fun `invitation deep link still resolves the RSVP continuity route`() {
        // RSVP -> Pass continuity must survive the IA V2 upgrade.
        val legacy = NativeDeepLinkParser.parse("https://wewed.pro/invite/charity-kudzie?rsvp=token123")
        assertTrue(legacy is NativeDeepLink.Invitation)
        assertEquals("token123", (legacy as NativeDeepLink.Invitation).value.rsvpToken)

        val canonical = NativeDeepLinkParser.parse("wewed://wedding/wed_1/invitation/token456")
        assertTrue(canonical is NativeDeepLink.Invitation)
        assertEquals("token456", (canonical as NativeDeepLink.Invitation).value.rsvpToken)
    }

    @Test
    fun `a pass link lands in the workspace that owns the pass for each role`() {
        assertEquals("pass", DeepLinkRouter.destinationFor(NativeDeepLink.Pass(), AppRole.GUEST))
        assertEquals("wedding_day", DeepLinkRouter.destinationFor(NativeDeepLink.Pass(), AppRole.COUPLE))
        assertEquals("scan", DeepLinkRouter.destinationFor(NativeDeepLink.Pass(), AppRole.USHER))
        assertNull(DeepLinkRouter.destinationFor(NativeDeepLink.Pass(), AppRole.ADMIN))
    }

    @Test
    fun `an unauthorized deep link is denied with a safe return`() {
        // A guest handed a planner workspace link must not reach it.
        val link = NativeDeepLink.Workspace(AuthorizedContexts.WEDDING, "workspace")
        val resolution = DeepLinkRouter.resolve(link, context(AppRole.GUEST))
        assertTrue(resolution is Entitlements.Resolution.Denied)
        assertEquals("home", (resolution as Entitlements.Resolution.Denied).safeReturnDestinationId)
        assertNull(DeepLinkRouter.allowedDestination(link, context(AppRole.GUEST)))
    }

    @Test
    fun `an admin deep link is denied to every non admin role`() {
        val link = NativeDeepLink.Workspace(null, "audit")
        listOf(AppRole.COUPLE, AppRole.PLANNER, AppRole.GUEST, AppRole.VENDOR, AppRole.USHER, AppRole.COORDINATOR)
            .forEach { role ->
                assertTrue(
                    "$role must not open an admin audit link",
                    DeepLinkRouter.resolve(link, context(role)) is Entitlements.Resolution.Denied
                )
            }
        assertEquals("audit", DeepLinkRouter.allowedDestination(link, context(AppRole.ADMIN)))
    }

    @Test
    fun `a link naming a different wedding never rebinds the active context`() {
        val foreign = NativeDeepLink.Workspace("wed_OTHER", "plan")
        val resolution = DeepLinkRouter.resolve(foreign, context(AppRole.COUPLE))
        assertTrue(resolution is Entitlements.Resolution.Denied)
        assertTrue(
            (resolution as Entitlements.Resolution.Denied).reason.contains("different wedding")
        )
    }

    @Test
    fun `an authorized deep link resolves without changing the active wedding`() {
        val link = NativeDeepLink.Workspace(AuthorizedContexts.WEDDING, "plan")
        val ctx = context(AppRole.COUPLE)
        val resolution = DeepLinkRouter.resolve(link, ctx)
        assertTrue(resolution is Entitlements.Resolution.Allowed)
        val allowed = resolution as Entitlements.Resolution.Allowed
        assertEquals("plan", allowed.destination.id)
        assertEquals(AuthorizedContexts.WEDDING, allowed.context.activeWeddingId)
    }
}
