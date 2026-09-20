package pro.wewed.app.navigation

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import pro.wewed.app.models.AppRole
import java.io.File

/**
 * Locks the Android IA V2 navigation declaration to the shared cross-platform contract.
 *
 * The iOS target runs the equivalent assertions against the same file, so if these tests pass on
 * both platforms the bottom-navigation labels, order and Level-2 taxonomy are provably identical.
 */
class IANavigationContractTest {

    private val contract: JSONObject by lazy {
        JSONObject(sharedContractFile().readText())
    }

    private fun sharedContractFile(): File {
        var dir: File? = File(System.getProperty("user.dir") ?: ".").absoluteFile
        while (dir != null) {
            val candidate = File(dir, "mobile/contracts/ia-v2-navigation.json")
            if (candidate.isFile) return candidate
            dir = dir.parentFile
        }
        throw IllegalStateException("Shared IA V2 contract not found from ${System.getProperty("user.dir")}")
    }

    private fun jsonRole(roleId: String): JSONObject =
        contract.getJSONObject("roles").getJSONObject(roleId)

    private fun jsonList(obj: JSONObject, key: String): List<String> {
        val array = obj.getJSONArray(key)
        return (0 until array.length()).map { array.getString(it) }
    }

    @Test
    fun `contract id matches shared contract`() {
        assertEquals(contract.getString("contractId"), IANavigationContract.CONTRACT_ID)
    }

    @Test
    fun `every role in the shared contract is declared on Android`() {
        val jsonRoles = contract.getJSONObject("roles").keys().asSequence().toSet()
        val kotlinRoles = IANavigationContract.all.keys.map { it.roleId }.toSet()
        assertEquals(jsonRoles, kotlinRoles)
    }

    @Test
    fun `level 1 labels and order match the shared contract for every role`() {
        IANavigationContract.all.forEach { (role, navigation) ->
            val expected = jsonRole(role.roleId).getJSONArray("primary")
            val expectedLabels = (0 until expected.length())
                .map { expected.getJSONObject(it).getString("label") }
            assertEquals(
                "Level-1 labels diverged for ${role.roleId}",
                expectedLabels,
                navigation.labels
            )
        }
    }

    @Test
    fun `level 1 destination ids match the shared contract for every role`() {
        IANavigationContract.all.forEach { (role, navigation) ->
            val expected = jsonRole(role.roleId).getJSONArray("primary")
            val expectedIds = (0 until expected.length())
                .map { expected.getJSONObject(it).getString("id") }
            assertEquals(
                "Level-1 destination ids diverged for ${role.roleId}",
                expectedIds,
                navigation.primary.map { it.id }
            )
        }
    }

    @Test
    fun `level 2 section taxonomy matches the shared contract exactly`() {
        IANavigationContract.all.forEach { (role, navigation) ->
            val expected = jsonRole(role.roleId).getJSONArray("primary")
            (0 until expected.length()).forEach { index ->
                val expectedDestination = expected.getJSONObject(index)
                val destinationId = expectedDestination.getString("id")
                assertEquals(
                    "Level-2 sections diverged for ${role.roleId}/$destinationId",
                    jsonList(expectedDestination, "sections"),
                    navigation.sections(destinationId)
                )
            }
        }
    }

    @Test
    fun `context scopes and their requirements match the shared contract`() {
        IANavigationContract.all.forEach { (role, navigation) ->
            val expected = jsonRole(role.roleId).getJSONObject("contextScopes")
            val expectedScopes = expected.keys().asSequence().toSet()
            assertEquals(
                "Context scopes diverged for ${role.roleId}",
                expectedScopes,
                navigation.contextScopes.map { it.key }.toSet()
            )
            expectedScopes.forEach { scopeKey ->
                val scope = ContextScope.entries.first { it.key == scopeKey }
                assertEquals(
                    "Scope requirement diverged for ${role.roleId}/$scopeKey",
                    ScopeRequirement.fromKey(expected.getString(scopeKey)),
                    navigation.requirement(scope)
                )
            }
        }
    }

