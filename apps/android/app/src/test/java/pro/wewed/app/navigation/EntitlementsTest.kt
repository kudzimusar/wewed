package pro.wewed.app.navigation

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import pro.wewed.app.models.AppRole
import pro.wewed.app.models.NativeDataEnvironment
import java.io.File

/**
 * Role-boundary and data-pipeline assertions for IA V2 §13.
 *
 * These are the tests that would fail if a role gained access to another role's workspace, or if
 * a navigation transition dropped the active wedding identity.
 */
class EntitlementsTest {

    private val contract: JSONObject by lazy {
        var dir: File? = File(System.getProperty("user.dir") ?: ".").absoluteFile
        while (dir != null) {
            val candidate = File(dir, "mobile/contracts/ia-v2-navigation.json")
            if (candidate.isFile) return@lazy JSONObject(candidate.readText())
            dir = dir.parentFile
        }
        throw IllegalStateException("Shared IA V2 contract not found")
    }

    private fun contextFor(
        role: AppRole,
        weddingId: String = "cmqos70cb0004q6vxe9g9aiu5"
    ) = NavigationContext(
        actorId = "actor_test",
        activeRole = role,
        activeWeddingId = weddingId,
        activeWeddingTitle = "Charity & Kudzie",
        environment = NativeDataEnvironment.FIXTURE
    )

    @Test
    fun `granted capabilities match the shared contract`() {
        val json = contract.getJSONObject("capabilities")
        AppRole.entries.forEach { role ->
            val array = json.getJSONArray(role.roleId)
            val expected = (0 until array.length()).map { array.getString(it) }.toSet()
            assertEquals(
                "Capabilities diverged for ${role.roleId}",
                expected,
                Entitlements.capabilities(role)
            )
        }
    }

    @Test
    fun `denied capability assertions from the shared contract hold`() {
        val denied = contract.getJSONObject("deniedCapabilityAssertions")
        AppRole.entries.forEach { role ->
            val array = denied.getJSONArray(role.roleId)
            (0 until array.length()).forEach { index ->
                val capability = array.getString(index)
                assertFalse(
                    "${role.roleId} must NOT hold capability $capability",
                    Entitlements.can(role, capability)
                )
            }
        }
    }

    @Test
    fun `every role can reach every destination its own contract declares`() {
        IANavigationContract.all.forEach { (role, navigation) ->
            navigation.primary.forEach { destination ->
                val resolution = Entitlements.resolve(contextFor(role), destination.id)
                assertTrue(
                    "${role.roleId} cannot reach its own destination ${destination.id}: $resolution",
                    resolution is Entitlements.Resolution.Allowed
                )
            }
        }
    }

    @Test
    fun `a role cannot reach another role's destinations`() {
        val foreignDestinations = mapOf(
            AppRole.GUEST to listOf("workspace", "clients", "daily_ops", "dashboard", "audit", "scan", "admissions"),
            AppRole.VENDOR to listOf("workspace", "clients", "guests", "scan", "audit", "plan"),
            AppRole.USHER to listOf("plan", "workspace", "budget", "clients", "dashboard"),
            AppRole.COORDINATOR to listOf("clients", "dashboard", "audit", "plan"),
            AppRole.COUPLE to listOf("clients", "daily_ops", "dashboard", "audit", "scan"),
            AppRole.PLANNER to listOf("dashboard", "audit", "cases", "accounts"),
            AppRole.ADMIN to listOf("plan", "workspace", "scan", "pass")
        )
        foreignDestinations.forEach { (role, destinations) ->
            destinations.forEach { destinationId ->
                val resolution = Entitlements.resolve(contextFor(role), destinationId)
                assertTrue(
                    "${role.roleId} must not reach foreign destination $destinationId",
                    resolution is Entitlements.Resolution.Denied
                )
            }
        }
    }

    @Test
    fun `denied resolution offers a safe return and leaks no destination data`() {
        val resolution = Entitlements.resolve(contextFor(AppRole.GUEST), "workspace")
        assertTrue(resolution is Entitlements.Resolution.Denied)
        val denied = resolution as Entitlements.Resolution.Denied
        assertEquals("home", denied.safeReturnDestinationId)
        assertTrue(denied.reason.isNotBlank())
        // The couple's wedding title / planner data must not appear in a denial message.
        assertFalse(denied.reason.contains("Charity"))
    }

    @Test
    fun `a missing active wedding blocks every repository-backed destination`() {
        val resolution = Entitlements.resolve(contextFor(AppRole.COUPLE, weddingId = ""), "plan")
        assertTrue(
            "A blank active wedding must not resolve to a repository-backed workspace",
            resolution is Entitlements.Resolution.Denied
        )
    }

    // --- IA V2 §13.2 context preservation ---

    @Test
    fun `navigating between destinations preserves the wedding identity`() {
        val context = contextFor(AppRole.PLANNER)
        val route = listOf("clients", "workspace", "daily_ops", "wedding_day", "more")
        route.forEach { destinationId ->
            val resolution = Entitlements.resolve(context, destinationId)
            assertTrue(resolution is Entitlements.Resolution.Allowed)
            val allowed = resolution as Entitlements.Resolution.Allowed
            assertEquals(
                "Wedding identity changed while navigating to $destinationId",
                context.activeWeddingId,
                allowed.context.activeWeddingId
            )
        }
    }

    @Test
    fun `switching wedding keeps the new identity across the whole workspace`() {
        val switched = contextFor(AppRole.PLANNER).withWedding("wed_other_001", "Other Wedding")
        IANavigationContract.forRole(AppRole.PLANNER).primary.forEach { destination ->
            val resolution = Entitlements.resolve(switched, destination.id)
            val allowed = resolution as Entitlements.Resolution.Allowed
            assertEquals("wed_other_001", allowed.context.activeWeddingId)
        }
    }

    @Test
    fun `role switch drops scopes the new role does not own`() {
        val planner = contextFor(AppRole.PLANNER).copy(
            activeClientId = "client_1",
            activeGateId = "Gate A",
            activeEngagementId = "eng_1"
        )
        val asGuest = planner.withRole(AppRole.GUEST)
        assertNull("Guest must not inherit planner client scope", asGuest.activeClientId)
        assertNull("Guest must not inherit gate scope", asGuest.activeGateId)
        assertNull("Guest must not inherit vendor engagement scope", asGuest.activeEngagementId)
        assertEquals(
            "Wedding identity must survive a role switch",
            planner.activeWeddingId,
            asGuest.activeWeddingId
        )
    }

    @Test
    fun `gate role retains its gate scope across a role switch into gate`() {
        val context = contextFor(AppRole.COORDINATOR).copy(activeGateId = "Gate A")
        val asUsher = context.withRole(AppRole.USHER)
        assertEquals("Gate A", asUsher.activeGateId)
    }

    @Test
    fun `context label names the role and the active wedding`() {
        val label = contextFor(AppRole.PLANNER).contextLabel
        assertTrue(label.contains("Professional Planner"))
        assertTrue(label.contains("Charity & Kudzie"))
    }
}
