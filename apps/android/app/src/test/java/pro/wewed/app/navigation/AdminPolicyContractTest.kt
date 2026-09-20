package pro.wewed.app.navigation

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import pro.wewed.app.models.AccountLifecycleStatus
import pro.wewed.app.models.AdminAuthorization
import pro.wewed.app.models.AdminPolicy
import pro.wewed.app.models.WewedAdminRole
import java.io.File

/**
 * The native Admin authorization model must equal the web one.
 *
 * `src/lib/wewed-admin-policy.ts` is what the Admin API enforces. If the native model drifts from
 * it, the app offers an administrator a control the server will refuse — which is worse than
 * offering nothing, because it fails at the moment someone relies on it.
 *
 * `mobile/contracts/admin-policy.json` is generated from that module, and this test compares the
 * Kotlin tables to it element by element. The iOS suite asserts the same contract, so the three
 * cannot diverge silently: a change on the web that is not mirrored fails a build.
 */
class AdminPolicyContractTest {

    private val contract: JSONObject by lazy { JSONObject(contractFile().readText()) }

    private fun contractFile(): File {
        var dir: File? = File(System.getProperty("user.dir") ?: ".").absoluteFile
        while (dir != null) {
            val candidate = File(dir, "mobile/contracts/admin-policy.json")
            if (candidate.isFile) return candidate
            dir = dir.parentFile
        }
        throw IllegalStateException("Shared Admin policy contract not found")
    }

    private fun stringList(key: String, source: JSONObject = contract): List<String> {
        val array = source.getJSONArray(key)
        return (0 until array.length()).map { array.getString(it) }
    }

    @Test
    fun contractVersionMatches() {
        assertEquals(AdminPolicy.CONTRACT_VERSION, contract.getString("contractVersion"))
    }

    @Test
    fun rolesMatchTheWebPolicy() {
        assertEquals(stringList("roles"), WewedAdminRole.entries.map { it.wire })
    }

    /** The labels appear in the UI; a mismatch would name a role differently on phone and web. */
    @Test
    fun roleLabelsMatchTheWebPolicy() {
        val labels = contract.getJSONObject("roleLabels")
        WewedAdminRole.entries.forEach { role ->
            assertEquals(labels.getString(role.wire), role.label)
        }
    }

    @Test
    fun permissionsMatchTheWebPolicy() {
        assertEquals(stringList("permissions"), AdminPolicy.permissions)
    }

    /**
     * The grant per role is the heart of it: this is what decides whether a Support Admin is
     * offered a Suspend button.
     */
    @Test
    fun eachRoleGrantsExactlyTheWebPermissionSet() {
        val expected = contract.getJSONObject("rolePermissions")
        WewedAdminRole.entries.forEach { role ->
            val fromContract = stringList(role.wire, expected).toSet()
            assertEquals(
                "permissions for ${role.label}",
                fromContract,
                AdminPolicy.permissionsFor(role)
            )
        }
    }

    @Test
    fun accountLifecycleStatusesMatchTheWebPolicy() {
        assertEquals(
            stringList("accountLifecycleStatuses"),
            AccountLifecycleStatus.entries.map { it.wire }
        )
    }

    @Test
    fun accountTransitionsMatchTheWebPolicy() {
        val expected = contract.getJSONObject("accountTransitions")
        AccountLifecycleStatus.entries.forEach { status ->
            assertEquals(
                "transitions from ${status.wire}",
                stringList(status.wire, expected),
                AdminPolicy.transitionsFrom(status).map { it.wire }
            )
        }
    }

    /** Reaching ACTIVE is approve or restore depending on where it came from — separate decisions. */
    @Test
    fun transitionPermissionsMatchTheWebPolicy() {
        val expected = contract.getJSONObject("transitionPermissions")
        val actual = AdminPolicy.transitionPermissionMap()
        assertEquals(expected.length(), actual.size)
        expected.keys().forEach { key ->
            assertEquals("permission for $key", expected.getString(key), actual[key])
        }
    }