    // --- IA V2 structural rules (§1.1, §1.4, §1.5) ---

    @Test
    fun `every role exposes four or five primary destinations`() {
        IANavigationContract.all.forEach { (role, navigation) ->
            val count = navigation.primary.size
            assertTrue(
                "${role.roleId} exposes $count primary destinations; IA V2 allows 4-5",
                count in 4..5
            )
        }
    }

    @Test
    fun `last primary destination is always More`() {
        IANavigationContract.all.forEach { (role, navigation) ->
            assertEquals(
                "${role.roleId} must end with More",
                "More",
                navigation.primary.last().label
            )
        }
    }

    @Test
    fun `no action verb occupies a primary navigation slot`() {
        // IA V2 §1.4 — Add, Import, Export, Print, Message, Check In and friends are actions.
        // "Scan" is the documented Gate Team primary workspace, so it is exempt by name.
        val actionWords = listOf(
            "add", "import", "export", "print", "send", "create", "check in", "assign", "refresh"
        )
        IANavigationContract.all.forEach { (role, navigation) ->
            navigation.primary.forEach { destination ->
                val label = destination.label.lowercase()
                actionWords.forEach { action ->
                    assertFalse(
                        "${role.roleId} exposes action '${destination.label}' as primary navigation",
                        label.contains(action)
                    )
                }
            }
        }
    }

    @Test
    fun `More is not a junk drawer of core product domains`() {
        // IA V2 §1.5 — a role's core domains must live in a primary workspace, not hidden in More.
        val coreDomainsThatMayNotHideInMore = mapOf(
            AppRole.COUPLE to listOf("Tasks", "Budget", "Guest List", "RSVP"),
            AppRole.PLANNER to listOf("Tasks", "Budget", "Guests", "Run Sheet"),
            AppRole.GUEST to listOf("RSVP", "Wedding Pass"),
            AppRole.VENDOR to listOf("Deliverables", "Calendar"),
            AppRole.USHER to listOf("Checked In", "Manual Admission"),
            AppRole.COORDINATOR to listOf("Assignments", "Incidents"),
            AppRole.ADMIN to listOf("Access Events", "Role Memberships")
        )
        coreDomainsThatMayNotHideInMore.forEach { (role, domains) ->
            val navigation = IANavigationContract.forRole(role)
            val moreSections = navigation.sections("more")
            domains.forEach { domain ->
                assertFalse(
                    "${role.roleId} hides core domain '$domain' inside More",
                    moreSections.contains(domain)
                )
            }
        }
    }

    @Test
    fun `every wedding-scoped role requires a wedding, and Admin does not`() {
        // P0-15: Admin is a system-scope console. Requiring a wedding to open Admin Dashboard was
        // exactly what forced a fabricated Charity & Kudzie context.
        IANavigationContract.all.forEach { (role, navigation) ->
            if (role == AppRole.ADMIN) {
                assertTrue("Admin must be system-scoped", navigation.isSystemScoped)
                assertFalse(
                    "Admin must not require a wedding",
                    navigation.requiredScopes.contains(ContextScope.WEDDING)
                )
            } else {
                assertTrue(
                    "${role.roleId} must require a wedding context",
                    navigation.requiredScopes.contains(ContextScope.WEDDING)
                )
            }
        }
    }

    @Test
    fun `roles with a sub-scope declare it as required rather than optional`() {
        // A vendor without an engagement, an usher without a gate and a guest without an identity
        // must not be treated as authorized (P0-3).
        assertTrue(IANavigationContract.forRole(AppRole.VENDOR).requiredScopes.contains(ContextScope.ENGAGEMENT))
        assertTrue(IANavigationContract.forRole(AppRole.USHER).requiredScopes.contains(ContextScope.GATE))
        assertTrue(IANavigationContract.forRole(AppRole.GUEST).requiredScopes.contains(ContextScope.GUEST))
    }
}
