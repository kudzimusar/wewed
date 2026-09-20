package pro.wewed.app.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import pro.wewed.app.models.AppRole
import pro.wewed.app.models.NativeDataEnvironment

/**
 * Playbook §22 (Step 20) role-navigation qualification.
 *
 * Each journey walks a role's documented route end to end and asserts at every hop that the
 * destination resolves, the Level-2 section exists in the contract, and the active wedding
 * identity is unchanged.
 */
class RoleJourneyTest {

    private fun context(role: AppRole) =
        AuthorizedContexts.authorized(role, NativeDataEnvironment.PRIVATE_REAL_SHADOW)

    /** Walks destinations, asserting each resolves and never changes the wedding identity. */
    private fun walk(role: AppRole, vararg destinationIds: String) {
        val start = context(role)
        destinationIds.forEach { destinationId ->
            val resolution = Entitlements.resolve(start, destinationId)
            assertTrue(
                "${role.roleId} could not reach $destinationId: $resolution",
                resolution is Entitlements.Resolution.Allowed
            )
            val allowed = resolution as Entitlements.Resolution.Allowed
            assertEquals(
                "Wedding identity lost navigating to $destinationId",
                start.activeWeddingId,
                allowed.context.activeWeddingId
            )
        }
    }

    private fun assertSection(role: AppRole, destinationId: String, section: String) {
        val sections = IANavigationContract.forRole(role).sections(destinationId)
        assertTrue(
            "${role.roleId}/$destinationId has no documented section '$section' (has $sections)",
            sections.contains(section)
        )
    }

    @Test
    fun `couple journey Home to Plan Budget back to Guests Wedding Day More`() {
        walk(AppRole.COUPLE, "home", "plan", "guests", "wedding_day", "more")
        assertSection(AppRole.COUPLE, "plan", "Budget")
        assertSection(AppRole.COUPLE, "wedding_day", "My Pass")
        // Returning to a previously visited workspace keeps the same wedding.
        walk(AppRole.COUPLE, "plan", "home")
    }

    @Test
    fun `planner journey Clients to Workspace Guests Daily Ops Wedding Day More Planner Actions`() {
        walk(AppRole.PLANNER, "clients", "workspace", "daily_ops", "wedding_day", "more")
        assertSection(AppRole.PLANNER, "clients", "Active Weddings")
        assertSection(AppRole.PLANNER, "workspace", "Guests")
        assertSection(AppRole.PLANNER, "more", "Planner Actions")
    }

    @Test
    fun `guest journey Home Invitation RSVP Pass Wedding Day More`() {
        walk(AppRole.GUEST, "home", "invitation", "pass", "wedding_day", "more")
        assertSection(AppRole.GUEST, "invitation", "RSVP")
        assertSection(AppRole.GUEST, "pass", "Wedding Pass")
    }

    @Test
    fun `vendor journey Home Job Schedule Messages More`() {
        walk(AppRole.VENDOR, "home", "jobs", "schedule", "messages", "more")
        assertSection(AppRole.VENDOR, "jobs", "Service Details")
        assertSection(AppRole.VENDOR, "schedule", "Calendar")
    }

    @Test
    fun `gate journey Scan Admissions Guest lookup Incident More offline status`() {
        walk(AppRole.USHER, "scan", "admissions", "guests", "incidents", "more")
        assertSection(AppRole.USHER, "admissions", "Manual Admission")
        assertSection(AppRole.USHER, "incidents", "Admission Exception")
        assertSection(AppRole.USHER, "more", "Offline Status")
    }

    @Test
    fun `coordinator journey Today Run Sheet Team Wedding Day More`() {
        walk(AppRole.COORDINATOR, "today", "run_sheet", "team", "wedding_day", "more")
        assertSection(AppRole.COORDINATOR, "team", "Assignments")
        assertSection(AppRole.COORDINATOR, "wedding_day", "Programme Status")
    }

    @Test
    fun `admin journey Dashboard Case Account Audit More`() {
        walk(AppRole.ADMIN, "dashboard", "cases", "accounts", "audit", "more")
        assertSection(AppRole.ADMIN, "accounts", "Role Memberships")
        assertSection(AppRole.ADMIN, "audit", "Check-ins")
    }

    // --- Role-boundary assertions on every journey (playbook §22) ---

    @Test
    fun `no journey crosses into another role's workspace`() {
        val everyDestinationId = IANavigationContract.all.values
            .flatMap { it.primary }
            .map { it.id }
            .toSet()

        IANavigationContract.all.forEach { (role, navigation) ->
            val ownIds = navigation.primary.map { it.id }.toSet()
            (everyDestinationId - ownIds).forEach { foreignId ->
                val resolution = Entitlements.resolve(context(role), foreignId)
                assertTrue(
                    "${role.roleId} must be denied foreign destination $foreignId",
                    resolution is Entitlements.Resolution.Denied
                )
            }
        }
    }

    @Test
    fun `private real shadow environment still resolves every role journey`() {
        // Shadow qualification must exercise the same routes as fixture (playbook §23).
        IANavigationContract.all.forEach { (role, navigation) ->
            val shadowContext = context(role)
            navigation.primary.forEach { destination ->
                val resolution = Entitlements.resolve(shadowContext, destination.id)
                assertTrue(
                    "${role.roleId}/${destination.id} failed under PRIVATE_REAL_SHADOW",
                    resolution is Entitlements.Resolution.Allowed
                )
            }
        }
    }

    @Test
    fun `wedding identity survives an entire multi role journey`() {
        // Simulates switching roles on the same wedding, as a planner-owned account would.
        val original = AuthorizedContexts.WEDDING
        listOf(AppRole.PLANNER, AppRole.COORDINATOR, AppRole.USHER, AppRole.COUPLE).forEach { role ->
            // Each role re-resolves its own assignment; nothing is inherited from the previous role.
            val ctx = context(role)
            IANavigationContract.forRole(role).primary.forEach { destination ->
                val resolution = Entitlements.resolve(ctx, destination.id)
                assertTrue(
                    "${role.roleId}/${destination.id} unreachable after role switch",
                    resolution is Entitlements.Resolution.Allowed
                )
            }
            assertEquals("Wedding identity lost switching to ${role.roleId}", original, ctx.activeWeddingId)
        }
    }
}