    @Test
    fun restrictiveStatusesMatchTheWebPolicy() {
        val expected = stringList("restrictiveStatuses").toSet()
        val actual = AccountLifecycleStatus.entries.filter { it.isRestrictive }.map { it.wire }.toSet()
        assertEquals(expected, actual)
    }

    @Test
    fun onlyAnActiveAccountOpensAWorkspace() {
        val expected = contract.getString("workspaceStatus")
        AccountLifecycleStatus.entries.forEach { status ->
            assertEquals(status.wire == expected, status.allowsWorkspace)
        }
    }

    // -----------------------------------------------------------------------------------
    // What the model is FOR: deciding which actions to offer
    // -----------------------------------------------------------------------------------

    /** A Support Admin may read an account and work a case. They may not suspend it. */
    @Test
    fun supportAdminIsNotOfferedAccountLifecycleActions() {
        val support = AdminAuthorization.resolve(WewedAdminRole.SUPPORT_ADMIN)
        assertTrue(support.can("admin.accounts.read"))
        assertTrue(support.can("admin.support.manage"))
        assertFalse(support.can("admin.accounts.suspend"))
        assertTrue(
            support.availableTransitions(AccountLifecycleStatus.ACTIVE).isEmpty()
        )
    }

    @Test
    fun operationsAdminIsOfferedTheAccountLifecycleActions() {
        val ops = AdminAuthorization.resolve(WewedAdminRole.OPERATIONS_ADMIN)
        val offered = ops.availableTransitions(AccountLifecycleStatus.ACTIVE)
        assertEquals(
            setOf(
                AccountLifecycleStatus.SUSPENDED, AccountLifecycleStatus.BLOCKED,
                AccountLifecycleStatus.CANCELLED, AccountLifecycleStatus.ARCHIVED
            ),
            offered.toSet()
        )
    }

    /** Approving a pending account and restoring a suspended one are different permissions. */
    @Test
    fun approveAndRestoreAreDistinctPermissions() {
        assertEquals(
            "admin.accounts.approve",
            AdminPolicy.permissionForTransition(
                AccountLifecycleStatus.PENDING_REVIEW, AccountLifecycleStatus.ACTIVE
            )
        )
        assertEquals(
            "admin.accounts.restore",
            AdminPolicy.permissionForTransition(
                AccountLifecycleStatus.SUSPENDED, AccountLifecycleStatus.ACTIVE
            )
        )
    }

    /** An invalid transition is refused whatever the role — Super Admin included. */
    @Test
    fun anInvalidTransitionIsRefusedEvenForSuperAdmin() {
        val superAdmin = AdminAuthorization.resolve(WewedAdminRole.SUPER_ADMIN)
        assertFalse(
            superAdmin.canTransition(
                AccountLifecycleStatus.PENDING_REVIEW, AccountLifecycleStatus.SUSPENDED
            )
        )
        assertFalse(
            superAdmin.canTransition(AccountLifecycleStatus.ACTIVE, AccountLifecycleStatus.ACTIVE)
        )
    }

    /** An explicit grant may narrow a role. A client that could widen it would self-authorize. */
    @Test
    fun anExplicitGrantCannotWidenARole() {
        val analyst = AdminAuthorization.resolve(
            WewedAdminRole.ANALYST,
            explicitPermissions = listOf("admin.accounts.read", "admin.accounts.suspend")
        )
        assertTrue(analyst.can("admin.accounts.read"))
        assertFalse(
            "an analyst must not gain suspend by asking for it",
            analyst.can("admin.accounts.suspend")
        )
    }

    /** No native permission may exist that the web policy does not declare. */
    @Test
    fun nativeInventsNoPermissionOfItsOwn() {
        val declared = stringList("permissions").toSet()
        WewedAdminRole.entries.forEach { role ->
            val invented = AdminPolicy.permissionsFor(role) - declared
            assertTrue("$role grants undeclared permissions: $invented", invented.isEmpty())
        }
    }
}
