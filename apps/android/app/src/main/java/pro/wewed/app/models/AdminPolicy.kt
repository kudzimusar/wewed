package pro.wewed.app.models

/**
 * The Wewed Admin authorization model, mirrored from the web policy module.
 *
 * Native Admin previously reduced authorization to `role == admin`, which is not the product's
 * model at all. The real one names five corporate roles, twenty-five permissions, and a governed
 * account lifecycle whose transitions each require a specific permission. A Support Admin can read
 * an account and manage a support case; they cannot suspend, block or cancel anything.
 *
 * An app that offers an action the server will refuse is worse than an app that offers none: it
 * teaches an administrator that a control exists, then fails at the moment they rely on it. So
 * these values are DERIVED from `src/lib/wewed-admin-policy.ts` — the same module the Admin API
 * enforces — through `mobile/contracts/admin-policy.json`, and a unit test asserts equality.
 * A change on the web that is not mirrored here fails the build rather than reaching a device.
 *
 * Authorization is still resolved by the server. This model decides only what to OFFER.
 */
enum class WewedAdminRole(val wire: String, val label: String) {
    SUPER_ADMIN("wewed_super_admin", "Super Admin"),
    OPERATIONS_ADMIN("wewed_operations_admin", "Operations Admin"),
    BILLING_ADMIN("wewed_billing_admin", "Billing Admin"),
    SUPPORT_ADMIN("wewed_support_admin", "Support Admin"),
    ANALYST("wewed_analyst", "Analyst / Viewer");

    companion object {
        fun fromWire(value: String?): WewedAdminRole? = entries.find { it.wire == value }
    }
}

/** An account's governed lifecycle state. */
enum class AccountLifecycleStatus(val wire: String) {
    PENDING_REVIEW("pending_review"),
    ACTIVE("active"),
    REJECTED("rejected"),
    SUSPENDED("suspended"),
    BLOCKED("blocked"),
    CANCELLED("cancelled"),
    ARCHIVED("archived");

    /** An account that cannot currently be used, as distinct from one awaiting a decision. */
    val isRestrictive: Boolean
        get() = this in setOf(REJECTED, SUSPENDED, BLOCKED, CANCELLED, ARCHIVED)

    /** Only an active account opens a workspace. */
    val allowsWorkspace: Boolean get() = this == ACTIVE

    companion object {
        fun fromWire(value: String?): AccountLifecycleStatus =
            entries.find { it.wire == value } ?: if (value == "trial") ACTIVE else PENDING_REVIEW
    }
}

/**
 * What an authenticated administrator may do.
 *
 * Built from the role the SERVER returned plus any explicit grants it bounded. Nothing here is
 * chosen by the app or by the person using it.
 */
data class AdminAuthorization(
    val role: WewedAdminRole,
    val permissions: Set<String>,
    /** Account ids this administrator is scoped to; empty means platform-wide. */
    val accountScope: List<String> = emptyList(),
    val provenance: DataProvenance = DataProvenance.PRODUCTION_DERIVED
) {
    fun can(permission: String): Boolean = permission in permissions

    val isPlatformWide: Boolean get() = accountScope.isEmpty()

    /** Whether this administrator may move an account from one state to another. */
    fun canTransition(from: AccountLifecycleStatus, to: AccountLifecycleStatus): Boolean {
        if (!AdminPolicy.isValidTransition(from, to)) return false
        return can(AdminPolicy.permissionForTransition(from, to))
    }

    /** The transitions to OFFER for an account: valid for its state and permitted for this role. */
    fun availableTransitions(from: AccountLifecycleStatus): List<AccountLifecycleStatus> =
        AdminPolicy.transitionsFrom(from).filter { canTransition(from, it) }

    companion object {
        /** Resolves from a server-reported role, bounded by that role's permission set. */
        fun resolve(
            role: WewedAdminRole,
            explicitPermissions: Collection<String>? = null,
            accountScope: List<String> = emptyList()
        ): AdminAuthorization {
            val defaults = AdminPolicy.permissionsFor(role)
            // An explicit grant may narrow a role but never widen it: the server bounds the set,
            // and a client that could widen it would be granting itself authority.
            val effective = explicitPermissions
                ?.filter { it in defaults }
                ?.toSet()
                ?: defaults
            return AdminAuthorization(role, effective, accountScope)
        }
    }
}

/**
 * The policy tables themselves.
 *
 * Kept as data rather than branching logic so the unit test can compare them to the shared contract
 * element by element.
 */
object AdminPolicy {

    const val CONTRACT_VERSION = "wewed-admin-policy/1"

    val permissions: List<String> = listOf(
        "admin.overview.read",
        "admin.analytics.read",
        "admin.accounts.read",
        "admin.accounts.create",
        "admin.accounts.approve",
        "admin.accounts.reject",
        "admin.accounts.suspend",
        "admin.accounts.block",
        "admin.accounts.cancel",
        "admin.accounts.archive",
        "admin.accounts.restore",
        "admin.departments.read",
        "admin.departments.manage",
        "admin.members.read",
        "admin.members.manage",
        "admin.platform_admins.read",
        "admin.platform_admins.manage",
        "admin.scopes.manage",
        "admin.billing.read",
        "admin.billing.manage",
        "admin.support.read",
        "admin.support.manage",
        "admin.incidents.read",
        "admin.incidents.manage",
        "admin.audit.read"
    )

    private val rolePermissions: Map<WewedAdminRole, Set<String>> = mapOf(
        // Super Admin holds every declared permission; the web module writes this as '*'.
        WewedAdminRole.SUPER_ADMIN to permissions.toSet(),
        WewedAdminRole.OPERATIONS_ADMIN to setOf(
            "admin.analytics.read", "admin.accounts.read", "admin.accounts.create",
            "admin.accounts.approve", "admin.accounts.reject", "admin.accounts.suspend",
            "admin.accounts.block", "admin.accounts.cancel", "admin.accounts.archive",
            "admin.accounts.restore", "admin.departments.read", "admin.departments.manage",
            "admin.support.read", "admin.support.manage", "admin.incidents.read",
            "admin.incidents.manage", "admin.audit.read"
        ),
        WewedAdminRole.BILLING_ADMIN to setOf(
            "admin.analytics.read", "admin.accounts.read", "admin.departments.read",
            "admin.billing.read", "admin.billing.manage", "admin.audit.read"
        ),
        WewedAdminRole.SUPPORT_ADMIN to setOf(
            "admin.accounts.read", "admin.departments.read", "admin.support.read",
            "admin.support.manage", "admin.incidents.read", "admin.audit.read"
        ),
        WewedAdminRole.ANALYST to setOf(
            "admin.analytics.read", "admin.accounts.read", "admin.departments.read",
            "admin.billing.read", "admin.support.read", "admin.incidents.read", "admin.audit.read"
        )
    )

    private val transitions: Map<AccountLifecycleStatus, List<AccountLifecycleStatus>> = mapOf(
        AccountLifecycleStatus.PENDING_REVIEW to listOf(
            AccountLifecycleStatus.ACTIVE, AccountLifecycleStatus.REJECTED
        ),
        AccountLifecycleStatus.ACTIVE to listOf(
            AccountLifecycleStatus.SUSPENDED, AccountLifecycleStatus.BLOCKED,
            AccountLifecycleStatus.CANCELLED, AccountLifecycleStatus.ARCHIVED
        ),
        AccountLifecycleStatus.REJECTED to listOf(
            AccountLifecycleStatus.PENDING_REVIEW, AccountLifecycleStatus.ARCHIVED
        ),
        AccountLifecycleStatus.SUSPENDED to listOf(
            AccountLifecycleStatus.ACTIVE, AccountLifecycleStatus.BLOCKED,
            AccountLifecycleStatus.CANCELLED, AccountLifecycleStatus.ARCHIVED
        ),
        AccountLifecycleStatus.BLOCKED to listOf(
            AccountLifecycleStatus.ACTIVE, AccountLifecycleStatus.CANCELLED,
            AccountLifecycleStatus.ARCHIVED
        ),
        AccountLifecycleStatus.CANCELLED to listOf(
            AccountLifecycleStatus.ACTIVE, AccountLifecycleStatus.ARCHIVED
        ),
        AccountLifecycleStatus.ARCHIVED to listOf(
            AccountLifecycleStatus.PENDING_REVIEW, AccountLifecycleStatus.ACTIVE
        )
    )

    fun permissionsFor(role: WewedAdminRole): Set<String> = rolePermissions[role].orEmpty()

    fun transitionsFrom(status: AccountLifecycleStatus): List<AccountLifecycleStatus> =
        transitions[status].orEmpty()

    fun isValidTransition(from: AccountLifecycleStatus, to: AccountLifecycleStatus): Boolean =
        from != to && to in transitionsFrom(from)

    /**
     * Which permission a transition requires.
     *
     * Reaching ACTIVE means two different things: approving something never yet approved, or
     * restoring something that was restricted. They are separate permissions because they are
     * separate decisions.
     */
    fun permissionForTransition(from: AccountLifecycleStatus, to: AccountLifecycleStatus): String =
        when (to) {
            AccountLifecycleStatus.ACTIVE ->
                if (from == AccountLifecycleStatus.PENDING_REVIEW) "admin.accounts.approve"
                else "admin.accounts.restore"
            AccountLifecycleStatus.REJECTED -> "admin.accounts.reject"
            AccountLifecycleStatus.SUSPENDED -> "admin.accounts.suspend"
            AccountLifecycleStatus.BLOCKED -> "admin.accounts.block"
            AccountLifecycleStatus.CANCELLED -> "admin.accounts.cancel"
            AccountLifecycleStatus.ARCHIVED -> "admin.accounts.archive"
            else -> "admin.accounts.restore"
        }

    /** Every transition, keyed "from->to", for contract comparison. */
    fun transitionPermissionMap(): Map<String, String> = buildMap {
        transitions.forEach { (from, targets) ->
            targets.forEach { to -> put("${from.wire}->${to.wire}", permissionForTransition(from, to)) }
        }
    }

    fun rolePermissionMap(): Map<String, Set<String>> =
        rolePermissions.entries.associate { (role, granted) -> role.wire to granted }
}
